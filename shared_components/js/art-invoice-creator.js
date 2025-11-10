/* Art Invoice Creator - Page-Specific JavaScript
   ============================================
   This file contains JavaScript specific to the art-invoice-creator.html page
   Extracted from inline script tags for better organization
   Created: 2025-07-03
   ============================================ */

// Global variables
let invoiceService;
let selectedRequest = null;
let serviceLineCount = 0;
let isEditMode = false;
let editInvoiceData = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    invoiceService = new ArtInvoiceServiceV2();
    
    // Initialize EmailJS
    emailjs.init(ART_INVOICE_CONFIG.EMAIL.PUBLIC_KEY);
    
    // Set default dates
    const today = new Date();
    const dueDate = new Date(today.getTime() + ART_INVOICE_CONFIG.DEFAULTS.DUE_DAYS * 24 * 60 * 60 * 1000);
    
    document.getElementById('invoiceDate').value = today.toISOString().split('T')[0];
    document.getElementById('dueDate').value = calculateDueDate(today.toISOString().split('T')[0]);
    
    // Parse URL parameters for deep linking and edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const designIdFromUrl = urlParams.get('id');
    const editIdFromUrl = urlParams.get('edit');
    
    // Determine mode and ID
    const isEditMode = !!editIdFromUrl;
    const targetId = editIdFromUrl || designIdFromUrl;
    
    if (targetId) {
        console.log(isEditMode ? 'Edit mode detected - Design ID:' : 'Deep link detected - Design ID:', targetId);
        
        try {
            // Show loading state
            const loadingMessage = isEditMode ? 'Loading existing invoice for editing...' : 'Loading art request...';
            document.getElementById('requestResults').innerHTML = `<div style="padding: 2rem; text-align: center;"><div class="loading"></div><p>${loadingMessage}</p></div>`;
            document.getElementById('requestResults').style.display = 'block';
            
            if (isEditMode) {
                // Edit mode: Load existing invoice for editing
                console.log('Loading invoice for editing:', targetId);
                const editResult = await invoiceService.getInvoiceForEdit(targetId);
                
                if (editResult.success) {
                    const editData = editResult.data;
                    console.log('Invoice loaded for editing:', editData);
                    
                    // Hide the search section
                    document.getElementById('searchSection').style.display = 'none';
                    
                    // Select the art request
                    if (editData.artRequest) {
                        selectedRequest = editData.artRequest;
                        
                        // Clear loading state
                        document.getElementById('requestResults').innerHTML = '';
                        document.getElementById('requestResults').style.display = 'none';
                        
                        // Show form section
                        const formSection = document.getElementById('formSection');
                        if (formSection) {
                            formSection.style.display = 'block';
                        }
                        
                        // Pre-populate form with existing invoice data
                        await populateFormForEdit(editData);
                        
                        // Update preview
                        if (typeof updateInvoicePreview === 'function') {
                            setTimeout(updateInvoicePreview, 500);
                        }
                        
                        // Show edit mode indicator
                        showEditModeIndicator(editData.invoice.InvoiceID);
                        
                    } else {
                        throw new Error('Art request data not found for this invoice');
                    }
                } else {
                    throw new Error(editResult.error || 'Failed to load invoice for editing');
                }
            } else {
                // Create mode: Load art request for new invoice
                const requests = await invoiceService.getArtRequests({ id_design: targetId });
                const request = requests.find(r => r.ID_Design == targetId);
                
                if (request) {
                    console.log('Art request loaded:', request);
                    
                    // Hide the search section
                    document.getElementById('searchSection').style.display = 'none';
                    
                    // Select the request directly
                    try {
                        await selectRequest(targetId, null);
                        
                        // Clear loading state
                        document.getElementById('requestResults').innerHTML = '';
                        document.getElementById('requestResults').style.display = 'none';
                        
                        // Show form section if it's hidden
                        const formSection = document.getElementById('formSection');
                        if (formSection) {
                            formSection.style.display = 'block';
                        }
                        
                        // Update preview only if request was selected successfully
                        if (selectedRequest && typeof updateInvoicePreview === 'function') {
                            setTimeout(updateInvoicePreview, 500);
                        }
                    } catch (error) {
                        console.error('Failed to select request in deep link:', error);
                        showAlert('Failed to load invoice form. Please try again.', 'error');
                        // Fall back to search interface
                        searchArtRequests();
                    }
                } else {
                    console.error('Art request not found for ID:', targetId);
                    showAlert('Art request not found', 'error');
                    // Fall back to search interface
                    searchArtRequests();
                }
            }
        } catch (error) {
            console.error(isEditMode ? 'Error loading invoice for editing:' : 'Error loading art request:', error);
            showAlert(isEditMode ? 'Failed to load invoice for editing' : 'Failed to load art request', 'error');
            // Fall back to search interface
            searchArtRequests();
        }
    } else {
        // No deep link - show regular search interface
        searchArtRequests();
    }
    
    // Form submit handler
    document.getElementById('invoiceForm').addEventListener('submit', handleSubmit);
    
    // Add initial service line
    addServiceLineItem();
});

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Helper function to extract order type
function getOrderType(request) {
    if (!request) return 'General';
    
    let orderType = '';
    
    if (request.Order_Type_1) {
        if (typeof request.Order_Type_1 === 'object') {
            orderType = request.Order_Type_1.value || request.Order_Type_1.name || request.Order_Type_1.text || JSON.stringify(request.Order_Type_1);
        } else {
            orderType = request.Order_Type_1;
        }
    } else if (request.Order_Type) {
        if (typeof request.Order_Type === 'object') {
            orderType = request.Order_Type.value || request.Order_Type.name || request.Order_Type.text || JSON.stringify(request.Order_Type);
        } else {
            orderType = request.Order_Type;
        }
    }
    
    if (orderType && orderType !== '[object Object]') {
        return orderType;
    }
    
    return 'General';
}

