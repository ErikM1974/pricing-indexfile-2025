/**
 * Quote Audit Page
 * Staff-only pricing audit — compares ShopWorks vs 2026 calculated prices.
 * URL: /pages/quote-audit.html?id=EMB-2026-119
 */

class QuoteAuditPage {
    constructor() {
        this.quoteId = new URLSearchParams(window.location.search).get('id');
        this.init();
    }

    async init() {
        // Staff gate
        if (typeof StaffAuthHelper === 'undefined' || !StaffAuthHelper.isLoggedIn()) {
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('auth-gate').style.display = 'flex';
            return;
        }

        if (!this.quoteId) {
            this.showError('Missing Quote ID', 'No quote ID was provided in the URL.');
            return;
        }

        document.title = `Pricing Audit — ${this.quoteId}`;

        try {
            const resp = await fetch(`/api/public/quote/${encodeURIComponent(this.quoteId)}`);
            if (!resp.ok) {
                throw new Error(`API returned ${resp.status}`);
            }
            const data = await resp.json();
            this.session = data.session || data;
            this.items = data.items || [];
            this.render();
        } catch (err) {
            this.showError('Failed to Load Quote', `Could not load data for quote ${this.escapeHtml(this.quoteId)}. ${this.escapeHtml(err.message)}`);
        }
    }

