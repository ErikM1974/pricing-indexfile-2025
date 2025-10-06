// Bundle Orders Dashboard JavaScript
// All functionality for managing Christmas & BCA bundle orders

let currentSampleRequests = [];
let currentRequestID = null;

// Retail pricing structure for Christmas bundles
const RETAIL_PRICES = {
    jackets: {
        'CT100617': 92,  // Rain Defender
        'CT103828': 137, // Detroit (Duck Detroit Jacket)
        'CT104670': 174  // Storm Defender (Shoreline Jacket)
    },
    hoodies: 58,  // CTK121 and F281 both use same base price
    beanies: 35,
    gloves: 19,
    giftBox: 9,
    shipping: 25
};

// Cache for size upcharges from API
const sizeUpchargeCache = {};

// Fetch size upcharges from API
async function fetchSizeUpcharges(styleNumber) {
    // Check cache first
    if (sizeUpchargeCache[styleNumber]) {
        console.log(`[Size Upcharges] Using cached data for ${styleNumber}`);
        return sizeUpchargeCache[styleNumber];
    }

    try {
        const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/size-pricing?styleNumber=${styleNumber}`);

        if (!response.ok) {
            console.warn(`[Size Upcharges] Failed to fetch for ${styleNumber}:`, response.status);
            return null;
        }

        const data = await response.json();

        if (data && data.length > 0) {
            // Extract upcharges from first color (all colors have same upcharges)
            const upcharges = data[0].sizeUpcharges || {};
            console.log(`[Size Upcharges] Fetched for ${styleNumber}:`, upcharges);

            // Cache the result
            sizeUpchargeCache[styleNumber] = upcharges;
            return upcharges;
        }

        return null;
    } catch (error) {
        console.error(`[Size Upcharges] Error fetching for ${styleNumber}:`, error);
        return null;
    }
}

// Calculate value including size upcharges
function calculateItemValue(styleNumber, size, basePrice) {
    const upcharges = sizeUpchargeCache[styleNumber] || {};
    const upcharge = upcharges[size] || 0;
    return basePrice + upcharge;
}

// Load bundle orders
async function loadSampleRequests() {
    try {
        // Get all sample request sessions
        const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions');

        if (!response.ok) {
            throw new Error('Failed to fetch sample requests');
        }

        const data = await response.json();

        // Map SalesRepName to SalesRep for consistency with UI
        for (let request of data) {
            // Map SalesRepName to SalesRep for backward compatibility with UI code
            if (request.SalesRepName !== undefined) {
                request.SalesRep = request.SalesRepName;
            }

            // For Christmas and BCA bundles, fetch items to get delivery method
            if (request.QuoteID && (request.QuoteID.startsWith('XMAS') || request.QuoteID.startsWith('BCA'))) {
                try {
                    const itemsResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_items?quoteID=${encodeURIComponent(request.QuoteID)}`);
                    if (itemsResponse.ok) {
                        const items = await itemsResponse.json();
                        if (items && items.length > 0 && items[0].DeliveryMethod) {
                            request.DeliveryMethod = items[0].DeliveryMethod;
                        }
                    }
                } catch (e) {
                    console.log('Could not fetch items for', request.QuoteID);
                }
            }
        }

        // Filter to sample requests (SR), Christmas bundles (XMAS), and Breast Cancer bundles (BCA)
        const allSampleRequests = data
            .filter(request => request.QuoteID && (request.QuoteID.startsWith('SR') || request.QuoteID.startsWith('XMAS') || request.QuoteID.startsWith('BCA')))
            .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

        // Get the current filter selection
        const statusFilter = document.getElementById('sampleStatusFilter')?.value || '';

        // Filter based on status selection
        if (statusFilter === 'ALL') {
            // Show all sample requests including archived
            currentSampleRequests = allSampleRequests;
        } else if (statusFilter === 'XMAS') {
            // Show only Christmas bundles
            currentSampleRequests = allSampleRequests.filter(request => request.QuoteID && request.QuoteID.startsWith('XMAS'));
        } else if (statusFilter === 'SR') {
            // Show only sample requests
            currentSampleRequests = allSampleRequests.filter(request => request.QuoteID && request.QuoteID.startsWith('SR'));
        } else if (statusFilter === 'BCA') {
            // Show only Breast Cancer bundles
            currentSampleRequests = allSampleRequests.filter(request => request.QuoteID && request.QuoteID.startsWith('BCA'));
        } else if (statusFilter === '') {
            // Default: Show active requests (exclude archived)
            currentSampleRequests = allSampleRequests.filter(request => request.Status !== 'Archived');
        } else {
            // Show specific status
            currentSampleRequests = allSampleRequests.filter(request => request.Status === statusFilter);
        }

        renderSampleRequests(currentSampleRequests);
    } catch (error) {
        console.error('Error loading sample requests:', error);
        document.getElementById('sampleRequestsBody').innerHTML = `
            <tr>
                <td colspan="10" style="padding: 2rem; text-align: center; color: #dc2626;">
                    <i class="fas fa-exclamation-triangle"></i> Error loading sample requests
                </td>
            </tr>
        `;
    }
}

