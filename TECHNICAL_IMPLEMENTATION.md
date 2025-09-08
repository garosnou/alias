# Техническая реализация игры Alias

## Архитектура системы

### Общая структура
```
alias/
├── index.html          # UI и структура экранов
├── script.js           # Основная логика игры
├── styles.css          # Стили и анимации
├── words.js            # База встроенных слов
├── README.md           # Общая документация
└── TECHNICAL_IMPLEMENTATION.md  # Этот файл
```

### Принципы архитектуры
1. **Модульность**: Каждый файл отвечает за свою область
2. **Состояние**: Централизованное управление состоянием через глобальные объекты
3. **События**: Обработка пользовательских действий через onclick и клавиатуру
4. **Персистентность**: Сохранение данных в localStorage

## Система состояний

### Иерархия состояний
```
gameState (текущая игра)
├── isPlaying: boolean
├── isPaused: boolean
├── score: number
├── currentWord: string
├── correctWords: Array
├── skippedWordsList: Array
└── timerInterval: number

tournamentState (турнир)
├── isTournamentMode: boolean
├── teams: Array
├── matches: Array
├── currentMatch: number
├── currentTeamIndex: number
├── currentPlayerIndex: number
├── matchScores: Array
└── currentMatchPlayerResults: Array

settings (настройки)
├── timeLimit: number
├── wordCount: number
├── category: string
└── wordSource: string
```

### Управление состоянием
- **Инициализация**: `DOMContentLoaded` → загрузка настроек → установка начального состояния
- **Изменения**: Прямое изменение объектов состояния
- **Синхронизация**: UI обновляется через `innerHTML` и `showScreen()`
- **Сохранение**: Автоматическое сохранение в localStorage при изменениях

## Турнирная система

### Структура турнира

#### Команды (`tournamentState.teams`)
```javascript
{
    name: string,           // Название команды
    players: Array<string>  // Массив имен игроков
}
```

#### Матчи (`tournamentState.matches`)
```javascript
{
    round: number,                    // Номер раунда
    team1: number | {from: number},   // Команда 1 (индекс или ссылка)
    team2: number | {from: number},   // Команда 2 (индекс или ссылка)
    winner: number | null            // Победитель (индекс команды)
}
```

### Генерация турнирной сетки

#### Алгоритм `generateTournamentBracket()`
1. **Первый раунд**: Создание пар команд `[0,1], [2,3], ...`
2. **Последующие раунды**: Создание матчей с ссылками на победителей
3. **Ссылки**: `{from: matchIndex}` указывает на матч, победитель которого будет участником

#### Пример сетки для 4 команд
```
Раунд 1:
- Матч 0: Команда 0 vs Команда 1
- Матч 1: Команда 2 vs Команда 3

Раунд 2 (финал):
- Матч 2: Победитель матча 0 vs Победитель матча 1
```

### Разрешение команд

#### Функция `getResolvedTeamIds(match)`
```javascript
function getResolvedTeamIds(match) {
    let team1Id = null;
    let team2Id = null;
    
    // Разрешаем команду 1
    if (typeof match.team1 === 'number') {
        team1Id = match.team1;
    } else if (match.team1 && typeof match.team1.from === 'number') {
        const referencedMatch = tournamentState.matches[match.team1.from];
        team1Id = referencedMatch.winner;
    }
    
    // Разрешаем команду 2
    if (typeof match.team2 === 'number') {
        team2Id = match.team2;
    } else if (match.team2 && typeof match.team2.from === 'number') {
        const referencedMatch = tournamentState.matches[match.team2.from];
        team2Id = referencedMatch.winner;
    }
    
    return { team1Id, team2Id };
}
```

### Режимы игры в турнире

#### Sequential (Последовательный)
```javascript
// Логика перехода между игроками
if (tournamentState.currentTeamIndex === 0) {
    // Команда 1
    if (tournamentState.currentPlayerIndex < team1.players.length - 1) {
        tournamentState.currentPlayerIndex++;
    } else {
        // Переход к команде 2
        tournamentState.currentTeamIndex = 1;
        tournamentState.currentPlayerIndex = 0;
    }
} else {
    // Команда 2
    if (tournamentState.currentPlayerIndex < team2.players.length - 1) {
        tournamentState.currentPlayerIndex++;
    } else {
        // Матч завершен
        endMatch();
    }
}
```

#### Alternating (Чередующийся)
```javascript
// Определение команды и игрока
const teamIndex = tournamentState.currentPlayerIndex % 2;
const playerIndexInTeam = Math.floor(tournamentState.currentPlayerIndex / 2);

// Проверка завершения
const minPlayers = Math.min(team1.players.length, team2.players.length);
const totalTurns = minPlayers * 2;

if (tournamentState.currentPlayerIndex >= totalTurns) {
    endMatch();
}
```

