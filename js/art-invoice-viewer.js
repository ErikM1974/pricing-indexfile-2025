/* Art Invoice Viewer - Page-Specific JavaScript
   ============================================
   This file contains JavaScript specific to the art-invoice-view.html page
   Extracted from inline script tags for better organization
   Created: 2025-07-03
   ============================================ */

// Global variables
let invoiceService;
let currentInvoice = null;
let invoiceId = null;
let currentArtRequest = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    invoiceService = new ArtInvoiceServiceV2();
    
    // Initialize EmailJS
    emailjs.init(ART_INVOICE_CONFIG.EMAIL.PUBLIC_KEY);
    
    // Get invoice ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    invoiceId = urlParams.get('id');
    
    if (!invoiceId) {
        showAlert('No invoice ID provided', 'error');
        document.getElementById('loadingContainer').style.display = 'none';
        return;
    }
    
    // Load invoice
    await loadInvoice();
});

// Load Invoice
async function loadInvoice() {
    try {
        // Fetch invoice data
        const invoices = await invoiceService.getInvoices({ invoiceID: invoiceId });
        
        if (!invoices || invoices.length === 0) {
            showAlert('Invoice not found', 'error');
            document.getElementById('loadingContainer').style.display = 'none';
            return;
        }
        
        currentInvoice = invoices[0];
        displayInvoice();
        
        // Load art request data if available
        if (currentInvoice.ArtRequestID) {
            try {
                const artRequests = await invoiceService.getArtRequests({ 
                    id_design: currentInvoice.ArtRequestID,
                    limit: 1 
                });
                if (artRequests && artRequests.length > 0) {
                    currentArtRequest = artRequests[0];
                    displayInvoiceArtwork(currentArtRequest);
                }
            } catch (error) {
                console.error('Error loading art request:', error);
            }
        }
        
        // Hide loading, show content
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('actionBar').style.display = 'flex';
        document.getElementById('invoiceContent').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading invoice:', error);
        showAlert('Error loading invoice', 'error');
        document.getElementById('loadingContainer').style.display = 'none';
    }
}

