/**
 * decoration-methods.js — DECORATION METHOD ELIGIBILITY (shared module)
 *
 * Single front-end source of truth for "which decoration methods can we
 * actually produce for this garment?". Backed by the proxy endpoint:
 *
 *   GET {API_BASE}/api/decoration-methods
 *   → { rules:     [{ category, EMB, DTG, SCP, DTF, dtgCottonGate, notes }],
 *       overrides: [{ styleNumber, method, allow, note }] }
 *
 * Consumers (product.html decoration tabs, /catalog Decoration filter) call:
 *
 *   await DecorationMethods.eligibleFor(product)
 *     → { EMB: bool, DTG: 'yes'|'warn'|'no', SCP: bool, DTF: bool,
 *         source: 'rules'|'fallback' }
 *   await DecorationMethods.categoriesFor('emb'|'dtg'|'scp'|'dtf')
 *     → [category, …] or null when the rules feed is unavailable
 *
 * FAILURE MODE (Erik's #1 rule, adapted — never silently offer a method we
 * can't produce): when the API is unreachable OR the category has no rules
 * row, eligibleFor returns the embroidery-only safe set with
 * source:'fallback', and the CALLER MUST render a visible alert-warn
 * ("Showing embroidery pricing — other decoration options may be available,
 * call 253-922-5793").
 *
 * Caching: sessionStorage, 1 hour TTL; cache is dropped and refetched on any
 * parse/shape error. Failures are never cached (next call retries).
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var ENDPOINT = '/api/decoration-methods';
    var CACHE_KEY = 'nwca.decorationMethods.v1';
    var CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

    var METHOD_KEYS = ['EMB', 'DTG', 'SCP', 'DTF'];

    // ── DTG cotton gate heuristics (PRODUCT_DESCRIPTION) ──────────────
    var RE_COTTON_YES = /100%\s*(ring\s*spun\s*|combed\s*|organic\s*)*cotton/i;
    var RE_COTTON_BLEND = /(\d{2}\/\d{2}|cotton.?\/.?poly|poly.?\/.?cotton|heather|blend)/i;
    var RE_NOT_COTTON = /(100%\s*poly|polyester|posicharge|nylon|moisture.?wick|performance)/i;

    var rulesPromise = null; // in-flight / settled load (nulled on failure so callers retry)

    function trim(v) { return String(v == null ? '' : v).trim(); }

    /** Caspio collapses whitespace + category names drift in case — match loose. */
    function normKey(v) { return trim(v).toLowerCase(); }

    /** Embroidery-only safe set — caller must surface a visible warning. */
    function fallbackResult() {
        return { EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' };
    }

    function readCache() {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var wrapped = JSON.parse(raw);
            if (!wrapped || typeof wrapped.at !== 'number'
                || !wrapped.data || !Array.isArray(wrapped.data.rules) || !Array.isArray(wrapped.data.overrides)) {
                sessionStorage.removeItem(CACHE_KEY); // shape drift → refetch
                return null;
            }
            if (Date.now() - wrapped.at > CACHE_TTL_MS) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }
            return wrapped.data;
        } catch (err) {
            // Parse error (or storage blocked) → drop the cache and refetch
            try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { /* storage unavailable */ }
            return null;
        }
    }

    function writeCache(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
        } catch (err) { /* private mode / quota — the page-life promise still caches */ }
    }

    /**
     * Load {rules, overrides} from sessionStorage or the API.
     * Resolves null when unreachable / malformed (NEVER rejects) — and does
     * not memoize the failure, so the next call retries.
     */
    function loadRules() {
        if (rulesPromise) return rulesPromise;
        var cached = readCache();
        if (cached) {
            rulesPromise = Promise.resolve(cached);
            return rulesPromise;
        }
        rulesPromise = fetch(API_BASE + ENDPOINT)
            .then(function (resp) {
                if (!resp.ok) throw new Error('decoration-methods returned ' + resp.status);
                return resp.json();
            })
            .then(function (json) {
                if (!json || !Array.isArray(json.rules) || json.rules.length === 0) {
                    throw new Error('decoration-methods response missing rules[]');
                }
                var data = {
                    rules: json.rules,
                    overrides: Array.isArray(json.overrides) ? json.overrides : []
                };
                writeCache(data);
                return data;
            })
            .catch(function (err) {
                console.error('[DecorationMethods] Rules unavailable — callers must use the embroidery-only fallback with a visible warning:', err);
                rulesPromise = null; // retry on next call
                return null;
            });
        return rulesPromise;
    }

    function findRule(rules, categoryName) {
        var want = normKey(categoryName);
        if (!want) return null;
        for (var i = 0; i < rules.length; i++) {
            if (rules[i] && normKey(rules[i].category) === want) return rules[i];
        }
        return null;
    }

    /**
     * DTG cotton gate: 'yes' (true 100% cotton) / 'warn' (blend, or fabric
     * unknown — prints with a softer, vintage look) / 'no' (poly/performance).
     */
    function dtgCottonGate(product) {
        var sub = trim(product && (product.SUBCATEGORY_NAME != null ? product.SUBCATEGORY_NAME : product.subcategory));
        var desc = trim(product && (product.PRODUCT_DESCRIPTION != null ? product.PRODUCT_DESCRIPTION : product.description));
        if (sub === '100% Cotton' || RE_COTTON_YES.test(desc)) return 'yes';
        if (RE_COTTON_BLEND.test(desc)) return 'warn';
        if (RE_NOT_COTTON.test(desc)) return 'no';
        return 'warn'; // fabric unknown — we confirm on the proof
    }

    function styleOf(product) {
        if (!product) return '';
        return normKey(product.STYLE || product.styleNumber || product.STYLE_NUMBER || product.style);
    }

    /**
     * Eligibility for one product. Accepts raw Caspio rows (CATEGORY_NAME /
     * SUBCATEGORY_NAME / PRODUCT_DESCRIPTION / STYLE) or the camelCase shape
     * (category / subcategory / description / styleNumber).
     */
    async function eligibleFor(product) {
        var data = await loadRules();
        var category = product && (product.CATEGORY_NAME != null ? product.CATEGORY_NAME : product.category);
        var rule = data ? findRule(data.rules, category) : null;
        if (!rule) return fallbackResult(); // API unreachable OR category not in rules

        var allow = { EMB: !!rule.EMB, DTG: !!rule.DTG, SCP: !!rule.SCP, DTF: !!rule.DTF };

        // Per-style overrides. For DTG, an explicit allow:true pins 'yes'
        // (a deliberate per-style decision beats the fabric heuristics —
        // otherwise the override could never turn DTG on for a poly garment).
        var dtgForced = null;
        var style = styleOf(product);
        if (style && data.overrides.length) {
            data.overrides.forEach(function (o) {
                if (!o || normKey(o.styleNumber) !== style) return;
                var m = trim(o.method).toUpperCase();
                if (METHOD_KEYS.indexOf(m) === -1) return;
                allow[m] = !!o.allow;
                if (m === 'DTG') dtgForced = o.allow ? 'yes' : 'no';
            });
        }

        var dtg = 'no';
        if (allow.DTG) {
            if (dtgForced) dtg = dtgForced;
            else dtg = rule.dtgCottonGate ? dtgCottonGate(product) : 'yes';
        }

        return { EMB: allow.EMB, DTG: dtg, SCP: allow.SCP, DTF: allow.DTF, source: 'rules' };
    }

    /**
     * Categories a method can decorate (for the catalog Decoration filter).
     * Returns trimmed category names where the method flag is true, or null
     * when the rules feed is unavailable (caller renders the filter disabled
     * with a note — never hidden silently). DTG returns categories where DTG
     * is true; the cotton-gate refinement happens on the product page.
     */
    async function categoriesFor(method) {
        var m = trim(method).toUpperCase();
        if (METHOD_KEYS.indexOf(m) === -1) return null;
        var data = await loadRules();
        if (!data) return null;
        var out = [];
        data.rules.forEach(function (rule) {
            var cat = trim(rule && rule.category);
            if (cat && rule[m]) out.push(cat);
        });
        return out;
    }

    /** True when the rules feed loaded (from cache or API). */
    async function isAvailable() {
        return (await loadRules()) !== null;
    }

    window.DecorationMethods = {
        eligibleFor: eligibleFor,
        categoriesFor: categoriesFor,
        isAvailable: isAvailable,
        fallbackResult: fallbackResult
    };
})();
