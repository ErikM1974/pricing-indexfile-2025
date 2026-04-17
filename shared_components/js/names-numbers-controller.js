/**
 * Names & Numbers Controller
 * UI logic, state management, tab/group system, import handlers
 *
 * DATA MODEL (v2 — multi-garment):
 *   group = {
 *     id, name,
 *     garments: [{ id, label, style, color, hasBackPrint, hasFrontPrint, hasQty, hasBackLines }],
 *     personColumns: ['name','firstName','number','fullName','nickname','notes'],
 *     customColumns: [{ id, label }],
 *     defaults: { }
 *   }
 *   row = {
 *     groupId, lineNumber,
 *     name, firstName, number, fullName, nickname, notes,   // person fields (flat)
 *     garmentData: { [garmentId]: { size, backPrint, frontPrint, qty, backLine1-4 } },
 *     custom: { [customColId]: value }
 *   }
 *
 * Legacy rosters (single garmentStyle/garmentColor + flat columns[]) are auto-migrated
 * on load via migrateLegacyGroup() / migrateLegacyRow().
 */

const PERSON_COLUMN_DEFS = {
    name:      { label: 'Last Name',   width: '140px' },
    firstName: { label: 'First Name',  width: '120px' },
    number:    { label: 'Jersey #',    width: '80px'  },
    fullName:  { label: 'Full Name',   width: '180px' },
    nickname:  { label: 'Nickname',    width: '120px' },
    notes:     { label: 'Notes',       width: '200px' }
};

const GARMENT_FIELD_DEFS = {
    size:       { label: 'Size',        width: '110px', toggle: null },
    backPrint:  { label: 'Back Print',  width: '150px', toggle: 'hasBackPrint'  },
    frontPrint: { label: 'Front Print', width: '150px', toggle: 'hasFrontPrint' },
    qty:        { label: 'Qty',         width: '70px',  toggle: 'hasQty'        },
    backLine1:  { label: 'Back Line 1', width: '140px', toggle: 'hasBackLines'  },
    backLine2:  { label: 'Back Line 2', width: '140px', toggle: 'hasBackLines'  },
    backLine3:  { label: 'Back Line 3', width: '140px', toggle: 'hasBackLines'  },
    backLine4:  { label: 'Back Line 4', width: '140px', toggle: 'hasBackLines'  }
};

const DEFAULT_PERSON_COLUMNS = ['name', 'number'];

function randomId(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
}

function migrateLegacyGroup(g) {
    if (g && Array.isArray(g.garments)) return g;
    const oldCols = Array.isArray(g.columns) ? g.columns : [];
    const personCols = oldCols.filter(c => PERSON_COLUMN_DEFS[c]);
    if (personCols.length === 0) personCols.push('name');

    return {
        id: g.id || randomId('group'),
        name: g.name || 'Group',
        garments: [{
            id: randomId('g'),
            label: 'Garment',
            style: g.garmentStyle || '',
            color: g.garmentColor || '',
            hasBackPrint:  oldCols.includes('backPrint'),
            hasFrontPrint: oldCols.includes('frontPrint'),
            hasQty:        oldCols.includes('qty'),
            hasBackLines:  oldCols.some(c => /^backLine/.test(c))
        }],
        personColumns: personCols,
        customColumns: [],
        defaults: g.defaults || {}
    };
}

function migrateLegacyRow(row, group) {
    if (row && row.garmentData && typeof row.garmentData === 'object') {
        if (!row.custom) row.custom = {};
        return row;
    }
    const gid = group.garments[0]?.id;
    const gd = {};
    ['size','backPrint','frontPrint','qty','backLine1','backLine2','backLine3','backLine4'].forEach(k => {
        if (row[k] != null && row[k] !== '') gd[k] = row[k];
        delete row[k];
    });
    row.garmentData = gid ? { [gid]: gd } : {};
    row.custom = row.custom || {};
    return row;
}

