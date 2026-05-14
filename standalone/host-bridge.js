/**
 * Синхронизация окна ведущего с display.html через BroadcastChannel.
 * Работает только в браузере; интернет не нужен.
 */
(function () {
    var CHANNEL = 'alias-standalone-v1';
    var LS_KEY = 'alias-standalone-sync-v1';
    var bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    var msgSeq = 0;

    function safeText(el) {
        if (!el) return '';
        return String(el.textContent || '').trim();
    }

    function wordItemsFromList(listId) {
        var el = document.getElementById(listId);
        if (!el) return [];
        var nodes = el.querySelectorAll('.word-item');
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
            var t = safeText(nodes[i]);
            if (t) out.push(t);
        }
        return out;
    }

    function scrapeMatchHeader() {
        var mr = document.getElementById('match-result');
        if (!mr) return null;
        var teams = mr.querySelectorAll('.match-result .team-result');
        if (teams.length < 2) return null;
        return {
            team1Name: safeText(teams[0].querySelector('.team-name')),
            team1Score: safeText(teams[0].querySelector('.team-score')),
            team2Name: safeText(teams[1].querySelector('.team-name')),
            team2Score: safeText(teams[1].querySelector('.team-score')),
            winnerLine: safeText(mr.querySelector('.winner h4'))
        };
    }

    function scrapeMatchBreakdown() {
        var root = document.getElementById('player-words-breakdown');
        if (!root) return [];
        var sections = [];
        var tb = root.querySelector('.teams-breakdown');
        if (!tb) return [];
        tb.querySelectorAll('.team-breakdown').forEach(function (teamEl) {
            var teamName = safeText(teamEl.querySelector('h4'));
            var players = [];
            teamEl.querySelectorAll('.player-block').forEach(function (pb) {
                var header = safeText(pb.querySelector('.player-header'));
                var correctWords = [];
                var skippedWords = [];
                pb.querySelectorAll('.words-sub').forEach(function (sub) {
                    var title = safeText(sub.querySelector('.words-sub-title'));
                    var words = [];
                    sub.querySelectorAll('.word-item').forEach(function (n) {
                        var w = safeText(n);
                        if (w) words.push(w);
                    });
                    if (/Отгаданные/i.test(title)) correctWords = words;
                    else if (/Пропущенные/i.test(title)) skippedWords = words;
                });
                players.push({ header: header, correctWords: correctWords, skippedWords: skippedWords });
            });
            sections.push({ teamName: teamName, players: players });
        });
        return sections;
    }

    function scrapeFlexibleRoundSummary() {
        var root = document.getElementById('flexible-round-summary');
        if (!root) return { columnHeaders: [], rows: [], footnote: '' };
        var grid = root.querySelector('.ft-summary-grid--by-players');
        if (grid) {
            var columnHeaders = [];
            var head = grid.querySelector('.ft-summary-head');
            if (head) {
                head.querySelectorAll('.ft-summary-h-player').forEach(function (h) {
                    columnHeaders.push(safeText(h));
                });
            }
            var rows = [];
            grid.querySelectorAll('.ft-summary-body .ft-summary-row').forEach(function (row) {
                var teamEl = row.querySelector('.ft-summary-team');
                var pcells = row.querySelectorAll('.ft-summary-pcell');
                var rt = row.querySelector('.ft-summary-round-total');
                var tt = row.querySelector('.ft-summary-tourney-total');
                rows.push({
                    team: teamEl ? safeText(teamEl) : '',
                    cells: Array.from(pcells).map(function (c) {
                        return safeText(c);
                    }),
                    roundTotal: rt ? safeText(rt) : '',
                    tournamentTotal: tt ? safeText(tt) : ''
                });
            });
            var foot = root.querySelector('.ft-summary-footnote');
            return {
                columnHeaders: columnHeaders,
                rows: rows,
                footnote: foot ? safeText(foot) : ''
            };
        }
        var rowsLegacy = [];
        root.querySelectorAll('.ft-summary-body .ft-summary-row').forEach(function (row) {
            var teamEl = row.querySelector('.ft-summary-team');
            var nums = row.querySelectorAll('.ft-summary-num');
            rowsLegacy.push({
                team: teamEl ? safeText(teamEl) : '',
                round: nums[0] ? safeText(nums[0]) : '',
                total: nums[1] ? safeText(nums[1]) : ''
            });
        });
        var footL = root.querySelector('.ft-summary-footnote');
        return {
            columnHeaders: [],
            rows: rowsLegacy,
            footnote: footL ? safeText(footL) : ''
        };
    }

    function buildMatchResultsPayload() {
        var head = scrapeMatchHeader();
        var breakdown = scrapeMatchBreakdown();
        var nextTxt = safeText(document.getElementById('next-match-announcement'));
        if (!head && !breakdown.length && !nextTxt) {
            return {
                variant: 'generic',
                title: 'Результаты матча',
                body:
                    safeText(document.getElementById('match-result')) +
                    '\n\n' +
                    safeText(document.getElementById('player-words-breakdown'))
            };
        }
        return {
            variant: 'match',
            title: 'Результаты матча',
            team1Name: head ? head.team1Name : '',
            team1Score: head ? head.team1Score : '',
            team2Name: head ? head.team2Name : '',
            team2Score: head ? head.team2Score : '',
            winnerLine: head ? head.winnerLine : '',
            nextMatchText: nextTxt,
            breakdown: breakdown
        };
    }

    function scrapeCompetitiveHall() {
        var list = document.getElementById('competitive-players-list');
        if (!list) return null;
        var rowNodes = list.querySelectorAll('.competitive-player-row');
        if (!rowNodes.length) return { players: [], currentPlayerName: '' };
        var players = [];
        var currentPlayerName = '';
        for (var i = 0; i < rowNodes.length; i++) {
            var row = rowNodes[i];
            var name = safeText(row.querySelector('.competitive-player-name'));
            var score = safeText(row.querySelector('.competitive-player-score'));
            players.push({ name: name, score: score });
            if (row.classList && row.classList.contains('active')) {
                currentPlayerName = name;
            }
        }
        return { players: players, currentPlayerName: currentPlayerName };
    }

    function scrapeCompetitiveFinalResults() {
        var list = document.getElementById('competitive-results-list');
        if (!list) return [];
        var rows = [];
        list.querySelectorAll('.competitive-results-row').forEach(function (row) {
            var spans = row.querySelectorAll('span');
            if (spans.length >= 2) {
                rows.push({ name: safeText(spans[0]), score: safeText(spans[1]) });
            }
        });
        return rows;
    }

    function scrapeFlexibleCallTeams() {
        var root = document.getElementById('ft-call-teams');
        if (!root) return [];
        var out = [];
        root.querySelectorAll('.ft-call-card').forEach(function (card) {
            var h = card.querySelector('h3');
            var p = card.querySelector('p');
            var name = safeText(h);
            if (!name) return;
            out.push({ name: name, players: safeText(p) });
        });
        return out;
    }

    function scrapeFlexibleMatchScores() {
        var root = document.getElementById('ft-match-info');
        if (!root) return [];
        var out = [];
        root.querySelectorAll('.ft-score-pill').forEach(function (pill) {
            var strong = pill.querySelector('strong');
            var score = strong ? safeText(strong) : '0';
            var clone = pill.cloneNode(true);
            var st = clone.querySelector('strong');
            if (st) st.remove();
            var name = safeText(clone);
            if (name) out.push({ name: name, score: score });
        });
        return out;
    }

    function flexibleMatchPlayerBlock() {
        var el = document.getElementById('ft-current-player-info');
        if (!el) return '';
        return String(el.innerText || el.textContent || '').trim();
    }

    function buildResultsPayload(screenId) {
        if (screenId === 'results') {
            return {
                variant: 'round',
                title: 'Результаты раунда',
                finalScore: safeText(document.getElementById('final-score')),
                correct: safeText(document.getElementById('correct-answers')),
                skipped: safeText(document.getElementById('skipped-words')),
                duration: safeText(document.getElementById('game-time-result')),
                category: safeText(document.getElementById('game-category-result')),
                correctWords: wordItemsFromList('correct-words-list'),
                skippedWords: wordItemsFromList('skipped-words-list')
            };
        }
        if (screenId === 'match-results') {
            return buildMatchResultsPayload();
        }
        if (screenId === 'tournament-results') {
            return {
                variant: 'generic',
                title: 'Победитель турнира',
                body: safeText(document.getElementById('tournament-winner'))
            };
        }
        if (screenId === 'competitive-results') {
            var crow = scrapeCompetitiveFinalResults();
            if (crow.length) {
                return {
                    variant: 'competitive',
                    title: 'Итоги игры',
                    subtitle: 'Соревновательный режим',
                    rows: crow
                };
            }
            return {
                variant: 'generic',
                title: 'Итоги',
                body: safeText(document.getElementById('competitive-results-list'))
            };
        }
        if (screenId === 'flexible-round-results') {
            var fs = scrapeFlexibleRoundSummary();
            if (fs.rows.length) {
                return {
                    variant: 'flexible-round',
                    title: 'Итоги раунда',
                    columnHeaders: fs.columnHeaders || [],
                    rows: fs.rows,
                    footnote: fs.footnote
                };
            }
            return {
                variant: 'generic',
                title: 'Итоги раунда',
                body: safeText(document.getElementById('flexible-round-summary'))
            };
        }
        return null;
    }

    function buildState(flash) {
        var wordEl = document.getElementById('current-word');
        var prep = document.getElementById('competitive-prep');
        var active = document.querySelector('.screen.active');
        var screenId = active ? active.id : '';
        var gs = typeof gameState !== 'undefined' ? gameState : null;

        /* Пустая строка снимает inline display:none — элемент виден по CSS (flex). Раньше требовали display !== '', из‑за чего зал никогда не видел фазу prep. */
        var prepVisible = !!(prep && prep.style.display !== 'none');
        var phase = 'idle';
        var results = null;
        var tournamentBoard = null;

        if (
            screenId === 'results' ||
            screenId === 'match-results' ||
            screenId === 'tournament-results' ||
            screenId === 'competitive-results' ||
            screenId === 'flexible-round-results'
        ) {
            phase = 'results';
            results = buildResultsPayload(screenId);
        } else if (screenId === 'pause-screen') {
            phase = 'paused';
        } else if (screenId === 'tournament-match') {
            phase = 'tournament-wait';
            tournamentBoard = {
                boardTitle: 'Турнир',
                matchInfo: safeText(document.getElementById('match-info')),
                playerInfo: safeText(document.getElementById('current-player-info'))
            };
        } else if (screenId === 'flexible-tournament-call') {
            phase = 'flexible-call';
            tournamentBoard = {
                boardTitle: 'Гибкий турнир',
                hallMode: 'flexible-call',
                roundTitle: 'Раунд',
                roundSubtitle: 'На экране зала отображаются команды этого раунда.',
                callTeams: scrapeFlexibleCallTeams(),
                matchInfo: '',
                playerInfo: ''
            };
        } else if (screenId === 'flexible-tournament-match') {
            phase = 'tournament-wait';
            var ftTurnBoard = typeof getFlexibleCurrentTurn === 'function' ? getFlexibleCurrentTurn() : null;
            var ftsBoard = typeof flexibleTournamentState !== 'undefined' ? flexibleTournamentState : null;
            var ftRoundDone = false;
            if (ftsBoard && ftsBoard.roundTeamIndices && ftsBoard.roundTeamIndices.length && typeof getFlexibleRoundTotalTurns === 'function') {
                var totTurns = getFlexibleRoundTotalTurns();
                if (totTurns > 0 && (ftsBoard.flexibleTurnIndex || 0) >= totTurns) {
                    ftRoundDone = true;
                }
            }
            tournamentBoard = {
                boardTitle: 'Гибкий турнир',
                hallMode: 'flexible-match',
                matchScores: scrapeFlexibleMatchScores(),
                playerInfo: flexibleMatchPlayerBlock(),
                matchInfo: safeText(document.getElementById('ft-match-info')),
                flexibleNextTeam: ftTurnBoard && ftTurnBoard.team ? ftTurnBoard.team.name : '',
                flexibleNextPlayer: ftTurnBoard ? ftTurnBoard.playerName : '',
                flexibleRoundComplete: ftRoundDone
            };
        } else if (screenId === 'game-screen') {
            if (prepVisible) phase = 'prep';
            else if (gs && gs.isPaused) phase = 'paused';
            else if (gs && gs.isPlaying) phase = 'playing';
            else phase = 'lobby';
        }

        var progress = 100;
        if (gs && gs.timeLimit > 0) progress = (gs.timeRemaining / gs.timeLimit) * 100;

        var competitiveHall = null;
        var flexibleExplainer = null;
        if (screenId === 'game-screen') {
            var sbEl = document.getElementById('competitive-scoreboard');
            var sbVis = !!(sbEl && sbEl.style.display !== 'none');
            if (sbVis) {
                var hall = scrapeCompetitiveHall();
                if (hall && hall.players.length) {
                    competitiveHall = hall;
                }
            }
            try {
                var ftsEx = typeof flexibleTournamentState !== 'undefined' ? flexibleTournamentState : null;
                if (ftsEx && ftsEx.isFlexibleMode && ftsEx.roundTeamIndices && ftsEx.roundTeamIndices.length) {
                    if (typeof getFlexibleCurrentTurn === 'function') {
                        var ftEx = getFlexibleCurrentTurn();
                        if (ftEx && ftEx.team && ftEx.playerName) {
                            flexibleExplainer = { teamName: ftEx.team.name, playerName: ftEx.playerName };
                        }
                    }
                }
            } catch (eFlex) {}
        }

        var wordForHall = safeText(wordEl);
        var wordNumForHall = gs ? gs.currentWordIndex + 1 : 0;
        if (screenId === 'game-screen' && prepVisible) {
            wordForHall = '';
            wordNumForHall = 0;
        }

        var hallScoreboard = null;
        if (screenId === 'game-screen' && typeof buildHallScoreboardForSync === 'function') {
            hallScoreboard = buildHallScoreboardForSync();
        }

        return {
            flash: flash || null,
            state: {
                screenId: screenId,
                phase: phase,
                word: wordForHall,
                timeRemaining: gs ? gs.timeRemaining : 0,
                timeLimit: gs ? gs.timeLimit : 60,
                score: gs ? Math.round(gs.score) : 0,
                wordNumber: wordNumForHall,
                prepCountdown: safeText(document.getElementById('prep-countdown')),
                prepName: safeText(document.getElementById('prep-player-name')),
                progress: progress,
                results: results,
                tournamentBoard: tournamentBoard,
                competitiveHall: competitiveHall,
                flexibleExplainer: flexibleExplainer,
                hallScoreboard: hallScoreboard,
                skipsRemaining: gs && gs.maxSkipsAllowed > 0 ? gs.skipsRemaining : null,
                maxSkipsAllowed: gs && gs.maxSkipsAllowed > 0 ? gs.maxSkipsAllowed : null,
                awaitingCustomWordPack: !!(gs && gs.awaitingCustomWordPack)
            }
        };
    }

    function send(flash) {
        var p = buildState(flash);
        msgSeq++;
        var msg = {
            type: 'STATE',
            v: 1,
            flash: p.flash,
            state: p.state,
            _ts: Date.now(),
            _seq: msgSeq
        };
        if (bc) {
            try {
                bc.postMessage(msg);
            } catch (e) {}
        }
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(msg));
        } catch (e) {}
        var dw = window.__aliasStandaloneDisplayWindow;
        if (dw && !dw.closed) {
            try {
                dw.postMessage(msg, '*');
            } catch (e2) {}
        }
    }

    /** Окно зала, открытое с этого же host (нужно для file:// — BroadcastChannel между двумя файлами не работает). */
    window.__aliasStandaloneOpenHallWindow = function () {
        try {
            var w = window.open('display.html', 'aliasStandaloneHall', 'width=1280,height=720');
            if (w) {
                window.__aliasStandaloneDisplayWindow = w;
                setTimeout(function () {
                    send(null);
                }, 150);
                setTimeout(function () {
                    send(null);
                }, 500);
            }
        } catch (e) {}
    };

    window.__aliasStandaloneHostPush = function (flash) {
        send(flash || null);
    };

    function wrapPost(name) {
        var orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
            var ret = orig.apply(this, arguments);
            send(null);
            return ret;
        };
    }

    wrapPost('pauseGame');
    wrapPost('resumeGame');

    var origCorrect = window.correctAnswer;
    if (typeof origCorrect === 'function') {
        window.correctAnswer = function () {
            var ret = origCorrect.apply(this, arguments);
            send('correct');
            return ret;
        };
    }

    var origSkip = window.skipWord;
    if (typeof origSkip === 'function') {
        window.skipWord = function () {
            var ret = origSkip.apply(this, arguments);
            send('skip');
            return ret;
        };
    }

    var origEndGame = window.endGame;
    if (typeof origEndGame === 'function') {
        window.endGame = function () {
            var ret = origEndGame.apply(this, arguments);
            send(null);
            return ret;
        };
    }

    var origStartGame = window.startGame;
    if (typeof origStartGame === 'function') {
        window.startGame = function () {
            var ret = origStartGame.apply(this, arguments);
            queueMicrotask(function () { send(null); });
            return ret;
        };
    }

    var origMain = window.showMainMenu;
    if (typeof origMain === 'function') {
        window.showMainMenu = function () {
            var ret = origMain.apply(this, arguments);
            send(null);
            return ret;
        };
    }

    var origNewGame = window.newGame;
    if (typeof origNewGame === 'function') {
        window.newGame = function () {
            var ret = origNewGame.apply(this, arguments);
            queueMicrotask(function () { send(null); });
            return ret;
        };
    }

    [
        'continueTournament',
        'startNextPlayer',
        'startTournament',
        'startTournamentMatch',
        'showTournamentSetup',
        'showCompetitiveSetup',
        'endTournament',
        'endCompetitiveGame',
        'showFlexibleTournamentFromMenu',
        'callFlexibleTeams',
        'showFlexibleTournamentSetupFromCall',
        'startFlexibleRoundFromCall',
        'startNextFlexiblePlayer',
        'endFlexibleRound',
        'cancelFlexibleRound',
        'flexibleAfterRoundToSetup',
        'resetFlexibleTournamentPersisted',
        'addFlexibleTeamQuick',
        'addFlexibleTeamFromForm',
        'removeFlexibleTeam',
        'startFlexibleTeamEdit',
        'cancelFlexibleTeamEdit',
        'saveFlexibleTeamEdit'
    ].forEach(wrapPost);

    window.addEventListener('load', function () {
        queueMicrotask(function () { send(null); });
    });

    window.addEventListener('beforeunload', function () {
        if (bc) try { bc.close(); } catch (e) {}
    });
})();
