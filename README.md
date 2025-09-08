# Alias Game - Документация по логике работы

## Обзор игры

Alias - это игра в слова, где игроки объясняют слова своей команде за ограниченное время. Игра поддерживает как обычный режим, так и турнирный режим с несколькими командами.

## Основные режимы игры

### 1. Обычная игра
- Один ведущий объясняет слова команде (стандартный режим)
- Настраиваемое время раунда (30–120 сек)
- Настраиваемое количество слов (10–50)
- Выбор категории слов (для встроенной базы)
- Источник слов: встроенная база или пользовательский пакет `.txt`

### 2. Турнирный режим
- До 8 команд, произвольное число игроков в команде
- Используются глобальные настройки времени/количества слов и источник слов
- Два режима игры:
  - **Sequential (Последовательный)**: сначала все игроки команды 1, затем все игроки команды 2
  - **Alternating (Чередующийся)**: игроки команд ходят по очереди (К1-И1, К2-И1, К1-И2, К2-И2, ...), количество ходов ограничено минимальным числом игроков
- Поддерживается овертайм (доп.раунд) в случае ничьей: по одному случайному игроку от каждой команды

### 3. Соревновательный режим (каждый сам за себя)
- Список игроков без команд, играют по очереди
- Перед началом раунда у игрока есть 3 секунды подготовки
- Таблица очков обновляется после каждого раунда

## Архитектура и состояние игры

### Основные объекты состояния

#### `gameState` - состояние текущей игры
```javascript
{
    isPlaying: boolean,
    isPaused: boolean,
    currentWordIndex: number,
    correctAnswers: number,
    skippedWords: number,
    totalWords: number,
    timeLimit: number,
    timeRemaining: number,
    words: string[],
    category: string,
    startTime: number,
    timerInterval: number | null,
    score: number,
    correctWords: string[],
    skippedWordsList: string[]
}
```

#### `tournamentState` - состояние турнира
```javascript
{
    isTournamentMode: boolean,
    teams: { name: string, players: string[] }[],
    matches: { round: number, team1: number|{from:number}, team2: number|{from:number}, winner: number|null }[],
    currentRound: number,
    currentMatch: number,
    currentTeamIndex: number,
    currentPlayerIndex: number,
    matchScores: number[],
    tournamentScores: number[],
    maxRounds: number,
    gameMode: 'sequential' | 'alternating',
    currentMatchPlayerResults: Array<{ teamIndex:number, teamName:string, playerIndex:number, playerName:string, score:number, correctWords:string[], skippedWords:string[] }>,
    isOvertime: boolean,
    overtimePlayers: Array<{ teamIndex:number, teamId:number, playerIndex:number, playerName:string }>
}
```

#### `settings` - настройки игры
```javascript
{
    gameTime: number,      // Лимит времени (сек)
    wordsCount: number,    // Количество слов
    category: string,      // Категория встроенных слов
    wordSource: 'builtin' | 'custom' // Источник слов
}
```

## Логика турнирного режима

### Структура матчей
Матчи хранятся в `tournamentState.matches`:
```javascript
{
    round: number,              // Номер раунда
    team1: number | {from: number},  // Команда 1 (индекс или ссылка на победителя)
    team2: number | {from: number},  // Команда 2 (индекс или ссылка на победителя)
    winner: number | null       // Победитель (индекс команды)
}
```

### Разрешение команд
Функция `getResolvedTeamIds(match)` разрешает ссылки на команды:
- Если `team1/team2` - число → возвращает как есть
- Если `team1/team2` - объект `{from: matchIndex}` → находит победителя этого матча

### Режимы игры в турнире

#### Sequential (Последовательный)
1. Все игроки команды 1 играют по очереди
2. Затем все игроки команды 2 играют по очереди
3. Матч завершается после последнего игрока команды 2

#### Alternating (Чередующийся)
1. Игроки команд ходят по очереди: К1-И1, К2-И1, К1-И2, К2-И2, ...
2. Количество ходов = min(числа игроков в командах) × 2
3. При равном счете запускается овертайм (по одному игроку с каждой стороны)

