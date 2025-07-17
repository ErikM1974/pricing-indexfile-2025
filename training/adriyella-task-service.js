/**
 * Adriyella Task Service - Enhanced Session Management
 * Handles saving and retrieving daily task data with session caching and mutex
 */
class AdriyellaTaService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.isSaving = false; // Mutex flag to prevent concurrent saves
        this.saveQueue = []; // Queue for pending saves
        this.sessionCache = new Map(); // Cache for session data
        this.initializeSessionCache();
    }

    /**
     * Initialize session cache and cleanup old entries
     */
    initializeSessionCache() {
        // Clean up old session cache entries at startup
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Remove any cached sessions that aren't from today
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('adr_session_') && !key.includes(today)) {
                sessionStorage.removeItem(key);
            }
        });
        
        // Clean up any corrupted cache entries, but preserve valid ones
        const allCacheKeys = Object.keys(sessionStorage).filter(key => key.startsWith('adr_session_'));
        
        for (const cacheKey of allCacheKeys) {
            try {
                const cachedSession = sessionStorage.getItem(cacheKey);
                if (cachedSession) {
                    const session = JSON.parse(cachedSession);
                    
                    // Extract date from cache key (adr_session_2025-07-16)
                    const dateFromKey = cacheKey.replace('adr_session_', '');
                    const [year, month, day] = dateFromKey.split('-');
                    const expectedPattern = `ADR${month.padStart(2, '0')}${day.padStart(2, '0')}`;
                    
                    // Only clear if the session is actually invalid
                    if (!session.QuoteID || !session.QuoteID.startsWith(expectedPattern)) {
                        console.log(`[AdriyellaTaService] Clearing invalid cached session: ${session.QuoteID}, expected pattern: ${expectedPattern}`);
                        sessionStorage.removeItem(cacheKey);
                    } else {
                        console.log(`[AdriyellaTaService] Preserving valid cached session: ${session.QuoteID} for date: ${dateFromKey}`);
                    }
                }
            } catch (error) {
                console.log(`[AdriyellaTaService] Clearing corrupted cache entry: ${cacheKey}`);
                sessionStorage.removeItem(cacheKey);
            }
        }
        
        // Initialize performance utilities integration
        if (typeof window !== 'undefined' && window.adriyellaPerfUtils) {
            this.perfUtils = window.adriyellaPerfUtils;
            console.log('[AdriyellaTaService] Performance utilities integrated');
        }
        
        console.log('[AdriyellaTaService] Session cache initialized');
    }

    /**
     * Get cached session for a date
     */
    getCachedSession(date) {
        const cacheKey = `adr_session_${date}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
            try {
                const session = JSON.parse(cached);
                console.log(`[AdriyellaTaService] Found cached session for ${date}:`, session.QuoteID);
                return session;
            } catch (error) {
                console.error(`[AdriyellaTaService] Error parsing cached session:`, error);
                sessionStorage.removeItem(cacheKey);
            }
        }
        
        return null;
    }

    /**
     * Cache session data
     */
    cacheSession(date, session) {
        const cacheKey = `adr_session_${date}`;
        
        // Ensure session has all required fields before caching
        const validatedSession = this.validateAndCleanSession(session);
        
        sessionStorage.setItem(cacheKey, JSON.stringify(validatedSession));
        console.log(`[AdriyellaTaService] Cached session for ${date}:`, validatedSession.QuoteID, validatedSession.PK_ID ? `(PK_ID: ${validatedSession.PK_ID})` : '(no PK_ID)');
    }

    /**
     * Validate and clean session data
     */
    validateAndCleanSession(session) {
        if (!session || !session.QuoteID) {
            console.warn('[AdriyellaTaService] Invalid session: missing QuoteID');
            return session;
        }

        // Check if session has the expected QuoteID format (ADRMMDD-X)
        const quoteIdPattern = /^ADR\d{4}-\d+$/;
        if (!quoteIdPattern.test(session.QuoteID)) {
            console.warn(`[AdriyellaTaService] Session has invalid QuoteID format: ${session.QuoteID}`);
        }

        // Log validation status
        if (session.PK_ID) {
            console.log(`[AdriyellaTaService] Session ${session.QuoteID} is valid with PK_ID: ${session.PK_ID}`);
        } else {
            console.warn(`[AdriyellaTaService] Session ${session.QuoteID} is missing PK_ID`);
        }

        return session;
    }

    /**
     * Save with mutex to prevent concurrent operations
     */
    async saveWithMutex(date, tasks) {
        // If a save is already in progress, queue this one
        if (this.isSaving) {
            console.log('[AdriyellaTaService] Save in progress, queuing request');
            return new Promise((resolve, reject) => {
                this.saveQueue.push({ date, tasks, resolve, reject });
            });
        }

        this.isSaving = true;
        console.log('[AdriyellaTaService] Starting save operation with mutex');

        try {
            const result = await this.performSave(date, tasks);
            
            // Process queued saves
            if (this.saveQueue.length > 0) {
                console.log(`[AdriyellaTaService] Processing ${this.saveQueue.length} queued saves`);
                const { date: queuedDate, tasks: queuedTasks, resolve } = this.saveQueue.shift();
                
                // For queued saves, we can just resolve with the current result
                // since they're all for the same date and the last one wins
                resolve(result);
                
                // Clear remaining queue (they're all redundant)
                this.saveQueue.forEach(({ resolve: queuedResolve }) => {
                    queuedResolve(result);
                });
                this.saveQueue = [];
            }
            
            return result;
        } catch (error) {
            // Reject any queued saves with the same error
            this.saveQueue.forEach(({ reject }) => {
                reject(error);
            });
            this.saveQueue = [];
            throw error;
        } finally {
            this.isSaving = false;
            console.log('[AdriyellaTaService] Save operation completed, mutex released');
        }
    }

    /**
     * Check for and resolve duplicate sessions before saving
     */
    async checkForDuplicateSessions(date) {
        try {
            const [year, month, day] = date.split('-');
            const datePattern = `ADR${month.padStart(2, '0')}${day.padStart(2, '0')}`;
            
            // Get all sessions for this date pattern
            const response = await fetch(`${this.baseURL}/api/quote_sessions`);
            if (!response.ok) {
                console.log(`[AdriyellaTaService] Could not check for duplicates: ${response.status}`);
                return;
            }
            
            const allSessions = await response.json();
            const duplicateSessions = allSessions.filter(session => 
                session.QuoteID && session.QuoteID.startsWith(datePattern + '-')
            );
            
            if (duplicateSessions.length > 1) {
                console.warn(`[AdriyellaTaService] Found ${duplicateSessions.length} duplicate sessions for ${date}:`, 
                           duplicateSessions.map(s => s.QuoteID));
                
                // Keep the session with the highest PK_ID (most recent) and delete others
                duplicateSessions.sort((a, b) => (b.PK_ID || 0) - (a.PK_ID || 0));
                const sessionToKeep = duplicateSessions[0];
                const sessionsToDelete = duplicateSessions.slice(1);
                
                console.log(`[AdriyellaTaService] Keeping session ${sessionToKeep.QuoteID} (PK_ID: ${sessionToKeep.PK_ID})`);
                
                for (const sessionToDelete of sessionsToDelete) {
                    try {
                        console.log(`[AdriyellaTaService] Deleting duplicate session ${sessionToDelete.QuoteID} (PK_ID: ${sessionToDelete.PK_ID})`);
                        
                        // Delete items first
                        const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${sessionToDelete.QuoteID}`);
                        if (itemsResponse.ok) {
                            const items = await itemsResponse.json();
                            for (const item of items) {
                                await fetch(`${this.baseURL}/api/quote_items/${item.PK_ID}`, {
                                    method: 'DELETE'
                                });
                            }
                        }
                        
                        // Delete session
                        await fetch(`${this.baseURL}/api/quote_sessions/${sessionToDelete.PK_ID}`, {
                            method: 'DELETE'
                        });
                        
                        console.log(`[AdriyellaTaService] Successfully deleted duplicate session ${sessionToDelete.QuoteID}`);
                    } catch (deleteError) {
                        console.error(`[AdriyellaTaService] Failed to delete duplicate session ${sessionToDelete.QuoteID}:`, deleteError);
                    }
                }
                
                // Update cache with the session we kept
                this.cacheSession(date, sessionToKeep);
                return sessionToKeep;
            }
            
            return duplicateSessions.length === 1 ? duplicateSessions[0] : null;
        } catch (error) {
            console.error('[AdriyellaTaService] Error checking for duplicate sessions:', error);
            return null;
        }
    }

    /**
     * Perform the actual save operation with retry logic
     */
    async performSave(date, tasks) {
        const totalQuantity = (tasks.thankYou || 0) + (tasks.leadSheets || 0) + 
                             (tasks.googleReviews || 0) + (tasks.artApproval || 0);
        const totalAmount = this.calculateTotal(tasks);
        
        // First, check for and resolve any duplicate sessions
        const duplicateCheckResult = await this.checkForDuplicateSessions(date);
        
        // Check cache first, then API
        let existingSession = this.getCachedSession(date);
        
        // If we found a session during duplicate checking, use that
        if (!existingSession && duplicateCheckResult) {
            existingSession = duplicateCheckResult;
            console.log(`[AdriyellaTaService] Using session found during duplicate check: ${existingSession.QuoteID}`);
        }
        
        if (!existingSession) {
            console.log('[AdriyellaTaService] No cached session, checking API');
            existingSession = await this.getExistingSessionWithRetry(date);
            
            if (existingSession) {
                // Cache the session we found
                this.cacheSession(date, existingSession);
            }
        }
        
        if (existingSession) {
            // Update existing session
            return await this.updateExistingSessionWithRetry(existingSession, tasks, totalQuantity, totalAmount);
        }
        
        // Create new session
        return await this.createNewSessionWithRetry(date, tasks, totalQuantity, totalAmount);
    }

    /**
     * Retry wrapper for API calls with exponential backoff
     */
    async retryApiCall(operation, operationName, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[AdriyellaTaService] ${operationName} - Attempt ${attempt}/${maxRetries}`);
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`[AdriyellaTaService] ${operationName} - Attempt ${attempt} failed:`, error.message);
                
                // Don't retry on client errors (4xx) - these are likely permanent
                if (error.message.includes('400') || error.message.includes('401') || 
                    error.message.includes('403') || error.message.includes('404')) {
                    console.log(`[AdriyellaTaService] ${operationName} - Client error, not retrying`);
                    break;
                }
                
                // Wait before retry with exponential backoff
                if (attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    console.log(`[AdriyellaTaService] ${operationName} - Waiting ${waitTime}ms before retry`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError.message}`);
    }

    /**
     * Get existing session with retry logic
     */
    async getExistingSessionWithRetry(date) {
        return await this.retryApiCall(
            () => this.getExistingSession(date),
            'Get Existing Session'
        );
    }

    /**
     * Create a new session with retry logic
     */
    async createNewSessionWithRetry(date, tasks, totalQuantity, totalAmount) {
        return await this.retryApiCall(
            () => this.createNewSession(date, tasks, totalQuantity, totalAmount),
            'Create New Session'
        );
    }

    /**
     * Create a new session (extracted from saveDailyTasks)
     */
    async createNewSession(date, tasks, totalQuantity, totalAmount) {
        const quoteID = this.generateQuoteID(date);
        const sessionID = `adr_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '');
        
        const sessionData = {
            QuoteID: quoteID,
            SessionID: sessionID,
            CustomerEmail: "adriyella@nwcustomapparel.com",
            CustomerName: "Adriyella",
            CompanyName: "Northwest Custom Apparel",
            Phone: "",
            TotalQuantity: totalQuantity,
            SubtotalAmount: totalAmount,
            LTMFeeTotal: 0,
            TotalAmount: totalAmount,
            Status: "Open",
            ExpiresAt: expiresAt,
            Notes: `Daily tasks for ${date} - See quote_items for task details`
        };
        
        console.log('[AdriyellaTaService] Creating new session:', sessionData);
        
        // Create quote session
        const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        
        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            console.error('[AdriyellaTaService] Session creation failed:', sessionResponse.status, errorText);
            throw new Error(`Failed to create session: ${sessionResponse.status} - ${errorText}`);
        }
        
        // Get the created session data including PK_ID
        const createdSessionText = await sessionResponse.text();
        let createdSessionData = sessionData; // fallback to original data
        
        console.log(`[AdriyellaTaService] Session creation response text:`, createdSessionText);
        
        try {
            if (createdSessionText) {
                const responseData = JSON.parse(createdSessionText);
                console.log(`[AdriyellaTaService] Parsed session creation response:`, responseData);
                
                // Handle different response formats from Caspio API
                let pkId = null;
                
                if (responseData.PK_ID) {
                    // Direct PK_ID field
                    pkId = responseData.PK_ID;
                } else if (responseData.Result && Array.isArray(responseData.Result) && responseData.Result.length > 0) {
                    // Caspio format with Result array
                    pkId = responseData.Result[0].PK_ID;
                } else if (Array.isArray(responseData) && responseData.length > 0) {
                    // Array response format
                    pkId = responseData[0].PK_ID;
                } else if (typeof responseData === 'string' && responseData.includes('records')) {
                    // Text response format - need to extract actual ID
                    console.log(`[AdriyellaTaService] Got text response, fetching by QuoteID instead`);
                    pkId = null; // Will trigger fallback fetch
                }
                
                if (pkId && pkId !== 'records') {
                    createdSessionData = { ...sessionData, PK_ID: pkId };
                    console.log(`[AdriyellaTaService] Successfully captured PK_ID from session creation: ${pkId}`);
                } else {
                    // If PK_ID not in response or invalid, try to fetch it by QuoteID
                    console.log(`[AdriyellaTaService] PK_ID not in creation response or invalid, fetching by QuoteID`);
                    try {
                        // Wait a moment for the database to be consistent
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const fetchResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${quoteID}`);
                        if (fetchResponse.ok) {
                            const sessions = await fetchResponse.json();
                            console.log(`[AdriyellaTaService] Fetch by QuoteID response:`, sessions);
                            if (sessions && sessions.length > 0) {
                                createdSessionData = { ...sessionData, PK_ID: sessions[0].PK_ID };
                                console.log(`[AdriyellaTaService] Successfully fetched PK_ID: ${sessions[0].PK_ID}`);
                            } else {
                                console.error(`[AdriyellaTaService] No sessions found when fetching by QuoteID: ${quoteID}`);
                            }
                        } else {
                            console.error(`[AdriyellaTaService] Failed to fetch by QuoteID: ${fetchResponse.status}`);
                        }
                    } catch (fetchError) {
                        console.error(`[AdriyellaTaService] Error fetching PK_ID by QuoteID: ${fetchError.message}`);
                    }
                }
            }
        } catch (parseError) {
            console.error(`[AdriyellaTaService] Could not parse session creation response: ${parseError.message}`);
            console.log(`[AdriyellaTaService] Raw response text:`, createdSessionText);
        }
        
        // Cache the session with PK_ID if available
        this.cacheSession(date, createdSessionData);
        
        // Create quote items with retry logic
        await this.createQuoteItemsWithRetry(quoteID, tasks);
        
        const taskData = {
            date: date,
            thankYouCards: tasks.thankYou || 0,
            leadSheets: tasks.leadSheets || 0,
            googleReviews: tasks.googleReviews || 0,
            artApproval: tasks.artApproval || 0,
            dailyTotal: totalAmount,
            lastUpdated: new Date().toISOString(),
            quoteID: quoteID
        };
        
        return { success: true, data: taskData };
    }

    /**
     * Recreate session using existing QuoteID and SessionID (for missing PK_ID recovery)
     */
    async recreateSessionWithSameIds(existingSession, tasks, totalQuantity, totalAmount) {
        try {
            console.log(`[AdriyellaTaService] Recreating session with existing identifiers: ${existingSession.QuoteID}`);
            
            // Use the existing session's QuoteID and SessionID
            const sessionData = {
                QuoteID: existingSession.QuoteID,
                SessionID: existingSession.SessionID || `adr_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                CustomerEmail: existingSession.CustomerEmail || 'adriyella@nwcustomapparel.com',
                CustomerName: existingSession.CustomerName || 'Adriyella',
                CompanyName: existingSession.CompanyName || 'Northwest Custom Apparel',
                Phone: existingSession.Phone || '',
                TotalQuantity: totalQuantity,
                SubtotalAmount: totalAmount,
                LTMFeeTotal: 0,
                TotalAmount: totalAmount,
                Status: 'Open',
                ExpiresAt: existingSession.ExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, ''),
                Notes: `Recreated ${new Date().toISOString().split('T')[0]} - Using quote_items for task details`
            };

            console.log('[AdriyellaTaService] Recreating session:', sessionData);
            
            // Create the session (this should give us a new PK_ID)
            const sessionResponse = await fetch(`${this.baseURL}/api/quote_sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
            
            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                console.error('[AdriyellaTaService] Session recreation failed:', sessionResponse.status, errorText);
                throw new Error(`Failed to recreate session: ${sessionResponse.status} - ${errorText}`);
            }
            
            // Get the created session data including PK_ID
            const createdSessionText = await sessionResponse.text();
            let createdSessionData = sessionData; // fallback to original data
            
            try {
                if (createdSessionText) {
                    const responseData = JSON.parse(createdSessionText);
                    if (responseData.PK_ID) {
                        createdSessionData = { ...sessionData, PK_ID: responseData.PK_ID };
                        console.log(`[AdriyellaTaService] Captured PK_ID from session recreation: ${responseData.PK_ID}`);
                    } else {
                        // If PK_ID not in response, try to fetch it by QuoteID
                        console.log(`[AdriyellaTaService] PK_ID not in recreation response, fetching by QuoteID`);
                        const fetchResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${existingSession.QuoteID}`);
                        if (fetchResponse.ok) {
                            const sessions = await fetchResponse.json();
                            if (sessions && sessions.length > 0) {
                                createdSessionData = { ...sessionData, PK_ID: sessions[0].PK_ID };
                                console.log(`[AdriyellaTaService] Fetched PK_ID after recreation: ${sessions[0].PK_ID}`);
                            }
                        }
                    }
                }
            } catch (parseError) {
                console.warn(`[AdriyellaTaService] Could not parse session recreation response: ${parseError.message}`);
            }
            
            // Cache the recreated session with PK_ID
            const date = this.extractDateFromQuoteID(existingSession.QuoteID);
            this.cacheSession(date, createdSessionData);
            
            // Create quote items with retry logic
            await this.createQuoteItemsWithRetry(existingSession.QuoteID, tasks);
            
            const taskData = {
                date: date,
                thankYouCards: tasks.thankYou || 0,
                leadSheets: tasks.leadSheets || 0,
                googleReviews: tasks.googleReviews || 0,
                artApproval: tasks.artApproval || 0,
                dailyTotal: totalAmount,
                lastUpdated: new Date().toISOString(),
                quoteID: existingSession.QuoteID
            };
            
            return { success: true, data: taskData };
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error recreating session with same IDs:', error);
            throw error;
        }
    }

    /**
     * Create quote items with retry logic
     */
    async createQuoteItemsWithRetry(quoteID, tasks) {
        return await this.retryApiCall(
            () => this.createQuoteItems(quoteID, tasks),
            'Create Quote Items'
        );
    }

    /**
     * Update existing session with retry logic
     */
    async updateExistingSessionWithRetry(session, tasks, totalQuantity, totalAmount) {
        return await this.retryApiCall(
            () => this.updateExistingSession(session, tasks, totalQuantity, totalAmount),
            'Update Existing Session'
        );
    }

    /**
     * Create quote items (extracted from saveDailyTasks)
     */
    async createQuoteItems(quoteID, tasks) {
        const items = [
            { name: 'Thank You Cards', count: tasks.thankYou || 0, rate: 2.00 },
            { name: 'Lead Sheets', count: tasks.leadSheets || 0, rate: 5.00 },
            { name: 'Google Reviews', count: tasks.googleReviews || 0, rate: 20.00 },
            { name: 'Art Approval', count: tasks.artApproval || 0, rate: 10.00 }
        ];
        
        let lineNumber = 1;
        const failedItems = [];
        
        for (const item of items) {
            if (item.count > 0) {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: lineNumber++,
                    StyleNumber: 'TASK',
                    ProductName: item.name,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'task',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: item.count,
                    HasLTM: 'No',
                    BaseUnitPrice: item.rate,
                    LTMPerUnit: 0,
                    FinalUnitPrice: item.rate,
                    LineTotal: item.count * item.rate,
                    SizeBreakdown: '{}',
                    PricingTier: 'Standard',
                    ImageURL: '',
                    AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                };
                
                console.log(`[AdriyellaTaService] Creating quote item: ${item.name} (${item.count} × $${item.rate})`);
                
                try {
                    const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData)
                    });
                    
                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error(`[AdriyellaTaService] Failed to create item ${item.name}:`, errorText);
                        failedItems.push({ item: item.name, error: errorText });
                    } else {
                        console.log(`[AdriyellaTaService] Successfully created item: ${item.name}`);
                    }
                } catch (error) {
                    console.error(`[AdriyellaTaService] Network error creating item ${item.name}:`, error);
                    failedItems.push({ item: item.name, error: error.message });
                }
            }
        }
        
        // If some items failed, log but don't throw - the session was created successfully
        if (failedItems.length > 0) {
            console.warn(`[AdriyellaTaService] ${failedItems.length} items failed to create:`, failedItems);
        }
    }

    /**
     * Generate unique quote ID for Adriyella's tasks
     * Enhanced to check for existing sessions first
     */
    generateQuoteID(date) {
        // Parse date string directly to avoid timezone issues
        const [year, month, day] = date.split('-');
        const monthStr = month.padStart(2, '0');
        const dayStr = day.padStart(2, '0');
        const dateKey = `${monthStr}${dayStr}`;
        
        // Check if we have a cached session for this date
        const cachedSession = this.getCachedSession(date);
        if (cachedSession) {
            console.log(`[AdriyellaTaService] Using cached session ID: ${cachedSession.QuoteID}`);
            return cachedSession.QuoteID;
        }
        
        // Daily sequence using sessionStorage
        const storageKey = `adr_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('adr_quote_sequence_') && !key.endsWith(dateKey)) {
                sessionStorage.removeItem(key);
            }
        });
        
        return `ADR${dateKey}-${sequence}`;
    }

    /**
     * Save or update daily tasks (main public method)
     */
    async saveDailyTasks(date, tasks) {
        console.log(`[AdriyellaTaService] saveDailyTasks called for ${date}:`, tasks);
        
        // Use mutex to prevent concurrent saves
        return await this.saveWithMutex(date, tasks);
    }

    /**
     * Check if a session exists for the given date
     * Enhanced with cache-aware logic
     */
    async getExistingSession(date) {
        try {
            // First check cache
            const cachedSession = this.getCachedSession(date);
            if (cachedSession) {
                console.log(`[AdriyellaTaService] Found cached session for ${date}: ${cachedSession.QuoteID}`);
                return cachedSession;
            }
            
            // Parse date string directly to avoid timezone issues
            const [year, month, day] = date.split('-');
            const monthStr = month.padStart(2, '0');
            const dayStr = day.padStart(2, '0');
            const datePattern = `ADR${monthStr}${dayStr}`;
            
            console.log(`[AdriyellaTaService] No cached session, checking API for ${date} with pattern: ${datePattern}`);
            
            // First try to get sessions by QuoteID filter (more efficient)
            let matchingSessions = [];
            
            try {
                // Try specific QuoteID lookup first (most efficient)
                for (let sequence = 1; sequence <= 10; sequence++) {
                    const testQuoteID = `${datePattern}-${sequence}`;
                    const specificResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${testQuoteID}`);
                    if (specificResponse.ok) {
                        const sessions = await specificResponse.json();
                        if (sessions && sessions.length > 0) {
                            matchingSessions.push(...sessions);
                            console.log(`[AdriyellaTaService] Found session via specific lookup: ${testQuoteID}`);
                        }
                    }
                }
            } catch (specificError) {
                console.warn(`[AdriyellaTaService] Specific QuoteID lookup failed: ${specificError.message}`);
            }
            
            // If no sessions found via specific lookup, fall back to general search
            if (matchingSessions.length === 0) {
                try {
                    console.log(`[AdriyellaTaService] No sessions found via specific lookup, trying general search`);
                    const response = await fetch(`${this.baseURL}/api/quote_sessions`);
                    if (!response.ok) {
                        console.log(`[AdriyellaTaService] API error checking sessions: ${response.status}`);
                        return null;
                    }
                    
                    const allSessions = await response.json();
                    console.log(`[AdriyellaTaService] Retrieved ${allSessions.length} total sessions from API for filtering`);
                    
                    // Filter sessions that match our date pattern (ADR0715-1, ADR0715-2, etc.)
                    matchingSessions = allSessions.filter(session => 
                        session.QuoteID && session.QuoteID.startsWith(datePattern + '-')
                    );
                } catch (generalError) {
                    console.error(`[AdriyellaTaService] General session lookup failed: ${generalError.message}`);
                    return null;
                }
            }
            
            console.log(`[AdriyellaTaService] Found ${matchingSessions.length} sessions with pattern ${datePattern}-X`);
            
            if (matchingSessions.length > 0) {
                // Sort by QuoteID to get the most recent one (highest sequence number)
                matchingSessions.sort((a, b) => a.QuoteID.localeCompare(b.QuoteID));
                const latestSession = matchingSessions[matchingSessions.length - 1];
                
                console.log(`[AdriyellaTaService] Using existing session: ${latestSession.QuoteID}`);
                console.log(`[AdriyellaTaService] Session details:`, {
                    QuoteID: latestSession.QuoteID,
                    PK_ID: latestSession.PK_ID,
                    Status: latestSession.Status,
                    TotalAmount: latestSession.TotalAmount
                });
                
                // Cache the session we found
                this.cacheSession(date, latestSession);
                
                return latestSession;
            } else {
                console.log(`[AdriyellaTaService] No existing session found for ${datePattern}`);
                return null;
            }
        } catch (error) {
            console.error('[AdriyellaTaService] Error checking existing session:', error);
            return null;
        }
    }

    /**
     * Update existing session with new task data
     */
    async updateExistingSession(session, tasks, totalQuantity, totalAmount) {
        try {
            // Check if session has valid PK_ID, try to recover if missing
            if (!session.PK_ID) {
                console.warn(`[AdriyellaTaService] Session ${session.QuoteID} has no PK_ID, attempting to fetch from database`);
                
                // Try to fetch the session from the database by QuoteID
                try {
                    const fetchResponse = await fetch(`${this.baseURL}/api/quote_sessions?quoteID=${session.QuoteID}`);
                    if (fetchResponse.ok) {
                        const sessions = await fetchResponse.json();
                        if (sessions && sessions.length > 0) {
                            session.PK_ID = sessions[0].PK_ID;
                            console.log(`[AdriyellaTaService] Recovered PK_ID: ${session.PK_ID} for QuoteID: ${session.QuoteID}`);
                            
                            // Update the cache with the recovered PK_ID
                            const date = this.extractDateFromQuoteID(session.QuoteID);
                            this.cacheSession(date, session);
                        } else {
                            console.warn(`[AdriyellaTaService] No sessions found for QuoteID: ${session.QuoteID}`);
                        }
                    }
                } catch (fetchError) {
                    console.error(`[AdriyellaTaService] Failed to fetch session by QuoteID: ${fetchError.message}`);
                }
                
                // If we still don't have PK_ID after recovery attempt, recreate session with same IDs
                if (!session.PK_ID) {
                    console.warn(`[AdriyellaTaService] Could not recover PK_ID for ${session.QuoteID}, recreating session with same identifiers`);
                    return await this.recreateSessionWithSameIds(session, tasks, totalQuantity, totalAmount);
                }
            }
            
            // Update session data (no longer storing JSON in Notes since we use quote_items)
            const updateData = {
                TotalQuantity: totalQuantity,
                SubtotalAmount: totalAmount,
                TotalAmount: totalAmount,
                Notes: `Updated ${new Date().toISOString().split('T')[0]} - Using quote_items for task details`
            };
            
            console.log(`[AdriyellaTaService] Updating session ${session.QuoteID} (PK_ID: ${session.PK_ID}) with new data`);
            
            const response = await fetch(`${this.baseURL}/api/quote_sessions/${session.PK_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update session: ${response.status} - ${errorText}`);
            }
            
            // Delete existing quote items with improved error handling
            console.log(`[AdriyellaTaService] Deleting existing quote items for ${session.QuoteID}`);
            let deletionErrors = [];
            
            try {
                const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${session.QuoteID}`);
                if (itemsResponse.ok) {
                    const items = await itemsResponse.json();
                    console.log(`[AdriyellaTaService] Found ${items.length} existing items to delete`);
                    
                    // Delete each item individually
                    for (const item of items) {
                        try {
                            console.log(`[AdriyellaTaService] Deleting item ${item.PK_ID}: ${item.ProductName} (Qty: ${item.Quantity})`);
                            
                            const deleteResponse = await fetch(`${this.baseURL}/api/quote_items/${item.PK_ID}`, {
                                method: 'DELETE'
                            });
                            
                            if (!deleteResponse.ok) {
                                const errorText = await deleteResponse.text();
                                console.error(`[AdriyellaTaService] Failed to delete item ${item.PK_ID}: ${deleteResponse.status} - ${errorText}`);
                                deletionErrors.push({
                                    itemId: item.PK_ID,
                                    productName: item.ProductName,
                                    error: `${deleteResponse.status} - ${errorText}`
                                });
                            } else {
                                console.log(`[AdriyellaTaService] Successfully deleted item ${item.PK_ID}: ${item.ProductName}`);
                            }
                        } catch (deleteError) {
                            console.error(`[AdriyellaTaService] Network error deleting item ${item.PK_ID}:`, deleteError);
                            deletionErrors.push({
                                itemId: item.PK_ID,
                                productName: item.ProductName,
                                error: deleteError.message
                            });
                        }
                    }
                    
                    if (deletionErrors.length > 0) {
                        console.warn(`[AdriyellaTaService] ${deletionErrors.length} items failed to delete:`, deletionErrors);
                        // Continue anyway - we'll handle duplicates in creation
                    } else {
                        console.log(`[AdriyellaTaService] Successfully deleted all ${items.length} existing items`);
                    }
                } else {
                    console.warn(`[AdriyellaTaService] Failed to fetch existing items: ${itemsResponse.status}`);
                }
            } catch (fetchError) {
                console.error(`[AdriyellaTaService] Error fetching items for deletion:`, fetchError);
            }
            
            // Create new quote items
            const items = [
                { name: 'Thank You Cards', count: tasks.thankYou || 0, rate: 2.00 },
                { name: 'Lead Sheets', count: tasks.leadSheets || 0, rate: 5.00 },
                { name: 'Google Reviews', count: tasks.googleReviews || 0, rate: 20.00 },
                { name: 'Art Approval', count: tasks.artApproval || 0, rate: 10.00 }
            ];
            
            let lineNumber = 1;
            const failedItems = [];
            
            for (const item of items) {
                if (item.count > 0) {
                    const itemData = {
                        QuoteID: session.QuoteID,
                        LineNumber: lineNumber++,
                        StyleNumber: 'TASK',
                        ProductName: item.name,
                        Color: '',
                        ColorCode: '',
                        EmbellishmentType: 'task',
                        PrintLocation: '',
                        PrintLocationName: '',
                        Quantity: item.count,
                        HasLTM: 'No',
                        BaseUnitPrice: item.rate,
                        LTMPerUnit: 0,
                        FinalUnitPrice: item.rate,
                        LineTotal: item.count * item.rate,
                        SizeBreakdown: '{}',
                        PricingTier: 'Standard',
                        ImageURL: '',
                        AddedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
                    };
                    
                    console.log(`[AdriyellaTaService] Creating updated quote item: ${item.name} (${item.count} × $${item.rate})`);
                    
                    try {
                        const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(itemData)
                        });
                        
                        if (!itemResponse.ok) {
                            const errorText = await itemResponse.text();
                            console.error(`[AdriyellaTaService] Failed to create updated item ${item.name}:`, errorText);
                            failedItems.push({ item: item.name, error: errorText });
                        } else {
                            console.log(`[AdriyellaTaService] Successfully created updated item: ${item.name}`);
                        }
                    } catch (error) {
                        console.error(`[AdriyellaTaService] Network error creating updated item ${item.name}:`, error);
                        failedItems.push({ item: item.name, error: error.message });
                    }
                }
            }
            
            // Log failed items but don't throw - session update was successful
            if (failedItems.length > 0) {
                console.warn(`[AdriyellaTaService] ${failedItems.length} updated items failed to create:`, failedItems);
            }
            
            // Clean up any duplicate items that may have been created
            console.log(`[AdriyellaTaService] Running cleanup for duplicate items in session ${session.QuoteID}`);
            await this.cleanupDuplicateItems(session.QuoteID);
            
            // Get date from session QuoteID (ADRMMDD-X format)
            const month = session.QuoteID.substring(3, 5);
            const day = session.QuoteID.substring(5, 7);
            const year = new Date().getFullYear();
            const date = `${year}-${month}-${day}`;
            
            // Update cache with the updated session data
            const updatedSession = {
                ...session,
                TotalQuantity: totalQuantity,
                SubtotalAmount: totalAmount,
                TotalAmount: totalAmount,
                Notes: updateData.Notes
            };
            this.cacheSession(date, updatedSession);
            
            const taskData = {
                date: date,
                thankYouCards: tasks.thankYou || 0,
                leadSheets: tasks.leadSheets || 0,
                googleReviews: tasks.googleReviews || 0,
                artApproval: tasks.artApproval || 0,
                dailyTotal: totalAmount,
                lastUpdated: new Date().toISOString(),
                quoteID: session.QuoteID
            };
            
            return { success: true, data: taskData };
        } catch (error) {
            console.error('[AdriyellaTaService] Error updating session:', error);
            throw error;
        }
    }

    /**
     * Get tasks for a specific date
     */
    async getDailyTasks(date) {
        // Check API for the specific date using quote_items
        // Parse date string directly to avoid timezone issues
        const [year, month, day] = date.split('-');
        const monthStr = month.padStart(2, '0');
        const dayStr = day.padStart(2, '0');
        const datePattern = `ADR${monthStr}${dayStr}`;
        
        console.log(`[AdriyellaTaService] Fetching tasks for ${date} with pattern: ${datePattern}`);
        
        // Get all quote items and filter on client side
        const response = await fetch(`${this.baseURL}/api/quote_items`);
        if (!response.ok) {
            throw new Error(`Failed to fetch tasks: ${response.status}`);
        }
        
        const allItems = await response.json();
        
        // Filter items that match our date pattern (ADR0715-1, ADR0715-2, etc.)
        const items = allItems.filter(item => 
            item.QuoteID && item.QuoteID.startsWith(datePattern + '-')
        );
        
        console.log(`[AdriyellaTaService] Found ${items.length} items for ${datePattern} (from ${allItems.length} total items)`);
        
        if (items.length > 0) {
            // Aggregate tasks by ProductName
            const tasks = {
                thankYouCards: 0,
                leadSheets: 0,
                googleReviews: 0,
                artApproval: 0,
                dailyTotal: 0
            };
            
            let quoteID = null;
            
            items.forEach(item => {
                if (!quoteID) quoteID = item.QuoteID;
                
                switch(item.ProductName) {
                    case 'Thank You Cards':
                        tasks.thankYouCards = item.Quantity;
                        break;
                    case 'Lead Sheets':
                        tasks.leadSheets = item.Quantity;
                        break;
                    case 'Google Reviews':
                        tasks.googleReviews = item.Quantity;
                        break;
                    case 'Art Approval':
                        tasks.artApproval = item.Quantity;
                        break;
                }
                
                tasks.dailyTotal += item.LineTotal;
            });
            
            return {
                success: true,
                data: {
                    date: date,
                    thankYouCards: tasks.thankYouCards,
                    leadSheets: tasks.leadSheets,
                    googleReviews: tasks.googleReviews,
                    artApproval: tasks.artApproval,
                    dailyTotal: tasks.dailyTotal,
                    quoteID: quoteID
                }
            };
        }
        
        // Return empty data if none exists
        return { 
            success: true, 
            data: {
                date: date,
                thankYouCards: 0,
                leadSheets: 0,
                googleReviews: 0,
                artApproval: 0,
                dailyTotal: 0
            }
        };
    }

    /**
     * Get all tasks for a month
     */
    async getMonthlyTasks(year, month) {
        const monthStr = month.toString().padStart(2, '0');
        const monthPattern = `ADR${monthStr}`;
        
        console.log(`[AdriyellaTaService] Fetching monthly tasks for ${year}-${monthStr} with pattern: ${monthPattern}`);
        
        // Get all quote items and filter on client side
        const response = await fetch(`${this.baseURL}/api/quote_items`);
        if (!response.ok) {
            throw new Error(`Failed to fetch monthly tasks: ${response.status}`);
        }
        
        const allItems = await response.json();
        
        // Filter items that match our month pattern (ADR0715-X, ADR0716-X, etc.)
        const items = allItems.filter(item => 
            item.QuoteID && item.QuoteID.startsWith(monthPattern) && item.QuoteID.includes('-')
        );
        
        console.log(`[AdriyellaTaService] Found ${items.length} items for month ${monthStr} (from ${allItems.length} total items)`);
        
        if (items.length > 0) {
            console.log(`[AdriyellaTaService] Sample items:`, items.slice(0, 3));
            const uniqueQuoteIDs = [...new Set(items.map(item => item.QuoteID))];
            console.log(`[AdriyellaTaService] Unique Quote IDs found:`, uniqueQuoteIDs);
            
            // Check for potential duplicates with different date patterns
            const quoteIDsByDay = {};
            uniqueQuoteIDs.forEach(quoteID => {
                const day = quoteID.substring(5, 7);
                if (!quoteIDsByDay[day]) {
                    quoteIDsByDay[day] = [];
                }
                quoteIDsByDay[day].push(quoteID);
            });
            
            // Log any days with multiple quote IDs (potential duplicates)
            Object.keys(quoteIDsByDay).forEach(day => {
                if (quoteIDsByDay[day].length > 1) {
                    console.warn(`[AdriyellaTaService] Multiple quote IDs found for day ${day}:`, quoteIDsByDay[day]);
                    console.warn(`[AdriyellaTaService] This may cause double-counting in monthly total!`);
                }
            });
        }
        
        // Group items by QuoteID (daily sessions)
        const dailyTasks = {};
        
        // First, group by actual date to handle duplicate patterns
        const itemsByDate = {};
        
        items.forEach(item => {
            // Extract date from QuoteID (ADRMMDD-X format)
            const day = parseInt(item.QuoteID.substring(5, 7));
            const date = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
            
            if (!itemsByDate[date]) {
                itemsByDate[date] = [];
            }
            itemsByDate[date].push(item);
        });
        
        // For each date, prefer the most recent quote ID pattern and skip older ones
        Object.keys(itemsByDate).forEach(date => {
            const dateItems = itemsByDate[date];
            
            // Group by QuoteID to find potential duplicates
            const quoteGroups = {};
            dateItems.forEach(item => {
                if (!quoteGroups[item.QuoteID]) {
                    quoteGroups[item.QuoteID] = [];
                }
                quoteGroups[item.QuoteID].push(item);
            });
            
            const quoteIDs = Object.keys(quoteGroups);
            
            // If there are multiple quote IDs for the same date, prefer the correct one
            let selectedQuoteID = null;
            if (quoteIDs.length > 1) {
                console.warn(`[AdriyellaTaService] Found multiple quote IDs for ${date}:`, quoteIDs);
                
                // Prefer the quote ID that matches the expected pattern for this date
                const [year, month, day] = date.split('-');
                const expectedPattern = `ADR${month}${day}`;
                
                const correctQuoteID = quoteIDs.find(qid => qid.startsWith(expectedPattern + '-'));
                if (correctQuoteID) {
                    selectedQuoteID = correctQuoteID;
                    console.log(`[AdriyellaTaService] Using correct pattern: ${selectedQuoteID}`);
                } else {
                    // If no correct pattern found, use the most recent one
                    selectedQuoteID = quoteIDs.sort().pop();
                    console.log(`[AdriyellaTaService] No correct pattern found, using most recent: ${selectedQuoteID}`);
                }
            } else {
                selectedQuoteID = quoteIDs[0];
            }
            
            // Process only the selected quote ID
            const selectedItems = quoteGroups[selectedQuoteID];
            
            if (!dailyTasks[selectedQuoteID]) {
                dailyTasks[selectedQuoteID] = {
                    date: date,
                    quoteID: selectedQuoteID,
                    thankYouCards: 0,
                    leadSheets: 0,
                    googleReviews: 0,
                    artApproval: 0,
                    dailyTotal: 0
                };
            }
            
            // Add items from the selected quote
            selectedItems.forEach(item => {
                // Map ProductName to task type
                switch(item.ProductName) {
                    case 'Thank You Cards':
                        dailyTasks[selectedQuoteID].thankYouCards = item.Quantity;
                        break;
                    case 'Lead Sheets':
                        dailyTasks[selectedQuoteID].leadSheets = item.Quantity;
                        break;
                    case 'Google Reviews':
                        dailyTasks[selectedQuoteID].googleReviews = item.Quantity;
                        break;
                    case 'Art Approval':
                        dailyTasks[selectedQuoteID].artApproval = item.Quantity;
                        break;
                }
                
                dailyTasks[selectedQuoteID].dailyTotal += item.LineTotal;
            });
        });
        
        // Convert to array and sort by date
        const tasks = Object.values(dailyTasks);
        tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const rawMonthlyTotal = tasks.reduce((sum, task) => sum + (task.dailyTotal || 0), 0);
        
        // Apply $400 monthly earning cap
        const MONTHLY_CAP = 400.00;
        const cappedMonthlyTotal = Math.min(rawMonthlyTotal, MONTHLY_CAP);
        const isAtCap = rawMonthlyTotal >= MONTHLY_CAP;
        const excessAmount = Math.max(0, rawMonthlyTotal - MONTHLY_CAP);
        const remainingCapacity = Math.max(0, MONTHLY_CAP - rawMonthlyTotal);
        
        // Calculate cap status
        let capStatus = 'under';
        let capStatusMessage = `$${remainingCapacity.toFixed(2)} remaining this month`;
        
        if (rawMonthlyTotal >= MONTHLY_CAP) {
            capStatus = 'at_cap';
            capStatusMessage = 'Monthly cap reached ($400)';
        } else if (rawMonthlyTotal >= MONTHLY_CAP * 0.75) { // 75% of cap ($300+)
            capStatus = 'approaching';
            capStatusMessage = `Approaching cap - $${remainingCapacity.toFixed(2)} remaining`;
        }
        
        console.log(`[AdriyellaTaService] Monthly calculation results:`);
        console.log(`  - Days with tasks: ${tasks.length}`);
        console.log(`  - Daily totals: ${tasks.map(t => `${t.quoteID}: $${t.dailyTotal.toFixed(2)}`).join(', ')}`);
        console.log(`  - Raw monthly total: $${rawMonthlyTotal.toFixed(2)}`);
        console.log(`  - Capped monthly total: $${cappedMonthlyTotal.toFixed(2)}`);
        console.log(`  - Cap status: ${capStatus} (${capStatusMessage})`);
        if (excessAmount > 0) {
            console.log(`  - Excess amount (unpaid): $${excessAmount.toFixed(2)}`);
        }
        
        return {
            success: true,
            data: {
                tasks: tasks,
                monthlyTotal: cappedMonthlyTotal,  // Return capped amount as primary total
                rawMonthlyTotal: rawMonthlyTotal,  // Keep raw total for reference
                cappedMonthlyTotal: cappedMonthlyTotal,
                monthlyCap: MONTHLY_CAP,
                isAtCap: isAtCap,
                excessAmount: excessAmount,
                remainingCapacity: remainingCapacity,
                capStatus: capStatus,
                capStatusMessage: capStatusMessage,
                taskCount: tasks.length
            }
        };
    }

    /**
     * Clean up duplicate quote items for a specific QuoteID
     * Keeps only the most recent item for each ProductName
     */
    async cleanupDuplicateItems(quoteID) {
        try {
            console.log(`[AdriyellaTaService] Cleaning up duplicate items for ${quoteID}`);
            
            const itemsResponse = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteID}`);
            if (!itemsResponse.ok) {
                console.warn(`[AdriyellaTaService] Failed to fetch items for cleanup: ${itemsResponse.status}`);
                return;
            }
            
            const items = await itemsResponse.json();
            if (items.length === 0) {
                console.log(`[AdriyellaTaService] No items found for cleanup`);
                return;
            }
            
            // Group items by ProductName
            const itemsByProduct = {};
            items.forEach(item => {
                if (!itemsByProduct[item.ProductName]) {
                    itemsByProduct[item.ProductName] = [];
                }
                itemsByProduct[item.ProductName].push(item);
            });
            
            let duplicatesRemoved = 0;
            
            // For each product, keep only the most recent item
            for (const [productName, productItems] of Object.entries(itemsByProduct)) {
                if (productItems.length > 1) {
                    console.log(`[AdriyellaTaService] Found ${productItems.length} duplicate items for ${productName}`);
                    
                    // Sort by AddedAt date to find the most recent
                    productItems.sort((a, b) => new Date(b.AddedAt) - new Date(a.AddedAt));
                    const keepItem = productItems[0];
                    const deleteItems = productItems.slice(1);
                    
                    console.log(`[AdriyellaTaService] Keeping most recent ${productName} (PK_ID: ${keepItem.PK_ID}, Added: ${keepItem.AddedAt})`);
                    
                    // Delete the older duplicates
                    for (const item of deleteItems) {
                        try {
                            console.log(`[AdriyellaTaService] Deleting duplicate ${productName} (PK_ID: ${item.PK_ID}, Added: ${item.AddedAt})`);
                            
                            const deleteResponse = await fetch(`${this.baseURL}/api/quote_items/${item.PK_ID}`, {
                                method: 'DELETE'
                            });
                            
                            if (deleteResponse.ok) {
                                duplicatesRemoved++;
                                console.log(`[AdriyellaTaService] Successfully deleted duplicate item ${item.PK_ID}`);
                            } else {
                                console.error(`[AdriyellaTaService] Failed to delete duplicate item ${item.PK_ID}: ${deleteResponse.status}`);
                            }
                        } catch (error) {
                            console.error(`[AdriyellaTaService] Error deleting duplicate item ${item.PK_ID}:`, error);
                        }
                    }
                }
            }
            
            if (duplicatesRemoved > 0) {
                console.log(`[AdriyellaTaService] Cleanup completed: removed ${duplicatesRemoved} duplicate items`);
            } else {
                console.log(`[AdriyellaTaService] No duplicates found, cleanup not needed`);
            }
            
        } catch (error) {
            console.error(`[AdriyellaTaService] Error during cleanup:`, error);
        }
    }

    /**
     * Extract date from quote ID (ADRMMDD-X format)
     */
    extractDateFromQuoteID(quoteID) {
        if (!quoteID || !quoteID.startsWith('ADR')) {
            return new Date().toISOString().split('T')[0]; // Default to today
        }
        
        try {
            // Extract MMDD from ADRMMDD-X format
            const month = quoteID.substring(3, 5);
            const day = quoteID.substring(5, 7);
            const year = new Date().getFullYear();
            
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.warn('[AdriyellaTaService] Failed to extract date from quote ID:', quoteID);
            return new Date().toISOString().split('T')[0]; // Default to today
        }
    }

    /**
     * Calculate total for a day's tasks
     */
    calculateTotal(tasks) {
        const rates = {
            thankYou: 2.00,
            leadSheets: 5.00,
            googleReviews: 20.00,
            artApproval: 10.00
        };
        
        let total = 0;
        Object.keys(rates).forEach(taskType => {
            if (tasks[taskType]) {
                total += tasks[taskType] * rates[taskType];
            }
        });
        
        return total;
    }

    /**
     * Mark a month as paid
     */
    async markMonthPaid(year, month, amount, paidBy = 'Admin') {
        try {
            console.log(`[AdriyellaTaService] Marking ${year}-${month} as paid for $${amount}`);
            
            // Get all quote sessions for this month
            const monthSessions = await this.getMonthSessions(year, month);
            
            if (monthSessions.length === 0) {
                console.log('[AdriyellaTaService] No sessions found for this month');
                return { success: false, error: 'No sessions found for this month' };
            }
            
            const paymentData = {
                payroll_status: 'paid',
                paid_date: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
                paid_by: paidBy,
                payroll_amount: parseFloat(amount),
                payment_notes: `Added to ${this.getMonthName(month)} ${year} paycheck`
            };
            
            // Update each session with payment information
            let updateCount = 0;
            for (const session of monthSessions) {
                try {
                    // Parse existing notes or create new structure
                    let notesData = {};
                    if (session.Notes) {
                        try {
                            notesData = JSON.parse(session.Notes);
                        } catch (e) {
                            // If notes aren't JSON, preserve as original_notes
                            notesData = { original_notes: session.Notes };
                        }
                    }
                    
                    // Add payment data
                    const updatedNotes = {
                        ...notesData,
                        ...paymentData
                    };
                    
                    // Update the session
                    const updateResponse = await fetch(`${this.baseURL}/api/quote_sessions/${session.PK_ID}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            Notes: JSON.stringify(updatedNotes)
                        })
                    });
                    
                    if (updateResponse.ok) {
                        updateCount++;
                        console.log(`[AdriyellaTaService] Updated session ${session.QuoteID} with payment info`);
                    } else {
                        console.error(`[AdriyellaTaService] Failed to update session ${session.QuoteID}`);
                    }
                } catch (error) {
                    console.error(`[AdriyellaTaService] Error updating session ${session.QuoteID}:`, error);
                }
            }
            
            console.log(`[AdriyellaTaService] Successfully updated ${updateCount} of ${monthSessions.length} sessions`);
            
            return {
                success: true,
                updatedSessions: updateCount,
                totalSessions: monthSessions.length,
                paymentData
            };
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error marking month as paid:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a month is paid
     */
    async isMonthPaid(year, month) {
        try {
            const monthSessions = await this.getMonthSessions(year, month);
            
            if (monthSessions.length === 0) {
                return false;
            }
            
            // Check if any session has payment status
            for (const session of monthSessions) {
                if (session.Notes) {
                    try {
                        const notesData = JSON.parse(session.Notes);
                        if (notesData.payroll_status === 'paid') {
                            return true;
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error checking payment status:', error);
            return false;
        }
    }

    /**
     * Get payment history for a month
     */
    async getPaymentHistory(year, month) {
        try {
            const monthSessions = await this.getMonthSessions(year, month);
            
            for (const session of monthSessions) {
                if (session.Notes) {
                    try {
                        const notesData = JSON.parse(session.Notes);
                        if (notesData.payroll_status === 'paid') {
                            return {
                                isPaid: true,
                                paidDate: notesData.paid_date,
                                paidBy: notesData.paid_by,
                                payrollAmount: notesData.payroll_amount,
                                paymentNotes: notesData.payment_notes
                            };
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }
            }
            
            return { isPaid: false };
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error getting payment history:', error);
            return { isPaid: false };
        }
    }

    /**
     * Generate payroll report for a month
     */
    async generatePayrollReport(year, month) {
        try {
            console.log(`[AdriyellaTaService] Generating payroll report for ${year}-${month}`);
            
            const monthlyData = await this.getMonthlyTasks(year, month);
            
            if (!monthlyData.success) {
                return { success: false, error: 'Failed to get monthly data' };
            }
            
            const data = monthlyData.data;
            const paymentHistory = await this.getPaymentHistory(year, month);
            
            // Calculate task totals
            const taskTotals = {
                thankYouCards: { count: 0, amount: 0 },
                leadSheets: { count: 0, amount: 0 },
                googleReviews: { count: 0, amount: 0 },
                artApproval: { count: 0, amount: 0 }
            };
            
            const rates = {
                thankYouCards: 2.00,
                leadSheets: 5.00,
                googleReviews: 20.00,
                artApproval: 10.00
            };
            
            // Sum up tasks from all days
            data.tasks.forEach(task => {
                taskTotals.thankYouCards.count += task.thankYouCards || 0;
                taskTotals.leadSheets.count += task.leadSheets || 0;
                taskTotals.googleReviews.count += task.googleReviews || 0;
                taskTotals.artApproval.count += task.artApproval || 0;
            });
            
            // Calculate amounts
            Object.keys(taskTotals).forEach(taskType => {
                taskTotals[taskType].amount = taskTotals[taskType].count * rates[taskType];
            });
            
            const payrollReport = {
                employee: 'Adriyella',
                payPeriod: `${this.getMonthName(month)} ${year}`,
                year,
                month,
                generatedDate: new Date().toISOString(),
                taskBreakdown: taskTotals,
                dailyTasks: data.tasks,
                rawTotal: data.rawMonthlyTotal || data.monthlyTotal,
                cappedTotal: data.cappedMonthlyTotal || data.monthlyTotal,
                isAtCap: data.capStatus === 'at_cap',
                excessAmount: data.excessAmount || 0,
                recommendedPaycheckAmount: data.cappedMonthlyTotal || data.monthlyTotal,
                paymentHistory,
                workingDays: data.tasks.length,
                totalTasks: Object.values(taskTotals).reduce((sum, task) => sum + task.count, 0)
            };
            
            console.log('[AdriyellaTaService] Payroll report generated successfully');
            
            return {
                success: true,
                report: payrollReport
            };
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error generating payroll report:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all unpaid months
     */
    async getUnpaidMonths() {
        try {
            console.log('[AdriyellaTaService] Getting unpaid months');
            
            // Get all Adriyella sessions
            const response = await fetch(`${this.baseURL}/api/quote_sessions`);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const allSessions = await response.json();
            
            // Filter for Adriyella sessions (ADR prefix)
            const adriyellaSessions = allSessions.filter(session => 
                session.QuoteID && session.QuoteID.startsWith('ADR')
            );
            
            // Group by month and check payment status
            const monthsMap = new Map();
            
            adriyellaSessions.forEach(session => {
                if (session.CreatedAt) {
                    const date = new Date(session.CreatedAt);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;
                    const monthKey = `${year}-${month}`;
                    
                    if (!monthsMap.has(monthKey)) {
                        monthsMap.set(monthKey, {
                            year,
                            month,
                            monthName: this.getMonthName(month),
                            sessions: [],
                            isPaid: false
                        });
                    }
                    
                    const monthData = monthsMap.get(monthKey);
                    monthData.sessions.push(session);
                    
                    // Check if this session indicates the month is paid
                    if (session.Notes && !monthData.isPaid) {
                        try {
                            const notesData = JSON.parse(session.Notes);
                            if (notesData.payroll_status === 'paid') {
                                monthData.isPaid = true;
                            }
                        } catch (e) {
                            // Ignore JSON parse errors
                        }
                    }
                }
            });
            
            // Return only unpaid months, sorted by date
            const unpaidMonths = Array.from(monthsMap.values())
                .filter(month => !month.isPaid)
                .sort((a, b) => {
                    if (a.year !== b.year) return a.year - b.year;
                    return a.month - b.month;
                });
            
            return {
                success: true,
                unpaidMonths
            };
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error getting unpaid months:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all sessions for a specific month
     */
    async getMonthSessions(year, month) {
        try {
            const response = await fetch(`${this.baseURL}/api/quote_sessions`);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const allSessions = await response.json();
            
            // Filter for Adriyella sessions in the specified month
            const monthSessions = allSessions.filter(session => {
                if (!session.QuoteID || !session.QuoteID.startsWith('ADR')) {
                    return false;
                }
                
                if (session.CreatedAt) {
                    const date = new Date(session.CreatedAt);
                    return date.getFullYear() === year && (date.getMonth() + 1) === month;
                }
                
                return false;
            });
            
            return monthSessions;
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error getting month sessions:', error);
            return [];
        }
    }

    /**
     * Get month name from number
     */
    getMonthName(month) {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return monthNames[month - 1] || 'Unknown';
    }

    /**
     * Generate daily report data for EmailJS
     */
    async getDailyReportData(date) {
        const result = await this.getDailyTasks(date);
        if (!result.success) return null;
        
        const tasks = result.data;
        const monthResult = await this.getMonthlyTasks(
            new Date(date).getFullYear(),
            new Date(date).getMonth() + 1
        );
        
        return {
            date: new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            thankYouCards: tasks.thankYouCards,
            thankYouAmount: (tasks.thankYouCards * 2).toFixed(2),
            leadSheets: tasks.leadSheets,
            leadAmount: (tasks.leadSheets * 5).toFixed(2),
            googleReviews: tasks.googleReviews,
            reviewAmount: (tasks.googleReviews * 20).toFixed(2),
            artApproval: tasks.artApproval,
            artAmount: (tasks.artApproval * 10).toFixed(2),
            dailyTotal: tasks.dailyTotal.toFixed(2),
            monthlyTotal: monthResult.success ? (monthResult.data.cappedMonthlyTotal || monthResult.data.monthlyTotal).toFixed(2) : '0.00',
            monthlyRawTotal: monthResult.success ? (monthResult.data.rawMonthlyTotal || monthResult.data.monthlyTotal).toFixed(2) : '0.00',
            capStatus: monthResult.success ? monthResult.data.capStatus || 'under_cap' : 'under_cap',
            isAtCap: monthResult.success ? (monthResult.data.capStatus === 'at_cap') : false
        };
    }

    /**
     * Get tasks for a date range (for dashboard summary widgets)
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @returns {Object} Result with array of daily task data
     */
    async getTasksInRange(startDate, endDate) {
        console.log(`[AdriyellaTaService] Getting tasks for range: ${startDate} to ${endDate}`);
        
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const dailyData = [];
            
            // Iterate through each day in the range
            const currentDate = new Date(start);
            while (currentDate <= end) {
                const dateStr = currentDate.toISOString().split('T')[0];
                
                try {
                    const dayResult = await this.getDailyTasks(dateStr);
                    if (dayResult.success && dayResult.data) {
                        dailyData.push({
                            date: dateStr,
                            thankYouCards: dayResult.data.thankYouCards || 0,
                            leadSheets: dayResult.data.leadSheets || 0,
                            googleReviews: dayResult.data.googleReviews || 0,
                            artApproval: dayResult.data.artApproval || 0,
                            dailyTotal: dayResult.data.dailyTotal || 0
                        });
                    } else {
                        // Add zero data for days with no tasks
                        dailyData.push({
                            date: dateStr,
                            thankYouCards: 0,
                            leadSheets: 0,
                            googleReviews: 0,
                            artApproval: 0,
                            dailyTotal: 0
                        });
                    }
                } catch (dayError) {
                    console.warn(`[AdriyellaTaService] Error getting data for ${dateStr}:`, dayError);
                    // Add zero data for error days
                    dailyData.push({
                        date: dateStr,
                        thankYouCards: 0,
                        leadSheets: 0,
                        googleReviews: 0,
                        artApproval: 0,
                        dailyTotal: 0
                    });
                }
                
                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            console.log(`[AdriyellaTaService] Retrieved ${dailyData.length} days of data`);
            
            return {
                success: true,
                data: dailyData
            };
            
        } catch (error) {
            console.error('[AdriyellaTaService] Error getting tasks in range:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Batch earnings calculation
     * Replaces the inefficient individual API calls with batched operations
     */
    async getBatchEarningsData(days = 30) {
        const cacheKey = `earnings_batch_${days}`;
        
        // Check cache first (with TTL)
        if (this.perfUtils) {
            const cached = this.perfUtils.getCacheWithTTL(cacheKey);
            if (cached) {
                console.log(`[AdriyellaTaService] Returning cached earnings data for ${days} days`);
                return cached;
            }
        }

        try {
            const startTime = performance.now();
            console.log(`[AdriyellaTaService] Starting batch earnings calculation for ${days} days`);

            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfPeriod = new Date(today);
            startOfPeriod.setDate(today.getDate() - days);

            // Single API call to get all sessions in range
            const sessionsResponse = await fetch(`${this.baseURL}/api/quote_sessions`);
            if (!sessionsResponse.ok) {
                throw new Error(`Failed to fetch sessions: ${sessionsResponse.status}`);
            }

            const allSessions = await sessionsResponse.json();
            
            // Filter for Adriyella sessions (ADR pattern) within date range
            const relevantSessions = allSessions.filter(session => {
                if (!session.QuoteID || !session.QuoteID.startsWith('ADR')) {
                    return false;
                }
                
                const sessionDate = new Date(session.CreatedAt);
                return sessionDate >= startOfPeriod;
            });

            console.log(`[AdriyellaTaService] Found ${relevantSessions.length} relevant sessions`);

            // Batch API call to get all quote items for these sessions
            const quoteIds = relevantSessions.map(s => s.QuoteID);
            const itemsPromises = quoteIds.map(async (quoteId) => {
                try {
                    const response = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteId}`);
                    if (response.ok) {
                        const items = await response.json();
                        return { quoteId, items, success: true };
                    }
                    return { quoteId, items: [], success: false };
                } catch (error) {
                    console.warn(`[AdriyellaTaService] Failed to get items for ${quoteId}:`, error);
                    return { quoteId, items: [], success: false };
                }
            });

            // Process all items in parallel (with concurrency limit)
            let allResults;
            if (this.perfUtils) {
                allResults = await this.perfUtils.batchApiCall(
                    itemsPromises.map(p => () => p),
                    { concurrent: 5, maxRetries: 2 }
                );
            } else {
                allResults = await Promise.all(itemsPromises);
            }

            // Calculate earnings by time period
            let todayEarnings = 0;
            let weekEarnings = 0; 
            let monthEarnings = 0;
            let totalEarnings = 0;

            const todayStr = today.toDateString();

            for (const session of relevantSessions) {
                const sessionDate = new Date(session.CreatedAt);
                const sessionResults = allResults.find(r => r.quoteId === session.QuoteID);
                
                if (!sessionResults || !sessionResults.success) {
                    continue;
                }

                for (const item of sessionResults.items) {
                    // LineTotal stores earnings * 100 for compatibility
                    const earnings = parseFloat(item.LineTotal || 0) / 100;
                    
                    totalEarnings += earnings;
                    
                    if (sessionDate.toDateString() === todayStr) {
                        todayEarnings += earnings;
                    }
                    
                    if (sessionDate >= startOfWeek) {
                        weekEarnings += earnings;
                    }
                    
                    if (sessionDate >= startOfMonth) {
                        monthEarnings += earnings;
                    }
                }
            }

            const earningsData = {
                today: todayEarnings,
                week: weekEarnings,
                month: monthEarnings,
                total: totalEarnings,
                monthlyProgress: Math.min(100, (monthEarnings / 400) * 100),
                monthlyRemaining: Math.max(0, 400 - monthEarnings),
                calculatedAt: Date.now(),
                sessionsProcessed: relevantSessions.length
            };

            const endTime = performance.now();
            console.log(`[AdriyellaTaService] Batch earnings calculation completed in ${(endTime - startTime).toFixed(2)}ms`);
            console.log(`[AdriyellaTaService] Earnings summary:`, earningsData);

            // Cache the results (30 second TTL)
            if (this.perfUtils) {
                this.perfUtils.setCacheWithTTL(cacheKey, earningsData, 30000);
            }

            return earningsData;

        } catch (error) {
            console.error('[AdriyellaTaService] Error in batch earnings calculation:', error);
            
            // Return fallback data structure
            return {
                today: 0,
                week: 0,
                month: 0,
                total: 0,
                monthlyProgress: 0,
                monthlyRemaining: 400,
                calculatedAt: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Debounced task completion save
     * Prevents overwhelming the API with rapid saves
     */
    saveTaskCompletionOptimized(taskId, taskData) {
        if (!this.perfUtils) {
            // Fallback to regular save if perf utils not available
            return this.saveTaskCompletion(taskId, taskData);
        }

        // Use debounced save with 300ms delay
        const debouncedSave = this.perfUtils.debounce(
            () => this.saveTaskCompletion(taskId, taskData),
            300,
            `save-task-${taskId}`
        );

        return debouncedSave();
    }

    /**
     * PERFORMANCE OPTIMIZATION: Optimistic UI updates for earnings
     * Updates UI immediately while saving in background
     */
    async updateEarningsOptimistic(element, newEarnings, savePromise) {
        if (!this.perfUtils) {
            // Fallback to regular update
            const result = await savePromise;
            if (element) {
                element.textContent = `$${newEarnings.toFixed(2)}`;
            }
            return result;
        }

        const currentText = element ? element.textContent : '$0.00';
        
        this.perfUtils.optimisticUpdate(
            element,
            `$${newEarnings.toFixed(2)}`,
            currentText,
            savePromise
        );

        return savePromise;
    }
}

// Make service available globally
window.AdriyellaTaService = AdriyellaTaService;