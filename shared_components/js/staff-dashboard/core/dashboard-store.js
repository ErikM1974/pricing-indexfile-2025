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
    pinnedTools:            { storage: 'local',   key: 'nwca-dash:pinned',         version: STORE_VERSION },
    recentTools:            { storage: 'local',   key: 'nwca-dash:recent',         version: STORE_VERSION, ttlMs: 14 * 24 * 60 * 60 * 1000 }, // 14 days
    dismissedAnnouncements: { storage: 'local',   key: 'nwca-dash:dismissed-ann',  version: STORE_VERSION, ttlMs: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    policiesCollapsed:      { storage: 'local',   key: 'nwca-dash:policies',       version: STORE_VERSION },

    // sessionStorage (transient, per-tab)
    user:                   { storage: 'session', key: 'nwca-dash:user',           version: STORE_VERSION },
    metricsCache:           { storage: 'session', key: 'nwca-dash:metrics-cache',  version: STORE_VERSION, ttlMs: 5 * 60 * 1000 },  // 5 min
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
