(function () {
    var CHANNEL = 'alias-standalone-v1';
    var bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

    var flashEl = document.getElementById('display-flash');
    var idleEl = document.getElementById('display-idle');
    var idleBgEl = document.getElementById('display-idle-bg');
    var idleBgPool = [];
    var idleBgEnabled = false;
    var prepEl = document.getElementById('display-prep');
    var prepLabelEl = document.getElementById('display-prep-label');
    var prepNameEl = document.getElementById('display-prep-name');
    var prepCountEl = document.getElementById('display-prep-count');
    var pairSwapEl = document.getElementById('display-pair-swap');
    var pairSwapPlayerEl = document.getElementById('display-pair-swap-player');
    var pairSwapHintEl = document.getElementById('display-pair-swap-hint');
    var pairSwapScoreNumEl = document.getElementById('display-pair-swap-score-num');
    var pairSwapCorrectNEl = document.getElementById('display-pair-swap-correct-n');
    var pairSwapSkippedNEl = document.getElementById('display-pair-swap-skipped-n');
    var pairSwapCorrectEl = document.getElementById('display-pair-swap-correct');
    var pairSwapSkippedEl = document.getElementById('display-pair-swap-skipped');
    var themeBannerEl = document.getElementById('display-theme-banner');
    var pairBannerEl = document.getElementById('display-pair-banner');
    var themePickerEl = document.getElementById('display-theme-picker');
    var themePickerTitleEl = document.getElementById('display-theme-picker-title');
    var themePickerLeadEl = document.getElementById('display-theme-picker-lead');
    var themePickerListEl = document.getElementById('display-theme-picker-list');
    var gameEl = document.getElementById('display-game');
    var gameThemeBgEl = document.getElementById('display-game-theme-bg');
    var pausedEl = document.getElementById('display-paused');
    var pausedThemeBgEl = document.getElementById('display-paused-theme-bg');
    var wordEl = document.getElementById('display-word');
    var lastThemeCoverApplied = '';
    var cachedThemeCoverSrc = '';
    var timerEl = document.getElementById('display-timer');
    var timerRow = document.querySelector('.display-timer-row');
    var progressFill = document.getElementById('display-progress-fill');
    var metaEl = document.getElementById('display-meta');
    var hallDock = document.getElementById('display-hall-scoreboard');
    var gameBannerEl = document.getElementById('display-game-banner');
    var gameBannerImg = document.getElementById('display-game-banner-img');

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
    var idleBgLoadSeq = 0;
    var lastIdleBgState = null;
    var HALL_BG_STORAGE_KEY = 'alias-standalone-bg-files-v1';
    var cachedGameBannerRev = 0;
    var cachedGameBannerSrc = '';
    var lastGameBannerPanel = null;
    var lastGameBannerSrcApplied = '';
    var cachedHallBannerHeightPx = 0;

    function normalizeBgManifest(data) {
        if (!data) return [];
        var raw = Array.isArray(data) ? data : data.images || data.files || [];
        return raw
            .map(function (f) {
                return String(f).trim();
            })
            .filter(function (name) {
                if (!name || name === 'manifest.json') return false;
                var base = name.replace(/\\/g, '/').split('/').pop();
                return base && base.indexOf('..') < 0;
            })
            .map(function (name) {
                return name.replace(/\\/g, '/').split('/').pop();
            });
    }

    function idleBgAssetUrl(fileName) {
        return 'bg/' + encodeURIComponent(fileName);
    }

    function pickRandomIdleBg() {
        if (!idleBgEnabled || !idleBgPool.length || !idleBgEl) return;
        var file = idleBgPool[Math.floor(Math.random() * idleBgPool.length)];
        idleBgEl.style.backgroundImage = "url('" + idleBgAssetUrl(file) + "')";
        idleBgEl.hidden = false;
    }

    function disableIdleBgMode() {
        idleBgPool = [];
        idleBgEnabled = false;
        if (idleEl) idleEl.classList.remove('display-idle--has-bg');
        if (idleBgEl) {
            idleBgEl.style.backgroundImage = '';
            idleBgEl.hidden = true;
        }
    }

    function enableIdleBgMode(list) {
        idleBgPool = list.slice();
        idleBgEnabled = true;
        if (idleEl) idleEl.classList.add('display-idle--has-bg');
        pickRandomIdleBg();
    }

    function parseBgDirectoryListing(html) {
        var seen = {};
        var out = [];
        var extRe = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
        try {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            doc.querySelectorAll('a[href]').forEach(function (a) {
                var href = (a.getAttribute('href') || '').trim();
                if (!href || href === '../' || href === './' || href.charAt(0) === '?') return;
                var name = href.replace(/\\/g, '/').split('/').pop();
                if (!name || name === '..' || name === '.' || name === 'manifest.json') return;
                if (!extRe.test(name)) return;
                if (seen[name]) return;
                seen[name] = true;
                out.push(name);
            });
        } catch (e) {}
        return out.sort(function (a, b) {
            return a.localeCompare(b, 'ru');
        });
    }

    function fetchBgListFromDirectory() {
        if (typeof fetch !== 'function') {
            return Promise.reject(new Error('no fetch'));
        }
        return fetch('bg/?_=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('no dir');
                return r.text();
            })
            .then(function (html) {
                var list = parseBgDirectoryListing(html);
                if (!list.length) throw new Error('empty dir');
                return list;
            });
    }

    function collectBgImageList(state) {
        var seen = {};
        var out = [];
        function add(name) {
            var base = String(name || '')
                .trim()
                .replace(/\\/g, '/')
                .split('/')
                .pop();
            if (!base || base === 'manifest.json' || base === 'manifest.js' || seen[base]) return;
            seen[base] = true;
            out.push(base);
        }
        if (state && state.idleBgFiles) {
            state.idleBgFiles.forEach(add);
        }
        try {
            var raw = localStorage.getItem(HALL_BG_STORAGE_KEY);
            if (raw) JSON.parse(raw).forEach(add);
        } catch (e) {}
        normalizeBgManifest(window.ALIAS_BG_MANIFEST).forEach(add);
        return out;
    }

    function loadEmbeddedBgManifest() {
        return new Promise(function (resolve) {
            var prev = document.getElementById('alias-bg-manifest-loader');
            if (prev) prev.remove();
            var s = document.createElement('script');
            s.id = 'alias-bg-manifest-loader';
            s.src = 'bg/manifest.js?_=' + Date.now();
            s.onload = function () {
                resolve(normalizeBgManifest(window.ALIAS_BG_MANIFEST));
            };
            s.onerror = function () {
                resolve(normalizeBgManifest(window.ALIAS_BG_MANIFEST));
            };
            document.head.appendChild(s);
        });
    }

    function fetchBgImageList(state) {
        var local = collectBgImageList(state);
        if (local.length) {
            return Promise.resolve(local);
        }
        return loadEmbeddedBgManifest().then(function (embedded) {
            if (embedded.length) return embedded;
            if (typeof fetch !== 'function') {
                return [];
            }
            return fetch('bg/manifest.json?_=' + Date.now(), { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('no manifest');
                    return r.json();
                })
                .then(function (data) {
                    var list = normalizeBgManifest(data);
                    if (list.length) return list;
                    return fetchBgListFromDirectory();
                })
                .catch(function () {
                    return fetchBgListFromDirectory().catch(function () {
                        return [];
                    });
                });
        });
    }

    function verifyBgImageList(list) {
        return new Promise(function (resolve) {
            if (!list || !list.length) {
                resolve([]);
                return;
            }
            var probe = new Image();
            probe.onload = function () {
                resolve(list);
            };
            probe.onerror = function () {
                resolve([]);
            };
            probe.src = idleBgAssetUrl(list[0]);
        });
    }

    function loadIdleBackgrounds(onDone, state) {
        var seq = ++idleBgLoadSeq;
        fetchBgImageList(state || lastIdleBgState)
            .then(function (list) {
                return verifyBgImageList(list);
            })
            .then(function (list) {
                if (seq !== idleBgLoadSeq) return;
                if (!list.length) {
                    disableIdleBgMode();
                    return;
                }
                enableIdleBgMode(list);
            })
            .catch(function () {
                if (seq !== idleBgLoadSeq) return;
                disableIdleBgMode();
            })
            .finally(function () {
                if (seq !== idleBgLoadSeq) return;
                if (typeof onDone === 'function') onDone();
            });
    }

    function showIdleScreen() {
        idleEl.classList.remove('hidden');
        loadIdleBackgrounds(null, lastIdleBgState);
    }

    function syncGameBannerFromState(state) {
        if (!state) return;
        if (state.gameBannerSrc !== undefined) {
            cachedGameBannerSrc = state.gameBannerSrc || '';
            cachedGameBannerRev = state.gameBannerRev || 0;
        } else if (state.gameBannerRev !== undefined && state.gameBannerRev !== cachedGameBannerRev) {
            cachedGameBannerSrc = '';
            cachedGameBannerRev = state.gameBannerRev || 0;
        }
    }

    function updateHallBannerHeight() {
        var root = document.getElementById('display-root');
        if (!gameBannerImg || !root || !gameBannerEl || gameBannerEl.classList.contains('hidden')) {
            return;
        }
        requestAnimationFrame(function () {
            var h = Math.round(gameBannerImg.getBoundingClientRect().height);
            if (h <= 0 || h === cachedHallBannerHeightPx) return;
            cachedHallBannerHeightPx = h;
            root.style.setProperty('--hall-banner-height', h + 'px');
        });
    }

    function resolveThemeCoverFromState(state) {
        if (!state) return cachedThemeCoverSrc;
        if (state.themeCover !== undefined) {
            cachedThemeCoverSrc =
                state.themeCover && String(state.themeCover).indexOf('data:') === 0
                    ? String(state.themeCover)
                    : '';
            return cachedThemeCoverSrc;
        }
        if (state.themeCoverKeep) return cachedThemeCoverSrc;
        return cachedThemeCoverSrc;
    }

    function applyThemeCoverBg(coverSrc, targets) {
        var src = coverSrc && String(coverSrc).indexOf('data:') === 0 ? String(coverSrc) : '';
        var list = Array.isArray(targets) ? targets : [targets];
        list.forEach(function (el) {
            if (!el) return;
            if (!src) {
                el.classList.add('hidden');
                el.style.backgroundImage = '';
                el.setAttribute('aria-hidden', 'true');
                return;
            }
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
            if (lastThemeCoverApplied !== src) {
                el.style.backgroundImage = "url('" + src.replace(/'/g, '%27') + "')";
            } else if (!el.style.backgroundImage) {
                el.style.backgroundImage = "url('" + src.replace(/'/g, '%27') + "')";
            }
        });
        if (gameEl) gameEl.classList.toggle('display-game--theme-cover', !!src);
        if (pausedEl) pausedEl.classList.toggle('display-paused--theme-cover', !!src);
        var root = document.getElementById('display-root');
        if (root) root.classList.toggle('display-root--theme-cover', !!src);
        lastThemeCoverApplied = src;
    }

    function clearThemeCoverBg() {
        applyThemeCoverBg('', [gameThemeBgEl, pausedThemeBgEl]);
    }

    function applyGameBannerToDom(activePanel) {
        if (!gameBannerEl || !gameBannerImg) return;
        var root = document.getElementById('display-root');
        var has = !!(cachedGameBannerSrc && cachedGameBannerRev);
        var show = has && (activePanel === 'game' || activePanel === 'pause');

        if (!show) {
            if (lastGameBannerPanel === null) return;
            lastGameBannerPanel = null;
            lastGameBannerSrcApplied = '';
            cachedHallBannerHeightPx = 0;
            if (root) {
                root.classList.remove('display-root--hall-banner');
                root.style.removeProperty('--hall-banner-height');
            }
            if (gameEl) gameEl.classList.remove('display-game--has-banner');
            gameBannerEl.classList.add('hidden');
            gameBannerEl.setAttribute('aria-hidden', 'true');
            gameBannerImg.onload = null;
            gameBannerImg.removeAttribute('src');
            return;
        }

        var panelChanged = lastGameBannerPanel !== activePanel;
        var srcChanged = lastGameBannerSrcApplied !== cachedGameBannerSrc;
        var wasHidden = gameBannerEl.classList.contains('hidden');

        if (!panelChanged && !srcChanged && !wasHidden) {
            if (gameEl) gameEl.classList.toggle('display-game--has-banner', activePanel === 'game');
            return;
        }

        lastGameBannerPanel = activePanel;
        lastGameBannerSrcApplied = cachedGameBannerSrc;

        if (root) root.classList.add('display-root--hall-banner');
        if (gameEl) gameEl.classList.toggle('display-game--has-banner', activePanel === 'game');

        gameBannerEl.classList.remove('hidden');
        gameBannerEl.setAttribute('aria-hidden', 'false');

        gameBannerImg.onload = updateHallBannerHeight;
        if (srcChanged || wasHidden || gameBannerImg.getAttribute('src') !== cachedGameBannerSrc) {
            if (srcChanged || wasHidden) cachedHallBannerHeightPx = 0;
            gameBannerImg.src = cachedGameBannerSrc;
        } else {
            updateHallBannerHeight();
        }
    }

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
        container.classList.remove('display-word-tags--pair');
        (words || []).forEach(function (w) {
            var s = document.createElement('span');
            s.className = 'tag' + (tagClass ? ' ' + tagClass : '');
            s.textContent = w;
            container.appendChild(s);
        });
    }

    function fillPairWordTags(container, legs, listKey, tagClass) {
        if (!container) return;
        container.textContent = '';
        container.classList.add('display-word-tags--pair');
        var list = Array.isArray(legs) ? legs : [];
        if (!list.length) {
            var empty = document.createElement('span');
            empty.className = 'display-pair-words-empty';
            empty.textContent = 'нет';
            container.appendChild(empty);
            return;
        }
        list.forEach(function (leg, idx) {
            var block = document.createElement('div');
            block.className = 'display-pair-words-leg';
            var label = document.createElement('div');
            label.className = 'display-pair-words-label';
            label.textContent = (leg && leg.label) || (idx === 0 ? 'Первый Игрок' : 'Второй Игрок');
            block.appendChild(label);
            var tags = document.createElement('div');
            tags.className = 'display-pair-words-tags';
            var words = leg && Array.isArray(leg[listKey]) ? leg[listKey] : [];
            if (!words.length) {
                var none = document.createElement('span');
                none.className = 'display-pair-words-empty';
                none.textContent = 'нет';
                tags.appendChild(none);
            } else {
                words.forEach(function (w) {
                    var s = document.createElement('span');
                    s.className = 'tag' + (tagClass ? ' ' + tagClass : '');
                    s.textContent = w;
                    tags.appendChild(s);
                });
            }
            block.appendChild(tags);
            container.appendChild(block);
        });
    }

    function fillDftWordTags(container, words, tagClass) {
        if (!container) return;
        container.textContent = '';
        if (!words || !words.length) {
            var empty = document.createElement('span');
            empty.className = 'dft-no-words';
            empty.textContent = tagClass === 'skipped' ? 'Нет неугаданных слов' : 'Нет отгаданных слов';
            container.appendChild(empty);
            return;
        }
        (words || []).forEach(function (w) {
            var s = document.createElement('span');
            s.className = 'dft-tag' + (tagClass ? ' dft-tag--' + tagClass : '');
            s.textContent = w;
            container.appendChild(s);
        });
    }

    function renderFlexibleTurnResults(r) {
        var root = document.getElementById('display-results-flexible-turn');
        if (!root) return;
        root.classList.remove('hidden');
        var pn = document.getElementById('dft-player-name');
        var tn = document.getElementById('dft-team-name');
        var ps = document.getElementById('dft-player-score');
        var ts = document.getElementById('dft-team-score');
        var cc = document.getElementById('dft-correct-count');
        var sc = document.getElementById('dft-skipped-count');
        if (pn) pn.textContent = r.playerName || '—';
        if (tn) tn.textContent = r.teamName || '—';
        if (ps) ps.textContent = r.playerScore != null && r.playerScore !== '' ? String(r.playerScore) : '0';
        if (ts) ts.textContent = r.teamScore != null && r.teamScore !== '' ? String(r.teamScore) : '0';
        var correctN =
            r.correctCount != null && r.correctCount !== ''
                ? String(r.correctCount)
                : String((r.correctWords || []).length);
        var skippedN =
            r.skippedCount != null && r.skippedCount !== ''
                ? String(r.skippedCount)
                : String((r.skippedWords || []).length);
        if (cc) cc.textContent = correctN;
        if (sc) sc.textContent = skippedN;
        fillDftWordTags(document.getElementById('dft-correct-words'), r.correctWords || [], 'correct');
        fillDftWordTags(document.getElementById('dft-skipped-words'), r.skippedWords || [], 'skipped');
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

    function buildDisplayFrColTpl(maxP) {
        if (maxP === 0) return 'minmax(9rem, 1.35fr) minmax(4rem, auto)';
        return (
            'minmax(9rem, 1.3fr) repeat(' +
            maxP +
            ', minmax(3.25rem, 1fr)) minmax(4rem, auto)'
        );
    }

    function renderFlexibleRoundResults(r) {
        var root = document.getElementById('display-results-flexible-round');
        if (!root) return;
        root.classList.remove('hidden');
        var resultsEl = document.getElementById('display-results');
        var grid = document.getElementById('display-fr-grid');
        var foot = document.getElementById('display-fr-footnote');
        if (grid) {
            grid.textContent = '';
            var rows = r.rows || [];
            var colH = r.columnHeaders || [];
            var legacy =
                rows.length &&
                rows[0] &&
                Object.prototype.hasOwnProperty.call(rows[0], 'round') &&
                !rows[0].cells;

            if (legacy) {
                grid.className = 'display-fr-grid';
                var headRow = document.createElement('div');
                headRow.className = 'display-fr-head';
                ['Команда', 'Раунд', 'Всего'].forEach(function (label) {
                    var c = document.createElement('div');
                    c.className = 'display-fr-h';
                    c.textContent = label;
                    headRow.appendChild(c);
                });
                grid.appendChild(headRow);
                rows.forEach(function (row) {
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
            } else {
                grid.className = 'display-fr-grid display-fr-grid--matrix display-fr-table';
                var maxP = colH.length;
                if (!maxP && rows[0] && rows[0].cells) {
                    maxP = rows[0].cells.length;
                }
                if (!colH.length && maxP) {
                    colH = [];
                    for (var ji = 0; ji < maxP; ji++) {
                        colH.push('Игрок ' + (ji + 1));
                    }
                }
                var colTpl = buildDisplayFrColTpl(maxP);
                var rowCount = rows.length;
                grid.style.setProperty('--display-fr-cols', colTpl);
                grid.style.setProperty('--display-fr-rows', String(rowCount));
                grid.dataset.rows = String(rowCount);
                grid.dataset.playerCols = String(maxP);

                var headRow2 = document.createElement('div');
                headRow2.className = 'display-fr-head display-fr-matrix-row';
                var hTeam = document.createElement('div');
                hTeam.className = 'display-fr-h display-fr-h-team';
                hTeam.textContent = 'Команда';
                headRow2.appendChild(hTeam);
                colH.forEach(function (label) {
                    var hc = document.createElement('div');
                    hc.className = 'display-fr-h display-fr-h-player';
                    hc.textContent = label;
                    hc.title = label;
                    headRow2.appendChild(hc);
                });
                var hnTotal = document.createElement('div');
                hnTotal.className = 'display-fr-h display-fr-h-num';
                hnTotal.textContent = 'Итого';
                headRow2.appendChild(hnTotal);
                grid.appendChild(headRow2);

                var bodyWrap = document.createElement('div');
                bodyWrap.className = 'display-fr-body';
                bodyWrap.setAttribute('role', 'rowgroup');
                grid.appendChild(bodyWrap);

                rows.forEach(function (row) {
                    var rowEl = document.createElement('div');
                    rowEl.className = 'display-fr-row display-fr-matrix-row';
                    var t0 = document.createElement('div');
                    t0.className = 'display-fr-cell display-fr-team';
                    var teamName = row.team || '';
                    t0.textContent = teamName;
                    t0.title = teamName;
                    rowEl.appendChild(t0);
                    var cells = row.cells || [];
                    for (var ci = 0; ci < maxP; ci++) {
                        var td = document.createElement('div');
                        td.className = 'display-fr-cell display-fr-num display-fr-pcell';
                        var v = cells[ci];
                        td.textContent = v != null && v !== '' ? String(v) : '—';
                        rowEl.appendChild(td);
                    }
                    var tr = document.createElement('div');
                    tr.className = 'display-fr-cell display-fr-num display-fr-round-total';
                    tr.textContent =
                        row.roundTotal != null && row.roundTotal !== ''
                            ? String(row.roundTotal)
                            : row.total != null && row.total !== ''
                              ? String(row.total)
                              : '';
                    rowEl.appendChild(tr);
                    bodyWrap.appendChild(rowEl);
                });
            }
        }
        if (foot) {
            foot.textContent = '';
            foot.classList.add('hidden');
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
                    (twBoard.matchScores || []).forEach(function (row, idx) {
                        var pill = document.createElement('div');
                        var isActive =
                            !twBoard.flexibleRoundComplete &&
                            ((typeof twBoard.flexibleNextTeamSlot === 'number' &&
                                twBoard.flexibleNextTeamSlot >= 0 &&
                                idx === twBoard.flexibleNextTeamSlot) ||
                                (twBoard.flexibleNextTeam &&
                                    row.name &&
                                    row.name === twBoard.flexibleNextTeam));
                        pill.className =
                            'display-ft-score-pill' + (isActive ? ' display-ft-score-pill--active' : '');
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
        lastIdleBgState = state || null;
        syncGameBannerFromState(state);
        var phase = state.phase || 'idle';
        var screenId = state.screenId || '';

        idleEl.classList.add('hidden');
        prepEl.classList.add('hidden');
        if (pairSwapEl) pairSwapEl.classList.add('hidden');
        if (themePickerEl) themePickerEl.classList.add('hidden');
        gameEl.classList.add('hidden');
        pausedEl.classList.add('hidden');
        if (resultsEl) resultsEl.classList.add('hidden');
        if (displayTournamentWait) displayTournamentWait.classList.add('hidden');

        if (phase === 'theme-picker') {
            clearThemeCoverBg();
            if (hallDock) {
                hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            if (themePickerEl) {
                themePickerEl.classList.remove('hidden');
                var tp = state.themePicker || {};
                if (themePickerTitleEl) themePickerTitleEl.textContent = tp.title || 'Выберите тему';
                if (themePickerLeadEl) {
                    themePickerLeadEl.textContent = tp.lead || 'Ведущий выбирает тему на своём экране';
                }
                if (themePickerListEl) {
                    var themes = Array.isArray(tp.themes) ? tp.themes : [];
                    if (!themes.length) {
                        themePickerListEl.innerHTML =
                            '<p class="display-theme-picker-empty">Темы ещё не загружены</p>';
                    } else {
                        themePickerListEl.innerHTML = themes
                            .map(function (t) {
                                var rem = t && t.remaining != null ? t.remaining : 0;
                                var cover = t && t.cover ? String(t.cover) : '';
                                var hasCover = cover.indexOf('data:') === 0;
                                var style = hasCover
                                    ? ' style="background-image:url(\'' + cover.replace(/'/g, '%27') + '\')"'
                                    : '';
                                var cls =
                                    'display-theme-card' +
                                    (hasCover ? ' display-theme-card--has-cover' : '') +
                                    (rem <= 0 ? ' display-theme-card--depleted' : '');
                                return (
                                    '<div class="' +
                                    cls +
                                    '"' +
                                    style +
                                    '>' +
                                    '<span class="display-theme-card-shade" aria-hidden="true"></span>' +
                                    '<span class="display-theme-card-body">' +
                                    '<span class="display-theme-card-name"></span>' +
                                    '<span class="display-theme-card-meta"></span>' +
                                    '</span></div>'
                                );
                            })
                            .join('');
                        var cards = themePickerListEl.querySelectorAll('.display-theme-card');
                        themes.forEach(function (t, i) {
                            var card = cards[i];
                            if (!card) return;
                            var nameEl = card.querySelector('.display-theme-card-name');
                            var metaEl = card.querySelector('.display-theme-card-meta');
                            if (nameEl) nameEl.textContent = t && t.name ? String(t.name) : 'Тема';
                            if (metaEl) {
                                var rem2 = t && t.remaining != null ? t.remaining : 0;
                                var tot2 = t && t.total != null ? t.total : 0;
                                metaEl.textContent = rem2 + ' из ' + tot2 + ' слов';
                            }
                        });
                    }
                }
            }
            applyGameBannerToDom(null);
            return;
        }

        if (phase === 'prep') {
            clearThemeCoverBg();
            if (hallDock) {
                hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            prepEl.classList.remove('hidden');
            if (prepLabelEl) prepLabelEl.textContent = state.prepTitle || 'Подготовка';
            var prepNameText = state.prepName || '';
            if (state.themeName) {
                prepNameText = prepNameText
                    ? prepNameText + ' · Тема: ' + state.themeName
                    : 'Тема: ' + state.themeName;
            }
            prepNameEl.textContent = prepNameText;
            prepCountEl.textContent = state.prepCountdown || '';
            applyGameBannerToDom(null);
            return;
        }

        if (phase === 'pair-swap') {
            clearThemeCoverBg();
            if (hallDock) {
                hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            if (pairSwapEl) {
                pairSwapEl.classList.remove('hidden');
                var ps = state.pairSwap || {};
                if (pairSwapPlayerEl) {
                    pairSwapPlayerEl.textContent = ps.nextPlayerLabel || 'Второй Игрок';
                }
                if (pairSwapHintEl) {
                    pairSwapHintEl.textContent = state.themeName
                        ? 'Тема: ' + state.themeName + ' · ожидание готовности второго игрока'
                        : 'Ожидание готовности второго игрока';
                }
                var correct = ps.leg1Correct != null ? ps.leg1Correct : 0;
                var skipped = ps.leg1Skipped != null ? ps.leg1Skipped : 0;
                var score = ps.leg1Score != null ? ps.leg1Score : 0;
                if (pairSwapScoreNumEl) pairSwapScoreNumEl.textContent = String(score);
                if (pairSwapCorrectNEl) pairSwapCorrectNEl.textContent = String(correct);
                if (pairSwapSkippedNEl) pairSwapSkippedNEl.textContent = String(skipped);
                fillWordTags(pairSwapCorrectEl, ps.correctWords || [], '');
                fillWordTags(pairSwapSkippedEl, ps.skippedWords || [], 'skipped');
            }
            applyGameBannerToDom(null);
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
            clearThemeCoverBg();
            if (hallDock) {
                hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            displayTournamentWait.classList.remove('hidden');
            renderTournamentHall(twBoard);
            applyGameBannerToDom(null);
            return;
        }

        if (phase === 'paused' || screenId === 'pause-screen') {
            if (hallDock) {
                hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            var pausedTextEl = document.getElementById('display-paused-text');
            if (pausedTextEl) {
                pausedTextEl.textContent =
                    state.awaitingCustomWordPack
                        ? 'Пауза · на экране ведущего загрузите новый пакет слов'
                        : 'Пауза';
            }
            pausedEl.classList.remove('hidden');
            applyThemeCoverBg(resolveThemeCoverFromState(state), [pausedThemeBgEl, gameThemeBgEl]);
            applyGameBannerToDom('pause');
            return;
        }

        if (phase === 'playing' || phase === 'lobby' || phase === 'final-word') {
            gameEl.classList.remove('hidden');
            applyThemeCoverBg(resolveThemeCoverFromState(state), [gameThemeBgEl, pausedThemeBgEl]);
            applyGameBannerToDom('game');
            gameEl.classList.toggle('display-game--final-word', phase === 'final-word');
            wordEl.textContent = state.word || '—';
            timerEl.textContent = String(state.timeRemaining != null ? state.timeRemaining : '');
            var p = typeof state.progress === 'number' ? state.progress : 100;
            if (progressFill) {
                progressFill.style.width = Math.max(0, Math.min(100, p)) + '%';
                progressFill.style.removeProperty('background');
            }
            var warn =
                phase === 'final-word' ||
                (state.timeRemaining != null && state.timeRemaining <= 10);
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
            if (themeBannerEl) {
                if (state.themeName) {
                    themeBannerEl.classList.remove('hidden');
                    themeBannerEl.textContent = 'Тема: ' + state.themeName;
                } else {
                    themeBannerEl.classList.add('hidden');
                    themeBannerEl.textContent = '';
                }
            }
            if (pairBannerEl) {
                pairBannerEl.classList.add('hidden');
                pairBannerEl.textContent = '';
            }
            if (phase === 'lobby') {
                metaEl.className = 'display-meta';
                metaEl.textContent = 'Ожидание начала раунда';
            } else {
                var hsbPlay = state.hallScoreboard;
                var flexHall = hsbPlay && hsbPlay.mode === 'flexible';
                var scVal = state.score != null ? state.score : 0;
                var scStr = String(Math.round(scVal));
                var skipInner = '';
                if (state.skipsRemaining != null && state.maxSkipsAllowed != null) {
                    var rem = state.skipsRemaining;
                    var maxSk = state.maxSkipsAllowed;
                    var usedSk = Math.max(0, maxSk - rem);
                    var skipsDepleted = maxSk > 0 && rem <= 0;
                    skipInner =
                        '<div class="display-meta-chip display-meta-chip--skips' +
                        (skipsDepleted ? ' display-meta-chip--skips-depleted' : '') +
                        '" role="status">' +
                        '<span class="display-meta-chip-lbl">Пропуски</span>' +
                        '<span class="display-meta-chip-val">' +
                        String(usedSk) +
                        '<span class="display-meta-chip-max">/' +
                        String(maxSk) +
                        '</span></span></div>';
                }
                var scoreChip =
                    '<div class="display-meta-chip display-meta-chip--score" role="status">' +
                    '<span class="display-meta-chip-lbl">Очки</span>' +
                    '<span class="display-meta-chip-val">' +
                    scStr +
                    '</span></div>';
                if (flexHall) {
                    metaEl.className = 'display-meta display-meta--hud';
                    metaEl.innerHTML =
                        '<div class="display-meta-bar">' + scoreChip + skipInner + '</div>';
                } else {
                    var correctN = state.correctCount != null ? state.correctCount : 0;
                    var skippedN = state.skippedCount != null ? state.skippedCount : 0;
                    var pgHud = state.pairGame;
                    var playerChip = '';
                    if (pgHud && (pgHud.leg || pgHud.playerLabel)) {
                        var playerNum =
                            pgHud.leg != null
                                ? String(pgHud.leg)
                                : /второй/i.test(String(pgHud.playerLabel || ''))
                                  ? '2'
                                  : '1';
                        playerChip =
                            '<div class="display-meta-chip display-meta-chip--player" role="status">' +
                            '<span class="display-meta-chip-lbl">Игрок</span>' +
                            '<span class="display-meta-chip-val">' +
                            playerNum +
                            '</span></div>';
                    }
                    var correctChip =
                        '<div class="display-meta-chip display-meta-chip--correct" role="status">' +
                        '<span class="display-meta-chip-lbl">Угадано</span>' +
                        '<span class="display-meta-chip-val">' +
                        String(correctN) +
                        '</span></div>';
                    var skippedChip =
                        '<div class="display-meta-chip display-meta-chip--skipped" role="status">' +
                        '<span class="display-meta-chip-lbl">Пропущено</span>' +
                        '<span class="display-meta-chip-val">' +
                        String(skippedN) +
                        '</span></div>';
                    metaEl.className = 'display-meta display-meta--hud';
                    metaEl.innerHTML =
                        '<div class="display-meta-bar">' +
                        playerChip +
                        correctChip +
                        skippedChip +
                        '</div>';
                }
            }
            if (hallDock) {
                var hsb = state.hallScoreboard;
                if (hsb && hsb.rows && hsb.rows.length) {
                    hallDock.classList.remove('hidden');
                    hallDock.textContent = '';
                    if (hsb.mode === 'flexible') {
                        hallDock.classList.add('display-hall-scoreboard--flex-cards');
                    } else {
                        hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                    }
                    hsb.rows.forEach(function (row, idx) {
                        var pill;
                        if (hsb.mode === 'flexible') {
                            pill = document.createElement('div');
                            pill.className = 'display-hall-ft-card';
                            var nm = document.createElement('span');
                            nm.className = 'display-hall-ft-card-name';
                            nm.textContent = row.name || '';
                            var sc = document.createElement('strong');
                            sc.className = 'display-hall-ft-card-score';
                            sc.textContent = row.score != null ? String(row.score) : '0';
                            pill.appendChild(nm);
                            pill.appendChild(sc);
                        } else {
                            pill = document.createElement('span');
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
                        }
                        hallDock.appendChild(pill);
                        if (hsb.mode === 'tournament' && idx === 0 && hsb.rows.length > 1) {
                            var vs = document.createElement('span');
                            vs.className = 'display-hall-vs';
                            vs.textContent = '—';
                            hallDock.appendChild(vs);
                        }
                    });
                } else {
                    hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                    hallDock.classList.add('hidden');
                    hallDock.textContent = '';
                }
            }
            return;
        }

        if (phase === 'results' && state.results && resultsEl) {
            if (hallDock) {
                hallDock.classList.remove('display-hall-scoreboard--flex-cards');
                hallDock.classList.add('hidden');
                hallDock.textContent = '';
            }
            resultsEl.classList.remove('hidden');
            var r = state.results;
            resultsEl.classList.toggle('display-results--flexible-round', r.variant === 'flexible-round');
            resultsEl.classList.toggle('display-results--flexible-turn', r.variant === 'flexible-turn');
            resultsTitle.textContent = r.title || 'Результаты';

            var drmEl = document.getElementById('display-results-match');
            if (drmEl) drmEl.classList.add('hidden');
            var drcEl = document.getElementById('display-results-competitive');
            if (drcEl) drcEl.classList.add('hidden');
            var dfrEl = document.getElementById('display-results-flexible-round');
            if (dfrEl) dfrEl.classList.add('hidden');
            var dftEl = document.getElementById('display-results-flexible-turn');
            if (dftEl) dftEl.classList.add('hidden');
            resultsRound.classList.add('hidden');
            resultsGeneric.classList.add('hidden');

            if (r.variant === 'round' || r.variant === 'pair-round') {
                resultsRound.classList.remove('hidden');
                var cardsClassic = document.getElementById('display-results-cards-classic');
                var cardsPair = document.getElementById('display-results-cards-pair');
                if (r.variant === 'pair-round') {
                    if (cardsClassic) cardsClassic.classList.add('hidden');
                    if (cardsPair) cardsPair.classList.remove('hidden');
                    var legs = Array.isArray(r.pairLegs) ? r.pairLegs : [];
                    var p1 = legs[0] || {};
                    var p2 = legs[1] || {};
                    var p1Num = document.getElementById('dr-pair-p1');
                    var p2Num = document.getElementById('dr-pair-p2');
                    var p1Lbl = document.getElementById('dr-pair-p1-lbl');
                    var p2Lbl = document.getElementById('dr-pair-p2-lbl');
                    var totalNum = document.getElementById('dr-pair-total');
                    if (p1Num) p1Num.textContent = String(p1.score != null ? p1.score : 0);
                    if (p2Num) p2Num.textContent = String(p2.score != null ? p2.score : 0);
                    if (p1Lbl) p1Lbl.textContent = p1.label || 'Первый Игрок';
                    if (p2Lbl) p2Lbl.textContent = p2.label || 'Второй Игрок';
                    if (totalNum) {
                        totalNum.textContent =
                            r.finalScore != null
                                ? String(r.finalScore)
                                : String((Number(p1.score) || 0) + (Number(p2.score) || 0));
                    }
                    var pairMetaParts = [];
                    if (r.category) pairMetaParts.push('Категория: ' + r.category);
                    resultsMeta.textContent = pairMetaParts.join(' · ');
                } else {
                    if (cardsClassic) cardsClassic.classList.remove('hidden');
                    if (cardsPair) cardsPair.classList.add('hidden');
                    drFinal.textContent = r.finalScore != null ? String(r.finalScore) : '0';
                    drCorrectN.textContent = r.correct != null ? String(r.correct) : '0';
                    drSkippedN.textContent = r.skipped != null ? String(r.skipped) : '0';
                    var metaParts = [];
                    if (r.duration) metaParts.push('Время: ' + r.duration);
                    if (r.category) metaParts.push('Категория: ' + r.category);
                    resultsMeta.textContent = metaParts.join(' · ');
                }
                if (r.variant === 'pair-round' && r.pairLegs && r.pairLegs.length) {
                    fillPairWordTags(drCorrect, r.pairLegs, 'correctWords', '');
                    fillPairWordTags(drSkipped, r.pairLegs, 'skippedWords', 'skipped');
                } else {
                    fillWordTags(drCorrect, r.correctWords, '');
                    fillWordTags(drSkipped, r.skippedWords, 'skipped');
                }
            } else if (r.variant === 'match') {
                renderMatchResults(r);
            } else if (r.variant === 'competitive') {
                renderCompetitiveResults(r);
            } else if (r.variant === 'flexible-round') {
                renderFlexibleRoundResults(r);
            } else if (r.variant === 'flexible-turn') {
                renderFlexibleTurnResults(r);
            } else {
                resultsGeneric.classList.remove('hidden');
                resultsBody.textContent = r.body || '';
            }
            clearThemeCoverBg();
            applyGameBannerToDom(null);
            return;
        }

        if (hallDock) {
            hallDock.classList.remove('display-hall-scoreboard--flex-cards');
            hallDock.classList.add('hidden');
            hallDock.textContent = '';
        }

        clearThemeCoverBg();
        showIdleScreen();
        applyGameBannerToDom(null);
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

    loadIdleBackgrounds();

    window.addEventListener('beforeunload', function () {
        if (bc) try { bc.close(); } catch (e) {}
    });
})();
