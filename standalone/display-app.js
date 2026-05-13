(function () {
    var CHANNEL = 'alias-standalone-v1';
    var bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

    var flashEl = document.getElementById('display-flash');
    var idleEl = document.getElementById('display-idle');
    var prepEl = document.getElementById('display-prep');
    var prepNameEl = document.getElementById('display-prep-name');
    var prepCountEl = document.getElementById('display-prep-count');
    var gameEl = document.getElementById('display-game');
    var pausedEl = document.getElementById('display-paused');
    var wordEl = document.getElementById('display-word');
    var timerEl = document.getElementById('display-timer');
    var timerRow = document.querySelector('.display-timer-row');
    var progressFill = document.getElementById('display-progress-fill');
    var metaEl = document.getElementById('display-meta');
    var hallDock = document.getElementById('display-hall-scoreboard');

    var resultsEl = document.getElementById('display-results');
    var resultsTitle = document.getElementById('display-results-title');
    var resultsRound = document.getElementById('display-results-round');
    var resultsGeneric = document.getElementById('display-results-generic');
    var drFinal = document.getElementById('dr-final');
    var drCorrectN = document.getElementById('dr-correct-n');
    var drSkippedN = document.getElementById('dr-skipped-n');
    var resultsMeta = document.getElementById('display-results-meta');
    var drCorrect = document.getElementById('dr-correct');
    var drSkipped = document.getElementById('dr-skipped');
    var resultsBody = document.getElementById('display-results-body');

    var displayTournamentWait = document.getElementById('display-tournament-wait');
    var displayTwMatch = document.getElementById('display-tw-match');
    var displayTwPlayer = document.getElementById('display-tw-player');

    var flashTimer = null;

    function clearFlashClass() {
        if (!flashEl) return;
        flashEl.classList.remove('flash-correct', 'flash-skip');
    }

    function triggerFlash(kind) {
        if (!flashEl) return;
        clearTimeout(flashTimer);
        clearFlashClass();
        if (kind !== 'correct' && kind !== 'skip') return;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (!flashEl) return;
                if (kind === 'correct') flashEl.classList.add('flash-correct');
                else flashEl.classList.add('flash-skip');
                flashTimer = setTimeout(function () {
                    clearFlashClass();
                }, 480);
            });
        });
    }

    function fillWordTags(container, words, tagClass) {
        if (!container) return;
        container.textContent = '';
        (words || []).forEach(function (w) {
            var s = document.createElement('span');
            s.className = 'tag' + (tagClass ? ' ' + tagClass : '');
            s.textContent = w;
            container.appendChild(s);
        });
    }

    function renderMatchResults(r) {
        var drm = document.getElementById('display-results-match');
        if (!drm) return;
        drm.classList.remove('hidden');
        var t1n = document.getElementById('drm-t1n');
        var t1s = document.getElementById('drm-t1s');
        var t2n = document.getElementById('drm-t2n');
        var t2s = document.getElementById('drm-t2s');
        if (t1n) t1n.textContent = r.team1Name || '';
        if (t1s) t1s.textContent = r.team1Score != null && r.team1Score !== '' ? String(r.team1Score) : '';
        if (t2n) t2n.textContent = r.team2Name || '';
        if (t2s) t2s.textContent = r.team2Score != null && r.team2Score !== '' ? String(r.team2Score) : '';
        var winEl = document.getElementById('drm-winner');
        if (winEl) winEl.textContent = r.winnerLine || '';
        var nw = document.getElementById('drm-next-wrap');
        var nt = document.getElementById('drm-next');
        if (nw && nt) {
            if (r.nextMatchText) {
                nt.textContent = r.nextMatchText;
                nw.classList.remove('hidden');
            } else {
                nw.classList.add('hidden');
            }
        }
        var bd = document.getElementById('drm-breakdown');
        if (!bd) return;
        bd.textContent = '';
        (r.breakdown || []).forEach(function (sec) {
            var secEl = document.createElement('section');
            secEl.className = 'drm-sec';
            var h = document.createElement('h3');
            h.className = 'drm-sec-title';
            h.textContent = sec.teamName || '';
            secEl.appendChild(h);
            (sec.players || []).forEach(function (pl) {
                var card = document.createElement('div');
                card.className = 'drm-player';
                var hd = document.createElement('div');
                hd.className = 'drm-player-h';
                hd.textContent = pl.header || '';
                card.appendChild(hd);
                function addSub(title, words, cls) {
                    var sub = document.createElement('div');
                    sub.className = 'drm-sub';
                    var lt = document.createElement('div');
                    lt.className = 'drm-sub-t';
                    lt.textContent = title + ' (' + (words || []).length + ')';
                    sub.appendChild(lt);
                    var tgc = document.createElement('div');
                    tgc.className = 'display-word-tags drm-tags';
                    sub.appendChild(tgc);
                    fillWordTags(tgc, words || [], cls);
                    card.appendChild(sub);
                }
                addSub('Отгаданные', pl.correctWords, '');
                addSub('Пропущенные', pl.skippedWords, 'skipped');
                secEl.appendChild(card);
            });
            bd.appendChild(secEl);
        });
    }

    function renderCompetitiveResults(r) {
        var root = document.getElementById('display-results-competitive');
        if (!root) return;
        root.classList.remove('hidden');
        var sub = document.getElementById('drc-subtitle');
        if (sub) sub.textContent = r.subtitle || 'Соревновательный режим';
        var list = document.getElementById('drc-list');
        if (!list) return;
        list.textContent = '';
        (r.rows || []).forEach(function (row, idx) {
            var rank = idx + 1;
            var wrap = document.createElement('div');
            var cls = 'drc-row';
            if (rank === 1) cls += ' drc-row-first';
            else if (rank === 2) cls += ' drc-row-second';
            else if (rank === 3) cls += ' drc-row-third';
            wrap.className = cls;

            var rk = document.createElement('div');
            rk.className = 'drc-rank';
            rk.textContent = String(rank);
            if (rank === 1) rk.classList.add('drc-rank-gold');
            else if (rank === 2) rk.classList.add('drc-rank-silver');
            else if (rank === 3) rk.classList.add('drc-rank-bronze');
            else rk.classList.add('drc-rank-num');

            var info = document.createElement('div');
            info.className = 'drc-info';
            var nm = document.createElement('div');
            nm.className = 'drc-name';
            nm.textContent = row.name || '';
            info.appendChild(nm);

            var sc = document.createElement('div');
            sc.className = 'drc-score';
            sc.textContent = row.score != null && row.score !== '' ? String(row.score) : '0';

            wrap.appendChild(rk);
            wrap.appendChild(info);
            wrap.appendChild(sc);
            list.appendChild(wrap);
        });
    }

    function renderFlexibleRoundResults(r) {
        var root = document.getElementById('display-results-flexible-round');
        if (!root) return;
        root.classList.remove('hidden');
        var grid = document.getElementById('display-fr-grid');
        var foot = document.getElementById('display-fr-footnote');
        if (grid) {
            grid.textContent = '';
            var headRow = document.createElement('div');
            headRow.className = 'display-fr-head';
            ['Команда', 'Раунд', 'Всего'].forEach(function (label) {
                var c = document.createElement('div');
                c.className = 'display-fr-h';
                c.textContent = label;
                headRow.appendChild(c);
            });
            grid.appendChild(headRow);
            (r.rows || []).forEach(function (row) {
                var rowEl = document.createElement('div');
                rowEl.className = 'display-fr-row';
                var t1 = document.createElement('div');
                t1.className = 'display-fr-cell display-fr-team';
                t1.textContent = row.team || '';
                var t2 = document.createElement('div');
                t2.className = 'display-fr-cell display-fr-num';
                t2.textContent = row.round != null && row.round !== '' ? String(row.round) : '';
                var t3 = document.createElement('div');
                t3.className = 'display-fr-cell display-fr-num display-fr-total';
                t3.textContent = row.total != null && row.total !== '' ? String(row.total) : '';
                rowEl.appendChild(t1);
                rowEl.appendChild(t2);
                rowEl.appendChild(t3);
                grid.appendChild(rowEl);
            });
        }
        if (foot) {
            foot.textContent = r.footnote || '';
            foot.classList.toggle('hidden', !r.footnote);
        }
    }

    function renderTournamentHall(twBoard) {
        var kickerEl = displayTournamentWait ? displayTournamentWait.querySelector('.display-tournament-kicker') : null;
        if (kickerEl) kickerEl.textContent = twBoard.boardTitle || 'Турнир';

        var classicWrap = document.getElementById('display-tw-classic');
        var ftCallWrap = document.getElementById('display-ft-call-wrap');
        var ftMatchWrap = document.getElementById('display-ft-match-wrap');

        if (twBoard.hallMode === 'flexible-call' && twBoard.callTeams && twBoard.callTeams.length) {
            if (classicWrap) classicWrap.classList.add('hidden');
            if (ftMatchWrap) ftMatchWrap.classList.add('hidden');
            if (ftCallWrap) {
                ftCallWrap.classList.remove('hidden');
                var tEl = document.getElementById('display-ft-call-title');
                var sEl = document.getElementById('display-ft-call-sub');
                if (tEl) tEl.textContent = twBoard.roundTitle || 'Раунд';
                if (sEl) sEl.textContent = twBoard.roundSubtitle || '';
                var cards = document.getElementById('display-ft-cards');
                if (cards) {
                    cards.textContent = '';
                    twBoard.callTeams.forEach(function (t) {
                        var card = document.createElement('div');
                        card.className = 'display-ft-card';
                        var h = document.createElement('h3');
                        h.className = 'display-ft-card-name';
                        h.textContent = t.name || '';
                        var p = document.createElement('p');
                        p.className = 'display-ft-card-players';
                        p.textContent = t.players || '';
                        card.appendChild(h);
                        card.appendChild(p);
                        cards.appendChild(card);
                    });
                }
            }
            return;
        }

        if (twBoard.hallMode === 'flexible-match') {
            if (classicWrap) classicWrap.classList.add('hidden');
            if (ftCallWrap) ftCallWrap.classList.add('hidden');
            if (ftMatchWrap) {
                ftMatchWrap.classList.remove('hidden');
                var scoresEl = document.getElementById('display-ft-match-scores');
                if (scoresEl) {
                    scoresEl.textContent = '';
                    (twBoard.matchScores || []).forEach(function (row) {
                        var pill = document.createElement('div');
                        pill.className = 'display-ft-score-pill';
                        var nm = document.createElement('span');
                        nm.className = 'display-ft-score-name';
                        nm.textContent = row.name || '';
                        var sc = document.createElement('strong');
                        sc.className = 'display-ft-score-num';
                        sc.textContent = row.score != null ? String(row.score) : '0';
                        pill.appendChild(nm);
                        pill.appendChild(sc);
                        scoresEl.appendChild(pill);
                    });
                }
                var nextEl = document.getElementById('display-ft-match-next');
                if (nextEl) {
                    nextEl.textContent = '';
                    if (twBoard.flexibleRoundComplete) {
                        var done = document.createElement('div');
                        done.className = 'display-ft-next-body display-ft-next-done';
                        done.textContent = 'Все ходы раунда сыграны.';
                        nextEl.appendChild(done);
                    } else {
                        var tn = twBoard.flexibleNextTeam || '';
                        var pn = twBoard.flexibleNextPlayer || '';
                        if (tn || pn) {
                            var stack = document.createElement('div');
                            stack.className = 'display-ft-next-stack';
                            var lead = document.createElement('div');
                            lead.className = 'display-ft-next-lead';
                            lead.textContent = 'Следующий ход';
                            var l1 = document.createElement('div');
                            l1.className = 'display-ft-next-line';
                            l1.textContent = 'Команда: ' + tn;
                            var l2 = document.createElement('div');
                            l2.className = 'display-ft-next-line';
                            l2.textContent = 'Объясняет: ' + pn;
                            stack.appendChild(lead);
                            stack.appendChild(l1);
                            stack.appendChild(l2);
                            nextEl.appendChild(stack);
                        }
                    }
                }
            }
            return;
        }

        if (ftCallWrap) ftCallWrap.classList.add('hidden');
        if (ftMatchWrap) ftMatchWrap.classList.add('hidden');
        if (classicWrap) classicWrap.classList.remove('hidden');
        if (displayTwMatch) displayTwMatch.textContent = twBoard.matchInfo || '';
        if (displayTwPlayer) displayTwPlayer.textContent = twBoard.playerInfo || '';
    }

    function setViews(state) {
        var phase = state.phase || 'idle';
        var screenId = state.screenId || '';

        idleEl.classList.add('hidden');
        prepEl.classList.add('hidden');
        gameEl.classList.add('hidden');
        pausedEl.classList.add('hidden');
        if (resultsEl) resultsEl.classList.add('hidden');
        if (displayTournamentWait) displayTournamentWait.classList.add('hidden');

        if (phase === 'prep') {
            if (hallDock) {
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            prepEl.classList.remove('hidden');
            prepNameEl.textContent = state.prepName || '';
            prepCountEl.textContent = state.prepCountdown || '';
            return;
        }

        var twBoard = state.tournamentBoard;
        var canClassic = twBoard && (twBoard.matchInfo || twBoard.playerInfo);
        var canFtCall = twBoard && twBoard.hallMode === 'flexible-call' && twBoard.callTeams && twBoard.callTeams.length;
        var canFtMatch = twBoard && twBoard.hallMode === 'flexible-match';
        var showTournament =
            displayTournamentWait &&
            twBoard &&
            (phase === 'tournament-wait' ||
                phase === 'flexible-call' ||
                screenId === 'tournament-match' ||
                screenId === 'flexible-tournament-call' ||
                screenId === 'flexible-tournament-match') &&
            (canClassic || canFtCall || canFtMatch);

        if (showTournament) {
            if (hallDock) {
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            displayTournamentWait.classList.remove('hidden');
            renderTournamentHall(twBoard);
            return;
        }

        if (phase === 'paused' || screenId === 'pause-screen') {
            if (hallDock) {
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            pausedEl.classList.remove('hidden');
            return;
        }

        if (phase === 'playing' || phase === 'lobby') {
            gameEl.classList.remove('hidden');
            wordEl.textContent = state.word || '—';
            timerEl.textContent = String(state.timeRemaining != null ? state.timeRemaining : '');
            var p = typeof state.progress === 'number' ? state.progress : 100;
            if (progressFill) {
                progressFill.style.width = Math.max(0, Math.min(100, p)) + '%';
                progressFill.style.removeProperty('background');
            }
            var warn = state.timeRemaining != null && state.timeRemaining <= 10;
            timerEl.classList.toggle('warn', warn);
            if (timerRow) timerRow.classList.toggle('warn', warn);
            var compBn = document.getElementById('display-comp-banner');
            if (compBn) {
                var ch = state.competitiveHall;
                if (ch && ch.players && ch.players.length) {
                    compBn.classList.remove('hidden');
                    var nm = ch.currentPlayerName || '';
                    var lines = [];
                    if (phase === 'lobby') {
                        lines.push(nm ? 'Сейчас очередь: ' + nm : 'Соревновательный режим');
                    } else {
                        lines.push(nm ? 'Играет: ' + nm : 'Соревновательный раунд');
                    }
                    var scoreLine = ch.players
                        .map(function (pl) {
                            return (pl.name || '') + ' — ' + (pl.score != null ? pl.score : '0');
                        })
                        .join('     ');
                    if (scoreLine) {
                        lines.push(scoreLine);
                    }
                    compBn.textContent = lines.join('\n');
                } else {
                    compBn.classList.add('hidden');
                }
            }
            var flexBn = document.getElementById('display-flexible-banner');
            if (flexBn) {
                var fex = state.flexibleExplainer;
                if (fex && fex.teamName && fex.playerName) {
                    flexBn.classList.remove('hidden');
                    flexBn.textContent = fex.playerName + ' объясняет · команда «' + fex.teamName + '»';
                } else {
                    flexBn.classList.add('hidden');
                    flexBn.textContent = '';
                }
            }
            if (phase === 'lobby') {
                metaEl.textContent = 'Ожидание начала раунда';
            } else {
                metaEl.textContent =
                    'Слово ' +
                    (state.wordNumber || 0) +
                    ' · Очки ' +
                    (state.score != null ? state.score : 0) +
                    (state.skipsRemaining != null && state.maxSkipsAllowed != null
                        ? ' · Пропуски ' + state.skipsRemaining + '/' + state.maxSkipsAllowed
                        : '');
            }
            if (hallDock) {
                var hsb = state.hallScoreboard;
                if (hsb && hsb.rows && hsb.rows.length) {
                    hallDock.classList.remove('hidden');
                    hallDock.textContent = '';
                    hsb.rows.forEach(function (row, idx) {
                        var pill = document.createElement('span');
                        pill.className = 'display-hall-pill';
                        var nm = document.createElement('span');
                        nm.className = 'display-hall-pill-name';
                        nm.textContent = row.name || '';
                        var sc = document.createElement('strong');
                        sc.className = 'display-hall-pill-score';
                        sc.textContent = row.score != null ? String(row.score) : '0';
                        pill.appendChild(nm);
                        pill.appendChild(document.createTextNode(' '));
                        pill.appendChild(sc);
                        hallDock.appendChild(pill);
                        if (hsb.mode === 'tournament' && idx === 0 && hsb.rows.length > 1) {
                            var vs = document.createElement('span');
                            vs.className = 'display-hall-vs';
                            vs.textContent = '—';
                            hallDock.appendChild(vs);
                        }
                    });
                } else {
                    hallDock.classList.add('hidden');
                    hallDock.textContent = '';
                }
            }
            return;
        }

        if (phase === 'results' && state.results && resultsEl) {
            if (hallDock) {
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            resultsEl.classList.remove('hidden');
            var r = state.results;
            resultsTitle.textContent = r.title || 'Результаты';

            var drmEl = document.getElementById('display-results-match');
            if (drmEl) drmEl.classList.add('hidden');
            var drcEl = document.getElementById('display-results-competitive');
            if (drcEl) drcEl.classList.add('hidden');
            var dfrEl = document.getElementById('display-results-flexible-round');
            if (dfrEl) dfrEl.classList.add('hidden');
            resultsRound.classList.add('hidden');
            resultsGeneric.classList.add('hidden');

            if (r.variant === 'round') {
                resultsRound.classList.remove('hidden');
                drFinal.textContent = r.finalScore != null ? String(r.finalScore) : '0';
                drCorrectN.textContent = r.correct != null ? String(r.correct) : '0';
                drSkippedN.textContent = r.skipped != null ? String(r.skipped) : '0';
                var metaParts = [];
                if (r.duration) metaParts.push('Время: ' + r.duration);
                if (r.category) metaParts.push('Категория: ' + r.category);
                resultsMeta.textContent = metaParts.join(' · ');
                fillWordTags(drCorrect, r.correctWords, '');
                fillWordTags(drSkipped, r.skippedWords, 'skipped');
            } else if (r.variant === 'match') {
                renderMatchResults(r);
            } else if (r.variant === 'competitive') {
                renderCompetitiveResults(r);
            } else if (r.variant === 'flexible-round') {
                renderFlexibleRoundResults(r);
            } else {
                resultsGeneric.classList.remove('hidden');
                resultsBody.textContent = r.body || '';
            }
            return;
        }

        if (hallDock) {
            hallDock.classList.add('hidden');
            hallDock.textContent = '';
        }

        idleEl.classList.remove('hidden');
    }

    var LS_KEY = 'alias-standalone-sync-v1';
    var lastSeq = 0;
    var lastAppliedTs = 0;

    function applyIncoming(d) {
        if (!d || d.type !== 'STATE' || !d.state) return;
        if (typeof d._seq === 'number') {
            if (d._seq <= lastSeq) return;
            lastSeq = d._seq;
        } else {
            var ts = typeof d._ts === 'number' ? d._ts : 0;
            if (ts && ts <= lastAppliedTs) return;
            if (ts) lastAppliedTs = ts;
            else lastAppliedTs++;
        }
        if (d.flash) triggerFlash(d.flash);
        setViews(d.state);
    }

    if (bc) {
        bc.addEventListener('message', function (ev) {
            applyIncoming(ev.data);
        });
    }

    window.addEventListener('storage', function (ev) {
        if (ev.key !== LS_KEY || !ev.newValue) return;
        try {
            applyIncoming(JSON.parse(ev.newValue));
        } catch (e) {}
    });

    window.addEventListener('message', function (ev) {
        if (!ev.data || ev.data.type !== 'STATE') return;
        if (window.opener && ev.source !== window.opener) return;
        applyIncoming(ev.data);
    });

    setInterval(function () {
        try {
            var raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            var d = JSON.parse(raw);
            applyIncoming(d);
        } catch (e) {}
    }, 200);

    try {
        var raw0 = localStorage.getItem(LS_KEY);
        if (raw0) applyIncoming(JSON.parse(raw0));
    } catch (e) {}

    window.addEventListener('beforeunload', function () {
        if (bc) try { bc.close(); } catch (e) {}
    });
})();