// Search Art Requests
async function searchArtRequests() {
    const searchTerm = document.getElementById('searchInput').value;
    const resultsDiv = document.getElementById('requestResults');
    
    // Show loading
    resultsDiv.innerHTML = '<div style="padding: 2rem; text-align: center;"><div class="loading"></div></div>';
    resultsDiv.style.display = 'block';
    
    try {
        // Get date filter values for API call
        const dateFromInput = document.getElementById('dateFrom').value;
        const dateToInput = document.getElementById('dateTo').value;
        
        // Build API filters
        const apiFilters = {
            invoiced: false, // Only get uninvoiced requests
            limit: 500 // Reasonable limit
        };
        
        // Add date filters to API call if available
        if (dateFromInput) {
            apiFilters.dateCreatedFrom = dateFromInput;
        }
        if (dateToInput) {
            apiFilters.dateCreatedTo = dateToInput;
        }
        
        console.log('[searchArtRequests] API filters:', apiFilters);
        
        // Fetch art requests with filters
        const requests = await invoiceService.getArtRequests(apiFilters);
        
        // Debug: Log first 2 requests to see data structure
        console.log('[searchArtRequests] Sample requests:', requests.slice(0, 2));
        
        // Filter requests (API already filtered by date and invoiced status)
        let filteredRequests = requests.filter(req => {
            // Include all statuses: NULL (new), Awaiting Approval 🟣, and Completed ✅
            // We'll show them all and let user see the full workflow
            
            // Basic validation - API should have already filtered most of this
            return req.Date_Created && req.ID_Design;
        });
        
        // Further filter based on search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredRequests = filteredRequests.filter(req => 
                (req.ID_Design && req.ID_Design.toString().includes(term)) ||
                (req.CompanyName && req.CompanyName.toLowerCase().includes(term)) ||
                (req.NOTES && req.NOTES.toLowerCase().includes(term)) ||
                (req.Note_Mockup && req.Note_Mockup.toLowerCase().includes(term)) ||
                (req.Full_Name_Contact && req.Full_Name_Contact.toLowerCase().includes(term))
            );
        }
        
        // Remove duplicates based on ID_Design
        const uniqueRequests = [];
        const seenIds = new Set();
        filteredRequests.forEach(req => {
            if (!seenIds.has(req.ID_Design)) {
                seenIds.add(req.ID_Design);
                uniqueRequests.push(req);
            }
        });
        
        // Sort by date, newest first
        uniqueRequests.sort((a, b) => new Date(b.Date_Created) - new Date(a.Date_Created));
        
        // Display results
        if (uniqueRequests.length === 0) {
            const dateMessage = dateFromInput ? `from ${new Date(dateFromInput).toLocaleDateString()}` : '';
            const toMessage = dateToInput ? ` to ${new Date(dateToInput).toLocaleDateString()}` : '';
            resultsDiv.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No uninvoiced art requests found ${dateMessage}${toMessage}.</div>`;
        } else {
            // Store all requests for filtering
            window.allRequests = uniqueRequests;
            displayFilteredRequests(uniqueRequests);
        }
    } catch (error) {
        console.error('Error searching requests:', error);
        resultsDiv.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--danger-color);">Error loading requests</div>';
    }
}

// Artwork Helper Functions are now loaded from art-invoice-utils.js
// Alias for compatibility
function generateThumbnailHTML(request) {
    return createArtworkThumbnail(request);
}

// Display filtered requests with enhanced card UI
function displayFilteredRequests(requests) {
    const resultsDiv = document.getElementById('requestResults');
    
    if (requests.length === 0) {
        resultsDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <h3>No Requests Found</h3>
                <p>Try adjusting your filters or search criteria</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="request-list">';
    
    // Debug: Log first request to see field names
    if (requests.length > 0) {
        console.log('[displayFilteredRequests] First request object:', requests[0]);
        console.log('[displayFilteredRequests] Field names:', Object.keys(requests[0]));
    }
    
    requests.forEach(req => {
        const status = getRequestStatus(req);
        const orderType = getOrderType(req);
        const timeSpent = req.Art_Minutes ? `${req.Art_Minutes} min` : 'Not tracked';
        const isInvoiced = req.Invoiced || false;
        const daysSinceCreated = Math.floor((new Date() - new Date(req.Date_Created)) / (1000 * 60 * 60 * 24));
        
        // Determine badges based on status
        let badges = '';
        
        // Primary status badges
        if (status === 'New') {
            badges += '<span class="badge badge-new-request">New Request</span>';
        } else if (status === 'In Progress') {
            badges += '<span class="badge badge-in-progress">In Progress</span>';
        } else if (status === 'Awaiting Approval') {
            badges += '<span class="badge badge-awaiting">Awaiting Approval</span>';
        } else if (status === 'Completed ✅' && !isInvoiced) {
            badges += '<span class="badge badge-ready">Ready to Invoice</span>';
        }
        
        // Secondary badges
        if (isInvoiced) {
            badges += '<span class="badge badge-invoiced">Invoiced</span>';
        }
        if (req.Priority === 'High' || req.RUSH) {
            badges += '<span class="badge badge-rush">Rush</span>';
        }
        
        html += `
            <div class="request-card ${isInvoiced ? 'invoiced' : ''}" onclick="selectRequest('${req.ID_Design}', event)">
                <div class="card-main-content">
                    <div class="card-header">
                        <div class="card-title">
                            <h3>${req.CompanyName || 'No Company'} - Design #${req.ID_Design}</h3>
                            <div class="badges">${badges}</div>
                        </div>
                        <div class="card-meta">
                            <span><i class="fas fa-calendar"></i> ${formatDate(req.Date_Created)}</span>
                            <span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span>
                        </div>
                    </div>
                    
                    <div class="card-body">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Contact:</label>
                                <span>${req.Full_Name_Contact || 'Unknown'}</span>
                            </div>
                            <div class="info-item">
                                <label>Sales Rep:</label>
                                <span>${getSalesRepFirstName(req.User_Email) || 'Unassigned'}</span>
                            </div>
                            <div class="info-item">
                                <label>Order Type:</label>
                                <span>${orderType}</span>
                            </div>
                            <div class="info-item">
                                <label>Time Spent:</label>
                                <span>${timeSpent}</span>
                            </div>
                        </div>
                        
                        ${req.NOTES ? `
                            <div class="card-description">
                                <label>Description:</label>
                                <p>${req.NOTES.substring(0, 150)}${req.NOTES.length > 150 ? '...' : ''}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="card-footer">
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectRequest('${req.ID_Design}', event)">
                            <i class="fas fa-file-invoice"></i> Create Invoice
                        </button>
                    </div>
                </div>
                
                ${generateThumbnailHTML(req)}
            </div>
        `;
    });
    
    html += '</div>';
    resultsDiv.innerHTML = html;
}

