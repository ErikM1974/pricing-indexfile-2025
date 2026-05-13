/* =====================================================
   STAFF DASHBOARD v3 — TWEAKS FAB
   Floating settings drawer. Persists via dashboard-store.
   v3 additions over legacy v2-tweaks.js:
   - Default revenue period option (Phase 4.7)
   - Reset to defaults button
   - Light theme intentionally NOT exposed (Erik's hard preference)
   ===================================================== */

import { store } from '../core/dashboard-store.js';

const DEFAULTS = {
    theme: 'dark',
    accent: 'green', // locked — accent picker removed 2026-05-13 per Erik
    density: 'comfy',
    defaultRevenuePeriod: 7,
};

const DENSITIES = [
    { id: 'comfy',   label: 'Comfy' },
    { id: 'compact', label: 'Compact' },
];

const PERIODS = [
    { days: 7,  label: '7D' },
    { days: 30, label: '30D' },
    { days: 60, label: '60D' },
    { days: 90, label: '90D' },
];

function loadTweaks() {
    // Force accent to 'green' even if a stale value is in storage from before
    // the picker was removed. (Users who'd set blue/violet/amber in dev get
    // reverted to NW green on next load.)
    const merged = { ...DEFAULTS, ...(store.get('tweaks') || {}) };
    merged.accent = 'green';
    return merged;
}

function saveTweaks(t) {
    store.set('tweaks', t);
}

function applyTweaksToBody(t) {
    // CRITICAL: data-theme/data-accent/data-density MUST live on <html> (root),
    // not <body>. Tokens use :root selectors and var(--surface-base) → var(--bg)
    // chains that need --bg defined on the same element :root targets.
    // Putting these on body breaks the variable resolution chain and the page
    // renders with no surface colors (transparent → white).
    const html = document.documentElement;
    html.dataset.theme = t.theme || 'dark';
    html.dataset.accent = t.accent || 'green';
    html.dataset.density = t.density || 'comfy';
}

function ensureMounted() {
    let fab = document.getElementById('v3TweaksFab');
    if (fab) return { fab, panel: document.getElementById('v3TweaksPanel') };

    fab = document.createElement('button');
    fab.id = 'v3TweaksFab';
    fab.type = 'button';
    fab.className = 'v3-tweaks-fab no-focus-ring';
    fab.setAttribute('aria-label', 'Open dashboard tweaks');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<i class="fas fa-sliders" aria-hidden="true"></i>';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'v3TweaksPanel';
    panel.className = 'v3-tweaks-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Dashboard tweaks');
    panel.setAttribute('aria-hidden', 'true');
    document.body.appendChild(panel);

    fab.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = panel.classList.toggle('is-open');
        fab.setAttribute('aria-expanded', String(open));
        panel.setAttribute('aria-hidden', String(!open));
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#v3TweaksPanel') || e.target.closest('#v3TweaksFab')) return;
        if (panel.classList.contains('is-open')) {
            panel.classList.remove('is-open');
            fab.setAttribute('aria-expanded', 'false');
            panel.setAttribute('aria-hidden', 'true');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('is-open')) {
            panel.classList.remove('is-open');
            fab.setAttribute('aria-expanded', 'false');
            panel.setAttribute('aria-hidden', 'true');
            fab.focus();
        }
    });

    return { fab, panel };
}

function renderPanel(panel, tweaks) {
    panel.innerHTML = `
        <div class="v3-tweaks-section">
            <h4>Density</h4>
            <div class="v3-tweaks-row">
                ${DENSITIES.map((d) => `
                    <button type="button" class="v3-tweaks-btn ${tweaks.density === d.id ? 'active' : ''}" data-tweak="density" data-value="${d.id}">${d.label}</button>
                `).join('')}
            </div>
        </div>
        <div class="v3-tweaks-divider" aria-hidden="true"></div>
        <div class="v3-tweaks-section">
            <h4>Default revenue period</h4>
            <div class="v3-tweaks-row">
                ${PERIODS.map((p) => `
                    <button type="button" class="v3-tweaks-btn ${tweaks.defaultRevenuePeriod === p.days ? 'active' : ''}" data-tweak="defaultRevenuePeriod" data-value="${p.days}">${p.label}</button>
                `).join('')}
            </div>
        </div>
        <div class="v3-tweaks-divider" aria-hidden="true"></div>
        <div class="v3-tweaks-section">
            <button type="button" class="v3-tweaks-reset" data-tweak-reset>Reset to defaults</button>
        </div>
        <div class="v3-tweaks-footer">v3 · changes save automatically</div>
    `;

    panel.querySelectorAll('[data-tweak]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.tweak;
            let value = btn.dataset.value;
            if (key === 'defaultRevenuePeriod') value = Number(value);
            tweaks[key] = value;
            saveTweaks(tweaks);
            applyTweaksToBody(tweaks);
            renderPanel(panel, tweaks);
        });
    });

    const resetBtn = panel.querySelector('[data-tweak-reset]');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const fresh = { ...DEFAULTS };
            saveTweaks(fresh);
            applyTweaksToBody(fresh);
            renderPanel(panel, fresh);
        });
    }
}

/**
 * Mount the FAB + panel and apply persisted tweaks.
 * Called early in dashboard-app.js so the body data attributes
 * land before any styling renders (avoid theme flicker).
 */
export function initTweaks() {
    const tweaks = loadTweaks();
    applyTweaksToBody(tweaks);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const { panel } = ensureMounted();
            renderPanel(panel, tweaks);
        }, { once: true });
    } else {
        const { panel } = ensureMounted();
        renderPanel(panel, tweaks);
    }
}

// Public API for power users + Erik debug
window.StaffDashboardV3Tweaks = {
    get:   () => loadTweaks(),
    set:   (key, value) => {
        const t = loadTweaks();
        t[key] = value;
        saveTweaks(t);
        applyTweaksToBody(t);
        const panel = document.getElementById('v3TweaksPanel');
        if (panel) renderPanel(panel, t);
    },
    reset: () => {
        saveTweaks({ ...DEFAULTS });
        applyTweaksToBody({ ...DEFAULTS });
        const panel = document.getElementById('v3TweaksPanel');
        if (panel) renderPanel(panel, { ...DEFAULTS });
    },
};
