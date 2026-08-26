/* =====================================================
   STAFF DASHBOARD v3 — VERSIONED STATE STORE
   Centralizes localStorage + sessionStorage access with:
   - Namespaced keys (nwca-dash:*)
   - Per-key version stamping (bump STORE_VERSION → self-evict)
   - Per-key TTL (auto-expire stale entries)
   - Safe JSON parsing (corrupt entries return null, don't throw)
   ===================================================== */

const STORE_VERSION = 1;

const KEYS = {
    // localStorage (persistent across sessions)
    tweaks:                 { storage: 'local',   key: 'nwca-dash:tweaks',         version: STORE_VERSION },
    sidebarSections:        { storage: 'local',   key: 'nwca-dash:sidebar',        version: STORE_VERSION },
    widgetCollapse:         { storage: 'local',   key: 'nwca-dash:widgets',        version: STORE_VERSION },
    // (pinnedTools/recentTools removed 2026-08-26 — My Stuff pins/recents live in
    // my-stuff-controller's own 'nwca-mystuff-v1' key; these entries never had a reader.)
    dismissedAnnouncements: { storage: 'local',   key: 'nwca-dash:dismissed-ann',  version: STORE_VERSION, ttlMs: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    policiesCollapsed:      { storage: 'local',   key: 'nwca-dash:policies',       version: STORE_VERSION },

    // sessionStorage (transient, per-tab)
    user:                   { storage: 'session', key: 'nwca-dash:user',           version: STORE_VERSION },
    // TTL deliberately UNDER dashboard-app's 5-min refresh interval so each
    // periodic tick misses this client cache and re-asks the proxy (whose own
    // 5-min cache still governs Caspio quota). At exactly 5 min the tick
    // usually landed a few seconds inside the TTL and re-served stale data.
    metricsCache:           { storage: 'session', key: 'nwca-dash:metrics-cache',  version: STORE_VERSION, ttlMs: 4 * 60 * 1000 },  // 4 min
    ytdArchiveCache:        { storage: 'session', key: 'nwca-dash:ytd-archive',    version: STORE_VERSION, ttlMs: 5 * 60 * 1000 },  // 5 min
    garmentTrackerCache:    { storage: 'session', key: 'nwca-dash:garment-cache',  version: STORE_VERSION, ttlMs: 30 * 60 * 1000 }, // 30 min
};

function getStorage(name) {
    const cfg = KEYS[name];
    if (!cfg) throw new Error(`[dashboard-store] Unknown key: ${name}`);
    return cfg.storage === 'session' ? window.sessionStorage : window.localStorage;
}

function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
}

function isExpired(entry, cfg) {
    if (!cfg.ttlMs) return false;
    if (typeof entry?.ts !== 'number') return true;
    return (Date.now() - entry.ts) > cfg.ttlMs;
}

export const store = {
    /**
     * Read a value. Returns null if missing, version-stale, or TTL-expired.
     */
    get(name) {
        const cfg = KEYS[name];
        if (!cfg) throw new Error(`[dashboard-store] Unknown key: ${name}`);

        let raw;
        try { raw = getStorage(name).getItem(cfg.key); }
        catch { return null; }

        const entry = safeParse(raw);
        if (!entry) return null;

        if (entry.v !== cfg.version) return null;
        if (isExpired(entry, cfg))   return null;

        return entry.data;
    },

    /**
     * Write a value. Stamps current version + timestamp.
     * Silent on quota / storage failures (we don't want a broken localStorage
     * to break the page) BUT logs to console.
     */
    set(name, data) {
        const cfg = KEYS[name];
        if (!cfg) throw new Error(`[dashboard-store] Unknown key: ${name}`);

        const entry = { v: cfg.version, ts: Date.now(), data };
        try {
            getStorage(name).setItem(cfg.key, JSON.stringify(entry));
        } catch (err) {
            console.warn(`[dashboard-store] Failed to persist "${name}":`, err.message);
        }
    },

    /**
     * Delete a single key.
     */
    remove(name) {
        const cfg = KEYS[name];
        if (!cfg) throw new Error(`[dashboard-store] Unknown key: ${name}`);
        try { getStorage(name).removeItem(cfg.key); } catch { /* ignore */ }
    },

    /**
     * Nuke all dashboard keys (leaves other localStorage keys intact).
     * Useful for "Reset to defaults" + version migrations.
     */
    clearAll() {
        for (const name of Object.keys(KEYS)) {
            this.remove(name);
        }
    },
};

export const STORE_KEYS = Object.freeze(Object.keys(KEYS));
