/* dash-tabs.js — accessible tab router for dash-shell dashboard pages.
 *
 * window.DashTabs.create(opts) → { activate, current, isMounted, resetMounted, setBadge, ids }
 *
 * WHY THIS EXISTS: seven pages in this repo had each hand-rolled their own tabs, and every
 * one of them got a different part wrong — sanmar-payables has 5 lines with no keyboard
 * support and role="tab" without aria-selected/aria-controls; unqualified-leads, finished-
 * photos, quote-management and customer-portal-admin are four more variants. This is the
 * first shared one. It knows nothing about data, fetching or any particular page.
 *
 * WHAT IT OWNS
 *   - visual switch: aria-selected, roving tabindex, panel [hidden]  (SYNCHRONOUS, no await)
 *   - keyboard per the ARIA APG tabs pattern: Left/Right wrap, Home/End, 1-9 by position
 *   - URL hash sync (#tab=<id>) via replaceState, plus a hashchange listener
 *   - "has this tab ever been activated" bookkeeping, so callers can lazy-load once
 *   - badge counts, kept in the accessible name as well as the visible pill
 *
 * WHAT IT DOES NOT OWN: skeletons, fetches, caches, scroll position, badge VALUES.
 *
 * 🔑 onActivate is DEBOUNCED (activateDelay) but the visual switch never is. With automatic
 * activation — arrow key moves AND switches, the APG preference for cheap panels — holding
 * Right from the first tab to the last would otherwise fire every tab's data load in turn.
 * Debouncing only the data hook keeps the UI instant and still costs one fetch burst.
 *
 * 🔑 Panels use the `hidden` ATTRIBUTE, not a .is-active class, so a page needs
 * `[hidden]{display:none!important}` in its stylesheet — an author `display` rule beats the
 * UA sheet's [hidden] regardless of specificity (LESSONS_LEARNED recurrence #5). create()
 * detects that at runtime and warns loudly rather than silently showing every panel at once.
 */
