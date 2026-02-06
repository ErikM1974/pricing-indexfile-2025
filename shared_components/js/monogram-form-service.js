/**
 * Monogram Form Service
 * Handles API calls for order lookup, saving, and searching monogram forms
 */

class MonogramFormService {
    constructor() {
        // Use centralized config (CLAUDE.md Rule #7)
        this.baseURL = this.getApiBaseUrl();
        this.prefix = 'MONO';
        this.storagePrefix = 'monogram';
    }

    /**
     * Get API base URL from config or fallback
     */
    getApiBaseUrl() {
        if (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) {
            return window.APP_CONFIG.API.BASE_URL;
        }
        console.warn('[MonogramService] APP_CONFIG not loaded, using fallback URL');
        return 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    // ============================================
    // ID Generation
    // ============================================

    /**
     * Generate unique monogram ID
     * Format: MONO{MMDD}-{sequence}
     */
    generateMonogramID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;

        // Get or initialize daily sequence from sessionStorage
        const storageKey = `${this.storagePrefix}_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());

        // Clean up old date keys
        this.cleanupOldSequences(dateKey);

        return `${this.prefix}${dateKey}-${sequence}`;
    }

    /**
     * Generate session ID
     */
    generateSessionID() {
        return `mono_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old sequence keys
     */
    cleanupOldSequences(currentDateKey) {
        const keys = Object.keys(sessionStorage);
        const prefix = `${this.storagePrefix}_sequence_`;

        keys.forEach(key => {
            if (key.startsWith(prefix) && !key.endsWith(currentDateKey)) {
                sessionStorage.removeItem(key);
            }
        });
    }

    // ============================================
    // Utility - Sales Rep Email Generation
    // ============================================

    /**
     * Generate sales rep email from CustomerServiceRep name
     * "Nika Lao" → "nika@nwcustomapparel.com"
     */
    generateSalesRepEmail(repName) {
        if (!repName || !repName.trim()) return '';
        const firstName = repName.trim().split(' ')[0].toLowerCase();
        return `${firstName}@nwcustomapparel.com`;
    }

    // ============================================
    // ManageOrders API - Order Lookup
    // ============================================

    /**
     * Look up order from ShopWorks by order number
     * Returns order header and line items
     */
    async lookupOrder(orderNumber) {
        try {
            // Fetch order header and line items in parallel
            const [orderResponse, lineItemsResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/manageorders/orders/${orderNumber}`),
                fetch(`${this.baseURL}/api/manageorders/lineitems/${orderNumber}`)
            ]);

            // Check order response
            if (!orderResponse.ok) {
                if (orderResponse.status === 404) {
                    return { success: false, error: 'Order not found in ShopWorks' };
                }
                throw new Error(`Order lookup failed: ${orderResponse.status}`);
            }

            // Check line items response (CLAUDE.md Rule #4: No silent API failures)
            if (!lineItemsResponse.ok) {
                console.error('[MonogramService] Line items API failed:', lineItemsResponse.status);
                throw new Error(`Failed to fetch line items: ${lineItemsResponse.status}`);
            }

            const orderData = await orderResponse.json();
            const lineItemsData = await lineItemsResponse.json();

            // Validate order data exists
            if (!orderData.result || orderData.result.length === 0) {
                return { success: false, error: 'Order not found in ShopWorks' };
            }

            // Validate line items response format
            if (!lineItemsData.result || !Array.isArray(lineItemsData.result)) {
                console.error('[MonogramService] Invalid line items response format:', lineItemsData);
                throw new Error('Invalid line items response format');
            }

            const order = orderData.result[0];

            // Validate required order fields (API returns id_Order, not order_no)
            if (!order.id_Order || !order.CustomerName) {
                console.error('[MonogramService] Order data missing required fields:', order);
                throw new Error('Order data missing required fields (id_Order or CustomerName)');
            }

            const lineItems = lineItemsData.result;

            // Parse line items into usable format
            const products = this.parseLineItems(lineItems);

            return {
                success: true,
                order: {
                    orderNumber: order.id_Order,
                    extOrderId: order.ext_order_id,
                    companyName: order.CustomerName,
                    salesRepEmail: this.generateSalesRepEmail(order.CustomerServiceRep),
                    contactName: order.ContactName,
                    contactEmail: order.ContactEmail,
                    contactPhone: order.ContactPhone,
                    dateOrdered: order.date_Ordered,
                    dateDue: order.date_Due,
                    status: order.Status
                },
                products: products
            };

        } catch (error) {
            console.error('[MonogramService] Order lookup error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse line items from ManageOrders into products with sizes
     */
    parseLineItems(lineItems) {
        // CORRECTED Size slot mapping (Size01-Size05 only, Size06 is catch-all)
        // ShopWorks: S, M, L, XL, XXL, then catch-all
        const SIZE_SLOT_MAP = {
            Size01: 'S',
            Size02: 'M',
            Size03: 'L',
            Size04: 'XL',
            Size05: '2XL'
            // Size06 is handled separately as catch-all (3XL, OSFA, LT, etc.)
        };

        // Known size suffixes for PartNumber detection (for Size06 catch-all)
        const SIZE_SUFFIXES = [
            'XS', 'S', 'M', 'L', 'XL',
            '2XL', '2X', 'XXL',
            '3XL', '3X', 'XXXL',
            '4XL', '4X', '5XL', '5X', '6XL', '6X',
            'LT', 'XLT', '2XLT', '3XLT', '4XLT',
            'OSFA', 'OS', 'ADJ'
        ];

        return lineItems
            .filter(item => {
                // Filter out non-garment items (those with no size quantities)
                const hasQuantity = ['Size01', 'Size02', 'Size03', 'Size04', 'Size05', 'Size06']
                    .some(slot => (item[slot] || 0) > 0);
                return hasQuantity;
            })
            .map(item => {
                const sizes = [];

                // Parse Size01-Size05 with fixed mapping
                for (const [slot, label] of Object.entries(SIZE_SLOT_MAP)) {
                    const qty = item[slot] || 0;
                    if (qty > 0) {
                        sizes.push({ label, qty, slot });
                    }
                }

                // Handle Size06 (catch-all) - extract actual size from PartNumber suffix
                const size06Qty = item.Size06 || 0;
                if (size06Qty > 0) {
                    const partNumber = item.PartNumber || '';
                    const lastUnderscoreIdx = partNumber.lastIndexOf('_');
                    let size06Label = '3XL';  // Default if no suffix found

                    if (lastUnderscoreIdx > 0) {
                        const suffix = partNumber.substring(lastUnderscoreIdx + 1).toUpperCase();
                        if (SIZE_SUFFIXES.includes(suffix)) {
                            size06Label = suffix;
                        }
                    }

                    sizes.push({ label: size06Label, qty: size06Qty, slot: 'Size06' });
                }

                return {
                    lineNo: item.line_no,
                    partNumber: item.PartNumber,
                    description: item.PartDescription,
                    color: item.PartColor,
                    totalQuantity: item.LineQuantity,
                    sizes: sizes
                };
            });
    }

    // ============================================
    // Monogram Session CRUD (Using /api/monograms)
    // ============================================

    /**
     * Save monogram session to database
     * Uses single-table approach with ItemsJSON
     * API supports upsert: POST with existing OrderNumber updates instead of error
     */
    async saveMonogramSession(sessionData, items) {
        try {
            // Filter out empty rows and prepare items for JSON storage
            const validItems = items.filter(item =>
                item.monogramName && item.monogramName.trim()
            ).map((item, index) => ({
                lineNumber: index + 1,
                styleNumber: item.styleNumber || '',
                description: item.description || '',
                shirtColor: item.shirtColor || '',
                size: item.size || '',
                rowThreadColor: item.rowThreadColor || '',
                rowLocation: item.rowLocation || '',
                monogramName: item.monogramName,
                isCustomStyle: item.isCustomStyle || false
            }));

            // Format dates for Caspio
            const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');

            // Prepare payload matching Caspio table schema
            const payload = {
                OrderNumber: parseInt(sessionData.orderNumber),
                CompanyName: sessionData.companyName || '',
                SalesRepEmail: sessionData.salesRepEmail || '',
                FontStyle: sessionData.fontStyle || '',
                ThreadColors: sessionData.threadColor || '',
                Locations: sessionData.location || '',
                ImportedNames: sessionData.importedNames || '',
                NotesToProduction: sessionData.notesToProduction || '',
                ItemsJSON: JSON.stringify(validItems),
                TotalItems: validItems.length,
                Status: sessionData.status || 'Submitted',
                CreatedAt: now,
                CreatedBy: sessionData.createdBy || '',
                ModifiedAt: now
            };

            // Save to API (upsert - creates or updates based on OrderNumber)
            const response = await fetch(`${this.baseURL}/api/monograms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                // Also save to localStorage as backup
                this.saveToLocalStorage(sessionData.orderNumber, { session: payload, items: validItems });

                return {
                    success: true,
                    monogramID: result.monogram?.ID_Monogram,
                    orderNumber: sessionData.orderNumber
                };
            } else {
                console.error('[MonogramService] API error:', result.error);
                throw new Error(result.error || 'Failed to save');
            }

        } catch (error) {
            console.error('[MonogramService] Save error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search for existing monogram sessions
     * CLAUDE.md Rule #4: Never silently fall back to cached data without notifying user
     */
    async searchMonogramSessions(criteria) {
        try {
            const params = new URLSearchParams();
            if (criteria.orderNumber) params.append('orderNumber', criteria.orderNumber);
            if (criteria.companyName) params.append('companyName', criteria.companyName);
            if (criteria.status) params.append('status', criteria.status);
            if (criteria.dateFrom) params.append('dateFrom', criteria.dateFrom);
            if (criteria.dateTo) params.append('dateTo', criteria.dateTo);

            const response = await fetch(`${this.baseURL}/api/monograms?${params}`);
            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    sessions: data.monograms || [],
                    count: data.count || 0,
                    source: 'database'
                };
            } else {
                throw new Error(data.error || 'Search failed');
            }

        } catch (error) {
            console.error('[MonogramService] Search error:', error);
            // Fall back to localStorage search but WARN user (CLAUDE.md Rule #4)
            const localSessions = this.searchLocalStorage(criteria);
            return {
                success: true,
                sessions: localSessions,
                source: 'localStorage',
                warning: 'Unable to search database. Showing local cache only - results may be incomplete.',
                apiError: error.message
            };
        }
    }

    /**
     * Load a specific monogram session by order number
     * CLAUDE.md Rule #4: Never silently fall back to cached data without notifying user
     */
    async loadMonogramSession(orderNumber) {
        try {
            const response = await fetch(`${this.baseURL}/api/monograms/${orderNumber}`);
            const data = await response.json();

            if (data.success && data.monogram) {
                const monogram = data.monogram;

                // Parse ItemsJSON back to array
                let items = [];
                try {
                    items = JSON.parse(monogram.ItemsJSON || '[]');
                } catch (e) {
                    console.warn('[MonogramService] Failed to parse ItemsJSON:', e);
                }

                return {
                    success: true,
                    session: {
                        orderNumber: monogram.OrderNumber,
                        companyName: monogram.CompanyName,
                        salesRepEmail: monogram.SalesRepEmail,
                        fontStyle: monogram.FontStyle,
                        threadColor: monogram.ThreadColors,
                        location: monogram.Locations,
                        importedNames: monogram.ImportedNames,
                        notesToProduction: monogram.NotesToProduction,
                        status: monogram.Status,
                        createdAt: monogram.CreatedAt,
                        createdBy: monogram.CreatedBy,
                        id_monogram: monogram.ID_Monogram
                    },
                    items: items,
                    source: 'database'
                };
            } else {
                // Not found in database - check localStorage but mark as cached
                const localData = this.loadFromLocalStorage(orderNumber);
                if (localData) {
                    console.warn('[MonogramService] Session not in database, using localStorage cache');
                    return {
                        success: true,
                        ...localData,
                        source: 'localStorage',
                        warning: 'Loaded from local cache - data may be outdated. Session not found in database.'
                    };
                }
                return { success: false, error: 'Session not found' };
            }

        } catch (error) {
            console.error('[MonogramService] Load error:', error);
            // API failed - try localStorage but ALWAYS inform user (CLAUDE.md Rule #4)
            const localData = this.loadFromLocalStorage(orderNumber);
            if (localData) {
                console.warn('[MonogramService] API failed, using localStorage cache');
                return {
                    success: true,
                    ...localData,
                    source: 'localStorage',
                    warning: 'Unable to connect to server. Showing cached data which may be outdated.',
                    apiError: error.message
                };
            }
            return { success: false, error: `Failed to load: ${error.message}` };
        }
    }

    /**
     * Update monogram status (e.g., mark as Printed)
     */
    async updateMonogramStatus(idMonogram, status) {
        try {
            const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            const payload = {
                Status: status,
                ModifiedAt: now
            };

            // Add PrintedAt if marking as printed
            if (status === 'Printed') {
                payload.PrintedAt = now;
            }

            const response = await fetch(`${this.baseURL}/api/monograms/${idMonogram}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            return { success: data.success };

        } catch (error) {
            console.error('[MonogramService] Status update error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a monogram record
     */
    async deleteMonogram(idMonogram) {
        try {
            const response = await fetch(`${this.baseURL}/api/monograms/${idMonogram}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            return { success: data.success };

        } catch (error) {
            console.error('[MonogramService] Delete error:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // LocalStorage Backup
    // ============================================

    /**
     * Save to localStorage as backup
     */
    saveToLocalStorage(monogramID, data) {
        const key = `${this.storagePrefix}_${monogramID}`;
        localStorage.setItem(key, JSON.stringify({
            ...data,
            savedAt: new Date().toISOString()
        }));

        // Update index
        this.updateLocalStorageIndex(monogramID, data.session);
    }

    /**
     * Update localStorage index for searching
     */
    updateLocalStorageIndex(monogramID, sessionData) {
        const indexKey = `${this.storagePrefix}_index`;
        let index = JSON.parse(localStorage.getItem(indexKey) || '[]');

        // Remove existing entry if present
        index = index.filter(item => item.monogramID !== monogramID);

        // Add new entry
        index.push({
            monogramID: monogramID,
            orderNumber: sessionData.OrderNumber,
            companyName: sessionData.CompanyName,
            totalNames: sessionData.TotalNames,
            status: sessionData.Status,
            createdAt: sessionData.CreatedAt
        });

        // Keep only last 100 entries
        if (index.length > 100) {
            index = index.slice(-100);
        }

        localStorage.setItem(indexKey, JSON.stringify(index));
    }

    /**
     * Search localStorage
     */
    searchLocalStorage(criteria) {
        const indexKey = `${this.storagePrefix}_index`;
        const index = JSON.parse(localStorage.getItem(indexKey) || '[]');

        return index.filter(item => {
            if (criteria.orderNumber && item.orderNumber !== criteria.orderNumber) {
                return false;
            }
            if (criteria.companyName &&
                !item.companyName.toLowerCase().includes(criteria.companyName.toLowerCase())) {
                return false;
            }
            return true;
        });
    }

    /**
     * Load from localStorage
     */
    loadFromLocalStorage(monogramID) {
        const key = `${this.storagePrefix}_${monogramID}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    // ============================================
    // Thread Colors API
    // ============================================

    /**
     * Fetch available thread colors from API
     * Returns array of in-stock thread colors
     */
    async fetchThreadColors() {
        try {
            const response = await fetch(`${this.baseURL}/api/thread-colors?instock=true`);
            if (!response.ok) {
                throw new Error(`Failed to fetch thread colors: ${response.status}`);
            }
            return await response.json(); // Returns array directly
        } catch (error) {
            console.error('[MonogramService] Thread colors fetch error:', error);
            throw error; // CLAUDE.md Rule #4: No silent API failures
        }
    }

    // ============================================
    // Utility Methods
    // ============================================

    /**
     * Get formatted current date
     */
    getCurrentDate() {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Get extended sizes list
     */
    getExtendedSizes() {
        // Standard sizes (matching ShopWorks slots) + extended sizes
        return [
            'S', 'M', 'L', 'XL', '2XL',           // Standard (Size01-Size05)
            '3XL', '4XL', '5XL', '6XL',            // Extended large
            'XS',                                  // Extra small (less common)
            'LT', 'XLT', '2XLT', '3XLT', '4XLT',  // Tall sizes
            'OSFA'                                 // One Size Fits All (caps, hats, etc.)
        ];
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.MonogramFormService = MonogramFormService;
}
