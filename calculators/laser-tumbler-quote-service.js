/**
 * Laser Tumbler Quote Service
 * Handles saving quotes to Caspio database
 */

class LaserTumblerQuoteService {
    constructor() {
        this.apiUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.caspioToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get Caspio authentication token
     */
    async getCaspioToken() {
        // Check if we have a valid token
        if (this.caspioToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.caspioToken;
        }

        try {
            console.log('[LaserTumblerQuoteService] Fetching new Caspio token...');
            
            const response = await fetch(`${this.apiUrl}/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Token fetch failed: ${response.status}`);
            }

            const data = await response.json();
            this.caspioToken = data.access_token;
            // Token expires in 86400 seconds (24 hours), but we'll refresh after 23 hours
            this.tokenExpiry = new Date(Date.now() + (23 * 60 * 60 * 1000));
            
            console.log('[LaserTumblerQuoteService] Token obtained successfully');
            return this.caspioToken;
        } catch (error) {
            console.error('[LaserTumblerQuoteService] Failed to get token:', error);
            throw error;
        }
    }

    /**
     * Generate quote ID
     */
    generateQuoteId() {
        const date = new Date();
        const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
        const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        return `LT${dateStr}-${randomNum}`;
    }

    /**
     * Save quote to database
     */
    async saveQuote(quoteData) {
        try {
            console.log('[LaserTumblerQuoteService] Saving quote...', quoteData);
            
            // Get authentication token
            const token = await this.getCaspioToken();
            
            // Generate quote ID
            const quoteId = this.generateQuoteId();
            
            // Prepare data for Caspio
            const caspioData = {
                Quote_ID: quoteId,
                Quote_Date: new Date().toISOString(),
                Customer_Name: quoteData.customerName || '',
                Customer_Email: quoteData.customerEmail || '',
                Customer_Phone: quoteData.customerPhone || '',
                Company_Name: quoteData.companyName || '',
                Project_Name: quoteData.projectName || 'Polar Camel Tumbler Quote',
                Product_Type: 'Laser Tumbler',
                Product_Details: `Polar Camel 16 oz. Pint - ${quoteData.quantity} units`,
                Quantity: quoteData.quantity,
                Unit_Price: quoteData.unitPrice,
                Subtotal: quoteData.subtotal,
                Setup_Fee: quoteData.setupFee,
                Second_Logo: quoteData.hasSecondLogo ? 'Yes' : 'No',
                Second_Logo_Total: quoteData.secondLogoTotal || 0,
                Total_Price: quoteData.total,
                Sales_Rep_Name: quoteData.salesRepName || '',
                Sales_Rep_Email: quoteData.salesRepEmail || '',
                Notes: quoteData.hasSecondLogo ? 
                    `Includes second logo (+$${quoteData.secondLogoTotal.toFixed(2)})` : 
                    'Single logo engraving',
                Status: 'Sent'
            };

            // Save to Caspio
            const response = await fetch(`${this.apiUrl}/tables/laser_tumbler_quotes/records`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(caspioData)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Failed to save quote: ${response.status} - ${errorData}`);
            }

            console.log('[LaserTumblerQuoteService] Quote saved successfully:', quoteId);
            
            return {
                success: true,
                quoteID: quoteId,
                message: 'Quote saved successfully'
            };

        } catch (error) {
            console.error('[LaserTumblerQuoteService] Error saving quote:', error);
            
            // Return error but don't throw - allow email to still be sent
            return {
                success: false,
                error: error.message,
                message: 'Quote could not be saved to database, but email will still be sent'
            };
        }
    }

    /**
     * Update quote status
     */
    async updateQuoteStatus(quoteId, status) {
        try {
            const token = await this.getCaspioToken();
            
            const response = await fetch(`${this.apiUrl}/tables/laser_tumbler_quotes/records?q=Quote_ID=${quoteId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Status: status,
                    Last_Updated: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update quote status: ${response.status}`);
            }

            console.log('[LaserTumblerQuoteService] Quote status updated:', quoteId, status);
            return { success: true };

        } catch (error) {
            console.error('[LaserTumblerQuoteService] Error updating quote status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search quotes
     */
    async searchQuotes(searchTerm) {
        try {
            const token = await this.getCaspioToken();
            
            const response = await fetch(
                `${this.apiUrl}/tables/laser_tumbler_quotes/records?q=Customer_Name~${searchTerm}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[LaserTumblerQuoteService] Search results:', data.Result.length);
            
            return {
                success: true,
                quotes: data.Result || []
            };

        } catch (error) {
            console.error('[LaserTumblerQuoteService] Search error:', error);
            return {
                success: false,
                error: error.message,
                quotes: []
            };
        }
    }
}

// Make available globally
window.LaserTumblerQuoteService = LaserTumblerQuoteService;