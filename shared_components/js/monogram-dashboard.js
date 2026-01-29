/**
 * Monogram Dashboard Controller
 * Manages the monogram orders dashboard - listing, filtering, and actions
 */

// API Configuration - Use centralized config (CLAUDE.md Rule #7)
function getApiBaseUrl() {
    if (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) {
        return window.APP_CONFIG.API.BASE_URL;
    }
    console.warn('[MonogramDashboard] APP_CONFIG not loaded, using fallback URL');
    return 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
});

/**
 * Load all monograms from API
 */
async function loadMonograms() {
    const tbody = document.getElementById('monogramsTableBody');
    const resultCount = document.getElementById('resultCount');
    const apiUrl = getApiBaseUrl();

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="loading">
                <i class="fas fa-spinner"></i> Loading monograms...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(`${apiUrl}/api/monograms`);
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
                <td colspan="6" class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Unable to load monograms. Please try again.</p>
                    <button class="btn btn-primary" onclick="loadMonograms()" style="margin-top: 1rem;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </td>
            </tr>
        `;
        resultCount.textContent = 'Error loading data';
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

        // Date from filter
        if (dateFrom) {
            const monogramDate = new Date(m.CreatedAt).toISOString().split('T')[0];
            if (monogramDate < dateFrom) return false;
        }

        // Date to filter
        if (dateTo) {
            const monogramDate = new Date(m.CreatedAt).toISOString().split('T')[0];
            if (monogramDate > dateTo) return false;
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
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No monogram orders found</p>
                </td>
            </tr>
        `;
        resultCount.textContent = 'No results';
        return;
    }

    tbody.innerHTML = data.map(m => {
        const createdDate = formatDate(m.CreatedAt);
        const salesRep = formatSalesRep(m.SalesRepEmail);

        return `
            <tr>
                <td>
                    <a href="/quote-builders/monogram-form.html?load=${m.OrderNumber}" class="order-link">
                        ${m.OrderNumber || '-'}
                    </a>
                </td>
                <td>${truncate(m.CompanyName, 30) || '-'}</td>
                <td>${salesRep}</td>
                <td style="text-align: center;">${m.TotalItems || 0}</td>
                <td>${createdDate}</td>
                <td>
                    <button class="action-btn edit" onclick="editMonogram(${m.OrderNumber})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn print" onclick="printMonogram(${m.OrderNumber})" title="Print">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteMonogram(${m.ID_Monogram}, ${m.OrderNumber})" title="Delete">
                        <i class="fas fa-trash"></i>
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

// =====================
// Action Functions
// =====================

/**
 * Open monogram form for editing
 */
function editMonogram(orderNumber) {
    window.location.href = `/quote-builders/monogram-form.html?load=${orderNumber}`;
}

/**
 * Open print view for monogram
 */
function printMonogram(orderNumber) {
    // Open the monogram form in print mode
    window.open(`/quote-builders/monogram-form.html?load=${orderNumber}&print=true`, '_blank');
}

/**
 * Delete monogram with confirmation
 */
async function deleteMonogram(idMonogram, orderNumber) {
    if (!confirm(`Delete monogram for Order #${orderNumber}?\n\nThis cannot be undone.`)) return;

    const apiUrl = getApiBaseUrl();

    try {
        const response = await fetch(`${apiUrl}/api/monograms/${idMonogram}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Monogram deleted', 'success');
            loadMonograms(); // Reload table
        } else {
            throw new Error(data.error || 'Failed to delete');
        }
    } catch (error) {
        console.error('Error deleting monogram:', error);
        showToast('Failed to delete monogram', 'error');
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
