/**
 * Names & Numbers Dashboard Controller
 * Search, filter, KPI display for roster management
 */
class NamesNumbersDashboard {
    constructor() {
        this.service = new NamesNumbersService();
        this.allRosters = [];

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.bindEvents();
        this.loadAll();
    }

    bindEvents() {
        document.getElementById('filterBtn').addEventListener('click', () => this.applyFilters());
        document.getElementById('clearFilterBtn').addEventListener('click', () => this.clearFilters());
        // Filter as you type / change — the Filter button stays for people who expect it.
        let timer = null;
        ['filterSearch', 'filterRep'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => this.applyFilters(), 150); });
        });
        document.getElementById('filterStatus').addEventListener('change', () => this.applyFilters());
        // KPI tiles set the Status filter (click the active one, or Total, to clear)
        document.querySelectorAll('.kpi-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sel = document.getElementById('filterStatus');
                const status = btn.dataset.status || '';
                sel.value = (sel.value === status) ? '' : status;
                this.applyFilters();
            });
        });
        // Rows are role=link (click is the delegator's data-href) — Enter/Space open them too
        document.getElementById('dashboardBody').addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('a, button')) return;
            const row = e.target.closest('tr[data-href]');
            if (row) { e.preventDefault(); window.location.href = row.dataset.href; }
        });
    }

    syncKpis() {
        const status = document.getElementById('filterStatus').value;
        document.querySelectorAll('.kpi-btn').forEach(btn => {
            btn.setAttribute('aria-pressed', String((btn.dataset.status || '') === status));
        });
    }

    async loadAll() {
        try {
            const result = await this.service.listRosters();
            this.allRosters = result.rosters || [];
            this.updateKPIs();
            this.renderTable(this.allRosters);
        } catch (err) {
            this.showToast('Failed to load rosters: ' + err.message, 'error');
            document.getElementById('dashboardBody').innerHTML =
                '<tr><td colspan="8" class="nn-table-msg nn-table-msg--error" role="alert">Failed to load rosters (' + this.esc(err.message || 'request failed') + '). '
                + '<button type="button" class="btn-secondary btn-sm" data-call="dashboard.loadAll">Retry</button></td></tr>';
        }
    }

    updateKPIs() {
        const r = this.allRosters;
        document.getElementById('kpiTotal').textContent = r.length;
        document.getElementById('kpiDraft').textContent = r.filter(x => x.Status === 'Draft').length;
        document.getElementById('kpiSubmitted').textContent = r.filter(x => x.Status === 'Submitted').length;
        document.getElementById('kpiInProd').textContent = r.filter(x => x.Status === 'In Production').length;
        document.getElementById('kpiCompleted').textContent = r.filter(x => x.Status === 'Completed').length;
    }

    applyFilters() {
        const search = document.getElementById('filterSearch').value.trim().toLowerCase();
        const status = document.getElementById('filterStatus').value;
        const rep = document.getElementById('filterRep').value.trim().toLowerCase();

        let filtered = this.allRosters;

        if (search) {
            filtered = filtered.filter(r =>
                (r.RosterName || '').toLowerCase().includes(search) ||
                (r.CompanyName || '').toLowerCase().includes(search) ||
                String(r.OrderNumber || '').includes(search)
            );
        }
        if (status) {
            filtered = filtered.filter(r => r.Status === status);
        }
        if (rep) {
            filtered = filtered.filter(r => (r.SalesRep || '').toLowerCase().includes(rep));
        }

        this.syncKpis();
        this.renderTable(filtered);
    }

    clearFilters() {
        document.getElementById('filterSearch').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterRep').value = '';
        this.syncKpis();
        this.renderTable(this.allRosters);
    }

    renderTable(rosters) {
        const tbody = document.getElementById('dashboardBody');
        const count = document.getElementById('nnResultCount');
        if (count) count.textContent = (rosters ? rosters.length : 0) + ' of ' + this.allRosters.length + ' rosters';

        if (!rosters || rosters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="nn-table-msg">No rosters match these filters</td></tr>';
            return;
        }

        tbody.innerHTML = rosters.map(r => {
            const statusCls = (r.Status || 'draft').toLowerCase().replace(/\s+/g, '-');
            // Caspio naive timestamps are Pacific wall-clock — resolve via CaspioDate.
            const modified = window.CaspioDate ? (window.CaspioDate.formatDate(r.ModifiedAt, { fallback: '-' })) : (r.ModifiedAt ? new Date(r.ModifiedAt).toLocaleDateString() : '-');
            const name = this.esc(r.RosterName || 'Untitled');
            return `<tr data-href="/pages/names-numbers.html?load=${encodeURIComponent(r.ID_Roster)}" role="link" tabindex="0" aria-label="Open roster ${name}">
                <td><strong>${name}</strong></td>
                <td>${this.esc(r.CompanyName || '')}</td>
                <td>${this.esc(String(r.OrderNumber || '-'))}</td>
                <td>${Number(r.TotalPersons) || 0}</td>
                <td>${this.esc(r.SalesRep || '')}</td>
                <td><span class="status-badge status-${statusCls}">${this.esc(r.Status || 'Draft')}</span></td>
                <td>${modified}</td>
                <td class="actions" data-stop="1">
                    <a href="/pages/names-numbers.html?load=${encodeURIComponent(r.ID_Roster)}" class="btn-secondary btn-sm" aria-label="Edit roster ${name}"><i class="fas fa-edit" aria-hidden="true"></i></a>
                    <button type="button" class="btn-danger btn-sm" aria-label="Delete roster ${name}" data-call="dashboard.deleteRoster" data-args="${JSON.stringify([r.ID_Roster, r.RosterName || '']).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    async deleteRoster(id, name) {
        if (!confirm(`Delete roster "${name}"? This cannot be undone.`)) return;
        try {
            await this.service.deleteRoster(id);
            this.showToast('Roster deleted', 'success');
            this.loadAll();
        } catch (err) {
            this.showToast('Delete failed: ' + err.message, 'error');
        }
    }

    showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.textContent = message;
        toast.className = 'toast show' + (type ? ' ' + type : '');
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

const dashboard = new NamesNumbersDashboard();
window.dashboard = dashboard; // data-call targets resolve off window (Rule 3 delegator)
