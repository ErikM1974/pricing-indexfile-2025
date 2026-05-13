/* =====================================================
   STAFF DASHBOARD v3 — CELEBRATIONS CONTROLLER
   Combined "Team" widget — birthdays + anniversaries + status badge,
   plus the staff-directory modal (now a <dashboard-modal>).
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { employeesService } from '../services/employees-service.js';
import { escapeHtml } from '../core/dashboard-ui-utils.js';

const els = {
    teamBtn:      () => document.getElementById('teamBtn'),
    teamCount:    () => document.getElementById('teamActiveCount'),
    teamDropdown: () => document.getElementById('teamDropdown'),
    bdayList:     () => document.getElementById('teamBirthdayList'),
    annivList:    () => document.getElementById('teamAnniversaryList'),
    bdayCount:    () => document.getElementById('teamBdayCount'),
    annivCount:   () => document.getElementById('teamAnnivCount'),
    modal:        () => document.getElementById('staffDirectoryModal'),
    modalSearch:  () => document.getElementById('staffDirectorySearch'),
    modalTbody:   () => document.getElementById('staffDirectoryBody'),
    modalFilters: () => document.querySelectorAll('.staff-filter-btn'),
};

let currentFilter = 'all';

function renderHeaderCounts() {
    const active = employeesService.active().length;
    const bdays = employeesService.upcomingBirthdays(30).length;
    const annivs = employeesService.upcomingAnniversaries(30).length;

    if (els.teamCount()) els.teamCount().textContent = String(active);
    if (els.bdayCount()) els.bdayCount().textContent = String(bdays);
    if (els.annivCount()) els.annivCount().textContent = String(annivs);

    // Explicit aria-label so screen readers don't announce the three counts
    // as orphaned numbers ("17 1 1"). Set on the button itself; inner spans
    // remain visible for sighted users.
    const btn = els.teamBtn();
    if (btn) {
        const bdayPart = bdays === 1 ? '1 upcoming birthday' : `${bdays} upcoming birthdays`;
        const annivPart = annivs === 1 ? '1 upcoming anniversary' : `${annivs} upcoming anniversaries`;
        btn.setAttribute('aria-label', `Team: ${active} active employees, ${bdayPart}, ${annivPart}`);
    }
}

function renderDropdown() {
    const bdayTarget = els.bdayList();
    const annivTarget = els.annivList();
    if (bdayTarget) {
        const bdays = employeesService.upcomingBirthdays(30);
        bdayTarget.innerHTML = bdays.length === 0
            ? '<li class="celebration-empty">No upcoming birthdays</li>'
            : bdays.slice(0, 6).map((e) => `
                <li class="celebration-row${e.daysUntilBirthday === 0 ? ' is-today' : ''}">
                    <span class="celebration-row__name">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</span>
                    <span class="celebration-row__date">${escapeHtml(e.formattedBirthday)}</span>
                    <span class="celebration-row__when">${e.daysUntilBirthday === 0 ? 'Today!' : (e.daysUntilBirthday === 1 ? 'Tomorrow' : `in ${e.daysUntilBirthday}d`)}</span>
                </li>
            `).join('');
    }
    if (annivTarget) {
        const annivs = employeesService.upcomingAnniversaries(30);
        annivTarget.innerHTML = annivs.length === 0
            ? '<li class="celebration-empty">No upcoming anniversaries</li>'
            : annivs.slice(0, 6).map((e) => {
                const yrs = e.yearsOfService + (e.daysUntilAnniversary === 0 ? 0 : 1);
                return `
                    <li class="celebration-row${e.daysUntilAnniversary === 0 ? ' is-today' : ''}">
                        <span class="celebration-row__name">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</span>
                        <span class="celebration-row__date">${yrs} year${yrs === 1 ? '' : 's'}</span>
                        <span class="celebration-row__when">${e.daysUntilAnniversary === 0 ? 'Today!' : (e.daysUntilAnniversary === 1 ? 'Tomorrow' : `in ${e.daysUntilAnniversary}d`)}</span>
                    </li>
                `;
            }).join('');
    }
}

function toggleDropdown() {
    const dd = els.teamDropdown();
    if (!dd) return;
    const open = dd.classList.toggle('is-open');
    const btn = els.teamBtn();
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) renderDropdown();
}

function closeDropdown() {
    const dd = els.teamDropdown();
    if (dd && dd.classList.contains('is-open')) {
        dd.classList.remove('is-open');
        const btn = els.teamBtn();
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

/* =====================================================
   Staff directory modal
   ===================================================== */

function getFilteredEmployees() {
    const search = els.modalSearch()?.value?.trim() || '';
    let list = search ? employeesService.search(search) : employeesService.all();

    if (currentFilter === 'active') {
        list = list.filter((e) => e.status === 'active');
    } else if (currentFilter === 'birthdays') {
        list = list.filter((e) => e.status === 'active' && e.daysUntilBirthday <= 30);
        list.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
    } else if (currentFilter === 'anniversaries') {
        list = list.filter((e) => e.status === 'active' && e.daysUntilAnniversary <= 30);
        list.sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary);
    }
    return list;
}

function renderDirectoryTable() {
    const tbody = els.modalTbody();
    if (!tbody) return;
    const list = getFilteredEmployees();
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="staff-table__empty">No staff match.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((e) => {
        const statusBadge = `<span class="status-badge status-${escapeHtml(e.status)}">${escapeHtml(e.status)}</span>`;
        return `
            <tr>
                <td>${escapeHtml(e.fullName)}</td>
                <td>${escapeHtml(e.position)}</td>
                <td>${escapeHtml(e.formattedStartDate)}</td>
                <td class="num">${e.yearsOfService}</td>
                <td>${escapeHtml(e.formattedBirthday)}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

function setFilter(name) {
    currentFilter = name;
    els.modalFilters().forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === name);
    });
    renderDirectoryTable();
}

function openDirectory(filter = 'all') {
    setFilter(filter);
    const search = els.modalSearch();
    if (search) search.value = '';
    const modal = els.modal();
    if (modal && typeof modal.open === 'function') modal.open();
}

/* =====================================================
   Init + event registration
   ===================================================== */

export function initCelebrations() {
    renderHeaderCounts();

    // Search input
    const search = els.modalSearch();
    if (search) {
        search.addEventListener('input', renderDirectoryTable);
    }

    // Outside-click closes the dropdown
    document.addEventListener('click', (e) => {
        if (e.target.closest('#teamBtn') || e.target.closest('#teamDropdown')) return;
        closeDropdown();
    });
}

register('team:toggle-dropdown', () => toggleDropdown());
register('staff-directory:show', (el) => openDirectory(el.dataset.filter || 'all'));
register('staff-directory:filter', (el) => setFilter(el.dataset.filter || 'all'));