// Get request status
function getRequestStatus(request) {
    if (!request.Status) return 'New';
    
    const status = request.Status.toString().trim();
    if (status === 'Awaiting Approval 🟣') return 'Awaiting Approval';
    if (status === 'Completed ✅') return 'Completed ✅';
    if (status === 'In Progress') return 'In Progress';
    
    return status || 'New';
}

// Filter requests
function filterRequests(filterType, event) {
    if (!window.allRequests) return;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find the button with the matching filter type and mark it active
    const targetBtn = document.querySelector(`.filter-btn[data-filter="${filterType}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    let filtered = [...window.allRequests];
    
    switch(filterType) {
        case 'ready':
            filtered = filtered.filter(req => 
                getRequestStatus(req) === 'Completed ✅' && !req.Invoiced
            );
            break;
            
        case 'overdue':
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            filtered = filtered.filter(req => 
                new Date(req.Date_Created) < fourteenDaysAgo && 
                getRequestStatus(req) === 'Completed ✅'
            );
            break;
            
        case 'all':
        default:
            // Show all requests
            break;
    }
    
    displayFilteredRequests(filtered);
}

// Select Art Request
async function selectRequest(idDesign, event) {
    try {
        // Fetch the specific request
        const requests = await invoiceService.getArtRequests({ id_design: idDesign });
        const request = requests.find(r => r.ID_Design == idDesign);
        
        if (!request) {
            showAlert('Request not found', 'error');
            return;
        }
        
        selectedRequest = request;
        
        // Update UI to show selection (only if called from click event)
        if (event && event.target) {
            document.querySelectorAll('.request-card').forEach(card => {
                card.classList.remove('selected');
            });
            const selectedCard = event.target.closest('.request-card');
            if (selectedCard) {
                selectedCard.classList.add('selected');
            }
        }
        
        // Show selected indicator
        const selectedIndicator = document.getElementById('selectedIndicator');
        if (selectedIndicator) {
            selectedIndicator.style.display = 'block';
        }
        
        // Show form section (for both click events and programmatic calls)
        const formSection = document.getElementById('formSection');
        if (formSection) {
            formSection.style.display = 'block';
        }
        
        // Use the new populateInvoiceForm function with intelligent defaults
        populateInvoiceForm(request);
        
        // Update preview after selection (with small delay to ensure form is populated)
        if (typeof updateInvoicePreview === 'function') {
            setTimeout(updateInvoicePreview, 100);
        }
        
    } catch (error) {
        console.error('Error selecting request:', error);
        showAlert('Error loading request details', 'error');
    }
}

// Helper function to get sales rep first name from email
function getSalesRepFirstName(email) {
    if (!email) return null;
    
    // Extract the part before @ 
    const username = email.split('@')[0];
    
    // Capitalize first letter
    return username.charAt(0).toUpperCase() + username.slice(1);
}

// Populate invoice form with cleaned and intelligent defaults
function populateInvoiceForm(request) {
    // Clean and set project name
    const projectName = cleanProjectName(request.NOTES || request.Note_Mockup || '');
    document.getElementById('projectName').value = projectName;
    
    // Set customer information
    document.getElementById('customerName').value = request.Full_Name_Contact || '';
    document.getElementById('customerCompany').value = request.CompanyName || '';
    document.getElementById('customerEmail').value = request.Email_Contact || request.Email || '';
    document.getElementById('artRequestId').value = request.ID_Design || '';
    
    // Get and display sales rep
    const salesRepEmail = request.User_Email || 'sales@nwcustomapparel.com';
    const salesRepName = getSalesRepName(salesRepEmail);
    document.getElementById('salesRepDisplay').value = `${salesRepName} (${salesRepEmail})`;
    
    // Show invoice number
    const invoiceId = invoiceService.generateInvoiceID(request.ID_Design);
    document.getElementById('invoiceNumberDisplay').textContent = invoiceId;
    
    // Get service code suggestions
    const suggestions = inferServiceCodes(request);
    
    // Apply primary suggestion to first service line
    const primarySuggestion = suggestions.find(s => s.primary);
    if (primarySuggestion) {
        const firstSelect = document.querySelector('.service-select');
        if (firstSelect) {
            firstSelect.value = primarySuggestion.code;
            updateServiceLine(firstSelect);
        }
    }
    
    // Add additional suggested services
    suggestions.filter(s => !s.primary).forEach((suggestion, index) => {
        if (index === 0 && document.querySelectorAll('.service-line').length === 1) {
            // If only one line exists and it's filled, add a new line
            addServiceLineItem();
        }
        
        const serviceLines = document.querySelectorAll('.service-line');
        if (serviceLines.length === 0) {
            console.warn('No service lines found, skipping suggestion:', suggestion.code);
            return;
        }
        
        const targetLine = serviceLines[serviceLines.length - 1];
        if (!targetLine) {
            console.warn('Target line not found, skipping suggestion:', suggestion.code);
            return;
        }
        
        const select = targetLine.querySelector('.service-select');
        if (select && !select.value) {
            select.value = suggestion.code;
            updateServiceLine(select);
        }
    });
    
    // Show the invoice form
    document.getElementById('invoiceForm').style.display = 'block';
    
    // Scroll to invoice
    document.getElementById('invoiceForm').scrollIntoView({ behavior: 'smooth' });
    
    // Update preview
    updateInvoicePreview();
}

// Add Service Line Item
function addServiceLineItem() {
    serviceLineCount++;
    const tbody = document.getElementById('serviceTableBody');
    
    // Get all available service codes
    const serviceCodes = invoiceService.getAllServiceCodes(false); // Don't include rush versions in dropdown
    
    const row = document.createElement('tr');
    row.className = 'service-line';
    row.innerHTML = `
        <td>
            <select class="service-select" onchange="updateServiceLine(this)" style="width: 100%;">
                <option value="">-- Select Service --</option>
                ${serviceCodes.filter(s => !s.isAdditional).map(service => 
                    `<option value="${service.code}" data-amount="${service.amount}">${service.code} - ${service.name} ($${service.amount})</option>`
                ).join('')}
                <optgroup label="Additional Services">
                    ${serviceCodes.filter(s => s.isAdditional).map(service => 
                        `<option value="${service.code}" data-amount="${service.amount}">${service.code} - ${service.name} ($${service.amount})</option>`
                    ).join('')}
                </optgroup>
                <option value="CUSTOM">Custom Service (Enter Amount)</option>
            </select>
            <input type="text" class="service-description" placeholder="Enter description..." 
                   style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 3px; font-size: 0.875rem; display: none;">
        </td>
        <td class="text-center">
            <input type="number" class="quantity-input" value="1" min="1" onchange="updateServiceLine(this)">
        </td>
        <td class="text-right">
            <span class="rate-display">$0.00</span>
            <input type="number" class="custom-rate" placeholder="0.00" step="0.01" min="0" 
                   style="width: 80px; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 3px; font-size: 0.875rem; text-align: right; display: none;"
                   onchange="updateServiceLine(this)">
        </td>
        <td class="text-right">
            <span class="line-total">$0.00</span>
            ${serviceLineCount > 1 ? '<button type="button" class="remove-line-btn" onclick="removeServiceLine(this)" style="margin-left: 1rem;"><i class="fas fa-trash"></i></button>' : ''}
        </td>
    `;
    
    tbody.appendChild(row);
}

// Update Service Line
function updateServiceLine(element) {
    const row = element.closest('tr');
    const serviceSelect = row.querySelector('.service-select');
    const descriptionInput = row.querySelector('.service-description');
    const quantityInput = row.querySelector('.quantity-input');
    const rateDisplay = row.querySelector('.rate-display');
    const customRateInput = row.querySelector('.custom-rate');
    const lineTotalSpan = row.querySelector('.line-total');
    
    const selectedCode = serviceSelect.value;
    const quantity = parseInt(quantityInput.value) || 1;
    
    if (selectedCode === 'CUSTOM') {
        // Show custom inputs
        descriptionInput.style.display = 'block';
        rateDisplay.style.display = 'none';
        customRateInput.style.display = 'inline-block';
        
        const customRate = parseFloat(customRateInput.value) || 0;
        const total = customRate * quantity;
        lineTotalSpan.textContent = `$${total.toFixed(2)}`;
        
    } else if (selectedCode) {
        // Get service details
        const service = invoiceService.getServiceByCode(selectedCode);
        if (service) {
            descriptionInput.style.display = 'block';
            descriptionInput.value = service.description;
            rateDisplay.style.display = 'inline';
            customRateInput.style.display = 'none';
            
            const rate = service.amount;
            rateDisplay.textContent = `$${rate.toFixed(2)}`;
            
            const total = rate * quantity;
            lineTotalSpan.textContent = `$${total.toFixed(2)}`;
        }
    } else {
        // No service selected
        descriptionInput.style.display = 'none';
        rateDisplay.style.display = 'inline';
        customRateInput.style.display = 'none';
        rateDisplay.textContent = '$0.00';
        lineTotalSpan.textContent = '$0.00';
    }
    
    // Update totals
    calculateTotals();
}

// Remove Service Line
function removeServiceLine(button) {
    const row = button.closest('tr');
    row.remove();
    serviceLineCount--;
    calculateTotals();
}

// Calculate Totals
function calculateTotals() {
    let subtotal = 0;
    
    // Calculate service lines total
    document.querySelectorAll('.service-line').forEach(row => {
        const totalText = row.querySelector('.line-total').textContent;
        const total = parseFloat(totalText.replace('$', '')) || 0;
        subtotal += total;
    });
    
    // Calculate tax
    const applyTax = document.getElementById('applyTax').checked;
    const taxRate = ART_INVOICE_CONFIG.DEFAULTS.TAX_RATE; // WA state tax
    const taxAmount = applyTax ? subtotal * taxRate : 0;
    const grandTotal = subtotal + taxAmount;
    
    // Update displays
    document.getElementById('subtotalDisplay').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('taxDisplay').textContent = `$${taxAmount.toFixed(2)}`;
    document.getElementById('grandTotalDisplay').textContent = `$${grandTotal.toFixed(2)}`;
}

// Handle Tax Toggle
function handleTaxToggle() {
    const applyTax = document.getElementById('applyTax').checked;
    const resellerSection = document.getElementById('resellerSection');
    
    if (!applyTax) {
        resellerSection.style.display = 'block';
    } else {
        resellerSection.style.display = 'none';
        document.getElementById('resellerPermit').value = '';
    }
    
    calculateTotals();
}

// Handle Spec Artwork Toggle
function handleSpecArtworkToggle() {
    const isSpec = document.getElementById('isSpecArtwork').checked;
    const specDetails = document.getElementById('specArtDetails');
    const creditAmount = document.getElementById('creditAmount');
    
    if (isSpec) {
        specDetails.style.display = 'block';
        // Set credit amount to the current subtotal by default
        const subtotalText = document.getElementById('subtotalDisplay').textContent;
        const subtotal = parseFloat(subtotalText.replace('$', '')) || 0;
        creditAmount.value = subtotal.toFixed(2);
        
        // Update credit info
        updateCreditInfo();
    } else {
        specDetails.style.display = 'none';
        creditAmount.value = '';
    }
    
    calculateTotals();
}

// Get Service Items from form
function getServiceItems() {
    const serviceRows = document.querySelectorAll('.service-line');
    const items = [];
    
    serviceRows.forEach((row, index) => {
        const serviceSelect = row.querySelector('.service-select');
        const quantityInput = row.querySelector('.quantity-input');
        const customRate = row.querySelector('.custom-rate');
        const lineTotal = row.querySelector('.line-total');
        
        if (serviceSelect && serviceSelect.value) {
            const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
            items.push({
                serviceCode: serviceSelect.value,
                description: selectedOption ? selectedOption.textContent : serviceSelect.value,
                quantity: parseFloat(quantityInput?.value || 1),
                rate: parseFloat(customRate?.value || 0),
                amount: parseFloat(lineTotal?.textContent.replace('$', '') || 0),
                lineNumber: index + 1
            });
        }
    });
    
    return items;
}

// Update credit availability info (placeholder for future implementation)
function updateCreditInfo() {
    const creditInfo = document.getElementById('creditInfo');
    const salesRepEmail = selectedRequest?.User_Email || ART_INVOICE_CONFIG.COMPANY.EMAIL;
    const salesRepName = getSalesRepName(salesRepEmail);
    
    // For now, show static message - can be enhanced later with real credit tracking
    creditInfo.textContent = `Sales rep: ${salesRepName} (Credit tracking coming soon)`;
}

// Show Alert
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Handle Form Submit
async function handleSubmit(e) {
    e.preventDefault();
    
    if (!selectedRequest) {
        showAlert('Please select an art request first', 'error');
        return;
    }
    
    // Validate reseller permit if tax exempt
    if (!document.getElementById('applyTax').checked) {
        const permit = document.getElementById('resellerPermit').value.trim();
        if (!permit) {
            showAlert('Reseller permit number is required for tax exemption', 'error');
            return;
        }
    }
    
    // Gather service items
    const serviceItems = [];
    let hasValidService = false;
    
    document.querySelectorAll('.service-line').forEach(row => {
        const serviceSelect = row.querySelector('.service-select');
        const descriptionInput = row.querySelector('.service-description');
        const quantityInput = row.querySelector('.quantity-input');
        const customRateInput = row.querySelector('.custom-rate');
        const lineTotalText = row.querySelector('.line-total').textContent;
        
        const code = serviceSelect.value;
        if (code) {
            hasValidService = true;
            const quantity = parseInt(quantityInput.value) || 1;
            const total = parseFloat(lineTotalText.replace('$', '')) || 0;
            
            if (code === 'CUSTOM') {
                serviceItems.push({
                    code: 'CUSTOM',
                    description: descriptionInput.value || 'Custom Art Service',
                    quantity: quantity,
                    rate: parseFloat(customRateInput.value) || 0,
                    amount: total
                });
            } else {
                const service = invoiceService.getServiceByCode(code);
                serviceItems.push({
                    code: code,
                    description: descriptionInput.value || service.description,
                    quantity: quantity,
                    rate: service.amount,
                    amount: total
                });
            }
        }
    });
    
    if (!hasValidService) {
        showAlert('Please add at least one service', 'error');
        return;
    }
    
    // Calculate totals
    const subtotal = serviceItems.reduce((sum, item) => sum + item.amount, 0);
    const applyTax = document.getElementById('applyTax').checked;
    const taxAmount = applyTax ? subtotal * ART_INVOICE_CONFIG.DEFAULTS.TAX_RATE : 0;
    const grandTotal = subtotal + taxAmount;
    
    // Get sales rep info
    const salesRepEmail = selectedRequest.User_Email || ART_INVOICE_CONFIG.COMPANY.EMAIL;
    const salesRepName = getSalesRepName(salesRepEmail);
    
    // Prepare invoice data
    const invoiceData = {
        idDesign: selectedRequest.ID_Design,
        
        // Customer info
        customerName: document.getElementById('customerName').value,
        customerCompany: document.getElementById('customerCompany').value,
        customerEmail: document.getElementById('customerEmail').value,
        
        // Sales rep info
        salesRepName: salesRepName,
        salesRepEmail: salesRepEmail,
        
        // Project info
        projectName: document.getElementById('projectName').value,
        originalRequestDate: selectedRequest.Date_Created,
        completionDate: new Date(),
        
        // Service items (as object for processing)
        serviceItems: serviceItems,
        serviceSummary: serviceItems.map(item => `${item.code}: ${item.description}`).join('; '),
        
        // Amounts
        subtotalAmount: subtotal,
        rushFee: 0, // Not used in service code model
        revisionFee: 0, // Not used in service code model
        otherFees: 0, // Not used in service code model
        taxAmount: taxAmount,
        totalCost: grandTotal,
        
        // Notes
        customerNotes: document.getElementById('customerNotes').value,
        notes: document.getElementById('internalNotes').value,
        
        // Status
        status: document.getElementById('saveAsDraft').checked ? 'Draft' : 'Sent',
        
        // Spec Art Credit Fields
        isSpecArtwork: document.getElementById('isSpecArtwork').checked,
        creditApplied: parseFloat(document.getElementById('creditAmount').value) || 0,
        specArtPurpose: document.getElementById('specArtPurpose').value.trim(),
        
        // Additional fields
        artistName: 'Steve Deland',
        artistEmail: ART_INVOICE_CONFIG.EMAIL.DEFAULT_REPLY_TO,
        ccEmails: 'erik@nwcustomapparel.com',
        createdBy: salesRepName
    };
    
    // Get submit button reference
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        let result;
        
        if (isEditMode && editInvoiceData) {
            // Update existing invoice
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;
            
            console.log('Updating existing invoice:', editInvoiceData.invoice.InvoiceID);
            console.log('Updated invoice data:', invoiceData);
            
            // Get the PK_ID for the update
            const pkId = editInvoiceData.invoice.PK_ID;
            
            // Update the invoice
            result = await invoiceService.updateInvoice(pkId, invoiceData);
            
            if (result.success) {
                showAlert(`Invoice ${editInvoiceData.invoice.InvoiceID} updated successfully!`, 'success');
                
                // Redirect to invoice view
                setTimeout(() => {
                    window.location.href = `/art-invoice-view.html?id=${editInvoiceData.invoice.InvoiceID}`;
                }, 1500);
            } else {
                throw new Error(result.error || 'Failed to update invoice');
            }
        } else {
            // Create new invoice
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;
            
            console.log('Creating new invoice');
            console.log('Invoice data being sent:', invoiceData);
            
            // Check for existing invoice first
            const existingCheck = await invoiceService.checkExistingInvoice(selectedRequest.ID_Design);
            if (existingCheck) {
                throw new Error(`An invoice already exists for this request (${existingCheck.InvoiceID}). Please edit the existing invoice instead.`);
            }
            
            // Create invoice
            result = await invoiceService.createInvoice(invoiceData);
            
            if (result.success) {
                showAlert(`Invoice ${result.invoiceID} created successfully!`, 'success');
                
                // Redirect to invoice view
                setTimeout(() => {
                    window.location.href = `/art-invoice-view.html?id=${result.invoiceID}`;
                }, 1500);
            } else {
                throw new Error(result.error || 'Failed to create invoice');
            }
        }
        
    } catch (error) {
        const action = isEditMode ? 'updating' : 'creating';
        console.error(`Error ${action} invoice:`, error);
        showAlert(error.message || `Failed to ${action.slice(0, -3)}e invoice`, 'error');
        
        // Restore button
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Live Preview Functions
function updateInvoicePreview() {
    const previewContainer = document.getElementById('invoicePreviewContainer');
    
    if (!selectedRequest) {
        previewContainer.innerHTML = `
            <div class="invoice-preview-empty">
                <i class="fas fa-file-invoice"></i>
                <p>Select an art request to see the invoice preview</p>
            </div>
        `;
        return;
    }

    // Get form values safely
    const customerName = safeGetElementValue('customerName', 'Customer Name');
    const customerCompany = safeGetElementValue('customerCompany', '');
    const customerEmail = safeGetElementValue('customerEmail', 'customer@email.com');
    const projectName = safeGetElementValue('projectName', selectedRequest.NOTES || 'Project Name');
    const projectType = safeGetElementValue('projectType', 'Design Work');
    const complexity = safeGetElementValue('complexity', 'Standard');
    const artistName = 'Steve Deland';
    const requestDate = selectedRequest.Date_Created ? new Date(selectedRequest.Date_Created).toLocaleDateString() : 'N/A';
    const completionDate = new Date().toLocaleDateString();
    
    // Get service items and calculate totals
    const serviceItems = getServiceItems();
    const subtotal = serviceItems.reduce((sum, item) => sum + item.amount, 0);
    const applyTax = safeGetCheckboxValue('applyTax', false);
    const taxAmount = applyTax ? subtotal * ART_INVOICE_CONFIG.DEFAULTS.TAX_RATE : 0;
    const grandTotal = subtotal + taxAmount;
    
    // Generate invoice ID preview
    const now = new Date();
    const invoiceDate = now.toLocaleDateString();
    const dueDate = new Date(now.getTime() + ART_INVOICE_CONFIG.DEFAULTS.DUE_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString();
    const invoiceId = `${ART_INVOICE_CONFIG.DEFAULTS.INVOICE_PREFIX}${selectedRequest.ID_Design}`;
    
    // Build the preview HTML
    previewContainer.innerHTML = `
        <!-- Invoice Header -->
        <div class="invoice-preview-header">
            <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                 alt="Northwest Custom Apparel" class="invoice-preview-logo">
            <div class="invoice-preview-title">
                <h1>ART INVOICE</h1>
                <p><strong>Invoice ID:</strong> ${invoiceId}</p>
                <p><strong>Date:</strong> ${invoiceDate}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
            </div>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-preview-details">
            <div class="invoice-preview-section">
                <h3>Bill To</h3>
                <p><strong>${ART_INVOICE_CONFIG.COMPANY.NAME}</strong></p>
                <p>${ART_INVOICE_CONFIG.COMPANY.ADDRESS}</p>
            </div>
            
            <div class="invoice-preview-section">
                <h3>Customer</h3>
                <p><strong>${customerName}</strong></p>
                ${customerCompany ? `<p>${customerCompany}</p>` : ''}
                <p>${customerEmail}</p>
            </div>
        </div>

        <!-- Project Info -->
        <div class="invoice-preview-section invoice-preview-project">
            <h3>Project Details</h3>
            <div class="invoice-preview-project-grid">
                <div>
                    <p><strong>Project:</strong> ${projectName}</p>
                    <p><strong>Type:</strong> ${projectType}</p>
                    <p><strong>Complexity:</strong> ${complexity}</p>
                </div>
                <div>
                    <p><strong>Request Date:</strong> ${requestDate}</p>
                    <p><strong>Completion Date:</strong> ${completionDate}</p>
                    <p><strong>Artist:</strong> ${artistName}</p>
                </div>
            </div>
        </div>

        <!-- Service Items Table -->
        <table class="invoice-preview-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${serviceItems.length > 0 ? serviceItems.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td style="text-align: right;">${item.quantity}</td>
                        <td style="text-align: right;">$${item.rate.toFixed(2)}</td>
                        <td style="text-align: right;">$${item.amount.toFixed(2)}</td>
                    </tr>
                `).join('') : `
                    <tr>
                        <td colspan="4" style="text-align: center; color: #999; font-style: italic;">
                            No service items added yet
                        </td>
                    </tr>
                `}
            </tbody>
        </table>

        <!-- Invoice Totals -->
        <div class="invoice-preview-totals">
            <div class="invoice-preview-total-row">
                <span>Subtotal:</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${applyTax ? `
                <div class="invoice-preview-total-row">
                    <span>WA State Sales Tax (10.20%):</span>
                    <span>$${taxAmount.toFixed(2)}</span>
                </div>
            ` : ''}
            <div class="invoice-preview-total-row invoice-preview-grand-total">
                <span>Total Due:</span>
                <span>$${grandTotal.toFixed(2)}</span>
            </div>
        </div>

        ${generateArtworkPreview(selectedRequest)}

        <!-- Footer -->
        <div class="invoice-preview-footer">
            <p>Payment due within 30 days</p>
            <p>Please reference Invoice ID: <strong>${invoiceId}</strong> with payment</p>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;">
            <p><strong>Northwest Custom Apparel</strong></p>
            <p>Family Owned & Operated Since 1977</p>
            <p>Phone: 253-922-5793 | Email: sales@nwcustomapparel.com</p>
        </div>
    `;
}

function generateArtworkPreview(artRequest) {
    const artworks = getAllArtworks(artRequest);
    if (artworks.length === 0) {
        return '';
    }

    return `
        <div class="invoice-preview-artwork show">
            <h3>Artwork</h3>
            <div class="invoice-preview-artwork-grid">
                ${artworks.map(artwork => `
                    <div class="invoice-preview-artwork-item">
                        <img src="${artwork.url}" alt="${artwork.label}" loading="lazy">
                        <label>${artwork.label}</label>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Add event listeners for real-time updates
function initializePreviewUpdates() {
    // Update preview when form fields change
    const formFields = [
        'customerName', 'customerCompany', 'customerEmail',
        'projectName', 'projectType', 'complexity', 'applyTax'
    ];
    
    formFields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.addEventListener('input', updateInvoicePreview);
            element.addEventListener('change', updateInvoicePreview);
        }
    });
    
    // Update preview when service items change
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('service-select') || 
            e.target.classList.contains('quantity-input') ||
            e.target.classList.contains('custom-rate') ||
            e.target.classList.contains('add-service-btn') ||
            e.target.classList.contains('remove-line-btn')) {
            setTimeout(updateInvoicePreview, 100); // Small delay to let DOM update
        }
    });
    
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('service-select') || 
            e.target.classList.contains('quantity-input') ||
            e.target.classList.contains('custom-rate')) {
            updateInvoicePreview();
        }
    });
}

