/* =====================================================
   STAFF DASHBOARD v2 — TWEAKS PANEL
   Floating button + drawer that toggles theme, accent, and
   density. Settings persist to localStorage and apply via
   data-attributes on <body> so the v2 token CSS picks them up.
   ===================================================== */

(function () {
    'use strict';

    var STORAGE_KEY = 'nwca-staff-dash-v2-tweaks';

    var DEFAULTS = {
        theme: 'dark',
        accent: 'green',
        density: 'comfy'
    };

    // Dashboard ships dark-only. Light tokens still ship in the
    // CSS for future use, but the picker doesn't expose them.
    var THEMES   = [{ id: 'dark',  label: 'Dark'  }];
    var ACCENTS  = [
        { id: 'green',  label: 'NW Green', swatch: 'oklch(54% 0.16 150)' },
        { id: 'blue',   label: 'Blue',     swatch: 'oklch(54% 0.16 240)' },
        { id: 'violet', label: 'Violet',   swatch: 'oklch(54% 0.16 290)' },
        { id: 'amber',  label: 'Amber',    swatch: 'oklch(64% 0.16 70)'  }
    ];
    var DENSITIES = [{ id: 'comfy', label: 'Comfy' }, { id: 'compact', label: 'Compact' }];

    function loadTweaks() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return Object.assign({}, DEFAULTS);
            var parsed = JSON.parse(raw);
            return {
                theme:   THEMES.some(function (t) { return t.id === parsed.theme; })   ? parsed.theme   : DEFAULTS.theme,
                accent:  ACCENTS.some(function (a) { return a.id === parsed.accent; }) ? parsed.accent  : DEFAULTS.accent,
                density: DENSITIES.some(function (d) { return d.id === parsed.density; }) ? parsed.density : DEFAULTS.density
            };
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function saveTweaks(tweaks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
        } catch (e) {
            // Storage full / disabled — silently continue.
        }
    }

    function applyTweaks(tweaks) {
        var body = document.body;
        if (!body) return;
        body.setAttribute('data-theme', tweaks.theme);
        body.setAttribute('data-accent', tweaks.accent);
        body.setAttribute('data-density', tweaks.density);
    }

    /**
     * Apply tweaks early (before DOMContentLoaded) to avoid theme flicker.
     * The HTML calls this synchronously near the top of <body>.
     */
    function applyEarly() {
        var tweaks = loadTweaks();
        // The body element exists by the time this runs (script placed at top of <body>).
        applyTweaks(tweaks);
    }

    function buildFab() {
        var btn = document.createElement('button');
        btn.className = 'v2-tweaks-fab';
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', 'Open dashboard tweaks');
        btn.setAttribute('title', 'Tweaks: theme, accent, density');
        btn.innerHTML = '<i class="fas fa-sliders-h" aria-hidden="true"></i>';
        return btn;
    }

    function buildOption(label, isActive, onClick, swatchColor) {
        var b = document.createElement('button');
        b.className = 'v2-tweaks-btn' + (isActive ? ' active' : '');
        b.setAttribute('type', 'button');
        if (swatchColor) {
            var sw = document.createElement('span');
            sw.className = 'v2-tweaks-swatch';
            sw.style.background = swatchColor;
            b.appendChild(sw);
        }
        var text = document.createElement('span');
        text.textContent = label;
        b.appendChild(text);
        b.addEventListener('click', onClick);
        return b;
    }

    function buildPanel(tweaks, onChange) {
        var panel = document.createElement('div');
        panel.className = 'v2-tweaks-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Dashboard tweaks');

        function renderInto(container) {
            container.innerHTML = '';

            // ACCENT
            var accentSection = document.createElement('div');
            accentSection.className = 'v2-tweaks-section';
            var accentHead = document.createElement('h4');
            accentHead.textContent = 'Accent color';
            accentSection.appendChild(accentHead);
            var accentRow1 = document.createElement('div');
            accentRow1.className = 'v2-tweaks-row';
            var accentRow2 = document.createElement('div');
            accentRow2.className = 'v2-tweaks-row';
            ACCENTS.forEach(function (a, i) {
                var btn = buildOption(
                    a.label,
                    tweaks.accent === a.id,
                    function () { tweaks.accent = a.id; onChange(tweaks); renderInto(container); },
                    a.swatch
                );
                (i < 2 ? accentRow1 : accentRow2).appendChild(btn);
            });
            accentSection.appendChild(accentRow1);
            accentSection.appendChild(accentRow2);
            container.appendChild(accentSection);

            // DENSITY
            var densSection = document.createElement('div');
            densSection.className = 'v2-tweaks-section';
            var densHead = document.createElement('h4');
            densHead.textContent = 'Density';
            densSection.appendChild(densHead);
            var densRow = document.createElement('div');
            densRow.className = 'v2-tweaks-row';
            DENSITIES.forEach(function (d) {
                densRow.appendChild(buildOption(
                    d.label,
                    tweaks.density === d.id,
                    function () { tweaks.density = d.id; onChange(tweaks); renderInto(container); }
                ));
            });
            densSection.appendChild(densRow);
            container.appendChild(densSection);

            // FOOTER
            var footer = document.createElement('div');
            footer.className = 'v2-tweaks-footer';
            footer.textContent = 'Settings save to this browser.';
            container.appendChild(footer);
        }

        renderInto(panel);
        return panel;
    }

    function mount() {
        if (document.querySelector('.v2-tweaks-fab')) return; // idempotent

        var tweaks = loadTweaks();
        applyTweaks(tweaks);

        var fab = buildFab();
        var panel = buildPanel(tweaks, function (next) {
            saveTweaks(next);
            applyTweaks(next);
        });

        function togglePanel() {
            panel.classList.toggle('open');
        }

        function closeOnOutsideClick(e) {
            if (!panel.contains(e.target) && !fab.contains(e.target)) {
                panel.classList.remove('open');
            }
        }

        fab.addEventListener('click', togglePanel);
        document.addEventListener('click', closeOnOutsideClick);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') panel.classList.remove('open');
        });

        document.body.appendChild(panel);
        document.body.appendChild(fab);
    }

    // Apply theme attributes immediately (this script is loaded synchronously
    // near the top of <body>, so document.body exists).
    applyEarly();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    // Public hook for debugging / programmatic control
    window.StaffDashboardV2Tweaks = {
        get: loadTweaks,
        set: function (partial) {
            var current = loadTweaks();
            var next = Object.assign({}, current, partial || {});
            saveTweaks(next);
            applyTweaks(next);
        },
        reset: function () {
            saveTweaks(DEFAULTS);
            applyTweaks(DEFAULTS);
        }
    };
})();