// Render sample requests in table
function renderSampleRequests(requests) {
    const tbody = document.getElementById('sampleRequestsBody');

    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="padding: 2rem; text-align: center; color: #6b7280;">
                    No bundle orders found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = requests.map(request => {
        const date = new Date(request.CreatedAt).toLocaleDateString();
        const delivery = request.DeliveryMethod || 'Pending';
        const statusBadge = getStatusBadge(request.Status);
        const isChristmas = request.QuoteID && request.QuoteID.startsWith('XMAS');
        const isBCA = request.QuoteID && request.QuoteID.startsWith('BCA');

        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 0.875rem; font-weight: 500;">
                    ${isChristmas ? '<i class="fas fa-gift" style="color: #dc2626; margin-right: 0.25rem;" title="Christmas Bundle"></i>' : ''}
                    ${isBCA ? '<i class="fas fa-ribbon" style="color: #ec4899; margin-right: 0.25rem;" title="Breast Cancer Awareness Bundle"></i>' : ''}
                    ${request.QuoteID}
                    ${isChristmas ? '<span style="margin-left: 0.5rem; font-size: 0.75rem; color: #6b7280;" title="May contain uploaded logo"><i class="fas fa-camera"></i></span>' : ''}
                </td>
                <td style="padding: 0.875rem;">${date}</td>
                <td style="padding: 0.875rem;">${request.CustomerName || 'N/A'}</td>
                <td style="padding: 0.875rem;">${request.CustomerEmail || 'N/A'}</td>
                <td style="padding: 0.875rem; text-align: center;">
                    <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">
                        ${request.TotalQuantity || 0}
                    </span>
                </td>
                <td style="padding: 0.875rem; font-weight: 500;">$${(request.TotalAmount || 0).toFixed(2)}</td>
                <td style="padding: 0.875rem;">
                    <span class="badge ${delivery.toLowerCase() === 'ship' ? 'badge-warning' : 'badge-info'}">
                        <i class="fas ${delivery.toLowerCase() === 'ship' ? 'fa-truck' : 'fa-store'}"></i>
                        ${delivery.toLowerCase() === 'ship' ? 'Ship' : 'Pickup'}
                    </span>
                </td>
                <td style="padding: 0.875rem;">${statusBadge}</td>
                <td style="padding: 0.875rem;">
                    <select
                        id="salesRep_${request.QuoteID}"
                        onchange="updateSalesRep('${request.QuoteID}', this.value)"
                        style="padding: 0.25rem 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.875rem; background: ${request.SalesRep ? '#f0fdf4' : '#fafafa'};">
                        <option value="">Unassigned</option>
                        <option value="Nika" ${request.SalesRep === 'Nika' ? 'selected' : ''}>Nika</option>
                        <option value="Taneisha" ${request.SalesRep === 'Taneisha' ? 'selected' : ''}>Taneisha</option>
                        <option value="Ruth" ${request.SalesRep === 'Ruth' ? 'selected' : ''}>Ruth</option>
                        <option value="Erik" ${request.SalesRep === 'Erik' ? 'selected' : ''}>Erik</option>
                        <option value="Adriyella" ${request.SalesRep === 'Adriyella' ? 'selected' : ''}>Adriyella</option>
                    </select>
                </td>
                <td style="padding: 0.875rem;">
                    <button onclick="viewSampleDetails('${request.QuoteID}')" class="quick-btn" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        'Sample Request': '<span style="background: #fbbf24; color: #78350f; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem;">Pending</span>',
        'Processed': '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem;">Processed</span>',
        'Cancelled': '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem;">Cancelled</span>',
        'Archived': '<span style="background: #6b7280; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem;">Archived</span>'
    };
    return badges[status] || `<span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem;">${status}</span>`;
}

// View sample details
async function viewSampleDetails(quoteID) {
    currentRequestID = quoteID;

    try {
        // Fetch the request details
        const request = currentSampleRequests.find(r => r.QuoteID === quoteID);
        if (!request) throw new Error('Request not found');

        // Fetch the items
        const itemsResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_items?quoteID=${encodeURIComponent(quoteID)}`);
        const items = await itemsResponse.json();

        // For Christmas bundles, fetch size upcharges for pricing calculation
        if (quoteID && quoteID.startsWith('XMAS') && items && items[0] && items[0].BundleConfiguration) {
            try {
                const bundleConfig = JSON.parse(items[0].BundleConfiguration);
                const stylesToFetch = [];

                // Collect all styles that need upcharge data
                if (bundleConfig.jacket) {
                    const jacketStyle = bundleConfig.jacket.split(' - ')[0];
                    if (jacketStyle) stylesToFetch.push(jacketStyle);
                }
                if (bundleConfig.hoodie) {
                    const hoodieStyle = bundleConfig.hoodie.split(' - ')[0];
                    if (hoodieStyle) stylesToFetch.push(hoodieStyle);
                }

                // Fetch upcharges for all styles
                const upchargePromises = stylesToFetch.map(style => fetchSizeUpcharges(style));
                await Promise.all(upchargePromises);
                console.log('[Modal] Size upcharges fetched for Christmas bundle:', sizeUpchargeCache);
            } catch (e) {
                console.log('Error fetching upcharges for bundle:', e);
            }
        }

        // Build details HTML (simplified version - full implementation would include BCA and Christmas specific layouts)
        const detailsHTML = `
            <div style="display: grid; gap: 1.5rem;">
                <!-- Customer Information -->
                <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                    <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">Customer Information</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
                        <div><strong>Name:</strong> ${request.CustomerName || 'N/A'}</div>
                        <div><strong>Email:</strong> ${request.CustomerEmail || 'N/A'}</div>
                        <div><strong>Phone:</strong> ${request.Phone || 'N/A'}</div>
                        <div><strong>Company:</strong> ${request.CompanyName || 'N/A'}</div>
                    </div>
                </div>

                <!-- Order Details -->
                <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                    <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">Order Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
                        <div><strong>Request ID:</strong> ${request.QuoteID}</div>
                        <div><strong>Date:</strong> ${new Date(request.CreatedAt).toLocaleString()}</div>
                        <div><strong>Status:</strong> ${getStatusBadge(request.Status)}</div>
                        <div><strong>Total Amount:</strong> $${(request.TotalAmount || 0).toFixed(2)}</div>
                        <div><strong>Quantity:</strong> ${request.TotalQuantity || 0}</div>
                        <div><strong>Delivery:</strong> ${request.DeliveryMethod || 'Pending'}</div>
                    </div>
                </div>

                <!-- Items -->
                <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">Items (${items.length})</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${items.map((item, idx) => `
                            <div style="padding: 0.75rem; border-bottom: 1px solid #f3f4f6; ${idx === items.length - 1 ? 'border-bottom: none;' : ''}">
                                <div style="font-weight: 500;">${item.ProductDescription || `Item ${idx + 1}`}</div>
                                ${item.Color ? `<div style="color: #6b7280; font-size: 0.875rem;">Color: ${item.Color}</div>` : ''}
                                ${item.Size ? `<div style="color: #6b7280; font-size: 0.875rem;">Size: ${item.Size}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${request.Notes ? `
                <!-- Notes -->
                <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; border: 1px solid #fde68a;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #92400e; font-size: 1rem;">Notes</h4>
                    <div style="color: #78350f;">${request.Notes}</div>
                </div>
                ` : ''}
            </div>
        `;

        // Show modal
        document.getElementById('sampleDetailsContent').innerHTML = detailsHTML;
        document.getElementById('sampleDetailsModal').classList.add('active');

    } catch (error) {
        console.error('Error loading details:', error);
        alert('Failed to load order details. Please try again.');
    }
}

// Close details modal
function closeSampleDetails() {
    document.getElementById('sampleDetailsModal').classList.remove('active');
    currentRequestID = null;
}

// Update sales rep
async function updateSalesRep(quoteID, salesRep) {
    const selectElement = document.getElementById(`salesRep_${quoteID}`);
    const originalValue = selectElement.value;
    const originalBg = selectElement.style.background;

    // Show loading state
    selectElement.style.background = '#fef3c7';
    selectElement.disabled = true;

    try {
        // Find the request to get the PK_ID
        const request = currentSampleRequests.find(r => r.QuoteID === quoteID);
        if (!request || !request.PK_ID) {
            throw new Error('Request not found');
        }

        // Update via API
        const sessionResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions/${request.PK_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                SalesRepName: salesRep || null
            })
        });

        if (!sessionResponse.ok) {
            throw new Error('Failed to update sales rep');
        }

        // Update local data
        request.SalesRep = salesRep;
        request.SalesRepName = salesRep;

        // Show success state
        selectElement.style.background = salesRep ? '#f0fdf4' : '#fafafa';
        selectElement.disabled = false;

    } catch (error) {
        console.error('Error updating sales rep:', error);
        // Restore original value on error
        selectElement.value = originalValue;
        selectElement.style.background = originalBg;
        selectElement.disabled = false;
        alert('Failed to update sales rep. Please try again.');
    }
}