### Турнирная сетка
- Если команд ≤ 3: играют все против всех
- Если команд > 3: создается турнирная сетка
- Победители матчей автоматически продвигаются в следующие раунды

## Управление словами

### Источники слов
1. **Встроенная база** (`WORDS_DATABASE`): категории из `words.js`
2. **Пользовательский пакет**: загружается из файла `.txt`

### Предотвращение повторений в пользовательских пакетах
```javascript
let CUSTOM_WORDS_META = { fileName: null, usedCount: 0, total: 0 };
let CUSTOM_WORDS_USED = new Set(); // Использованные слова (сохраняются в localStorage)
```

### Функция `getWordsForCurrentSource()`
- Для custom-пакета отфильтровывает уже использованные слова
- Возвращает случайные неиспользованные слова
- Не помечает их использованными (пометка происходит после игры)

### Функция `markWordsAsUsed()`
- Вызывается после завершения игры
- Добавляет только показанные игроку слова (до `currentWordIndex`) в `CUSTOM_WORDS_USED`
- Сохраняет состояние в localStorage и обновляет баннер в главном меню

## Ключевые функции

### Игровой цикл
- `startGame()` - начало игры
- `endGame()` - завершение игры (проверяет турнирный режим)
- `endTournamentGame()` - завершение в турнирном режиме
- `endPlayerGame()` - завершение хода игрока в турнире

### Турнирные функции
- `startTournament()`, `generateTournamentBracket()`, `startTournamentMatch()`, `endMatch()`, `isMatchComplete()`, `startOvertime()`, `updateMatchScore()`, `exportMatchResults()`, `continueTournament()`, `endTournament()`

### Управление состоянием
- `updateCurrentPlayerInfo()` - обновление информации о текущем игроке
- `showScreen(screenName)` - переключение экранов
- `saveSettings()` / `loadSettings()` - сохранение/загрузка настроек

## Особенности реализации

### Обработка матчей победителей
В финальных матчах команды определяются как `{from: matchIndex}`. Функция `getResolvedTeamIds()` разрешает эти ссылки, находя реальных победителей предыдущих матчей.

### Сохранение результатов игроков
В `tournamentState.currentMatchPlayerResults` сохраняются детальные результаты каждого игрока:
```javascript
{
    teamIndex: number,
    teamName: string,
    playerIndex: number,
    playerName: string,
    score: number,
    correctWords: Array,
    skippedWords: Array
}
```

### Экспорт результатов
`exportMatchResults()` формирует `.txt` с итоговым счетом и разбивкой по игрокам (верные/пропущенные слова).

### Информационная панель
`updateMainInfoBanner()` показывает режим (стандартный/пользовательский) и остаток слов в пользовательском пакете.

## Локальное хранилище

### Ключи localStorage
- `alias-settings` - настройки игры
- `alias-history` - история игр
- `alias-custom-words` - пользовательские слова
- `alias-custom-words-meta` - метаданные пакета
- `alias-custom-words-used` - использованные слова


## Важные моменты

1. **Завершение матчей**: Матч завершается только после того, как все игроки обеих команд сыграли
2. **Счет команд**: Очки начисляются команде, а не отдельному игроку
3. **Время игры**: В турнире используется глобальное время из настроек
4. **Категории**: В турнире используются глобальные настройки категории
5. **Повторения слов**: В пользовательских пакетах слова не повторяются до смены пакета. Встроенные слова могут повторяться между играми

## Отладка

### Частые проблемы
1. **Раннее завершение матчей**: Проверить логику в `isMatchComplete()`
2. **Неправильный счет**: Проверить `teamIndex` в `endPlayerGame()`
3. **Проблемы с командами**: Проверить `getResolvedTeamIds()`
4. **Повторения слов**: Проверить `CUSTOM_WORDS_USED` и `getWordsForCurrentSource()`

### Логирование
Добавить `console.log()` в ключевые функции для отладки:
- `endPlayerGame()` - для отслеживания переходов между игроками
- `isMatchComplete()` - для проверки логики завершения
- `getResolvedTeamIds()` - для проверки разрешения команд
