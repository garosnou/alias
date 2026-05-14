// Основная логика игры Alias

// Состояние игры
let gameState = {
    isPlaying: false,
    isPaused: false,
    currentWordIndex: 0,
    correctAnswers: 0,
    skippedWords: 0,
    totalWords: 0,
    timeLimit: 60,
    timeRemaining: 60,
    words: [],
    category: 'general',
    startTime: null,
    timerInterval: null,
    score: 0,
    correctWords: [], // Список отгаданных слов
    skippedWordsList: [], // Список пропущенных слов
    maxSkipsAllowed: 0,
    skipsRemaining: 0,
    /** Пользовательский пакет исчерпан: пауза и окно дозагрузки .txt */
    awaitingCustomWordPack: false,
    /** Раунд начался без слов (пакет пуст) — после дозагрузки нужен отсчёт/таймер как при обычном старте */
    timerNeverStarted: false
};

// Настройки по умолчанию
let settings = {
    gameTime: 60,
    category: 'general',
    wordSource: 'builtin' // builtin | custom
};

// Хранилище пользовательских слов (в памяти)
let CUSTOM_WORDS = null;
let CUSTOM_WORDS_META = { fileName: null, usedCount: 0, total: 0 };
let CUSTOM_WORDS_USED = new Set(); // множество использованных слов (строки в верхнем регистре)



// Состояние турнира
let tournamentState = {
    isTournamentMode: false,
    teams: [],
    matches: [],
    currentRound: 0,
    currentMatch: 0,
    currentTeamIndex: 0,
    currentPlayerIndex: 0,
    matchScores: [],
    tournamentScores: [],
    maxRounds: 0,
    gameMode: 'sequential', // sequential | alternate
    currentMatchPlayerResults: [], // результаты по игрокам текущего матча
    isOvertime: false, // дополнительный раунд при ничьей
    overtimePlayers: [] // игроки для дополнительного раунда
};

// Состояние соревновательного режима (каждый сам за себя)
let competitiveState = {
    isCompetitiveMode: false,
    players: [], // {id, name, score}
    currentPlayerIndex: 0,
    prepSeconds: 3,
    prepTimer: null
};

/** Гибкий турнир: пул команд, раунды по 1–16 команд */
const FLEXIBLE_MAX_TEAMS_IN_ROUND = 16;

let flexibleTournamentState = {
    isFlexibleMode: false,
    teams: [],
    pendingRoundTeamIndices: null,
    roundTeamIndices: [],
    /** Индекс текущего хода в раунде (0 … круги×k − 1) */
    flexibleTurnIndex: 0,
    roundScores: [],
    roundPlayerResults: [],
    gameTime: 60,
    totalScoresByTeam: {},
    /** 0 = без лимита; иначе макс. пропусков за один ход объясняющего */
    maxSkipsPerTurn: 0,
    /** null / пусто = число кругов по самой большой команде; иначе явное число кругов (1…50) */
    roundCirclesOverride: null,
    /** Сколько игроков «Игрок 1…» при быстром добавлении команды */
    defaultPlayersForQuickAdd: 3,
    /** interleaved — по одному с каждой команды по кругу; byTeam — сначала все ходы первой команды, затем второй */
    turnOrder: 'interleaved'
};

const FLEXIBLE_STORAGE_KEY = 'alias-standalone-flexible-v1';

function readFlexibleStorageSnapshot() {
    try {
        const raw = localStorage.getItem(FLEXIBLE_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function writeFlexibleTournamentToStorage() {
    try {
        const payload = {
            teams: flexibleTournamentState.teams,
            totalScoresByTeam: flexibleTournamentState.totalScoresByTeam,
            gameTime: flexibleTournamentState.gameTime,
            maxSkipsPerTurn: flexibleTournamentState.maxSkipsPerTurn,
            roundCirclesOverride: flexibleTournamentState.roundCirclesOverride,
            defaultPlayersForQuickAdd: flexibleTournamentState.defaultPlayersForQuickAdd,
            turnOrder: flexibleTournamentState.turnOrder === 'byTeam' ? 'byTeam' : 'interleaved'
        };
        localStorage.setItem(FLEXIBLE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
}

function flexPersistedSnapshotHasData(snap) {
    if (!snap || typeof snap !== 'object') return false;
    if (Array.isArray(snap.teams) && snap.teams.length > 0) return true;
    if (snap.totalScoresByTeam && typeof snap.totalScoresByTeam === 'object' && Object.keys(snap.totalScoresByTeam).length > 0) return true;
    return false;
}

function applyFlexibleSnapshotToState(snap) {
    if (!snap || typeof snap !== 'object') return;
    if (Array.isArray(snap.teams)) flexibleTournamentState.teams = snap.teams;
    if (snap.totalScoresByTeam && typeof snap.totalScoresByTeam === 'object') {
        flexibleTournamentState.totalScoresByTeam = { ...snap.totalScoresByTeam };
    } else {
        flexibleTournamentState.totalScoresByTeam = {};
    }
    if (typeof snap.gameTime === 'number' && snap.gameTime > 0) {
        flexibleTournamentState.gameTime = snap.gameTime;
    } else {
        const g = parseInt(snap.gameTime, 10);
        if (!Number.isNaN(g) && g > 0) flexibleTournamentState.gameTime = g;
    }
    const ms = parseInt(snap.maxSkipsPerTurn, 10);
    flexibleTournamentState.maxSkipsPerTurn = !Number.isNaN(ms) && ms > 0 ? ms : 0;
    const ro = snap.roundCirclesOverride;
    if (ro == null || ro === '') flexibleTournamentState.roundCirclesOverride = null;
    else {
        const c = parseInt(ro, 10);
        flexibleTournamentState.roundCirclesOverride = !Number.isNaN(c) && c > 0 ? c : null;
    }
    const dq = parseInt(snap.defaultPlayersForQuickAdd, 10);
    flexibleTournamentState.defaultPlayersForQuickAdd = !Number.isNaN(dq) && dq >= 1 ? Math.min(dq, 20) : 3;
    flexibleTournamentState.turnOrder = snap.turnOrder === 'byTeam' ? 'byTeam' : 'interleaved';
}

function clearFlexibleRoundProgressOnly() {
    flexibleTournamentState.roundTeamIndices = [];
    flexibleTournamentState.flexibleTurnIndex = 0;
    flexibleTournamentState.roundScores = [];
    flexibleTournamentState.roundPlayerResults = [];
    flexibleTournamentState.pendingRoundTeamIndices = null;
}

function resetFlexibleTournamentPersisted() {
    if (!confirm('Сбросить гибкий турнир? Удалятся все команды, сохранённые очки и настройки раунда в этом режиме.')) return;
    flexibleTournamentState.teams = [];
    flexibleTournamentState.totalScoresByTeam = {};
    flexibleTournamentState.gameTime = 60;
    flexibleTournamentState.maxSkipsPerTurn = 0;
    flexibleTournamentState.roundCirclesOverride = null;
    flexibleTournamentState.defaultPlayersForQuickAdd = 3;
    flexibleTournamentState.turnOrder = 'interleaved';
    flexibleEditingTeamIndex = null;
    clearFlexibleRoundProgressOnly();
    try {
        localStorage.removeItem(FLEXIBLE_STORAGE_KEY);
    } catch (_) {}
    syncFlexibleTournamentFormFields();
    renderFlexibleTeamsList();
    renderFlexibleRoundTeamCheckboxes();
    showNotification('Гибкий турнир сброшен');
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function syncFlexibleTournamentFormFields() {
    const tSel = document.getElementById('flexible-tournament-time');
    if (tSel) tSel.value = String(flexibleTournamentState.gameTime || 60);
    const ms = document.getElementById('flexible-max-skips');
    if (ms) ms.value = flexibleTournamentState.maxSkipsPerTurn > 0 ? String(flexibleTournamentState.maxSkipsPerTurn) : '';
    const rc = document.getElementById('flexible-round-circles');
    if (rc) rc.value = flexibleTournamentState.roundCirclesOverride != null ? String(flexibleTournamentState.roundCirclesOverride) : '';
    const dq = document.getElementById('flexible-quick-default-players');
    if (dq) dq.value = String(flexibleTournamentState.defaultPlayersForQuickAdd || 3);
    const ordByTeam = document.getElementById('flexible-turn-order-by-team');
    const ordInter = document.getElementById('flexible-turn-order-interleaved');
    if (ordByTeam && ordInter) {
        if (flexibleTournamentState.turnOrder === 'byTeam') ordByTeam.checked = true;
        else ordInter.checked = true;
    }
}

function readFlexibleSettingsFromForm() {
    const tSel = document.getElementById('flexible-tournament-time');
    if (tSel) {
        let gt = parseInt(tSel.value, 10);
        if (Number.isNaN(gt) || gt <= 0) gt = 60;
        flexibleTournamentState.gameTime = gt;
    }
    const msEl = document.getElementById('flexible-max-skips');
    if (msEl) {
        const v = parseInt(msEl.value, 10);
        flexibleTournamentState.maxSkipsPerTurn = !Number.isNaN(v) && v > 0 ? Math.min(v, 999) : 0;
    }
    const rcEl = document.getElementById('flexible-round-circles');
    if (rcEl) {
        const raw = (rcEl.value || '').trim();
        if (!raw) flexibleTournamentState.roundCirclesOverride = null;
        else {
            const c = parseInt(raw, 10);
            flexibleTournamentState.roundCirclesOverride = !Number.isNaN(c) && c >= 1 ? Math.min(c, 50) : null;
        }
    }
    const dqEl = document.getElementById('flexible-quick-default-players');
    if (dqEl) {
        const d = parseInt(dqEl.value, 10);
        flexibleTournamentState.defaultPlayersForQuickAdd = !Number.isNaN(d) && d >= 1 ? Math.min(d, 20) : 3;
    }
    const ordEl = document.querySelector('input[name="flexible-turn-order"]:checked');
    flexibleTournamentState.turnOrder = ordEl && ordEl.value === 'byTeam' ? 'byTeam' : 'interleaved';
}

function setupFlexibleTournamentFormListeners() {
    ['flexible-tournament-time', 'flexible-max-skips', 'flexible-round-circles', 'flexible-quick-default-players'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
            if (!flexibleTournamentState.isFlexibleMode) return;
            readFlexibleSettingsFromForm();
            writeFlexibleTournamentToStorage();
            if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
        });
    });
    document.querySelectorAll('input[name="flexible-turn-order"]').forEach(r => {
        r.addEventListener('change', () => {
            if (!flexibleTournamentState.isFlexibleMode) return;
            readFlexibleSettingsFromForm();
            writeFlexibleTournamentToStorage();
            if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
        });
    });
}

// Инициализация игры
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    loadLastGameInfo();
    loadCustomWordsFromStorage();
    updateWordSourceUI();
    setupKeyboardControls();
    setupCustomPackControls();
    setupCustomPackDepletedOverlay();
    setupFlexibleTournamentFormListeners();
    updateMainInfoBanner();
});

/** Сохранить пользовательский пакет и сбросить «уже сыграно» */
function installCustomWordPack(words, fileName) {
    CUSTOM_WORDS = words;
    try {
        localStorage.setItem('alias-custom-words', JSON.stringify(words));
    } catch (_) {}
    CUSTOM_WORDS_META = { fileName: fileName || 'custom.txt', usedCount: 0, total: words.length };
    try {
        localStorage.setItem('alias-custom-words-meta', JSON.stringify(CUSTOM_WORDS_META));
    } catch (_) {}
    CUSTOM_WORDS_USED = new Set();
    try {
        localStorage.removeItem('alias-custom-words-used');
    } catch (_) {}
    updateCustomPackStatus();
    updateMainInfoBanner();
}

function openCustomWordPackDepletedOverlay() {
    const el = document.getElementById('custom-pack-depleted-overlay');
    if (el) el.classList.remove('hidden');
}

function closeCustomWordPackDepletedOverlay() {
    const el = document.getElementById('custom-pack-depleted-overlay');
    if (el) el.classList.add('hidden');
}

function pauseForCustomWordPack() {
    gameState.isPaused = true;
    gameState.awaitingCustomWordPack = true;
    const prep = document.getElementById('competitive-prep');
    if (prep) prep.style.display = 'none';
    openCustomWordPackDepletedOverlay();
    showCurrentWord();
    updateGameUI();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function setupCustomPackDepletedOverlay() {
    const importBtn = document.getElementById('custom-pack-depleted-import');
    const endBtn = document.getElementById('custom-pack-depleted-endgame');
    const fileInput = document.getElementById('custom-pack-depleted-input');
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
            if (!files.length) {
                showNotification('Выберите файл .txt');
                return;
            }
            try {
                const words = await parseWordFile(files[0]);
                installCustomWordPack(words, files[0].name || 'custom.txt');
                const WORDS_BATCH_SIZE = 50;
                const more = getWordsForCurrentSource(gameState.category, WORDS_BATCH_SIZE) || [];
                if (!more.length) {
                    showNotification('В файле нет ни одного слова');
                    return;
                }
                gameState.words.push(...more);
                gameState.awaitingCustomWordPack = false;
                gameState.isPaused = false;
                closeCustomWordPackDepletedOverlay();
                if (fileInput) fileInput.value = '';

                if (gameState.timerNeverStarted) {
                    gameState.timerNeverStarted = false;
                    if (competitiveState.isCompetitiveMode) {
                        updateGameUI();
                        startCompetitivePreparation();
                    } else {
                        const ftTurn = flexibleTournamentState.isFlexibleMode ? getFlexibleCurrentTurn() : null;
                        const prepLabel = ftTurn ? `${ftTurn.team.name} — ${ftTurn.playerName}` : null;
                        updateGameUI();
                        startRoundPreparation(3, prepLabel, () => {
                            startTimer();
                            showCurrentWord();
                        });
                    }
                } else {
                    showCurrentWord();
                    updateGameUI();
                }
                showNotification('Пакет загружен, игра продолжается');
                if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
            } catch (e) {
                console.error(e);
                showNotification(e && e.message ? String(e.message) : 'Ошибка загрузки файла');
            }
        });
    }
    if (endBtn) {
        endBtn.addEventListener('click', () => {
            closeCustomWordPackDepletedOverlay();
            endGame();
        });
    }
}

