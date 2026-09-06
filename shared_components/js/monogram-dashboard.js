/**
 * Monogram Dashboard Controller
 * Manages the monogram orders dashboard - listing, filtering, and actions
 */

// API Configuration - Use centralized config (CLAUDE.md Rule #7)
function getApiBaseUrl() {
    if (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) {
        return window.APP_CONFIG.API.BASE_URL;
    }
    console.error('[monogram-dashboard] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
    return '';
}

// State
let allMonograms = [];
let filteredMonograms = [];
let uniqueSalesReps = [];

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    loadMonograms();
    // Filters (were inline onkeyup/onchange= — Rule 3). Search is debounced; the rest filter on change.
    var search = document.getElementById('searchInput');
    var timer = null;
    if (search) search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(filterMonograms, 150); });
    ['salesRepFilter', 'statusFilter', 'dateFrom', 'dateTo'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', filterMonograms);
    });
});

// A Caspio/ISO timestamp compared against the <input type=date> values must use the LOCAL calendar
// day — `toISOString()` is UTC, so an order created at 6 PM Pacific fell on the next day's date filter.
function localYmd(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Load all monograms from API
 */
async function loadMonograms() {
    const tbody = document.getElementById('monogramsTableBody');
    const resultCount = document.getElementById('resultCount');
    const apiUrl = getApiBaseUrl();

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="loading">
                <i class="fas fa-spinner" aria-hidden="true"></i> Loading monograms...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(`${apiUrl}/api/monograms`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        if (data.success && data.monograms) {
            allMonograms = data.monograms;
            // Sort by CreatedAt descending (newest first)
            allMonograms.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
            // Populate sales rep filter dropdown
            populateSalesRepFilter();
            filterMonograms();
        } else {
            throw new Error(data.error || 'Failed to load monograms');
        }
    } catch (error) {
        console.error('Error loading monograms:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state" role="alert">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <p>Unable to load monograms (${escapeHTML(error.message || 'request failed')}).</p>
                    <button type="button" class="btn btn-primary retry-btn" data-call="loadMonograms">
                        <i class="fas fa-sync-alt" aria-hidden="true"></i> Retry
                    </button>
                </td>
            </tr>
        `;
        resultCount.textContent = 'Error loading data — ' + (error.message || 'request failed');
    }
}

/**
 * Populate sales rep filter dropdown with unique reps
 */
function populateSalesRepFilter() {
    const select = document.getElementById('salesRepFilter');
    if (!select) return;

    // Extract unique sales reps from loaded data
    const repsSet = new Set();
    allMonograms.forEach(m => {
        if (m.SalesRepEmail) {
            repsSet.add(m.SalesRepEmail);
        }
    });

    // Sort alphabetically
    uniqueSalesReps = Array.from(repsSet).sort((a, b) => {
        const nameA = formatSalesRep(a).toLowerCase();
        const nameB = formatSalesRep(b).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // Build options HTML
    let optionsHTML = '<option value="">All Reps</option>';
    uniqueSalesReps.forEach(email => {
        const displayName = formatSalesRep(email);
        optionsHTML += `<option value="${escapeHTML(email)}">${escapeHTML(displayName)}</option>`;
    });

    select.innerHTML = optionsHTML;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Filter monograms based on search and filter inputs
 */
function filterMonograms() {
    const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
    const salesRepFilter = document.getElementById('salesRepFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    filteredMonograms = allMonograms.filter(m => {
        // Search filter (order number or company name)
        if (searchValue) {
            const orderMatch = m.OrderNumber && m.OrderNumber.toString().includes(searchValue);
            const companyMatch = m.CompanyName && m.CompanyName.toLowerCase().includes(searchValue);
            if (!orderMatch && !companyMatch) return false;
        }

        // Sales rep filter
        if (salesRepFilter) {
            if (m.SalesRepEmail !== salesRepFilter) return false;
        }

        // Status filter
        if (statusFilter) {
            if ((m.Status || 'Submitted') !== statusFilter) return false;
        }

        // Date from filter
        if (dateFrom || dateTo) {
            const monogramDate = localYmd(m.CreatedAt);
            if (dateFrom && monogramDate < dateFrom) return false;
            if (dateTo && monogramDate > dateTo) return false;
        }

        return true;
    });

    renderTable(filteredMonograms);
}

/**
 * Render table rows
 */
function renderTable(data) {
    const tbody = document.getElementById('monogramsTableBody');
    const resultCount = document.getElementById('resultCount');

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox" aria-hidden="true"></i>
                    <p>No monogram orders match these filters</p>
                </td>
            </tr>
        `;
        resultCount.textContent = 'No results';
        return;
    }

    tbody.innerHTML = data.map(m => {
        const createdDate = formatDate(m.CreatedAt);
        const salesRep = escapeHTML(formatSalesRep(m.SalesRepEmail));
        const companyName = escapeHTML(truncate(m.CompanyName, 30)) || '-';
        const orderNum = parseInt(m.OrderNumber, 10) || 0;
        const idMonogram = parseInt(m.ID_Monogram, 10) || 0;
        const totalItems = parseInt(m.TotalItems, 10) || 0;
        const status = m.Status || 'Submitted';
        const statusBadge = getStatusBadge(status);

        return `
            <tr data-id="${idMonogram}">
                <td>
                    <a href="/quote-builders/monogram-form.html?load=${encodeURIComponent(orderNum)}" class="order-link">
                        ${orderNum || '-'}
                    </a>
                </td>
                <td>${companyName}</td>
                <td>${salesRep}</td>
                <td class="td-center">${totalItems}</td>
                <td>${createdDate}</td>
                <td class="td-center">${statusBadge}</td>
                <td class="td-actions">
                    <button type="button" class="action-btn edit" data-call="editMonogram" data-args="[${Number(orderNum)}]" title="Edit" aria-label="Edit order ${orderNum}">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="action-btn print" data-call="printMonogram" data-args="[${Number(orderNum)}]" title="Print" aria-label="Print order ${orderNum}">
                        <i class="fas fa-print" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="action-btn proof" data-call="proofMonogram" data-args="[${Number(orderNum)}]" title="Customer Proof" aria-label="Customer proof for order ${orderNum}">
                        <i class="fas fa-file-signature" aria-hidden="true"></i>
                    </button>
                    ${status !== 'Printed' ? `
                    <button type="button" class="action-btn done" data-call="markPrinted" data-args="[${Number(idMonogram)}]" title="Mark as Printed" aria-label="Mark order ${orderNum} as printed">
                        <i class="fas fa-check" aria-hidden="true"></i>
                    </button>` : ''}
                    <button type="button" class="action-btn delete" data-call="deleteMonogram" data-args="[${Number(idMonogram)}, ${Number(orderNum)}]" title="Delete" aria-label="Delete order ${orderNum}">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    resultCount.textContent = `Showing ${data.length} of ${allMonograms.length} orders`;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

/**
 * Format sales rep email to show just name part
 */
function formatSalesRep(email) {
    if (!email) return '-';
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Truncate long strings
 */
function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const badges = {
        'Submitted': '<span class="badge badge-secondary"><i class="fas fa-clock" aria-hidden="true"></i> Submitted</span>',
        'Printed': '<span class="badge badge-success"><i class="fas fa-check" aria-hidden="true"></i> Printed</span>',
        'Complete': '<span class="badge badge-info"><i class="fas fa-check-double" aria-hidden="true"></i> Complete</span>',
        'Cancelled': '<span class="badge badge-warning"><i class="fas fa-ban" aria-hidden="true"></i> Cancelled</span>'
    };
    return badges[status] || badges['Submitted'];
}

// =====================
// Action Functions
// =====================

/**
 * Open monogram form for editing
 */
function editMonogram(orderNumber) {
    window.location.href = `/quote-builders/monogram-form.html?load=${encodeURIComponent(orderNumber)}`;
}

/**
 * Open print view for monogram
 */
function printMonogram(orderNumber) {
    window.open(`/quote-builders/monogram-form.html?load=${encodeURIComponent(orderNumber)}&print=true`, '_blank');
}

/**
 * Open customer proof print view (names rendered as they will be stitched,
 * per-name approval checkboxes + signature line)
 */
function proofMonogram(orderNumber) {
    window.open(`/quote-builders/monogram-form.html?load=${encodeURIComponent(orderNumber)}&proof=true`, '_blank');
}

/**
 * Mark monogram as printed
 */
async function markPrinted(idMonogram) {
    const apiUrl = getApiBaseUrl();

    try {
        const response = await fetch(`${apiUrl}/api/monograms/${idMonogram}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: 'Printed', PrintedAt: new Date().toISOString() })
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        if (data.success) {
            showToast('Marked as Printed', 'success');
            // Update local state and re-render without full reload
            const monogram = allMonograms.find(m => m.ID_Monogram === idMonogram);
            if (monogram) monogram.Status = 'Printed';
            filterMonograms();
        } else {
            throw new Error(data.error || 'Failed to update status');
        }
    } catch (error) {
        console.error('Error marking as printed:', error);
        showToast('Failed to mark as printed: ' + (error.message || 'request failed'), 'error');
    }
}

/**
 * Delete monogram with confirmation
 */
async function deleteMonogram(idMonogram, orderNumber) {
    if (!confirm(`Delete monogram for Order #${orderNumber}?\n\nThis cannot be undone.`)) return;

    const apiUrl = getApiBaseUrl();

    // Disable all delete buttons to prevent double-clicks
    const deleteButtons = document.querySelectorAll('.action-btn.delete');
    deleteButtons.forEach(btn => { btn.disabled = true; });

    try {
        const response = await fetch(`${apiUrl}/api/monograms/${idMonogram}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        if (data.success) {
            showToast('Monogram deleted', 'success');
            loadMonograms(); // Reload table
        } else {
            throw new Error(data.error || 'Failed to delete');
        }
    } catch (error) {
        console.error('Error deleting monogram:', error);
        showToast('Failed to delete monogram: ' + (error.message || 'request failed'), 'error');
    } finally {
        // Re-enable delete buttons
        deleteButtons.forEach(btn => { btn.disabled = false; });
    }
}

/**
 * Show toast notification
 * Uses CSS classes from monogram-dashboard.css
 */
function showToast(message, type = 'info') {
    // Create toast if not exists
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    // Set type class for color
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;

    // Show toast with CSS transition
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
