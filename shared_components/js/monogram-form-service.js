/**
 * Monogram Form Service
 * Handles API calls for order lookup, saving, and searching monogram forms
 */

class MonogramFormService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.prefix = 'MONO';
        this.storagePrefix = 'monogram';
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
            console.log('[MonogramService] Looking up order:', orderNumber);

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

            console.log('[MonogramService] Order found:', order.CustomerName);
            console.log('[MonogramService] Products found:', products.length);

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
        // Debug: Log raw line items from API
        console.log('[MonogramService] Raw line items from API:', lineItems);
        console.log('[MonogramService] First item fields:', lineItems[0] ? Object.keys(lineItems[0]) : 'No items');

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
                // Debug: Log each item being parsed
                console.log('[MonogramService] Parsing line item:', item);
                console.log('[MonogramService] PartColor:', item.PartColor, '| PartDescription:', item.PartDescription, '| LineQuantity:', item.LineQuantity);

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
                            console.log(`[MonogramService] Size from PartNumber suffix: ${partNumber} → ${size06Label}`);
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
    // Monogram Session CRUD
    // ============================================

    /**
     * Save monogram session to database
     * NOTE: Requires Caspio tables and API endpoints to be set up
     */
    async saveMonogramSession(sessionData, items) {
        try {
            const monogramID = sessionData.monogramID || this.generateMonogramID();
            const sessionID = this.generateSessionID();

            console.log('[MonogramService] Saving monogram session:', monogramID);

            // Format dates without milliseconds (Caspio requirement)
            const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');

            // Prepare session data
            const payload = {
                MonogramID: monogramID,
                SessionID: sessionID,
                OrderNumber: sessionData.orderNumber,
                CompanyName: sessionData.companyName,
                SalesRepEmail: sessionData.salesRepEmail || '',
                FontStyle: sessionData.fontStyle || '',
                ThreadColor: sessionData.threadColor || '',
                NotesToProduction: sessionData.notesToProduction || '',
                TotalNames: items.filter(i => i.monogramName && i.monogramName.trim()).length,
                Status: sessionData.status || 'Active',
                CreatedAt: now,
                CreatedBy: sessionData.createdBy || ''
            };

            // Try to save to API (will fail gracefully if endpoint doesn't exist)
            try {
                const response = await fetch(`${this.baseURL}/api/monogram_sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    // Save items
                    await this.saveMonogramItems(monogramID, items);
                    console.log('[MonogramService] Session saved to database');
                } else {
                    console.warn('[MonogramService] API endpoint not available, saving to localStorage only');
                }
            } catch (apiError) {
                console.warn('[MonogramService] API not available:', apiError.message);
            }

            // Always save to localStorage as backup
            this.saveToLocalStorage(monogramID, { session: payload, items });

            return {
                success: true,
                monogramID: monogramID,
                sessionID: sessionID
            };

        } catch (error) {
            console.error('[MonogramService] Save error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save monogram items in bulk
     */
    async saveMonogramItems(monogramID, items) {
        const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');

        // Filter out empty rows
        const validItems = items.filter(item =>
            item.monogramName && item.monogramName.trim()
        );

        // Prepare items for bulk save
        const itemsPayload = validItems.map((item, index) => ({
            MonogramID: monogramID,
            LineNumber: index + 1,
            StyleNumber: item.styleNumber || '',
            PartNumber: item.partNumber || item.styleNumber || '',
            Description: item.description || '',
            ShirtColor: item.shirtColor || '',
            CatalogColor: item.catalogColor || '',
            Size: item.size || '',
            MonogramName: item.monogramName,
            Note: item.note || '',
            IsCustomSize: item.isCustomSize || false,
            IsCustomStyle: item.isCustomStyle || false,
            AddedAt: now
        }));

        try {
            const response = await fetch(`${this.baseURL}/api/monogram_items/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monogramId: monogramID, items: itemsPayload })
            });

            if (response.ok) {
                console.log('[MonogramService] Items saved:', validItems.length);
            }
        } catch (error) {
            console.warn('[MonogramService] Bulk save not available, items saved to localStorage');
        }
    }

    /**
     * Search for existing monogram sessions
     */
    async searchMonogramSessions(criteria) {
        try {
            const params = new URLSearchParams();
            if (criteria.orderNumber) params.append('orderNumber', criteria.orderNumber);
            if (criteria.companyName) params.append('companyName', criteria.companyName);

            // Try API first
            try {
                const response = await fetch(`${this.baseURL}/api/monogram_sessions?${params}`);
                if (response.ok) {
                    const data = await response.json();
                    return { success: true, sessions: data.result || [] };
                }
            } catch (apiError) {
                console.warn('[MonogramService] API search not available');
            }

            // Fall back to localStorage search
            const localSessions = this.searchLocalStorage(criteria);
            return { success: true, sessions: localSessions, source: 'localStorage' };

        } catch (error) {
            console.error('[MonogramService] Search error:', error);
            return { success: false, error: error.message, sessions: [] };
        }
    }

    /**
     * Load a specific monogram session
     */
    async loadMonogramSession(monogramID) {
        try {
            // Try API first
            try {
                const response = await fetch(`${this.baseURL}/api/monogram_sessions/${monogramID}`);
                if (response.ok) {
                    const sessionData = await response.json();

                    // Load items
                    const itemsResponse = await fetch(`${this.baseURL}/api/monogram_items?monogramId=${monogramID}`);
                    const itemsData = await itemsResponse.json();

                    return {
                        success: true,
                        session: sessionData.result,
                        items: itemsData.result || []
                    };
                }
            } catch (apiError) {
                console.warn('[MonogramService] API load not available');
            }

            // Fall back to localStorage
            const localData = this.loadFromLocalStorage(monogramID);
            if (localData) {
                return { success: true, ...localData, source: 'localStorage' };
            }

            return { success: false, error: 'Session not found' };

        } catch (error) {
            console.error('[MonogramService] Load error:', error);
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
