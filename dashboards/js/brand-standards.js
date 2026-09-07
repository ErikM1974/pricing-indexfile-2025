/**
 * brand-standards.js — renders the Brand Standards page from shared_components/css/tokens.css (2026-09-07).
 *
 * Nothing here is typed by hand: the script fetches the token file the page itself links, parses each
 * `--name: value; /* note *\/` line inside `@layer tokens { :root { … } }` together with the section comment
 * that precedes it, and renders swatches (colour), samples (type / space / radius / shadow) or plain rows
 * (motion / z-index). The rendered values are the browser's COMPUTED ones, so an alias like
 * `--color-brand: var(--brand-500)` shows the resolved colour. Failure is visible (Erik's #1 rule).
 */
(function () {
    'use strict';

    var SECTION_TARGETS = [
        { test: /People & departments/i, target: 'people-sections' },
        { test: /Type families|type ramp|Line heights|Weights/i, target: 'type-sections' },
        { test: /Space scale|Radius|Shadows/i, target: 'space-sections' },
        { test: /Motion|Z-index/i, target: 'motion-sections' },
    ];

    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /** Parse the :root block: returns [{ title, note, tokens: [{ name, value, note }] }] in file order. */
    function parseTokens(css) {
        var root = css.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
        if (!root) return [];
        var lines = root[1].split(/\r?\n/);
        var sections = [];
        var current = null;
        var comment = null; // accumulating multi-line comment text
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (comment !== null) {
                comment += ' ' + line.replace(/\*\/\s*$/, '');
                if (/\*\/\s*$/.test(line)) { current = startSection(sections, comment); comment = null; }
                continue;
            }
            var m = line.match(/^--([a-z0-9-]+)\s*:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?$/);
            if (m) {
                if (!current) current = startSection(sections, 'Tokens');
                current.tokens.push({ name: '--' + m[1], value: m[2].trim(), note: m[3] || '' });
                continue;
            }
            if (line.indexOf('/*') === 0) {
                var body = line.replace(/^\/\*\s*/, '');
                if (/\*\/\s*$/.test(line)) current = startSection(sections, body.replace(/\s*\*\/\s*$/, ''));
                else comment = body;
            }
        }
        return sections;
    }

    function startSection(sections, text) {
        var parts = text.split(/\s+—\s+|\s+-\s+(?=[A-Z])/);
        var section = { title: parts[0].trim(), note: parts.slice(1).join(' — ').trim(), tokens: [] };
        sections.push(section);
        return section;
    }

    function computed(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function isColour(value) {
        return window.CSS && CSS.supports('color', value);
    }

    function renderColourSection(section) {
        var html = '<div class="group"><h3 class="group-title">' + escapeHTML(section.title) + '</h3>';
        if (section.note) html += '<p class="group-note">' + escapeHTML(section.note) + '</p>';
        html += '<div class="swatches">';
        section.tokens.forEach(function (t) {
            var resolved = computed(t.name) || t.value;
            html += '<div class="swatch"><div class="swatch-chip" data-swatch="' + escapeHTML(resolved) + '"></div>'
                + '<div class="swatch-body"><div class="swatch-name">' + escapeHTML(t.name) + '</div>'
                + '<div class="swatch-value">' + escapeHTML(t.value) + (resolved !== t.value ? ' → ' + escapeHTML(resolved) : '') + '</div>'
                + (t.note ? '<div class="swatch-note">' + escapeHTML(t.note) + '</div>' : '') + '</div></div>';
        });
        return html + '</div></div>';
    }

    function sampleFor(t) {
        var n = t.name;
        if (/^--font-size/.test(n)) return '<span class="sample-text" data-font-size="' + escapeHTML(t.value) + '">The quick brown fox — 24 pcs @ $12.50</span>';
        if (/^--font-(sans|mono)/.test(n)) return '<span class="sample-text' + (/mono/.test(n) ? ' sample-mono' : '') + '">The quick brown fox — 24 pcs @ $12.50</span>';
        if (/^--font-weight/.test(n)) return '<span class="sample-text" data-font-weight="' + escapeHTML(t.value) + '">The quick brown fox</span>';
        if (/^--line-height/.test(n)) return '<span class="sample-text" data-line-height="' + escapeHTML(t.value) + '">Two lines of body copy<br>at this line height</span>';
        if (/^--space-/.test(n)) return '<div class="sample-bar" data-width="' + escapeHTML(t.value) + '"></div>';
        if (/^--radius-/.test(n)) return '<div class="sample-box" data-radius="' + escapeHTML(t.value) + '"></div>';
        if (/^--shadow-/.test(n)) return '<div class="sample-shadow" data-shadow="' + escapeHTML(t.value) + '"></div>';
        return '';
    }

    function renderTableSection(section) {
        var html = '<div class="group"><h3 class="group-title">' + escapeHTML(section.title) + '</h3>';
        if (section.note) html += '<p class="group-note">' + escapeHTML(section.note) + '</p>';
        html += '<table class="token-table"><thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Use</th><th scope="col">Sample</th></tr></thead><tbody>';
        section.tokens.forEach(function (t) {
            html += '<tr><td><code>' + escapeHTML(t.name) + '</code></td><td><code>' + escapeHTML(t.value) + '</code></td>'
                + '<td>' + escapeHTML(t.note) + '</td><td>' + sampleFor(t) + '</td></tr>';
        });
        return html + '</tbody></table></div>';
    }

    /** Apply sample styles from data attributes (no inline style attributes in the markup — Rule 3). */
    function applySamples(root) {
        root.querySelectorAll('[data-swatch]').forEach(function (el) { el.style.background = el.dataset.swatch; });
        root.querySelectorAll('[data-font-size]').forEach(function (el) { el.style.fontSize = el.dataset.fontSize; });
        root.querySelectorAll('[data-font-weight]').forEach(function (el) { el.style.fontWeight = el.dataset.fontWeight; });
        root.querySelectorAll('[data-line-height]').forEach(function (el) { el.style.lineHeight = el.dataset.lineHeight; });
        root.querySelectorAll('[data-width]').forEach(function (el) { el.style.width = el.dataset.width; });
        root.querySelectorAll('[data-radius]').forEach(function (el) { el.style.borderRadius = el.dataset.radius; });
        root.querySelectorAll('[data-shadow]').forEach(function (el) { el.style.boxShadow = el.dataset.shadow; });
    }

    function targetFor(section) {
        for (var i = 0; i < SECTION_TARGETS.length; i++) {
            if (SECTION_TARGETS[i].test.test(section.title)) return SECTION_TARGETS[i].target;
        }
        return 'colour-sections';
    }

    function render(sections) {
        var buckets = {};
        var count = 0;
        sections.forEach(function (section) {
            if (!section.tokens.length) return;
            count += section.tokens.length;
            var target = targetFor(section);
            var colourish = section.tokens.every(function (t) { return isColour(computed(t.name) || t.value); });
            buckets[target] = (buckets[target] || '') + (colourish ? renderColourSection(section) : renderTableSection(section));
        });
        Object.keys(buckets).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = buckets[id]; // every interpolation above is escapeHTML-wrapped
            applySamples(el);
        });
        var footer = document.getElementById('token-count');
        if (footer) footer.textContent = count + ' tokens in ' + sections.length + ' groups';
    }

    function showError(err) {
        var box = document.getElementById('page-error');
        if (box) box.hidden = false;
        console.error('[brand-standards] token file failed:', err);
    }

    function init() {
        // The canonical SOURCE file, not the page's own <link>: staff pages are content-hashed, and the hashed
        // copy is minified with its comments (the notes rendered here) stripped. The static mount serves this
        // path un-minified with no-store, so it is always the current file.
        fetch('/shared_components/css/tokens.css', { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (css) {
                var sections = parseTokens(css);
                if (!sections.length) throw new Error('no :root block parsed');
                render(sections);
            })
            .catch(showError);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
