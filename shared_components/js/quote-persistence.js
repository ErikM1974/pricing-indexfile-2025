/**
 * Quote Persistence Manager
 * Enhanced localStorage management for quote builders
 * Provides auto-save, compression, and cross-tab synchronization
 */

class QuotePersistence {
    constructor(config = {}) {
        this.prefix = config.prefix || 'QUOTE';
        this.maxDrafts = config.maxDrafts || 5;
        this.compressionEnabled = config.compressionEnabled !== false;
        this.autoSaveInterval = config.autoSaveInterval || 30000; // 30 seconds
        this.debug = config.debug || false;
        
        this.storageKey = `${this.prefix}_draft`;
        this.historyKey = `${this.prefix}_history`;
        this.sessionKey = `${this.prefix}_session`;
        
        this.autoSaveTimer = null;
        this.lastSaveTime = null;
        this.isDirty = false;
        
        // Cross-tab communication
        this.initCrossTabSync();
        
        // Initialize auto-save
        if (config.autoSave !== false) {
            this.startAutoSave();
        }
        
        this.log('QuotePersistence initialized', config);
    }
    
    /**
     * Save quote data to localStorage
     */
    save(data, options = {}) {
        try {
            const saveData = {
                ...data,
                _metadata: {
                    timestamp: new Date().toISOString(),
                    version: '2.0',
                    prefix: this.prefix,
                    completed: options.completed || false
                }
            };
            
            // Compress if enabled and data is large
            const serialized = JSON.stringify(saveData);
            const finalData = this.compressionEnabled && serialized.length > 5000 
                ? this.compress(serialized) 
                : serialized;
            
            // Save to localStorage
            localStorage.setItem(this.storageKey, finalData);
            
            // Update last save time
            this.lastSaveTime = new Date();
            this.isDirty = false;
            
            // Add to history if completed
            if (options.completed) {
                this.addToHistory(saveData);
                // Clear draft after successful completion
                if (options.clearDraft !== false) {
                    this.clearDraft();
                }
            }
            
            // Broadcast to other tabs
            this.broadcastUpdate('save', saveData);
            
            this.log('Data saved successfully', { 
                size: finalData.length, 
                compressed: this.compressionEnabled && serialized.length > 5000 
            });
            
            return true;
        } catch (error) {
            console.error('[QuotePersistence] Save failed:', error);
            
            // Try to clear old data if quota exceeded
            if (error.name === 'QuotaExceededError') {
                this.clearOldHistory();
                // Retry once
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(data));
                    return true;
                } catch (retryError) {
                    console.error('[QuotePersistence] Retry failed:', retryError);
                }
            }
            
