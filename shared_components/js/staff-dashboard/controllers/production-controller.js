/* =====================================================
   STAFF DASHBOARD v3 — PRODUCTION CONTROLLER
   Renders the Production Schedule Predictor widget.
   Depends on legacy `production-schedule-stats.js` +
   `production-schedule-predictor.js` (loaded as plain
   <script> tags before the v3 module entry — they
   expose `window.ProductionPredictor` + `PRODUCTION_STATS`).

   Per Erik's plan answer #2, we keep the legacy static stats
   for now; nightly cron + API migration is a future phase.
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { escapeHtml } from '../core/dashboard-ui-utils.js';

const SERVICES = [
    { key: 'dtg',           icon: 'fa-tshirt' },
    { key: 'embroidery',    icon: 'fa-star' },
    { key: 'capEmbroidery', icon: 'fa-hard-hat' },
    { key: 'screenprint',   icon: 'fa-print' },
    { key: 'transfers',     icon: 'fa-exchange-alt' },
];

function capacityClass(status) {
    switch (status) {
        case 'wide-open': return 'capacity-open';
        case 'moderate':  return 'capacity-moderate';
        case 'busy':      return 'capacity-busy';
        default:          return 'capacity-open';
    }
}

function renderEmpty(msg) {
    const container = document.getElementById('production-predictor-grid');
    if (container) container.innerHTML = `<div class="production-empty">${escapeHtml(msg)}</div>`;
}

export function renderProduction() {
    const container = document.getElementById('production-predictor-grid');
    const seasonBadge = document.getElementById('production-season-badge');
    const recordCount = document.getElementById('production-record-count');
    if (!container) return;

    if (typeof window.ProductionPredictor === 'undefined') {
        renderEmpty('Predictor not loaded.');
        return;
    }

    const predictions = window.ProductionPredictor.getAllPredictions();
    const metadata    = window.ProductionPredictor.getMetadata();

    if (recordCount && metadata?.totalRecords) {
        recordCount.textContent = metadata.totalRecords.toLocaleString('en-US');
    }

    if (seasonBadge) {
        const seasonText = window.ProductionPredictor.getSeasonText(predictions.season);
        seasonBadge.className = `season-badge season-${predictions.season}`;
        seasonBadge.textContent = seasonText;
    }

    const html = SERVICES.map((svc) => {
        const pred = predictions[svc.key];
        if (!pred) return '';
        const name = window.ProductionPredictor.getServiceName(svc.key);
        const cap = capacityClass(predictions.capacity?.status);
        return `
            <div class="production-card" title="Typically ${escapeHtml(pred.range)} days (${pred.samples} samples)">
                <div class="production-card-header">
                    <i class="fas ${svc.icon}" aria-hidden="true"></i>
                    <span class="production-service-name">${escapeHtml(name)}</span>
                </div>
                <div class="production-days">
                    <span class="production-days-number">${pred.days}</span>
                    <span class="production-days-label">days</span>
                </div>
                <div class="production-due-date">${escapeHtml(pred.dueDateFormatted)}</div>
                <div class="production-capacity-dot ${cap}" aria-hidden="true"></div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

export function initProduction() {
    renderProduction();
}

register('production:refresh', () => renderProduction());