// Display Invoice
function displayInvoice() {
    // Update breadcrumb
    document.getElementById('breadcrumbInvoiceId').textContent = currentInvoice.InvoiceID;
    
    // Status badge
    const statusBadge = `
        <span class="status-badge ${currentInvoice.Status.toLowerCase().replace(' ', '-')}">
            ${getStatusIcon(currentInvoice.Status)}
            ${currentInvoice.Status}
        </span>
    `;
    document.getElementById('statusBadgeContainer').innerHTML = statusBadge;
    
    // Invoice header
    document.getElementById('invoiceId').textContent = currentInvoice.InvoiceID;
    document.getElementById('invoiceDate').textContent = formatDate(currentInvoice.InvoiceDate);
    document.getElementById('dueDate').textContent = formatDate(currentInvoice.DueDate);
    document.getElementById('footerInvoiceId').textContent = currentInvoice.InvoiceID;
    
    // Bill to (Sales Rep)
    document.getElementById('salesRepName').textContent = currentInvoice.SalesRepName || 'Sales Representative';
    document.getElementById('salesRepEmail').textContent = currentInvoice.SalesRepEmail || '';
    
    // Customer info
    document.getElementById('customerName').textContent = currentInvoice.CustomerName || 'Unknown Customer';
    document.getElementById('customerCompany').textContent = currentInvoice.CustomerCompany || '';
    document.getElementById('customerEmail').textContent = currentInvoice.CustomerEmail || '';
    
    // Project details
    document.getElementById('projectName').textContent = currentInvoice.ProjectName || 'N/A';
    document.getElementById('projectType').textContent = currentInvoice.ProjectType || 'N/A';
    document.getElementById('complexity').textContent = currentInvoice.Complexity || 'Standard';
    document.getElementById('requestDate').textContent = formatDate(currentInvoice.OriginalRequestDate);
    document.getElementById('completionDate').textContent = formatDate(currentInvoice.CompletionDate);
    document.getElementById('artistName').textContent = currentInvoice.ArtistName || 'N/A';
    
    // Artwork description
    if (currentInvoice.ArtworkDescription) {
        document.getElementById('artworkDescriptionContainer').style.display = 'block';
        document.getElementById('artworkDescription').textContent = currentInvoice.ArtworkDescription;
    }
    
    // Build invoice table
    const tbody = document.getElementById('invoiceTableBody');
    const tableHeader = document.getElementById('tableHeader');
    tbody.innerHTML = '';
    
    // Check if this invoice uses service codes
    if (currentInvoice.ServiceItems && currentInvoice.ServiceItems !== 'null' && currentInvoice.ServiceItems !== '') {
        try {
            // Parse service items from JSON
            const serviceItems = JSON.parse(currentInvoice.ServiceItems);
            
            // Update table headers for service code display
            tableHeader.innerHTML = `
                <th>Description</th>
                <th class="text-right">Service Code</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Amount</th>
            `;
            
            // Display each service item
            serviceItems.forEach(item => {
                const quantity = item.quantity || 1;
                const rate = item.rate || item.amount;
                const total = item.amount || (rate * quantity);
                
                tbody.innerHTML += `
                    <tr>
                        <td>${item.description || 'Art Services'}</td>
                        <td class="text-right">${item.code}</td>
                        <td class="text-right">${quantity}</td>
                        <td class="text-right">$${total.toFixed(2)}</td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error('Error parsing service items:', e);
            console.log('ServiceItems data:', currentInvoice.ServiceItems);
            // Fall back to subtotal display
            displaySubtotalOnly();
        }
    } else {
        // Try to parse service items from Notes field (for existing invoices)
        const serviceItemsFromNotes = parseServiceItemsFromNotes(currentInvoice.Notes);
        
        if (serviceItemsFromNotes && serviceItemsFromNotes.length > 0) {
            // Update table headers for service code display
            tableHeader.innerHTML = `
                <th>Description</th>
                <th class="text-right">Service Code</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Amount</th>
            `;
            
            // Display each service item from notes
            serviceItemsFromNotes.forEach(item => {
                tbody.innerHTML += `
                    <tr>
                        <td>${item.description || 'Art Services'}</td>
                        <td class="text-right">${item.code}</td>
                        <td class="text-right">${item.quantity || 1}</td>
                        <td class="text-right">$${(item.amount || 0).toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            // If no service items anywhere, show the subtotal
            displaySubtotalOnly();
        }
    }
    
    function displaySubtotalOnly() {
        // Update headers for simple display
        tableHeader.innerHTML = `
            <th>Description</th>
            <th class="text-right">Service Code</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Amount</th>
        `;
        
        // Display subtotal as single line item
        const subtotal = parseFloat(currentInvoice.SubtotalAmount || 0);
        const projectType = currentInvoice.ProjectType || 'Design';
        
        // Check for ServiceCodes field - this contains comma-separated codes like "GRT-50,GRT-25"
        let serviceCodeDisplay = '-';
        if (currentInvoice.ServiceCodes && currentInvoice.ServiceCodes.trim() !== '') {
            serviceCodeDisplay = currentInvoice.ServiceCodes;
        }
        
        tbody.innerHTML += `
            <tr>
                <td>Art Services - ${projectType}</td>
                <td class="text-right">${serviceCodeDisplay}</td>
                <td class="text-right">1</td>
                <td class="text-right">$${subtotal.toFixed(2)}</td>
            </tr>
        `;
    }
    
    // Totals
    const subtotal = parseFloat(currentInvoice.SubtotalAmount || 0);
    document.getElementById('subtotalAmount').textContent = `$${subtotal.toFixed(2)}`;
    
    const rushFee = parseFloat(currentInvoice.RushFee || 0);
    const revisionFee = parseFloat(currentInvoice.RevisionFee || 0);
    const otherFees = parseFloat(currentInvoice.OtherFees || 0);
    const additionalFees = rushFee + revisionFee + otherFees;
    if (additionalFees > 0) {
        document.getElementById('additionalFeesRow').style.display = 'flex';
        document.getElementById('additionalFeesAmount').textContent = `$${additionalFees.toFixed(2)}`;
    }
    
    // Sales tax display
    const taxAmount = parseFloat(currentInvoice.TaxAmount || 0);
    const invoiceContainer = document.querySelector('.invoice-container');
    
    if (taxAmount > 0) {
        document.getElementById('taxRow').style.display = 'flex';
        document.getElementById('taxAmount').textContent = `$${taxAmount.toFixed(2)}`;
        document.getElementById('taxExemptRow').style.display = 'none';
        // Add class for print CSS
        invoiceContainer.classList.remove('tax-exempt');
        invoiceContainer.classList.add('has-tax');
    } else {
        document.getElementById('taxRow').style.display = 'none';
        document.getElementById('taxExemptRow').style.display = 'flex';
        // Add class for print CSS
        invoiceContainer.classList.remove('has-tax');
        invoiceContainer.classList.add('tax-exempt');
    }
    
    const grandTotal = parseFloat(currentInvoice.GrandTotal || 0);
    document.getElementById('grandTotalAmount').textContent = `$${grandTotal.toFixed(2)}`;
    
    // Notes
    if (currentInvoice.CustomerNotes) {
        document.getElementById('notesSection').style.display = 'block';
        document.getElementById('customerNotes').textContent = currentInvoice.CustomerNotes;
    }
    
    // Payment information
    if (currentInvoice.PaymentAmount && currentInvoice.PaymentAmount > 0) {
        document.getElementById('paymentSection').style.display = 'block';
        document.getElementById('paymentMethod').textContent = currentInvoice.PaymentMethod || 'N/A';
        document.getElementById('paymentDate').textContent = formatDate(currentInvoice.PaymentDate);
        document.getElementById('paymentReference').textContent = currentInvoice.PaymentReference || 'N/A';
        document.getElementById('paymentAmount').textContent = `$${parseFloat(currentInvoice.PaymentAmount).toFixed(2)}`;
        document.getElementById('balanceDue').textContent = `$${parseFloat(currentInvoice.BalanceDue || 0).toFixed(2)}`;
    }
    
    // Spec Art Information
    if (currentInvoice.IsSpecArtwork === true || currentInvoice.IsSpecArtwork === 'true') {
        document.getElementById('specArtSection').style.display = 'block';
        document.getElementById('specArtPurpose').textContent = currentInvoice.SpecArtPurpose || 'Sales support';
        
        const creditApplied = parseFloat(currentInvoice.CreditApplied || 0);
        if (creditApplied > 0) {
            document.getElementById('creditApplied').textContent = `$${creditApplied.toFixed(2)}`;
        } else {
            document.getElementById('creditApplied').textContent = 'Complimentary';
        }
    } else {
        document.getElementById('specArtSection').style.display = 'none';
    }
    
    // Update email button visibility
    if (currentInvoice.Status === 'Draft') {
        document.getElementById('emailBtn').innerHTML = '<i class="fas fa-paper-plane"></i> Send Invoice';
    } else {
        document.getElementById('emailBtn').innerHTML = '<i class="fas fa-envelope"></i> Resend Invoice';
    }
    
    // Update void button visibility - only show for appropriate statuses
    const voidBtn = document.getElementById('voidBtn');
    const canVoid = currentInvoice.Status && 
                   currentInvoice.Status !== 'Voided' && 
                   currentInvoice.Status !== 'Cancelled' &&
                   !currentInvoice.IsDeleted;
    
    if (canVoid) {
        voidBtn.style.display = 'inline-flex';
    } else {
        voidBtn.style.display = 'none';
    }
}

// Display Invoice Artwork
function displayInvoiceArtwork(artRequest) {
    const artworkSection = document.getElementById('artworkSection');
    if (!artRequest) {
        artworkSection.style.display = 'none';
        return;
    }

    const artworks = getAllArtworks(artRequest);
    
    let artworkHTML = '<h3>Associated Artwork</h3>';
    artworkHTML += '<div class="artwork-grid">';
    
    if (artworks.length > 0) {
        // Pass the full artRequest object to enable gallery navigation
        artworkHTML += `
            <div class="artwork-item" onclick='showArtworkModal(${JSON.stringify(artRequest).replace(/'/g, "&#39;")})' style="cursor: pointer;">
                <img src="${artworks[0].url}" alt="${artworks[0].label}" 
                     onerror="this.parentElement.style.display='none'">
                <label>${artworks.length} artwork file${artworks.length > 1 ? 's' : ''} - Click to view</label>
            </div>
        `;
    } else {
        artworkHTML += '<p class="no-artwork">No artwork files available for this design.</p>';
    }
    
    artworkHTML += '</div>';
    
    artworkSection.innerHTML = artworkHTML;
    artworkSection.style.display = 'block';
}

// Send Invoice Email
async function sendInvoiceEmail() {
    if (!currentInvoice) return;
    
    if (!confirm(`Send invoice to ${currentInvoice.SalesRepName || 'Sales Rep'}?`)) {
        return;
    }
    
    // Prepare email data
    const emailData = {
        // System fields
        to_email: currentInvoice.SalesRepEmail,
        reply_to: currentInvoice.ArtistEmail || ART_INVOICE_CONFIG.EMAIL.DEFAULT_REPLY_TO,
        from_name: ART_INVOICE_CONFIG.EMAIL.FROM_NAME,
        
        // Invoice details
        invoice_id: currentInvoice.InvoiceID,
        invoice_date: formatDate(currentInvoice.InvoiceDate),
        due_date: formatDate(currentInvoice.DueDate),
        
        // Recipient info
        sales_rep_name: currentInvoice.SalesRepName || 'Sales Representative',
        sales_rep_email: currentInvoice.SalesRepEmail || '',
        
        // Customer info
        customer_name: currentInvoice.CustomerName || 'Unknown Customer',
        customer_company: currentInvoice.CustomerCompany || 'Not Provided',
        
        // Project details
        project_name: currentInvoice.ProjectName || 'N/A',
        project_type: currentInvoice.ProjectType || 'N/A',
        artwork_description: currentInvoice.ArtworkDescription || 'See attached invoice for details',
        
        // Time and billing - handle both service codes and hourly
        time_spent: (currentInvoice.TimeSpent || 0).toFixed(2),
        hourly_rate: (currentInvoice.HourlyRate || 0).toFixed(2),
        subtotal: (currentInvoice.SubtotalAmount || 0).toFixed(2),
        
        // Service items for new billing method
        service_items_html: '',
        
        // Additional fees
        rush_fee: (currentInvoice.RushFee || 0).toFixed(2),
        revision_fee: (currentInvoice.RevisionFee || 0).toFixed(2),
        other_fees: (currentInvoice.OtherFees || 0).toFixed(2),
        
        // Totals
        grand_total: (currentInvoice.GrandTotal || 0).toFixed(2),
        
        // Notes
        notes: currentInvoice.CustomerNotes || 'No additional notes',
        
        // Company info
        company_phone: ART_INVOICE_CONFIG.COMPANY.PHONE,
        company_year: ART_INVOICE_CONFIG.COMPANY.ESTABLISHED
    };
    
    // Build service items HTML if using service codes
    if (currentInvoice.ServiceItems) {
        try {
            const serviceItems = JSON.parse(currentInvoice.ServiceItems);
            let itemsHtml = `
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">Service Code</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            serviceItems.forEach(item => {
                itemsHtml += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.description}</td>
                        <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">${item.code}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">$${item.amount.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            itemsHtml += `
                    </tbody>
                </table>
            `;
            
            emailData.service_items_html = itemsHtml;
        } catch (e) {
            console.error('Error building service items HTML:', e);
        }
    }
    
    try {
        // Show loading
        document.getElementById('emailBtn').disabled = true;
        document.getElementById('emailBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        // Send email using EmailJS
        await emailjs.send(
            ART_INVOICE_CONFIG.EMAIL.SERVICE_ID,
            ART_INVOICE_CONFIG.EMAIL.TEMPLATE_ID,
            emailData
        );
        
        // Update invoice status if it was a draft
        if (currentInvoice.Status === 'Draft') {
            await invoiceService.markInvoiceAsSent(currentInvoice.InvoiceID, currentInvoice.SalesRepEmail);
        }
        
        alert('Invoice sent successfully!');
        
        // Reload to show updated status
        window.location.reload();
        
    } catch (error) {
        console.error('Error sending email:', error);
        alert('Failed to send invoice. Please try again.');
        
        // Reset button
        document.getElementById('emailBtn').disabled = false;
        if (currentInvoice.Status === 'Draft') {
            document.getElementById('emailBtn').innerHTML = '<i class="fas fa-paper-plane"></i> Send Invoice';
        } else {
            document.getElementById('emailBtn').innerHTML = '<i class="fas fa-envelope"></i> Resend Invoice';
        }
    }
}

// Void Current Invoice
async function voidCurrentInvoice() {
    if (!currentInvoice) {
        alert('No invoice loaded to void.');
        return;
    }
    
    // Confirm the action
    const confirmMessage = `Are you sure you want to void invoice ${currentInvoice.InvoiceID}?\n\nThis action cannot be undone and will:\n- Mark the invoice as voided\n- Allow a new invoice to be created for the same art request\n- Update the art request status\n\nClick OK to proceed or Cancel to abort.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Prompt for reason
    const reason = prompt('Please provide a reason for voiding this invoice (optional):') || 'No reason provided';
    
    try {
        // Show loading state
        const voidBtn = document.getElementById('voidBtn');
        const originalText = voidBtn.innerHTML;
        voidBtn.disabled = true;
        voidBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Voiding...';
        
        // Call the void function from the service
        const result = await invoiceService.voidInvoice(currentInvoice.PK_ID, 'User', reason);
        
        if (result.success) {
            alert(`Invoice ${currentInvoice.InvoiceID} has been successfully voided.`);
            
            // Redirect back to dashboard or reload to show voided status
            window.location.href = '/art-invoices-dashboard.html';
        } else {
            throw new Error(result.error || 'Failed to void invoice');
        }
        
    } catch (error) {
        console.error('Error voiding invoice:', error);
        alert('Failed to void invoice: ' + error.message);
        
        // Reset button
        const voidBtn = document.getElementById('voidBtn');
        voidBtn.disabled = false;
        voidBtn.innerHTML = '<i class="fas fa-ban"></i> Void Invoice';
    }
}

// Make functions globally available for onclick handlers
window.sendInvoiceEmail = sendInvoiceEmail;
window.voidCurrentInvoice = voidCurrentInvoice;