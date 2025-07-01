// Art Invoice Service V2 - Using dedicated art-invoices API endpoint
class ArtInvoiceServiceV2 {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.hourlyRate = 75.00; // Default hourly rate
        
        // Service codes definition
        this.serviceCodes = {
            'GRT-25': {
                code: 'GRT-25',
                name: 'Quick Review',
                description: 'Quick design consultation and file review for print readiness',
                amount: 25.00,
                minMinutes: 0,
                maxMinutes: 15
            },
            'GRT-50': {
                code: 'GRT-50',
                name: 'Logo Mockup',
                description: 'Logo mockup on ordered products with print readiness check for clarity and sizing (includes up to 2 revisions)',
                amount: 50.00,
                minMinutes: 16,
                maxMinutes: 45
            },
            'GRT-75': {
                code: 'GRT-75',
                name: 'Custom Design',
                description: 'Custom artwork creation with revisions included and print-ready files',
                amount: 75.00,
                minMinutes: 46,
                maxMinutes: 75
            },
            'GRT-100': {
                code: 'GRT-100',
                name: 'Extended Design',
                description: 'Extended design work for complex projects',
                amount: 100.00,
                minMinutes: 76,
                maxMinutes: 105
            },
            'GRT-150': {
                code: 'GRT-150',
                name: 'Complex Project',
                description: 'Comprehensive design services for complex multi-element projects',
                amount: 150.00,
                minMinutes: 106,
                maxMinutes: 150
            },
            // Additional service codes
            'GRT-ADD25': {
                code: 'GRT-ADD25',
                name: 'Additional Design Time',
                description: 'Additional design time beyond included revisions',
                amount: 25.00,
                isAdditional: true
            },
            'GRT-ADD50': {
                code: 'GRT-ADD50',
                name: 'Extended Design Work',
                description: 'Extended design work for major changes',
                amount: 50.00,
                isAdditional: true
            },
            'GRT-REV3': {
                code: 'GRT-REV3',
                name: 'Excessive Revisions',
                description: 'Additional charge for 3+ revision rounds',
                amount: 50.00,
                isAdditional: true
            },
            'GRT-REDO': {
                code: 'GRT-REDO',
                name: 'Complete Design Redo',
                description: 'Complete redesign from scratch',
                amount: 75.00,
                isAdditional: true
            }
        };
        
