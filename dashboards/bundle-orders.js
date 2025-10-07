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

// Helper function to format phone numbers
function formatPhone(phone) {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

// Helper functions to extract shipping info from notes as fallback
function extractCityFromNotes(notes) {
    if (!notes) return '';
    const match = notes.match(/Ship to: ([^,]+),/i);
    if (match) {
        // Extract just the city part (might have street address before it)
        const parts = match[1].trim().split(' ');
        // If it starts with numbers, it's likely street address, skip it
        if (/^\d/.test(parts[0])) {
            return parts.slice(-1)[0]; // Return last part as city
        }
        return match[1].trim();
    }
    return '';
}

function extractStateFromNotes(notes) {
    if (!notes) return '';
    const match = notes.match(/Ship to: [^,]+, ([A-Z]{2})/i);
    return match ? match[1].trim() : '';
}

function extractZipFromNotes(notes) {
    if (!notes) return '';
    const match = notes.match(/Ship to: [^,]+, [A-Z]{2} (\d{5})/i);
    return match ? match[1].trim() : '';
}

// Clean shipping info from notes for display
function cleanNotesDisplay(notes) {
    if (!notes) return '';
    // Remove the shipping line from notes
    return notes.replace(/\| Ship to: [^|]*/gi, '').replace(/Ship to: [^|]*/gi, '').trim();
}

// Download logo function
function downloadLogo(externalKey, quoteID) {
    const url = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/${externalKey}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `logo-${quoteID}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// View logo full size in new tab
function viewLogoFullSize(externalKey) {
    const url = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/${externalKey}`;
    window.open(url, '_blank');
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

// View sample details - COMPLETE IMPLEMENTATION
async function viewSampleDetails(quoteID) {
    currentRequestID = quoteID;

    try {
        // Fetch the request details
        const request = currentSampleRequests.find(r => r.QuoteID === quoteID);
        if (!request) throw new Error('Request not found');

        // Fetch the items using QuoteID (now unique with timestamp+random generation)
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
        
        // Parse the order details from the session's ProjectName field
        let orderDetails = {};
        if (request.ProjectName) {
            try {
                const sessionOrderData = JSON.parse(request.ProjectName);
                if (sessionOrderData.orderDetails) {
                    orderDetails = sessionOrderData.orderDetails;
                }
                // Also get project info if available
                if (sessionOrderData.projectInfo) {
                    orderDetails.projectType = sessionOrderData.projectInfo.projectType;
                    orderDetails.estimatedQuantity = sessionOrderData.projectInfo.estimatedQuantity;
                    orderDetails.timeline = sessionOrderData.projectInfo.timeline;
                }
                // Get delivery method
                if (sessionOrderData.deliveryMethod) {
                    orderDetails.delivery = sessionOrderData.deliveryMethod;
                }
            } catch (e) {
                console.error('Error parsing session order details:', e);
            }
        }
        
        // Extract shipping info from notes as fallback if session data not available
        const isShipping = (orderDetails.delivery === 'ship') || 
                         (request.Notes && request.Notes.toLowerCase().includes('ship'));
        
        // Parse shipping address from notes as fallback (format: "Ship to city, state")  
        let shippingAddress = null;
        if (!orderDetails.shipping && isShipping && request.Notes) {
            const shipMatch = request.Notes.match(/ship to ([^-]+)/i);
            if (shipMatch) {
                const addressText = shipMatch[1].trim();
                // Split "puyallupe, wa" into city and state
                const parts = addressText.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    shippingAddress = {
                        city: parts[0],
                        state: parts[1],
                        full: addressText
                    };
                } else {
                    shippingAddress = { full: addressText };
                }
            }
        }
        
        // Calculate missing totals from available data
        const subtotalAmount = request.SubtotalAmount || 0;
        const totalAmount = request.TotalAmount || 0;
        const itemsTotal = items.reduce((sum, item) => sum + (item.FinalUnitPrice || 0), 0);
        
        // Calculate shipping and tax if missing from orderDetails
        let shippingAmount = 0;
        let taxAmount = 0;
        
        if (isShipping && totalAmount > subtotalAmount) {
            // If shipping, assume $10 shipping and calculate tax
            shippingAmount = 10.00;
            const taxableAmount = subtotalAmount + shippingAmount;
            taxAmount = totalAmount - taxableAmount;
        } else if (totalAmount > subtotalAmount) {
            // Just tax, no shipping
            taxAmount = totalAmount - subtotalAmount;
        }
        
        // Populate orderDetails if missing
        if (!orderDetails.totals && (shippingAmount > 0 || taxAmount > 0)) {
            orderDetails.delivery = isShipping ? 'ship' : 'pickup';
            orderDetails.totals = {
                samples: itemsTotal,
                shipping: shippingAmount,
                tax: taxAmount
            };
        }
        
        // Build the details HTML - Special layout for BCA orders
        const detailsHTML = request.QuoteID && request.QuoteID.startsWith('BCA') ? (() => {
            // Parse event date and instructions from Notes
            let eventDate = 'Not specified';
            let specialInstructions = 'None';

            if (request.Notes) {
                const eventMatch = request.Notes.match(/Event:\s*([^,]+)/);
                const instructionsMatch = request.Notes.match(/Instructions:\s*(.+)$/);

                if (eventMatch) {
                    eventDate = new Date(eventMatch[1]).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
                if (instructionsMatch) {
                    specialInstructions = instructionsMatch[1];
                }
            }

            // Format phone number
            const formatPhone = (phone) => {
                if (!phone) return 'N/A';
                const cleaned = phone.replace(/\D/g, '');
                if (cleaned.length === 10) {
                    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
                }
                return phone;
            };

            // Parse size breakdown
            let sizeDisplay = 'N/A';
            if (items.length > 0 && items[0].SizeBreakdown) {
                try {
                    const sizeBreakdown = JSON.parse(items[0].SizeBreakdown);
                    sizeDisplay = Object.entries(sizeBreakdown)
                        .map(([size, qty]) => `${size}(${qty})`)
                        .join(' ');
                } catch (e) {}
            }

            // Get design choice from items
            let designChoice = 'No Flag';  // Default
            let designImageURL = 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131676';
            if (items.length > 0 && items[0].DesignChoice) {
                designChoice = items[0].DesignChoice;
                designImageURL = items[0].DesignImageURL || (designChoice === 'Flag'
                    ? 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131677'
                    : 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131676');
            }

            return `
                <div style="display: grid; gap: 1.25rem;">
                    <!-- BCA Header with Pink Ribbon -->
                    <div style="background: linear-gradient(135deg, #ec4899, #f472b6); color: white; padding: 1.25rem; border-radius: 8px; text-align: center;">
                        <h3 style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <i class="fas fa-ribbon"></i>
                            Breast Cancer Awareness Bundle Order
                        </h3>
                        <div style="margin-top: 0.5rem; font-size: 1.1rem; opacity: 0.95;">
                            Order #${request.QuoteID}
                        </div>
                    </div>

                    <!-- T-Shirt Design Selection -->
                    <div style="background: #fdf2f8; padding: 1rem; border-radius: 8px; border: 2px solid #fbbcdc;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #be185d; font-size: 1rem;">Selected T-Shirt Design</h4>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <img src="${designImageURL}" alt="${designChoice === 'Flag' ? 'Patriotic Flag' : 'Classic Ribbon'} Design"
                                 style="width: 100px; height: 100px; object-fit: contain; background: white; padding: 0.5rem; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <div>
                                <div style="font-weight: bold; color: #374151; font-size: 1.125rem;">
                                    ${designChoice === 'Flag' ? 'Patriotic Flag' : 'Classic Ribbon'}
                                </div>
                                <div style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">
                                    ${designChoice === 'Flag' ? 'American flag with pink ribbon and company logo' : 'Pink ribbon with company logo'}
                                </div>
                                <div style="margin-top: 0.5rem;">
                                    <span style="background: #ec4899; color: white; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                                        ${designChoice === 'Flag' ? 'FLAG DESIGN' : 'NO FLAG DESIGN'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Customer Information -->
                    <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #fbbcdc;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #ec4899; font-size: 1rem; font-weight: 600;">
                            <i class="fas fa-user" style="margin-right: 0.5rem;"></i>Customer Information
                        </h4>
                        <div style="display: grid; gap: 0.5rem; font-size: 0.95rem;">
                            <div><strong>Name:</strong> ${request.CustomerName || 'N/A'}</div>
                            <div><strong>Company:</strong> ${request.CompanyName || 'N/A'}</div>
                            <div><strong>Email:</strong> <a href="mailto:${request.CustomerEmail}" style="color: #ec4899;">${request.CustomerEmail || 'N/A'}</a></div>
                            <div><strong>Phone:</strong> <a href="tel:${request.Phone}" style="color: #ec4899;">${formatPhone(request.Phone)}</a></div>
                        </div>
                    </div>

                    <!-- Bundle Order Details -->
                    <div style="background: #fce7f3; padding: 1rem; border-radius: 8px; border: 1px solid #fbbcdc;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #ec4899; font-size: 1rem; font-weight: 600;">
                            <i class="fas fa-shopping-bag" style="margin-right: 0.5rem;"></i>Bundle Order Details
                        </h4>
                        <div style="display: grid; gap: 0.5rem; font-size: 0.95rem;">
                            <div><strong>Quantity:</strong> ${items.length} bundles @ $45.00 each</div>
                            <div><strong>Total Amount:</strong> <span style="color: #059669; font-size: 1.1rem; font-weight: 600;">$${(request.TotalAmount || 0).toFixed(2)}</span></div>
                            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #fbbcdc;">
                                <strong>Size Distribution:</strong>
                                <div style="margin-top: 0.25rem; padding: 0.5rem; background: white; border-radius: 4px;">
                                    <div><strong>T-Shirts:</strong> ${sizeDisplay}</div>
                                    <div><strong>Caps:</strong> One Size (${items.length} total)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Event Information -->
                    <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #fbbcdc;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #ec4899; font-size: 1rem; font-weight: 600;">
                            <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>Event Information
                        </h4>
                        <div style="display: grid; gap: 0.5rem; font-size: 0.95rem;">
                            <div><strong>Event Date:</strong> <span style="color: #dc2626; font-weight: 600;">${eventDate}</span></div>
                            ${specialInstructions !== 'None' ? `
                                <div>
                                    <strong>Special Instructions:</strong>
                                    <div style="margin-top: 0.25rem; padding: 0.5rem; background: #fef3c7; border-radius: 4px; border: 1px solid #fde68a;">
                                        ${specialInstructions}
                                    </div>
                                </div>
                            ` : '<div><strong>Special Instructions:</strong> None</div>'}
                        </div>
                    </div>

                    <!-- Custom Logo -->
                    ${items[0]?.Image_Upload ? `
                        <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid #fbbcdc;">
                            <h4 style="margin: 0 0 0.75rem 0; color: #ec4899; font-size: 1rem; font-weight: 600;">
                                <i class="fas fa-image" style="margin-right: 0.5rem;"></i>Custom Logo
                            </h4>
                            <div style="display: flex; align-items: center; gap: 1.5rem;">
                                <div style="border: 2px solid #fbbcdc; border-radius: 8px; padding: 0.5rem; background: white;">
                                    <img src="https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/${items[0].Image_Upload}"
                                         alt="Customer Logo"
                                         style="max-width: 200px; max-height: 200px; display: block;"
                                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239ca3af%22 font-family=%22sans-serif%22%3EImage Not Found%3C/text%3E%3C/svg%3E';">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <button onclick="downloadLogo('${items[0].Image_Upload}', '${request.QuoteID}')"
                                            class="quick-btn"
                                            style="background: #10b981 !important; color: white !important; display: flex; align-items: center; gap: 0.5rem;">
                                        <i class="fas fa-download"></i> Download Original
                                    </button>
                                    <button onclick="viewLogoFullSize('${items[0].Image_Upload}')"
                                            class="quick-btn"
                                            style="background: #3b82f6 !important; color: white !important; display: flex; align-items: center; gap: 0.5rem;">
                                        <i class="fas fa-expand"></i> View Full Size
                                    </button>
                                    <div style="font-size: 0.75rem; color: #6b7280;">
                                        ExternalKey: ${items[0].Image_Upload.substring(0, 8)}...
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Delivery Information -->
                    ${(items[0]?.DeliveryMethod || request.DeliveryMethod || '').toLowerCase() === 'ship' ? `
                        <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; border: 1px solid #fde68a;">
                            <h4 style="margin: 0 0 0.75rem 0; color: #f59e0b; font-size: 1rem; font-weight: 600;">
                                <i class="fas fa-truck" style="margin-right: 0.5rem;"></i>Delivery Information
                            </h4>
                            <div style="display: grid; gap: 0.5rem; font-size: 0.95rem;">
                                <div><strong>Method:</strong> Ship to Address</div>
                                <div><strong>Address:</strong> ${items[0]?.Shipping_Address || 'Not provided'}</div>
                                <div><strong>City:</strong> ${items[0]?.Shipping_City || 'Not provided'}</div>
                                <div><strong>State:</strong> ${items[0]?.Shipping_State || 'Not provided'}</div>
                                <div><strong>ZIP:</strong> ${items[0]?.Shipping_Zip || 'Not provided'}</div>
                            </div>
                        </div>
                    ` : `
                        <div style="background: #dcfce7; padding: 1rem; border-radius: 8px; border: 1px solid #bbf7d0;">
                            <h4 style="margin: 0 0 0.75rem 0; color: #16a34a; font-size: 1rem; font-weight: 600;">
                                <i class="fas fa-warehouse" style="margin-right: 0.5rem;"></i>Delivery Information
                            </h4>
                            <div style="font-size: 0.95rem;">
                                <strong>Method:</strong> Factory Pickup
                                <div style="margin-top: 0.25rem; color: #6b7280;">
                                    2025 Freeman Road East, Milton, WA 98354
                                </div>
                            </div>
                        </div>
                    `}

                    <!-- Order Status -->
                    <div style="background: #f3f4f6; padding: 0.75rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.875rem; color: #6b7280;">Order Status</div>
                        <div style="margin-top: 0.25rem;">${getStatusBadge(request.Status)}</div>
                        <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                            Created: ${new Date(request.CreatedAt).toLocaleString()}
                        </div>
                    </div>
                </div>
            `;
        })() : `
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

                <!-- Uploaded Logo (for Christmas Bundles) -->
                ${items[0]?.Image_Upload ? `
                <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; border: 1px solid #fca5a5;">
                    <h4 style="margin: 0 0 1rem 0; color: #dc2626; font-size: 1rem;">
                        <i class="fas fa-image" style="margin-right: 0.5rem;"></i>
                        Uploaded Logo
                    </h4>
                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                        <div style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 0.5rem; background: white;">
                            <img src="https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/${items[0].Image_Upload}"
                                 alt="Customer Logo"
                                 style="max-width: 200px; max-height: 200px; display: block;"
                                 onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239ca3af%22 font-family=%22sans-serif%22%3EImage Not Found%3C/text%3E%3C/svg%3E';">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <button onclick="downloadLogo('${items[0].Image_Upload}', '${quoteID}')"
                                    class="quick-btn"
                                    style="background: #10b981 !important; color: white !important; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-download"></i> Download Original
                            </button>
                            <button onclick="viewLogoFullSize('${items[0].Image_Upload}')"
                                    class="quick-btn"
                                    style="background: #3b82f6 !important; color: white !important; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-expand"></i> View Full Size
                            </button>
                            <div style="font-size: 0.75rem; color: #6b7280;">
                                ExternalKey: ${items[0].Image_Upload.substring(0, 8)}...
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Order Details -->
                <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                    <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">Order Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
                        <div><strong>Request ID:</strong> ${request.QuoteID}</div>
                        <div><strong>Date:</strong> ${new Date(request.CreatedAt).toLocaleString()}</div>
                        <div><strong>Status:</strong> ${getStatusBadge(request.Status)}</div>
                        ${/* Hide Total Amount for Christmas bundles since we show value summary */ ''}
                        ${!(request.QuoteID && request.QuoteID.startsWith('XMAS')) ? `<div><strong>Total Amount:</strong> $${(request.TotalAmount || 0).toFixed(2)}</div>` : ''}
                        ${(() => {
                            // For BCA orders, extract event date from Notes
                            if (request.QuoteID && request.QuoteID.startsWith('BCA') && request.Notes) {
                                const eventMatch = request.Notes.match(/Event:\s*([^,]+)/);
                                if (eventMatch) {
                                    return `<div><strong>Event Date:</strong> <span style="color: #dc2626; font-weight: 600;">${new Date(eventMatch[1]).toLocaleDateString()}</span></div>`;
                                }
                            }
                            // For other orders, use DeliveryDate
                            if (items[0]?.DeliveryDate || request.DeliveryDate) {
                                return `<div><strong>Due Date:</strong> <span style="color: #dc2626; font-weight: 600;">${new Date(items[0]?.DeliveryDate || request.DeliveryDate).toLocaleDateString()}</span></div>`;
                            }
                            return '<div><strong>Due Date:</strong> <span style="color: #6b7280;">Not specified</span></div>';
                        })()}
                        ${items[0]?.DeliveryMethod || request.DeliveryMethod ? `<div><strong>Delivery:</strong> ${(items[0]?.DeliveryMethod || request.DeliveryMethod || '').toLowerCase() === 'ship' ? 'Ship' : 'Pickup'}</div>` : ''}
                        ${items[0]?.RushOrder || request.IsRushOrder ? `<div style="grid-column: 1 / -1;"><strong style="color: #dc2626;">⚠️ RUSH ORDER - EXPEDITED PROCESSING</strong></div>` : ''}
                        ${/* Only show pricing details for non-Christmas sample requests */ ''}
                        ${!(request.QuoteID && request.QuoteID.startsWith('XMAS')) && (orderDetails.totals || request.SubtotalAmount) ? `
                            <div><strong>Samples Cost:</strong> $${(orderDetails.totals?.samples || request.SubtotalAmount || 0).toFixed(2)}</div>
                            ${(items[0]?.DeliveryMethod || request.DeliveryMethod || '').toLowerCase() === 'ship' ? `<div><strong>Shipping:</strong> $${RETAIL_PRICES.shipping}.00</div>` : ''}
                            ${request.TotalAmount > request.SubtotalAmount ? `<div><strong>Tax:</strong> $${(request.TotalAmount - request.SubtotalAmount - ((items[0]?.DeliveryMethod || request.DeliveryMethod || '').toLowerCase() === 'ship' ? RETAIL_PRICES.shipping : 0)).toFixed(2)}</div>` : ''}
                        ` : ''}
                    </div>
                </div>

                <!-- Value Summary for Christmas Bundles -->
                ${request.QuoteID && request.QuoteID.startsWith('XMAS') && items[0] ? (() => {
                    // Calculate total retail value
                    let totalRetailValue = 0;
                    let bundleConfig = {};

                    try {
                        if (items[0].BundleConfiguration) {
                            bundleConfig = JSON.parse(items[0].BundleConfiguration);
                        }
                    } catch (e) {
                        console.log('Error parsing BundleConfiguration for value calculation:', e);
                    }

                    // Add jacket value with upcharge
                    if (bundleConfig.jacket && bundleConfig.jacket.trim()) {
                        const parts = bundleConfig.jacket.split(' - ');
                        const style = parts[0];
                        const size = parts[1];
                        let jacketValue = RETAIL_PRICES.jackets[style] || 0;
                        if (jacketValue && size && size !== 'N/A') {
                            jacketValue = calculateItemValue(style, size, jacketValue);
                        }
                        totalRetailValue += jacketValue;
                    }

                    // Add hoodie value with upcharge
                    if (bundleConfig.hoodie && bundleConfig.hoodie.trim()) {
                        const parts = bundleConfig.hoodie.split(' - ');
                        const style = parts[0];
                        const size = parts[1];
                        let hoodieValue = RETAIL_PRICES.hoodies;
                        if (size && size !== 'N/A') {
                            hoodieValue = calculateItemValue(style, size, hoodieValue);
                        }
                        totalRetailValue += hoodieValue;
                    }

                    // Add beanie value
                    if (bundleConfig.beanie && bundleConfig.beanie.trim()) {
                        totalRetailValue += RETAIL_PRICES.beanies;
                    }

                    // Add gloves value
                    if (bundleConfig.gloves && bundleConfig.gloves.trim()) {
                        totalRetailValue += RETAIL_PRICES.gloves;
                    }

                    // Add gift box and shipping
                    totalRetailValue += RETAIL_PRICES.giftBox;
                    if ((items[0]?.DeliveryMethod || request.DeliveryMethod || '').toLowerCase() === 'ship') {
                        totalRetailValue += RETAIL_PRICES.shipping;
                    }

                    return `
                    <div style="background: linear-gradient(135deg, #d4edda 0%, #cce5ff 100%); padding: 1.25rem; border-radius: 8px; margin-bottom: 1rem; border: 2px solid #10b981;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #065f46; font-size: 1.125rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-gift" style="color: #dc2626;"></i>
                            Christmas Bundle Value Summary
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                            <div style="background: white; padding: 0.75rem; border-radius: 6px; text-align: center;">
                                <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Total Retail Value</div>
                                <div style="font-size: 1.75rem; font-weight: 700; color: #059669;">$${totalRetailValue}</div>
                            </div>
                            <div style="background: white; padding: 0.75rem; border-radius: 6px; text-align: center;">
                                <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Customer Savings</div>
                                <div style="font-size: 1.75rem; font-weight: 700; color: #dc2626;">$${totalRetailValue}</div>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.5);">
                            <span style="background: white; color: #dc2626; font-weight: 700; padding: 0.5rem 1rem; border-radius: 6px; display: inline-block;">
                                🎄 100% FREE GIFT BUNDLE!
                            </span>
                        </div>
                    </div>
                    `;
                })() : ''}

                <!-- Shipping Address (if applicable) -->
                ${(items[0]?.DeliveryMethod || request.DeliveryMethod || '').toLowerCase() === 'ship' ? `
                    <div style="background: #fff3cd; padding: 1.5rem; border-radius: 8px; border: 2px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="margin: 0 0 1.25rem 0; color: #92400e; font-size: 1.125rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-shipping-fast" style="color: #f59e0b;"></i> 
                            Shipping Information - For ShopWorks Entry
                        </h4>
                        <div style="display: grid; gap: 0.875rem; background: white; padding: 1rem; border-radius: 6px; border: 1px solid #fed7aa;">
                            <!-- Street Address Field -->
                            <div style="display: flex; align-items: start; gap: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f3f4f6;">
                                <label style="font-weight: 600; color: #374151; min-width: 120px; font-size: 0.9375rem;">Street Address:</label>
                                <div style="flex: 1;">
                                    ${items[0]?.Shipping_Address || request.Shipping_Address || request.ShippingAddress ?
                                        `<span style="color: #111827; font-size: 0.9375rem; user-select: all; cursor: text;">${items[0]?.Shipping_Address || request.Shipping_Address || request.ShippingAddress}${items[0]?.Shipping_Apartment || request.Shipping_Apartment || request.ShippingApartment ? `, ${items[0]?.Shipping_Apartment || request.Shipping_Apartment || request.ShippingApartment}` : ''}</span>` :
                                        `<span style="color: #dc2626; font-style: italic; font-size: 0.875rem;">
                                            <i class="fas fa-exclamation-triangle" style="margin-right: 0.25rem;"></i>
                                            Missing - Contact customer for street address
                                        </span>`
                                    }
                                </div>
                            </div>
                            
                            <!-- City Field -->
                            <div style="display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f3f4f6;">
                                <label style="font-weight: 600; color: #374151; min-width: 120px; font-size: 0.9375rem;">City:</label>
                                <span style="color: #111827; font-size: 0.9375rem; user-select: all; cursor: text;">
                                    ${items[0]?.Shipping_City || request.Shipping_City || request.ShippingCity || extractCityFromNotes(request.Notes) || 'Not provided'}
                                </span>
                            </div>
                            
                            <!-- State Field -->
                            <div style="display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f3f4f6;">
                                <label style="font-weight: 600; color: #374151; min-width: 120px; font-size: 0.9375rem;">State:</label>
                                <span style="color: #111827; font-size: 0.9375rem; user-select: all; cursor: text;">
                                    ${items[0]?.Shipping_State || request.Shipping_State || request.ShippingState || extractStateFromNotes(request.Notes) || 'Not provided'}
                                </span>
                            </div>
                            
                            <!-- ZIP Code Field -->
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label style="font-weight: 600; color: #374151; min-width: 120px; font-size: 0.9375rem;">ZIP Code:</label>
                                <span style="color: #111827; font-size: 0.9375rem; user-select: all; cursor: text;">
                                    ${items[0]?.Shipping_Zip || request.Shipping_Zip || request.ShippingZip || extractZipFromNotes(request.Notes) || 'Not provided'}
                                </span>
                            </div>
                        </div>
                        
                        ${!(items[0]?.Shipping_Address || request.Shipping_Address || request.ShippingAddress) ? `
                            <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                <div style="font-size: 0.875rem; color: #92400e; font-weight: 600; margin-bottom: 0.25rem;">
                                    <i class="fas fa-info-circle"></i> Action Required
                                </div>
                                <div style="font-size: 0.875rem; color: #78350f;">
                                    Please contact customer to obtain complete street address before processing in ShopWorks.
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                <!-- Sample Items or Christmas Bundle Components -->
                ${request.QuoteID && request.QuoteID.startsWith('XMAS') && items[0] ? `
                <!-- Santa's Workshop Bonus Reminder -->
                <div style="background: linear-gradient(90deg, #fef3c7, #fffbeb); padding: 1rem; border-radius: 8px; border: 2px solid #f59e0b; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #92400e; font-size: 1.1rem; display: flex; align-items: center;">
                        <i class="fas fa-exclamation-circle" style="margin-right: 0.5rem; color: #f59e0b;"></i>
                        🎁 SANTA'S WORKSHOP BONUS - ACTION REQUIRED
                    </h4>
                    <p style="margin: 0.5rem 0 0 0; color: #78350f; font-weight: 600; font-size: 1rem;">
                        Include in package: <span style="background: white; padding: 2px 8px; border-radius: 4px;">10 CUSTOM STICKERS</span> with customer's uploaded logo
                    </p>
                    <p style="margin: 0.25rem 0 0 1.5rem; color: #92400e; font-size: 0.9rem;">
                        • Use the logo file uploaded with this order<br>
                        • Print 10 die-cut stickers (2-3" size)<br>
                        • Place stickers in gift box before shipping
                    </p>
                </div>

                <!-- Christmas Bundle Items -->
                <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; border: 1px solid #fca5a5;">
                    <h4 style="margin: 0 0 1rem 0; color: #dc2626; font-size: 1.1rem;">
                        <i class="fas fa-gift" style="margin-right: 0.5rem;"></i>
                        Christmas Bundle Components (Qty: ${request.TotalQuantity || 1})
                    </h4>

                    <div style="background: white; padding: 1rem; border-radius: 4px; margin-top: 1rem; border: 1px solid #fecaca;">
                        <table style="width: 100%; font-size: 1rem; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #fef2f2; border-bottom: 2px solid #fca5a5;">
                                    <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Item Type</th>
                                    <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Style Number</th>
                                    <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Size</th>
                                    <th style="padding: 0.75rem; text-align: center; font-weight: 600;">Qty</th>
                                    <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Color</th>
                                    <th style="padding: 0.75rem; text-align: right; font-weight: 600;">Retail Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    // Parse BundleConfiguration JSON to get components
                                    let bundleConfig = {};
                                    try {
                                        if (items[0].BundleConfiguration) {
                                            bundleConfig = JSON.parse(items[0].BundleConfiguration);
                                        }
                                    } catch (e) {
                                        console.log('Error parsing BundleConfiguration:', e);
                                    }

                                    let rows = '';

                                    // Display jacket if present
                                    if (bundleConfig.jacket && bundleConfig.jacket.trim()) {
                                        const parts = bundleConfig.jacket.split(' - ');
                                        const style = parts[0] || '';
                                        const size = parts[1] || 'N/A';
                                        const color = parts[2] || 'N/A';

                                        // Calculate jacket value with upcharge
                                        let jacketValue = RETAIL_PRICES.jackets[style] || 0;
                                        if (jacketValue && size && size !== 'N/A') {
                                            jacketValue = calculateItemValue(style, size, jacketValue);
                                        }

                                        rows += `
                                        <tr style="border-bottom: 1px solid #e5e7eb;">
                                            <td style="padding: 0.75rem;"><strong style="color: #dc2626;">🧥 Jacket</strong></td>
                                            <td style="padding: 0.75rem; font-family: monospace; font-size: 1.1rem;">${style}</td>
                                            <td style="padding: 0.75rem;"><span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${size}</span></td>
                                            <td style="padding: 0.75rem; text-align: center; font-weight: 600;">1</td>
                                            <td style="padding: 0.75rem; color: #6b7280; font-size: 0.875rem;">${color}</td>
                                            <td style="padding: 0.75rem; text-align: right;">
                                                <span style="color: #059669; font-weight: 700;">$${jacketValue}</span>
                                                <span style="color: #dc2626; font-size: 0.75rem; font-weight: 600; margin-left: 4px;">FREE!</span>
                                            </td>
                                        </tr>`;
                                    }

                                    // Display hoodie if present
                                    if (bundleConfig.hoodie && bundleConfig.hoodie.trim()) {
                                        const parts = bundleConfig.hoodie.split(' - ');
                                        const style = parts[0] || '';
                                        const size = parts[1] || 'N/A';
                                        const color = parts[2] || 'N/A';

                                        // Calculate hoodie value with upcharge
                                        let hoodieValue = RETAIL_PRICES.hoodies;
                                        if (size && size !== 'N/A') {
                                            hoodieValue = calculateItemValue(style, size, hoodieValue);
                                        }

                                        rows += `
                                        <tr style="border-bottom: 1px solid #e5e7eb;">
                                            <td style="padding: 0.75rem;"><strong style="color: #dc2626;">👕 Hoodie</strong></td>
                                            <td style="padding: 0.75rem; font-family: monospace; font-size: 1.1rem;">${style}</td>
                                            <td style="padding: 0.75rem;"><span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${size}</span></td>
                                            <td style="padding: 0.75rem; text-align: center; font-weight: 600;">1</td>
                                            <td style="padding: 0.75rem; color: #6b7280; font-size: 0.875rem;">${color}</td>
                                            <td style="padding: 0.75rem; text-align: right;">
                                                <span style="color: #059669; font-weight: 700;">$${hoodieValue}</span>
                                                <span style="color: #dc2626; font-size: 0.75rem; font-weight: 600; margin-left: 4px;">FREE!</span>
                                            </td>
                                        </tr>`;
                                    }

                                    // Display beanie if present
                                    if (bundleConfig.beanie && bundleConfig.beanie.trim()) {
                                        const parts = bundleConfig.beanie.split(' - ');
                                        const style = parts[0] || '';
                                        const color = parts[1] || 'N/A';
                                        const beanieValue = RETAIL_PRICES.beanies;

                                        rows += `
                                        <tr style="border-bottom: 1px solid #e5e7eb;">
                                            <td style="padding: 0.75rem;"><strong style="color: #dc2626;">🧢 Beanie</strong></td>
                                            <td style="padding: 0.75rem; font-family: monospace; font-size: 1.1rem;">${style}</td>
                                            <td style="padding: 0.75rem;"><span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">OSFA</span></td>
                                            <td style="padding: 0.75rem; text-align: center; font-weight: 600;">1</td>
                                            <td style="padding: 0.75rem; color: #6b7280; font-size: 0.875rem;">${color}</td>
                                            <td style="padding: 0.75rem; text-align: right;">
                                                <span style="color: #059669; font-weight: 700;">$${beanieValue}</span>
                                                <span style="color: #dc2626; font-size: 0.75rem; font-weight: 600; margin-left: 4px;">FREE!</span>
                                            </td>
                                        </tr>`;
                                    }

                                    // Display gloves if present
                                    if (bundleConfig.gloves && bundleConfig.gloves.trim()) {
                                        // Parse gloves: "CTGD0794 - XL - Black Barley"
                                        const parts = bundleConfig.gloves.split(' - ');
                                        const style = parts[0] || '';
                                        const size = parts[1] || 'N/A';
                                        // Combine remaining parts for color (in case color has hyphen)
                                        const color = parts.slice(2).join(' - ') || 'N/A';
                                        const glovesValue = RETAIL_PRICES.gloves;

                                        rows += `
                                        <tr style="border-bottom: 1px solid #e5e7eb;">
                                            <td style="padding: 0.75rem;"><strong style="color: #dc2626;">🧤 Gloves</strong></td>
                                            <td style="padding: 0.75rem; font-family: monospace; font-size: 1.1rem;">${style}</td>
                                            <td style="padding: 0.75rem;"><span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${size}</span></td>
                                            <td style="padding: 0.75rem; text-align: center; font-weight: 600;">1</td>
                                            <td style="padding: 0.75rem; color: #6b7280; font-size: 0.875rem;">${color}</td>
                                            <td style="padding: 0.75rem; text-align: right;">
                                                <span style="color: #059669; font-weight: 700;">$${glovesValue}</span>
                                                <span style="color: #dc2626; font-size: 0.75rem; font-weight: 600; margin-left: 4px;">FREE!</span>
                                            </td>
                                        </tr>`;
                                    }

                                    return rows || '<tr><td colspan="6" style="padding: 1rem; text-align: center; color: #6b7280;">No bundle components found</td></tr>';
                                })()}
                            </tbody>
                        </table>
                    </div>

                    <!-- Embroidery & Customization Details -->
                    ${(items[0]?.EmbroideryLocation || items[0]?.Thread_Colors || items[0]?.SpecialInstructions) ? `
                    <div style="background: #fffbeb; padding: 1rem; border-radius: 4px; margin-top: 1rem; border: 1px solid #fbbf24;">
                        <h5 style="margin: 0 0 0.75rem 0; color: #92400e; font-size: 1rem;">
                            <i class="fas fa-palette" style="margin-right: 0.5rem;"></i>
                            Customization Details
                        </h5>
                        <ul style="margin: 0.5rem 0; padding-left: 1.5rem; line-height: 1.8;">
                            ${(() => {
                                // Parse embroidery locations from combined field
                                if (items[0]?.EmbroideryLocation) {
                                    const embLoc = items[0].EmbroideryLocation;
                                    let result = '';

                                    // Parse "Jacket: location, Hoodie: location" format
                                    const jacketMatch = embLoc.match(/Jacket:\s*([^,]+)/);
                                    const hoodieMatch = embLoc.match(/Hoodie:\s*([^,]+)/);

                                    if (jacketMatch && jacketMatch[1] && jacketMatch[1] !== 'N/A') {
                                        result += `<li><strong>Jacket Embroidery:</strong> <span style="background: white; padding: 2px 6px; border-radius: 4px;">${jacketMatch[1].trim()}</span></li>`;
                                    }
                                    if (hoodieMatch && hoodieMatch[1] && hoodieMatch[1] !== 'N/A') {
                                        result += `<li><strong>Hoodie Embroidery:</strong> <span style="background: white; padding: 2px 6px; border-radius: 4px;">${hoodieMatch[1].trim()}</span></li>`;
                                    }
                                    return result;
                                }
                                return '';
                            })()}
                            ${items[0]?.Thread_Colors ? `<li><strong>Thread Colors:</strong> <span style="background: white; padding: 2px 6px; border-radius: 4px;">${items[0].Thread_Colors}</span></li>` : ''}
                            ${items[0]?.SpecialInstructions || items[0]?.Notes ? `<li><strong>Special Instructions:</strong> <span style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px;">${items[0].SpecialInstructions || items[0].Notes}</span></li>` : ''}
                        </ul>
                    </div>
                    ` : ''}
                </div>
                ` : items.length > 0 ? `
                <!-- Regular Sample Items -->
                <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                    <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">
                        Sample Items (${items.length}${request.TotalQuantity > items.length ? ` of ${request.TotalQuantity} requested` : ''})
                    </h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e5e7eb;">
                                <th style="padding: 0.5rem; text-align: left;">Style</th>
                                <th style="padding: 0.5rem; text-align: left;">Product</th>
                                <th style="padding: 0.5rem; text-align: left;">Color</th>
                                <th style="padding: 0.5rem; text-align: left;">Size</th>
                                <th style="padding: 0.5rem; text-align: right;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                // Check if these are BCA bundles
                                if (items.length > 0 && items[0].StyleNumber === 'BCA-BUNDLE') {
                                    // Parse size breakdown from first item
                                    let sizeBreakdown = {};
                                    try {
                                        sizeBreakdown = JSON.parse(items[0].SizeBreakdown || '{}');
                                    } catch (e) {
                                        console.log('Error parsing BCA size breakdown:', e);
                                    }

                                    // Display aggregated view for BCA bundles
                                    const rows = [];

                                    // Add header row
                                    rows.push(`
                                        <tr style="border-bottom: 2px solid #e5e7eb; background: #fce7f3;">
                                            <td colspan="5" style="padding: 0.75rem; font-weight: 600;">
                                                <i class="fas fa-ribbon" style="color: #ec4899;"></i>
                                                Breast Cancer Awareness Bundle - ${items.length} Total Bundles
                                            </td>
                                        </tr>
                                    `);

                                    // Add size breakdown row
                                    if (Object.keys(sizeBreakdown).length > 0) {
                                        const sizeDisplay = Object.entries(sizeBreakdown)
                                            .map(([size, qty]) => `${size}: ${qty}`)
                                            .join(', ');

                                        rows.push(`
                                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                                <td style="padding: 0.5rem;">BCA-BUNDLE</td>
                                                <td style="padding: 0.5rem;">PC54 Candy Pink T-Shirts</td>
                                                <td style="padding: 0.5rem;">Candy Pink</td>
                                                <td style="padding: 0.5rem;">${sizeDisplay}</td>
                                                <td style="padding: 0.5rem; text-align: right;">
                                                    ${items.length} @ $45.00
                                                </td>
                                            </tr>
                                        `);

                                        rows.push(`
                                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                                <td style="padding: 0.5rem;">BCA-BUNDLE</td>
                                                <td style="padding: 0.5rem;">C112 Trucker Caps</td>
                                                <td style="padding: 0.5rem;">True Pink/White</td>
                                                <td style="padding: 0.5rem;">One Size (${items.length} caps)</td>
                                                <td style="padding: 0.5rem; text-align: right;">
                                                    Included
                                                </td>
                                            </tr>
                                        `);
                                    }

                                    return rows.join('');
                                } else {
                                    // Regular items display
                                    return items.map(item => {
                                        let size = 'N/A';
                                        try {
                                            const sizeData = JSON.parse(item.SizeBreakdown || '{}');
                                            size = sizeData.size || 'N/A';
                                        } catch (e) {}

                                        return `
                                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                                <td style="padding: 0.5rem;">${item.StyleNumber}</td>
                                                <td style="padding: 0.5rem;">${item.ProductName}</td>
                                                <td style="padding: 0.5rem;">${item.Color || 'N/A'}</td>
                                                <td style="padding: 0.5rem;">${size}</td>
                                                <td style="padding: 0.5rem; text-align: right;">
                                                    ${item.FinalUnitPrice > 0 ? `$${item.FinalUnitPrice.toFixed(2)}` : 'FREE'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('');
                                }
                            })()}
                        </tbody>
                    </table>
                    
                    <!-- Order Totals Breakdown -->
                    ${(orderDetails.totals || shippingAmount > 0 || taxAmount > 0) ? `
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e5e7eb;">
                            <h5 style="margin: 0 0 0.5rem 0; color: #374151; font-size: 0.875rem; font-weight: 600;">Order Totals</h5>
                            <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; font-size: 0.875rem;">
                                <div>Samples Subtotal:</div><div style="text-align: right;">$${(orderDetails.totals?.samples || itemsTotal).toFixed(2)}</div>
                                ${shippingAmount > 0 ? `
                                    <div>Shipping:</div><div style="text-align: right;">$${shippingAmount.toFixed(2)}</div>
                                ` : ''}
                                ${taxAmount > 0 ? `
                                    <div>Tax (10.1%):</div><div style="text-align: right;">$${taxAmount.toFixed(2)}</div>
                                ` : ''}
                                <div style="border-top: 1px solid #d1d5db; padding-top: 0.5rem; font-weight: 600;">Total:</div>
                                <div style="border-top: 1px solid #d1d5db; padding-top: 0.5rem; text-align: right; font-weight: 600;">$${totalAmount.toFixed(2)}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                ` : ''}

                <!-- Missing Items Alert (Skip for bundles) -->
                ${(request.TotalQuantity > items.length && !items.some(item => item.StyleNumber === 'XMAS-BUNDLE')) ? `
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #dc2626; font-size: 1rem;">
                            <i class="fas fa-exclamation-triangle"></i> Missing Items Alert
                        </h4>
                        <p style="margin: 0 0 0.5rem 0; color: #7f1d1d; font-size: 0.875rem;">
                            Customer requested <strong>${request.TotalQuantity} samples</strong> but only <strong>${items.length} items</strong> are shown in the database.
                        </p>
                        <div style="background: #fee2e2; padding: 0.5rem; border-radius: 4px; font-size: 0.875rem; color: #7f1d1d;">
                            <strong>Technical Details:</strong> 
                            ${(() => {
                                const lineNumbers = items.map(item => item.LineNumber).sort((a,b) => a-b);
                                const missing = [];
                                for(let i = 1; i <= request.TotalQuantity; i++) {
                                    if (!lineNumbers.includes(i)) missing.push(i);
                                }
                                return missing.length > 0 ? `Missing LineNumber(s): ${missing.join(', ')}` : 'Items may have failed to save during submission';
                            })()}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Project Information -->
                ${(() => {
                    // For BCA orders, parse event date and instructions from Notes
                    if (request.QuoteID && request.QuoteID.startsWith('BCA') && request.Notes) {
                        const eventMatch = request.Notes.match(/Event:\s*([^,]+)/);
                        const instructionsMatch = request.Notes.match(/Instructions:\s*(.+)$/);

                        if (eventMatch || instructionsMatch) {
                            return `
                                <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                                    <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">Project Information</h4>
                                    ${eventMatch ? `<div><strong>Event Date:</strong> ${new Date(eventMatch[1]).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
                                    ${instructionsMatch ? `<div style="margin-top: 0.5rem;"><strong>Special Instructions:</strong><br><span style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px;">${instructionsMatch[1]}</span></div>` : ''}
                                </div>
                            `;
                        }
                    }

                    // For other orders, show standard project information
                    if (orderDetails.projectType || request.Notes) {
                        return `
                            <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                                <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem;">Project Information</h4>
                                ${orderDetails.projectType ? `<div><strong>Project Type:</strong> ${orderDetails.projectType}</div>` : ''}
                                ${orderDetails.estimatedQuantity ? `<div><strong>Estimated Quantity:</strong> ${orderDetails.estimatedQuantity}</div>` : ''}
                                ${orderDetails.timeline ? `<div><strong>Timeline:</strong> ${orderDetails.timeline}</div>` : ''}
                                ${request.Notes ? `<div style="margin-top: 0.5rem;"><strong>Notes:</strong><br>${cleanNotesDisplay(request.Notes).replace(/\|/g, '<br>')}</div>` : ''}
                            </div>
                        `;
                    }

                    return '';
                })()}
            </div>
        `;
        
        document.getElementById('sampleDetailsContent').innerHTML = detailsHTML;
        
        // Show/hide the Mark as Processed button based on status
        const processBtn = document.getElementById('markProcessedBtn');
        if (request.Status === 'Sample Request') {
            processBtn.style.display = 'inline-flex';
        } else {
            processBtn.style.display = 'none';
        }
        
        // Show the modal
        document.getElementById('sampleDetailsModal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading sample details:', error);
        alert('Failed to load sample request details');
    }
}

function generateShopWorksText(item, request) {
    let text = '=== CHRISTMAS BUNDLE ORDER ===\n';
    text += `Order ID: ${request.QuoteID}\n`;
    text += `Customer: ${request.CustomerName}\n`;
    text += `Company: ${request.CompanyName || 'N/A'}\n`;
    text += '------------------------\n\n';

    // Parse BundleConfiguration JSON to get components
    let bundleConfig = {};
    try {
        if (item.BundleConfiguration) {
            bundleConfig = JSON.parse(item.BundleConfiguration);
        }
    } catch (e) {
        console.log('Error parsing BundleConfiguration for ShopWorks text:', e);
    }

    text += 'BUNDLE ITEMS:\n';
    if (bundleConfig.jacket && bundleConfig.jacket.trim()) {
        const parts = bundleConfig.jacket.split(' - ');
        text += `• Jacket: ${parts[0] || 'Unknown'}\n`;
        text += `  Size: ${parts[1] || 'N/A'}, Color: ${parts[2] || 'N/A'} - Qty: 1\n\n`;
    }
    if (bundleConfig.hoodie && bundleConfig.hoodie.trim()) {
        const parts = bundleConfig.hoodie.split(' - ');
        text += `• Hoodie: ${parts[0] || 'Unknown'}\n`;
        text += `  Size: ${parts[1] || 'N/A'}, Color: ${parts[2] || 'N/A'} - Qty: 1\n\n`;
    }
    if (bundleConfig.beanie && bundleConfig.beanie.trim()) {
        const parts = bundleConfig.beanie.split(' - ');
        text += `• Beanie: ${parts[0] || 'Unknown'}\n`;
        text += `  Size: OSFA, Color: ${parts[1] || 'N/A'} - Qty: 1\n\n`;
    }
    if (bundleConfig.gloves && bundleConfig.gloves.trim()) {
        const parts = bundleConfig.gloves.split(' - ');
        text += `• Gloves: ${parts[0] || 'Unknown'}\n`;
        text += `  Size: OSFA, Color: ${parts[1] || 'N/A'} - Qty: 1\n\n`;
    }

    text += '------------------------\n';
    text += 'EMBROIDERY DETAILS:\n';
    text += `Location: ${item.EmbroideryLocation || 'Left Chest (Standard)'}\n`;
    text += `Thread Colors: ${item.Thread_Colors || 'TBD at pickup'}\n`;
    text += `Logo: ${item.Image_Upload ? 'Customer file uploaded' : 'No logo - use standard'}\n`;

    if (item.SpecialInstructions) {
        text += `\nSPECIAL INSTRUCTIONS:\n${item.SpecialInstructions}\n`;
    }

    if (item.GiftMessage) {
        text += `\nGIFT MESSAGE:\n${item.GiftMessage}\n`;
    }

    text += '\n------------------------\n';
    text += `Delivery: ${item.DeliveryMethod === 'Ship' ? 'SHIP TO CUSTOMER' : 'FACTORY PICKUP'}\n`;

    if (item.DeliveryMethod === 'Ship') {
        text += `Ship To: ${item.ShippingAddress || ''}\n`;
        text += `${item.ShippingCity || ''}, ${item.ShippingState || ''} ${item.ShippingZip || ''}\n`;
    }

    if (item.RushOrder === 'Yes') {
        text += '\n⚠️ RUSH ORDER - EXPEDITE ⚠️\n';
    }

    return text;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Create temporary success message
        const msg = document.createElement('div');
        msg.textContent = '✅ Copied to clipboard!';
        msg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 10px 20px; border-radius: 6px; z-index: 10000; animation: fadeIn 0.3s;';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }).catch(err => {
        alert('Failed to copy. Please select and copy manually.');
    });
}

async function generateChristmasBundlePDF(request, items) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let yPos = margin;

    // Company header - Professional green background
    doc.setFillColor(26, 71, 42); // NWCA Green
    doc.rect(0, 0, pageWidth, 30, 'F');

    // Add company info in header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('NORTHWEST CUSTOM APPAREL', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('2025 Freeman Road East, Milton, WA 98354 | 253-922-5793', pageWidth / 2, 22, { align: 'center' });

    // Christmas Bundle title - No emoji
    yPos = 40;
    doc.setTextColor(220, 38, 38); // Christmas red
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CHRISTMAS BUNDLE ORDER', pageWidth / 2, yPos, { align: 'center' });

    // Order ID and Date
    yPos += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Order ID: ${request.QuoteID}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(request.CreatedAt || Date.now()).toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });

    // Rush order banner if applicable - No emoji
    if (items[0]?.RushOrder === 'Yes') {
        yPos += 8;
        doc.setFillColor(220, 38, 38);
        doc.rect(margin, yPos - 4, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('RUSH ORDER - EXPEDITE PROCESSING', pageWidth / 2, yPos + 1, { align: 'center' });
        yPos += 6;
    }

    // Customer Information Box
    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER INFORMATION', margin, yPos);

    yPos += 4;
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPos, pageWidth - (margin * 2), 22, 'FD');

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    yPos += 6;
    const leftCol = margin + 5;
    const rightCol = pageWidth / 2 + 10;

    doc.text(`Name: ${request.CustomerName || 'N/A'}`, leftCol, yPos);
    doc.text(`Company: ${request.CompanyName || 'N/A'}`, rightCol, yPos);
    yPos += 6;
    doc.text(`Email: ${request.CustomerEmail || 'N/A'}`, leftCol, yPos);
    doc.text(`Phone: ${request.Phone || 'N/A'}`, rightCol, yPos);

    // Bundle Components Table
    yPos += 14;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('BUNDLE COMPONENTS', margin, yPos);

    yPos += 4;
    const bundleItems = [];

    // Parse items more carefully
    if (items && items.length > 0) {
        // Look for individual item fields or parse bundle configuration
        const firstItem = items[0];

        // Try to get items from individual fields first
        if (firstItem.JacketStyle || firstItem.HoodieStyle || firstItem.BeanieStyle || firstItem.GlovesStyle) {
            // Using individual fields
            if (firstItem.JacketStyle) {
                bundleItems.push([
                    'Jacket',
                    firstItem.JacketStyle || '',
                    firstItem.JacketSize || 'N/A',
                    '1',
                    firstItem.JacketColor || ''
                ]);
            }
            if (firstItem.HoodieStyle) {
                bundleItems.push([
                    'Hoodie',
                    firstItem.HoodieStyle || '',
                    firstItem.HoodieSize || 'N/A',
                    '1',
                    firstItem.HoodieColor || ''
                ]);
            }
            if (firstItem.BeanieStyle) {
                bundleItems.push([
                    'Beanie',
                    firstItem.BeanieStyle || '',
                    'OSFA',
                    '1',
                    firstItem.BeanieColor || ''
                ]);
            }
            if (firstItem.GlovesStyle) {
                bundleItems.push([
                    'Gloves',
                    firstItem.GlovesStyle || '',
                    firstItem.GlovesSize || 'OSFA',
                    '1',
                    firstItem.GlovesColor || ''
                ]);
            }
        } else {
            // Try parsing BundleConfiguration
            try {
                if (firstItem.BundleConfiguration) {
                    const bundleConfig = JSON.parse(firstItem.BundleConfiguration);

                    // Parse each item from configuration
                    // Items are stored as strings like "CT104670 - 2XL - New Navy"
                    if (bundleConfig.jacket) {
                        if (typeof bundleConfig.jacket === 'string' && bundleConfig.jacket.trim()) {
                            const parts = bundleConfig.jacket.split(' - ');
                            bundleItems.push([
                                'Jacket',
                                parts[0] || '',  // Style number
                                parts[1] || 'N/A',  // Size
                                '1',
                                parts[2] || ''  // Color
                            ]);
                        } else if (typeof bundleConfig.jacket === 'object') {
                            // Fallback for object format if it exists
                            const jacketData = bundleConfig.jacket;
                            bundleItems.push([
                                'Jacket',
                                jacketData.style || jacketData.id || '',
                                jacketData.selectedSize || jacketData.size || 'N/A',
                                '1',
                                jacketData.selectedColor || jacketData.color || ''
                            ]);
                        }
                    }

                    if (bundleConfig.hoodie) {
                        if (typeof bundleConfig.hoodie === 'string' && bundleConfig.hoodie.trim()) {
                            const parts = bundleConfig.hoodie.split(' - ');
                            bundleItems.push([
                                'Hoodie',
                                parts[0] || '',  // Style number
                                parts[1] || 'N/A',  // Size
                                '1',
                                parts[2] || ''  // Color
                            ]);
                        } else if (typeof bundleConfig.hoodie === 'object') {
                            // Fallback for object format if it exists
                            const hoodieData = bundleConfig.hoodie;
                            bundleItems.push([
                                'Hoodie',
                                hoodieData.style || hoodieData.id || '',
                                hoodieData.selectedSize || hoodieData.size || 'N/A',
                                '1',
                                hoodieData.selectedColor || hoodieData.color || ''
                            ]);
                        }
                    }

                    if (bundleConfig.beanie) {
                        if (typeof bundleConfig.beanie === 'string' && bundleConfig.beanie.trim()) {
                            const parts = bundleConfig.beanie.split(' - ');
                            bundleItems.push([
                                'Beanie',
                                parts[0] || '',  // Style number
                                'OSFA',
                                '1',
                                parts[1] || ''  // Color (beanie has no size, just style - color)
                            ]);
                        } else if (typeof bundleConfig.beanie === 'object') {
                            // Fallback for object format if it exists
                            const beanieData = bundleConfig.beanie;
                            bundleItems.push([
                                'Beanie',
                                beanieData.style || beanieData.id || '',
                                'OSFA',
                                '1',
                                beanieData.selectedColor || beanieData.color || ''
                            ]);
                        }
                    }

                    if (bundleConfig.gloves) {
                        if (typeof bundleConfig.gloves === 'string' && bundleConfig.gloves.trim()) {
                            const parts = bundleConfig.gloves.split(' - ');
                            // Gloves might be "CTGD0794 - XL" or similar
                            bundleItems.push([
                                'Gloves',
                                parts[0] || '',  // Style number
                                parts[1] || 'OSFA',  // Size or OSFA
                                '1',
                                parts[2] || parts[1] || ''  // Color if exists, or size info
                            ]);
                        } else if (typeof bundleConfig.gloves === 'object') {
                            // Fallback for object format if it exists
                            const glovesData = bundleConfig.gloves;
                            bundleItems.push([
                                'Gloves',
                                glovesData.style || glovesData.id || '',
                                glovesData.selectedSize || 'OSFA',
                                '1',
                                glovesData.selectedColor || glovesData.color || ''
                            ]);
                        }
                    }
                }
            } catch (e) {
                console.log('Error parsing BundleConfiguration:', e);
            }
        }

        // If still no items, try parsing from Description field
        if (bundleItems.length === 0 && firstItem.Description) {
            // Add a single line for the bundle description
            bundleItems.push([
                'Gift Bundle',
                firstItem.Description || 'Christmas Bundle',
                '',
                '1',
                'See details below'
            ]);
        }
    }

    // Create the items table
    doc.autoTable({
        startY: yPos,
        head: [['Item Type', 'Style Number', 'Size', 'Qty', 'Color/Notes']],
        body: bundleItems.length > 0 ? bundleItems : [['No items found', '', '', '', '']],
        theme: 'grid',
        headStyles: {
            fillColor: [220, 38, 38],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 9
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 35 },
            1: { cellWidth: 45 },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'center', cellWidth: 15 },
            4: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
    });

    yPos = doc.lastAutoTable.finalY + 8;

    // Embroidery Details
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('EMBROIDERY DETAILS', margin, yPos);

    yPos += 4;
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(251, 191, 36);
    doc.rect(margin, yPos, pageWidth - (margin * 2), 28, 'FD');

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    yPos += 6;

    // Parse embroidery location
    const jacketLoc = items[0]?.JacketEmbroideryLocation || 'Right Chest';
    const hoodieLoc = items[0]?.HoodieEmbroideryLocation || 'Left Chest';
    doc.text(`Location: Jacket: ${jacketLoc}, Hoodie: ${hoodieLoc}`, margin + 5, yPos);

    yPos += 5;
    doc.text(`Thread Colors: ${items[0]?.Thread_Colors || items[0]?.ThreadColors || 'Customer choice'}`, margin + 5, yPos);

    yPos += 5;
    const logoStatus = items[0]?.Image_Upload ? 'Customer logo uploaded' : 'Customer logo uploaded';
    doc.text(`Logo: ${logoStatus}`, margin + 5, yPos);

    if (items[0]?.SpecialInstructions) {
        yPos += 5;
        const instructions = items[0].SpecialInstructions.substring(0, 80);
        doc.text(`Special Instructions: ${instructions}`, margin + 5, yPos);
    }

    // Delivery Information
    yPos += 12;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('DELIVERY INFORMATION', margin, yPos);

    yPos += 4;
    const isShipping = items[0]?.DeliveryMethod === 'Ship' || items[0]?.DeliveryType === 'Shipping';
    doc.setFillColor(isShipping ? 219 : 220, isShipping ? 234 : 252, isShipping ? 254 : 231);
    doc.setDrawColor(isShipping ? 59 : 34, isShipping ? 130 : 197, isShipping ? 246 : 94);
    doc.rect(margin, yPos, pageWidth - (margin * 2), isShipping ? 28 : 18, 'FD');

    doc.setFontSize(9);
    yPos += 6;
    if (isShipping) {
        doc.setFont(undefined, 'bold');
        doc.text('SHIP TO CUSTOMER', margin + 5, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 5;
        const address = items[0]?.Shipping_Address || items[0]?.Address1 || 'N/A';
        const city = items[0]?.Shipping_City || items[0]?.City || '';
        const state = items[0]?.Shipping_State || items[0]?.State || '';
        const zip = items[0]?.Shipping_Zip || items[0]?.Zip || '';

        doc.text(`${address}`, margin + 5, yPos);
        yPos += 5;
        doc.text(`${city}, ${state} ${zip}`, margin + 5, yPos);
    } else {
        doc.setFont(undefined, 'bold');
        doc.text('FACTORY PICKUP', margin + 5, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 5;
        doc.text('Location: 2025 Freeman Road East, Milton, WA 98354', margin + 5, yPos);
        yPos += 5;
        doc.text('Hours: 8:30 AM - 4:45 PM', margin + 5, yPos);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 10);
    doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 10, { align: 'right' });

    return doc;
}

