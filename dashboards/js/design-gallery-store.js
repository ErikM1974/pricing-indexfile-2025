/**
 * design-gallery-store.js — Design Vault index lifecycle (DG.store)
 *
 * Owns the search index between the proxy and the UI: streamed download of
 * GET /api/design-search/index (progress events off Content-Length), IndexedDB
 * cache (db `design-vault` v1, store `index`, key `current`, record
 * {version, savedAt, etag, payload}), ETag/If-None-Match revalidation, cheap
 * GET /meta recheck on cached boots, and the GET /recent delta-merge (applied
 * via the pure DG.search.mergeRecent — jest-locked in
 * tests/unit/design-search-core.test.js).
 *
 * NO DOM access — everything surfaces through the init() callbacks; DG.app
 * owns the boot overlay / banners. The one exception is the rule-6 config
 * check, which mirrors to DashPage.showError so a missing APP_CONFIG can
 * never fail silently (Erik's #1 rule).
 *
 * Failure map (no silent paths):
 *   · 503 building + no cache -> onError({hasCache:false, building:true}),
 *     then /meta poll every 20s up to 5 min, auto-download when ready.
 *   · any fetch failure with a cache -> onError({hasCache:true, background})
 *     — the app shows the cached-index banner, never a fake empty state.
 *   · IndexedDB unavailable (private mode) -> memory-only + ONE
 *     onError({degraded:'no-persist'}) info notice.
 */