// Mark as processed
async function markAsProcessed() {
    if (!currentRequestID) return;

    if (!confirm(`Mark order ${currentRequestID} as processed?\n\nThis indicates that the order has been entered into Shopworks and a payment link has been sent.`)) {
        return;
    }

    try {
        const request = currentSampleRequests.find(r => r.QuoteID === currentRequestID);
        if (!request || !request.PK_ID) {
            throw new Error('Request ID not found');
        }

        const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions/${request.PK_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Status: 'Processed'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        alert(`Order ${currentRequestID} has been marked as processed.`);
        closeSampleDetails();
        await loadSampleRequests();

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status. Please try again.');
    }
}

// Archive request
async function archiveRequest() {
    if (!currentRequestID) return;

    if (!confirm(`Archive order ${currentRequestID}?\n\nArchived orders will be hidden from the main view but can still be accessed via the filter options.`)) {
        return;
    }

    try {
        const request = currentSampleRequests.find(r => r.QuoteID === currentRequestID);
        if (!request || !request.PK_ID) {
            throw new Error('Request ID not found');
        }

        const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_sessions/${request.PK_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Status: 'Archived'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to archive request');
        }

        alert(`Order ${currentRequestID} has been archived.`);
        closeSampleDetails();
        await loadSampleRequests();

    } catch (error) {
        console.error('Error archiving request:', error);
        alert('Failed to archive request. Please try again.');
    }
}

// Download order PDF
async function downloadOrderPDF() {
    if (!currentRequestID) {
        alert('No order selected');
        return;
    }

    alert('PDF download functionality coming soon!');
}

// Refresh bundle orders
async function refreshSampleRequests() {
    await loadSampleRequests();
}

// Filter bundle orders
async function filterSampleRequests() {
    const searchText = document.getElementById('sampleSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('sampleStatusFilter').value;
    const salesRepFilter = document.getElementById('salesRepFilter').value;
    const dateFrom = document.getElementById('sampleDateFrom').value;
    const dateTo = document.getElementById('sampleDateTo').value;

    // Reload data when status filter changes
    await loadSampleRequests();

    let filtered = currentSampleRequests;

    // Text search
    if (searchText) {
        filtered = filtered.filter(r =>
            r.QuoteID.toLowerCase().includes(searchText) ||
            (r.CustomerName && r.CustomerName.toLowerCase().includes(searchText)) ||
            (r.CustomerEmail && r.CustomerEmail.toLowerCase().includes(searchText)) ||
            (r.SalesRep && r.SalesRep.toLowerCase().includes(searchText))
        );
    }

    // Sales rep filter
    if (salesRepFilter) {
        if (salesRepFilter === 'unassigned') {
            filtered = filtered.filter(r => !r.SalesRep || r.SalesRep === '');
        } else {
            filtered = filtered.filter(r => r.SalesRep === salesRepFilter);
        }
    }

    // Date range filter
    if (dateFrom) {
        filtered = filtered.filter(r => new Date(r.CreatedAt) >= new Date(dateFrom));
    }
    if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59);
        filtered = filtered.filter(r => new Date(r.CreatedAt) <= endDate);
    }

    renderSampleRequests(filtered);
}

// Load bundle orders on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSampleRequests();

    // Add search input listener
    const searchInput = document.getElementById('sampleSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterSampleRequests);
    }
});
