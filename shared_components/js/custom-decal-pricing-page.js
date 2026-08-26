/**
 * custom-decal-pricing-page.js
 *
 * Page logic for /calculators/custom-decal-pricing.html — the square-foot
 * calculator + rate card for decals the standard sticker grid can't price:
 * anything larger than 6×6, odd shapes, mixed-size orders, or runs under the
 * 50-piece minimum.
 *
 * Extracted 2026-07-29 from sticker-pricing-page.js, which was retired along
 * with /calculators/sticker-manual-pricing.html. That page also carried the
 * 2×2–6×6 sticker grid and the banner rate card; both are now served to
 * customers directly at /custom-stickers and /custom-banners, so only the
 * decal calculator needed a home. The AI quote drawer and the STK quote-save
 * path did NOT come across (Erik 2026-07-29) — this page prices, nothing else.
 *
 * Pricing comes ENTIRELY from GET /api/custom-decal-pricing (Rule #6: no
 * hardcoded prices). computeDecalQuote below mirrors caspio-pricing-proxy
 * src/routes/custom-decal-pricing.js computeDecalQuote() — keep the two in
 * sync; tests/unit/custom-decal-pricing.test.js locks this copy.
 */

(function () {
    'use strict';

    // typeof-guarded so the unit test can require() this file outside a browser.
    //
    // ⚠️ APP_CONFIG.API.BASE_URL has been set both WITH and WITHOUT a trailing
    // /api by different config bootstraps over time (/config/app.config.js is
    // WITHOUT; the retired staff-dashboard-v3/config.js was WITH). Normalize —
    // if a with-/api config ever loads first, the request would silently become
    // /api/api/... and 404 instead of failing loudly.
    const RAW_BASE = (typeof window !== 'undefined' && window.APP_CONFIG
        && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const API_BASE_URL = String(RAW_BASE).replace(/\/api\/?$/, '');

    // Populated by the API. Deliberately null until then: every render path
    // bails while it is null rather than falling back to a guessed rate.
    let decalData = null;

    // -----------------------------------------------------------------
    // Formatting helpers (carried over verbatim from sticker-pricing-page.js)
    // -----------------------------------------------------------------
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function fmtMoney(n) {
        if (!Number.isFinite(n)) return '0.00';
        return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function fmtInt(n) {
        if (!Number.isFinite(n)) return '0';
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function round2(n) { return Math.round(n * 100) / 100; }

    // -----------------------------------------------------------------
    // Pure pricing core — no DOM. Exported for the unit test.
    // -----------------------------------------------------------------

    /** Human label for a tier given its index in the ascending-sorted list. */
    function decalTierLabel(tiers, idx) {
        const t = tiers[idx];
        const hi = Number(t.MaxSqFt);
        const lo = idx === 0 ? 0 : Number(tiers[idx - 1].MaxSqFt);
        if (hi >= 999999) return 'Over ' + fmtInt(lo) + ' sq ft';
        if (idx === 0) return 'Up to ' + fmtInt(hi) + ' sq ft';
        return fmtInt(lo) + '–' + fmtInt(hi) + ' sq ft';
    }

    /**
     * Price a set of decal lines.
     * @param {Array<{w:number,h:number,q:number}>} lines finished sizes in inches
     * @param {object} data  the /api/custom-decal-pricing payload (tiers ascending)
     * @param {{artOnFile?:boolean, taxPct?:number}} opts
     * @returns {object} totals + the tier that was applied + any warnings
     */
    function computeDecalQuote(lines, data, opts) {
        const o = opts || {};
        const tiers = data.tiers;
        const minMaterial = Number(data.minMaterial) || 90;
        const setupAmt = (data.setupFee && Number(data.setupFee.amount)) || 50;
        const safeWidth = Number(data.safeRollWidthIn) || 52;

        const warnings = [];
        let totalSqFt = 0;

        for (const line of lines) {
            const w = Number(line.w), h = Number(line.h), q = Number(line.q);
            totalSqFt += (w * h) / 144 * q;
            // Both dimensions over the roll width means it can't be rotated to
            // fit either — that's a production conversation, not a price.
            if (Math.min(w, h) > safeWidth) {
                warnings.push(`A ${w}"×${h}" decal exceeds the ${safeWidth}" Roland print/cut width on both sides — it may need rotation, paneling, or custom production review.`);
            }
        }

        let tierIdx = tiers.findIndex(t => totalSqFt <= Number(t.MaxSqFt));
        if (tierIdx === -1) tierIdx = tiers.length - 1;
        const tier = tiers[tierIdx];
        const rate = Number(tier.RatePerSqFt);

        // Tier 1's floor is the material minimum; later tiers carry their own
        // floor so a job just over a break can never price below one just under.
        const floor = tierIdx === 0 ? minMaterial : (Number(tier.floor) || minMaterial);
        const rawMaterial = round2(totalSqFt * rate);
        const material = Math.max(rawMaterial, floor);
        const floorApplied = material > rawMaterial + 1e-9;

        const setup = o.artOnFile ? 0 : setupAmt;
        const subtotal = round2(material + setup);
        const taxPct = Number.isFinite(o.taxPct) ? o.taxPct : 0;
        const tax = round2(subtotal * (taxPct / 100));
        const total = round2(subtotal + tax);

        if (floorApplied) {
            warnings.unshift(`Tier minimum applied: ${fmtMoney(round2(totalSqFt))} sq ft × $${fmtMoney(rate)} = $${fmtMoney(rawMaterial)}, raised to the $${fmtMoney(floor)} tier minimum (volume-break cliff protection).`);
        }

        return {
            totalSqFt: round2(totalSqFt),
            tierIdx, rate, floor, floorApplied,
            material, setup, subtotal, tax, total, taxPct,
            tierLabel: decalTierLabel(tiers, tierIdx),
            warnings,
        };
    }

    // -----------------------------------------------------------------
    // Rate card
    // -----------------------------------------------------------------
    async function loadAndRenderDecalPricing() {
        const grid = document.getElementById('decalRateGrid');
        if (!grid) return;
        try {
            const r = await fetch(API_BASE_URL + '/api/custom-decal-pricing');
            if (!r.ok) throw new Error('API returned ' + r.status);
            const data = await r.json();
            if (!Array.isArray(data.tiers) || data.tiers.length === 0) throw new Error('empty decal rate card');
            data.tiers.sort((a, b) => Number(a.MaxSqFt) - Number(b.MaxSqFt));
            decalData = data;
            renderDecalRateCard(grid, data);
            const minNote = document.getElementById('decalMinNote');
            if (minNote) minNote.textContent = '$' + fmtMoney(Number(data.minMaterial) || 90) + ' material';
            recomputeDecal(); // first paint now that rates are loaded
        } catch (err) {
            // Rule 4: an API failure is visible and total. No cached or guessed
            // rate is ever shown — a wrong decal price is worse than no price.
            console.error('[decal-page] rates load failed:', err);
            grid.innerHTML = '';
            const banner = document.getElementById('pricingError');
            if (banner) banner.hidden = false;
            const out = document.getElementById('decalOutput');
            if (out) out.innerHTML = '';
            const calc = document.getElementById('decalCalc');
            if (calc) calc.setAttribute('aria-disabled', 'true');
        }
    }

    function renderDecalRateCard(container, data) {
        const tiers = data.tiers;
        const minMaterial = Number(data.minMaterial) || 90;
        const rows = tiers.map((t, idx) => {
            const floor = Number(t.floor) || 0;
            const floorCell = idx === 0
                ? '$' + fmtMoney(minMaterial) + ' min'
                : 'never &lt; $' + fmtMoney(floor);
            return `<tr>
                <td>${escapeHtml(decalTierLabel(tiers, idx))}</td>
                <td class="price-highlight">$${fmtMoney(Number(t.RatePerSqFt))} / sq ft</td>
                <td>${floorCell}</td>
            </tr>`;
        }).join('');
        container.innerHTML = `
            <table class="pricing-table decal-rate-table">
                <thead><tr><th>Total finished sq ft</th><th>Rate</th><th>Tier minimum</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    // -----------------------------------------------------------------
    // Calculator wiring
    // -----------------------------------------------------------------
    function wireDecalCalculator() {
        const rowsEl = document.getElementById('decalSizeRows');
        if (!rowsEl) return;
        addDecalRow(); // start with one empty row
        const addBtn = document.getElementById('decalAddRow');
        if (addBtn) addBtn.addEventListener('click', () => { addDecalRow(); recomputeDecal(); });
        const art = document.getElementById('decalArtOnFile');
        if (art) art.addEventListener('change', recomputeDecal);
        const tax = document.getElementById('decalTaxRate');
        if (tax) tax.addEventListener('input', recomputeDecal);
        rowsEl.addEventListener('input', recomputeDecal);
        rowsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.decal-row-remove');
            if (!btn) return;
            if (rowsEl.querySelectorAll('.decal-row').length > 1) {
                btn.closest('.decal-row').remove();
                recomputeDecal();
            }
        });
    }

    function addDecalRow() {
        const rowsEl = document.getElementById('decalSizeRows');
        if (!rowsEl) return;
        const row = document.createElement('div');
        row.className = 'decal-row';
        row.innerHTML = `
            <input type="number" class="decal-w" min="0" step="0.25" inputmode="decimal" placeholder="W" aria-label="Width in inches">
            <input type="number" class="decal-h" min="0" step="0.25" inputmode="decimal" placeholder="H" aria-label="Height in inches">
            <input type="number" class="decal-q" min="0" step="1" inputmode="numeric" placeholder="Qty" aria-label="Quantity">
            <span class="decal-row-sqft">—</span>
            <button type="button" class="decal-row-remove" aria-label="Remove this size" title="Remove">&times;</button>`;
        rowsEl.appendChild(row);
    }

    /** Read the rows, price them, paint the breakdown. */
    function recomputeDecal() {
        if (!decalData) return;
        const rowsEl = document.getElementById('decalSizeRows');
        const out = document.getElementById('decalOutput');
        const errEl = document.getElementById('decalCalcError');
        const warnEl = document.getElementById('decalWarnings');
        if (!rowsEl || !out) return;

        const lines = [];
        let anyFilled = false, invalid = false;

        Array.from(rowsEl.querySelectorAll('.decal-row')).forEach(row => {
            const wEl = row.querySelector('.decal-w');
            const hEl = row.querySelector('.decal-h');
            const qEl = row.querySelector('.decal-q');
            const sqftCell = row.querySelector('.decal-row-sqft');
            const w = parseFloat(wEl.value), h = parseFloat(hEl.value), q = parseInt(qEl.value, 10);
            if (!wEl.value && !hEl.value && !qEl.value) { sqftCell.textContent = '—'; return; }
            anyFilled = true;
            if (!(w > 0) || !(h > 0) || !(q > 0)) { invalid = true; sqftCell.textContent = '—'; return; }
            sqftCell.textContent = fmtMoney(round2((w * h) / 144 * q));
            lines.push({ w, h, q });
        });

        const taxPctRaw = parseFloat(document.getElementById('decalTaxRate').value);
        if (Number.isFinite(taxPctRaw) && taxPctRaw < 0) invalid = true;

        if (!anyFilled) {
            errEl.hidden = true; warnEl.innerHTML = '';
            out.innerHTML = '<div class="decal-output-empty">Enter a size and quantity to see the price.</div>';
            return;
        }
        if (invalid) {
            errEl.hidden = false;
            errEl.textContent = 'Enter a positive width, height, and quantity for each size (and a non-negative tax %).';
            warnEl.innerHTML = ''; out.innerHTML = '';
            return;
        }
        errEl.hidden = true;

        const q = computeDecalQuote(lines, decalData, {
            artOnFile: document.getElementById('decalArtOnFile').checked,
            taxPct: Number.isFinite(taxPctRaw) ? taxPctRaw : 0,
        });

        warnEl.innerHTML = q.warnings.map(w =>
            `<div class="decal-warn"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(w)}</div>`
        ).join('');

        out.innerHTML = `
            <div class="decal-out-line"><span>Total finished area</span><span>${fmtMoney(q.totalSqFt)} sq ft</span></div>
            <div class="decal-out-line"><span>Rate (${escapeHtml(q.tierLabel)})</span><span>$${fmtMoney(q.rate)} / sq ft</span></div>
            <div class="decal-out-line"><span>Material${q.floorApplied ? ' (tier minimum)' : ''}</span><span>$${fmtMoney(q.material)}</span></div>
            <div class="decal-out-line"><span>Art setup (GRT-50)${q.setup === 0 ? ' — waived' : ''}</span><span>$${fmtMoney(q.setup)}</span></div>
            <div class="decal-out-line subtotal"><span>Subtotal</span><span>$${fmtMoney(q.subtotal)}</span></div>
            <div class="decal-out-line"><span>Sales tax (${q.taxPct}%)</span><span>$${fmtMoney(q.tax)}</span></div>
            <div class="decal-out-line total"><span>Total quote</span><span>$${fmtMoney(q.total)}</span></div>`;
    }

    // -----------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------
    function init() {
        wireDecalCalculator();
        loadAndRenderDecalPricing();
    }

    // Guarded so the unit test can require() this file for computeDecalQuote
    // without a DOM. In the browser both branches are unreachable-safe.
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
            init();
        }
    }

    // Test seam — the pure pricing core, no DOM required.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { computeDecalQuote, decalTierLabel, round2 };
    }
})();