// Настройка UI и событий для пользовательских паков
function setupCustomPackControls() {
    const sourceBuiltin = document.getElementById('source-builtin');
    const sourceCustom = document.getElementById('source-custom');
    const uploader = document.getElementById('custom-pack-uploader');
    const importBtn = document.getElementById('import-pack-btn');
    const clearBtn = document.getElementById('clear-pack-btn');
    const input = document.getElementById('word-pack-input');

    if (sourceBuiltin) {
        sourceBuiltin.addEventListener('change', () => {
            settings.wordSource = 'builtin';
            updateWordSourceUI();
        });
    }
    if (sourceCustom) {
        sourceCustom.addEventListener('change', () => {
            settings.wordSource = 'custom';
            updateWordSourceUI();
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const files = input && input.files ? Array.from(input.files) : [];
            if (!files.length) {
                showNotification('Выберите папку/файлы с .txt');
                return;
            }
            try {
                const words = await parseWordFile(files[0]);
                installCustomWordPack(words, files[0].name || 'custom.txt');
                showNotification('Файл загружен!');
            } catch (e) {
                console.error(e);
                showNotification('Ошибка загрузки файла');
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            CUSTOM_WORDS = null;
            localStorage.removeItem('alias-custom-words');
            CUSTOM_WORDS_META = { fileName: null, usedCount: 0, total: 0 };
            localStorage.removeItem('alias-custom-words-meta');
            // также сбрасываем список сыгранных слов
            CUSTOM_WORDS_USED = new Set();
            localStorage.removeItem('alias-custom-words-used');
            updateCustomPackStatus();
            showNotification('Пользовательские слова очищены');
            updateMainInfoBanner();
            // Сбрасываем состояние игры при очистке словаря
            resetGameUI();
        });
    }

    updateCustomPackStatus();
}

function updateWordSourceUI() {
    const uploader = document.getElementById('custom-pack-uploader');
    const sourceCustom = document.getElementById('source-custom');
    const sourceBuiltin = document.getElementById('source-builtin');
    const categorySelector = document.getElementById('category-selector');
    
    if (!uploader || !sourceCustom || !sourceBuiltin) return;
    
    uploader.style.display = settings.wordSource === 'custom' ? '' : 'none';
    categorySelector.style.display = settings.wordSource === 'custom' ? 'none' : '';
    
    sourceCustom.checked = settings.wordSource === 'custom';
    sourceBuiltin.checked = settings.wordSource === 'builtin';
    
    // Сбрасываем состояние игры при смене источника слов
    resetGameUI();
}

function updateCustomPackStatus() {
    const status = document.getElementById('custom-pack-status');
    if (!status) return;
    if (!CUSTOM_WORDS) {
        status.textContent = 'Файл не загружен';
        return;
    }
    status.textContent = `Загружено слов: ${CUSTOM_WORDS.length}`;
}

// Загрузка пользовательских слов из localStorage
function loadCustomWordsFromStorage() {
    const raw = localStorage.getItem('alias-custom-words');
    if (!raw) return;
    try {
        CUSTOM_WORDS = JSON.parse(raw);
        const metaRaw = localStorage.getItem('alias-custom-words-meta');
        CUSTOM_WORDS_META = metaRaw ? JSON.parse(metaRaw) : { fileName: null, usedCount: 0, total: CUSTOM_WORDS.length };
        const usedRaw = localStorage.getItem('alias-custom-words-used');
        if (usedRaw) {
            try { CUSTOM_WORDS_USED = new Set(JSON.parse(usedRaw)); } catch (_) { CUSTOM_WORDS_USED = new Set(); }
        } else {
            CUSTOM_WORDS_USED = new Set();
        }
    } catch (_) {
        CUSTOM_WORDS = null;
        CUSTOM_WORDS_META = { fileName: null, usedCount: 0, total: 0 };
        CUSTOM_WORDS_USED = new Set();
    }
}

// Загрузка настроек из localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('alias-settings');
    if (savedSettings) {
        settings = { ...settings, ...JSON.parse(savedSettings) };
    }
    updateSettingsUI();
    updateMainInfoBanner();
}

// Сохранение настроек в localStorage
function saveSettings() {
    settings.gameTime = parseInt(document.getElementById('game-time').value);
    settings.wordSource = document.getElementById('source-custom').checked ? 'custom' : 'builtin';
    
    // Сохраняем категорию только для встроенных слов
    if (settings.wordSource === 'builtin') {
        settings.category = document.getElementById('category').value;
    } else {
        settings.category = 'custom';
    }
    
    localStorage.setItem('alias-settings', JSON.stringify(settings));
    showNotification('Настройки сохранены!');
    showMainMenu();
    updateMainInfoBanner();
}

// Обновление UI настроек
function updateSettingsUI() {
    document.getElementById('game-time').value = settings.gameTime;
    
    // Восстанавливаем категорию только для встроенных слов
    if (settings.wordSource === 'builtin' && settings.category !== 'custom') {
        document.getElementById('category').value = settings.category;
    }
    
    updateWordSourceUI();
}

function builtinCategoryName(key) {
    const map = {
        'general': 'Общие слова',
        'professions': 'Профессии',
        'animals': 'Животные',
        'sport': 'Спорт',
        'food': 'Еда',
        'cities': 'Города',
        'custom': 'Пользовательские'
    };
    return map[key] || key;
}

// Навигация между экранами
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Сброс UI и таймеров перед сменой режима/экрана
function resetGameUI() {
    closeCustomWordPackDepletedOverlay();
    // Останавливаем любые таймеры
    if (gameState && gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    if (competitiveState && competitiveState.prepTimer) {
        clearInterval(competitiveState.prepTimer);
        competitiveState.prepTimer = null;
    }

    // Сбрасываем базовое состояние игры (не запущена)
    gameState.isPlaying = false;
    gameState.isPaused = false;
    gameState.currentWordIndex = 0;
    gameState.correctAnswers = 0;
    gameState.skippedWords = 0;
    gameState.score = 0;
    gameState.words = [];
    gameState.correctWords = [];
    gameState.skippedWordsList = [];
    gameState.timeLimit = settings.gameTime;
    gameState.timeRemaining = settings.gameTime;
    gameState.maxSkipsAllowed = 0;
    gameState.skipsRemaining = 0;
    gameState.awaitingCustomWordPack = false;
    gameState.timerNeverStarted = false;

    // Сбрасываем визуальные элементы игрового экрана
    const timerElement = document.getElementById('timer');
    const progressElement = document.getElementById('progress-fill');
    const scoreEl = document.getElementById('current-score');
    const wordEl = document.getElementById('current-word');
    const wordNumEl = document.getElementById('current-word-number');
    const correctWordsContainer = document.getElementById('correct-words-list');
    const skippedWordsContainer = document.getElementById('skipped-words-list');
    const correctCount = document.getElementById('correct-count');
    const skippedCount = document.getElementById('skipped-count');

    if (timerElement) {
        timerElement.textContent = String(settings.gameTime);
        timerElement.style.color = '';
    }
    if (progressElement) {
        progressElement.style.width = '100%';
        progressElement.style.background = '';
    }
    if (scoreEl) scoreEl.textContent = '0';
    if (wordEl) wordEl.textContent = '';
    if (wordNumEl) wordNumEl.textContent = '0';
    const wordStatWrap = document.getElementById('host-word-stat-wrap');
    if (wordStatWrap) wordStatWrap.style.display = '';
    if (correctWordsContainer) correctWordsContainer.innerHTML = '';
    if (skippedWordsContainer) skippedWordsContainer.innerHTML = '';
    if (correctCount) correctCount.textContent = '0';
    if (skippedCount) skippedCount.textContent = '0';

    // Скрываем подготовку
    const prep = document.getElementById('competitive-prep');
    if (prep) prep.style.display = 'none';

    // Скрываем/показываем соревновательное табло по необходимости
    const sb = document.getElementById('competitive-scoreboard');
    if (sb) sb.style.display = 'none';
}

function showMainMenu() {
    // При входе в главное меню выходим из соревновательного режима
    closeCustomWordPackDepletedOverlay();
    competitiveState.isCompetitiveMode = false;
    flexibleTournamentState.isFlexibleMode = false;
    const sb = document.getElementById('competitive-scoreboard');
    if (sb) sb.style.display = 'none';
    const prep = document.getElementById('competitive-prep');
    if (prep) prep.style.display = 'none';
    showScreen('main-menu');
}
function showSettings() { updateSettingsUI(); showScreen('settings'); }
function showRules() { showScreen('rules'); }

// Начало игры
function startGame() {
    // Проверка наличия файла при выборе custom
    if (settings.wordSource === 'custom') {
        if (!CUSTOM_WORDS) {
            showNotification('Загрузите файл со словами в настройках');
            showSettings();
            return;
        }
        if (!CUSTOM_WORDS.length) {
            showNotification('Файл со словами пуст');
            showSettings();
            return;
        }
    }

    // Определяем настройки для игры
    let gameTime, category;
    
    if (tournamentState.isTournamentMode) {
        // Используем настройки турнира; источник слов и категория берем из общих настроек
        gameTime = parseInt(document.getElementById('tournament-game-time').value);
        category = settings.wordSource === 'builtin' ? settings.category : 'custom';
        // режим игры фиксируется при старте турнира
    } else if (flexibleTournamentState.isFlexibleMode) {
        readFlexibleSettingsFromForm();
        const ftSel = document.getElementById('flexible-tournament-time');
        gameTime = ftSel ? parseInt(ftSel.value, 10) : flexibleTournamentState.gameTime || 60;
        if (Number.isNaN(gameTime) || gameTime <= 0) gameTime = 60;
        flexibleTournamentState.gameTime = gameTime;
        writeFlexibleTournamentToStorage();
        category = settings.wordSource === 'builtin' ? settings.category : 'custom';
    } else if (competitiveState.isCompetitiveMode) {
        gameTime = settings.gameTime;
        category = settings.category;
    } else {
        // Используем обычные настройки
        gameTime = settings.gameTime;
        category = settings.category;
    }

    const WORDS_BATCH_SIZE = 50;
    const words = getWordsForCurrentSource(category, WORDS_BATCH_SIZE);

    let maxSkipsAllowed = 0;
    let skipsRemaining = 0;
    if (flexibleTournamentState.isFlexibleMode) {
        const lim = parseInt(flexibleTournamentState.maxSkipsPerTurn, 10) || 0;
        if (lim > 0) {
            maxSkipsAllowed = lim;
            skipsRemaining = lim;
        }
    }

    if (!words.length && settings.wordSource === 'custom') {
        gameState = {
            isPlaying: true,
            isPaused: true,
            awaitingCustomWordPack: true,
            timerNeverStarted: true,
            currentWordIndex: 0,
            correctAnswers: 0,
            skippedWords: 0,
            totalWords: 0,
            timeLimit: gameTime,
            timeRemaining: gameTime,
            words: [],
            category: category,
            startTime: Date.now(),
            timerInterval: null,
            score: 0,
            correctWords: [],
            skippedWordsList: [],
            maxSkipsAllowed,
            skipsRemaining
        };
        updateGameUI();
        showScreen('game-screen');
        const prep = document.getElementById('competitive-prep');
        if (prep) prep.style.display = 'none';
        showCurrentWord();
        openCustomWordPackDepletedOverlay();
        showNotification('Слова в пакете закончились — загрузите новый файл');
        if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
        return;
    }

    gameState = {
        isPlaying: true,
        isPaused: false,
        awaitingCustomWordPack: false,
        timerNeverStarted: false,
        currentWordIndex: 0,
        correctAnswers: 0,
        skippedWords: 0,
        totalWords: 0,
        timeLimit: gameTime,
        timeRemaining: gameTime,
        words: words,
        category: category,
        startTime: Date.now(),
        timerInterval: null,
        score: 0,
        correctWords: [],
        skippedWordsList: [],
        maxSkipsAllowed,
        skipsRemaining
    };
    
    updateGameUI();
    showScreen('game-screen');
    if (competitiveState.isCompetitiveMode) {
        // перед стартом даем 3 секунды подготовки
        startCompetitivePreparation();
    } else {
        const ftTurn = flexibleTournamentState.isFlexibleMode ? getFlexibleCurrentTurn() : null;
        const prepLabel = ftTurn ? `${ftTurn.team.name} — ${ftTurn.playerName}` : null;
        // Универсальная подготовка перед началом раунда во всех режимах
        startRoundPreparation(3, prepLabel, () => {
            startTimer();
            showCurrentWord();
        });
    }
}

// Получение слов из выбранного источника
function getWordsForCurrentSource(category, count) {
    if (settings.wordSource === 'custom' && CUSTOM_WORDS) {
        const words = CUSTOM_WORDS;
        if (!words.length) return [];

        // Берем только неиспользованные слова
        const remaining = words.filter(w => !CUSTOM_WORDS_USED.has(w));
        if (remaining.length === 0) {
            return [];
        }
        const shuffled = [...remaining].sort(() => 0.5 - Math.random());
        const taken = shuffled.slice(0, Math.min(count, remaining.length));
        // НЕ помечаем как использованные здесь - это будет сделано после игры
        return taken;
    } else {
        // Для встроенных слов просто получаем случайные слова
        // Они будут возвращаться в игру, так как мы не отслеживаем использованные
        return window.getWordsForGame(category, count);
    }
}

// Запуск таймера
function startTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    gameState.timerInterval = setInterval(() => {
        if (!gameState.isPaused) {
            gameState.timeRemaining--;
            updateTimer();
            if (gameState.timeRemaining <= 0) { endGame(); }
        }
    }, 1000);
}

