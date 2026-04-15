/**
 * Names & Numbers Controller
 * UI logic, state management, tab/group system, import handlers
 */

const COLUMN_DEFS = {
    name:      { label: 'Last Name',    width: '140px' },
    firstName: { label: 'First Name',   width: '120px' },
    number:    { label: 'Jersey #',     width: '80px' },
    size:      { label: 'Size',         width: '100px' },
    nickname:  { label: 'Nickname',     width: '120px' },
    backLine1: { label: 'Back Line 1',  width: '150px' },
    backLine2: { label: 'Back Line 2',  width: '150px' },
    backLine3: { label: 'Back Line 3',  width: '120px' },
    backLine4: { label: 'Back Line 4',  width: '180px' },
    frontPrint:{ label: 'Front Print',  width: '180px' },
    backPrint: { label: 'Back Print',   width: '180px' },
    qty:       { label: 'Qty',          width: '70px' },
    notes:     { label: 'Notes',        width: '180px' }
};

const DEFAULT_COLUMNS = ['name', 'number', 'size'];

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
        document.getElementById('garmentStyle').addEventListener('change', () => this.saveGroupConfig());
        document.getElementById('garmentColor').addEventListener('change', () => this.saveGroupConfig());
        document.getElementById('columnPicker').addEventListener('change', () => {
            this.saveGroupConfig();
            this.renderTable();
        });

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
        if (!group.id) {
            group.id = 'group-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        }
        if (!group.columns || group.columns.length === 0) {
            group.columns = [...DEFAULT_COLUMNS];
        }
        if (!group.columnLabels) {
            group.columnLabels = group.columns.map(c => COLUMN_DEFS[c]?.label || c);
        }
        if (!group.defaults) group.defaults = {};
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
        this.addGroup({
            name,
            garmentStyle: document.getElementById('newGroupStyle').value.trim(),
            garmentColor: document.getElementById('newGroupColor').value.trim(),
            columns: [...DEFAULT_COLUMNS]
        });
        // Add 5 empty rows
        this.addRows(5);
        // Reset modal
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
        document.getElementById('garmentStyle').value = group.garmentStyle || '';
        document.getElementById('garmentColor').value = group.garmentColor || '';

        // Set column checkboxes
        document.querySelectorAll('#columnPicker input[type="checkbox"]').forEach(cb => {
            cb.checked = group.columns.includes(cb.value);
        });
    }

    saveGroupConfig() {
        const group = this.getActiveGroup();
        if (!group) return;

        group.name = document.getElementById('groupName').value.trim() || group.name;
        group.garmentStyle = document.getElementById('garmentStyle').value.trim();
        group.garmentColor = document.getElementById('garmentColor').value.trim();

        // Get selected columns
        const cols = [];
        document.querySelectorAll('#columnPicker input[type="checkbox"]:checked').forEach(cb => {
            cols.push(cb.value);
        });
        group.columns = cols.length > 0 ? cols : ['name'];
        group.columnLabels = group.columns.map(c => COLUMN_DEFS[c]?.label || c);

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

    renderTable() {
        const group = this.getActiveGroup();
        if (!group) {
            document.getElementById('tableCard').style.display = 'none';
            return;
        }
        document.getElementById('tableCard').style.display = '';

        const cols = group.columns;

        // Header
        const thead = document.getElementById('rosterTableHead').querySelector('tr');
        thead.innerHTML = '<th class="row-number">#</th>' +
            cols.map(c => `<th style="min-width:${COLUMN_DEFS[c]?.width || '120px'}">${this.escapeHtml(COLUMN_DEFS[c]?.label || c)}</th>`).join('') +
            '<th class="row-actions"></th>';

        // Body
        const tbody = document.getElementById('rosterTableBody');
        const rows = this.getActiveRows();
        tbody.innerHTML = '';

        rows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.dataset.idx = idx;

            let html = `<td class="row-number">${idx + 1}</td>`;
            cols.forEach(col => {
                const val = row[col] || '';
                html += `<td><input type="text" data-col="${col}" value="${this.escapeAttr(val)}"
                    ${group.defaults[col] && !val ? `placeholder="${this.escapeAttr(group.defaults[col])}"` : ''}></td>`;
            });
            html += `<td class="row-actions"><button type="button" class="row-delete-btn" data-idx="${idx}" title="Remove row"><i class="fas fa-times"></i></button></td>`;

            tr.innerHTML = html;
            tbody.appendChild(tr);
        });

        // Bind delete buttons
        tbody.querySelectorAll('.row-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteRow(parseInt(btn.dataset.idx, 10)));
        });

        // Bind input changes for dirty tracking
        tbody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => { this.isDirty = true; });
        });

        // Footer
        const tfoot = document.getElementById('rosterTableFoot').querySelector('tr');
        tfoot.innerHTML = `<td colspan="${cols.length + 2}">Total: ${rows.length} rows</td>`;
    }

    collectTableData() {
        const group = this.getActiveGroup();
        if (!group) return;

        const tbody = document.getElementById('rosterTableBody');
        const tableRows = tbody.querySelectorAll('tr');
        const activeRows = this.getActiveRows();

        tableRows.forEach((tr, idx) => {
            if (idx >= activeRows.length) return;
            const row = activeRows[idx];
            tr.querySelectorAll('input[data-col]').forEach(input => {
                row[input.dataset.col] = input.value.trim();
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
            const row = { groupId: this.activeGroupId, lineNumber: startNum + i };
            // Apply defaults
            if (group.defaults) {
                for (const [key, val] of Object.entries(group.defaults)) {
                    row[key] = val;
                }
            }
            this.rows.push(row);
        }

        this.isDirty = true;
        this.renderTable();
        this.renderTabs();
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
                this.groups = result.groups;
                this.rows = result.rows;
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
            // Auto-create a group
            this.addGroup({ name: 'Roster', columns: [...DEFAULT_COLUMNS] });
        }

        this.collectTableData();

        const lines = text.split('\n').filter(l => l.trim());
        const existing = this.getActiveRows();
        let startNum = existing.length + 1;

        const group = this.getActiveGroup();

        for (const line of lines) {
            // Split by tab or comma
            const parts = line.includes('\t') ? line.split('\t') : line.split(',');
            const row = {
                groupId: this.activeGroupId,
                lineNumber: startNum++
            };

            // Map parts to columns based on group config
            const cols = group.columns;
            parts.forEach((part, i) => {
                if (i < cols.length) {
                    row[cols[i]] = part.trim();
                }
            });

            // Apply defaults for any missing fields
            if (group.defaults) {
                for (const [key, val] of Object.entries(group.defaults)) {
                    if (!row[key]) row[key] = val;
                }
            }

            this.rows.push(row);
        }

        this.isDirty = true;
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

            // Store OCR results for import
            this._ocrEntries = result.entries;
            this._ocrTeamName = result.teamName;
            this._ocrGroupName = result.groupName;

            // Show preview table
            let html = `<p style="margin-bottom:0.5rem;"><strong>${result.totalExtracted} entries extracted</strong>`;
            if (result.teamName) html += ` — ${this.escapeHtml(result.teamName)}`;
            html += `</p>`;
            html += '<table class="roster-table" style="font-size:0.8rem;"><thead><tr><th>#</th><th>Name</th><th>#</th><th>Size</th><th>Notes</th></tr></thead><tbody>';
            result.entries.forEach((entry, i) => {
                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${this.escapeHtml(entry.name || '')}</td>
                    <td>${this.escapeHtml(entry.number || '')}</td>
                    <td>${this.escapeHtml(entry.size || '')}</td>
                    <td>${this.escapeHtml(entry.notes || '')}</td>
                </tr>`;
            });
            html += '</tbody></table>';

            results.innerHTML = html;
            results.style.display = '';
            importBtn.style.display = '';
        } catch (err) {
            processing.style.display = 'none';
            results.innerHTML = `<p style="color: var(--nn-error-text);">Error: ${this.escapeHtml(err.message)}</p>`;
            results.style.display = '';
        }
    }

    handleOcrImport() {
        if (!this._ocrEntries || this._ocrEntries.length === 0) return;

        if (!this.activeGroupId) {
            const groupName = this._ocrGroupName || this._ocrTeamName || 'OCR Import';
            this.addGroup({ name: groupName, columns: ['name', 'number', 'size'] });
        }

        // Auto-fill roster name from OCR
        if (this._ocrTeamName && !document.getElementById('rosterName').value) {
            document.getElementById('rosterName').value = this._ocrTeamName;
        }

        this.collectTableData();
        const existing = this.getActiveRows();
        let startNum = existing.length + 1;

        for (const entry of this._ocrEntries) {
            this.rows.push({
                groupId: this.activeGroupId,
                lineNumber: startNum++,
                name: entry.name || '',
                number: entry.number || '',
                size: entry.size || '',
                backPrint: entry.backPrint || '',
                notes: entry.notes || ''
            });
        }

        this.isDirty = true;
        this.renderTable();
        this.renderTabs();
        this.closeModal('ocrModal');
        this.showToast(`Imported ${this._ocrEntries.length} names from OCR`, 'success');

        // Cleanup
        this._ocrEntries = null;
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

            // Parse JSON fields
            try { this.groups = JSON.parse(r.GroupsJSON || '[]'); } catch { this.groups = []; }
            try { this.rows = JSON.parse(r.RosterJSON || '[]'); } catch { this.rows = []; }

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

        // Build CSV per group (simple export — full XLSX would need SheetJS on frontend)
        let csv = '';
        this.groups.forEach(group => {
            const groupRows = this.rows.filter(r => r.groupId === group.id);
            csv += `\n--- ${group.name} (${group.garmentStyle} ${group.garmentColor}) ---\n`;
            csv += group.columns.map(c => COLUMN_DEFS[c]?.label || c).join(',') + '\n';
            groupRows.forEach(row => {
                csv += group.columns.map(c => `"${(row[c] || '').replace(/"/g, '""')}"`).join(',') + '\n';
            });
        });

        const blob = new Blob([csv], { type: 'text/csv' });
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
