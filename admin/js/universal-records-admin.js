/* universal-records-admin.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in admin/universal-records-admin.html (Rule 3, 2026.09.05.11) ──
/**
         * HTML-escape untrusted text before it reaches innerHTML.
         *
         * 🔴 WHY (2026-08-17 security fix): every quote field rendered on this page
         * is ANONYMOUSLY WRITABLE. The proxy's quote-write-guard
         * (src/utils/quote-write-guard.js) whitelists CustomerName, CompanyName,
         * CustomerEmail, Notes, Status and QuoteID as writable columns and enforces
         * only a LENGTH cap — it never escapes. Combined with the unauthenticated
         * POST /api/quote_sessions write path, a stranger could store markup that
         * executed here, on page load, inside an authenticated SAML staff session.
         * CSP is report-only in production, so nothing blocked it.
         *
         * ⚠️ This is safe for TEXT and QUOTED-ATTRIBUTE contexts only. It is NOT
         * safe inside an inline event handler: the HTML parser decodes entities
         * BEFORE the JS is parsed, so `onclick="f('&#39;')"` still breaks out.
         * That is why the row actions below use data-* attributes + a delegated
         * listener instead of inline onclick/onchange.
         */
        function escapeHtml(value) {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        /**
         * Universal Records Admin Panel
         * Manages all quote types and provides analytics
         */
        class UniversalRecordsAdmin {
            constructor() {
                this.baseURL = ''; // same-origin since the 2026-08-26 quote-plane lockdown (staff session auth)
                this.currentPage = 1;
                this.recordsPerPage = 50;
                this.totalRecords = 0;
                this.allRecords = [];
                this.filteredRecords = [];
                
                this.initializeEventListeners();
                this.loadInitialData();
            }

            initializeEventListeners() {
                // Auto-refresh every 5 minutes, but ONLY while the tab is visible.
                //
                // This page fetches EVERY quote session with no filter, which the
                // proxy cannot cache (its cache is keyed on the WHERE clause, and
                // there isn't one) — so each refresh is a full multi-page Caspio
                // scan. Left open in a background tab it burned 288 of those a day
                // against nobody. The query stays unfiltered on purpose: this is
                // the admin's find-any-record view, and a date window would hide
                // older records from it. (2026-07-26 Caspio quota reduction)
                setInterval(() => {
                    if (document.hidden) return;
                    this.loadInitialData();
                }, 5 * 60 * 1000);

                // Refresh on return so a backgrounded tab isn't showing stale rows.
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) this.loadInitialData();
                });
                
                // Filter change listeners
                document.getElementById('quoteTypeFilter').addEventListener('change', () => this.applyFilters());
                document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
                document.getElementById('customerFilter').addEventListener('input', () => this.debouncedFilter());
                
                // Set default date range (last 30 days)
                const today = new Date();
                const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                
                document.getElementById('dateToFilter').value = today.toISOString().split('T')[0];
                document.getElementById('dateFromFilter').value = thirtyDaysAgo.toISOString().split('T')[0];

                // Row actions are DELEGATED, not inline onclick/onchange (2026-08-17).
                // QuoteID and PK_ID are anonymously writable columns, and an inline
                // handler is a second injection context that HTML-escaping cannot
                // protect — the parser decodes entities before the JS is parsed.
                // Reading the value from a data-* attribute never parses it as code.
                // Bound to the tbody element itself, which is static markup, so it
                // survives every renderTable() innerHTML replacement of its children.
                const tbody = document.getElementById('recordsTableBody');
                tbody.addEventListener('click', (e) => {
                    const btn = e.target.closest('button[data-action]');
                    if (!btn || !tbody.contains(btn)) return;
                    const quoteId = btn.dataset.quoteId;
                    const pkId = btn.dataset.pkId;
                    switch (btn.dataset.action) {
                        case 'view': viewQuote(quoteId); break;
                        case 'edit': editQuote(quoteId, pkId); break;
                        case 'duplicate': duplicateQuote(quoteId); break;
                        case 'export': exportQuote(quoteId); break;
                        case 'delete': deleteQuote(quoteId, pkId); break;
                    }
                });
                tbody.addEventListener('change', (e) => {
                    const sel = e.target.closest('select[data-action="status"]');
                    if (!sel || !tbody.contains(sel)) return;
                    updateQuoteStatus(sel.dataset.quoteId, sel.dataset.pkId, sel.value);
                });
            }

            // Debounced filter for search input
            debouncedFilter = this.debounce(() => this.applyFilters(), 300);

            debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            }

            async loadInitialData() {
                try {                    
                    // Load all quote sessions
                    const response = await fetch(`${this.baseURL}/api/quote_sessions`);
                    const quotes = await response.json();                    
                    // Filter out ADR quotes (Adriyella has a separate management system)
                    this.allRecords = quotes.filter(quote => !quote.QuoteID.startsWith('ADR'));                    
                    // Stats calculation removed - no longer displaying stats section
                    // this.calculateStats();
                    this.applyFilters();
                    
                } catch (error) {
                    console.error('[UniversalRecordsAdmin] Error loading data:', error);
                    this.showError('Failed to load quote data');
                }
            }

            // Stats calculation method - commented out since stats section was removed
            /*
            calculateStats() {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                
                // Total quotes
                const totalQuotes = this.allRecords.length;
                
                // Total value
                const totalValue = this.allRecords.reduce((sum, quote) => sum + (quote.TotalAmount || 0), 0);
                
                // This month's quotes
                const thisMonthQuotes = this.allRecords.filter(quote => {
                    const quoteDate = new Date(quote.CreatedAt);
                    return quoteDate >= startOfMonth;
                });
                
                // Last month's quotes for comparison
                const lastMonthQuotes = this.allRecords.filter(quote => {
                    const quoteDate = new Date(quote.CreatedAt);
                    return quoteDate >= lastMonth && quoteDate <= endOfLastMonth;
                });
                
                // Conversion rate
                const convertedQuotes = this.allRecords.filter(quote => quote.Status === 'Converted');
                const conversionRate = totalQuotes > 0 ? (convertedQuotes.length / totalQuotes * 100) : 0;
                
                // Calculate changes
                const monthlyChange = lastMonthQuotes.length > 0 ? 
                    ((thisMonthQuotes.length - lastMonthQuotes.length) / lastMonthQuotes.length * 100) : 0;
                
                // Update UI
                document.getElementById('totalQuotes').textContent = totalQuotes.toLocaleString();
                document.getElementById('totalValue').textContent = `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                document.getElementById('monthlyQuotes').textContent = thisMonthQuotes.length.toLocaleString();
                document.getElementById('conversionRate').textContent = `${conversionRate.toFixed(1)}%`;
                
                // Update change indicators
                const quotesChangeEl = document.getElementById('quotesChange');
                quotesChangeEl.textContent = `${Math.abs(monthlyChange).toFixed(1)}% ${monthlyChange >= 0 ? 'increase' : 'decrease'} from last month`;
                quotesChangeEl.className = `stat-change ${monthlyChange >= 0 ? 'positive' : 'negative'}`;
                
                // Placeholder for other changes
                document.getElementById('valueChange').textContent = 'vs last month';
                document.getElementById('monthlyChange').textContent = `${thisMonthQuotes.length} quotes this month`;
                document.getElementById('conversionChange').textContent = `${convertedQuotes.length} converted`;
            }
            */

            applyFilters() {
                const typeFilter = document.getElementById('quoteTypeFilter').value;
                const statusFilter = document.getElementById('statusFilter').value;
                const dateFromFilter = document.getElementById('dateFromFilter').value;
                const dateToFilter = document.getElementById('dateToFilter').value;
                const customerFilter = document.getElementById('customerFilter').value.toLowerCase();
                const minAmountFilter = parseFloat(document.getElementById('minAmountFilter').value) || 0;
                
                this.filteredRecords = this.allRecords.filter(quote => {
                    // Exclude ADR quotes (they have a separate management system)
                    if (quote.QuoteID.startsWith('ADR')) {
                        return false;
                    }
                    
                    // Type filter
                    if (typeFilter && !quote.QuoteID.startsWith(typeFilter)) {
                        return false;
                    }
                    
                    // Status filter
                    if (statusFilter && quote.Status !== statusFilter) {
                        return false;
                    }
                    
                    // Date filters
                    const quoteDate = new Date(quote.CreatedAt);
                    if (dateFromFilter && quoteDate < new Date(dateFromFilter)) {
                        return false;
                    }
                    if (dateToFilter && quoteDate > new Date(dateToFilter + 'T23:59:59')) {
                        return false;
                    }
                    
                    // Customer filter
                    if (customerFilter) {
                        const customerName = (quote.CustomerName || '').toLowerCase();
                        const customerEmail = (quote.CustomerEmail || '').toLowerCase();
                        const companyName = (quote.CompanyName || '').toLowerCase();
                        
                        if (!customerName.includes(customerFilter) && 
                            !customerEmail.includes(customerFilter) && 
                            !companyName.includes(customerFilter)) {
                            return false;
                        }
                    }
                    
                    // Amount filter
                    if (minAmountFilter > 0 && (quote.TotalAmount || 0) < minAmountFilter) {
                        return false;
                    }
                    
                    return true;
                });
                
                this.currentPage = 1;
                this.renderTable();
                this.updatePagination();
            }

            renderTable() {
                const startIndex = (this.currentPage - 1) * this.recordsPerPage;
                const endIndex = startIndex + this.recordsPerPage;
                const pageRecords = this.filteredRecords.slice(startIndex, endIndex);
                
                const tbody = document.getElementById('recordsTableBody');
                
                if (pageRecords.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                                No records found matching your criteria
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                tbody.innerHTML = pageRecords.map(quote => `
                    <tr>
                        <td>
                            <strong>${escapeHtml(quote.QuoteID)}</strong>
                        </td>
                        <td>
                            <span class="quote-type ${escapeHtml(this.getQuoteTypeClass(quote.QuoteID))}">
                                ${escapeHtml(this.getQuoteTypeName(quote.QuoteID))}
                            </span>
                        </td>
                        <td>
                            <div>
                                <strong>${escapeHtml(quote.CustomerName || 'Unknown')}</strong>
                                <br>
                                <small style="color: var(--text-secondary);">${escapeHtml(quote.CustomerEmail || '')}</small>
                            </div>
                        </td>
                        <td>${escapeHtml(quote.CompanyName || 'N/A')}</td>
                        <td>
                            <strong>$${(quote.TotalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                        </td>
                        <td>
                            <select class="status-select ${escapeHtml(String(quote.Status || '').toLowerCase())}"
                                    data-quote-id="${escapeHtml(quote.QuoteID)}"
                                    data-pk-id="${escapeHtml(quote.PK_ID)}"
                                    data-action="status">
                                <option value="Open" ${quote.Status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="Sent" ${quote.Status === 'Sent' ? 'selected' : ''}>Sent</option>
                                <option value="Converted" ${quote.Status === 'Converted' ? 'selected' : ''}>Converted</option>
                                <option value="Expired" ${quote.Status === 'Expired' ? 'selected' : ''}>Expired</option>
                                <option value="Cancelled" ${quote.Status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </td>
                        <td>
                            <div>
                                ${new Date(quote.CreatedAt).toLocaleDateString()}
                                <br>
                                <small style="color: var(--text-secondary);">
                                    ${new Date(quote.CreatedAt).toLocaleTimeString()}
                                </small>
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; gap: 0.25rem;">
                                <button class="btn btn-sm btn-secondary" data-action="view" data-quote-id="${escapeHtml(quote.QuoteID)}" title="View Details">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-primary" data-action="edit" data-quote-id="${escapeHtml(quote.QuoteID)}" data-pk-id="${escapeHtml(quote.PK_ID)}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-secondary" data-action="duplicate" data-quote-id="${escapeHtml(quote.QuoteID)}" title="Duplicate">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button class="btn btn-sm btn-secondary" data-action="export" data-quote-id="${escapeHtml(quote.QuoteID)}" title="Export">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-sm btn-secondary" style="background: #fee2e2; color: #991b1b; border-color: #fecaca;" data-action="delete" data-quote-id="${escapeHtml(quote.QuoteID)}" data-pk-id="${escapeHtml(quote.PK_ID)}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                
                // Update record count
                document.getElementById('recordsCount').textContent = 
                    `Showing ${startIndex + 1}-${Math.min(endIndex, this.filteredRecords.length)} of ${this.filteredRecords.length} records`;
            }

            getQuoteTypeClass(quoteID) {
                const type = quoteID.split(/[0-9]/)[0];
                switch(type) {
                    case 'DTG': return 'dtg';
                    case 'RICH': return 'rich';
                    case 'EMB': return 'emb';
                    case 'EMBC': return 'embc';
                    case 'LT': return 'lt';
                    case 'PATCH': return 'patch';
                    case 'SPC': return 'spc';
                    case 'SSC': return 'ssc';
                    case 'WEB': return 'web';
                    case 'ADR': return 'adr';
                    default: return 'dtg';
                }
            }

            getQuoteTypeName(quoteID) {
                const type = quoteID.split(/[0-9]/)[0];
                switch(type) {
                    case 'DTG': return 'DTG';
                    case 'RICH': return 'Richardson';
                    case 'EMB': return 'Embroidery';
                    case 'EMBC': return 'Cust. Emb.';
                    case 'LT': return 'Laser';
                    case 'PATCH': return 'Patch';
                    case 'SPC': return 'Screen Print';
                    case 'SSC': return 'Safety';
                    case 'WEB': return 'Webstore';
                    case 'ADR': return 'Adriyella';
                    default: return 'Unknown';
                }
            }

            updatePagination() {
                const totalPages = Math.ceil(this.filteredRecords.length / this.recordsPerPage);
                
                document.getElementById('paginationInfo').textContent = 
                    `Page ${this.currentPage} of ${totalPages}`;
                
                document.getElementById('prevBtn').disabled = this.currentPage <= 1;
                document.getElementById('nextBtn').disabled = this.currentPage >= totalPages;
                
                // Generate page numbers
                const pageNumbers = document.getElementById('pageNumbers');
                pageNumbers.innerHTML = '';
                
                const startPage = Math.max(1, this.currentPage - 2);
                const endPage = Math.min(totalPages, this.currentPage + 2);
                
                for (let i = startPage; i <= endPage; i++) {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = `pagination-btn ${i === this.currentPage ? 'active' : ''}`;
                    pageBtn.textContent = i;
                    pageBtn.onclick = () => this.changePage(i);
                    pageNumbers.appendChild(pageBtn);
                }
            }

            changePage(direction) {
                if (direction === 'prev' && this.currentPage > 1) {
                    this.currentPage--;
                } else if (direction === 'next') {
                    const totalPages = Math.ceil(this.filteredRecords.length / this.recordsPerPage);
                    if (this.currentPage < totalPages) {
                        this.currentPage++;
                    }
                } else if (typeof direction === 'number') {
                    this.currentPage = direction;
                }
                
                this.renderTable();
                this.updatePagination();
            }

            clearFilters() {
                document.getElementById('quoteTypeFilter').value = '';
                document.getElementById('statusFilter').value = '';
                document.getElementById('dateFromFilter').value = '';
                document.getElementById('dateToFilter').value = '';
                document.getElementById('customerFilter').value = '';
                document.getElementById('minAmountFilter').value = '';
                
                this.applyFilters();
            }

            exportData() {
                const csvContent = this.generateCSV(this.filteredRecords);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `quote_records_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            generateCSV(records) {
                const headers = ['Quote ID', 'Type', 'Customer Name', 'Customer Email', 'Company Name', 'Total Amount', 'Status', 'Created Date', 'Notes'];
                
                const csvRows = [headers.join(',')];
                
                records.forEach(quote => {
                    const row = [
                        quote.QuoteID,
                        this.getQuoteTypeName(quote.QuoteID),
                        `"${quote.CustomerName || ''}"`,
                        quote.CustomerEmail || '',
                        `"${quote.CompanyName || ''}"`,
                        quote.TotalAmount || 0,
                        quote.Status,
                        new Date(quote.CreatedAt).toLocaleDateString(),
                        `"${(quote.Notes || '').replace(/"/g, '""')}"`
                    ];
                    csvRows.push(row.join(','));
                });
                
                return csvRows.join('\n');
            }

            refreshData() {
                this.loadInitialData();
            }

            showError(message) {
                // Could implement a toast notification here
                console.error('[UniversalRecordsAdmin] Error:', message);
            }
        }

        // Initialize the admin panel
        let adminPanel;
        document.addEventListener('DOMContentLoaded', () => {
            adminPanel = new UniversalRecordsAdmin();
        });

        // Global functions for UI interactions
        function applyFilters() {
            adminPanel.applyFilters();
        }

        function clearFilters() {
            adminPanel.clearFilters();
        }

        function exportData() {
            adminPanel.exportData();
        }

        function refreshData() {
            adminPanel.refreshData();
        }

        function changePage(direction) {
            adminPanel.changePage(direction);
        }

        async function updateQuoteStatus(quoteID, pkID, newStatus) {
            try {
                // Update the dropdown immediately for responsive UI
                // CSS.escape: QuoteID is an anonymously-writable column, so a value
                // containing a quote or bracket would otherwise throw here.
                const dropdown = document.querySelector(`select[data-quote-id="${CSS.escape(quoteID)}"]`);
                const originalStatus = dropdown.getAttribute('data-original-status') || dropdown.value;
                
                // Store original status for rollback if needed
                dropdown.setAttribute('data-original-status', originalStatus);
                
                // Update UI optimistically
                dropdown.className = `status-select ${newStatus.toLowerCase()}`;
                dropdown.disabled = true;
                
                // Make API call using PK_ID
                const response = await fetch(`${adminPanel.baseURL}/api/quote_sessions/${pkID}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        Status: newStatus
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to update status: ${response.status}`);
                }
                
                // Update local data
                const quote = adminPanel.allRecords.find(q => q.QuoteID === quoteID);
                if (quote) {
                    quote.Status = newStatus;
                }
                
                // Show success message
                showToast('Status updated successfully', 'success');
                
                dropdown.disabled = false;
                dropdown.removeAttribute('data-original-status');
                
            } catch (error) {
                console.error('[UniversalRecordsAdmin] Error updating status:', error);
                
                // Rollback on error
                // CSS.escape: QuoteID is an anonymously-writable column, so a value
                // containing a quote or bracket would otherwise throw here.
                const dropdown = document.querySelector(`select[data-quote-id="${CSS.escape(quoteID)}"]`);
                const originalStatus = dropdown.getAttribute('data-original-status');
                if (originalStatus) {
                    dropdown.value = originalStatus;
                    dropdown.className = `status-select ${originalStatus.toLowerCase()}`;
                }
                dropdown.disabled = false;
                
                showToast('Failed to update status. Please try again.', 'error');
            }
        }

        function showToast(message, type = 'info') {
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${escapeHtml(message)}</span>
            `;
            
            // Add to body
            document.body.appendChild(toast);
            
            // Add styles if not already present
            if (!document.getElementById('toast-styles')) {
                const style = document.createElement('style');
                style.id = 'toast-styles';
                style.textContent = `
                    .toast {
                        position: fixed;
                        bottom: 2rem;
                        right: 2rem;
                        background: var(--card-bg);
                        padding: 1rem 1.5rem;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        font-size: 0.875rem;
                        z-index: 1000;
                        animation: slideIn 0.3s ease-out;
                    }
                    
                    .toast-success {
                        border-left: 4px solid var(--success-color);
                        color: var(--success-text);
                    }
                    
                    .toast-error {
                        border-left: 4px solid var(--error-color);
                        color: var(--error-text);
                    }
                    
                    .toast-info {
                        border-left: 4px solid var(--info-color);
                        color: var(--info-text);
                    }
                    
                    @keyframes slideIn {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Remove after 3 seconds
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-in forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        async function viewQuote(quoteID) {
            try {
                // Find the quote in our data
                const quote = adminPanel.allRecords.find(q => q.QuoteID === quoteID);
                if (!quote) {
                    alert('Quote not found');
                    return;
                }

                // Get quote items
                const itemsResponse = await fetch(`${adminPanel.baseURL}/api/quote_items?quoteID=${quoteID}`);
                const items = await itemsResponse.json();

                // Create modal to display quote details
                const modal = document.createElement('div');
                modal.className = 'quote-view-modal';
                modal.innerHTML = `
                    <div class="modal-overlay" data-call="uraCloseModal" data-args='[".quote-view-modal"]'>
                        <div class="modal-content" data-stop="1">
                            <div class="modal-header">
                                <h2>Quote Details - ${quoteID}</h2>
                                <button class="close-btn" data-call="uraCloseModal" data-args='[".quote-view-modal"]'>×</button>
                            </div>
                            <div class="modal-body">
                                <div class="quote-info-grid">
                                    <div class="info-section">
                                        <h3>Customer Information</h3>
                                        <p><strong>Name:</strong> ${escapeHtml(quote.CustomerName || 'N/A')}</p>
                                        <p><strong>Email:</strong> ${escapeHtml(quote.CustomerEmail || 'N/A')}</p>
                                        <p><strong>Company:</strong> ${escapeHtml(quote.CompanyName || 'N/A')}</p>
                                        <p><strong>Phone:</strong> ${escapeHtml(quote.Phone || 'N/A')}</p>
                                    </div>
                                    <div class="info-section">
                                        <h3>Quote Information</h3>
                                        <p><strong>Status:</strong> <span class="status ${escapeHtml(String(quote.Status || '').toLowerCase())}">${escapeHtml(quote.Status)}</span></p>
                                        <p><strong>Created:</strong> ${new Date(quote.CreatedAt).toLocaleDateString()}</p>
                                        <p><strong>Expires:</strong> ${new Date(quote.ExpiresAt).toLocaleDateString()}</p>
                                        <p><strong>Total:</strong> $${quote.TotalAmount.toFixed(2)}</p>
                                    </div>
                                </div>
                                
                                ${quote.Notes ? `
                                    <div class="notes-section">
                                        <h3>Notes</h3>
                                        <p>${escapeHtml(quote.Notes).replace(/\n/g, '<br>')}</p>
                                    </div>
                                ` : ''}
                                
                                ${items.length > 0 ? `
                                    <div class="items-section">
                                        <h3>Quote Items</h3>
                                        <table class="items-table">
                                            <thead>
                                                <tr>
                                                    <th>Item</th>
                                                    <th>Product</th>
                                                    <th>Quantity</th>
                                                    <th>Unit Price</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${items.map(item => `
                                                    <tr>
                                                        <td>${escapeHtml(item.LineNumber)}</td>
                                                        <td>${escapeHtml(item.ProductName)}<br><small>${escapeHtml(item.StyleNumber)}</small></td>
                                                        <td>${escapeHtml(item.Quantity)}</td>
                                                        <td>$${item.FinalUnitPrice.toFixed(2)}</td>
                                                        <td>$${item.LineTotal.toFixed(2)}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" data-action="export" data-quote-id="${escapeHtml(quoteID)}">
                                    <i class="fas fa-download"></i> Export
                                </button>
                                <button class="btn btn-primary" data-action="duplicate" data-quote-id="${escapeHtml(quoteID)}">
                                    <i class="fas fa-copy"></i> Duplicate
                                </button>
                                <button class="btn" data-call="uraCloseModal" data-args='[".quote-view-modal"]'>Close</button>
                            </div>
                        </div>
                    </div>
                `;

                // Add styles
                if (!document.querySelector('#quote-modal-styles')) {
                    const style = document.createElement('style');
                    style.id = 'quote-modal-styles';
                    style.textContent = `
                        .quote-view-modal {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            z-index: 1000;
                        }
                        
                        .modal-overlay {
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        
                        .modal-content {
                            background: white;
                            border-radius: 8px;
                            width: 90%;
                            max-width: 800px;
                            max-height: 90vh;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                        }
                        
                        .modal-header {
                            padding: 1.5rem;
                            border-bottom: 1px solid #e5e7eb;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        
                        .modal-header h2 {
                            margin: 0;
                            color: #1f2937;
                        }
                        
                        .close-btn {
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            cursor: pointer;
                            color: #6b7280;
                        }
                        
                        .modal-body {
                            padding: 1.5rem;
                            overflow-y: auto;
                            flex: 1;
                        }
                        
                        .quote-info-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                            gap: 2rem;
                            margin-bottom: 2rem;
                        }
                        
                        .info-section h3 {
                            margin: 0 0 1rem 0;
                            color: #374151;
                            font-size: 1.125rem;
                        }
                        
                        .info-section p {
                            margin: 0.5rem 0;
                        }
                        
                        .notes-section {
                            background: #f9fafb;
                            padding: 1rem;
                            border-radius: 6px;
                            margin-bottom: 2rem;
                        }
                        
                        .items-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        
                        .items-table th,
                        .items-table td {
                            padding: 0.75rem;
                            text-align: left;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        
                        .items-table th {
                            background: #f9fafb;
                            font-weight: 600;
                            color: #374151;
                        }
                        
                        .modal-footer {
                            padding: 1.5rem;
                            border-top: 1px solid #e5e7eb;
                            display: flex;
                            gap: 1rem;
                            justify-content: flex-end;
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                // Footer actions are bound here rather than as inline onclick:
                // quoteID is attacker-influenceable, and an inline handler is a
                // JS-string context that HTML-escaping cannot protect.
                modal.addEventListener('click', (e) => {
                    const btn = e.target.closest('button[data-action]');
                    if (!btn) return;
                    const id = btn.dataset.quoteId;
                    if (btn.dataset.action === 'export') exportQuote(id);
                    if (btn.dataset.action === 'duplicate') duplicateQuote(id);
                });

                document.body.appendChild(modal);

            } catch (error) {
                console.error('Error viewing quote:', error);
                alert('Error loading quote details');
            }
        }

        async function duplicateQuote(quoteID) {
            if (!confirm(`Are you sure you want to duplicate quote ${quoteID}?`)) {
                return;
            }
            
            try {
                // Get the original quote
                const quote = adminPanel.allRecords.find(q => q.QuoteID === quoteID);
                if (!quote) {
                    alert('Quote not found');
                    return;
                }
                
                // Get quote items
                const itemsResponse = await fetch(`${adminPanel.baseURL}/api/quote_items?quoteID=${quoteID}`);
                const items = await itemsResponse.json();
                
                // Generate new quote ID
                const prefix = quoteID.split(/\d/)[0]; // Extract prefix
                const today = new Date();
                const month = (today.getMonth() + 1).toString().padStart(2, '0');
                const day = today.getDate().toString().padStart(2, '0');
                const dateKey = `${month}${day}`;
                
                // Get sequence from sessionStorage
                const storageKey = `${prefix.toLowerCase()}_quote_sequence_${dateKey}`;
                let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
                sessionStorage.setItem(storageKey, sequence.toString());
                
                const newQuoteId = `${prefix}${dateKey}-${sequence}`;
                
                // Create new quote session
                const newQuoteData = {
                    QuoteID: newQuoteId,
                    SessionID: `${prefix.toLowerCase()}_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    CustomerEmail: quote.CustomerEmail,
                    CustomerName: quote.CustomerName,
                    CompanyName: quote.CompanyName,
                    Phone: quote.Phone,
                    TotalQuantity: quote.TotalQuantity,
                    SubtotalAmount: quote.SubtotalAmount,
                    LTMFeeTotal: quote.LTMFeeTotal,
                    TotalAmount: quote.TotalAmount,
                    Status: 'Open',
                    ExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, ''),
                    Notes: quote.Notes ? `Duplicated from ${quoteID}\n\n${quote.Notes}` : `Duplicated from ${quoteID}`
                };
                
                // Save new quote session
                const sessionResponse = await fetch(`${adminPanel.baseURL}/api/quote_sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newQuoteData)
                });
                
                if (!sessionResponse.ok) {
                    throw new Error('Failed to create new quote');
                }
                
                // Duplicate items
                for (const item of items) {
                    const newItemData = {
                        QuoteID: newQuoteId,
                        LineNumber: item.LineNumber,
                        StyleNumber: item.StyleNumber,
                        ProductName: item.ProductName,
                        Color: item.Color,
                        ColorCode: item.ColorCode,
                        EmbellishmentType: item.EmbellishmentType,
                        PrintLocation: item.PrintLocation,
                        PrintLocationName: item.PrintLocationName,
                        Quantity: item.Quantity,
                        HasLTM: item.HasLTM,
                        BaseUnitPrice: item.BaseUnitPrice,
                        LTMPerUnit: item.LTMPerUnit,
                        FinalUnitPrice: item.FinalUnitPrice,
                        LineTotal: item.LineTotal,
                        SizeBreakdown: item.SizeBreakdown,
                        PricingTier: item.PricingTier,
                        ImageURL: item.ImageURL,
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                    };
                    
                    await fetch(`${adminPanel.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newItemData)
                    });
                }
                
                alert(`Quote duplicated successfully!\nNew Quote ID: ${newQuoteId}`);
                
                // Refresh the data
                adminPanel.loadInitialData();
                
            } catch (error) {
                console.error('Error duplicating quote:', error);
                alert('Error duplicating quote');
            }
        }

        function exportQuote(quoteID) {
            try {
                // Find the quote in our data
                const quote = adminPanel.allRecords.find(q => q.QuoteID === quoteID);
                if (!quote) {
                    alert('Quote not found');
                    return;
                }
                
                // Create CSV content
                const headers = Object.keys(quote);
                const values = headers.map(h => quote[h]);
                
                let csvContent = headers.join(',') + '\n';
                csvContent += values.map(v => {
                    // Handle values that might contain commas
                    if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
                        return `"${v.replace(/"/g, '""')}"`;
                    }
                    return v;
                }).join(',');
                
                // Create and download file
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `quote_${quoteID}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
            } catch (error) {
                console.error('Error exporting quote:', error);
                alert('Error exporting quote');
            }
        }

        async function editQuote(quoteID, pkID) {
            try {
                // Find the quote in our data
                const quote = adminPanel.allRecords.find(q => q.QuoteID === quoteID);
                if (!quote) {
                    alert('Quote not found');
                    return;
                }

                // Create edit modal
                const modal = document.createElement('div');
                modal.className = 'quote-edit-modal';
                modal.innerHTML = `
                    <div class="modal-overlay" data-call="uraCloseModal" data-args='[".quote-edit-modal"]'>
                        <div class="modal-content" data-stop="1">
                            <div class="modal-header">
                                <h2>Edit Quote - ${escapeHtml(quoteID)}</h2>
                                <button class="close-btn" data-call="uraCloseModal" data-args='[".quote-edit-modal"]'>×</button>
                            </div>
                            <form id="editQuoteForm" data-quote-id="${escapeHtml(quoteID)}" data-pk-id="${escapeHtml(pkID)}">
                                <div class="modal-body">
                                    <div class="form-grid">
                                        <div class="form-group">
                                            <label for="editCustomerName">Customer Name</label>
                                            <input type="text" id="editCustomerName" class="form-control" value="${escapeHtml(quote.CustomerName || '')}" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="editCustomerEmail">Customer Email</label>
                                            <input type="email" id="editCustomerEmail" class="form-control" value="${escapeHtml(quote.CustomerEmail || '')}" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="editCompanyName">Company Name</label>
                                            <input type="text" id="editCompanyName" class="form-control" value="${escapeHtml(quote.CompanyName || '')}">
                                        </div>
                                        <div class="form-group">
                                            <label for="editPhone">Phone</label>
                                            <input type="tel" id="editPhone" class="form-control" value="${escapeHtml(quote.Phone || '')}">
                                        </div>
                                        <div class="form-group">
                                            <label for="editTotalQuantity">Total Quantity</label>
                                            <input type="number" id="editTotalQuantity" class="form-control" value="${escapeHtml(quote.TotalQuantity || 0)}" min="0">
                                        </div>
                                        <div class="form-group">
                                            <label for="editSubtotalAmount">Subtotal Amount</label>
                                            <input type="number" id="editSubtotalAmount" class="form-control" value="${escapeHtml(quote.SubtotalAmount || 0)}" step="0.01" min="0">
                                        </div>
                                        <div class="form-group">
                                            <label for="editLTMFeeTotal">LTM Fee Total</label>
                                            <input type="number" id="editLTMFeeTotal" class="form-control" value="${escapeHtml(quote.LTMFeeTotal || 0)}" step="0.01" min="0">
                                        </div>
                                        <div class="form-group">
                                            <label for="editTotalAmount">Total Amount</label>
                                            <input type="number" id="editTotalAmount" class="form-control" value="${escapeHtml(quote.TotalAmount || 0)}" step="0.01" min="0">
                                        </div>
                                        <div class="form-group">
                                            <label for="editStatus">Status</label>
                                            <select id="editStatus" class="form-control">
                                                <option value="Open" ${quote.Status === 'Open' ? 'selected' : ''}>Open</option>
                                                <option value="Sent" ${quote.Status === 'Sent' ? 'selected' : ''}>Sent</option>
                                                <option value="Converted" ${quote.Status === 'Converted' ? 'selected' : ''}>Converted</option>
                                                <option value="Expired" ${quote.Status === 'Expired' ? 'selected' : ''}>Expired</option>
                                                <option value="Cancelled" ${quote.Status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                            </select>
                                        </div>
                                        <div class="form-group full-width">
                                            <label for="editNotes">Notes</label>
                                            <textarea id="editNotes" class="form-control" rows="3">${escapeHtml(quote.Notes || '')}</textarea>
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-call="uraCloseModal" data-args='[".quote-edit-modal"]'>Cancel</button>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-save"></i> Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;

                // Add styles if not already present
                if (!document.querySelector('#edit-modal-styles')) {
                    const style = document.createElement('style');
                    style.id = 'edit-modal-styles';
                    style.textContent = `
                        .quote-edit-modal {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            z-index: 1000;
                        }
                        
                        .quote-edit-modal .modal-overlay {
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        
                        .quote-edit-modal .modal-content {
                            background: white;
                            border-radius: 8px;
                            width: 90%;
                            max-width: 800px;
                            max-height: 90vh;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                        }
                        
                        .quote-edit-modal .modal-header {
                            padding: 1.5rem;
                            border-bottom: 1px solid #e5e7eb;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        
                        .quote-edit-modal .modal-header h2 {
                            margin: 0;
                            color: #1f2937;
                        }
                        
                        .quote-edit-modal .close-btn {
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            cursor: pointer;
                            color: #6b7280;
                        }
                        
                        .quote-edit-modal .modal-body {
                            padding: 1.5rem;
                            overflow-y: auto;
                            flex: 1;
                        }
                        
                        .quote-edit-modal .form-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                            gap: 1rem;
                        }
                        
                        .quote-edit-modal .form-group {
                            margin-bottom: 1rem;
                        }
                        
                        .quote-edit-modal .form-group.full-width {
                            grid-column: 1 / -1;
                        }
                        
                        .quote-edit-modal .form-group label {
                            display: block;
                            margin-bottom: 0.5rem;
                            font-weight: 500;
                            color: #374151;
                        }
                        
                        .quote-edit-modal .form-control {
                            width: 100%;
                            padding: 0.5rem 0.75rem;
                            border: 1px solid #e5e7eb;
                            border-radius: 6px;
                            font-size: 0.875rem;
                            background: white;
                        }
                        
                        .quote-edit-modal .form-control:focus {
                            outline: none;
                            border-color: #4cb354;
                            box-shadow: 0 0 0 0.25rem rgba(76, 179, 84, 0.25);
                        }
                        
                        .quote-edit-modal textarea.form-control {
                            resize: vertical;
                        }
                        
                        .quote-edit-modal .modal-footer {
                            padding: 1.5rem;
                            border-top: 1px solid #e5e7eb;
                            display: flex;
                            gap: 1rem;
                            justify-content: flex-end;
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                // Bound here rather than as an inline onsubmit: quoteID/pkID are
                // attacker-influenceable and an inline handler is a JS-string
                // context that HTML-escaping cannot protect. Values round-trip
                // through data-* attributes instead.
                const editForm = modal.querySelector('#editQuoteForm');
                editForm.addEventListener('submit', (e) => {
                    saveQuoteChanges(e, editForm.dataset.quoteId, editForm.dataset.pkId);
                });

                document.body.appendChild(modal);

            } catch (error) {
                console.error('Error opening edit modal:', error);
                alert('Error opening edit form');
            }
        }

        async function saveQuoteChanges(event, quoteID, pkID) {
            event.preventDefault();
            
            try {
                // Gather form data
                const updatedData = {
                    CustomerName: document.getElementById('editCustomerName').value,
                    CustomerEmail: document.getElementById('editCustomerEmail').value,
                    CompanyName: document.getElementById('editCompanyName').value,
                    Phone: document.getElementById('editPhone').value,
                    TotalQuantity: parseInt(document.getElementById('editTotalQuantity').value) || 0,
                    SubtotalAmount: parseFloat(document.getElementById('editSubtotalAmount').value) || 0,
                    LTMFeeTotal: parseFloat(document.getElementById('editLTMFeeTotal').value) || 0,
                    TotalAmount: parseFloat(document.getElementById('editTotalAmount').value) || 0,
                    Status: document.getElementById('editStatus').value,
                    Notes: document.getElementById('editNotes').value
                };

                // Make API call to update quote
                const response = await fetch(`${adminPanel.baseURL}/api/quote_sessions/${pkID}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedData)
                });

                if (!response.ok) {
                    throw new Error(`Failed to update quote: ${response.status}`);
                }

                // Update local data
                const quote = adminPanel.allRecords.find(q => q.QuoteID === quoteID);
                if (quote) {
                    Object.assign(quote, updatedData);
                }

                // Close modal
                document.querySelector('.quote-edit-modal').remove();

                // Show success message
                showToast('Quote updated successfully', 'success');

                // Re-render table
                adminPanel.applyFilters();

            } catch (error) {
                console.error('Error updating quote:', error);
                showToast('Failed to update quote. Please try again.', 'error');
            }
        }

        async function deleteQuote(quoteID, pkID) {
            if (!confirm(`Are you sure you want to delete quote ${quoteID}?\n\nThis action cannot be undone.`)) {
                return;
            }

            try {
                // First, delete all quote items
                const itemsResponse = await fetch(`${adminPanel.baseURL}/api/quote_items?quoteID=${quoteID}`);
                const items = await itemsResponse.json();

                // Delete each item
                for (const item of items) {
                    await fetch(`${adminPanel.baseURL}/api/quote_items/${item.PK_ID}`, {
                        method: 'DELETE'
                    });
                }

                // Then delete the quote session
                const response = await fetch(`${adminPanel.baseURL}/api/quote_sessions/${pkID}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Failed to delete quote: ${response.status}`);
                }

                // Remove from local data
                const index = adminPanel.allRecords.findIndex(q => q.QuoteID === quoteID);
                if (index > -1) {
                    adminPanel.allRecords.splice(index, 1);
                }

                // Show success message
                showToast(`Quote ${quoteID} deleted successfully`, 'success');

                // Re-render table
                adminPanel.applyFilters();

            } catch (error) {
                console.error('Error deleting quote:', error);
                showToast('Failed to delete quote. Please try again.', 'error');
            }
        }

        // Console debug helpers
// data-call target for the modal close controls (was inline onclick — Rule 3).
window.uraCloseModal = function (selector) { const el = document.querySelector(selector); if (el) el.remove(); };
