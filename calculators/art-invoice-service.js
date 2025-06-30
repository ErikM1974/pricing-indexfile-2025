// Art Invoice Service - Database integration for art invoicing system
class ArtInvoiceService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.hourlyRate = 75.00; // Default hourly rate
    }
    
    // Generate unique invoice ID with format: ART[MMDD]-[sequence]
    generateInvoiceID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `art_invoice_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `ART${dateKey}-${sequence}`;
    }
    
    generateSessionID() {
        return `art_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    cleanupOldSequences(currentDateKey) {
        // Remove sequences older than 7 days
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('art_invoice_sequence_') && !key.includes(currentDateKey)) {
                const dateStr = key.replace('art_invoice_sequence_', '');
                if (dateStr.length === 4) {
                    const keyMonth = parseInt(dateStr.substr(0, 2));
                    const keyDay = parseInt(dateStr.substr(2, 2));
                    const keyDate = new Date(new Date().getFullYear(), keyMonth - 1, keyDay);
                    const daysDiff = Math.floor((new Date() - keyDate) / (1000 * 60 * 60 * 24));
                    if (daysDiff > 7) {
                        sessionStorage.removeItem(key);
                    }
                }
            }
        });
    }
    
    // Fetch art requests from Caspio
    async getArtRequests(filters = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (filters.requestID) queryParams.append('requestID', filters.requestID);
            if (filters.salesRep) queryParams.append('salesRep', filters.salesRep);
            if (filters.status) queryParams.append('status', filters.status);
            
            const response = await fetch(`${this.baseURL}/api/artrequests?${queryParams}`);
            const data = await response.json();
            
            console.log('[ArtInvoiceService] Fetched art requests:', data.length);
            return data;
        } catch (error) {
            console.error('[ArtInvoiceService] Error fetching art requests:', error);
            return [];
        }
    }
    
    // Create new invoice
    async createInvoice(invoiceData) {
        try {
            const invoiceID = this.generateInvoiceID();
            const sessionID = this.generateSessionID();
            
            // Calculate dates
            const invoiceDate = new Date();
            const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            
            // Calculate amounts
            const subtotal = parseFloat((invoiceData.timeSpent * (invoiceData.hourlyRate || this.hourlyRate)).toFixed(2));
            const rushFee = parseFloat(invoiceData.rushFee || 0);
            const revisionFee = parseFloat(invoiceData.revisionFee || 0);
            const otherFees = parseFloat(invoiceData.otherFees || 0);
            const totalAmount = subtotal + rushFee + revisionFee + otherFees;
            const taxAmount = parseFloat(invoiceData.taxAmount || 0);
            const grandTotal = totalAmount + taxAmount;
            
            const invoice = {
                InvoiceID: invoiceID,
                ArtRequestID: invoiceData.artRequestID,
                SessionID: sessionID,
                InvoiceDate: this.formatDateForCaspio(invoiceDate),
                DueDate: this.formatDateForCaspio(dueDate),
                Status: 'Draft',
                ArtistName: invoiceData.artistName || 'Steve',
                ArtistEmail: invoiceData.artistEmail || 'art@nwcustomapparel.com',
                SalesRepName: invoiceData.salesRepName,
                SalesRepEmail: invoiceData.salesRepEmail,
                CustomerName: invoiceData.customerName,
                CustomerCompany: invoiceData.customerCompany || '',
                CustomerEmail: invoiceData.customerEmail || '',
                ProjectName: invoiceData.projectName,
                ProjectType: invoiceData.projectType,
                OriginalRequestDate: invoiceData.originalRequestDate ? this.formatDateForCaspio(new Date(invoiceData.originalRequestDate)) : '',
                CompletionDate: invoiceData.completionDate ? this.formatDateForCaspio(new Date(invoiceData.completionDate)) : '',
                TimeSpent: parseFloat(invoiceData.timeSpent),
                HourlyRate: parseFloat(invoiceData.hourlyRate || this.hourlyRate),
                SubtotalAmount: subtotal,
                RushFee: rushFee,
                RevisionFee: revisionFee,
                OtherFees: otherFees,
                TotalAmount: totalAmount,
                TaxAmount: taxAmount,
                GrandTotal: grandTotal,
                BalanceDue: grandTotal,
                Notes: invoiceData.notes || '',
                CustomerNotes: invoiceData.customerNotes || '',
                ArtworkDescription: invoiceData.artworkDescription || '',
                FileReferences: invoiceData.fileReferences || '',
                Complexity: invoiceData.complexity || 'Standard',
                Priority: invoiceData.priority || 'Normal',
                CCEmails: invoiceData.ccEmails || 'bradley@nwcustomapparel.com',
                CreatedBy: invoiceData.createdBy || 'Steve',
                IsDeleted: 'No'
            };
            
            // Create quote session for the art invoice
            const sessionData = {
                QuoteID: invoiceID,
                SessionID: sessionID,
                CustomerEmail: invoiceData.SalesRepEmail, // Send to sales rep
                CustomerName: invoiceData.SalesRepName,
                CompanyName: 'Northwest Custom Apparel - Art Department',
                Phone: invoiceData.CustomerCompany ? invoiceData.CustomerCompany : '',
                TotalQuantity: 1,
                SubtotalAmount: subtotal,
                LTMFeeTotal: 0,
                TotalAmount: grandTotal,
                Status: 'Open',
                ExpiresAt: this.formatDateForCaspio(dueDate),
                Notes: `Art Invoice for ${invoiceData.CustomerName} - ${invoiceData.ProjectName}`
            };
            
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });
            
            const sessionText = await sessionResponse.text();
            console.log('[ArtInvoiceService] Session response:', sessionResponse.status, sessionText);
            
            if (!sessionResponse.ok) {
                throw new Error(`Session creation failed: ${sessionText}`);
            }
            
            // Create quote item for the art work
            const itemData = {
                QuoteID: invoiceID,
                LineNumber: 1,
                StyleNumber: 'ART-SERVICE',
                ProductName: `Art Services - ${invoiceData.ProjectType}`,
                Color: '',
                ColorCode: '',
                EmbellishmentType: 'art',
                PrintLocation: invoiceData.ProjectName,
                PrintLocationName: invoiceData.ArtworkDescription || 'Custom Artwork',
                Quantity: 1,
                HasLTM: 'No',
                BaseUnitPrice: subtotal,
                LTMPerUnit: 0,
                FinalUnitPrice: grandTotal,
                LineTotal: grandTotal,
                SizeBreakdown: JSON.stringify({
                    hours: invoiceData.TimeSpent,
                    rate: invoiceData.HourlyRate,
                    rushFee: rushFee,
                    revisionFee: revisionFee,
                    otherFees: otherFees,
                    artRequestID: invoiceData.ArtRequestID,
                    complexity: invoiceData.Complexity
                }),
                PricingTier: invoiceData.Complexity || 'Standard',
                ImageURL: '',
                AddedAt: this.formatDateForCaspio(new Date())
            };
            
            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
            
            const itemText = await itemResponse.text();
            console.log('[ArtInvoiceService] Item response:', itemResponse.status, itemText);
            
            if (!itemResponse.ok) {
                console.error('Item creation failed but continuing...');
            }
            
            return {
                success: true,
                invoiceID: invoiceID,
                data: invoice
            };
            
        } catch (error) {
            console.error('[ArtInvoiceService] Error creating invoice:', error);
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
            // Art invoices have IDs starting with ART
            queryParams.append('quoteID', 'ART');
            if (filters.status) queryParams.append('status', filters.status);
            
            const response = await fetch(`${this.baseURL}/api/quote_sessions?${queryParams}`);
            const data = await response.json();
            
            // Filter to only get art invoices (those starting with ART)
            const artInvoices = data.filter(quote => quote.QuoteID && quote.QuoteID.startsWith('ART'));
            
            return artInvoices;
        } catch (error) {
            console.error('[ArtInvoiceService] Error fetching invoices:', error);
            return [];
        }
    }
    
    // Get single invoice
    async getInvoice(invoiceID) {
        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${invoiceID}`);
            const data = await response.json();
            
            if (data.length > 0) {
                // Get the quote items for details
                const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${invoiceID}`);
                const items = await itemsResponse.json();
                
                const invoice = data[0];
                invoice.items = items;
                
                // Extract art-specific data from SizeBreakdown if available
                if (items.length > 0 && items[0].SizeBreakdown) {
                    try {
                        const breakdown = JSON.parse(items[0].SizeBreakdown);
                        invoice.TimeSpent = breakdown.hours || 0;
                        invoice.HourlyRate = breakdown.rate || 75;
                        invoice.RushFee = breakdown.rushFee || 0;
                        invoice.RevisionFee = breakdown.revisionFee || 0;
                        invoice.OtherFees = breakdown.otherFees || 0;
                    } catch (e) {
                        console.log('Error parsing size breakdown:', e);
                    }
                }
                
                return invoice;
            }
            return null;
        } catch (error) {
            console.error('[ArtInvoiceService] Error fetching invoice:', error);
            return null;
        }
    }
    
    // Update invoice
    async updateInvoice(invoiceID, updates) {
        try {
            // Get the session first
            const sessions = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${invoiceID}`);
            const sessionData = await sessions.json();
            
            if (sessionData.length === 0) {
                throw new Error('Invoice not found');
            }
            
            const sessionPK = sessionData[0].PK_ID;
            
            // Update the session
            const response = await fetch(`${this.baseURL}/api/quote_sessions/${sessionPK}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Update failed: ${errorText}`);
            }
            
            console.log('[ArtInvoiceService] Invoice updated:', invoiceID);
            return { success: true };
            
        } catch (error) {
            console.error('[ArtInvoiceService] Error updating invoice:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Mark invoice as sent
    async markInvoiceAsSent(invoiceID, sentTo) {
        return this.updateInvoice(invoiceID, {
            Status: 'Sent',
            EmailSentDate: this.formatDateForCaspio(new Date()),
            EmailSentTo: sentTo
        });
    }
    
    // Record payment
    async recordPayment(invoiceID, paymentData) {
        try {
            const invoice = await this.getInvoice(invoiceID);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            const paymentAmount = parseFloat(paymentData.amount);
            const grandTotal = parseFloat(invoice.GrandTotal);
            const newBalance = grandTotal - paymentAmount;
            
            const updates = {
                PaymentMethod: paymentData.method,
                PaymentReference: paymentData.reference || '',
                PaymentDate: this.formatDateForCaspio(new Date()),
                PaymentAmount: paymentAmount,
                BalanceDue: newBalance,
                Status: newBalance <= 0 ? 'Paid' : 'Partial'
            };
            
            return this.updateInvoice(invoiceID, updates);
            
        } catch (error) {
            console.error('[ArtInvoiceService] Error recording payment:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Send reminder
    async sendReminder(invoiceID) {
        try {
            const invoice = await this.getInvoice(invoiceID);
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            
            const reminderCount = (invoice.ReminderCount || 0) + 1;
            
            return this.updateInvoice(invoiceID, {
                ReminderCount: reminderCount,
                LastReminderDate: this.formatDateForCaspio(new Date())
            });
            
        } catch (error) {
            console.error('[ArtInvoiceService] Error sending reminder:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Check and update overdue invoices
    async updateOverdueStatuses() {
        try {
            const openInvoices = await this.getInvoices({ status: 'Sent' });
            const now = new Date();
            let updatedCount = 0;
            
            for (const invoice of openInvoices) {
                const dueDate = new Date(invoice.DueDate);
                if (dueDate < now && invoice.BalanceDue > 0) {
                    await this.updateInvoice(invoice.InvoiceID, { Status: 'Overdue' });
                    updatedCount++;
                }
            }
            
            console.log(`[ArtInvoiceService] Updated ${updatedCount} invoices to overdue status`);
            return { success: true, count: updatedCount };
            
        } catch (error) {
            console.error('[ArtInvoiceService] Error updating overdue statuses:', error);
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
                overdue: 0,
                partial: 0,
                totalAmount: 0,
                totalPaid: 0,
                totalDue: 0
            };
            
            invoices.forEach(invoice => {
                stats[invoice.Status.toLowerCase()]++;
                stats.totalAmount += parseFloat(invoice.GrandTotal || 0);
                stats.totalPaid += parseFloat(invoice.PaymentAmount || 0);
                stats.totalDue += parseFloat(invoice.BalanceDue || 0);
            });
            
            return stats;
            
        } catch (error) {
            console.error('[ArtInvoiceService] Error calculating stats:', error);
            return null;
        }
    }
    
    // Soft delete invoice
    async deleteInvoice(invoiceID, deletedBy = 'System') {
        return this.updateInvoice(invoiceID, {
            IsDeleted: 'Yes',
            DeletedDate: this.formatDateForCaspio(new Date()),
            DeletedBy: deletedBy
        });
    }
    
    // Format date for Caspio (remove milliseconds)
    formatDateForCaspio(date) {
        return date.toISOString().replace(/\.\d{3}Z$/, '');
    }
    
    // Get pricing tier for quantity (if needed for bulk art orders)
    getPricingTier(hours) {
        if (hours <= 2) return 'Basic';
        if (hours <= 5) return 'Standard';
        if (hours <= 10) return 'Complex';
        return 'Enterprise';
    }
}

// Export for use in calculators
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArtInvoiceService;
}