    render() {
        // Parse audit JSON
        let audit = null;
        if (this.session.PriceAuditJSON) {
            try {
                audit = JSON.parse(this.session.PriceAuditJSON);
            } catch (e) {
                // malformed JSON
            }
        }

        if (!audit) {
            this.showError(
                'No Audit Data',
                `Quote ${this.escapeHtml(this.quoteId)} does not have pricing audit data. Audit data is generated when a ShopWorks order is imported and saved.`
            );
            return;
        }

        // Hide loading, show content
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('audit-content').style.display = 'block';

        // Header
        document.getElementById('audit-quote-id').textContent = this.quoteId;

        // Overall flag badge
        const flag = (audit.flag || 'OK').toUpperCase();
        const badge = document.getElementById('overall-flag-badge');
        badge.textContent = flag;
        badge.className = 'flag-badge flag-' + flag.toLowerCase();

        // Context row
        this.setContextField('ctx-customer', this.session.CustomerName);
        this.setContextField('ctx-company', this.session.CompanyName);
        this.setContextField('ctx-sales-rep', this.session.SalesRepName || this.session.SalesRep);
        this.setContextField('ctx-order', this.session.OrderNumber);
        if (this.session.CreatedAt) {
            this.setContextField('ctx-created', this.formatDate(this.session.CreatedAt));
        }

        // Staff-only context fields
        const paidToDate = parseFloat(this.session.PaidToDate) || 0;
        if (paidToDate > 0) {
            this.setContextField('ctx-paid', '$' + paidToDate.toFixed(2));
        }
        const balance = parseFloat(this.session.BalanceAmount) || 0;
        if (balance > 0) {
            this.setContextField('ctx-balance', '$' + balance.toFixed(2));
        }
        if (this.session.DigitizingCodes) {
            this.setContextField('ctx-digitizing', this.session.DigitizingCodes);
        }
        const carrier = this.session.Carrier || '';
        const trackNum = this.session.TrackingNumber || '';
        if (carrier || trackNum) {
            this.setContextField('ctx-tracking', (trackNum || 'N/A') + (carrier ? ' (' + carrier + ')' : ''));
        }

        // Summary card
        const swSub = parseFloat(audit.swSubtotal || this.session.SWSubtotal || 0);
        const ourSub = parseFloat(audit.ourSubtotal || this.session.SubtotalAmount || 0);
        const delta = ourSub - swSub;
        const deltaPct = swSub > 0 ? ((delta / swSub) * 100) : 0;
        const deltaSign = delta >= 0 ? '+' : '-';
        const deltaClass = delta >= 0 ? 'delta-positive' : 'delta-negative';

        const summaryGrid = document.getElementById('summary-grid');
        summaryGrid.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Total Charged (ShopWorks)</span>
                <span class="summary-value">$${swSub.toFixed(2)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Correct 2026 Total</span>
                <span class="summary-value">$${ourSub.toFixed(2)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Difference</span>
                <span class="summary-value ${deltaClass}">
                    ${deltaSign}$${Math.abs(delta).toFixed(2)} (${deltaSign}${Math.abs(deltaPct).toFixed(1)}%)
                </span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Overall Flag</span>
                <span class="flag-inline flag-${flag.toLowerCase()}">${flag}</span>
            </div>`;

        // Products table
        const products = audit.products || [];
        const tbody = document.getElementById('audit-products-tbody');
        const tfoot = document.getElementById('audit-products-tfoot');
        tbody.innerHTML = '';
        tfoot.innerHTML = '';

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No per-product audit data available</td></tr>';
        } else {
            let totalSwLine = 0;
            let totalOurLine = 0;

            for (const p of products) {
                const qty = parseInt(p.qty || 0);
                const swUnit = parseFloat(p.swUnit || 0);
                const ourUnit = parseFloat(p.ourUnit || 0);
                const swLine = swUnit * qty;
                const ourLine = ourUnit * qty;
                const lineDiff = ourLine - swLine;
                const pFlag = (p.flag || 'OK').toUpperCase();
                const diffSign = lineDiff >= 0 ? '+' : '-';
                const diffClass = lineDiff >= 0 ? 'delta-positive' : 'delta-negative';

                totalSwLine += swLine;
                totalOurLine += ourLine;

                const rowClass = pFlag === 'REVIEW' ? 'row-review' : pFlag === 'MISMATCH' ? 'row-mismatch' : '';
                const isService = p.isService === true;

                const tr = document.createElement('tr');
                const classes = [rowClass, isService ? 'service-row' : ''].filter(Boolean).join(' ');
                if (classes) tr.className = classes;
                tr.innerHTML = `
                    <td>${isService ? '<em>' : ''}${this.escapeHtml(p.style || '')}${isService ? '</em>' : ''}</td>
                    <td>${isService ? '<span class="service-label">Service</span>' : this.escapeHtml(p.color || '')}</td>
                    <td class="num-col">${qty || ''}</td>
                    <td class="num-col">$${swUnit.toFixed(2)}</td>
                    <td class="num-col">$${ourUnit.toFixed(2)}</td>
                    <td class="num-col">$${swLine.toFixed(2)}</td>
                    <td class="num-col">$${ourLine.toFixed(2)}</td>
                    <td class="num-col diff-col ${diffClass}">${diffSign}$${Math.abs(lineDiff).toFixed(2)}</td>
                    <td><span class="flag-inline flag-${pFlag.toLowerCase()}">${pFlag}</span></td>`;
                tbody.appendChild(tr);
            }

            // Totals row
            const totalDiff = totalOurLine - totalSwLine;
            const totalDiffSign = totalDiff >= 0 ? '+' : '-';
            const totalDiffClass = totalDiff >= 0 ? 'delta-positive' : 'delta-negative';

            tfoot.innerHTML = `
                <tr class="totals-row">
                    <td colspan="5"><strong>Totals</strong></td>
                    <td class="num-col"><strong>$${totalSwLine.toFixed(2)}</strong></td>
                    <td class="num-col"><strong>$${totalOurLine.toFixed(2)}</strong></td>
                    <td class="num-col diff-col ${totalDiffClass}"><strong>${totalDiffSign}$${Math.abs(totalDiff).toFixed(2)}</strong></td>
                    <td></td>
                </tr>`;
        }

        // Import Notes (parser warnings stored as JSON array)
        if (this.session.ImportNotes) {
            try {
                const importNotes = JSON.parse(this.session.ImportNotes);
                if (Array.isArray(importNotes) && importNotes.length > 0) {
                    const listEl = document.getElementById('import-notes-list');
                    listEl.innerHTML = importNotes.map(note =>
                        `<li>${this.escapeHtml(typeof note === 'string' ? note : JSON.stringify(note))}</li>`
                    ).join('');
                    document.getElementById('import-notes-section').style.display = 'block';
                }
            } catch (e) {
                // Not valid JSON — show as single item
                const listEl = document.getElementById('import-notes-list');
                listEl.innerHTML = `<li>${this.escapeHtml(this.session.ImportNotes)}</li>`;
                document.getElementById('import-notes-section').style.display = 'block';
            }
        }

        // View Customer Quote link
        const quoteLink = document.getElementById('view-customer-quote');
        quoteLink.href = `/quote/${encodeURIComponent(this.quoteId)}`;
    }

    setContextField(id, value) {
        if (!value) return;
        const el = document.getElementById(id);
        el.style.display = 'flex';
        document.getElementById(id + '-value').textContent = value;
    }

    showError(title, message) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-message').innerHTML = message;
        document.getElementById('error-state').style.display = 'flex';
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuoteAuditPage();
});