// Clear date filter function
function clearDateFilter() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    // Re-run search to show all results
    searchArtRequests();
}

// Initialize preview updates when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Art Invoice Creator] Page loaded, initializing...');
    setTimeout(initializePreviewUpdates, 1000); // Wait for other initializations
    
    // Set default date values
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const invoiceDateInput = document.getElementById('invoiceDate');
    const dueDateInput = document.getElementById('dueDate');
    const dateFromInput = document.getElementById('dateFrom');
    
    if (invoiceDateInput) {
        invoiceDateInput.value = today.toISOString().split('T')[0];
    }
    if (dueDateInput) {
        dueDateInput.value = in30Days.toISOString().split('T')[0];
    }
    
    // Verify date filter elements exist
    if (dateFromInput) {
        console.log('[Art Invoice Creator] Date filter elements found, default value:', dateFromInput.value);
    } else {
        console.error('[Art Invoice Creator] Date filter elements not found!');
    }
    
    // Automatically run search with default date filter on page load
    setTimeout(() => {
        console.log('[Art Invoice Creator] Running initial search...');
        searchArtRequests();
    }, 500); // Small delay to ensure everything is loaded
});

// Helper function to populate form with existing invoice data for editing
async function populateFormForEdit(editData) {
    try {
        console.log('[Edit Mode] Populating form with invoice data:', editData);
        
        isEditMode = true;
        editInvoiceData = editData;
        const invoice = editData.invoice;
        
        // Populate customer information
        document.getElementById('customerName').value = invoice.CustomerName || '';
        document.getElementById('customerCompany').value = invoice.CustomerCompany || '';
        document.getElementById('customerEmail').value = invoice.CustomerEmail || '';
        document.getElementById('projectName').value = invoice.ProjectName || '';
        document.getElementById('projectType').value = invoice.ProjectType || 'Design Work';
        document.getElementById('complexity').value = invoice.Complexity || 'Standard';
        
        // Populate dates
        if (invoice.InvoiceDate) {
            const invoiceDate = new Date(invoice.InvoiceDate);
            document.getElementById('invoiceDate').value = invoiceDate.toISOString().split('T')[0];
        }
        if (invoice.DueDate) {
            const dueDate = new Date(invoice.DueDate);
            document.getElementById('dueDate').value = dueDate.toISOString().split('T')[0];
        }
        
        // Populate tax option
        if (invoice.TaxAmount && parseFloat(invoice.TaxAmount) > 0) {
            document.getElementById('applyTax').checked = true;
        }
        
        // Populate spec artwork credit fields
        if (invoice.IsSpecArtwork) {
            document.getElementById('isSpecArtwork').checked = true;
            document.getElementById('creditAmount').value = invoice.CreditApplied || '';
            document.getElementById('specArtPurpose').value = invoice.SpecArtPurpose || '';
        }
        
        // Populate notes
        document.getElementById('customerNotes').value = invoice.CustomerNotes || '';
        document.getElementById('internalNotes').value = invoice.Notes || '';
        
        // Set draft mode checkbox based on current status
        document.getElementById('saveAsDraft').checked = invoice.Status === 'Draft';
        
        // Clear existing service line items
        const serviceContainer = document.getElementById('serviceLineItems');
        serviceContainer.innerHTML = '';
        serviceLineCount = 0;
        
        // Parse service details from invoice and populate service lines
        if (invoice.ServiceCodeList) {
            const serviceCodes = invoice.ServiceCodeList.split(',').map(code => code.trim());
            serviceCodes.forEach(code => {
                if (code && invoiceService.serviceCodes[code]) {
                    addServiceLineItem(code);
                }
            });
        }
        
        // If no service codes, add one empty line
        if (serviceLineCount === 0) {
            addServiceLineItem();
        }
        
        console.log('[Edit Mode] Form populated successfully');
        
    } catch (error) {
        console.error('[Edit Mode] Error populating form:', error);
        throw error;
    }
}