// Универсальная подготовка к раунду (обратный отсчет перед стартом)
function startRoundPreparation(seconds, playerName, onComplete) {
    const prep = document.getElementById('competitive-prep');
    const nameEl = document.getElementById('prep-player-name');
    const countdownEl = document.getElementById('prep-countdown');
    if (nameEl) nameEl.textContent = playerName ? String(playerName) : '';
    let left = Math.max(0, parseInt(seconds, 10) || 0);
    if (countdownEl) countdownEl.textContent = String(left);
    if (prep) prep.style.display = '';
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
    if (competitiveState && competitiveState.prepTimer) {
        clearInterval(competitiveState.prepTimer);
    }
    if (left === 0) {
        if (prep) prep.style.display = 'none';
        if (typeof onComplete === 'function') onComplete();
        if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
        return;
    }
    competitiveState.prepTimer = setInterval(() => {
        left--;
        if (countdownEl) countdownEl.textContent = String(Math.max(left, 0));
        if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
        if (left <= 0) {
            clearInterval(competitiveState.prepTimer);
            competitiveState.prepTimer = null;
            if (prep) prep.style.display = 'none';
            if (typeof onComplete === 'function') onComplete();
        }
    }, 1000);
}

// Обновление таймера
function updateTimer() {
    const timerElement = document.getElementById('timer');
    const progressElement = document.getElementById('progress-fill');
    timerElement.textContent = gameState.timeRemaining;
    const progress = (gameState.timeRemaining / gameState.timeLimit) * 100;
    progressElement.style.width = progress + '%';
    if (gameState.timeRemaining <= 10) {
        timerElement.style.color = '#f44336';
        progressElement.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
    } else {
        timerElement.style.color = '';
        progressElement.style.background = '';
    }
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

// Показ текущего слова
function showCurrentWord() {
    const wordElement = document.getElementById('current-word');
    if (gameState.currentWordIndex < gameState.words.length) {
        const current = gameState.words[gameState.currentWordIndex];
        if (wordElement) wordElement.textContent = current;
        const wn = document.getElementById('current-word-number');
        if (wn) wn.textContent = gameState.currentWordIndex + 1;
        // Немедленно помечаем слово как использованное (для пользовательских пакетов)
        markWordAsUsedImmediate(current);
    } else {
        if (wordElement) {
            wordElement.textContent = gameState.awaitingCustomWordPack ? '—' : '';
        }
    }
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

// Правильный ответ
function correctAnswer() {
    if (!gameState.isPlaying || gameState.isPaused) return;
    gameState.correctAnswers++;
    gameState.score += calculateWordScore();
    // Добавляем текущее слово в список отгаданных
    if (gameState.currentWordIndex < gameState.words.length) {
        gameState.correctWords.push(gameState.words[gameState.currentWordIndex]);
    }
    nextWord();
}

// Пропуск слова
function skipWord() {
    if (!gameState.isPlaying || gameState.isPaused) return;
    if (gameState.maxSkipsAllowed > 0 && (gameState.skipsRemaining == null || gameState.skipsRemaining <= 0)) {
        showNotification('Лимит пропусков исчерпан');
        return;
    }
    gameState.skippedWords++;
    if (gameState.maxSkipsAllowed > 0 && gameState.skipsRemaining > 0) {
        gameState.skipsRemaining--;
    }
    // Добавляем текущее слово в список пропущенных
    if (gameState.currentWordIndex < gameState.words.length) {
        gameState.skippedWordsList.push(gameState.words[gameState.currentWordIndex]);
    }
    nextWord();
}

// Переход к следующему слову
function nextWord() {
    gameState.currentWordIndex++;
    if (gameState.currentWordIndex >= gameState.words.length) {
        const WORDS_BATCH_SIZE = 50;
        const more = getWordsForCurrentSource(gameState.category, WORDS_BATCH_SIZE) || [];
        if (!more.length) {
            if (settings.wordSource === 'custom' && CUSTOM_WORDS) {
                pauseForCustomWordPack();
                return;
            }
            endGame();
            return;
        }
        gameState.words.push(...more);
    }
    showCurrentWord();
    updateGameUI();
}

// Подсчет очков за слово
function calculateWordScore() {
    return 1; // Фиксированный счет за слово
}

// Пауза/возобновление/завершение
function pauseGame() {
    if (!gameState.isPlaying) return;
    if (gameState.awaitingCustomWordPack) {
        showNotification('Сначала загрузите новый пакет слов в окне на экране игры');
        return;
    }
    gameState.isPaused = true;
    document.getElementById('pause-time').textContent = gameState.timeRemaining + ' сек';
    document.getElementById('pause-score').textContent = gameState.score;
    document.getElementById('pause-words').textContent = gameState.currentWordIndex;
    showScreen('pause-screen');
}

function resumeGame() {
    if (gameState.awaitingCustomWordPack) {
        showNotification('Сначала загрузите файл со словами');
        return;
    }
    gameState.isPaused = false;
    showScreen('game-screen');
    updateHostPlayingScoreboard();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function endGame() {
    closeCustomWordPackDepletedOverlay();
    if (gameState) gameState.awaitingCustomWordPack = false;
    // Сбрасываем состояние игры независимо от текущего состояния
    gameState.isPlaying = false;
    gameState.isPaused = false; // Убираем паузу если она была
    
    // Останавливаем таймеры
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    if (competitiveState && competitiveState.prepTimer) {
        clearInterval(competitiveState.prepTimer);
        competitiveState.prepTimer = null;
    }
    
    // Помечаем слова как использованные (только для пользовательских пакетов)
    if (settings.wordSource === 'custom' && CUSTOM_WORDS) {
        markWordsAsUsed();
    }
    
    const finalScore = Math.round(gameState.score);
    document.getElementById('final-score').textContent = finalScore;
    document.getElementById('correct-answers').textContent = gameState.correctAnswers;
    document.getElementById('skipped-words').textContent = gameState.skippedWords;
    const gameDuration = Math.round((Date.now() - gameState.startTime) / 1000);
    document.getElementById('game-time-result').textContent = gameDuration + ' секунд';
    document.getElementById('game-category-result').textContent = builtinCategoryName(gameState.category);
    
    // Отображаем списки отгаданных и пропущенных слов
    displayWordsLists();
    
    saveGameResults(finalScore, gameState.correctAnswers, gameState.skippedWords, gameDuration);
    
    // Проверяем, находимся ли мы в турнирном режиме
    if (tournamentState.isTournamentMode) {
        endPlayerGame();
    } else if (flexibleTournamentState.isFlexibleMode) {
        endFlexiblePlayerTurn();
    } else if (competitiveState.isCompetitiveMode) {
        endCompetitivePlayerTurn();
    } else {
        showScreen('results');
    }
}

// Функция для принудительного завершения игры в турнирном режиме
function endTournamentGame() {
    if (!gameState.isPlaying) return;
    // В турнирном режиме учет очков и переходы выполняются в endPlayerGame()
    endGame();
}

// Сохранение результатов игры
function saveGameResults(score, correct, skipped, duration) {
    const gameResult = {
        date: new Date().toISOString(),
        score: score,
        correctAnswers: correct,
        skippedWords: skipped,
        totalWords: gameState.currentWordIndex,
        timeLimit: gameState.timeLimit,
        actualTime: duration,
        category: gameState.category,

        source: settings.wordSource
    };
    const gameHistory = JSON.parse(localStorage.getItem('alias-history') || '[]');
    gameHistory.unshift(gameResult);
    if (gameHistory.length > 10) { gameHistory.pop(); }
    localStorage.setItem('alias-history', JSON.stringify(gameHistory));
}

// Турнирные функции
function startTournament() {
    flexibleTournamentState.isFlexibleMode = false;
    tournamentState.isTournamentMode = true;
    tournamentState.currentRound = 0;
    tournamentState.currentMatch = 0;
    tournamentState.currentTeamIndex = 0;
    tournamentState.currentPlayerIndex = 0;
    tournamentState.matchScores = [];
    tournamentState.tournamentScores = new Array(tournamentState.teams.length).fill(0);
    // Фиксируем выбранный режим (sequential | alternating) из UI
    const selectedMode = document.querySelector('input[name="game-mode"]:checked');
    tournamentState.gameMode = selectedMode ? selectedMode.value : 'sequential';
    
    // Создаем турнирную сетку
    generateTournamentBracket();
    
    // Определяем максимальное количество раундов
    const minPlayers = Math.min(...tournamentState.teams.map(team => team.players.length));
    tournamentState.maxRounds = minPlayers;
    
    startTournamentMatch();
}

function generateTournamentBracket() {
    tournamentState.matches = [];
    const numTeams = tournamentState.teams.length;
    if (numTeams < 2) return;

    // Функции помощи: создаём раунды на основе индексов исходных матчей
    const firstRound = [];
    for (let i = 0; i < numTeams; i += 2) {
        if (i + 1 < numTeams) {
            firstRound.push({ round: 1, team1: i, team2: i + 1, winner: null });
        }
    }
    tournamentState.matches.push(...firstRound);

    // Строим последующие раунды, ссылаясь на победителей предыдущих матчей
    let previousRoundStart = 0;
    let previousRoundCount = firstRound.length;
    let round = 2;
    while (previousRoundCount > 1) {
        const currentRound = [];
        for (let i = 0; i < previousRoundCount; i += 2) {
            const m1Index = previousRoundStart + i;
            const m2Index = previousRoundStart + i + 1;
            if (i + 1 < previousRoundCount) {
                currentRound.push({
                    round: round,
                    team1: { from: m1Index },
                    team2: { from: m2Index },
                    winner: null
                });
            }
        }
        tournamentState.matches.push(...currentRound);
        previousRoundStart += previousRoundCount;
        previousRoundCount = currentRound.length;
        round++;
    }
}

// Разрешение ссылки на команду (число индекса или {from: matchIndex})
function resolveTeamEntry(entry) {
    if (entry == null) return { teamId: null, team: null };
    if (typeof entry === 'number') {
        const teamId = entry;
        return { teamId, team: tournamentState.teams[teamId] };
    }
    if (entry && typeof entry === 'object' && typeof entry.from === 'number') {
        const prev = tournamentState.matches[entry.from];
        const teamId = prev && typeof prev.winner === 'number' ? prev.winner : null;
        return { teamId, team: teamId != null ? tournamentState.teams[teamId] : null };
    }
    return { teamId: null, team: null };
}

function getResolvedTeamIds(currentMatch) {
    const r1 = resolveTeamEntry(currentMatch.team1);
    const r2 = resolveTeamEntry(currentMatch.team2);
    return { team1Id: r1.teamId, team2Id: r2.teamId };
}

function addTeam(name, players) {
    if (tournamentState.teams.length >= 8) {
        showNotification('Максимум 8 команд!');
        return false;
    }
    
    if (!name.trim()) {
        showNotification('Введите название команды!');
        return false;
    }
    
    if (players.length === 0) {
        showNotification('Добавьте хотя бы одного игрока!');
        return false;
    }
    
    tournamentState.teams.push({
        name: name.trim(),
        players: players,
        score: 0
    });
    
    updateTeamsList();
    return true;
}

function removeTeam(index) {
    tournamentState.teams.splice(index, 1);
    updateTeamsList();
}

function updateTeamsList() {
    const teamsList = document.getElementById('teams-list');
    if (!teamsList) return;
    
    teamsList.innerHTML = '';
    tournamentState.teams.forEach((team, index) => {
        const teamElement = document.createElement('div');
        teamElement.className = 'team-item';
        teamElement.innerHTML = `
            <div class="team-info">
                <h4>${team.name}</h4>
                <p>Игроки: ${team.players.join(', ')}</p>
            </div>
            <button class="btn btn-danger btn-small" onclick="removeTeam(${index})">Удалить</button>
        `;
        teamsList.appendChild(teamElement);
    });
}

function startTournamentMatch() {
    if (tournamentState.currentMatch >= tournamentState.matches.length) {
        endTournament();
        return;
    }
    
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : null;
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : null;
    
    // Сбрасываем счет матча
    tournamentState.matchScores = [0, 0];
    tournamentState.currentTeamIndex = 0;
    tournamentState.currentPlayerIndex = 0;
    tournamentState.currentMatchPlayerResults = [];
    tournamentState.isOvertime = false;
    tournamentState.overtimePlayers = [];
    
    // Показываем информацию о матче
    const gameModeText = tournamentState.gameMode === 'sequential' ? 
        'Последовательный режим' : 'Чередующийся режим';
    
    document.getElementById('match-info').innerHTML = `
        <h3>Матч ${tournamentState.currentMatch + 1}</h3>
        <p><strong>Режим:</strong> ${gameModeText}</p>
        <div class="match-teams">
            <div class="team-vs">
                <span class="team-name">${team1 ? team1.name : 'Победитель предыдущего матча'}</span>
                <span class="vs">VS</span>
                <span class="team-name">${team2 ? team2.name : 'Победитель предыдущего матча'}</span>
            </div>
        </div>
        <p><strong>Игроков:</strong> ${team1 ? team1.players.length : '?'} vs ${team2 ? team2.players.length : '?'}</p>
        <div class="match-score">
            <span class="team-score">${team1 ? team1.name : 'TBD'}: <span id="team1-score">0</span></span>
            <span class="score-separator">-</span>
            <span class="team-score">${team2 ? team2.name : 'TBD'}: <span id="team2-score">0</span></span>
        </div>
    `;
    
    showScreen('tournament-match');
    // Обновляем информацию о первом игроке (после смены экрана — для синхронизации с экраном зала)
    updateCurrentPlayerInfo();
}

function updateCurrentPlayerInfo() {
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : null;
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : null;
    
    let currentTeam, currentPlayer;
    
    if (tournamentState.isOvertime) {
        // Дополнительный раунд - играют только выбранные игроки
        const overtimePlayer = tournamentState.overtimePlayers[tournamentState.currentPlayerIndex];
        if (overtimePlayer) {
            currentTeam = overtimePlayer.teamIndex === 0 ? team1 : team2;
            currentPlayer = overtimePlayer.playerName;
            
            document.getElementById('current-player-info').innerHTML = `
                <h3>${currentTeam ? currentTeam.name : 'Команда TBD'} - Дополнительный раунд</h3>
                <p>Игрок: ${currentPlayer}</p>
                <p>Раунд: ${tournamentState.currentPlayerIndex + 1}/2</p>
                <p>Прогресс: Дополнительный раунд</p>
            `;
        }
    } else if (tournamentState.gameMode === 'sequential') {
        // Режим 1: Играют поочередно все игроки команды
        currentTeam = tournamentState.currentTeamIndex === 0 ? team1 : team2;
        currentPlayer = currentTeam && currentTeam.players ? currentTeam.players[tournamentState.currentPlayerIndex] : '';
        
        // Показываем информацию о текущем игроке
        document.getElementById('current-player-info').innerHTML = `
            <h3>${currentTeam ? currentTeam.name : 'Команда TBD'}</h3>
            <p>Игрок: ${currentPlayer}</p>
            <p>Раунд: ${tournamentState.currentPlayerIndex + 1}/${currentTeam ? currentTeam.players.length : '?'}</p>
            <p>Прогресс: ${tournamentState.currentTeamIndex === 0 ? 'Команда 1' : 'Команда 2'}</p>
        `;
        
    } else {
        // Режим 2: Играют игроки команд через одного
        const minPlayers = (team1 && team2) ? Math.min(team1.players.length, team2.players.length) : 0;
        const totalTurns = minPlayers * 2;
        const playerIndex = tournamentState.currentPlayerIndex;
        const teamIndex = playerIndex % 2; // 0 — команда 1, 1 — команда 2
        const playerIndexInTeam = Math.floor(playerIndex / 2);
        
        currentTeam = teamIndex === 0 ? team1 : team2;
        currentPlayer = (currentTeam && currentTeam.players) ? (currentTeam.players[playerIndexInTeam] || `Игрок ${playerIndexInTeam + 1}`) : '';
        
        // Вычисляем номер раунда: идет по парам игроков (1..minPlayers)
        const roundNumber = playerIndexInTeam + 1;
        const maxRounds = minPlayers;
        
        document.getElementById('current-player-info').innerHTML = `
            <h3>${currentTeam ? currentTeam.name : 'Команда TBD'}</h3>
            <p>Игрок: ${currentPlayer}</p>
            <p>Раунд: ${roundNumber}/${maxRounds}</p>
            <p>Прогресс: ${Math.min(playerIndex + 1, totalTurns)}/${totalTurns}</p>
            <p>Порядок: ${teamIndex === 0 ? 'Команда 1' : 'Команда 2'}</p>
        `;
    }
    
    // Обновляем счет команд
    updateMatchScore();
    updateHostPlayingScoreboard();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

// Обновление счета матча
function updateMatchScore() {
    const team1ScoreElement = document.getElementById('team1-score');
    const team2ScoreElement = document.getElementById('team2-score');
    
    if (team1ScoreElement && team2ScoreElement) {
        team1ScoreElement.textContent = tournamentState.matchScores[0];
        team2ScoreElement.textContent = tournamentState.matchScores[1];
    }
    updateHostPlayingScoreboard();
}

// Начало дополнительного раунда при ничьей
function startOvertime() {
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : null;
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : null;
    
    if (!team1 || !team2) {
        showNotification('Ошибка: команды не определены для дополнительного раунда');
        return;
    }
    
    // Выбираем случайных игроков из каждой команды
    const team1PlayerIndex = Math.floor(Math.random() * team1.players.length);
    const team2PlayerIndex = Math.floor(Math.random() * team2.players.length);
    
    tournamentState.isOvertime = true;
    tournamentState.overtimePlayers = [
        { teamIndex: 0, teamId: team1Id, playerIndex: team1PlayerIndex, playerName: team1.players[team1PlayerIndex] },
        { teamIndex: 1, teamId: team2Id, playerIndex: team2PlayerIndex, playerName: team2.players[team2PlayerIndex] }
    ];
    
    // Сбрасываем счет для дополнительного раунда
    tournamentState.matchScores = [0, 0];
    tournamentState.currentPlayerIndex = 0;
    tournamentState.currentMatchPlayerResults = [];
    
    // Обновляем информацию о матче
    const gameModeText = tournamentState.gameMode === 'sequential' ? 
        'Последовательный режим' : 'Чередующийся режим';
    
    document.getElementById('match-info').innerHTML = `
        <h3>Матч ${tournamentState.currentMatch + 1} - Дополнительный раунд</h3>
        <p><strong>Режим:</strong> ${gameModeText}</p>
        <div class="match-teams">
            <div class="team-vs">
                <span class="team-name">${team1.name}</span>
                <span class="vs">VS</span>
                <span class="team-name">${team2.name}</span>
            </div>
        </div>
        <p><strong>Дополнительный раунд:</strong> ${team1.players[team1PlayerIndex]} vs ${team2.players[team2PlayerIndex]}</p>
        <div class="match-score">
            <span class="team-score">${team1.name}: <span id="team1-score">0</span></span>
            <span class="score-separator">-</span>
            <span class="team-score">${team2.name}: <span id="team2-score">0</span></span>
        </div>
    `;
    
    showScreen('tournament-match');
    updateCurrentPlayerInfo();
}

function startNextPlayer() {
    // Обновляем информацию о текущем игроке
    updateCurrentPlayerInfo();
    
    // Начинаем игру для текущего игрока
    startGame();
}

function endPlayerGame() {
    // Сохраняем результат игрока
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : null;
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : null;
    
    if (!team1 || !team2) {
        showNotification('Матч ещё не готов: не определены обе команды');
        return;
    }
    
    // Определяем, какой команде принадлежит текущий игрок
    let teamIndex;
    let playerIndexInTeam;
    
    if (tournamentState.isOvertime) {
        // Дополнительный раунд - используем информацию из overtimePlayers
        const overtimePlayer = tournamentState.overtimePlayers[tournamentState.currentPlayerIndex];
        teamIndex = overtimePlayer.teamIndex;
        playerIndexInTeam = overtimePlayer.playerIndex;
    } else if (tournamentState.gameMode === 'sequential') {
        teamIndex = tournamentState.currentTeamIndex;
        // индекс игрока внутри своей команды
        playerIndexInTeam = tournamentState.currentPlayerIndex;
    } else {
        // Чередующийся режим: команда по четности хода, игрок в команде — по номеру пары
        teamIndex = tournamentState.currentPlayerIndex % 2; // 0 — команда 1, 1 — команда 2
        playerIndexInTeam = Math.floor(tournamentState.currentPlayerIndex / 2);
    }
    
    tournamentState.matchScores[teamIndex] += gameState.score;

    // Сохраняем подробности по словам текущего игрока
    try {
        const teamId = teamIndex === 0 ? team1Id : team2Id;
        const team = teamIndex === 0 ? team1 : team2;
        const playerName = team && team.players[playerIndexInTeam] ? team.players[playerIndexInTeam] : `Игрок ${playerIndexInTeam + 1}`;
        tournamentState.currentMatchPlayerResults.push({
            teamIndex,
            teamName: team ? team.name : `Команда ${teamIndex + 1}`,
            playerIndex: playerIndexInTeam,
            playerName,
            score: Math.round(gameState.score),
            correctWords: Array.isArray(gameState.correctWords) ? [...gameState.correctWords] : [],
            skippedWords: Array.isArray(gameState.skippedWordsList) ? [...gameState.skippedWordsList] : []
        });
    } catch (_) {}
    
    // Переходим к следующему игроку
    if (tournamentState.isOvertime) {
        // Дополнительный раунд - только 2 игрока
        tournamentState.currentPlayerIndex++;
        if (tournamentState.currentPlayerIndex >= 2) {
            // Дополнительный раунд завершен
            endMatch();
            return;
        }
    } else if (tournamentState.gameMode === 'sequential') {
        // Режим 1: Сначала все игроки одной команды, затем другой
        if (tournamentState.currentTeamIndex === 0) {
            if (tournamentState.currentPlayerIndex < team1.players.length - 1) {
                tournamentState.currentPlayerIndex++;
            } else {
                // Переходим к команде 2, начинаем с первого игрока
                tournamentState.currentTeamIndex = 1;
                tournamentState.currentPlayerIndex = 0;
            }
        } else {
            // Команда 2
            if (tournamentState.currentPlayerIndex < team2.players.length - 1) {
                tournamentState.currentPlayerIndex++;
            } else {
                // Все игроки команды 2 сыграли — матч завершен
                endMatch();
                return;
            }
        }
    } else {
        // Режим 2: Игроки команд через одного
        const minPlayers = Math.min(team1.players.length, team2.players.length);
        const totalTurns = minPlayers * 2;

        tournamentState.currentPlayerIndex++;

        if (tournamentState.currentPlayerIndex >= totalTurns) {
            // Матч завершен
            endMatch();
            return;
    	}
    }
    
    // Проверяем, завершен ли матч
    if (isMatchComplete()) {
        endMatch();
        return;
    }
    
    // Показываем следующий игрок
    showScreen('tournament-match');
    updateCurrentPlayerInfo();
}

function isMatchComplete() {
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : null;
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : null;
    
    if (!team1 || !team2) return false;
    
    if (tournamentState.gameMode === 'sequential') {
        // В последовательном режиме считаем завершение так:
        // - Команда 1 завершена, если мы уже перешли к команде 2
        // - Команда 2 завершена, только когда текущий индекс игрока дошел до последнего игрока команды 2
        const team1Completed = tournamentState.currentTeamIndex > 0;
        const team2Completed = tournamentState.currentTeamIndex === 1 && 
            tournamentState.currentPlayerIndex > team2.players.length - 1;
        return team1Completed && team2Completed;
    } else {
        // В чередующемся режиме: ограничиваемся минимумом игроков в командах
        const minPlayers = Math.min(team1.players.length, team2.players.length);
        const totalTurns = minPlayers * 2;
        return tournamentState.currentPlayerIndex >= totalTurns;
    }
}

function endMatch() {
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const team1Score = tournamentState.matchScores[0];
    const team2Score = tournamentState.matchScores[1];
    
    // Проверяем на ничью
    if (team1Score === team2Score && !tournamentState.isOvertime) {
        // Начинаем дополнительный раунд
        startOvertime();
        return;
    }
    
    // Определяем победителя
    if (team1Score > team2Score) {
        // winner — это индекс команды из общего списка
        const { team1Id } = getResolvedTeamIds(currentMatch);
        currentMatch.winner = team1Id;
    } else if (team2Score > team1Score) {
        const { team2Id } = getResolvedTeamIds(currentMatch);
        currentMatch.winner = team2Id;
    } else {
        // Ничья после дополнительного раунда - случайный победитель
        const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
        currentMatch.winner = Math.random() < 0.5 ? team1Id : team2Id;
    }
    
    // Показываем результаты матча
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : { name: 'TBD', players: [] };
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : { name: 'TBD', players: [] };
    const winner = (typeof currentMatch.winner === 'number') ? tournamentState.teams[currentMatch.winner] : { name: 'TBD' };
    
    document.getElementById('match-result').innerHTML = `
        <h3>Результаты матча</h3>
        <div class="match-result">
            <div class="team-result">
                <span class="team-name">${team1.name}</span>
                <span class="team-score">${team1Score}</span>
            </div>
            <div class="team-result">
                <span class="team-name">${team2.name}</span>
                <span class="team-score">${team2Score}</span>
            </div>
        </div>
        <div class="winner">
            <h4>Победитель: ${winner.name}</h4>
        </div>
    `;

    // Анонс следующего матча, если он есть
    const nextEl = document.getElementById('next-match-announcement');
    if (nextEl) {
        const nextIndex = tournamentState.currentMatch + 1;
        if (nextIndex < tournamentState.matches.length) {
            const next = tournamentState.matches[nextIndex];
            const { team1Id: nId1, team2Id: nId2 } = getResolvedTeamIds(next);
            const nTeam1 = nId1 != null ? tournamentState.teams[nId1] : null;
            const nTeam2 = nId2 != null ? tournamentState.teams[nId2] : null;
            nextEl.innerHTML = `
                <div class="next-match">
                    <h4>Следующий матч</h4>
                    <div class="team-vs">
                        <span class="team-name">${nTeam1 ? nTeam1.name : 'TBD'}</span>
                        <span class="vs">VS</span>
                        <span class="team-name">${nTeam2 ? nTeam2.name : 'TBD'}</span>
                    </div>
                </div>
            `;
        } else {
            nextEl.innerHTML = '';
        }
    }

    // Спойлер с деталями по каждому игроку
    const breakdownContainer = document.getElementById('player-words-breakdown');
    if (breakdownContainer) {
        const grouped = [[], []];
        (tournamentState.currentMatchPlayerResults || []).forEach(r => {
            if (r && (r.teamIndex === 0 || r.teamIndex === 1)) grouped[r.teamIndex].push(r);
        });
        const renderPlayerBlock = (r) => `
            <div class="player-block">
                <div class="player-header">${r.playerName} — очки: ${r.score} (верно: ${r.correctWords.length}, пропусков: ${r.skippedWords.length})</div>
                <details>
                    <summary>Слова игрока</summary>
                    <div class="player-words">
                        <div class="words-sub">
                            <div class="words-sub-title">Отгаданные (${r.correctWords.length})</div>
                            <div class="words-container">${r.correctWords.map(w => `<span class=\"word-item correct\">${w}</span>`).join('')}</div>
                        </div>
                        <div class="words-sub">
                            <div class="words-sub-title">Пропущенные (${r.skippedWords.length})</div>
                            <div class="words-container">${r.skippedWords.map(w => `<span class=\"word-item skipped\">${w}</span>`).join('')}</div>
                        </div>
                    </div>
                </details>
            </div>`;

        const html = `
            <details>
                <summary>Показать подробности по игрокам</summary>
                <div class="teams-breakdown">
                    <div class="team-breakdown">
                        <h4>${team1.name}</h4>
                        ${grouped[0].map(renderPlayerBlock).join('') || '<div class="no-words">Нет данных</div>'}
                    </div>
                    <div class="team-breakdown">
                        <h4>${team2.name}</h4>
                        ${grouped[1].map(renderPlayerBlock).join('') || '<div class="no-words">Нет данных</div>'}
                    </div>
                </div>
            </details>
        `;
        breakdownContainer.innerHTML = html;
    }
    
    showScreen('match-results');
}

// Экспорт результатов матча в .txt
function exportMatchResults() {
    try {
        const currentMatch = tournamentState.matches[tournamentState.currentMatch] || {};
        const team1 = tournamentState.teams[currentMatch.team1] || { name: 'Команда 1' };
        const team2 = tournamentState.teams[currentMatch.team2] || { name: 'Команда 2' };
        const team1Score = tournamentState.matchScores[0] ?? 0;
        const team2Score = tournamentState.matchScores[1] ?? 0;

        const lines = [];
        lines.push('Результаты матча');
        lines.push(`Команды: ${team1.name} vs ${team2.name}`);
        lines.push(`Счет: ${team1.name} ${team1Score} — ${team2Score} ${team2.name}`);
        lines.push('');

        const grouped = [[], []];
        (tournamentState.currentMatchPlayerResults || []).forEach(r => {
            if (r && (r.teamIndex === 0 || r.teamIndex === 1)) grouped[r.teamIndex].push(r);
        });

        const renderTeam = (team, results) => {
            lines.push(`Команда: ${team.name}`);
            if (!results.length) {
                lines.push('  Нет данных по игрокам');
                lines.push('');
                return;
            }
            results.forEach((r, idx) => {
                lines.push(`  Игрок ${idx + 1}: ${r.playerName}`);
                lines.push(`    Очки: ${r.score} (верных: ${r.correctWords.length}, пропущенных: ${r.skippedWords.length})`);
                if (r.correctWords.length) {
                    lines.push('    Отгаданные:');
                    lines.push('      ' + r.correctWords.join(', '));
                }
                if (r.skippedWords.length) {
                    lines.push('    Пропущенные:');
                    lines.push('      ' + r.skippedWords.join(', '));
                }
                lines.push('');
            });
        };

        renderTeam(team1, grouped[0]);
        renderTeam(team2, grouped[1]);

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
        a.href = url;
        a.download = `alias-match-${ts}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        showNotification('Не удалось экспортировать результаты');
    }
}

function continueTournament() {
    tournamentState.currentMatch++;
    tournamentState.currentRound = 0;
    tournamentState.currentPlayerIndex = 0;
    tournamentState.currentTeamIndex = 0;
    
    if (tournamentState.currentMatch >= tournamentState.matches.length) {
        endTournament();
    } else {
        startTournamentMatch();
    }
}

function endTournament() {
    // Определяем финального победителя
    const finalWinner = tournamentState.matches[tournamentState.matches.length - 1].winner;
    const winnerTeam = tournamentState.teams[finalWinner];
    
    document.getElementById('tournament-winner').innerHTML = `
        <h2>🏆 Победитель турнира</h2>
        <div class="winner-team">
            <h3>${winnerTeam.name}</h3>
            <p>Игроки: ${winnerTeam.players.join(', ')}</p>
        </div>
    `;
    
    showScreen('tournament-results');
}

// Функции для работы с формой добавления команд
function addTeamFromForm() {
    const name = document.getElementById('team-name').value;
    const playersText = document.getElementById('team-players').value;
    
    if (!name.trim()) {
        showNotification('Введите название команды!');
        return;
    }
    
    if (!playersText.trim()) {
        showNotification('Введите игроков команды!');
        return;
    }
    
    const players = playersText.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    if (players.length === 0) {
        showNotification('Добавьте хотя бы одного игрока!');
        return;
    }
    
    if (addTeam(name, players)) {
        // Очищаем форму
        document.getElementById('team-name').value = '';
        document.getElementById('team-players').value = '';
        
        // Обновляем состояние кнопки "Начать турнир"
        updateStartTournamentButton();
    }
}

function updateStartTournamentButton() {
    const startBtn = document.getElementById('start-tournament-btn');
    if (startBtn) {
        startBtn.disabled = tournamentState.teams.length < 2;
    }
}

function showTournamentSetup() {
    // Сбрасываем состояние турнира
    flexibleTournamentState.isFlexibleMode = false;
    tournamentState.teams = [];
    tournamentState.isTournamentMode = false;
    
    // Обновляем UI
    updateTeamsList();
    updateStartTournamentButton();
    
    showScreen('tournament-setup');
}

// Загрузка информации о последней игре
function loadLastGameInfo() { /* удалено отображение последней игры */ }

// Баннер на главной: показываем информацию о пакете или настройках
function updateMainInfoBanner() {
    const el = document.getElementById('pack-info');
    const text = document.getElementById('pack-info-text');
    if (!el || !text) return;
    const isCustom = settings.wordSource === 'custom';
    if (isCustom) {
        if (!CUSTOM_WORDS || !Array.isArray(CUSTOM_WORDS) || CUSTOM_WORDS.length === 0) {
            text.textContent = `Режим: Пользовательский. Слова не загружены.`;
        } else {
            const fileName = CUSTOM_WORDS_META.fileName || 'custom.txt';
            const total = CUSTOM_WORDS_META.total || CUSTOM_WORDS.length;
            const used = CUSTOM_WORDS_USED.size;
            const remaining = Math.max(total - used, 0);
            text.textContent = `Режим: Пользовательский. Пакет: ${fileName}. Осталось слов: ${remaining} из ${total}.`;
        }
    } else {
        text.textContent = `Режим: Стандартный.`;
    }
    el.style.display = 'block';
}

// Новый раунд
function newGame() { startGame(); }

// Обновление игрового UI
function updateGameUI() {
    const scoreEl = document.getElementById('current-score');
    if (scoreEl) scoreEl.textContent = Math.round(gameState.score);
    const skipBtn = document.getElementById('skip-btn');
    const skipLimWrap = document.getElementById('host-skip-limit-wrap');
    const skipLimVal = document.getElementById('host-skip-limit-val');
    const lim = gameState.maxSkipsAllowed > 0 ? gameState.maxSkipsAllowed : 0;
    const rem = gameState.skipsRemaining != null ? gameState.skipsRemaining : 0;
    const activeScreen = document.querySelector('.screen.active');
    const sid = activeScreen ? activeScreen.id : '';
    const flexRound =
        flexibleTournamentState.isFlexibleMode &&
        flexibleTournamentState.roundTeamIndices &&
        flexibleTournamentState.roundTeamIndices.length > 0;
    const wordStatWrap = document.getElementById('host-word-stat-wrap');
    if (wordStatWrap) {
        wordStatWrap.style.display = flexRound && sid === 'game-screen' ? 'none' : '';
    }
    if (skipLimWrap && skipLimVal) {
        if (lim > 0) {
            skipLimWrap.style.display = '';
            if (flexRound && sid === 'game-screen') {
                const used = Math.max(0, lim - rem);
                skipLimVal.textContent = `${used}/${lim}`;
            } else {
                skipLimVal.textContent = String(rem);
            }
        } else {
            skipLimWrap.style.display = 'none';
        }
    }
    if (skipLimWrap) {
        skipLimWrap.classList.toggle('host-skip-depleted', lim > 0 && rem <= 0);
    }
    const gameStats = document.getElementById('host-game-stats');
    if (gameStats) {
        gameStats.classList.toggle('host-game-stats--prominent', !!(flexRound && sid === 'game-screen'));
    }
    if (skipBtn) {
        if (lim > 0 && rem <= 0 && gameState.isPlaying && !gameState.isPaused) {
            skipBtn.disabled = true;
        } else {
            skipBtn.disabled = false;
        }
    }
    updateHostPlayingScoreboard();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function getTournamentScorebarPlayingSlot() {
    if (!tournamentState.isTournamentMode) return null;
    if (tournamentState.isOvertime) {
        const op = tournamentState.overtimePlayers[tournamentState.currentPlayerIndex];
        return op ? op.teamIndex : 0;
    }
    if (tournamentState.gameMode === 'sequential') return tournamentState.currentTeamIndex;
    return tournamentState.currentPlayerIndex % 2;
}

function updateHostPlayingScoreboard() {
    const bar = document.getElementById('host-playing-scoreboard');
    const inner = document.getElementById('host-playing-scoreboard-inner');
    if (!bar || !inner) return;
    const active = document.querySelector('.screen.active');
    const sid = active ? active.id : '';
    if (sid !== 'game-screen') {
        bar.classList.add('hidden');
        bar.classList.remove('host-ft-playing-board');
        inner.className = 'host-playing-scoreboard-inner';
        return;
    }
    const live = gameState.isPlaying && !gameState.isPaused;
    const prep = document.getElementById('competitive-prep');
    const prepOn = !!(prep && prep.style.display !== 'none');

    if (flexibleTournamentState.isFlexibleMode && flexibleTournamentState.roundTeamIndices && flexibleTournamentState.roundTeamIndices.length) {
        bar.classList.remove('hidden');
        bar.classList.add('host-ft-playing-board');
        const turn = typeof getFlexibleCurrentTurn === 'function' ? getFlexibleCurrentTurn() : null;
        const idxs = flexibleTournamentState.roundTeamIndices;
        const scores = flexibleTournamentState.roundScores || [];
        const parts = idxs.map((ti, i) => {
            const t = flexibleTournamentState.teams[ti];
            let sc = scores[i] != null ? scores[i] : 0;
            if (live && turn && turn.slot === i) sc += Math.round(gameState.score);
            const nm = t ? t.name : '—';
            const activeCard = live && turn && turn.slot === i ? ' host-ft-card--active' : '';
            return `<div class="host-ft-score-card${activeCard}"><span class="host-ft-card-name">${escapeHtmlFlexible(nm)}</span><strong class="host-ft-card-num">${Math.round(sc)}</strong></div>`;
        });
        inner.className = 'host-playing-scoreboard-inner host-ft-playing-inner';
        inner.innerHTML = parts.join('');
        return;
    }

    bar.classList.remove('host-ft-playing-board');
    inner.className = 'host-playing-scoreboard-inner';

    if (tournamentState.isTournamentMode) {
        const currentMatch = tournamentState.matches[tournamentState.currentMatch];
        if (!currentMatch) {
            bar.classList.add('hidden');
            return;
        }
        const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
        const t1 = team1Id != null ? tournamentState.teams[team1Id] : null;
        const t2 = team2Id != null ? tournamentState.teams[team2Id] : null;
        const ms = tournamentState.matchScores || [0, 0];
        let s0 = ms[0] != null ? ms[0] : 0;
        let s1 = ms[1] != null ? ms[1] : 0;
        const slot = getTournamentScorebarPlayingSlot();
        if (live && !prepOn && (slot === 0 || slot === 1)) {
            if (slot === 0) s0 += Math.round(gameState.score);
            else s1 += Math.round(gameState.score);
        }
        const n1 = t1 ? t1.name : 'Команда 1';
        const n2 = t2 ? t2.name : 'Команда 2';
        bar.classList.remove('hidden');
        inner.innerHTML =
            `<span class="host-sb-pill"><span class="host-sb-name">${escapeHtmlFlexible(n1)}</span> <strong class="host-sb-num">${Math.round(s0)}</strong></span>` +
            `<span class="host-sb-vs">—</span>` +
            `<span class="host-sb-pill"><span class="host-sb-name">${escapeHtmlFlexible(n2)}</span> <strong class="host-sb-num">${Math.round(s1)}</strong></span>`;
        return;
    }

    bar.classList.add('hidden');
    inner.innerHTML = '';
}

/** Для синхронизации зала: счёт матча/раунда во время игры на экране ведущего */
function buildHallScoreboardForSync() {
    const gs = typeof gameState !== 'undefined' ? gameState : null;
    const flex = typeof flexibleTournamentState !== 'undefined' ? flexibleTournamentState : null;
    const tour = typeof tournamentState !== 'undefined' ? tournamentState : null;
    const live = gs && gs.isPlaying && !gs.isPaused;
    const prep = document.getElementById('competitive-prep');
    const prepOn = !!(prep && prep.style.display !== 'none');

    if (flex && flex.isFlexibleMode && flex.roundTeamIndices && flex.roundTeamIndices.length) {
        const turn = typeof getFlexibleCurrentTurn === 'function' ? getFlexibleCurrentTurn() : null;
        const idxs = flex.roundTeamIndices;
        const scores = flex.roundScores || [];
        const rows = idxs.map((ti, i) => {
            const t = flex.teams[ti];
            let sc = scores[i] != null ? scores[i] : 0;
            if (live && !prepOn && turn && turn.slot === i) sc += Math.round(gs.score);
            return { name: t ? t.name : '—', score: Math.round(sc) };
        });
        return { mode: 'flexible', rows: rows };
    }
    if (tour && tour.isTournamentMode) {
        const currentMatch = tour.matches[tour.currentMatch];
        if (!currentMatch) return null;
        const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
        const t1 = team1Id != null ? tour.teams[team1Id] : null;
        const t2 = team2Id != null ? tour.teams[team2Id] : null;
        const ms = tour.matchScores || [0, 0];
        let s0 = ms[0] != null ? ms[0] : 0;
        let s1 = ms[1] != null ? ms[1] : 0;
        const slot = getTournamentScorebarPlayingSlot();
        if (live && !prepOn && (slot === 0 || slot === 1)) {
            if (slot === 0) s0 += Math.round(gs.score);
            else s1 += Math.round(gs.score);
        }
        return {
            mode: 'tournament',
            rows: [
                { name: t1 ? t1.name : 'Команда 1', score: Math.round(s0) },
                { name: t2 ? t2.name : 'Команда 2', score: Math.round(s1) }
            ]
        };
    }
    return null;
}

// Управление с клавиатуры
function setupKeyboardControls() {
    document.addEventListener('keydown', function(event) {
        if (!gameState.isPlaying) return;
        switch(event.code) {
            case 'ArrowRight':
            case 'KeyD':
                correctAnswer();
                break;
            case 'ArrowLeft':
            case 'KeyA':
                skipWord();
                break;
            case 'Space':
                event.preventDefault();
                if (gameState.isPaused) { resumeGame(); } else { pauseGame(); }
                break;
            case 'Escape':
                if (gameState.isPaused) { endGame(); }
                break;
        }
    });
}

// Отображение списков отгаданных и пропущенных слов
function displayWordsLists() {
    const correctWordsContainer = document.getElementById('correct-words-list');
    const skippedWordsContainer = document.getElementById('skipped-words-list');
    const correctCount = document.getElementById('correct-count');
    const skippedCount = document.getElementById('skipped-count');
    
    // Обновляем счетчики
    if (correctCount) correctCount.textContent = gameState.correctWords.length;
    if (skippedCount) skippedCount.textContent = gameState.skippedWordsList.length;
    
    // Отображаем отгаданные слова
    if (correctWordsContainer) {
        if (gameState.correctWords.length > 0) {
            correctWordsContainer.innerHTML = gameState.correctWords.map(word => 
                `<span class="word-item correct">${word}</span>`
            ).join('');
        } else {
            correctWordsContainer.innerHTML = '<span class="no-words">Нет отгаданных слов</span>';
        }
    }
    
    // Отображаем пропущенные слова
    if (skippedWordsContainer) {
        if (gameState.skippedWordsList.length > 0) {
            skippedWordsContainer.innerHTML = gameState.skippedWordsList.map(word => 
                `<span class="word-item skipped">${word}</span>`
            ).join('');
        } else {
            skippedWordsContainer.innerHTML = '<span class="no-words">Нет пропущенных слов</span>';
        }
    }
}

// Помечаем слова как использованные после завершения игры
function markWordsAsUsed() {
    if (!gameState.words || !Array.isArray(gameState.words)) return;
    
    // Добавляем только те слова, которые игрок действительно видел
    // (до текущего индекса слова)
    for (let i = 0; i < gameState.currentWordIndex; i++) {
        const word = gameState.words[i];
        if (word && word !== 'СЛОВО') { // Исключаем заглушки
            CUSTOM_WORDS_USED.add(word);
        }
    }
    
    // Сохраняем обновленное состояние
    localStorage.setItem('alias-custom-words-used', JSON.stringify(Array.from(CUSTOM_WORDS_USED)));
    
    // Обновляем информацию в UI
    updateMainInfoBanner();
}

// Немедленно помечаем конкретное слово как использованное (при показе)
function markWordAsUsedImmediate(word) {
    if (!word || word === 'СЛОВО') return;
    if (settings.wordSource !== 'custom' || !CUSTOM_WORDS) return;
    if (!CUSTOM_WORDS_USED) CUSTOM_WORDS_USED = new Set();
    if (!CUSTOM_WORDS_USED.has(word)) {
        CUSTOM_WORDS_USED.add(word);
        try {
            localStorage.setItem('alias-custom-words-used', JSON.stringify(Array.from(CUSTOM_WORDS_USED)));
        } catch (_) {}
        updateMainInfoBanner();
    }
}

// Показ уведомлений
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.remove(); }, 3000);
}

// Парсинг файла со словами
async function parseWordFile(file) {
    const readText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file, 'utf-8');
    });

    const text = await readText(file);
    const words = text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0).map(s => s.toUpperCase());
    
    // Удалим дубликаты
    const uniqueWords = [...new Set(words)];
    
    if (uniqueWords.length === 0) throw new Error('Файл не содержит слов');
    return uniqueWords;
}