        // Rush service multiplier
        this.rushMultiplier = 1.25; // 25% upcharge
    }
    
    // Generate invoice ID using ID_Design format: ART-{ID_Design}
    generateInvoiceID(idDesign) {
        if (!idDesign) {
            throw new Error('ID_Design is required to generate invoice ID');
        }
        return `ART-${idDesign}`;
    }
    
    generateSessionID() {
        return `art_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Check if invoice already exists for ID_Design
    async checkExistingInvoice(idDesign) {
        try {
            const invoiceID = `ART-${idDesign}`;
            const invoices = await this.getInvoices({ invoiceID: invoiceID });
            
            // Filter out voided invoices
            const activeInvoices = invoices.filter(inv => 
                inv.Status !== 'Voided' && 
                inv.Status !== 'Cancelled' &&
                !inv.IsDeleted
            );
            
            return activeInvoices.length > 0 ? activeInvoices[0] : null;
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error checking existing invoice:', error);
            return null;
        }
    }
    
    formatDateForCaspio(date) {
        if (!date) return null;
        const d = new Date(date);
        return d.toISOString().replace(/\.\d{3}Z$/, '');
    }
    
    // Build notes field with service items data
    buildNotesWithServiceItems(invoiceData) {
        let notes = invoiceData.notes || '';
        
        // Add service items data if available
        if (invoiceData.serviceItems) {
            let serviceItemsText = '';
            
            // Check if serviceItems is a string (JSON) or array
            let items = invoiceData.serviceItems;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch (e) {
                    console.warn('Failed to parse serviceItems JSON:', e);
                    items = [];
                }
            }
            
            // Format service items as readable text
            if (Array.isArray(items) && items.length > 0) {
                serviceItemsText = '--- Service Items ---\n';
                items.forEach((item, index) => {
                    serviceItemsText += `${index + 1}. ${item.code || 'UNKNOWN'}: ${item.description || 'No description'}\n`;
                    serviceItemsText += `   Quantity: ${item.quantity || 1}, Rate: $${(item.rate || 0).toFixed(2)}, Amount: $${(item.amount || 0).toFixed(2)}\n`;
                });
                
                if (invoiceData.serviceSummary) {
                    serviceItemsText += `\nSummary: ${invoiceData.serviceSummary}`;
                }
            }
            
            notes += (notes ? '\n\n' : '') + serviceItemsText;
        }
        
        return notes;
    }
    
    // ========== ART REQUESTS API METHODS ==========
    
    // Fetch art requests from API
    async getArtRequests(filters = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            // Add filters
            if (filters.pk_id) queryParams.append('pk_id', filters.pk_id);
            if (filters.id_design) queryParams.append('id_design', filters.id_design);
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.companyName) queryParams.append('companyName', filters.companyName);
            if (filters.customerServiceRep) queryParams.append('customerServiceRep', filters.customerServiceRep);
            if (filters.salesRep) queryParams.append('salesRep', filters.salesRep);
            if (filters.invoiced !== undefined) queryParams.append('invoiced', filters.invoiced);
            if (filters.limit) queryParams.append('limit', filters.limit);
            if (filters.pageNumber) queryParams.append('pageNumber', filters.pageNumber);
            if (filters.pageSize) queryParams.append('pageSize', filters.pageSize);
            
            const url = `${this.baseURL}/api/artrequests?${queryParams}`;
            console.log('[ArtInvoiceServiceV2] Fetching art requests:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch art requests: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[ArtInvoiceServiceV2] Fetched art requests:', data.length);
            return data;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error fetching art requests:', error);
            return [];
        }
    }
    
    // Get single art request
    async getArtRequest(id) {
        try {
            const response = await fetch(`${this.baseURL}/api/artrequests/${id}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch art request: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error fetching art request:', error);
            return null;
        }
    }
    
    // Update art request (e.g., mark as invoiced)
    async updateArtRequest(id, updates) {
        try {
            const response = await fetch(`${this.baseURL}/api/artrequests/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update art request: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('[ArtInvoiceServiceV2] Art request updated:', id);
            return { success: true, data: result };
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error updating art request:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Mark art request as invoiced
    async markArtRequestAsInvoiced(artRequestId, invoiceId) {
        return this.updateArtRequest(artRequestId, {
            Invoiced: true,
            Invoiced_Date: this.formatDateForCaspio(new Date()),
            Invoice_Updated_Date: this.formatDateForCaspio(new Date()),
            Note_Mockup: `Invoiced with ID: ${invoiceId}`
        });
    }
    
    // Mark art request as invoiced with service code details
    async markArtRequestAsInvoicedWithDetails(artRequestId, invoiceId, serviceCode, actualAmount, invoicedAmount) {
        const note = `Invoiced: ${serviceCode} ($${invoicedAmount.toFixed(2)}) vs Actual: $${actualAmount.toFixed(2)}`;
        return this.updateArtRequest(artRequestId, {
            Invoiced: true,
            Invoiced_Date: this.formatDateForCaspio(new Date()),
            Invoice_Updated_Date: this.formatDateForCaspio(new Date()),
            Note_Mockup: note
        });
    }
    
    // Suggest service code based on time spent
    suggestServiceCode(minutes) {
        // For standard services, find the appropriate tier
        for (const [code, service] of Object.entries(this.serviceCodes)) {
            if (!service.isAdditional && 
                minutes >= service.minMinutes && 
                minutes <= service.maxMinutes) {
                return code;
            }
        }
        
        // If over 150 minutes, return custom
        if (minutes > 150) {
            return 'CUSTOM';
        }
        
        // Default to GRT-25 for very small jobs
        return 'GRT-25';
    }
    
    // Get service code with rush if applicable
    getServiceCodeWithRush(baseCode, isRush) {
        if (!isRush || !baseCode || baseCode === 'CUSTOM') {
            return baseCode;
        }
        return `${baseCode}-R`;
    }
    
    // Calculate rush price
    calculateRushPrice(baseAmount) {
        return baseAmount * this.rushMultiplier;
    }
    
    // Get all available service codes
    getAllServiceCodes(includeRush = true) {
        const codes = [];
        
        // Add standard and additional codes
        Object.values(this.serviceCodes).forEach(service => {
            codes.push(service);
            
            // Add rush versions for non-additional services
            if (includeRush && !service.isAdditional) {
                codes.push({
                    ...service,
                    code: `${service.code}-R`,
                    name: `RUSH ${service.name}`,
                    description: `${service.description} (Rush Service - 25% upcharge)`,
                    amount: this.calculateRushPrice(service.amount),
                    isRush: true
                });
            }
        });
        
        return codes;
    }
    
    // Get service details by code
    getServiceByCode(code) {
        // Check if it's a rush code
        if (code.endsWith('-R')) {
            const baseCode = code.substring(0, code.length - 2);
            const baseService = this.serviceCodes[baseCode];
            if (baseService) {
                return {
                    ...baseService,
                    code: code,
                    name: `RUSH ${baseService.name}`,
                    description: `${baseService.description} (Rush Service - 25% upcharge)`,
                    amount: this.calculateRushPrice(baseService.amount),
                    isRush: true
                };
            }
        }
        
        return this.serviceCodes[code] || null;
    }
    
    // ========== ART INVOICES API METHODS ==========
    
    // Create new invoice using dedicated API
    async createInvoice(invoiceData) {
        try {
            // Require ID_Design
            if (!invoiceData.idDesign) {
                throw new Error('ID_Design is required to create an invoice');
            }
            
            // Check for existing invoice
            const existingInvoice = await this.checkExistingInvoice(invoiceData.idDesign);
            if (existingInvoice) {
                throw new Error(`Invoice already exists for Design #${invoiceData.idDesign} (${existingInvoice.InvoiceID}). Please void the existing invoice first.`);
            }
            
            const invoiceID = this.generateInvoiceID(invoiceData.idDesign);
            const sessionID = this.generateSessionID();
            
            // Calculate dates
            const invoiceDate = new Date();
            const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            
            // Calculate amounts - now supporting both service codes and hourly billing
            const timeSpent = parseFloat(invoiceData.timeSpent || 0);
            const hourlyRate = parseFloat(invoiceData.hourlyRate || this.hourlyRate);
            
            // If subtotalAmount is provided (from service codes), use it directly
            const subtotal = invoiceData.subtotalAmount !== undefined ? 
                parseFloat(invoiceData.subtotalAmount) : 
                parseFloat((timeSpent * hourlyRate).toFixed(2));
            
            const rushFee = parseFloat(invoiceData.rushFee || 0);
            const revisionFee = parseFloat(invoiceData.revisionFee || 0);
            const otherFees = parseFloat(invoiceData.otherFees || 0);
            const totalAmount = subtotal + rushFee + revisionFee + otherFees;
            const taxAmount = parseFloat(invoiceData.taxAmount || 0);
            const grandTotal = totalAmount + taxAmount;
            
            const invoice = {
                InvoiceID: invoiceID,
                ArtRequestID: invoiceData.idDesign || '',  // Store ID_Design here
                SessionID: sessionID,
                InvoiceDate: this.formatDateForCaspio(invoiceDate),
                DueDate: this.formatDateForCaspio(dueDate),
                Status: invoiceData.status || 'Draft',
                
                // Artist information
                ArtistName: invoiceData.artistName || 'Steve Deland',
                ArtistEmail: invoiceData.artistEmail || 'art@nwcustomapparel.com',
                
                // Sales rep information
                SalesRepName: invoiceData.salesRepName || '',
                SalesRepEmail: invoiceData.salesRepEmail || 'sales@nwcustomapparel.com',
                
                // Customer information
                CustomerName: invoiceData.customerName || '',
                CustomerCompany: invoiceData.customerCompany || '',
                CustomerEmail: invoiceData.customerEmail || '',
                
                // Project information
                ProjectName: invoiceData.projectName || '',
                ProjectType: invoiceData.projectType || 'Design',
                OriginalRequestDate: invoiceData.originalRequestDate ? this.formatDateForCaspio(new Date(invoiceData.originalRequestDate)) : null,
                CompletionDate: invoiceData.completionDate ? this.formatDateForCaspio(new Date(invoiceData.completionDate)) : this.formatDateForCaspio(new Date()),
                
                // Time and amounts
                TimeSpent: timeSpent,
                HourlyRate: hourlyRate,
                SubtotalAmount: subtotal,
                RushFee: rushFee,
                RevisionFee: revisionFee,
                OtherFees: otherFees,
                TotalAmount: totalAmount,
                TaxAmount: taxAmount,
                GrandTotal: grandTotal,
                BalanceDue: grandTotal,
                
                // Additional details
                Notes: this.buildNotesWithServiceItems(invoiceData),
                CustomerNotes: invoiceData.customerNotes || '',
                ArtworkDescription: invoiceData.artworkDescription || '',
                FileReferences: invoiceData.fileReferences || '',
                Complexity: invoiceData.complexity || 'Standard',
                Priority: invoiceData.priority || 'Normal',
                CCEmails: invoiceData.ccEmails || 'erik@nwcustomapparel.com',
                
                // Store service items data in Notes field (JSON format)
                // ServiceItems and ServiceSummary fields might not exist in Caspio
                // So we'll store this info in the Notes field instead
                
                // System fields
                CreatedBy: invoiceData.createdBy || 'Steve',
                CreatedAt: this.formatDateForCaspio(new Date()),
                IsDeleted: false,
                Invoiced: false
            };
            
            console.log('[ArtInvoiceServiceV2] Creating invoice:', invoice);
            
            const response = await fetch(`${this.baseURL}/api/art-invoices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(invoice)
            });
            
            const responseText = await response.text();
            console.log('[ArtInvoiceServiceV2] Create response:', response.status, responseText);
            
            if (!response.ok) {
                throw new Error(`Failed to create invoice: ${responseText}`);
            }
            
            // Update the art request to mark it as invoiced
            if (invoiceData.idDesign) {
                console.log(`[ArtInvoiceServiceV2] Looking for art request with ID_Design: ${invoiceData.idDesign}`);
                
                // First need to find the PK_ID for this ID_Design
                const artRequests = await this.getArtRequests({ 
                    id_design: invoiceData.idDesign,
                    limit: 1 
                });
                
                console.log(`[ArtInvoiceServiceV2] Found ${artRequests.length} art requests`);
                
                if (artRequests.length > 0) {
                    const artRequest = artRequests[0];
                    console.log(`[ArtInvoiceServiceV2] Updating art request PK_ID: ${artRequest.PK_ID} with invoice: ${invoiceID}`);
                    
                    const updateResult = await this.markArtRequestAsInvoiced(artRequest.PK_ID, invoiceID);
                    
                    if (updateResult.success) {
                        console.log(`[ArtInvoiceServiceV2] Successfully marked art request as invoiced`);
                    } else {
                        console.error(`[ArtInvoiceServiceV2] Failed to mark art request as invoiced:`, updateResult.error);
                    }
                } else {
                    console.warn(`[ArtInvoiceServiceV2] Art request with ID_Design ${invoiceData.idDesign} not found`);
                }
            }
            
            return {
                success: true,
                invoiceID: invoiceID,
                data: invoice
            };
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error creating invoice:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Get invoices with filters
    async getInvoices(filters = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            // Add filters
            if (filters.invoiceID) queryParams.append('invoiceID', filters.invoiceID);
            if (filters.artRequestID) queryParams.append('artRequestID', filters.artRequestID);
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.artistEmail) queryParams.append('artistEmail', filters.artistEmail);
            if (filters.customerEmail) queryParams.append('customerEmail', filters.customerEmail);
            if (filters.limit) queryParams.append('limit', filters.limit);
            
            const response = await fetch(`${this.baseURL}/api/art-invoices?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch invoices: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error fetching invoices:', error);
            return [];
        }
    }
    
    // Get single invoice by PK_ID or InvoiceID
    async getInvoice(id) {
        try {
            // First try as PK_ID
            if (!isNaN(id)) {
                const response = await fetch(`${this.baseURL}/api/art-invoices/${id}`);
                
                if (response.ok) {
                    const data = await response.json();
                    return data;
                }
            }
            
            // If not found or not numeric, try as InvoiceID
            const invoices = await this.getInvoices({ invoiceID: id });
            return invoices.length > 0 ? invoices[0] : null;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error fetching invoice:', error);
            return null;
        }
    }
    
    // Get invoice by ID_Design
    async getInvoiceByDesign(idDesign) {
        try {
            const invoiceID = `ART-${idDesign}`;
            const invoices = await this.getInvoices({ invoiceID: invoiceID });
            
            // Return only non-voided invoice
            const activeInvoice = invoices.find(inv => 
                inv.Status !== 'Voided' && 
                inv.Status !== 'Cancelled' &&
                !inv.IsDeleted
            );
            
            return activeInvoice || null;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error fetching invoice by design:', error);
            return null;
        }
    }
    
    // Update invoice
    async updateInvoice(id, updates) {
        try {
            // Add update timestamp
            updates.UpdatedAt = this.formatDateForCaspio(new Date());
            
            const response = await fetch(`${this.baseURL}/api/art-invoices/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update invoice: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('[ArtInvoiceServiceV2] Invoice updated:', id);
            return { success: true, data: result };
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error updating invoice:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Void invoice (better than delete for audit trail)
    async voidInvoice(id, voidedBy = 'System', reason = '') {
        try {
            const invoice = await this.getInvoice(id);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            const updates = {
                Status: 'Voided',
                IsDeleted: true,
                DeletedDate: this.formatDateForCaspio(new Date()),
                DeletedBy: voidedBy,
                Notes: `Voided by ${voidedBy} on ${new Date().toLocaleDateString()}. Reason: ${reason || 'Not specified'}`
            };
            
            const result = await this.updateInvoice(id, updates);
            
            // Update the art request to mark it as not invoiced
            if (result.success && invoice.ArtRequestID) {
                const artRequests = await this.getArtRequests({ 
                    id_design: invoice.ArtRequestID,
                    limit: 1 
                });
                
                if (artRequests.length > 0) {
                    await this.updateArtRequest(artRequests[0].PK_ID, {
                        Invoiced: false,
                        Invoice_Updated_Date: this.formatDateForCaspio(new Date()),
                        NOTES: `Invoice ${invoice.InvoiceID} was voided`
                    });
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error voiding invoice:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Delete invoice (soft delete) - kept for compatibility
    async deleteInvoice(id, deletedBy = 'System') {
        return this.voidInvoice(id, deletedBy, 'Deleted');
    }
    
    // Mark invoice as sent
    async markInvoiceAsSent(id, sentTo) {
        try {
            console.log(`[ArtInvoiceServiceV2] Marking invoice ${id} as sent to ${sentTo}`);
            
            // If ID is the invoice ID (like ART-52503), we need to find the PK_ID
            if (isNaN(id) && id.startsWith('ART-')) {
                const invoices = await this.getInvoices({ invoiceID: id });
                if (invoices.length > 0) {
                    id = invoices[0].PK_ID;
                    console.log(`[ArtInvoiceServiceV2] Found PK_ID ${id} for invoice`);
                } else {
                    throw new Error(`Invoice ${id} not found`);
                }
            }
            
            const updates = {
                Status: 'Sent',
                EmailSentDate: this.formatDateForCaspio(new Date()),
                EmailSentTo: sentTo
            };
            
            return this.updateInvoice(id, updates);
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error marking invoice as sent:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Record payment
    async recordPayment(id, paymentData) {
        try {
            const invoice = await this.getInvoice(id);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            const paymentAmount = parseFloat(paymentData.amount || 0);
            const grandTotal = parseFloat(invoice.GrandTotal || 0);
            const previousPayments = parseFloat(invoice.PaymentAmount || 0);
            const totalPaid = previousPayments + paymentAmount;
            const newBalance = grandTotal - totalPaid;
            
            const updates = {
                PaymentMethod: paymentData.method || 'External',
                PaymentReference: paymentData.reference || '',
                PaymentDate: this.formatDateForCaspio(new Date()),
                PaymentAmount: totalPaid,
                BalanceDue: newBalance,
                Status: newBalance <= 0 ? 'Paid' : 'Partial',
                ModifiedBy: paymentData.modifiedBy || 'System'
            };
            
            return this.updateInvoice(id, updates);
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error recording payment:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Quick mark as paid - for Bradley's use
    async quickMarkPaid(id, modifiedBy = 'Bradley') {
        try {
            const invoice = await this.getInvoice(id);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            const grandTotal = parseFloat(invoice.GrandTotal || 0);
            
            const updates = {
                Status: 'Paid',
                PaymentDate: this.formatDateForCaspio(new Date()),
                PaymentAmount: grandTotal,
                BalanceDue: 0,
                PaymentMethod: 'External',
                ModifiedBy: modifiedBy,
                UpdatedAt: this.formatDateForCaspio(new Date())
            };
            
            return this.updateInvoice(id, updates);
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error marking as paid:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Mark multiple invoices as paid
    async markMultiplePaid(ids, modifiedBy = 'Bradley') {
        const results = {
            success: [],
            failed: []
        };
        
        for (const id of ids) {
            const result = await this.quickMarkPaid(id, modifiedBy);
            if (result.success) {
                results.success.push(id);
            } else {
                results.failed.push({ id, error: result.error });
            }
        }
        
        return results;
    }
    
    // Undo payment (with restrictions)
    async undoPayment(id, modifiedBy = 'Bradley') {
        try {
            const invoice = await this.getInvoice(id);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            // Check if payment was made today
            if (invoice.PaymentDate) {
                const paymentDate = new Date(invoice.PaymentDate);
                const today = new Date();
                const daysDiff = Math.floor((today - paymentDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff > 0) {
                    throw new Error('Cannot undo payment made more than 24 hours ago');
                }
            }
            
            const updates = {
                Status: 'Sent',
                PaymentDate: null,
                PaymentAmount: 0,
                BalanceDue: parseFloat(invoice.GrandTotal || 0),
                PaymentMethod: null,
                ModifiedBy: modifiedBy,
                UpdatedAt: this.formatDateForCaspio(new Date()),
                Notes: `Payment undone by ${modifiedBy} on ${new Date().toLocaleDateString()}`
            };
            
            return this.updateInvoice(id, updates);
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error undoing payment:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Send reminder
    async sendReminder(id) {
        try {
            const invoice = await this.getInvoice(id);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            const reminderCount = (invoice.ReminderCount || 0) + 1;
            
            const updates = {
                ReminderCount: reminderCount,
                LastReminderDate: this.formatDateForCaspio(new Date())
            };
            
            return this.updateInvoice(id, updates);
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error sending reminder:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Check and update overdue invoices
    async updateOverdueStatuses() {
        try {
            const sentInvoices = await this.getInvoices({ status: 'Sent' });
            const now = new Date();
            let updatedCount = 0;
            
            for (const invoice of sentInvoices) {
                if (invoice.DueDate) {
                    const dueDate = new Date(invoice.DueDate);
                    if (dueDate < now && invoice.BalanceDue > 0) {
                        await this.updateInvoice(invoice.PK_ID, { Status: 'Overdue' });
                        updatedCount++;
                    }
                }
            }
            
            console.log(`[ArtInvoiceServiceV2] Updated ${updatedCount} invoices to overdue status`);
            return { success: true, count: updatedCount };
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error updating overdue statuses:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Get invoice statistics
    async getInvoiceStats(filters = {}) {
        try {
            const invoices = await this.getInvoices(filters);
            
            const stats = {
                total: invoices.length,
                draft: 0,
                sent: 0,
                paid: 0,
                partial: 0,
                overdue: 0,
                totalAmount: 0,
                totalPaid: 0,
                totalDue: 0
            };
            
            invoices.forEach(invoice => {
                // Count by status
                switch (invoice.Status?.toLowerCase()) {
                    case 'draft': stats.draft++; break;
                    case 'sent': stats.sent++; break;
                    case 'paid': stats.paid++; break;
                    case 'partial': stats.partial++; break;
                    case 'overdue': stats.overdue++; break;
                }
                
                // Calculate amounts
                stats.totalAmount += parseFloat(invoice.GrandTotal || 0);
                stats.totalPaid += parseFloat(invoice.PaymentAmount || 0);
                stats.totalDue += parseFloat(invoice.BalanceDue || 0);
            });
            
            return stats;
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error getting invoice stats:', error);
            return null;
        }
    }
    
    // Enhanced search with multiple options
    async searchInvoices(searchOptions = {}) {
        try {
            const filters = {};
            
            // Handle simple string search (backward compatibility)
            if (typeof searchOptions === 'string') {
                const searchTerm = searchOptions.toLowerCase();
                const allInvoices = await this.getInvoices({ limit: 1000 });
                
                return allInvoices.filter(invoice => {
                    return invoice.InvoiceID?.toLowerCase().includes(searchTerm) ||
                           invoice.ArtRequestID?.includes(searchTerm) ||
                           invoice.CustomerName?.toLowerCase().includes(searchTerm) ||
                           invoice.CustomerCompany?.toLowerCase().includes(searchTerm) ||
                           invoice.ProjectName?.toLowerCase().includes(searchTerm);
                });
            }
            
            // Advanced search with filters
            const {
                idDesign,
                customerName,
                companyName,
                status,
                dateFrom,
                dateTo,
                unpaidOnly
            } = searchOptions;
            
            // Get invoices with base filters
            if (status) filters.status = status;
            const invoices = await this.getInvoices({ ...filters, limit: 1000 });
            
            // Apply additional filters
            return invoices.filter(invoice => {
                // ID_Design filter
                if (idDesign && !invoice.ArtRequestID?.includes(idDesign)) return false;
                
                // Customer name filter
                if (customerName && !invoice.CustomerName?.toLowerCase().includes(customerName.toLowerCase())) return false;
                
                // Company name filter
                if (companyName && !invoice.CustomerCompany?.toLowerCase().includes(companyName.toLowerCase())) return false;
                
                // Date range filter
                if (dateFrom || dateTo) {
                    const invoiceDate = new Date(invoice.InvoiceDate);
                    if (dateFrom && invoiceDate < new Date(dateFrom)) return false;
                    if (dateTo && invoiceDate > new Date(dateTo)) return false;
                }
                
                // Unpaid only filter
                if (unpaidOnly && (invoice.Status === 'Paid' || invoice.BalanceDue <= 0)) return false;
                
                return true;
            });
            
        } catch (error) {
            console.error('[ArtInvoiceServiceV2] Error searching invoices:', error);
            return [];
        }
    }
    
    // Get unpaid invoices for a specific customer
    async getUnpaidInvoicesByCustomer(customerName) {
        return this.searchInvoices({
            customerName: customerName,
            unpaidOnly: true
        });
    }
}

// Make available globally
window.ArtInvoiceServiceV2 = ArtInvoiceServiceV2;