// Helper function to show edit mode indicator
function showEditModeIndicator(invoiceID) {
    // Create edit mode banner
    const editBanner = document.createElement('div');
    editBanner.id = 'editModeBanner';
    editBanner.innerHTML = `
        <div style="
            background: linear-gradient(45deg, #f39c12, #e67e22);
            color: white;
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-edit" style="font-size: 1.25rem;"></i>
                <div>
                    <strong>Edit Mode</strong>
                    <div style="font-size: 0.875rem; opacity: 0.9;">
                        Editing existing invoice: ${invoiceID}
                    </div>
                </div>
            </div>
            <div style="font-size: 0.875rem; opacity: 0.9;">
                Changes will update the existing invoice
            </div>
        </div>
    `;
    
    // Insert at the top of the main container
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer && mainContainer.firstChild) {
        mainContainer.insertBefore(editBanner, mainContainer.firstChild);
    }
    
    // Update page title
    document.title = `Edit Invoice ${invoiceID} - Northwest Custom Apparel`;
    
    // Update form submit button text
    const submitBtn = document.querySelector('#invoiceForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Invoice';
    }
}

// Make functions globally available for onclick handlers
window.selectRequest = selectRequest;
window.searchArtRequests = searchArtRequests;
window.filterRequests = filterRequests;
window.addServiceLineItem = addServiceLineItem;
window.updateServiceLine = updateServiceLine;
window.removeServiceLine = removeServiceLine;
window.handleTaxToggle = handleTaxToggle;
window.handleSpecArtworkToggle = handleSpecArtworkToggle;
window.updateCreditInfo = updateCreditInfo;
window.clearDateFilter = clearDateFilter;
window.updateInvoicePreview = updateInvoicePreview;