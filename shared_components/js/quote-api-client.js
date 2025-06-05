// Quote API Client
// Handles all API interactions with Caspio quote system
// For Northwest Custom Apparel - January 2025

(function() {
    'use strict';

    // API Configuration
    const API_CONFIG = {
        baseUrl: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        endpoints: {
            quoteSessions: '/quote_sessions',
            quoteItems: '/quote_items',
            quoteAnalytics: '/quote_analytics',
            customers: '/customers'
        },
        retryAttempts: 3,
        retryDelay: 1000 // ms
    };

    class QuoteAPIClient {
        constructor() {
            this.baseUrl = API_CONFIG.baseUrl;
            this.endpoints = API_CONFIG.endpoints;
        }

        // Generic request method with retry logic
        async request(endpoint, options = {}) {
            const url = `${this.baseUrl}${endpoint}`;
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            const finalOptions = { ...defaultOptions, ...options };
            
            // Add body if data is provided
            if (finalOptions.data && (finalOptions.method === 'POST' || finalOptions.method === 'PUT')) {
                finalOptions.body = JSON.stringify(finalOptions.data);
                delete finalOptions.data;
            }

            let lastError;
            for (let attempt = 1; attempt <= API_CONFIG.retryAttempts; attempt++) {
                try {
                    // Only log in debug mode
                    if (window.DEBUG_MODE) {
                        console.log(`[QUOTE-API] ${finalOptions.method || 'GET'} ${endpoint} (attempt ${attempt})`);
                    }
                    
                    const response = await fetch(url, finalOptions);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Always log response for debugging quote issues
                    console.log(`[QUOTE-API] Response:`, data);
                    
                    return data;
                    
                } catch (error) {
                    console.error(`[QUOTE-API] Error on attempt ${attempt}:`, error.message);
                    lastError = error;
                    
                    if (attempt < API_CONFIG.retryAttempts) {
                        await this.delay(API_CONFIG.retryDelay * attempt);
                    }
                }
            }
            
            throw lastError;
        }

        // Delay helper for retry logic
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Quote Session Methods
        async createQuoteSession(sessionData) {
            // Add expiration date (30 days from now)
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
            
            const response = await this.request(this.endpoints.quoteSessions, {
                method: 'POST',
                data: {
                    ...sessionData,
                    ExpiresAt: expirationDate.toISOString()
                }
            });
            
            // Handle Caspio response format
            console.log('[QUOTE-API] createQuoteSession raw response:', response);
            
            // Check if response has a data property (from server wrapper)
            if (response && response.data) {
                console.log('[QUOTE-API] Response has data property');
                if (Array.isArray(response.data) && response.data.length > 0) {
                    console.log('[QUOTE-API] Data is array, extracting first item');
                    return response.data[0];
                }
                return response.data;
            }
            
            // Check if response itself is an array
            if (Array.isArray(response) && response.length > 0) {
                console.log('[QUOTE-API] Response is array, extracting first item');
                return response[0];
            }
            
            return response;
        }

        async getQuoteSession(id) {
            return this.request(`${this.endpoints.quoteSessions}/${id}`);
        }

        async getQuoteSessionByQuoteID(quoteID) {
            const sessions = await this.request(`${this.endpoints.quoteSessions}?quoteID=${quoteID}`);
            return sessions && sessions.length > 0 ? sessions[0] : null;
        }

        async updateQuoteSession(id, updates) {
            return this.request(`${this.endpoints.quoteSessions}/${id}`, {
                method: 'PUT',
                data: updates
            });
        }

        async deleteQuoteSession(id) {
            return this.request(`${this.endpoints.quoteSessions}/${id}`, {
                method: 'DELETE'
            });
        }

        // Quote Item Methods
        async createQuoteItem(itemData) {
            const response = await this.request(this.endpoints.quoteItems, {
                method: 'POST',
                data: itemData
            });
            
            // Handle Caspio response format
            console.log('[QUOTE-API] createQuoteItem raw response:', response);
            
            // Check if response has a data property (from server wrapper)
            if (response && response.data) {
                console.log('[QUOTE-API] Response has data property');
                if (Array.isArray(response.data) && response.data.length > 0) {
                    console.log('[QUOTE-API] Data is array, extracting first item');
                    return response.data[0];
                }
                return response.data;
            }
            
            // Check if response itself is an array
            if (Array.isArray(response) && response.length > 0) {
                console.log('[QUOTE-API] Response is array, extracting first item');
                return response[0];
            }
            
            return response;
        }

        async getQuoteItems(quoteID) {
            return this.request(`${this.endpoints.quoteItems}?quoteID=${quoteID}`);
        }

        async updateQuoteItem(id, updates) {
            return this.request(`${this.endpoints.quoteItems}/${id}`, {
                method: 'PUT',
                data: updates
            });
        }

        async deleteQuoteItem(id) {
            return this.request(`${this.endpoints.quoteItems}/${id}`, {
                method: 'DELETE'
            });
        }

        // Quote Analytics Methods
        async trackEvent(eventData) {
            return this.request(this.endpoints.quoteAnalytics, {
                method: 'POST',
                data: {
                    ...eventData,
                    Timestamp: new Date().toISOString(),
                    UserAgent: navigator.userAgent
                }
            });
        }

        async getAnalyticsBySession(sessionID) {
            return this.request(`${this.endpoints.quoteAnalytics}?sessionID=${sessionID}`);
        }

        async getAnalyticsByQuote(quoteID) {
            return this.request(`${this.endpoints.quoteAnalytics}?quoteID=${quoteID}`);
        }

        // Customer Methods
        async createCustomer(customerData) {
            // Ensure we have the required fields
            const requiredData = {
                Name: customerData.Name || '',
                Email: customerData.Email || '',
                Phone: customerData.Phone || '',
                Company: customerData.Company || '',
                Address1: customerData.Address1 || '',
                Address2: customerData.Address2 || '',
                City: customerData.City || '',
                State: customerData.State || '',
                ZipCode: customerData.ZipCode || '',
                Country: customerData.Country || 'USA',
                Notes: customerData.Notes || '',
                DateCreated: customerData.DateCreated || new Date().toISOString()
            };
            
            return this.request(this.endpoints.customers, {
                method: 'POST',
                data: requiredData
            });
        }

        async getCustomer(id) {
            return this.request(`${this.endpoints.customers}/${id}`);
        }

        async getCustomerByEmail(email) {
            const customers = await this.request(`${this.endpoints.customers}?email=${encodeURIComponent(email)}`);
            return customers && customers.length > 0 ? customers[0] : null;
        }

        async updateCustomer(id, updates) {
            // Add LastUpdated timestamp
            updates.LastUpdated = new Date().toISOString();
            
            return this.request(`${this.endpoints.customers}/${id}`, {
                method: 'PUT',
                data: updates
            });
        }

        async deleteCustomer(id) {
            return this.request(`${this.endpoints.customers}/${id}`, {
                method: 'DELETE'
            });
        }

        // Get all quotes for a customer by email
        async getQuotesByCustomerEmail(email) {
            return this.request(`${this.endpoints.quoteSessions}?customerEmail=${encodeURIComponent(email)}`);
        }

        // Utility Methods
        generateQuoteID() {
            const now = new Date();
            const timestamp = now.toISOString()
                .replace(/[-:]/g, '')
                .replace('T', '')
                .substr(0, 14);
            return `Q_${timestamp}`;
        }

        generateSessionID() {
            return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        // Format data for API
        formatQuoteItemForAPI(item, quoteID, lineNumber) {
            return {
                QuoteID: quoteID,
                LineNumber: lineNumber,
                StyleNumber: item.styleNumber,
                ProductName: item.productName,
                Color: item.color,
                ColorCode: item.colorCode || item.color.toUpperCase().replace(/\s+/g, '_'),
                EmbellishmentType: item.embellishmentType,
                PrintLocation: item.printLocation || 'NA', // Not applicable for caps
                PrintLocationName: item.printLocationName || 'Cap Front',
                Quantity: item.quantity,
                HasLTM: item.hasLTM ? 'Yes' : 'No',
                BaseUnitPrice: item.baseUnitPrice,
                LTMPerUnit: item.ltmPerUnit || 0,
                FinalUnitPrice: item.finalUnitPrice,
                LineTotal: item.lineTotal,
                SizeBreakdown: JSON.stringify(item.sizeBreakdown || {}),
                PricingTier: item.pricingTier || this.determinePricingTier(item.quantity),
                ImageURL: item.imageURL || '',
                AddedAt: new Date().toISOString(),
                // Cap embroidery specific fields
                StitchCount: item.stitchCount,
                HasBackLogo: item.hasBackLogo ? 'Yes' : 'No',
                BackLogoStitchCount: item.backLogoStitchCount || 0,
                BackLogoPrice: item.backLogoPrice || 0
            };
        }

        // Determine pricing tier based on quantity
        determinePricingTier(quantity) {
            if (quantity >= 72) return '72+';
            if (quantity >= 48) return '48-71';
            if (quantity >= 24) return '24-47';
            return '1-23';
        }

        // Convert API response to local format
        convertAPIItemToLocal(apiItem) {
            return {
                id: apiItem.PK_ID,
                quoteID: apiItem.QuoteID,
                lineNumber: apiItem.LineNumber,
                styleNumber: apiItem.StyleNumber,
                productName: apiItem.ProductName,
                color: apiItem.Color,
                colorCode: apiItem.ColorCode,
                embellishmentType: apiItem.EmbellishmentType,
                printLocation: apiItem.PrintLocation,
                printLocationName: apiItem.PrintLocationName,
                quantity: apiItem.Quantity,
                hasLTM: apiItem.HasLTM === 'Yes',
                baseUnitPrice: parseFloat(apiItem.BaseUnitPrice),
                ltmPerUnit: parseFloat(apiItem.LTMPerUnit),
                finalUnitPrice: parseFloat(apiItem.FinalUnitPrice),
                lineTotal: parseFloat(apiItem.LineTotal),
                sizeBreakdown: JSON.parse(apiItem.SizeBreakdown || '{}'),
                pricingTier: apiItem.PricingTier,
                imageURL: apiItem.ImageURL,
                addedAt: apiItem.AddedAt,
                // Cap embroidery specific
                stitchCount: apiItem.StitchCount,
                hasBackLogo: apiItem.HasBackLogo === 'Yes',
                backLogoStitchCount: parseInt(apiItem.BackLogoStitchCount) || 0,
                backLogoPrice: parseFloat(apiItem.BackLogoPrice) || 0
            };
        }
    }

    // Create singleton instance
    const quoteAPIClient = new QuoteAPIClient();

    // Export to global scope
    window.QuoteAPIClient = QuoteAPIClient;
    window.quoteAPIClient = quoteAPIClient;

    // Only log in debug mode
    if (window.DEBUG_MODE) {
        console.log('[QUOTE-API] Quote API Client initialized');
    }

})();