(function () {
    'use strict';

    var DB_NAME = 'design-vault';
    var DB_VERSION = 1;
    var STORE_NAME = 'index';
    var KEY = 'current';
    var STALE_MS = 24 * 60 * 60 * 1000;   // freshness pill flips amber past this
    var INDEX_TIMEOUT_MS = 120000;        // big download: bypass the global 15s fetch guard
    var POLL_INTERVAL_MS = 20000;
    var POLL_MAX_MS = 5 * 60 * 1000;

    var cb = {};             // init() callbacks
    var db = null;           // IDBDatabase | null (memory-only fallback)
    var current = null;      // decoded index (the getIndex() shape)
    var payload = null;      // raw wire JSON — rows array is SHARED with current.rows (merge mutates in place)
    var etag = '';
    var booted = false;
    var degradedSent = false;
    var pollTimer = null;

    function apiUrl(path) { return window.APP_CONFIG.API.BASE_URL + path; }

    function emit(name) {
        var fn = cb[name];
        if (typeof fn !== 'function') return;
        try { fn.apply(null, Array.prototype.slice.call(arguments, 1)); }
        catch (e) { console.error('[DG.store] ' + name + ' handler threw:', e); }
    }

    // ── IndexedDB (all failures degrade to memory-only, reported once) ──
    function degraded(err) {
        if (degradedSent) return;
        degradedSent = true;
        emit('onError', err || new Error('IndexedDB unavailable'), { degraded: 'no-persist', hasCache: !!current });
    }

    function openDb() {
        return new Promise(function (resolve) {
            var idb = window.indexedDB;
            if (!idb) { degraded(new Error('IndexedDB is not available — index will not persist.')); resolve(null); return; }
            var req;
            try { req = idb.open(DB_NAME, DB_VERSION); }
            catch (e) { degraded(e); resolve(null); return; }
            req.onupgradeneeded = function () {
                var d = req.result;
                if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { degraded(req.error || new Error('IndexedDB open failed')); resolve(null); };
            req.onblocked = function () { resolve(null); };
        });
    }

    function readCache() {
        return new Promise(function (resolve) {
            if (!db) { resolve(null); return; }
            try {
                var rq = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY);
                rq.onsuccess = function () { resolve(rq.result || null); };
                rq.onerror = function () { resolve(null); };
            } catch (e) { resolve(null); }
        });
    }

    function persist() {
        return new Promise(function (resolve) {
            if (!db || !payload) { resolve(); return; }
            try {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(
                    { version: payload.version, savedAt: Date.now(), etag: etag, payload: payload }, KEY);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { degraded(tx.error); resolve(); };
                tx.onabort = function () { degraded(tx.error); resolve(); };
            } catch (e) { degraded(e); resolve(); }
        });
    }

    /**
     * Record a thumbnail the grid fetched on demand (designs whose index row
     * had no image but whose source bits promised a ShopWorks thumbnail).
     * Patches the raw row AND the decoded record so a re-render — or the next
     * visit, after the debounced persist — keeps the image instead of
     * re-fetching it. Called by DG.grid after a /api/thumbnails/by-designs fill.
     */
    var persistTimer = null;
    function patchImage(dn, url) {
        dn = +dn || 0;
        if (!dn || !url || !current || !current.rows) return;

        // rows are sorted by design number — binary search, no full scan.
        var rows = current.rows, lo = 0, hi = rows.length - 1, at = -1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (rows[mid][0] === dn) { at = mid; break; }
            if (rows[mid][0] < dn) lo = mid + 1; else hi = mid - 1;
        }
        if (at === -1) return;
        if (rows[at][10]) return;              // never overwrite an index-supplied image
        rows[at][10] = 'u:' + url;

        // Same object the grid and drawer already hold a reference to.
        var rec = (window.DG && DG.search && DG.search.byDn) ? DG.search.byDn(dn) : null;
        if (rec && !rec.imgUrl) rec.imgUrl = url;

        clearTimeout(persistTimer);
        persistTimer = setTimeout(function () { persist(); }, 4000);
    }

    // ── decode wire payload → the getIndex() shape ──
    function buildDecoded(p) {
        var dup = new Map();
        (p.dupClusters || []).forEach(function (cluster) {
            (cluster || []).forEach(function (dn) { dup.set(dn, cluster); });
        });
        return {
            version: p.version || '',
            builtAt: p.builtAt || 0,
            rows: p.rows,                 // raw positional rows (merge mutates these)
            dicts: p.dicts || {},
            srcBits: p.srcBits || {},
            dupByDn: dup,
            counts: p.counts || {}
        };
    }

    function fireStale() {
        if (!current || !current.builtAt) return;
        var age = Date.now() - current.builtAt;
        if (age > STALE_MS) emit('onStale', age);
    }

    // ── streamed download with progress ──
    function readBodyWithProgress(res) {
        var totalRaw = parseInt(res.headers.get('Content-Length'), 10);
        var total = (isFinite(totalRaw) && totalRaw > 0) ? totalRaw : null;
        if (!res.body || typeof res.body.getReader !== 'function') {
            return res.text().then(function (t) { emit('onProgress', t.length, total, 'download'); return t; });
        }
        var reader = res.body.getReader();
        var chunks = [];
        var loaded = 0;
        function pump() {
            return reader.read().then(function (step) {
                if (step.done) {
                    var buf = new Uint8Array(loaded);
                    var off = 0;
                    for (var i = 0; i < chunks.length; i++) { buf.set(chunks[i], off); off += chunks[i].length; }
                    return new TextDecoder('utf-8').decode(buf);
                }
                chunks.push(step.value);
                loaded += step.value.length;
                // Content-Length is the gzip size but chunks arrive decompressed — clamp.
                emit('onProgress', total && loaded > total ? total : loaded, total, 'download');
                return pump();
            });
        }
        return pump();
    }

    function downloadIndex() {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, INDEX_TIMEOUT_MS);
        var headers = {};
        if (etag) headers['If-None-Match'] = etag;
        emit('onProgress', 0, null, 'download');
        return fetch(apiUrl('/api/design-search/index'), { headers: headers, signal: ctrl.signal })
            .then(function (res) {
                if (res.status === 304) { persist(); return current; } // already newest — refresh savedAt
                if (res.status === 503) {
                    return res.json().catch(function () { return {}; }).then(function (body) {
                        var e = new Error(body.message || 'The design index is still building on the server.');
                        e.building = true;
                        e.retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 60;
                        throw e;
                    });
                }
                if (!res.ok) throw new Error('Index download failed (HTTP ' + res.status + ')');
                var newTag = res.headers.get('ETag') || '';
                return readBodyWithProgress(res).then(function (text) {
                    emit('onProgress', text.length, text.length, 'parse');
                    var p = JSON.parse(text);
                    if (!p || !Array.isArray(p.rows)) throw new Error('Index payload malformed — rows missing.');
                    payload = p;
                    etag = newTag || p.version || '';
                    current = buildDecoded(p);
                    emit('onProgress', text.length, text.length, 'save');
                    return persist().then(function () {
                        emit('onReady', current);
                        fireStale();
                        return current;
                    });
                });
            })
            .finally(function () { clearTimeout(timer); });
    }

    // ── background freshness: /meta probe, then /recent delta-merge ──
    function fetchMeta() {
        return fetch(apiUrl('/api/design-search/meta'))
            .then(function (r) {
                if (!r.ok) throw new Error('Index meta check failed (HTTP ' + r.status + ')');
                return r.json();
            });
    }

    function metaRecheck() {
        fetchMeta()
            .then(function (meta) {
                if (meta && meta.version && current && meta.version !== current.version) {
                    return downloadIndex(); // server rebuilt — pull the new index
                }
                return fetchRecent();
            })
            .catch(function (err) {
                emit('onError', err, { hasCache: !!current, background: true });
                fireStale();
            });
    }

    function fetchRecent() {
        return fetch(apiUrl('/api/design-search/recent'))
            .then(function (r) {
                if (!r.ok) throw new Error('Recent-designs check failed (HTTP ' + r.status + ')');
                return r.json();
            })
            .then(function (data) {
                if (!data || data.success === false) throw new Error(data && data.error || 'Recent-designs check failed.');
                // Dict indices in recent rows refer to the base build's dictionaries —
                // if the server has moved to a different base, merge would mislabel.
                if (data.baseVersion && current && data.baseVersion !== current.version) {
                    return downloadIndex();
                }
                var rows = Array.isArray(data.rows) ? data.rows : [];
                var merged = rows.length ? window.DG.search.mergeRecent(current.rows, rows) : 0;
                if (merged) persist();
                emit('onRecentMerged', merged);
                fireStale();
            });
    }

    // ── first-visit path + 503 build-wait recovery ──
    function downloadFresh() {
        return downloadIndex().catch(function (err) {
            if (err && err.building && !current) {
                emit('onError', err, { hasCache: false, building: true });
                startMetaPoll();
                return;
            }
            emit('onError', err, { hasCache: !!current });
        });
    }

    function startMetaPoll() {
        if (pollTimer) return;
        var startedAt = Date.now();
        pollTimer = setInterval(function () {
            if (Date.now() - startedAt > POLL_MAX_MS) {
                clearInterval(pollTimer); pollTimer = null;
                emit('onError', new Error('The design index is still building after 5 minutes — press Retry.'),
                    { hasCache: false, final: true });
                return;
            }
            fetchMeta()
                .then(function (meta) {
                    if (meta && meta.ready) {
                        clearInterval(pollTimer); pollTimer = null;
                        downloadFresh();
                    }
                })
                .catch(function () { /* transient poll miss — the 5-min cap reports loudly */ });
        }, POLL_INTERVAL_MS);
    }

    // ── public API ──
    function init(opts) {
        if (booted) return; // one lifecycle per page load
        booted = true;
        cb = opts || {};

        if (!(window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)) {
            if (window.DashPage && window.DashPage.showError) {
                window.DashPage.showError('Configuration failed to load — refresh the page.');
            }
            emit('onError', new Error('APP_CONFIG missing'), { hasCache: false, config: true });
            return;
        }
        if (!(window.DG && window.DG.search)) {
            emit('onError', new Error('design-gallery-search.js must load before the store.'), { hasCache: false });
            return;
        }

        openDb()
            .then(function (opened) { db = opened; return readCache(); })
            .then(function (rec) {
                if (rec && rec.payload && Array.isArray(rec.payload.rows)) {
                    payload = rec.payload;
                    etag = rec.etag || rec.payload.version || '';
                    current = buildDecoded(payload);
                    emit('onReady', current);   // paint instantly from cache…
                    fireStale();
                    metaRecheck();              // …then verify freshness in the background
                } else {
                    downloadFresh();
                }
            });
    }

    function getIndex() { return current; }

    function refresh() {
        return downloadIndex().catch(function (err) {
            emit('onError', err, { hasCache: !!current, refresh: true });
            throw err;
        });
    }

    window.DG = window.DG || {};
    window.DG.store = { init: init, getIndex: getIndex, refresh: refresh, patchImage: patchImage };
})();
