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
    skippedWordsList: [] // Список пропущенных слов
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

// Инициализация игры
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    loadLastGameInfo();
    loadCustomWordsFromStorage();
    updateWordSourceUI();
    setupKeyboardControls();
    setupCustomPackControls();
    updateMainInfoBanner();
});

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
                CUSTOM_WORDS = words;
                localStorage.setItem('alias-custom-words', JSON.stringify(words));
                CUSTOM_WORDS_META = { fileName: files[0].name || 'custom.txt', usedCount: 0, total: words.length };
                localStorage.setItem('alias-custom-words-meta', JSON.stringify(CUSTOM_WORDS_META));
                // сбрасываем историю использования слов при загрузке нового пакета
                CUSTOM_WORDS_USED = new Set();
                localStorage.removeItem('alias-custom-words-used');
                updateCustomPackStatus();
                showNotification('Файл загружен!');
                updateMainInfoBanner();
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

    if (timerElement) timerElement.textContent = String(settings.gameTime);
    if (progressElement) {
        progressElement.style.width = '100%';
        progressElement.style.background = '';
    }
    if (scoreEl) scoreEl.textContent = '0';
    if (wordEl) wordEl.textContent = '';
    if (wordNumEl) wordNumEl.textContent = '0';
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
    competitiveState.isCompetitiveMode = false;
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

    gameState = {
        isPlaying: true,
        isPaused: false,
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
        skippedWordsList: []
    };
    
    updateGameUI();
    showScreen('game-screen');
    if (competitiveState.isCompetitiveMode) {
        // перед стартом даем 3 секунды подготовки
        startCompetitivePreparation();
    } else {
        // Универсальная подготовка перед началом раунда во всех режимах
        startRoundPreparation(3, null, () => {
            startTimer();
            showCurrentWord();
        });
    }
}

// Получение слов из выбранного источника
function getWordsForCurrentSource(category, count) {
    if (settings.wordSource === 'custom' && CUSTOM_WORDS) {
        const words = CUSTOM_WORDS;
        if (!words.length) return Array(count).fill('СЛОВО');
        
        // Берем только неиспользованные слова
        const remaining = words.filter(w => !CUSTOM_WORDS_USED.has(w));
        if (remaining.length === 0) {
            showNotification('Слова в пользовательском пакете закончились. Очистите пакет или загрузите новый.');
            return Array(Math.min(count, words.length)).fill('СЛОВО');
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
    if (competitiveState && competitiveState.prepTimer) {
        clearInterval(competitiveState.prepTimer);
    }
    if (left === 0) {
        if (prep) prep.style.display = 'none';
        if (typeof onComplete === 'function') onComplete();
        return;
    }
    competitiveState.prepTimer = setInterval(() => {
        left--;
        if (countdownEl) countdownEl.textContent = String(Math.max(left, 0));
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
    }
}

// Показ текущего слова
function showCurrentWord() {
    if (gameState.currentWordIndex < gameState.words.length) {
        const wordElement = document.getElementById('current-word');
        wordElement.textContent = gameState.words[gameState.currentWordIndex];
        document.getElementById('current-word-number').textContent = gameState.currentWordIndex + 1;
    }
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
    gameState.skippedWords++;
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
        if (!more.length) { endGame(); return; }
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
    gameState.isPaused = true;
    document.getElementById('pause-time').textContent = gameState.timeRemaining + ' сек';
    document.getElementById('pause-score').textContent = gameState.score;
    document.getElementById('pause-words').textContent = gameState.currentWordIndex;
    showScreen('pause-screen');
}

function resumeGame() { gameState.isPaused = false; showScreen('game-screen'); }

function endGame() {
    if (!gameState.isPlaying) return; // Предотвращаем повторное завершение
    
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
    
    // Обновляем информацию о первом игроке
    updateCurrentPlayerInfo();
    
    showScreen('tournament-match');
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
}

// Обновление счета матча
function updateMatchScore() {
    const team1ScoreElement = document.getElementById('team1-score');
    const team2ScoreElement = document.getElementById('team2-score');
    
    if (team1ScoreElement && team2ScoreElement) {
        team1ScoreElement.textContent = tournamentState.matchScores[0];
        team2ScoreElement.textContent = tournamentState.matchScores[1];
    }
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
    
    // Обновляем информацию о первом игроке
    updateCurrentPlayerInfo();
    
    showScreen('tournament-match');
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
function updateGameUI() { document.getElementById('current-score').textContent = Math.round(gameState.score); }

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

// -------------------------
// Соревновательный режим
// -------------------------

function showCompetitiveSetup() {
    // Перед входом в соревновательный режим очищаем следы предыдущей игры
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
    clearInterval(competitiveState.prepTimer);
    competitiveState.prepTimer = setInterval(() => {
        left--;
        if (countdownEl) countdownEl.textContent = String(Math.max(left, 0));
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