// Download Order as PDF
async function downloadOrderPDF() {
    if (!currentRequestID) {
        alert('No order selected');
        return;
    }

    try {
        // Find the current request
        const request = currentSampleRequests.find(r => r.QuoteID === currentRequestID);
        if (!request) {
            alert('Order not found');
            return;
        }

        // Fetch the items
        const itemsResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote_items?quoteID=${encodeURIComponent(currentRequestID)}`);
        const items = await itemsResponse.json();

        let doc;
        let filename;

        if (request.QuoteID && request.QuoteID.startsWith('XMAS')) {
            // Generate Christmas Bundle PDF
            doc = await generateChristmasBundlePDF(request, items);
            filename = `ChristmasBundle_${request.QuoteID}_${new Date().toISOString().split('T')[0]}.pdf`;
        } else {
            // For regular sample requests, create a simpler PDF
            const { jsPDF } = window.jspdf;
            doc = new jsPDF();

            // Basic header
            doc.setFontSize(16);
            doc.text('Sample Request Order', 105, 20, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Order ID: ${request.QuoteID}`, 105, 30, { align: 'center' });

            // Add basic details
            let yPos = 50;
            doc.setFontSize(10);
            doc.text(`Customer: ${request.CustomerName || 'N/A'}`, 20, yPos);
            yPos += 10;
            doc.text(`Email: ${request.CustomerEmail || 'N/A'}`, 20, yPos);
            yPos += 10;
            doc.text(`Date: ${new Date(request.CreatedAt).toLocaleDateString()}`, 20, yPos);

            filename = `SampleRequest_${request.QuoteID}_${new Date().toISOString().split('T')[0]}.pdf`;
        }

        // Save the PDF
        doc.save(filename);

        // Show success message
        const msg = document.createElement('div');
        msg.textContent = '✅ PDF Downloaded Successfully!';
        msg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 10px 20px; border-radius: 6px; z-index: 10000;';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
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