// Глобальные функции для HTML
window.startGame = startGame;
window.showSettings = showSettings;
window.showRules = showRules;
window.showMainMenu = showMainMenu;
window.saveSettings = saveSettings;
window.correctAnswer = correctAnswer;
window.skipWord = skipWord;
window.pauseGame = pauseGame;
window.resumeGame = resumeGame;
window.endGame = endGame;
window.endTournamentGame = endTournamentGame;
window.newGame = newGame;

// Соревновательный режим API
window.showCompetitiveSetup = showCompetitiveSetup;
window.addCompetitivePlayerFromInput = addCompetitivePlayerFromInput;
window.removeCompetitivePlayer = removeCompetitivePlayer;
window.startCompetitive = startCompetitive;
window.endCompetitiveGame = endCompetitiveGame;

// Турнирные функции
window.startTournament = startTournament;
window.addTeam = addTeam;
window.removeTeam = removeTeam;
window.startTournamentMatch = startTournamentMatch;
window.startNextPlayer = startNextPlayer;
window.continueTournament = continueTournament;
window.endTournament = endTournament;
window.addTeamFromForm = addTeamFromForm;
window.showTournamentSetup = showTournamentSetup;
window.exportMatchResults = exportMatchResults;

window.showFlexibleTournamentFromMenu = showFlexibleTournamentFromMenu;
window.addFlexibleTeamFromForm = addFlexibleTeamFromForm;
window.removeFlexibleTeam = removeFlexibleTeam;
window.startFlexibleTeamEdit = startFlexibleTeamEdit;
window.cancelFlexibleTeamEdit = cancelFlexibleTeamEdit;
window.saveFlexibleTeamEdit = saveFlexibleTeamEdit;
window.callFlexibleTeams = callFlexibleTeams;
window.showFlexibleTournamentSetupFromCall = showFlexibleTournamentSetupFromCall;
window.startFlexibleRoundFromCall = startFlexibleRoundFromCall;
window.startNextFlexiblePlayer = startNextFlexiblePlayer;
window.endFlexibleRound = endFlexibleRound;
window.endFlexibleRoundWithConfirm = endFlexibleRoundWithConfirm;
window.cancelFlexibleRound = cancelFlexibleRound;
window.flexibleAfterRoundToSetup = flexibleAfterRoundToSetup;
window.resetFlexibleTournamentPersisted = resetFlexibleTournamentPersisted;
window.addFlexibleTeamQuick = addFlexibleTeamQuick;
window.buildHallScoreboardForSync = buildHallScoreboardForSync;