class NamesNumbersController {
    constructor() {
        this.service = new NamesNumbersService();
        this.groups = [];
        this.rows = [];
        this.activeGroupId = null;
        this.currentRosterId = null;
        this.isDirty = false;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ============================================
    // Initialization
    // ============================================

    init() {
        document.getElementById('currentDate').textContent = this.service.getCurrentDate();
        this.bindEvents();
        this.checkURLParameters();
        this.updateUI();
    }

    checkURLParameters() {
        const params = new URLSearchParams(window.location.search);
        const loadId = params.get('load');
        if (loadId) {
            this.loadRoster(parseInt(loadId, 10));
        }
    }

    bindEvents() {
        // Header actions
        document.getElementById('searchBtn').addEventListener('click', () => this.toggleSearch());
        document.getElementById('newRosterBtn').addEventListener('click', () => this.resetAll());

        // Search
        document.getElementById('searchGoBtn').addEventListener('click', () => this.doSearch());
        document.getElementById('searchCloseBtn').addEventListener('click', () => this.toggleSearch());
        document.getElementById('searchInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.doSearch();
        });

        // Import buttons
        document.getElementById('uploadExcelBtn').addEventListener('click', () => {
            document.getElementById('excelFileInput').click();
        });
        document.getElementById('excelFileInput').addEventListener('change', e => this.handleExcelUpload(e));

        document.getElementById('ocrBtn').addEventListener('click', () => this.openModal('ocrModal'));
        document.getElementById('pasteNamesBtn').addEventListener('click', () => this.openModal('pasteModal'));

        // Add group
        document.getElementById('addGroupBtn').addEventListener('click', () => this.openModal('addGroupModal'));
        document.getElementById('addGroupConfirmBtn').addEventListener('click', () => this.addGroupFromModal());
        document.getElementById('addGroupCancelBtn').addEventListener('click', () => this.closeModal('addGroupModal'));
        document.getElementById('addGroupModalClose').addEventListener('click', () => this.closeModal('addGroupModal'));

        // Group config
        document.getElementById('toggleConfigBtn').addEventListener('click', () => this.toggleGroupConfig());
        document.getElementById('deleteGroupBtn').addEventListener('click', () => this.deleteActiveGroup());
        document.getElementById('groupName').addEventListener('change', () => this.saveGroupConfig());
        // Garment + custom column + person column wiring happens per-render in
        // renderGarmentsEditor / renderCustomColumnsEditor / renderPersonColumnPicker.

        // Row actions
        document.getElementById('addRowBtn').addEventListener('click', () => this.addRows(1));
        document.getElementById('addFiveRowsBtn').addEventListener('click', () => this.addRows(5));

        // Save/actions
        document.getElementById('saveDraftBtn').addEventListener('click', () => this.save('Draft'));
        document.getElementById('saveSubmitBtn').addEventListener('click', () => this.save('Submitted'));
        document.getElementById('printBtn').addEventListener('click', () => window.print());
        document.getElementById('exportExcelBtn').addEventListener('click', () => this.exportExcel());

        // Paste modal
        document.getElementById('pasteModalClose').addEventListener('click', () => this.closeModal('pasteModal'));
        document.getElementById('pasteCancelBtn').addEventListener('click', () => this.closeModal('pasteModal'));
        document.getElementById('pasteImportBtn').addEventListener('click', () => this.handlePasteImport());

        // OCR modal
        document.getElementById('ocrModalClose').addEventListener('click', () => this.closeModal('ocrModal'));
        document.getElementById('ocrCancelBtn').addEventListener('click', () => this.closeModal('ocrModal'));
        document.getElementById('ocrImportBtn').addEventListener('click', () => this.handleOcrImport());
        this.initOcrDropZone();

        // Dirty tracking on roster info fields
        ['rosterName', 'companyName', 'orderNumber', 'contactName', 'contactEmail', 'salesRep', 'rosterNotes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => { this.isDirty = true; });
        });
    }

    // ============================================
    // Group / Tab Management
    // ============================================

    addGroup(group) {
        if (!group.id) group.id = randomId('group');
        if (!Array.isArray(group.garments) || group.garments.length === 0) {
            group.garments = [{
                id: randomId('g'),
                label: 'Garment',
                style: group.garmentStyle || '',
                color: group.garmentColor || '',
                hasBackPrint: false, hasFrontPrint: false, hasQty: false, hasBackLines: false
            }];
        }
        if (!Array.isArray(group.personColumns) || group.personColumns.length === 0) {
            group.personColumns = [...DEFAULT_PERSON_COLUMNS];
        }
        if (!Array.isArray(group.customColumns)) group.customColumns = [];
        if (!group.defaults) group.defaults = {};
        // Strip legacy fields to prevent confusion on re-save
        delete group.garmentStyle; delete group.garmentColor;
        delete group.columns; delete group.columnLabels;

        this.groups.push(group);
        this.activeGroupId = group.id;
        this.isDirty = true;
        this.renderTabs();
        this.loadGroupConfig();
        this.renderTable();
        this.updateUI();
    }

    addGroupFromModal() {
        const name = document.getElementById('newGroupName').value.trim();
        if (!name) {
            this.showToast('Please enter a group name', 'error');
            return;
        }
        const style = document.getElementById('newGroupStyle').value.trim();
        const color = document.getElementById('newGroupColor').value.trim();
        this.addGroup({
            name,
            garments: [{
                id: randomId('g'),
                label: style || 'Garment',
                style, color,
                hasBackPrint: false, hasFrontPrint: false, hasQty: false, hasBackLines: false
            }],
            personColumns: [...DEFAULT_PERSON_COLUMNS, 'fullName'],
            customColumns: []
        });
        this.addRows(5);
        document.getElementById('newGroupName').value = '';
        document.getElementById('newGroupStyle').value = '';
        document.getElementById('newGroupColor').value = '';
        this.closeModal('addGroupModal');
    }

    deleteActiveGroup() {
        if (!this.activeGroupId) return;
        const group = this.groups.find(g => g.id === this.activeGroupId);
        if (!confirm(`Delete group "${group?.name || 'this group'}" and all its rows?`)) return;

        this.rows = this.rows.filter(r => r.groupId !== this.activeGroupId);
        this.groups = this.groups.filter(g => g.id !== this.activeGroupId);
        this.activeGroupId = this.groups.length > 0 ? this.groups[0].id : null;
        this.isDirty = true;
        this.renderTabs();
        this.loadGroupConfig();
        this.renderTable();
        this.updateUI();
    }

    switchTab(groupId) {
        this.collectTableData();
        this.activeGroupId = groupId;
        this.renderTabs();
        this.loadGroupConfig();
        this.renderTable();
    }

    getActiveGroup() {
        return this.groups.find(g => g.id === this.activeGroupId) || null;
    }

    getActiveRows() {
        return this.rows.filter(r => r.groupId === this.activeGroupId);
    }

    // ============================================
    // Tab Rendering
    // ============================================

    renderTabs() {
        const bar = document.getElementById('tabBar');
        const addBtn = document.getElementById('addGroupBtn');

        // Remove existing tab buttons (keep addBtn)
        bar.querySelectorAll('.tab-btn').forEach(b => b.remove());

        this.groups.forEach(group => {
            const count = this.rows.filter(r => r.groupId === group.id).length;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tab-btn' + (group.id === this.activeGroupId ? ' active' : '');
            btn.innerHTML = `${this.escapeHtml(group.name)} <span class="tab-badge">${count}</span>`;
            btn.addEventListener('click', () => this.switchTab(group.id));
            bar.insertBefore(btn, addBtn);
        });
    }

    // ============================================
    // Group Config Panel
    // ============================================

    loadGroupConfig() {
        const group = this.getActiveGroup();
        const panel = document.getElementById('groupConfig');

        if (!group) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = '';
        document.getElementById('groupConfigTitle').textContent = `${group.name} — Settings`;
        document.getElementById('groupName').value = group.name || '';

        this.renderPersonColumnPicker(group);
        this.renderGarmentsEditor(group);
        this.renderCustomColumnsEditor(group);
    }

    renderPersonColumnPicker(group) {
        const host = document.getElementById('personColumnPicker');
        if (!host) return;
        host.innerHTML = Object.entries(PERSON_COLUMN_DEFS).map(([key, def]) => {
            const checked = group.personColumns.includes(key) ? 'checked' : '';
            return `<label><input type="checkbox" value="${key}" ${checked}> ${this.escapeHtml(def.label)}</label>`;
        }).join('');
        host.querySelectorAll('input').forEach(cb => {
            cb.addEventListener('change', () => {
                const g = this.getActiveGroup();
                if (!g) return;
                this.collectTableData();
                const selected = [];
                host.querySelectorAll('input:checked').forEach(i => selected.push(i.value));
                g.personColumns = selected.length > 0 ? selected : ['name'];
                this.isDirty = true;
                this.renderTable();
            });
        });
    }

    renderGarmentsEditor(group) {
        const host = document.getElementById('garmentsEditor');
        if (!host) return;
        host.innerHTML = group.garments.map((g, idx) => `
            <div class="garment-row" data-garment-id="${g.id}">
                <div class="garment-row-header">
                    <span class="garment-row-idx">Garment ${idx + 1}</span>
                    <button type="button" class="btn-sm btn-danger garment-delete-btn" title="Remove garment" ${group.garments.length === 1 ? 'disabled' : ''}>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="garment-row-fields">
                    <input type="text" class="gf-label" placeholder="Label (e.g. T-Shirt)" value="${this.escapeAttr(g.label || '')}">
                    <input type="text" class="gf-style" placeholder="Style (e.g. PC54)" value="${this.escapeAttr(g.style || '')}">
                    <input type="text" class="gf-color" placeholder="Color (e.g. Navy)" value="${this.escapeAttr(g.color || '')}">
                </div>
                <div class="garment-row-toggles">
                    <label><input type="checkbox" class="gf-backPrint"  ${g.hasBackPrint  ? 'checked' : ''}> Back Print</label>
                    <label><input type="checkbox" class="gf-frontPrint" ${g.hasFrontPrint ? 'checked' : ''}> Front Print</label>
                    <label><input type="checkbox" class="gf-qty"        ${g.hasQty        ? 'checked' : ''}> Qty</label>
                    <label><input type="checkbox" class="gf-backLines"  ${g.hasBackLines  ? 'checked' : ''}> Back Lines (1–4)</label>
                </div>
            </div>
        `).join('');

        host.querySelectorAll('.garment-row').forEach(rowEl => {
            const id = rowEl.dataset.garmentId;
            const garment = group.garments.find(g => g.id === id);
            if (!garment) return;

            const bind = (sel, key, isCheckbox) => {
                const el = rowEl.querySelector(sel);
                if (!el) return;
                el.addEventListener('change', () => {
                    this.collectTableData();
                    garment[key] = isCheckbox ? el.checked : el.value.trim();
                    this.isDirty = true;
                    this.renderTable();
                    if (key === 'label') this.renderGarmentsEditor(group);
                });
            };
            bind('.gf-label', 'label', false);
            bind('.gf-style', 'style', false);
            bind('.gf-color', 'color', false);
            bind('.gf-backPrint',  'hasBackPrint',  true);
            bind('.gf-frontPrint', 'hasFrontPrint', true);
            bind('.gf-qty',        'hasQty',        true);
            bind('.gf-backLines',  'hasBackLines',  true);

            const delBtn = rowEl.querySelector('.garment-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', () => {
                    if (group.garments.length === 1) return;
                    if (!confirm(`Remove garment "${garment.label || 'Garment'}"? Sizes and prints entered for it will be cleared.`)) return;
                    this.collectTableData();
                    group.garments = group.garments.filter(g => g.id !== id);
                    this.rows.forEach(r => {
                        if (r.groupId === group.id && r.garmentData) delete r.garmentData[id];
                    });
                    this.isDirty = true;
                    this.renderGarmentsEditor(group);
                    this.renderTable();
                });
            }
        });

        const addBtn = document.getElementById('addGarmentBtn');
        if (addBtn && !addBtn._bound) {
            addBtn._bound = true;
            addBtn.addEventListener('click', () => {
                const g = this.getActiveGroup();
                if (!g) return;
                this.collectTableData();
                g.garments.push({
                    id: randomId('g'),
                    label: 'Garment ' + (g.garments.length + 1),
                    style: '', color: '',
                    hasBackPrint: false, hasFrontPrint: false, hasQty: false, hasBackLines: false
                });
                this.isDirty = true;
                this.renderGarmentsEditor(g);
                this.renderTable();
            });
        }
    }

    renderCustomColumnsEditor(group) {
        const host = document.getElementById('customColumnsEditor');
        if (!host) return;
        if (group.customColumns.length === 0) {
            host.innerHTML = '<p class="custom-cols-empty">No custom columns. Use these for customer-specific fields like "Name for pickup" or "Special instructions".</p>';
        } else {
            host.innerHTML = group.customColumns.map(cc => `
                <div class="custom-col-row" data-col-id="${cc.id}">
                    <input type="text" class="cc-label" placeholder="Column label" value="${this.escapeAttr(cc.label || '')}">
                    <button type="button" class="btn-sm btn-danger cc-delete-btn" title="Remove column">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

            host.querySelectorAll('.custom-col-row').forEach(rowEl => {
                const id = rowEl.dataset.colId;
                const cc = group.customColumns.find(c => c.id === id);
                if (!cc) return;
                rowEl.querySelector('.cc-label').addEventListener('change', e => {
                    this.collectTableData();
                    cc.label = e.target.value.trim();
                    this.isDirty = true;
                    this.renderTable();
                });
                rowEl.querySelector('.cc-delete-btn').addEventListener('click', () => {
                    if (!confirm(`Remove column "${cc.label || 'Custom'}"? Its data will be cleared.`)) return;
                    this.collectTableData();
                    group.customColumns = group.customColumns.filter(c => c.id !== id);
                    this.rows.forEach(r => {
                        if (r.groupId === group.id && r.custom) delete r.custom[id];
                    });
                    this.isDirty = true;
                    this.renderCustomColumnsEditor(group);
                    this.renderTable();
                });
            });
        }

        const addBtn = document.getElementById('addCustomColumnBtn');
        if (addBtn && !addBtn._bound) {
            addBtn._bound = true;
            addBtn.addEventListener('click', () => {
                const g = this.getActiveGroup();
                if (!g) return;
                const label = prompt('Column label (e.g. "Name for pickup"):');
                if (!label || !label.trim()) return;
                this.collectTableData();
                g.customColumns.push({ id: randomId('cc'), label: label.trim() });
                this.isDirty = true;
                this.renderCustomColumnsEditor(g);
                this.renderTable();
            });
        }
    }

    saveGroupConfig() {
        const group = this.getActiveGroup();
        if (!group) return;
        group.name = document.getElementById('groupName').value.trim() || group.name;
        this.isDirty = true;
        this.renderTabs();
    }

    toggleGroupConfig() {
        const body = document.getElementById('groupConfigBody');
        const icon = document.querySelector('#toggleConfigBtn i');
        if (body.style.display === 'none') {
            body.style.display = '';
            icon.className = 'fas fa-chevron-up';
        } else {
            body.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
    }

    // ============================================
    // Data Table
    // ============================================

    /**
     * Builds the flat column descriptor list for the active group.
     * Returns: [{ kind:'person'|'garment'|'custom', key, label, width, garmentId?, field? }]
     */
    buildColumnDescriptors(group) {
        const cols = [];
        group.personColumns.forEach(key => {
            const def = PERSON_COLUMN_DEFS[key];
            if (def) cols.push({ kind: 'person', key, label: def.label, width: def.width });
        });
        group.garments.forEach(g => {
            Object.entries(GARMENT_FIELD_DEFS).forEach(([field, def]) => {
                if (def.toggle && !g[def.toggle]) return;
                cols.push({
                    kind: 'garment',
                    garmentId: g.id,
                    field,
                    label: def.label,
                    width: def.width,
                    garmentLabel: g.label || 'Garment'
                });
            });
        });
        group.customColumns.forEach(cc => {
            cols.push({ kind: 'custom', key: cc.id, label: cc.label || 'Custom', width: '160px' });
        });
        return cols;
    }

    renderTable() {
        const group = this.getActiveGroup();
        if (!group) {
            document.getElementById('tableCard').style.display = 'none';
            const breakdown = document.getElementById('sizeBreakdownCard');
            if (breakdown) breakdown.style.display = 'none';
            return;
        }
        document.getElementById('tableCard').style.display = '';

        const descriptors = this.buildColumnDescriptors(group);
        const multiGarment = group.garments.length > 1;

        // Two-row header when multi-garment: garment bands on top, fields below.
        const thead = document.getElementById('rosterTableHead');
        thead.innerHTML = '';

        if (multiGarment) {
            const topRow = document.createElement('tr');
            const bottomRow = document.createElement('tr');

            topRow.innerHTML = '<th class="row-number" rowspan="2">#</th>';
            // Person columns span rows
            group.personColumns.forEach(key => {
                const def = PERSON_COLUMN_DEFS[key];
                topRow.innerHTML += `<th class="col-person" rowspan="2" style="min-width:${def.width}">${this.escapeHtml(def.label)}</th>`;
            });
            // Garment bands
            group.garments.forEach((g, gi) => {
                const fieldCount = Object.entries(GARMENT_FIELD_DEFS).filter(([f, d]) => !d.toggle || g[d.toggle]).length;
                if (fieldCount === 0) return;
                topRow.innerHTML += `<th class="col-garment-band garment-band-${gi % 4}" colspan="${fieldCount}">${this.escapeHtml(g.label || 'Garment')}${g.style ? ` <span class="garment-band-style">${this.escapeHtml(g.style)}${g.color ? ' / ' + this.escapeHtml(g.color) : ''}</span>` : ''}</th>`;
                Object.entries(GARMENT_FIELD_DEFS).forEach(([field, def]) => {
                    if (def.toggle && !g[def.toggle]) return;
                    bottomRow.innerHTML += `<th class="col-garment garment-band-${gi % 4}" style="min-width:${def.width}">${this.escapeHtml(def.label)}</th>`;
                });
            });
            // Custom columns span rows
            group.customColumns.forEach(cc => {
                topRow.innerHTML += `<th class="col-custom" rowspan="2" style="min-width:160px">${this.escapeHtml(cc.label || 'Custom')}</th>`;
            });
            topRow.innerHTML += '<th class="row-actions" rowspan="2"></th>';

            thead.appendChild(topRow);
            thead.appendChild(bottomRow);
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = '<th class="row-number">#</th>' +
                descriptors.map(d => `<th class="col-${d.kind}" style="min-width:${d.width}">${this.escapeHtml(d.label)}</th>`).join('') +
                '<th class="row-actions"></th>';
            thead.appendChild(tr);
        }

        // Body
        const tbody = document.getElementById('rosterTableBody');
        const rows = this.getActiveRows();
        tbody.innerHTML = '';

        rows.forEach((row, idx) => {
            if (!row.garmentData) row.garmentData = {};
            if (!row.custom) row.custom = {};

            const tr = document.createElement('tr');
            tr.dataset.idx = idx;

            let html = `<td class="row-number">${idx + 1}</td>`;
            descriptors.forEach(d => {
                let val = '';
                let dataAttrs = '';
                if (d.kind === 'person') {
                    val = row[d.key] || '';
                    dataAttrs = `data-kind="person" data-key="${d.key}"`;
                } else if (d.kind === 'garment') {
                    val = (row.garmentData[d.garmentId] && row.garmentData[d.garmentId][d.field]) || '';
                    dataAttrs = `data-kind="garment" data-garment-id="${d.garmentId}" data-field="${d.field}"`;
                } else if (d.kind === 'custom') {
                    val = row.custom[d.key] || '';
                    dataAttrs = `data-kind="custom" data-key="${d.key}"`;
                }
                const placeholder = (d.kind === 'person' && group.defaults[d.key] && !val)
                    ? `placeholder="${this.escapeAttr(group.defaults[d.key])}"` : '';
                html += `<td class="col-${d.kind}${d.kind === 'garment' ? ' garment-band-' + (group.garments.findIndex(g => g.id === d.garmentId) % 4) : ''}"><input type="text" ${dataAttrs} value="${this.escapeAttr(val)}" ${placeholder}></td>`;
            });
            html += `<td class="row-actions"><button type="button" class="row-delete-btn" data-idx="${idx}" title="Remove row"><i class="fas fa-times"></i></button></td>`;

            tr.innerHTML = html;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.row-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteRow(parseInt(btn.dataset.idx, 10)));
        });
        tbody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => { this.isDirty = true; });
            input.addEventListener('change', () => this.renderSizeBreakdown());
        });

        const tfoot = document.getElementById('rosterTableFoot').querySelector('tr');
        tfoot.innerHTML = `<td colspan="${descriptors.length + 2}">Total: ${rows.length} ${rows.length === 1 ? 'person' : 'people'}</td>`;

        this.renderSizeBreakdown();
    }

    collectTableData() {
        const group = this.getActiveGroup();
        if (!group) return;

        const tbody = document.getElementById('rosterTableBody');
        if (!tbody) return;
        const tableRows = tbody.querySelectorAll('tr');
        const activeRows = this.getActiveRows();

        tableRows.forEach((tr, idx) => {
            if (idx >= activeRows.length) return;
            const row = activeRows[idx];
            if (!row.garmentData) row.garmentData = {};
            if (!row.custom) row.custom = {};

            tr.querySelectorAll('input[data-kind]').forEach(input => {
                const kind = input.dataset.kind;
                const val = input.value.trim();
                if (kind === 'person') {
                    row[input.dataset.key] = val;
                } else if (kind === 'garment') {
                    const gid = input.dataset.garmentId;
                    if (!row.garmentData[gid]) row.garmentData[gid] = {};
                    if (val) row.garmentData[gid][input.dataset.field] = val;
                    else delete row.garmentData[gid][input.dataset.field];
                } else if (kind === 'custom') {
                    if (val) row.custom[input.dataset.key] = val;
                    else delete row.custom[input.dataset.key];
                }
            });
        });
    }

    addRows(count) {
        if (!this.activeGroupId) {
            this.showToast('Add a group first', 'error');
            return;
        }

        const group = this.getActiveGroup();
        const existing = this.getActiveRows();
        const startNum = existing.length + 1;

        for (let i = 0; i < count; i++) {
            const row = {
                groupId: this.activeGroupId,
                lineNumber: startNum + i,
                garmentData: {},
                custom: {}
            };
            if (group.defaults) {
                for (const [key, val] of Object.entries(group.defaults)) {
                    if (PERSON_COLUMN_DEFS[key]) row[key] = val;
                }
            }
            this.rows.push(row);
        }

        this.isDirty = true;
        this.renderTable();
        this.renderTabs();
    }

    renderSizeBreakdown() {
        const card = document.getElementById('sizeBreakdownCard');
        const body = document.getElementById('sizeBreakdownBody');
        if (!card || !body) return;

        const group = this.getActiveGroup();
        if (!group) { card.style.display = 'none'; return; }

        const rows = this.getActiveRows();
        if (rows.length === 0) { card.style.display = 'none'; return; }

        // Per-garment size counts from live DOM (so breakdown tracks unsaved edits)
        const tbody = document.getElementById('rosterTableBody');
        const counts = {};    // { garmentId: { size: count } }
        const totals = {};    // { garmentId: count }

        group.garments.forEach(g => { counts[g.id] = {}; totals[g.id] = 0; });

        tbody.querySelectorAll('input[data-kind="garment"][data-field="size"]').forEach(input => {
            const gid = input.dataset.garmentId;
            const size = input.value.trim();
            if (!size || !counts[gid]) return;
            counts[gid][size] = (counts[gid][size] || 0) + 1;
            totals[gid] += 1;
        });

        const hasAny = Object.values(totals).some(n => n > 0);
        if (!hasAny) { card.style.display = 'none'; return; }

        card.style.display = '';
        body.innerHTML = group.garments.map((g, gi) => {
            if (totals[g.id] === 0) return '';
            const sorted = Object.entries(counts[g.id]).sort((a, b) => this.sizeRank(a[0]) - this.sizeRank(b[0]));
            return `
                <div class="breakdown-garment garment-band-${gi % 4}">
                    <div class="breakdown-garment-header">
                        <strong>${this.escapeHtml(g.label || 'Garment')}</strong>
                        ${g.style ? `<span class="breakdown-garment-meta">${this.escapeHtml(g.style)}${g.color ? ' / ' + this.escapeHtml(g.color) : ''}</span>` : ''}
                        <span class="breakdown-garment-total">Total: ${totals[g.id]}</span>
                    </div>
                    <ul class="breakdown-size-list">
                        ${sorted.map(([size, n]) => `<li><span class="breakdown-size">${this.escapeHtml(size)}</span> <span class="breakdown-count">${n}</span></li>`).join('')}
                    </ul>
                </div>
            `;
        }).join('');
    }

    sizeRank(size) {
        const s = (size || '').toUpperCase().trim();
        const order = [
            'YXS','YS','YOUTH EXTRA SMALL','YOUTH SMALL',
            'YM','YOUTH MEDIUM',
            'YL','YOUTH LARGE',
            'YXL','YOUTH EXTRA LARGE',
            'AXS','ADULT EXTRA SMALL','XS',
            'AS','ADULT SMALL','S',
            'AM','ADULT MEDIUM','M',
            'AL','ADULT LARGE','L',
            'AXL','ADULT EXTRA LARGE','XL',
            '2XL','XXL','ADULT 2XL','ADULT XXL',
            '3XL','XXXL',
            '4XL','5XL','6XL','OSFA','ONE SIZE'
        ];
        const idx = order.indexOf(s);
        return idx === -1 ? 999 : idx;
    }

    deleteRow(idx) {
        this.collectTableData();
        const activeRows = this.getActiveRows();
        if (idx < 0 || idx >= activeRows.length) return;

        const targetRow = activeRows[idx];
        const globalIdx = this.rows.indexOf(targetRow);
        if (globalIdx >= 0) {
            this.rows.splice(globalIdx, 1);
        }

        // Renumber
        this.getActiveRows().forEach((r, i) => { r.lineNumber = i + 1; });

        this.isDirty = true;
        this.renderTable();
        this.renderTabs();
    }

    // ============================================
    // Import: Excel Upload
    // ============================================

    async handleExcelUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        this.showToast('Parsing Excel file...', '');

        try {
            const result = await this.service.parseExcel(file);

            if (!result.success) {
                this.showToast('Failed to parse Excel', 'error');
                return;
            }

            // Clear existing data if this is a fresh roster
            if (this.groups.length === 0 || confirm(`Replace current data with ${result.totalGroups} groups and ${result.totalRows} rows from Excel?`)) {
                // Normalize to v2 shape (backend may still return legacy)
                this.groups = (result.groups || []).map(migrateLegacyGroup);
                this.rows = (result.rows || []).map(row => {
                    const g = this.groups.find(gg => gg.id === row.groupId);
                    return g ? migrateLegacyRow(row, g) : row;
                });
                this.activeGroupId = this.groups.length > 0 ? this.groups[0].id : null;

                // Auto-fill roster name from filename
                if (!document.getElementById('rosterName').value) {
                    const name = file.name.replace(/\.(xlsx?|csv)$/i, '').replace(/[_-]/g, ' ');
                    document.getElementById('rosterName').value = name;
                }

                this.isDirty = true;
                this.renderTabs();
                this.loadGroupConfig();
                this.renderTable();
                this.updateUI();
                this.showToast(`Imported ${result.totalGroups} groups, ${result.totalRows} rows`, 'success');
            }
        } catch (err) {
            this.showToast('Error parsing Excel: ' + err.message, 'error');
        }
    }

    // ============================================
    // Import: Paste Names
    // ============================================

    handlePasteImport() {
        const text = document.getElementById('pasteTextarea').value.trim();
        if (!text) {
            this.showToast('Paste some names first', 'error');
            return;
        }

        if (!this.activeGroupId) {
            this.addGroup({ name: 'Roster' });
        }

        this.collectTableData();

        const lines = text.split('\n').filter(l => l.trim());
        const existing = this.getActiveRows();
        let startNum = existing.length + 1;

        const group = this.getActiveGroup();
        const firstGarmentId = group.garments[0]?.id;

        // Map parsed columns: position 0 = last name, 1 = jersey #, 2 = size (first garment)
        for (const line of lines) {
            const parts = (line.includes('\t') ? line.split('\t') : line.split(',')).map(p => p.trim());
            const row = {
                groupId: this.activeGroupId,
                lineNumber: startNum++,
                garmentData: {},
                custom: {}
            };
            if (parts[0]) row.name = parts[0];
            if (parts[1]) row.number = parts[1];
            if (parts[2] && firstGarmentId) row.garmentData[firstGarmentId] = { size: parts[2] };

            if (group.defaults) {
                for (const [key, val] of Object.entries(group.defaults)) {
                    if (PERSON_COLUMN_DEFS[key] && !row[key]) row[key] = val;
                }
            }

            this.rows.push(row);
        }

        // Auto-enable columns the paste actually used
        if (!group.personColumns.includes('name')) group.personColumns.unshift('name');
        const anyHasNumber = lines.some(l => (l.includes('\t') ? l.split('\t') : l.split(',')).length >= 2);
        if (anyHasNumber && !group.personColumns.includes('number')) group.personColumns.push('number');

        this.isDirty = true;
        this.loadGroupConfig();
        this.renderTable();
        this.renderTabs();
        this.closeModal('pasteModal');
        document.getElementById('pasteTextarea').value = '';
        this.showToast(`Imported ${lines.length} names`, 'success');
    }

    // ============================================
    // Import: OCR
    // ============================================

    initOcrDropZone() {
        const dropZone = document.getElementById('ocrDropZone');
        const fileInput = document.getElementById('ocrFileInput');

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.processOcrFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', e => {
            if (e.target.files[0]) this.processOcrFile(e.target.files[0]);
            e.target.value = '';
        });
    }

    async processOcrFile(file) {
        const preview = document.getElementById('ocrPreview');
        const processing = document.getElementById('ocrProcessing');
        const results = document.getElementById('ocrResults');
        const importBtn = document.getElementById('ocrImportBtn');

        // Show preview
        const reader = new FileReader();
        reader.onload = e => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Uploaded roster">`;
            preview.style.display = '';
        };
        reader.readAsDataURL(file);

        // Show processing
        processing.style.display = '';
        results.style.display = 'none';
        importBtn.style.display = 'none';

        try {
            const result = await this.service.ocrImage(file);

            processing.style.display = 'none';

            if (!result.success) {
                results.innerHTML = `<p style="color: var(--nn-error-text);">OCR failed: ${this.escapeHtml(result.error || 'Unknown error')}</p>`;
                results.style.display = '';
                return;
            }

            if (!result.parsed || !result.entries || result.entries.length === 0) {
                results.innerHTML = `<p>No structured data extracted. Raw text:</p><pre style="font-size:0.8rem; background:#f5f5f5; padding:0.5rem; border-radius:0.25rem; white-space:pre-wrap;">${this.escapeHtml(result.rawText || 'No text found')}</pre>`;
                results.style.display = '';
                return;
            }

            // Detect shape: v2 (garments array) or v1 (flat entries). Normalize to v2.
            const detectedGarments = Array.isArray(result.garments) && result.garments.length > 0
                ? result.garments.map(g => ({
                    label: g.label || 'Garment',
                    hasBackPrint:  !!g.hasBackPrint,
                    hasFrontPrint: !!g.hasFrontPrint,
                    hasQty:        !!g.hasQty
                }))
                : [{ label: 'Garment', hasBackPrint: result.entries.some(e => e.backPrint), hasFrontPrint: false, hasQty: false }];

            this._ocrEntries = result.entries;
            this._ocrGarments = detectedGarments;
            this._ocrTeamName = result.teamName;
            this._ocrGroupName = result.groupName;

            // Build preview HTML: editable garment labels + entries table
            let html = `<p style="margin-bottom:0.5rem;"><strong>${result.entries.length} ${result.entries.length === 1 ? 'entry' : 'entries'} extracted</strong>`;
            if (result.teamName) html += ` — ${this.escapeHtml(result.teamName)}`;
            html += `</p>`;

            html += `<div class="ocr-garments-preview">
                <div class="ocr-garments-label">Detected garments (edit labels or remove unused before importing):</div>
                <div id="ocrGarmentsList">${detectedGarments.map((g, i) => `
                    <div class="ocr-garment-chip" data-idx="${i}">
                        <input type="text" class="ocr-garment-label" value="${this.escapeAttr(g.label)}" placeholder="Garment label">
                        <label><input type="checkbox" class="ocr-garment-backPrint" ${g.hasBackPrint ? 'checked' : ''}> Back Print</label>
                        <button type="button" class="ocr-garment-remove" ${detectedGarments.length === 1 ? 'disabled' : ''} title="Remove"><i class="fas fa-times"></i></button>
                    </div>
                `).join('')}</div>
            </div>`;

            // Entries table preview (collapsed if many)
            const sampleCount = Math.min(result.entries.length, 10);
            html += `<div class="ocr-entries-preview">
                <div class="ocr-entries-label">Entries preview (first ${sampleCount} of ${result.entries.length}):</div>
                <table class="roster-table" style="font-size:0.8rem;"><thead><tr>
                    <th>#</th><th>Name</th>
                    ${detectedGarments.map(g => `<th>${this.escapeHtml(g.label)}</th>`).join('')}
                    ${detectedGarments.some(g => g.hasBackPrint) ? '<th>Back Print</th>' : ''}
                    <th>Full Name</th>
                </tr></thead><tbody>`;
            result.entries.slice(0, sampleCount).forEach((entry, i) => {
                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${this.escapeHtml(entry.name || '')}</td>
                    ${detectedGarments.map(g => {
                        const size = (entry.sizes && entry.sizes[g.label]) || (detectedGarments.length === 1 ? entry.size : '') || '';
                        return `<td>${this.escapeHtml(size)}</td>`;
                    }).join('')}
                    ${detectedGarments.some(g => g.hasBackPrint) ? `<td>${this.escapeHtml(entry.backPrint || (entry.backPrints ? Object.values(entry.backPrints).find(Boolean) : '') || '')}</td>` : ''}
                    <td>${this.escapeHtml(entry.fullName || '')}</td>
                </tr>`;
            });
            html += '</tbody></table></div>';

            results.innerHTML = html;
            results.style.display = '';
            importBtn.style.display = '';

            // Wire garment preview editing
            results.querySelectorAll('.ocr-garment-label').forEach(input => {
                input.addEventListener('change', e => {
                    const idx = parseInt(e.target.closest('.ocr-garment-chip').dataset.idx, 10);
                    if (this._ocrGarments[idx]) this._ocrGarments[idx].label = e.target.value.trim();
                });
            });
            results.querySelectorAll('.ocr-garment-backPrint').forEach(input => {
                input.addEventListener('change', e => {
                    const idx = parseInt(e.target.closest('.ocr-garment-chip').dataset.idx, 10);
                    if (this._ocrGarments[idx]) this._ocrGarments[idx].hasBackPrint = e.target.checked;
                });
            });
            results.querySelectorAll('.ocr-garment-remove').forEach(btn => {
                btn.addEventListener('click', e => {
                    if (this._ocrGarments.length === 1) return;
                    const idx = parseInt(e.target.closest('.ocr-garment-chip').dataset.idx, 10);
                    this._ocrGarments.splice(idx, 1);
                    // Re-run the processing render to refresh indices — lazy approach: re-invoke
                    this._refreshOcrPreview();
                });
            });
        } catch (err) {
            processing.style.display = 'none';
            results.innerHTML = `<p style="color: var(--nn-error-text);">Error: ${this.escapeHtml(err.message)}</p>`;
            results.style.display = '';
        }
    }

    _refreshOcrPreview() {
        // Re-render the OCR preview table (e.g. after removing a garment)
        const results = document.getElementById('ocrResults');
        if (!results || !this._ocrEntries) return;

        // Rebuild just the entries table portion
        const sampleCount = Math.min(this._ocrEntries.length, 10);
        const garments = this._ocrGarments;

        // Rebuild garment chips
        const list = document.getElementById('ocrGarmentsList');
        if (list) {
            list.innerHTML = garments.map((g, i) => `
                <div class="ocr-garment-chip" data-idx="${i}">
                    <input type="text" class="ocr-garment-label" value="${this.escapeAttr(g.label)}" placeholder="Garment label">
                    <label><input type="checkbox" class="ocr-garment-backPrint" ${g.hasBackPrint ? 'checked' : ''}> Back Print</label>
                    <button type="button" class="ocr-garment-remove" ${garments.length === 1 ? 'disabled' : ''} title="Remove"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
            list.querySelectorAll('.ocr-garment-label').forEach(input => {
                input.addEventListener('change', e => {
                    const idx = parseInt(e.target.closest('.ocr-garment-chip').dataset.idx, 10);
                    if (this._ocrGarments[idx]) this._ocrGarments[idx].label = e.target.value.trim();
                });
            });
            list.querySelectorAll('.ocr-garment-backPrint').forEach(input => {
                input.addEventListener('change', e => {
                    const idx = parseInt(e.target.closest('.ocr-garment-chip').dataset.idx, 10);
                    if (this._ocrGarments[idx]) this._ocrGarments[idx].hasBackPrint = e.target.checked;
                });
            });
            list.querySelectorAll('.ocr-garment-remove').forEach(btn => {
                btn.addEventListener('click', e => {
                    if (this._ocrGarments.length === 1) return;
                    const idx = parseInt(e.target.closest('.ocr-garment-chip').dataset.idx, 10);
                    this._ocrGarments.splice(idx, 1);
                    this._refreshOcrPreview();
                });
            });
        }
    }

    handleOcrImport() {
        if (!this._ocrEntries || this._ocrEntries.length === 0) return;

        const detected = this._ocrGarments || [{ label: 'Garment', hasBackPrint: false }];

        // Create a new group configured to match the detected garments
        if (!this.activeGroupId) {
            const groupName = this._ocrGroupName || this._ocrTeamName || 'OCR Import';
            const garments = detected.map((g, i) => ({
                id: randomId('g'),
                label: g.label || 'Garment',
                style: '', color: '',
                hasBackPrint:  !!g.hasBackPrint,
                hasFrontPrint: !!g.hasFrontPrint,
                hasQty:        !!g.hasQty,
                hasBackLines:  false
            }));
            const personColumns = [...DEFAULT_PERSON_COLUMNS];
            if (this._ocrEntries.some(e => e.fullName)) personColumns.push('fullName');
            this.addGroup({ name: groupName, garments, personColumns, customColumns: [] });
        }

        // Auto-fill roster name from OCR
        if (this._ocrTeamName && !document.getElementById('rosterName').value) {
            document.getElementById('rosterName').value = this._ocrTeamName;
        }

        this.collectTableData();
        const group = this.getActiveGroup();
        const existing = this.getActiveRows();
        let startNum = existing.length + 1;

        // Build a label -> garmentId map for mapping OCR sizes/backPrints
        const labelToGid = {};
        group.garments.forEach((g, i) => {
            labelToGid[(g.label || '').toLowerCase()] = g.id;
            if (detected[i]) labelToGid[(detected[i].label || '').toLowerCase()] = g.id;
        });

        for (const entry of this._ocrEntries) {
            const row = {
                groupId: this.activeGroupId,
                lineNumber: startNum++,
                name: entry.name || '',
                number: entry.number || '',
                fullName: entry.fullName || '',
                notes: entry.notes || '',
                garmentData: {},
                custom: {}
            };

            // v2 shape: entry.sizes = { "T-shirt": "Youth Medium", "Hoodie": "Adult Small" }
            if (entry.sizes && typeof entry.sizes === 'object') {
                Object.entries(entry.sizes).forEach(([label, size]) => {
                    const gid = labelToGid[(label || '').toLowerCase()] || group.garments[0]?.id;
                    if (gid && size) {
                        if (!row.garmentData[gid]) row.garmentData[gid] = {};
                        row.garmentData[gid].size = size;
                    }
                });
            } else if (entry.size && group.garments[0]) {
                // v1 shape fallback: single size -> first garment
                row.garmentData[group.garments[0].id] = { size: entry.size };
            }

            // Back prints — same pattern
            if (entry.backPrints && typeof entry.backPrints === 'object') {
                Object.entries(entry.backPrints).forEach(([label, bp]) => {
                    const gid = labelToGid[(label || '').toLowerCase()] || group.garments[0]?.id;
                    if (gid && bp) {
                        if (!row.garmentData[gid]) row.garmentData[gid] = {};
                        row.garmentData[gid].backPrint = bp;
                    }
                });
            } else if (entry.backPrint) {
                // Apply to first garment that has Back Print enabled, else first garment
                const target = group.garments.find(g => g.hasBackPrint) || group.garments[0];
                if (target) {
                    if (!row.garmentData[target.id]) row.garmentData[target.id] = {};
                    row.garmentData[target.id].backPrint = entry.backPrint;
                }
            }

            this.rows.push(row);
        }

        this.isDirty = true;
        this.loadGroupConfig();
        this.renderTable();
        this.renderTabs();
        this.closeModal('ocrModal');
        this.showToast(`Imported ${this._ocrEntries.length} names from OCR`, 'success');

        this._ocrEntries = null;
        this._ocrGarments = null;
        this._ocrTeamName = null;
        this._ocrGroupName = null;
    }

    // ============================================
    // Save / Load
    // ============================================

    getRosterData() {
        this.collectTableData();

        return {
            RosterName: document.getElementById('rosterName').value.trim(),
            CompanyName: document.getElementById('companyName').value.trim(),
            OrderNumber: parseInt(document.getElementById('orderNumber').value, 10) || null,
            ContactName: document.getElementById('contactName').value.trim(),
            ContactEmail: document.getElementById('contactEmail').value.trim(),
            SalesRep: document.getElementById('salesRep').value.trim(),
            Notes: document.getElementById('rosterNotes').value.trim(),
            GroupsJSON: JSON.stringify(this.groups),
            RosterJSON: JSON.stringify(this.rows),
            TotalPersons: this.rows.length
        };
    }

    async save(status) {
        const data = this.getRosterData();
        if (!data.RosterName) {
            this.showToast('Roster name is required', 'error');
            document.getElementById('rosterName').focus();
            return;
        }

        data.Status = status;
        data.CreatedBy = data.CreatedBy || (sessionStorage.getItem('nwca_user_name') || 'Staff');

        try {
            let result;
            if (this.currentRosterId) {
                result = await this.service.updateRoster(this.currentRosterId, data);
                this.showToast('Roster saved successfully', 'success');
            } else {
                result = await this.service.createRoster(data);
                if (result.roster && result.roster.ID_Roster) {
                    this.currentRosterId = result.roster.ID_Roster;
                    // Update URL without reload
                    const url = new URL(window.location);
                    url.searchParams.set('load', this.currentRosterId);
                    window.history.replaceState({}, '', url);
                }
                this.showToast('Roster created successfully', 'success');
            }

            this.isDirty = false;
            this.updateStatusBadge(status);
        } catch (err) {
            this.showToast('Save failed: ' + err.message, 'error');
        }
    }

    async loadRoster(id) {
        try {
            const result = await this.service.getRoster(id);
            if (!result.success || !result.roster) {
                this.showToast('Roster not found', 'error');
                return;
            }

            const r = result.roster;
            this.currentRosterId = r.ID_Roster;

            // Populate form fields
            document.getElementById('rosterName').value = r.RosterName || '';
            document.getElementById('companyName').value = r.CompanyName || '';
            document.getElementById('orderNumber').value = r.OrderNumber || '';
            document.getElementById('contactName').value = r.ContactName || '';
            document.getElementById('contactEmail').value = r.ContactEmail || '';
            document.getElementById('salesRep').value = r.SalesRep || '';
            document.getElementById('rosterNotes').value = r.Notes || '';

            // Parse JSON fields + migrate legacy shapes to v2
            try { this.groups = JSON.parse(r.GroupsJSON || '[]'); } catch { this.groups = []; }
            try { this.rows = JSON.parse(r.RosterJSON || '[]'); } catch { this.rows = []; }

            this.groups = this.groups.map(migrateLegacyGroup);
            this.rows = this.rows.map(row => {
                const g = this.groups.find(gg => gg.id === row.groupId);
                return g ? migrateLegacyRow(row, g) : row;
            });

            this.activeGroupId = this.groups.length > 0 ? this.groups[0].id : null;
            this.isDirty = false;

            this.updateStatusBadge(r.Status || 'Draft');
            this.renderTabs();
            this.loadGroupConfig();
            this.renderTable();
            this.updateUI();
            this.showToast('Roster loaded', 'success');
        } catch (err) {
            this.showToast('Failed to load roster: ' + err.message, 'error');
        }
    }

    // ============================================
    // Search
    // ============================================

    toggleSearch() {
        const panel = document.getElementById('searchPanel');
        panel.style.display = panel.style.display === 'none' ? '' : 'none';
        if (panel.style.display !== 'none') {
            document.getElementById('searchInput').focus();
        }
    }

    async doSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        const results = document.getElementById('searchResults');
        results.innerHTML = '<div class="ocr-processing"><div class="spinner"></div> Searching...</div>';

        try {
            // Search by company name and roster name
            const [byCompany, byName] = await Promise.all([
                this.service.listRosters({ companyName: query }),
                this.service.listRosters({ rosterName: query })
            ]);

            // Merge and deduplicate
            const allRosters = [...(byCompany.rosters || []), ...(byName.rosters || [])];
            const seen = new Set();
            const unique = allRosters.filter(r => {
                if (seen.has(r.ID_Roster)) return false;
                seen.add(r.ID_Roster);
                return true;
            });

            if (unique.length === 0) {
                results.innerHTML = '<p style="color: var(--nn-text-secondary); padding: 0.5rem 0;">No rosters found.</p>';
                return;
            }

            let html = '<div style="max-height: 300px; overflow-y: auto;">';
            unique.forEach(r => {
                const statusClass = (r.Status || 'draft').toLowerCase().replace(/\s+/g, '-');
                html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--nn-border); cursor: pointer;"
                    onclick="controller.loadRoster(${r.ID_Roster}); controller.toggleSearch();">
                    <div>
                        <strong>${this.escapeHtml(r.RosterName || 'Untitled')}</strong>
                        <span style="color: var(--nn-text-secondary); margin-left: 0.5rem;">${this.escapeHtml(r.CompanyName || '')}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="status-badge status-${statusClass}">${this.escapeHtml(r.Status || 'Draft')}</span>
                        <span style="font-size: 0.8rem; color: var(--nn-text-secondary);">${r.TotalPersons || 0} people</span>
                    </div>
                </div>`;
            });
            html += '</div>';
            results.innerHTML = html;
        } catch (err) {
            results.innerHTML = `<p style="color: var(--nn-error-text);">Search failed: ${this.escapeHtml(err.message)}</p>`;
        }
    }

    // ============================================
    // Export Excel
    // ============================================

    exportExcel() {
        this.collectTableData();

        const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        let csv = '';

        this.groups.forEach(group => {
            const descriptors = this.buildColumnDescriptors(group);
            const groupRows = this.rows.filter(r => r.groupId === group.id);
            const garmentSummary = group.garments.map(g => `${g.label}${g.style ? ' ' + g.style : ''}${g.color ? ' ' + g.color : ''}`).join(' + ');

            csv += `\n--- ${group.name}${garmentSummary ? ' (' + garmentSummary + ')' : ''} ---\n`;

            // Header — multi-garment uses "Garment: Field" syntax to disambiguate
            const headerCells = descriptors.map(d => {
                if (d.kind === 'garment' && group.garments.length > 1) return `${d.garmentLabel}: ${d.label}`;
                return d.label;
            });
            csv += headerCells.map(esc).join(',') + '\n';

            // Rows
            groupRows.forEach(row => {
                const cells = descriptors.map(d => {
                    if (d.kind === 'person') return row[d.key] || '';
                    if (d.kind === 'garment') return (row.garmentData && row.garmentData[d.garmentId] && row.garmentData[d.garmentId][d.field]) || '';
                    if (d.kind === 'custom') return (row.custom && row.custom[d.key]) || '';
                    return '';
                });
                csv += cells.map(esc).join(',') + '\n';
            });

            // Size breakdown per garment
            group.garments.forEach(g => {
                const counts = {};
                let total = 0;
                groupRows.forEach(r => {
                    const size = r.garmentData?.[g.id]?.size;
                    if (size) { counts[size] = (counts[size] || 0) + 1; total++; }
                });
                if (total === 0) return;
                csv += `\n${g.label} totals (${total}):\n`;
                Object.entries(counts)
                    .sort((a, b) => this.sizeRank(a[0]) - this.sizeRank(b[0]))
                    .forEach(([size, n]) => { csv += `${esc(size)},${n}\n`; });
            });
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (document.getElementById('rosterName').value || 'roster') + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ============================================
    // UI Helpers
    // ============================================

    updateUI() {
        const hasGroups = this.groups.length > 0;
        document.getElementById('emptyState').style.display = hasGroups ? 'none' : '';
        document.getElementById('tableCard').style.display = hasGroups ? '' : 'none';
        document.getElementById('groupConfig').style.display = hasGroups ? '' : 'none';
        const breakdown = document.getElementById('sizeBreakdownCard');
        if (breakdown && !hasGroups) breakdown.style.display = 'none';
    }

    updateStatusBadge(status) {
        const badge = document.getElementById('statusBadge');
        const cls = (status || 'draft').toLowerCase().replace(/\s+/g, '-');
        badge.className = `status-badge status-${cls}`;
        badge.textContent = status || 'Draft';
    }

    resetAll() {
        if (this.isDirty && !confirm('Discard unsaved changes?')) return;
        this.groups = [];
        this.rows = [];
        this.activeGroupId = null;
        this.currentRosterId = null;
        this.isDirty = false;

        ['rosterName', 'companyName', 'orderNumber', 'contactName', 'contactEmail', 'salesRep', 'rosterNotes'].forEach(id => {
            document.getElementById(id).value = '';
        });

        this.updateStatusBadge('Draft');

        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);

        this.renderTabs();
        this.renderTable();
        this.updateUI();
    }

    openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show' + (type ? ' ' + type : '');
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

// Initialize
const controller = new NamesNumbersController();
