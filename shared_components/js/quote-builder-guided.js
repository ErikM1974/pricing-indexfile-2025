/**
 * quote-builder-guided.js — the Guided Quote shell (Phase B, 2026-07-07)
 * =======================================================================
 * Recomposes the trio builders (EMB / SCP / DTF) into a 4-step flow:
 *   1 Products → 2 Decoration → 3 Customer → 4 Review & send
 * built for AE adoption (guided-quote pitch): one step visible at a time,
 * the sidebar stays as the always-visible price rail, and a "Show
 * everything" toggle restores Erik's full workbench (persisted).
 *
 * HOW (and why it's safe — same playbook as the 2026-06-14 layout moves):
 * - TAG, DON'T WRAP: content sections KEEP their place as direct children
 *   of .power-content and only receive data-guided-step + a display class,
 *   so no `parent > child` CSS or JS layout assumption changes.
 * - Exactly TWO physical relocations, both id-preserving with a hidden
 *   anchor for exact restore: the sidebar customer panel → step 3, and the
 *   sidebar action panel (push readiness + buttons) → step 4.
 * - ZERO pricing paths touched. Every handler keys off getElementById and
 *   element ids are untouched; hidden inputs still save/load (Phase A's
 *   syncCustomerManualDetails behavior is unchanged inside step 3).
 * - Defensive: if any expected section is missing (page drift, jsdom test
 *   harness), the module logs one warning and leaves the page EXACTLY as
 *   it was — the classic workbench remains the fallback.
 *
 * DTG is excluded by design (inline-form architecture; already guided-ish).
 */