## Система управления словами

### Источники слов

#### Встроенная база (`words.js`)
```javascript
const WORDS_DATABASE = {
    general: ["слово1", "слово2", ...],
    professions: ["профессия1", "профессия2", ...],
    animals: ["животное1", "животное2", ...],
    // ...
};
```

#### Пользовательские пакеты
```javascript
let CUSTOM_WORDS = [];                    // Массив слов из файла
let CUSTOM_WORDS_META = {                // Метаданные пакета
    fileName: null,
    usedCount: 0,
    total: 0
};
let CUSTOM_WORDS_USED = new Set();       // Использованные слова
```

### Предотвращение повторений в пользовательских пакетах

#### Алгоритм `getWordsForCurrentSource()`
1. **Выбор источника**: `settings.wordSource` определяет источник
2. **Фильтрация**: Исключение уже использованных слов (только для пользовательских пакетов)
3. **Перемешивание**: Случайный порядок слов
4. **Возврат**: Возврат слов без пометки как использованных

```javascript
function getWordsForCurrentSource(category, count) {
    if (settings.wordSource === 'custom' && CUSTOM_WORDS) {
        // Берем только неиспользованные слова
        const remaining = CUSTOM_WORDS.filter(w => !CUSTOM_WORDS_USED.has(w));
        if (remaining.length === 0) {
            // Все слова использованы
            return Array(Math.min(count, CUSTOM_WORDS.length)).fill('СЛОВО');
        }
        const shuffled = [...remaining].sort(() => 0.5 - Math.random());
        const taken = shuffled.slice(0, Math.min(count, remaining.length));
        // НЕ помечаем как использованные здесь
        return taken;
    } else {
        // Для встроенных слов просто получаем случайные слова
        return window.getWordsForGame(category, count);
    }
}
```

#### Алгоритм `markWordsAsUsed()`
1. **Вызывается**: После завершения игры в `endGame()`
2. **Добавление**: Только слова, которые игрок видел (до `currentWordIndex`), добавляются в `CUSTOM_WORDS_USED`
3. **Возврат**: Неиспользованные слова возвращаются в игру
4. **Сохранение**: Обновленное состояние сохраняется в localStorage
5. **Обновление UI**: Обновляется информация о количестве оставшихся слов

```javascript
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
```

## Система экранов

### Управление экранами
```javascript
function showScreen(screenName) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(screenName);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    }
}
```

### Основные экраны
1. **main-menu**: Главное меню с настройками
2. **game-screen**: Игровой экран
3. **results**: Результаты обычной игры
4. **tournament-setup**: Настройка турнира
5. **tournament-match**: Экран матча
6. **match-results**: Результаты матча
7. **tournament-results**: Результаты турнира

## Система событий

### Обработка клавиатуры
```javascript
document.addEventListener('keydown', function(event) {
    if (!gameState.isPlaying) return;
    
    switch(event.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
            correctAnswer();
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            skipWord();
            break;
        case ' ':
            togglePause();
            break;
    }
});
```

### Обработка таймера
```javascript
function startTimer() {
    gameState.timerInterval = setInterval(() => {
        if (gameState.isPaused) return;
        
        const elapsed = Math.round((Date.now() - gameState.startTime) / 1000);
        const remaining = gameState.timeLimit - elapsed;
        
        if (remaining <= 0) {
            endGame();
        } else {
            updateTimerDisplay(remaining);
        }
    }, 1000);
}
```

## Система сохранения

### localStorage структура
```javascript
// Настройки
localStorage.setItem('alias-settings', JSON.stringify(settings));

// История игр
localStorage.setItem('alias-history', JSON.stringify(gameHistory));

// Пользовательские слова
localStorage.setItem('alias-custom-words', JSON.stringify(CUSTOM_WORDS));
localStorage.setItem('alias-custom-words-meta', JSON.stringify(CUSTOM_WORDS_META));
localStorage.setItem('alias-custom-words-used', JSON.stringify([...CUSTOM_WORDS_USED]));
```

### Загрузка данных
```javascript
function loadSettings() {
    const saved = localStorage.getItem('alias-settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
}

function loadCustomWordsFromStorage() {
    const savedWords = localStorage.getItem('alias-custom-words');
    const savedMeta = localStorage.getItem('alias-custom-words-meta');
    const savedUsed = localStorage.getItem('alias-custom-words-used');
    
    if (savedWords) CUSTOM_WORDS = JSON.parse(savedWords);
    if (savedMeta) CUSTOM_WORDS_META = JSON.parse(savedMeta);
    if (savedUsed) {
        try { CUSTOM_WORDS_USED = new Set(JSON.parse(savedUsed)); } catch (_) { CUSTOM_WORDS_USED = new Set(); }
    } else {
        CUSTOM_WORDS_USED = new Set();
    }
}
```

