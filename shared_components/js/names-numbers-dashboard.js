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
        document.getElementById('filterSearch').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.applyFilters();
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
                '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--nn-error-text);">Failed to load rosters</td></tr>';
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

        this.renderTable(filtered);
    }

    clearFilters() {
        document.getElementById('filterSearch').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterRep').value = '';
        this.renderTable(this.allRosters);
    }

    renderTable(rosters) {
        const tbody = document.getElementById('dashboardBody');

        if (!rosters || rosters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--nn-text-secondary);">No rosters found</td></tr>';
            return;
        }

        tbody.innerHTML = rosters.map(r => {
            const statusCls = (r.Status || 'draft').toLowerCase().replace(/\s+/g, '-');
            const modified = r.ModifiedAt ? new Date(r.ModifiedAt + 'Z').toLocaleDateString() : '-';
            return `<tr onclick="window.location='/pages/names-numbers.html?load=${r.ID_Roster}'">
                <td><strong>${this.esc(r.RosterName || 'Untitled')}</strong></td>
                <td>${this.esc(r.CompanyName || '')}</td>
                <td>${r.OrderNumber || '-'}</td>
                <td>${r.TotalPersons || 0}</td>
                <td>${this.esc(r.SalesRep || '')}</td>
                <td><span class="status-badge status-${statusCls}">${this.esc(r.Status || 'Draft')}</span></td>
                <td>${modified}</td>
                <td class="actions" onclick="event.stopPropagation();">
                    <a href="/pages/names-numbers.html?load=${r.ID_Roster}" class="btn-secondary btn-sm"><i class="fas fa-edit"></i></a>
                    <button class="btn-danger btn-sm" onclick="dashboard.deleteRoster(${r.ID_Roster}, '${this.esc(r.RosterName || '')}')"><i class="fas fa-trash"></i></button>
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