(function () {
    'use strict';

    const STORE_KEY = 'nwca-guided-mode';   // '1' on (default) · '0' workbench

    // Per-builder section map. Selectors resolve against document; every
    // selector listed MUST exist or the module no-ops (defensive contract).
    const CONFIGS = {
        'emb-builder': {
            decorTitle: 'Logos', decorIcon: 'fa-shirt',
            steps: [
                { title: 'Products', icon: 'fa-tshirt', hint: 'Style, color, sizes', sel: ['.power-content > .product-grid-section'] },
                // #emb-services-bar moves INTO the Logos step (expert audit 2026-07-07):
                // Additional Logo / Digitizing / Monogram chips were stranded in step 1
                // (the bar lives inside .product-grid-section), invisible exactly when
                // the rep is reasoning about placements. Anchor restores it on toggle.
                { title: 'Logos', icon: 'fa-compact-disc', hint: 'Placement & stitch size', sel: ['.power-content > .logo-config-container'], move: ['#emb-services-bar'] },
                { title: 'Customer', icon: 'fa-user', hint: 'One search fills it', move: ['.power-sidebar .customer-info-section'] },
                // EMB nests the invoice footer INSIDE .product-grid-section (unlike
                // SCP/DTF) — a hidden parent would hide it in step 4, so it MOVES
                // out to the content column (anchor restores the exact slot).
                { title: 'Review & send', icon: 'fa-paper-plane', hint: 'Check it, push it', move: ['.power-content .invoice-totals-wrap.order-footer', '.power-sidebar .action-panel'] }
            ]
        },
        'scp-builder': {
            steps: [
                { title: 'Products', icon: 'fa-tshirt', hint: 'Style, color, sizes', sel: ['.power-content > .product-grid-section', '.power-content > .additional-charges-panel'] },
                { title: 'Print setup', icon: 'fa-fill-drip', hint: 'Locations & ink colors', sel: ['.power-content > .logo-section.print-location-section', '.power-content > .logo-section.reference-artwork-section'] },
                { title: 'Customer', icon: 'fa-user', hint: 'One search fills it', move: ['.power-sidebar .customer-panel'] },
                { title: 'Review & send', icon: 'fa-paper-plane', hint: 'Check it, push it', sel: ['.power-content > .invoice-totals-wrap.order-footer'], move: ['.power-sidebar .action-panel'] }
            ]
        },
        'dtf-builder': {
            steps: [
                { title: 'Products', icon: 'fa-tshirt', hint: 'Style, color, sizes', sel: ['.power-content > .product-grid-section', '.power-content > .additional-charges-panel'] },
                { title: 'Transfers', icon: 'fa-map-marker-alt', hint: 'Where the prints go', sel: ['.power-content > .location-config-section:not(.reference-artwork-section)', '.power-content > .location-config-section.reference-artwork-section'] },
                { title: 'Customer', icon: 'fa-user', hint: 'One search fills it', move: ['.power-sidebar .customer-panel'] },
                { title: 'Review & send', icon: 'fa-paper-plane', hint: 'Check it, push it', sel: ['.power-content > .invoice-totals-wrap.order-footer'], move: ['.power-sidebar .action-panel'] }
            ]
        }
    };

    let cfg = null;
    let current = 0;
    let guidedOn = true;
    let stepped = [];        // [{ el, step, moved, anchor }]
    let shell = null;

    function resolveSections() {
        const out = [];
        for (let i = 0; i < cfg.steps.length; i++) {
            const s = cfg.steps[i];
            for (const sel of (s.sel || [])) {
                const el = document.querySelector(sel);
                if (!el) return { missing: sel };
                out.push({ el, step: i, moved: false, anchor: null });
            }
            for (const sel of (s.move || [])) {
                const el = document.querySelector(sel);
                if (!el) return { missing: sel };
                out.push({ el, step: i, moved: true, anchor: null });
            }
        }
        return { sections: out };
    }

    function buildShell() {
        const shellEl = document.createElement('div');
        shellEl.className = 'guided-shell';
        shellEl.innerHTML =
            '<div class="guided-steps" role="tablist" aria-label="Quote steps">'
            + cfg.steps.map((s, i) =>
                '<button type="button" class="guided-step" role="tab" data-step="' + i + '" aria-selected="false">'
                + '<span class="gs-num"><span class="gs-n">' + (i + 1) + '</span><i class="fas fa-check gs-check"></i></span>'
                + '<span class="gs-txt"><span class="gs-title"><i class="fas ' + s.icon + '"></i> ' + s.title + '</span>'
                + '<span class="gs-hint">' + s.hint + '</span></span>'
                + '</button>').join('')
            + '<button type="button" class="guided-toggle" title="Switch between the guided steps and the classic all-on-one-page workbench">'
            + '<i class="fas fa-table-columns"></i> <span class="gt-label">Show everything</span></button>'
            + '</div>'
            + '<div class="guided-nav">'
            + '<button type="button" class="guided-prev"><i class="fas fa-arrow-left"></i> Back</button>'
            + '<button type="button" class="guided-next">Next: <span class="gn-title"></span> <i class="fas fa-arrow-right"></i></button>'
            + '</div>';
        return shellEl;
    }

    // Guided ON: tag sections, relocate the two sidebar panels into the flow
    function engage() {
        const content = document.querySelector('.power-content');
        stepped.forEach(entry => {
            entry.el.setAttribute('data-guided-step', String(entry.step));
            if (entry.moved && !entry.anchor) {
                // Hidden anchor marks the exact sidebar slot for restore
                const anchor = document.createElement('span');
                anchor.className = 'guided-anchor';
                anchor.hidden = true;
                entry.el.parentNode.insertBefore(anchor, entry.el);
                entry.anchor = anchor;
            }
            if (entry.moved) {
                // Physical move into the content column, ids preserved. Order of
                // appends: step-3 panel first, then step-4 panel (config order).
                content.appendChild(entry.el);
                entry.el.classList.add('guided-moved');
            }
        });
        document.body.classList.add('guided-on');
        guidedOn = true;
        try { localStorage.setItem(STORE_KEY, '1'); } catch (_) { }
        goToStep(current, { scroll: false });
        updateToggleLabel();
    }

    // Workbench: restore the two moved panels to their sidebar anchors and
    // show every section (original DOM order was never changed for content).
    function disengage() {
        stepped.forEach(entry => {
            entry.el.removeAttribute('data-guided-step');
            if (entry.moved && entry.anchor && entry.anchor.parentNode) {
                entry.anchor.parentNode.insertBefore(entry.el, entry.anchor.nextSibling);
                entry.el.classList.remove('guided-moved');
            }
        });
        document.body.classList.remove('guided-on');
        guidedOn = false;
        try { localStorage.setItem(STORE_KEY, '0'); } catch (_) { }
        updateToggleLabel();
    }

    function updateToggleLabel() {
        const label = shell.querySelector('.gt-label');
        if (label) label.textContent = guidedOn ? 'Show everything' : 'Guided steps';
        shell.classList.toggle('guided-off', !guidedOn);
    }

    // Lightweight completion signals — display only, never gates navigation
    function stepDone(i) {
        if (i === 0) {
            let qty = 0;
            document.querySelectorAll('#product-tbody .cell-qty').forEach(c => { qty += parseInt(c.textContent, 10) || 0; });
            return qty > 0;
        }
        if (i === 1) {
            // Per-builder decoration signal (expert audit 2026-07-07: an always-false
            // step teaches reps to ignore the checkmarks entirely). Display only.
            if (document.body.classList.contains('scp-builder')) {
                const front = document.querySelector('input[name="front-location"]:checked');
                return !!(front && front.value);
            }
            if (document.body.classList.contains('dtf-builder')) {
                const disp = document.getElementById('location-display');
                return !!(disp && disp.textContent.trim() && disp.textContent.trim() !== 'None selected');
            }
            if (document.body.classList.contains('emb-builder')) {
                // A linked design # (either card) is the honest "logo configured"
                // signal — the position/stitch selects always hold valid defaults.
                return !!(document.getElementById('garment-design-number')?.value.trim()
                    || document.getElementById('cap-design-number')?.value.trim());
            }
            return false;
        }
        if (i === 2) {
            const n = document.getElementById('customer-name');
            const e = document.getElementById('customer-email');
            return !!(n && n.value.trim() && e && e.value.trim());
        }
        return false; // review has no meaningful "done" (it's the last step)
    }

    // Re-tick the step checkmarks as the rep types — they previously refreshed
    // only on navigation, so filling name/email on step 3 didn't tick the tab
    // until the next click. Debounced; display only. (expert audit 2026-07-07)
    let _doneTimer = null;
    function refreshDoneTicks() {
        if (!guidedOn || !shell) return;
        clearTimeout(_doneTimer);
        _doneTimer = setTimeout(() => {
            shell.querySelectorAll('.guided-step').forEach((btn, idx) => {
                btn.classList.toggle('done', idx !== current && stepDone(idx));
            });
        }, 350);
    }

    function goToStep(i, opts) {
        current = Math.max(0, Math.min(cfg.steps.length - 1, i));
        shell.querySelectorAll('.guided-step').forEach((btn, idx) => {
            btn.classList.toggle('active', idx === current);
            btn.setAttribute('aria-selected', idx === current ? 'true' : 'false');
            btn.classList.toggle('done', idx !== current && stepDone(idx));
        });
        stepped.forEach(entry => {
            entry.el.classList.toggle('guided-hidden', entry.step !== current);
        });
        const prev = shell.querySelector('.guided-prev');
        const next = shell.querySelector('.guided-next');
        prev.style.visibility = current === 0 ? 'hidden' : 'visible';
        if (current === cfg.steps.length - 1) {
            next.style.visibility = 'hidden';
        } else {
            next.style.visibility = 'visible';
            next.querySelector('.gn-title').textContent = cfg.steps[current + 1].title;
        }
        if (!opts || opts.scroll !== false) {
            try { shell.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { }
        }
    }

    function wire() {
        shell.addEventListener('click', (e) => {
            const stepBtn = e.target.closest('.guided-step');
            if (stepBtn) { if (!guidedOn) engage(); goToStep(parseInt(stepBtn.dataset.step, 10)); return; }
            if (e.target.closest('.guided-prev')) { goToStep(current - 1); return; }
            if (e.target.closest('.guided-next')) { goToStep(current + 1); return; }
            if (e.target.closest('.guided-toggle')) { guidedOn ? disengage() : engage(); return; }
        });

        // Push-readiness rows name what's missing — clicking one jumps to the
        // step that fixes it (works because the checklist lives in step 4).
        document.addEventListener('click', (e) => {
            if (!guidedOn) return;
            const item = e.target.closest('.pr-item');
            if (!item) return;
            const t = (item.textContent || '').toLowerCase();
            if (/customer|name|email/.test(t)) goToStep(2);
            else if (/product|item/.test(t)) goToStep(0);
        });

        // Live checkmarks while typing (input covers text fields; change covers
        // selects/radios/checkboxes like SCP's location radios).
        document.addEventListener('input', refreshDoneTicks);
        document.addEventListener('change', refreshDoneTicks);
    }

    function init() {
        cfg = CONFIGS[Object.keys(CONFIGS).find(c => document.body.classList.contains(c))];
        if (!cfg) return;                                  // not a trio builder page
        const content = document.querySelector('.power-content');
        const sidebar = document.querySelector('.power-sidebar');
        if (!content || !sidebar) return;
        const resolved = resolveSections();
        if (resolved.missing) {
            console.warn('[Guided] section missing (' + resolved.missing + ') — leaving classic layout as-is');
            return;
        }
        stepped = resolved.sections;
        shell = buildShell();
        content.insertBefore(shell, content.firstChild);
        wire();
        let saved = '1';
        try { saved = localStorage.getItem(STORE_KEY) || '1'; } catch (_) { }
        if (saved === '0') {
            // Workbench preferred: still tag nothing, but keep the shell header
            // so "Guided steps" is one click away.
            guidedOn = false;
            updateToggleLabel();
        } else {
            engage();
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else init();
    }

    if (typeof window !== 'undefined') {
        window.guidedGoToStep = function (i) { if (cfg && shell && guidedOn) goToStep(i); };

        /**
         * Navigate to the step that CONTAINS a field, then focus it (expert audit
         * 2026-07-07): save-validation and the push checklist used to focus() fields
         * that were display:none on another step — a silent no-op that left the rep
         * hunting for a field the toast had just named. Returns true when handled;
         * callers keep their plain focus() as the workbench-mode fallback.
         */
        window.guidedRevealField = function (id) {
            if (!cfg || !shell || !guidedOn) return false;
            const el = document.getElementById(id);
            if (!el) return false;
            const host = el.closest('[data-guided-step]');
            if (!host) return false;
            const step = parseInt(host.getAttribute('data-guided-step'), 10);
            if (Number.isFinite(step) && step !== current) goToStep(step);
            try {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (_) { }
            return true;
        };
    }
})();