## Особенности реализации

### Асинхронная загрузка файлов
```javascript
function loadCustomWordsFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const words = content.split('\n')
            .map(word => word.trim())
            .filter(word => word.length > 0);
        
        CUSTOM_WORDS = words;
        CUSTOM_WORDS_META = {
            fileName: file.name,
            usedCount: 0,
            total: words.length
        };
        CUSTOM_WORDS_USED.clear();
        
        saveCustomWordsToStorage();
        updateMainInfoBanner();
    };
    reader.readAsText(file);
}
```

### Экспорт результатов
```javascript
function exportMatchResults() {
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = tournamentState.teams[team1Id];
    const team2 = tournamentState.teams[team2Id];
    
    let content = `Результаты матча: ${team1.name} vs ${team2.name}\n`;
    content += `Счет: ${tournamentState.matchScores[0]} - ${tournamentState.matchScores[1]}\n\n`;
    
    tournamentState.currentMatchPlayerResults.forEach(result => {
        content += `${result.teamName} - ${result.playerName}: ${result.score} очков\n`;
        content += `Отгаданные: ${result.correctWords.join(', ')}\n`;
        content += `Пропущенные: ${result.skippedWords.join(', ')}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alias-match-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}
```

### Динамическое обновление UI
```javascript
function updateCurrentPlayerInfo() {
    const currentMatch = tournamentState.matches[tournamentState.currentMatch];
    const { team1Id, team2Id } = getResolvedTeamIds(currentMatch);
    const team1 = team1Id != null ? tournamentState.teams[team1Id] : null;
    const team2 = team2Id != null ? tournamentState.teams[team2Id] : null;
    
    if (tournamentState.gameMode === 'sequential') {
        // Логика для последовательного режима
        const currentTeam = tournamentState.currentTeamIndex === 0 ? team1 : team2;
        const currentPlayer = currentTeam.players[tournamentState.currentPlayerIndex];
        
        document.getElementById('current-player-info').innerHTML = `
            <h3>${currentTeam.name}</h3>
            <p>Игрок: ${currentPlayer}</p>
            <p>Раунд: ${tournamentState.currentPlayerIndex + 1}/${currentTeam.players.length}</p>
        `;
    } else {
        // Логика для чередующегося режима
        const teamIndex = tournamentState.currentPlayerIndex % 2;
        const playerIndexInTeam = Math.floor(tournamentState.currentPlayerIndex / 2);
        const currentTeam = teamIndex === 0 ? team1 : team2;
        const currentPlayer = currentTeam.players[playerIndexInTeam];
        
        document.getElementById('current-player-info').innerHTML = `
            <h3>${currentTeam.name}</h3>
            <p>Игрок: ${currentPlayer}</p>
            <p>Раунд: ${playerIndexInTeam + 1}/${Math.min(team1.players.length, team2.players.length)}</p>
        `;
    }
}
```

## Производительность и оптимизация

### Оптимизации
1. **Кэширование DOM элементов**: Сохранение ссылок на часто используемые элементы
2. **Минимизация перерисовок**: Обновление только изменяемых частей UI
3. **Эффективная фильтрация**: Использование Set для быстрого поиска использованных слов
4. **Ленивая загрузка**: Загрузка слов только при необходимости

### Мониторинг производительности
```javascript
// Измерение времени выполнения критических операций
const startTime = performance.now();
// ... выполнение операции
const endTime = performance.now();
console.log(`Операция заняла ${endTime - startTime} мс`);
```

## Безопасность

### Валидация входных данных
```javascript
function validateTeamName(name) {
    return name.trim().length > 0 && name.length <= 50;
}

function validatePlayerName(name) {
    return name.trim().length > 0 && name.length <= 30;
}

function sanitizeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}
```

### Защита от XSS
```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

## Тестирование

### Критические сценарии
1. **Матчи 1×1**: Проверка корректного завершения
2. **Неравные команды**: 3×2, 2×1 и т.д.
3. **Турнирная сетка**: Правильное продвижение победителей
4. **Пользовательские пакеты**: Предотвращение повторений
5. **Сохранение/загрузка**: Корректность данных

### Отладочные функции
```javascript
function debugTournamentState() {
    console.log('Tournament State:', {
        isTournamentMode: tournamentState.isTournamentMode,
        currentMatch: tournamentState.currentMatch,
        currentTeamIndex: tournamentState.currentTeamIndex,
        currentPlayerIndex: tournamentState.currentPlayerIndex,
        matchScores: tournamentState.matchScores,
        matches: tournamentState.matches
    });
}

function debugGameState() {
    console.log('Game State:', {
        isPlaying: gameState.isPlaying,
        score: gameState.score,
        currentWord: gameState.currentWord,
        correctWords: gameState.correctWords.length,
        skippedWords: gameState.skippedWordsList.length
    });
}
```
