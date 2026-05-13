/* =====================================================
   STAFF DASHBOARD v3 — ANNOUNCEMENTS CONTROLLER
   Reads from window.staffAnnouncementsData (set by index.html).
   Per Erik's plan answer #2, data stays inline-hardcoded.
   ===================================================== */

import { register }   from '../core/dashboard-events.js';
import { store }      from '../core/dashboard-store.js';
import { escapeHtml, formatLongDate } from '../core/dashboard-ui-utils.js';

const PRIORITY_TYPES = {
    urgent:   { label: 'Urgent',          icon: 'fa-circle-exclamation', cls: 'urgent' },
    training: { label: 'Training',        icon: 'fa-graduation-cap',     cls: 'training' },
    process:  { label: 'Process Update',  icon: 'fa-gears',              cls: 'process' },
    general:  { label: 'Announcement',    icon: 'fa-bullhorn',           cls: 'general' },
};

const PRIORITY_ORDER = ['urgent', 'training', 'process', 'general'];

let announcements = [];
let dismissedIds = new Set();

function loadDismissed() {
    const list = store.get('dismissedAnnouncements');
    dismissedIds = new Set(Array.isArray(list) ? list : []);
}

function saveDismissed() {
    store.set('dismissedAnnouncements', Array.from(dismissedIds));
}

function getActive() {
    return announcements
        .filter((a) => !dismissedIds.has(a.id))
        .sort((a, b) => PRIORITY_ORDER.indexOf(a.type || 'general') - PRIORITY_ORDER.indexOf(b.type || 'general'));
}

function renderHero(target, item) {
    if (!item) {
        target.innerHTML = '';
        target.classList.add('is-empty');
        return;
    }
    target.classList.remove('is-empty');
    const meta = PRIORITY_TYPES[item.type] || PRIORITY_TYPES.general;
    target.innerHTML = `
        <div class="announcement-hero__icon"><i class="fas ${meta.icon}"></i></div>
        <div class="announcement-hero__body">
            <div class="announcement-hero__meta">
                <span class="announcement-priority-badge ${meta.cls}">${meta.label}</span>
                <span class="announcement-hero__date">${escapeHtml(formatLongDate(item.date))}</span>
            </div>
            <h3 class="announcement-hero__title">${escapeHtml(item.title)}</h3>
            <p class="announcement-hero__preview">${escapeHtml(item.preview || '')}</p>
        </div>
        <button type="button" class="announcement-hero__dismiss" data-action="announcements:dismiss" data-id="${escapeHtml(item.id)}" aria-label="Dismiss announcement">
            <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
    `;
}

function renderList(target, items) {
    if (!items || items.length === 0) {
        target.innerHTML = '';
        return;
    }
    target.innerHTML = items.map((item) => {
        const meta = PRIORITY_TYPES[item.type] || PRIORITY_TYPES.general;
        return `
            <div class="announcement-card announcement-card--${meta.cls}">
                <div class="announcement-card__icon"><i class="fas ${meta.icon}"></i></div>
                <div class="announcement-card__body">
                    <div class="announcement-card__title">${escapeHtml(item.title)}</div>
                    <div class="announcement-card__preview">${escapeHtml(item.preview || '')}</div>
                    <div class="announcement-card__date">${escapeHtml(formatLongDate(item.date))}</div>
                </div>
                <button type="button" class="announcement-card__dismiss" data-action="announcements:dismiss" data-id="${escapeHtml(item.id)}" aria-label="Dismiss">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </div>
        `;
    }).join('');
}

export function renderAnnouncements() {
    const heroTarget = document.getElementById('announcementsHero');
    const listTarget = document.getElementById('announcementsList');
    const active = getActive();

    if (heroTarget) renderHero(heroTarget, active[0] || null);
    if (listTarget) renderList(listTarget, active.slice(1));
}

export function initAnnouncements() {
    announcements = Array.isArray(window.staffAnnouncementsData)
        ? window.staffAnnouncementsData
        : [];
    loadDismissed();
    renderAnnouncements();
}

// Register handler
register('announcements:dismiss', (el) => {
    const id = el.dataset.id;
    if (!id) return;
    dismissedIds.add(id);
    saveDismissed();
    renderAnnouncements();
});