(function () {
    'use strict';

    var KEY_NAV = { ArrowLeft: -1, ArrowRight: 1, Left: -1, Right: 1 };

    function parseHash(hashKey) {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        if (!raw) return '';
        // Tolerant: accept `#tab=money`, bare `#money`, and extra keys we don't own
        // (`#tab=money&focus=x` — the emailed-digest deep-link contract). Unknown keys are
        // ignored here, never an error: a stale link must land somewhere sane, not break.
        if (raw.indexOf('=') === -1) return decodeURIComponent(raw);
        var found = '';
        raw.split('&').forEach(function (pair) {
            var bits = pair.split('=');
            if (decodeURIComponent(bits[0]) === hashKey) found = decodeURIComponent(bits.slice(1).join('=') || '');
        });
        return found;
    }

    // Preserve any other keys already in the hash so we never clobber `&focus=`.
    function writeHash(hashKey, id) {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        var parts = [];
        if (raw.indexOf('=') !== -1) {
            raw.split('&').forEach(function (pair) {
                if (decodeURIComponent(pair.split('=')[0]) !== hashKey) parts.push(pair);
            });
        }
        parts.unshift(encodeURIComponent(hashKey) + '=' + encodeURIComponent(id));
        var next = '#' + parts.join('&');
        if (('#' + raw) === next) return;
        // replaceState, NOT pushState: with 4-6 tabs, pushState traps someone who clicked
        // four tabs behind four Back presses. Back should leave the page.
        try { history.replaceState(null, '', window.location.pathname + window.location.search + next); }
        catch (e) { window.location.hash = next; }   // file:// and other opaque-origin cases
    }

    function create(opts) {
        opts = opts || {};
        var tablist = typeof opts.tablist === 'string' ? document.querySelector(opts.tablist) : opts.tablist;
        if (!tablist) { console.error('[DashTabs] tablist not found:', opts.tablist); return null; }

        var tabs = Array.prototype.slice.call(tablist.querySelectorAll(opts.tabSelector || '[role="tab"]'));
        if (!tabs.length) { console.error('[DashTabs] no tabs inside', opts.tablist); return null; }

        var hashKey = opts.hashKey || 'tab';
        var delay = typeof opts.activateDelay === 'number' ? opts.activateDelay : 250;
        var onActivate = typeof opts.onActivate === 'function' ? opts.onActivate : function () {};
        var onBeforeSwitch = typeof opts.onBeforeSwitch === 'function' ? opts.onBeforeSwitch : null;

        var mounted = {};
        var current = '';
        var timer = null;

        function idOf(tab) { return tab.getAttribute('data-tab') || ''; }
        function tabById(id) {
            for (var i = 0; i < tabs.length; i++) if (idOf(tabs[i]) === id) return tabs[i];
            return null;
        }
        function panelOf(tab) { return document.getElementById(tab.getAttribute('aria-controls') || ''); }
        function ids() { return tabs.map(idOf); }

        // One-time sanity check: if a panel is still visible while [hidden], the page is
        // missing the [hidden] guard and every panel would render stacked. Fail loudly.
        function assertHiddenWorks() {
            var p = panelOf(tabs[0]);
            if (!p) return;
            var was = p.hidden;
            p.hidden = true;
            var display = window.getComputedStyle(p).display;
            p.hidden = was;
            if (display !== 'none') {
                console.error('[DashTabs] `hidden` is being overridden on ' + p.id +
                    ' (computed display: ' + display + '). Add `[hidden]{display:none!important}` to ' +
                    'the page stylesheet, or tab switching will not hide anything.');
            }
        }

        function setBadge(id, n) {
            var tab = tabById(id);
            if (!tab) return;
            var badge = tab.querySelector('.mc-tab-badge, [data-tab-badge]');
            if (!badge) return;
            var label = tab.getAttribute('data-label') || tab.textContent.trim();
            if (n === null || n === undefined || n === 0 || n === '') {
                badge.hidden = true;
                badge.textContent = '';
                tab.removeAttribute('aria-label');   // fall back to the visible text
            } else {
                badge.hidden = false;
                badge.textContent = String(n);
                // A screen reader would otherwise announce "Today 7" with no unit.
                tab.setAttribute('aria-label', label + ', ' + n + ' ' +
                    (tab.getAttribute('data-badge-noun') || 'items') + ' needing attention');
            }
        }

        function activate(id, o) {
            o = o || {};
            var tab = tabById(id) || tabById(opts.defaultTab || ids()[0]);
            if (!tab) return;
            var next = idOf(tab);
            if (next === current && !o.force) return;
            if (onBeforeSwitch && onBeforeSwitch(current, next) === false) return;

            // --- visual switch: synchronous, always ---
            tabs.forEach(function (t) {
                var on = t === tab;
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;            // roving tabindex: one stop, not N
                var p = panelOf(t);
                if (p) p.hidden = !on;
            });
            current = next;
            if (!o.silent) writeHash(hashKey, current);

            if (o.focusTab) tab.focus();
            // Deep link / hashchange: put focus in the PANEL so a screen-reader user following
            // an emailed link lands in content. A click leaves focus on the button, because
            // moving it into the panel would break arrow-key browsing.
            if (o.focusPanel) {
                var p = panelOf(tab);
                if (p) p.focus();
            }

            // --- data hook: debounced, and only the trailing one wins ---
            var isFirst = !mounted[current];
            mounted[current] = true;
            if (timer) { clearTimeout(timer); timer = null; }
            var run = function () { timer = null; onActivate(current, isFirst); };
            if (o.immediate || delay <= 0) run(); else timer = setTimeout(run, delay);
        }

        function moveFocus(delta) {
            var i = tabs.indexOf(document.activeElement);
            if (i === -1) return;
            var n = (i + delta + tabs.length) % tabs.length;   // wrap, per APG
            activate(idOf(tabs[n]), { focusTab: true });
        }

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () { activate(idOf(tab)); });
        });

        tablist.addEventListener('keydown', function (e) {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (KEY_NAV[e.key]) { e.preventDefault(); moveFocus(KEY_NAV[e.key]); return; }
            if (e.key === 'Home') { e.preventDefault(); activate(ids()[0], { focusTab: true }); return; }
            if (e.key === 'End') { e.preventDefault(); activate(ids()[tabs.length - 1], { focusTab: true }); return; }
            // Number keys jump by position — scoped to the tablist, so there is NO global
            // handler to hijack typing in a form field somewhere else on the page.
            if (/^[1-9]$/.test(e.key)) {
                var n = parseInt(e.key, 10) - 1;
                if (n < tabs.length) { e.preventDefault(); activate(idOf(tabs[n]), { focusTab: true }); }
            }
        });

        window.addEventListener('hashchange', function () {
            var id = parseHash(hashKey);
            if (id && tabById(id) && id !== current) {
                activate(id, { silent: true, focusPanel: !!opts.focusPanelOnDeepLink });
            }
        });

        assertHiddenWorks();

        // Boot: honor a deep link, else the default. `immediate` so a deep-linked tab doesn't
        // sit empty for the debounce interval on first paint.
        var initial = parseHash(hashKey);
        var deep = !!(initial && tabById(initial));
        activate(deep ? initial : (opts.defaultTab || ids()[0]), {
            force: true, immediate: true, silent: !deep,
            focusPanel: deep && !!opts.focusPanelOnDeepLink,
        });

        return {
            activate: function (id) { activate(id); },
            current: function () { return current; },
            isMounted: function (id) { return !!mounted[id]; },
            resetMounted: function () { mounted = {}; mounted[current] = true; },
            setBadge: setBadge,
            ids: ids,
        };
    }

    window.DashTabs = { create: create, parseHash: parseHash };
}());