            return false;
        }
    }
    
    /**
     * Load quote data from localStorage
     */
    load() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (!storedData) return null;
            
            // Decompress if needed
            let data;
            try {
                data = JSON.parse(storedData);
            } catch (e) {
                // Might be compressed
                data = JSON.parse(this.decompress(storedData));
            }
            
            // Check if data is expired (24 hours)
            if (data._metadata) {
                const age = Date.now() - new Date(data._metadata.timestamp).getTime();
                if (age > 24 * 60 * 60 * 1000) {
                    this.log('Draft expired, clearing');
                    this.clearDraft();
                    return null;
                }
            }
            
            this.log('Data loaded successfully', data._metadata);
            return data;
        } catch (error) {
            console.error('[QuotePersistence] Load failed:', error);
            return null;
        }
    }
    
    /**
     * Check if a draft exists
     */
    hasDraft() {
        return localStorage.getItem(this.storageKey) !== null;
    }
    
    /**
     * Clear the current draft
     */
    clearDraft() {
        localStorage.removeItem(this.storageKey);
        this.lastSaveTime = null;
        this.isDirty = false;
        this.broadcastUpdate('clear', null);
        this.log('Draft cleared');
    }
    
    /**
     * Get draft age in human-readable format
     */
    getDraftAge() {
        const data = this.load();
        if (!data || !data._metadata) return null;
        
        const age = Date.now() - new Date(data._metadata.timestamp).getTime();
        const minutes = Math.floor(age / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }
    
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        this.stopAutoSave(); // Clear any existing timer
        
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty && this.onAutoSave) {
                this.log('Auto-saving...');
                this.onAutoSave();
            }
        }, this.autoSaveInterval);
        
        this.log('Auto-save started', { interval: this.autoSaveInterval });
    }
    
    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
            this.log('Auto-save stopped');
        }
    }
    
    /**
     * Mark data as dirty (needs saving)
     */
    markDirty() {
        this.isDirty = true;
    }
    
    /**
     * Add completed quote to history
     */
    addToHistory(data) {
        try {
            const history = this.getHistory();
            
            // Add new quote to beginning
            history.unshift({
                ...data,
                _historyId: this.generateId()
            });
            
            // Keep only last N quotes
            if (history.length > this.maxDrafts) {
                history.splice(this.maxDrafts);
            }
            
            localStorage.setItem(this.historyKey, JSON.stringify(history));
            this.log('Added to history', { count: history.length });
        } catch (error) {
            console.error('[QuotePersistence] Failed to add to history:', error);
        }
    }
    
    /**
     * Get quote history
     */
    getHistory() {
        try {
            const history = localStorage.getItem(this.historyKey);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('[QuotePersistence] Failed to get history:', error);
            return [];
        }
    }
    
    /**
     * Get recent quotes for dropdown
     */
    getRecentQuotes(limit = 5) {
        const history = this.getHistory();
        return history.slice(0, limit).map(quote => ({
            id: quote.quoteId || quote._historyId,
            customerName: quote.customerName || 'Unknown',
            date: quote._metadata?.timestamp || null,
            total: quote.grandTotal || 0,
            age: this.getAge(quote._metadata?.timestamp)
        }));
    }
    
    /**
     * Load quote from history
     */
    loadFromHistory(quoteId) {
        const history = this.getHistory();
        const quote = history.find(q => 
            q.quoteId === quoteId || q._historyId === quoteId
        );
        
        if (quote) {
            this.log('Loaded from history', { quoteId });
            return quote;
        }
        
        return null;
    }
    
    /**
     * Clear old history entries
     */
    clearOldHistory() {
        try {
            const history = this.getHistory();
            const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
            
            const filtered = history.filter(quote => {
                if (!quote._metadata?.timestamp) return false;
                return new Date(quote._metadata.timestamp).getTime() > cutoff;
            });
            
            localStorage.setItem(this.historyKey, JSON.stringify(filtered));
            this.log('Cleared old history', { 
                removed: history.length - filtered.length 
            });
        } catch (error) {
            console.error('[QuotePersistence] Failed to clear old history:', error);
        }
    }
    
    /**
     * Initialize cross-tab synchronization
     */
    initCrossTabSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey && this.onExternalUpdate) {
                this.log('External update detected');
                this.onExternalUpdate(e.newValue ? JSON.parse(e.newValue) : null);
            }
        });
    }
    
    /**
     * Broadcast update to other tabs
     */
    broadcastUpdate(type, data) {
        try {
            const message = {
                type,
                data,
                timestamp: Date.now(),
                prefix: this.prefix
            };
            
            // Use localStorage event for cross-tab communication
            localStorage.setItem(`${this.prefix}_broadcast`, JSON.stringify(message));
            localStorage.removeItem(`${this.prefix}_broadcast`);
        } catch (error) {
            console.error('[QuotePersistence] Broadcast failed:', error);
        }
    }
    
    /**
     * Simple compression using LZ-string algorithm (simplified)
     */
    compress(str) {
        // For now, just return the string
        // In production, you'd use a library like lz-string
        return str;
    }
    
    /**
     * Decompress string
     */
    decompress(str) {
        // For now, just return the string
        return str;
    }
    
    /**
     * Generate unique ID
     */
    generateId() {
        return `${this.prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get age in human-readable format
     */
    getAge(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const age = Date.now() - new Date(timestamp).getTime();
        const days = Math.floor(age / (24 * 60 * 60 * 1000));
        const hours = Math.floor(age / (60 * 60 * 1000));
        const minutes = Math.floor(age / 60000);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
    
    /**
     * Debug logging
     */
    log(...args) {
        if (this.debug) {
            console.log(`[QuotePersistence:${this.prefix}]`, ...args);
        }
    }
    
    /**
     * Get storage size info
     */
    getStorageInfo() {
        const draft = localStorage.getItem(this.storageKey);
        const history = localStorage.getItem(this.historyKey);
        
        return {
            draftSize: draft ? draft.length : 0,
            historySize: history ? history.length : 0,
            totalSize: (draft?.length || 0) + (history?.length || 0),
            historyCount: this.getHistory().length,
            hasDraft: this.hasDraft(),
            draftAge: this.getDraftAge()
        };
    }
    
    /**
     * Export all data (for debugging/backup)
     */
    exportAll() {
        return {
            draft: this.load(),
            history: this.getHistory(),
            metadata: {
                prefix: this.prefix,
                timestamp: new Date().toISOString(),
                storageInfo: this.getStorageInfo()
            }
        };
    }
    
    /**
     * Clear all data
     */
    clearAll() {
        this.clearDraft();
        localStorage.removeItem(this.historyKey);
        localStorage.removeItem(this.sessionKey);
        this.log('All data cleared');
    }
}

// Export for use in quote builders
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuotePersistence;
}