// -------------------------
// Гибкий турнир (реализация)
// -------------------------

function escapeHtmlFlexible(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showFlexibleTournamentFromMenu() {
    tournamentState.isTournamentMode = false;
    competitiveState.isCompetitiveMode = false;
    flexibleTournamentState.isFlexibleMode = true;

    const snap = readFlexibleStorageSnapshot();
    const memoryEmpty = !flexibleTournamentState.teams || flexibleTournamentState.teams.length === 0;

    if (memoryEmpty && flexPersistedSnapshotHasData(snap)) {
        if (confirm('Продолжить сохранённый гибкий турнир? Отмена — удалить сохранение и начать с пустого списка команд.')) {
            applyFlexibleSnapshotToState(snap);
        } else {
            try {
                localStorage.removeItem(FLEXIBLE_STORAGE_KEY);
            } catch (_) {}
            flexibleTournamentState.teams = [];
            flexibleTournamentState.totalScoresByTeam = {};
            flexibleTournamentState.gameTime = 60;
            flexibleTournamentState.maxSkipsPerTurn = 0;
            flexibleTournamentState.roundCirclesOverride = null;
            flexibleTournamentState.defaultPlayersForQuickAdd = 3;
            flexibleTournamentState.turnOrder = 'interleaved';
        }
    }

    const sb = document.getElementById('competitive-scoreboard');
    if (sb) sb.style.display = 'none';
    const prep = document.getElementById('competitive-prep');
    if (prep) prep.style.display = 'none';
    resetGameUI();
    syncFlexibleTournamentFormFields();
    renderFlexibleTeamsList();
    renderFlexibleRoundTeamCheckboxes();
    showScreen('flexible-tournament-setup');
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function flexibleAfterRoundToSetup() {
    flexibleTournamentState.roundTeamIndices = [];
    flexibleTournamentState.flexibleTurnIndex = 0;
    flexibleTournamentState.roundScores = [];
    flexibleTournamentState.roundPlayerResults = [];
    flexibleTournamentState.pendingRoundTeamIndices = null;
    renderFlexibleRoundTeamCheckboxes();
    showScreen('flexible-tournament-setup');
    writeFlexibleTournamentToStorage();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function addFlexibleTeam(name, players) {
    if (flexibleTournamentState.teams.length >= 16) {
        showNotification('Максимум 16 команд');
        return false;
    }
    if (!name || !String(name).trim()) {
        showNotification('Введите название команды');
        return false;
    }
    if (!players || !players.length) {
        showNotification('Добавьте хотя бы одного игрока');
        return false;
    }
    flexibleTournamentState.teams.push({
        name: String(name).trim(),
        players: players.map(p => String(p).trim()).filter(Boolean)
    });
    flexibleEditingTeamIndex = null;
    renderFlexibleTeamsList();
    renderFlexibleRoundTeamCheckboxes();
    writeFlexibleTournamentToStorage();
    return true;
}

function addFlexibleTeamFromForm() {
    const root = document.getElementById('flexible-tournament-setup');
    const nameEl = root ? root.querySelector('#flexible-team-name') : document.getElementById('flexible-team-name');
    const plEl = root ? root.querySelector('#flexible-team-players') : document.getElementById('flexible-team-players');
    readFlexibleSettingsFromForm();
    const name = nameEl ? nameEl.value : '';
    const playersText = plEl ? plEl.value : '';
    const players = playersText.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (addFlexibleTeam(name, players)) {
        if (nameEl) nameEl.value = '';
        if (plEl) plEl.value = '';
    }
}

function addFlexibleTeamQuick() {
    readFlexibleSettingsFromForm();
    let n = parseInt(flexibleTournamentState.defaultPlayersForQuickAdd, 10);
    if (Number.isNaN(n) || n < 1) n = 3;
    n = Math.min(n, 20);
    const idx = flexibleTournamentState.teams.length + 1;
    const players = [];
    for (let i = 1; i <= n; i++) players.push(`Игрок ${i}`);
    addFlexibleTeam(`Команда ${idx}`, players);
}

function removeFlexibleTeam(index) {
    if (flexibleEditingTeamIndex !== null) {
        if (flexibleEditingTeamIndex === index) flexibleEditingTeamIndex = null;
        else if (flexibleEditingTeamIndex > index) flexibleEditingTeamIndex--;
    }
    flexibleTournamentState.teams.splice(index, 1);
    renderFlexibleTeamsList();
    renderFlexibleRoundTeamCheckboxes();
    writeFlexibleTournamentToStorage();
}

/** Индекс команды в режиме редактирования в блоке «Команды» (null = никто) */
let flexibleEditingTeamIndex = null;

function startFlexibleTeamEdit(index) {
    if (index < 0 || index >= flexibleTournamentState.teams.length) return;
    flexibleEditingTeamIndex = index;
    renderFlexibleTeamsList();
}

function cancelFlexibleTeamEdit() {
    flexibleEditingTeamIndex = null;
    renderFlexibleTeamsList();
}

function saveFlexibleTeamEdit(index) {
    if (index < 0 || index >= flexibleTournamentState.teams.length) return;
    const nameInp = document.getElementById(`flexible-edit-name-${index}`);
    const plInp = document.getElementById(`flexible-edit-players-${index}`);
    const name = nameInp ? String(nameInp.value || '').trim() : '';
    const players = (plInp ? String(plInp.value || '') : '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    if (!name) {
        showNotification('Введите название команды');
        return;
    }
    if (!players.length) {
        showNotification('Добавьте хотя бы одного игрока');
        return;
    }
    flexibleTournamentState.teams[index] = { name, players };
    flexibleEditingTeamIndex = null;
    renderFlexibleTeamsList();
    renderFlexibleRoundTeamCheckboxes();
    writeFlexibleTournamentToStorage();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function renderFlexibleTeamsList() {
    const list = document.getElementById('flexible-teams-list');
    if (!list) return;
    if (flexibleEditingTeamIndex != null && flexibleEditingTeamIndex >= flexibleTournamentState.teams.length) {
        flexibleEditingTeamIndex = null;
    }
    list.innerHTML = '';
    flexibleTournamentState.teams.forEach((team, index) => {
        const row = document.createElement('div');
        row.className = 'team-item' + (flexibleEditingTeamIndex === index ? ' team-item--editing' : '');

        if (flexibleEditingTeamIndex === index) {
            const fields = document.createElement('div');
            fields.className = 'team-edit-fields';

            const g1 = document.createElement('div');
            g1.className = 'form-group';
            const l1 = document.createElement('label');
            l1.htmlFor = `flexible-edit-name-${index}`;
            l1.textContent = 'Название команды';
            const nameInp = document.createElement('input');
            nameInp.type = 'text';
            nameInp.id = `flexible-edit-name-${index}`;
            nameInp.value = team.name;
            g1.appendChild(l1);
            g1.appendChild(nameInp);

            const g2 = document.createElement('div');
            g2.className = 'form-group';
            const l2 = document.createElement('label');
            l2.htmlFor = `flexible-edit-players-${index}`;
            l2.textContent = 'Игроки (через запятую)';
            const plInp = document.createElement('input');
            plInp.type = 'text';
            plInp.id = `flexible-edit-players-${index}`;
            plInp.value = team.players.join(', ');
            g2.appendChild(l2);
            g2.appendChild(plInp);

            fields.appendChild(g1);
            fields.appendChild(g2);

            const btns = document.createElement('div');
            btns.className = 'team-edit-buttons';
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'btn btn-primary btn-small';
            saveBtn.textContent = 'Сохранить';
            saveBtn.addEventListener('click', () => saveFlexibleTeamEdit(index));
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary btn-small';
            cancelBtn.textContent = 'Отмена';
            cancelBtn.addEventListener('click', cancelFlexibleTeamEdit);
            btns.appendChild(saveBtn);
            btns.appendChild(cancelBtn);

            row.appendChild(fields);
            row.appendChild(btns);
            list.appendChild(row);
            return;
        }

        const info = document.createElement('div');
        info.className = 'team-info';
        const h4 = document.createElement('h4');
        h4.textContent = team.name;
        const p = document.createElement('p');
        p.textContent = `Игроки: ${team.players.join(', ')}`;
        info.appendChild(h4);
        info.appendChild(p);

        const actions = document.createElement('div');
        actions.className = 'team-item-actions-inline';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.textContent = 'Изменить';
        editBtn.addEventListener('click', () => startFlexibleTeamEdit(index));
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-danger btn-small';
        delBtn.textContent = 'Удалить';
        delBtn.addEventListener('click', () => removeFlexibleTeam(index));
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);
    });
}

function enforceFlexibleRoundPickLimit() {
    const boxes = [...document.querySelectorAll('.ft-round-pick:checked')];
    if (boxes.length <= FLEXIBLE_MAX_TEAMS_IN_ROUND) return;
    boxes.sort((a, b) => (parseInt(a.dataset.teamIndex, 10) || 0) - (parseInt(b.dataset.teamIndex, 10) || 0));
    for (let i = FLEXIBLE_MAX_TEAMS_IN_ROUND; i < boxes.length; i++) {
        boxes[i].checked = false;
    }
    showNotification(`В раунде не больше ${FLEXIBLE_MAX_TEAMS_IN_ROUND} команд`);
}

function renderFlexibleRoundTeamCheckboxes() {
    const wrap = document.getElementById('flexible-round-picks');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!flexibleTournamentState.teams.length) {
        wrap.innerHTML = '<p class="hint">Сначала добавьте хотя бы одну команду.</p>';
        return;
    }
    flexibleTournamentState.teams.forEach((team, index) => {
        const row = document.createElement('label');
        row.className = 'ft-pick-row';
        row.innerHTML = `
            <input type="checkbox" class="ft-round-pick" data-team-index="${index}">
            <span><strong>${team.name}</strong> — ${team.players.length} игроков</span>
        `;
        const inp = row.querySelector('.ft-round-pick');
        if (inp) {
            inp.addEventListener('change', enforceFlexibleRoundPickLimit);
        }
        wrap.appendChild(row);
    });
}

function getSelectedFlexibleRoundTeamIndices() {
    return [...document.querySelectorAll('.ft-round-pick:checked')]
        .map(el => parseInt(el.dataset.teamIndex, 10))
        .filter(i => !Number.isNaN(i) && i >= 0 && i < flexibleTournamentState.teams.length)
        .sort((a, b) => a - b);
}

function callFlexibleTeams() {
    readFlexibleSettingsFromForm();
    writeFlexibleTournamentToStorage();
    const picks = getSelectedFlexibleRoundTeamIndices();
    if (picks.length < 1) {
        showNotification(`Выберите от одной до ${FLEXIBLE_MAX_TEAMS_IN_ROUND} команд`);
        return;
    }
    if (picks.length > FLEXIBLE_MAX_TEAMS_IN_ROUND) {
        showNotification(`Не больше ${FLEXIBLE_MAX_TEAMS_IN_ROUND} команд в раунде`);
        return;
    }
    for (const idx of picks) {
        const t = flexibleTournamentState.teams[idx];
        if (!t || !t.players || !t.players.length) {
            showNotification('У каждой выбранной команды должен быть хотя бы один игрок');
            return;
        }
    }
    flexibleTournamentState.pendingRoundTeamIndices = picks.slice();
    const host = document.getElementById('ft-call-teams');
    if (host) {
        host.innerHTML = picks.map(i => {
            const t = flexibleTournamentState.teams[i];
            return `
                <div class="ft-call-card">
                    <h3>${t.name}</h3>
                    <p>${t.players.join(', ')}</p>
                </div>
            `;
        }).join('');
    }
    showScreen('flexible-tournament-call');
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function showFlexibleTournamentSetupFromCall() {
    showScreen('flexible-tournament-setup');
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function startFlexibleRoundFromCall() {
    const picks = (flexibleTournamentState.pendingRoundTeamIndices || []).slice();
    if (picks.length < 1 || picks.length > FLEXIBLE_MAX_TEAMS_IN_ROUND) {
        showNotification(`Вернитесь к настройке и выберите 1–${FLEXIBLE_MAX_TEAMS_IN_ROUND} команд`);
        showScreen('flexible-tournament-setup');
        return;
    }
    flexibleTournamentState.pendingRoundTeamIndices = null;
    flexibleTournamentState.roundTeamIndices = picks.slice();
    flexibleTournamentState.flexibleTurnIndex = 0;
    flexibleTournamentState.roundScores = picks.map(() => 0);
    flexibleTournamentState.roundPlayerResults = [];
    updateFlexibleMatchScreen();
    updateFlexiblePlayerInfo();
    showScreen('flexible-tournament-match');
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function getFlexibleRoundMaxPlayers() {
    const idxs = flexibleTournamentState.roundTeamIndices;
    if (!idxs || !idxs.length) return 0;
    let m = 0;
    for (let i = 0; i < idxs.length; i++) {
        const t = flexibleTournamentState.teams[idxs[i]];
        const n = t && t.players ? t.players.length : 0;
        if (n > m) m = n;
    }
    return m;
}

/** Число кругов в раунде: явное из настроек или по самой большой команде */
function getFlexibleRoundCircleCount() {
    const natural = getFlexibleRoundMaxPlayers();
    if (natural < 1) return 0;
    const raw = flexibleTournamentState.roundCirclesOverride;
    if (raw == null || raw === '') return natural;
    const c = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
    if (Number.isNaN(c) || c < 1) return natural;
    return Math.min(Math.max(c, 1), 50);
}

function getFlexibleRoundTotalTurns() {
    const k = flexibleTournamentState.roundTeamIndices.length;
    const circles = getFlexibleRoundCircleCount();
    return circles * k;
}

function getFlexibleCurrentTurn() {
    const fts = flexibleTournamentState;
    const idxs = fts.roundTeamIndices;
    if (!fts.isFlexibleMode || !idxs || !idxs.length) return null;
    const k = idxs.length;
    const circleCount = getFlexibleRoundCircleCount();
    if (circleCount < 1 || k < 1) return null;
    const total = circleCount * k;
    const tix = fts.flexibleTurnIndex || 0;
    if (tix >= total) return null;

    const byTeam = fts.turnOrder === 'byTeam';
    let slot;
    let circleZeroBased;
    if (byTeam) {
        slot = Math.floor(tix / circleCount);
        circleZeroBased = tix % circleCount;
    } else {
        slot = tix % k;
        circleZeroBased = Math.floor(tix / k);
    }

    const teamGlobalIdx = idxs[slot];
    const team = fts.teams[teamGlobalIdx];
    if (!team || !team.players || !team.players.length) return null;
    const playerIndex = circleZeroBased % team.players.length;
    const playerName = team.players[playerIndex];
    return {
        slot,
        teamGlobalIdx,
        team,
        playerName,
        playerIndex,
        circle: circleZeroBased + 1,
        circleMax: circleCount,
        turnInRound: tix + 1,
        turnMax: total,
        turnOrder: byTeam ? 'byTeam' : 'interleaved'
    };
}

function updateFlexibleMatchScreen() {
    const info = document.getElementById('ft-match-info');
    if (!info) return;
    const idxs = flexibleTournamentState.roundTeamIndices;
    if (!idxs || !idxs.length) {
        info.innerHTML = '';
        return;
    }
    const scores = flexibleTournamentState.roundScores || [];
    const pills = idxs.map((ti, i) => {
        const t = flexibleTournamentState.teams[ti];
        const sc = scores[i] != null ? scores[i] : 0;
        return `
            <div class="ft-score-pill">
                ${t ? t.name : '—'}
                <strong id="ft-score-${i}">${sc}</strong>
            </div>
        `;
    }).join('');
    const circleCount = getFlexibleRoundCircleCount();
    const totalTurns = getFlexibleRoundTotalTurns();
    const natural = getFlexibleRoundMaxPlayers();
    const rawOverride = flexibleTournamentState.roundCirclesOverride;
    const hasOverride =
        rawOverride != null &&
        String(rawOverride).trim() !== '' &&
        !Number.isNaN(parseInt(String(rawOverride), 10)) &&
        parseInt(String(rawOverride), 10) >= 1;
    const circlesHint = hasOverride
        ? `задано вручную: <strong>${circleCount}</strong> (без учёта «${natural}» по составу; в маленьких командах игроки повторяются по кругу)`
        : `по числу игроков в самой большой команде (<strong>${natural}</strong>); в маленьких командах игроки повторяются по кругу`;
    const orderHint =
        flexibleTournamentState.turnOrder === 'byTeam'
            ? 'подряд по командам: сначала все ходы первой выбранной команды, затем второй и т.д.'
            : 'по кругу команд: в каждом круге по одному объясняющему с каждой команды по очереди';
    info.innerHTML = `
        <h3>Раунд гибкого турнира</h3>
        <p><strong>Кругов в раунде:</strong> ${circlesHint}</p>
        <p><strong>Порядок ходов:</strong> ${orderHint}</p>
        <p><strong>Команд в раунде:</strong> ${idxs.length} · <strong>Всего ходов:</strong> ${totalTurns}</p>
        <div class="ft-score-strip">${pills}</div>
    `;
}

function updateFlexiblePlayerInfo() {
    const el = document.getElementById('ft-current-player-info');
    if (!el) return;
    const turn = getFlexibleCurrentTurn();
    if (!turn) {
        const idxs = flexibleTournamentState.roundTeamIndices;
        const k = idxs && idxs.length ? idxs.length : 0;
        const circleCount = getFlexibleRoundCircleCount();
        const total = circleCount * k;
        const done =
            flexibleTournamentState.isFlexibleMode &&
            k > 0 &&
            circleCount > 0 &&
            (flexibleTournamentState.flexibleTurnIndex || 0) >= total;
        el.innerHTML = done
            ? '<h3>Раунд сыгран</h3><p>Все ходы этого раунда завершены. Нажмите «Завершить раунд».</p>'
            : '<p>Нет данных по раунду</p>';
        return;
    }
    const k = flexibleTournamentState.roundTeamIndices.length;
    const isByTeam = turn.turnOrder === 'byTeam';
    const circleLabel = isByTeam ? 'Ход в команде' : 'Круг';
    const posLabel = isByTeam ? 'Команда в раунде' : 'Порядок команд в круге';
    const posLine = isByTeam
        ? `<p><strong>${posLabel}:</strong> ${turn.slot + 1} из ${k}</p>`
        : `<p><strong>${posLabel}:</strong> место ${turn.slot + 1} из ${k}</p>`;
    el.innerHTML = `
        <h3>Следующий ход</h3>
        <p><strong>Команда:</strong> ${turn.team.name}</p>
        <p><strong>Объясняет:</strong> ${turn.playerName}</p>
        <p><strong>${circleLabel}:</strong> ${turn.circle} из ${turn.circleMax} · <strong>Ход в раунде:</strong> ${turn.turnInRound} из ${turn.turnMax}</p>
        ${posLine}
    `;
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function startNextFlexiblePlayer() {
    if (!flexibleTournamentState.isFlexibleMode || !flexibleTournamentState.roundTeamIndices.length) {
        showNotification('Сначала начните раунд');
        return;
    }
    if (!getFlexibleCurrentTurn()) {
        showNotification('Все ходы этого раунда уже сыграны. Нажмите «Завершить раунд».');
        updateFlexiblePlayerInfo();
        return;
    }
    updateFlexiblePlayerInfo();
    startGame();
}

function endFlexiblePlayerTurn() {
    const turn = getFlexibleCurrentTurn();
    if (!turn) {
        showScreen('flexible-tournament-match');
        return;
    }
    const slot = turn.slot;
    const teamGlobalIdx = turn.teamGlobalIdx;
    const roundScores = flexibleTournamentState.roundScores;
    if (roundScores[slot] == null) roundScores[slot] = 0;
    roundScores[slot] += Math.round(gameState.score);

    try {
        flexibleTournamentState.roundPlayerResults.push({
            teamGlobalIndex: teamGlobalIdx,
            teamName: turn.team.name,
            playerName: turn.playerName,
            playerIndex: turn.playerIndex,
            circle: turn.circle,
            score: Math.round(gameState.score),
            correctWords: Array.isArray(gameState.correctWords) ? [...gameState.correctWords] : [],
            skippedWords: Array.isArray(gameState.skippedWordsList) ? [...gameState.skippedWordsList] : []
        });
    } catch (_) {}

    flexibleTournamentState.flexibleTurnIndex = (flexibleTournamentState.flexibleTurnIndex || 0) + 1;

    updateFlexibleMatchScreen();
    updateFlexiblePlayerInfo();
    showScreen('flexible-tournament-match');
}

function endFlexibleRoundWithConfirm() {
    const msg =
        'Завершить раунд? Очки сыгранных ходов попадут в таблицу (по игрокам и в «Итого» команды), колонка «В турнире» обновится. Несыгранные ходы этого раунда отменяются.';
    if (!confirm(msg)) return;
    endFlexibleRound();
}

/** Суммы очков за раунд по паре (индекс команды в турнире, индекс игрока в составе). */
function aggregateFlexibleRoundScoresByTeamPlayer(roundPlayerResults) {
    const map = new Map();
    (roundPlayerResults || []).forEach((r) => {
        const ti = r.teamGlobalIndex;
        const pi = r.playerIndex;
        if (ti == null || pi == null) return;
        const key = `${ti}:${pi}`;
        const add = Math.round(Number(r.score)) || 0;
        map.set(key, (map.get(key) || 0) + add);
    });
    return map;
}

/** Подписи колонок: по j-му слоту состава — уникальные имена из ростеров команд раунда. */
function getFlexibleRoundSummaryPlayerColumnHeaders(idxs, teams, maxP) {
    const headers = [];
    for (let j = 0; j < maxP; j++) {
        const seen = new Set();
        const names = [];
        idxs.forEach((ti) => {
            const t = teams[ti];
            const raw = t && t.players && t.players[j] != null ? String(t.players[j]).trim() : '';
            if (!raw) return;
            const lk = raw.toLowerCase();
            if (seen.has(lk)) return;
            seen.add(lk);
            names.push(raw);
        });
        headers.push(names.length ? names.join(' / ') : `Игрок ${j + 1}`);
    }
    return headers;
}

function endFlexibleRound() {
    const idxs = flexibleTournamentState.roundTeamIndices;
    if (!idxs || !idxs.length) {
        flexibleAfterRoundToSetup();
        return;
    }
    const totals = flexibleTournamentState.totalScoresByTeam;
    const scores = flexibleTournamentState.roundScores || [];
    const teams = flexibleTournamentState.teams;
    idxs.forEach((ti, i) => {
        const t = teams[ti];
        const rsc = scores[i] != null ? scores[i] : 0;
        if (t) {
            totals[ti] = (totals[ti] || 0) + rsc;
        }
    });

    const maxP = idxs.reduce((m, ti) => {
        const t = teams[ti];
        const n = t && t.players ? t.players.length : 0;
        return Math.max(m, n);
    }, 0);
    const columnHeaders = getFlexibleRoundSummaryPlayerColumnHeaders(idxs, teams, maxP);
    const agg = aggregateFlexibleRoundScoresByTeamPlayer(flexibleTournamentState.roundPlayerResults);
    const colTpl =
        maxP === 0
            ? 'minmax(6.5rem, 1.35fr) minmax(3.25rem, auto) minmax(3.25rem, auto)'
            : `minmax(6.5rem, 1.2fr) repeat(${maxP}, minmax(2.5rem, 1fr)) minmax(3.25rem, auto) minmax(3.25rem, auto)`;

    let rowsHtml = '';
    idxs.forEach((ti, i) => {
        const t = teams[ti];
        const rsc = scores[i] != null ? Math.round(scores[i]) : 0;
        const tot = t ? Math.round(totals[ti] || 0) : 0;
        const name = t ? t.name : '—';
        let playerCells = '';
        for (let j = 0; j < maxP; j++) {
            const v = agg.get(`${ti}:${j}`);
            const disp = v == null ? '—' : String(Math.round(v));
            playerCells += `<div class="ft-summary-cell ft-summary-pcell ft-summary-num" role="cell">${escapeHtmlFlexible(disp)}</div>`;
        }
        rowsHtml += `<div class="ft-summary-row" role="row" style="grid-template-columns:${colTpl}"><div class="ft-summary-cell ft-summary-team" role="rowheader">${escapeHtmlFlexible(String(name))}</div>${playerCells}<div class="ft-summary-cell ft-summary-num ft-summary-round-total" role="cell">${rsc}</div><div class="ft-summary-cell ft-summary-num ft-summary-tourney-total" role="cell">${tot}</div></div>`;
    });

    const headHtml = `<div class="ft-summary-head" role="row" style="grid-template-columns:${colTpl}"><span class="ft-summary-h ft-summary-h-team" role="columnheader">Команда</span>${columnHeaders.map((h) => `<span class="ft-summary-h ft-summary-h-player" role="columnheader">${escapeHtmlFlexible(h)}</span>`).join('')}<span class="ft-summary-h ft-summary-h-num" role="columnheader">Итого</span><span class="ft-summary-h ft-summary-h-num" role="columnheader">В турнире</span></div>`;

    const sumEl = document.getElementById('flexible-round-summary');
    if (sumEl) {
        sumEl.innerHTML = `
            <div class="ft-summary-grid ft-summary-grid--by-players" role="table" aria-label="Итоги раунда">
                ${headHtml}
                <div class="ft-summary-body" role="rowgroup">
                    ${rowsHtml}
                </div>
            </div>
            <p class="hint ft-summary-footnote">В колонках игроков — очки за раунд по каждому слоту состава. «Итого» — сумма команды за раунд; «В турнире» — накопленно по турниру после этого раунда.</p>
        `;
    }
    showScreen('flexible-round-results');
    writeFlexibleTournamentToStorage();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function cancelFlexibleRound() {
    if (!confirm('Отменить текущий раунд? Очки этого раунда не засчитаются.')) return;
    flexibleTournamentState.roundTeamIndices = [];
    flexibleTournamentState.flexibleTurnIndex = 0;
    flexibleTournamentState.roundScores = [];
    flexibleTournamentState.roundPlayerResults = [];
    flexibleTournamentState.pendingRoundTeamIndices = null;
    renderFlexibleRoundTeamCheckboxes();
    showScreen('flexible-tournament-setup');
    writeFlexibleTournamentToStorage();
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

// -------------------------
// Соревновательный режим
// -------------------------

function showCompetitiveSetup() {
    // Перед входом в соревновательный режим очищаем следы предыдущей игры
    flexibleTournamentState.isFlexibleMode = false;
    resetGameUI();
    competitiveState.isCompetitiveMode = true;
    if (!Array.isArray(competitiveState.players)) competitiveState.players = [];
    renderCompetitivePlayers();
    // Показать таблицу в игровом экране и перейти на него
    showScreen('game-screen');
    const sb = document.getElementById('competitive-scoreboard');
    if (sb) sb.style.display = '';
    // Скрыть подготовку
    const prep = document.getElementById('competitive-prep');
    if (prep) prep.style.display = 'none';
    // Обнулить общий UI слова/счетчик
    document.getElementById('current-word').textContent = 'Нажмите "Начать раунд"';
}

function renderCompetitivePlayers() {
    const list = document.getElementById('competitive-players-list');
    if (!list) return;
    list.innerHTML = '';
    competitiveState.players.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'competitive-player-row' + (idx === competitiveState.currentPlayerIndex ? ' active' : '');
        row.innerHTML = `
            <span class="competitive-player-name">${p.name}</span>
            <span class="competitive-player-score">${p.score ?? 0}</span>
            <span class="competitive-player-actions">
                <button class="btn btn-danger btn-small" onclick="removeCompetitivePlayer(${idx})">Удалить</button>
            </span>
        `;
        list.appendChild(row);
    });
    // Обновляем подпись кнопки старта
    const startBtn = document.getElementById('competitive-start-btn');
    if (startBtn) {
        const next = competitiveState.players[competitiveState.currentPlayerIndex];
        const name = next ? next.name : '';
        startBtn.textContent = name ? `Начать раунд — ${name}` : 'Начать раунд';
    }
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
}

function addCompetitivePlayerFromInput() {
    const input = document.getElementById('competitive-player-name');
    if (!input) return;
    const name = (input.value || '').trim();
    if (!name) { showNotification('Введите имя игрока'); return; }
    competitiveState.players.push({ id: Date.now() + Math.random(), name, score: 0 });
    input.value = '';
    renderCompetitivePlayers();
}

function removeCompetitivePlayer(index) {
    if (index < 0 || index >= competitiveState.players.length) return;
    competitiveState.players.splice(index, 1);
    if (competitiveState.currentPlayerIndex >= competitiveState.players.length) {
        competitiveState.currentPlayerIndex = 0;
    }
    renderCompetitivePlayers();
}

function startCompetitive() {
    if (!competitiveState.players.length) {
        showNotification('Добавьте хотя бы одного игрока');
        return;
    }
    startGame();
}

function startCompetitivePreparation() {
    const prep = document.getElementById('competitive-prep');
    const nameEl = document.getElementById('prep-player-name');
    const countdownEl = document.getElementById('prep-countdown');
    const player = competitiveState.players[competitiveState.currentPlayerIndex];
    if (!player) return;
    if (nameEl) nameEl.textContent = player.name;
    let left = competitiveState.prepSeconds;
    if (countdownEl) countdownEl.textContent = String(left);
    if (prep) prep.style.display = '';
    if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
    clearInterval(competitiveState.prepTimer);
    competitiveState.prepTimer = setInterval(() => {
        left--;
        if (countdownEl) countdownEl.textContent = String(Math.max(left, 0));
        if (typeof window.__aliasStandaloneHostPush === 'function') window.__aliasStandaloneHostPush(null);
        if (left <= 0) {
            clearInterval(competitiveState.prepTimer);
            if (prep) prep.style.display = 'none';
            startTimer();
            showCurrentWord();
        }
    }, 1000);
}

function endCompetitivePlayerTurn() {
    // Добавляем очки текущему игроку
    const player = competitiveState.players[competitiveState.currentPlayerIndex];
    if (player) {
        player.score = (player.score || 0) + Math.round(gameState.score);
    }
    renderCompetitivePlayers();
    // Переход к следующему игроку по кругу
    competitiveState.currentPlayerIndex = (competitiveState.currentPlayerIndex + 1) % Math.max(competitiveState.players.length, 1);
    renderCompetitivePlayers();
    // Возвращаемся к экрану таблицы и ждем ручного старта следующего раунда
    showScreen('game-screen');
    const sb = document.getElementById('competitive-scoreboard');
    if (sb) sb.style.display = '';
    document.getElementById('current-word').textContent = 'Нажмите "Начать раунд"';
}

function endCompetitiveGame() {
    // Мгновенно завершаем текущий раунд, если он идет
    if (gameState.isPlaying) {
        // Это вызовет endCompetitivePlayerTurn через endGame
        endGame();
        return;
    }
    // Показать итоговую таблицу
    showCompetitiveResults();
}

function showCompetitiveResults() {
    const list = document.getElementById('competitive-results-list');
    if (list) {
        const sorted = [...competitiveState.players].sort((a,b) => (b.score||0) - (a.score||0));
        list.innerHTML = sorted.map(p => `
            <div class="competitive-results-row">
                <span>${p.name}</span>
                <span>${p.score || 0}</span>
            </div>
        `).join('');
    }
    showScreen('competitive-results');
}

function resetCompetitive() {
    competitiveState.players = [];
    competitiveState.currentPlayerIndex = 0;
    renderCompetitivePlayers();
}
