// Турнирная система для игры Alias

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
    currentMatchPlayerResults: [] // результаты по игрокам текущего матча
};

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
    
    if (tournamentState.gameMode === 'sequential') {
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
    
    // Определяем, какой команде принадлежит текущий игрок
    let teamIndex;
    let playerIndexInTeam;
    if (tournamentState.gameMode === 'sequential') {
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
        const teamId = teamIndex === 0 ? currentMatch.team1 : currentMatch.team2;
        const team = tournamentState.teams[teamId];
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
    if (tournamentState.gameMode === 'sequential') {
        // Режим 1: Сначала все игроки одной команды, затем другой
        const team1 = tournamentState.teams[currentMatch.team1];
        const team2 = tournamentState.teams[currentMatch.team2];
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
        const team1 = tournamentState.teams[currentMatch.team1];
        const team2 = tournamentState.teams[currentMatch.team2];
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
    const team1 = tournamentState.teams[currentMatch.team1];
    const team2 = tournamentState.teams[currentMatch.team2];
    
    if (tournamentState.gameMode === 'sequential') {
        // В последовательном режиме считаем завершение так:
        // - Команда 1 завершена, если мы уже перешли к команде 2
        // - Команда 2 завершена, только когда текущий индекс игрока дошел до последнего игрока команды 2
        const team1Completed = tournamentState.currentTeamIndex > 0;
        const team2Completed = tournamentState.currentTeamIndex === 1 && 
            tournamentState.currentPlayerIndex >= team2.players.length - 1;
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
    
    // Определяем победителя
    if (team1Score > team2Score) {
        // winner — это индекс команды из общего списка
        const { team1Id } = getResolvedTeamIds(currentMatch);
        currentMatch.winner = team1Id;
    } else if (team2Score > team1Score) {
        const { team2Id } = getResolvedTeamIds(currentMatch);
        currentMatch.winner = team2Id;
    } else {
        // Ничья - случайный победитель
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

// Глобальные функции для HTML
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
