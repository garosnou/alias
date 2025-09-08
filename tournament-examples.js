// Примеры использования турнирной системы

// Пример 1: Создание простого турнира с 4 командами
function createSimpleTournament() {
    // Сброс состояния
    tournamentState.teams = [];
    tournamentState.isTournamentMode = false;
    
    // Добавление команд
    addTeam("Команда А", ["Анна", "Алексей", "Андрей"]);
    addTeam("Команда Б", ["Борис", "Белла"]);
    addTeam("Команда В", ["Василий", "Вера", "Виктор", "Валентина"]);
    addTeam("Команда Г", ["Григорий", "Галина"]);
    
    // Настройка режима
    tournamentState.gameMode = 'sequential';
    
    // Начало турнира
    startTournament();
}

// Пример 2: Турнир с чередующимся режимом
function createAlternatingTournament() {
    tournamentState.teams = [];
    tournamentState.isTournamentMode = false;
    
    addTeam("Красные", ["Иван", "Ирина", "Игорь"]);
    addTeam("Синие", ["Сергей", "Светлана", "Степан"]);
    addTeam("Зеленые", ["Захар", "Зинаида"]);
    addTeam("Желтые", ["Ярослав", "Яна", "Яков"]);
    
    tournamentState.gameMode = 'alternate';
    startTournament();
}

// Пример 3: Турнир с разным количеством игроков
function createUnevenTournament() {
    tournamentState.teams = [];
    tournamentState.isTournamentMode = false;
    
    addTeam("Большая команда", ["Алиса", "Борис", "Василий", "Галина", "Дмитрий"]);
    addTeam("Средняя команда", ["Елена", "Жанна", "Зинаида"]);
    addTeam("Маленькая команда", ["Игорь", "Кристина"]);
    
    // В последовательном режиме все игроки сыграют
    tournamentState.gameMode = 'sequential';
    startTournament();
}

// Пример 4: Программное добавление команд
function addTeamsProgrammatically() {
    const teamData = [
        { name: "Команда 1", players: ["Игрок 1", "Игрок 2"] },
        { name: "Команда 2", players: ["Игрок 3", "Игрок 4", "Игрок 5"] },
        { name: "Команда 3", players: ["Игрок 6"] },
        { name: "Команда 4", players: ["Игрок 7", "Игрок 8"] }
    ];
    
    teamData.forEach(team => {
        addTeam(team.name, team.players);
    });
}

// Пример 5: Получение информации о турнире
function getTournamentInfo() {
    return {
        totalTeams: tournamentState.teams.length,
        totalMatches: tournamentState.matches.length,
        currentMatch: tournamentState.currentMatch,
        gameMode: tournamentState.gameMode,
        isActive: tournamentState.isTournamentMode,
        teams: tournamentState.teams.map(team => ({
            name: team.name,
            playerCount: team.players.length,
            players: team.players
        }))
    };
}

// Пример 6: Проверка готовности к турниру
function isTournamentReady() {
    const info = getTournamentInfo();
    
    if (info.totalTeams < 2) {
        return { ready: false, reason: "Необходимо минимум 2 команды" };
    }
    
    if (info.totalTeams > 8) {
        return { ready: false, reason: "Максимум 8 команд" };
    }
    
    const hasEmptyTeams = info.teams.some(team => team.playerCount === 0);
    if (hasEmptyTeams) {
        return { ready: false, reason: "Все команды должны иметь игроков" };
    }
    
    return { ready: true, reason: "Турнир готов к началу" };
}

// Пример 7: Создание турнирной сетки вручную
function createCustomBracket() {
    tournamentState.matches = [
        // Первый раунд
        { round: 1, team1: 0, team2: 1, winner: null },
        { round: 1, team1: 2, team2: 3, winner: null },
        { round: 1, team1: 4, team2: 5, winner: null },
        { round: 1, team1: 6, team2: 7, winner: null },
        
        // Второй раунд (полуфинал)
        { round: 2, team1: { from: 0 }, team2: { from: 1 }, winner: null },
        { round: 2, team1: { from: 2 }, team2: { from: 3 }, winner: null },
        
        // Финал
        { round: 3, team1: { from: 4 }, team2: { from: 5 }, winner: null }
    ];
}

// Пример 8: Экспорт всей турнирной статистики
function exportTournamentStats() {
    const stats = {
        tournamentInfo: getTournamentInfo(),
        matchResults: tournamentState.matches.map((match, index) => {
            const { team1Id, team2Id } = getResolvedTeamIds(match);
            return {
                matchNumber: index + 1,
                round: match.round,
                team1: team1Id != null ? tournamentState.teams[team1Id].name : 'TBD',
                team2: team2Id != null ? tournamentState.teams[team2Id].name : 'TBD',
                winner: match.winner != null ? tournamentState.teams[match.winner].name : null
            };
        }),
        playerResults: tournamentState.currentMatchPlayerResults
    };
    
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Пример 9: Валидация команд
function validateTeams() {
    const errors = [];
    
    tournamentState.teams.forEach((team, index) => {
        if (!team.name || team.name.trim() === '') {
            errors.push(`Команда ${index + 1}: отсутствует название`);
        }
        
        if (!team.players || team.players.length === 0) {
            errors.push(`Команда ${index + 1}: отсутствуют игроки`);
        }
        
        const duplicatePlayers = team.players.filter((player, playerIndex) => 
            team.players.indexOf(player) !== playerIndex
        );
        
        if (duplicatePlayers.length > 0) {
            errors.push(`Команда ${index + 1}: дублирующиеся игроки: ${duplicatePlayers.join(', ')}`);
        }
    });
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// Пример 10: Сброс турнира
function resetTournament() {
    tournamentState = {
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
        gameMode: 'sequential',
        currentMatchPlayerResults: []
    };
    
    // Обновляем UI
    updateTeamsList();
    updateStartTournamentButton();
    showScreen('tournament-setup');
}

// Экспорт функций для использования
window.createSimpleTournament = createSimpleTournament;
window.createAlternatingTournament = createAlternatingTournament;
window.createUnevenTournament = createUnevenTournament;
window.addTeamsProgrammatically = addTeamsProgrammatically;
window.getTournamentInfo = getTournamentInfo;
window.isTournamentReady = isTournamentReady;
window.createCustomBracket = createCustomBracket;
window.exportTournamentStats = exportTournamentStats;
window.validateTeams = validateTeams;
window.resetTournament = resetTournament;
