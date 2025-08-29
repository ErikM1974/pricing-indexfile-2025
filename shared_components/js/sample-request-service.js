/**
 * Sample Request Service
 * Handles database integration for free sample requests
 * Uses existing quote API infrastructure with "Sample Request" status
 */

class SampleRequestService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.quotePrefix = 'SR'; // Sample Request prefix
        this.emailjsPublicKey = '4qSbDO-SQs19TbP80';
        this.emailjsServiceId = 'service_1c4k67j';
        this.emailjsTemplateId = 'template_sample_request'; // Will need to be created
        
        // Initialize EmailJS if available
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.emailjsPublicKey);
        }
    }

    /**
     * Generate unique Sample Request ID
     */
    generateSampleRequestID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `sample_request_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `${this.quotePrefix}${dateKey}-${sequence}`;
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `sample_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old sequence counters
     */
    cleanupOldSequences(currentDateKey) {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('sample_request_sequence_') && !key.includes(currentDateKey)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }

    /**
     * Check for recent sample requests from the same email
     */
    async checkDuplicateRequest(email) {
        try {
            // Check for sample requests in the last 30 days
            const response = await fetch(
                `${this.baseURL}/api/quote_sessions?customerEmail=${encodeURIComponent(email)}&status=Sample Request`
            );
            
            if (!response.ok) {
                console.error('Failed to check duplicate requests');
                return false; // Allow request on error
            }
            
            const data = await response.json();
            
            // Filter for recent requests (30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentRequests = data.filter(request => {
                const createdDate = new Date(request.CreatedAt);
                return createdDate > thirtyDaysAgo;
            });
            
            return recentRequests.length > 0;
            
        } catch (error) {
            console.error('Error checking duplicates:', error);
            return false; // Allow request on error
        }
    }

    /**
     * Save sample request to database
     */
    async saveSampleRequest(formData, samples) {
        try {
            const quoteID = this.generateSampleRequestID();
            const sessionID = this.generateSessionID();
            
            // Format expiration date (7 days for fulfillment)
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, '');
            
            // Build notes field with project information
            const notes = [
                `Project Type: ${formData.projectType || 'Not specified'}`,
                `Quantity Needed: ${formData.estimatedQuantity || 'Not specified'}`,
                `Timeline: ${formData.timeline || 'Not specified'}`,
                formData.notes || ''
            ].filter(n => n).join('\n');
            
            // Create session record
            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: formData.email,
                CustomerName: formData.name,
                CompanyName: formData.company || '',
                Phone: formData.phone || '',
                TotalQuantity: samples.length,
                SubtotalAmount: 0, // Free samples
                LTMFeeTotal: 0,
                TotalAmount: 0,
                Status: 'Sample Request', // Special status for sample requests
                ExpiresAt: expiresAt,
                Notes: notes
            };
            
            console.log('Saving sample request session:', sessionData);
            
            // Save session
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });
            
            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                throw new Error(`Failed to save session: ${errorText}`);
            }
            
            // Add sample items
            const itemPromises = samples.map(async (sample, index) => {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: index + 1,
                    StyleNumber: sample.style,
                    ProductName: sample.name || sample.description,
                    Color: sample.selectedColor || 'Customer Choice',
                    ColorCode: '',
                    EmbellishmentType: 'sample',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: 1,
                    HasLTM: 'No',
                    BaseUnitPrice: 0,
                    LTMPerUnit: 0,
                    FinalUnitPrice: 0,
                    LineTotal: 0,
                    SizeBreakdown: JSON.stringify({ size: sample.selectedSize || 'L' }),
                    PricingTier: 'Sample',
                    ImageURL: sample.imageUrl || '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };
                
                const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });
                
                if (!itemResponse.ok) {
                    console.error('Failed to save item:', await itemResponse.text());
                    // Continue even if individual item fails
                }
                
                return itemResponse.ok;
            });
            
            await Promise.all(itemPromises);
            
            // Send confirmation emails
            await this.sendConfirmationEmails(quoteID, formData, samples);
            
            return {
                success: true,
                requestID: quoteID
            };
            
        } catch (error) {
            console.error('Error saving sample request:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send confirmation emails
     */
    async sendConfirmationEmails(requestID, formData, samples) {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS not loaded, skipping email notifications');
            return;
        }
        
        try {
            // Build samples list HTML
            const samplesHTML = samples.map(s => `
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>${s.name}</strong><br>
                    Style: ${s.style}<br>
                    ${s.selectedColor ? `Color: ${s.selectedColor}<br>` : ''}
                    ${s.selectedSize ? `Size: ${s.selectedSize}` : ''}
                </div>
            `).join('');
            
            // Email data for template
            const emailData = {
                // System
                to_email: formData.email,
                from_name: 'Northwest Custom Apparel',
                reply_to: formData.salesRep || 'sales@nwcustomapparel.com',
                
                // Request info
                sample_request_id: requestID,
                request_date: new Date().toLocaleDateString(),
                
                // Customer
                customer_name: formData.name,
                customer_email: formData.email,
                customer_phone: formData.phone || 'Not provided',
                company_name: formData.company || 'Not provided',
                
                // Project details
                project_type: formData.projectType || 'Not specified',
                estimated_quantity: formData.estimatedQuantity || 'Not specified',
                timeline: formData.timeline || 'Not specified',
                notes: formData.notes || 'No additional notes',
                
                // Samples
                sample_count: samples.length,
                samples_list: samples.map(s => s.name).join(', '),
                samples_html: samplesHTML,
                
                // Company
                company_year: '1977',
                sales_rep_phone: '253-922-5793'
            };
            
            // Send customer confirmation
            await emailjs.send(
                this.emailjsServiceId,
                this.emailjsTemplateId,
                emailData
            );
            
            console.log('Confirmation email sent for request:', requestID);
            
        } catch (error) {
            console.error('Error sending email:', error);
            // Don't fail the request if email fails
        }
    }

    /**
     * Get all sample requests for dashboard
     */
    async getSampleRequests(filters = {}) {
        try {
            const params = new URLSearchParams();
            params.append('status', 'Sample Request');
            
            // Add any additional filters
            if (filters.dateFrom) {
                params.append('dateFrom', filters.dateFrom);
            }
            if (filters.dateTo) {
                params.append('dateTo', filters.dateTo);
            }
            
            const response = await fetch(`${this.baseURL}/api/quote_sessions?${params}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch sample requests');
            }
            
            const data = await response.json();
            
            // Sort by date, newest first
            return data.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
            
        } catch (error) {
            console.error('Error fetching sample requests:', error);
            return [];
        }
    }

    /**
     * Get sample request items
     */
    async getSampleRequestItems(requestID) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/quote_items?quoteID=${encodeURIComponent(requestID)}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch items');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error fetching items:', error);
            return [];
        }
    }

    /**
     * Update sample request status
     */
    async updateRequestStatus(requestID, newStatus, notes = '') {
        try {
            const updateData = {
                Status: newStatus
            };
            
            if (notes) {
                // Append notes to existing
                const existing = await this.getSampleRequest(requestID);
                updateData.Notes = existing.Notes + '\n\n' + new Date().toLocaleString() + ': ' + notes;
            }
            
            const response = await fetch(`${this.baseURL}/api/quote_sessions/${requestID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to update status');
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('Error updating status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get single sample request
     */
    async getSampleRequest(requestID) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/quote_sessions?quoteID=${encodeURIComponent(requestID)}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch request');
            }
            
            const data = await response.json();
            return data[0] || null;
            
        } catch (error) {
            console.error('Error fetching request:', error);
            return null;
        }
    }

    /**
     * Convert sample request to quote
     */
    async convertToQuote(requestID) {
        try {
            // Get the sample request details
            const request = await this.getSampleRequest(requestID);
            const items = await this.getSampleRequestItems(requestID);
            
            if (!request) {
                throw new Error('Sample request not found');
            }
            
            // Update status to indicate conversion
            await this.updateRequestStatus(requestID, 'Converted to Quote', 'Converted to sales opportunity');
            
            return {
                success: true,
                customerData: {
                    name: request.CustomerName,
                    email: request.CustomerEmail,
                    phone: request.Phone,
                    company: request.CompanyName
                },
                items: items.map(item => ({
                    style: item.StyleNumber,
                    name: item.ProductName,
                    color: item.Color
                }))
            };
            
        } catch (error) {
            console.error('Error converting to quote:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SampleRequestService;
}