/**
 * Quote Session Manager
 * Manages user sessions, recent quotes, and recovery functionality
 */

class QuoteSession {
    constructor(config = {}) {
        this.prefix = config.prefix || 'QUOTE';
        this.sessionTimeout = config.sessionTimeout || 24 * 60 * 60 * 1000; // 24 hours
        this.maxRecentQuotes = config.maxRecentQuotes || 5;
        this.debug = config.debug || false;
        
        this.sessionKey = `${this.prefix}_session`;
        this.recentKey = `${this.prefix}_recent`;
        
        // Initialize or restore session
        this.session = this.initSession();
        
        // Track page visibility for better session management
        this.initVisibilityTracking();
        
        // Initialize persistence if provided
        this.persistence = config.persistence || null;
        
        this.log('QuoteSession initialized', this.session);
    }
    
    /**
     * Initialize or restore session
     */
    initSession() {
        try {
            const stored = localStorage.getItem(this.sessionKey);
            
            if (stored) {
                const session = JSON.parse(stored);
                
                // Check if session is expired
                const age = Date.now() - session.startTime;
                if (age < this.sessionTimeout) {
                    // Update last active time
                    session.lastActive = Date.now();
                    this.saveSession(session);
                    return session;
                }
            }
            
            // Create new session
            const newSession = {
                id: this.generateSessionId(),
                startTime: Date.now(),
                lastActive: Date.now(),
                quoteCount: 0,
                currentQuoteId: null
            };
            
            this.saveSession(newSession);
            return newSession;
        } catch (error) {
            console.error('[QuoteSession] Failed to init session:', error);
            return this.createNewSession();
        }
    }
    
    /**
     * Create new session
     */
    createNewSession() {
        const session = {
            id: this.generateSessionId(),
            startTime: Date.now(),
            lastActive: Date.now(),
            quoteCount: 0,
            currentQuoteId: null
        };
        
        this.saveSession(session);
        return session;
    }
    
    /**
     * Save session to localStorage
     */
    saveSession(session) {
        try {
            localStorage.setItem(this.sessionKey, JSON.stringify(session));
        } catch (error) {
            console.error('[QuoteSession] Failed to save session:', error);
        }
    }
    
    /**
     * Update session activity
     */
    updateActivity() {
        this.session.lastActive = Date.now();
        this.saveSession(this.session);
    }
    
    /**
     * Set current quote ID
     */
    setCurrentQuote(quoteId) {
        this.session.currentQuoteId = quoteId;
        this.session.quoteCount++;
        this.updateActivity();
        this.log('Current quote set', quoteId);
    }
    
    /**
     * Get session info
     */
    getSessionInfo() {
        const age = Date.now() - this.session.startTime;
        const remaining = Math.max(0, this.sessionTimeout - age);
        
        return {
            id: this.session.id,
            age: this.formatDuration(age),
            remaining: this.formatDuration(remaining),
            quoteCount: this.session.quoteCount,
            currentQuoteId: this.session.currentQuoteId,
            isExpired: age >= this.sessionTimeout
        };
    }
    
    /**
     * Check if should show recovery prompt
     */
    shouldShowRecovery() {
        // Check if there's a draft
        if (this.persistence && this.persistence.hasDraft()) {
            const draftAge = this.persistence.getDraftAge();
            this.log('Draft found', { age: draftAge });
            return true;
        }
        
        return false;
    }
    
    /**
     * Show recovery dialog
     */
    showRecoveryDialog(onRestore, onDiscard) {
        if (!this.persistence || !this.persistence.hasDraft()) {
            return false;
        }
        
        const draftAge = this.persistence.getDraftAge();
        const draft = this.persistence.load();
        
        // Create recovery modal
        const modal = document.createElement('div');
        modal.className = 'recovery-modal';
        modal.innerHTML = `
            <div class="recovery-modal-backdrop"></div>
            <div class="recovery-modal-content">
                <div class="recovery-modal-header">
                    <h3>🔄 Restore Previous Session?</h3>
                </div>
                <div class="recovery-modal-body">
                    <p>We found an unsaved quote from <strong>${draftAge}</strong>.</p>
                    ${draft.customerName ? `<p>Customer: <strong>${draft.customerName}</strong></p>` : ''}
                    ${draft.items && draft.items.length > 0 ? `<p>Products: <strong>${draft.items.length} item(s)</strong></p>` : ''}
                    <p>Would you like to continue where you left off?</p>
                </div>
                <div class="recovery-modal-footer">
                    <button class="btn btn-secondary" id="recovery-discard">Start Fresh</button>
                    <button class="btn btn-primary" id="recovery-restore">Restore Draft</button>
                </div>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('recovery-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'recovery-modal-styles';
            styles.innerHTML = `
                .recovery-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease;
                }
                
                .recovery-modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                }
                
                .recovery-modal-content {
                    position: relative;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    width: 90%;
                    animation: slideUp 0.3s ease;
                }
                
                .recovery-modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .recovery-modal-header h3 {
                    margin: 0;
                    color: #003f7f;
                    font-size: 20px;
                }
                
                .recovery-modal-body {
                    padding: 20px;
                }
                
                .recovery-modal-body p {
                    margin: 10px 0;
                    color: #495057;
                }
                
                .recovery-modal-footer {
                    padding: 20px;
                    border-top: 1px solid #e9ecef;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add to DOM
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('recovery-restore').addEventListener('click', () => {
            modal.remove();
            if (onRestore) onRestore(draft);
            this.log('Draft restored');
        });
        
        document.getElementById('recovery-discard').addEventListener('click', () => {
            modal.remove();
            this.persistence.clearDraft();
            if (onDiscard) onDiscard();
            this.log('Draft discarded');
        });
        
        // Close on backdrop click
        modal.querySelector('.recovery-modal-backdrop').addEventListener('click', () => {
            modal.remove();
            if (onDiscard) onDiscard();
        });
        
        return true;
    }
    
    /**
     * Add quote to recent list
     */
    addToRecent(quoteData) {
        try {
            const recent = this.getRecentQuotes();
            
            // Add new quote to beginning
            recent.unshift({
                id: quoteData.quoteId,
                customerName: quoteData.customerName,
                companyName: quoteData.companyName,
                total: quoteData.grandTotal,
                timestamp: Date.now(),
                itemCount: quoteData.items ? quoteData.items.length : 0
            });
            
            // Keep only last N quotes
            if (recent.length > this.maxRecentQuotes) {
                recent.splice(this.maxRecentQuotes);
            }
            
            localStorage.setItem(this.recentKey, JSON.stringify(recent));
            this.log('Added to recent', { id: quoteData.quoteId });
        } catch (error) {
            console.error('[QuoteSession] Failed to add to recent:', error);
        }
    }
    
    /**
     * Get recent quotes
     */
    getRecentQuotes() {
        try {
            const stored = localStorage.getItem(this.recentKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('[QuoteSession] Failed to get recent:', error);
            return [];
        }
    }
    
    /**
     * Create recent quotes dropdown
     */
    createRecentDropdown(containerId, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const recent = this.getRecentQuotes();
        if (recent.length === 0) return;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'recent-quotes-dropdown';
        dropdown.innerHTML = `
            <button class="recent-quotes-toggle" type="button">
                <i class="fas fa-history"></i> Recent Quotes
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="recent-quotes-menu" style="display: none;">
                ${recent.map(quote => `
                    <div class="recent-quote-item" data-quote-id="${quote.id}">
                        <div class="recent-quote-info">
                            <strong>${quote.id}</strong>
                            <span>${quote.customerName || 'Unknown'}</span>
                            ${quote.companyName ? `<span class="text-muted">${quote.companyName}</span>` : ''}
                        </div>
                        <div class="recent-quote-meta">
                            <span>$${quote.total.toFixed(2)}</span>
                            <span>${this.formatAge(Date.now() - quote.timestamp)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add styles if not present
        if (!document.getElementById('recent-dropdown-styles')) {
            const styles = document.createElement('style');
            styles.id = 'recent-dropdown-styles';
            styles.innerHTML = `
                .recent-quotes-dropdown {
                    position: relative;
                    display: inline-block;
                }
                
                .recent-quotes-toggle {
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    padding: 8px 15px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #495057;
                    transition: all 0.2s;
                }
                
                .recent-quotes-toggle:hover {
                    background: #f8f9fa;
                    border-color: #003f7f;
                    color: #003f7f;
                }
                
                .recent-quotes-menu {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 5px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    min-width: 300px;
                    max-height: 400px;
                    overflow-y: auto;
                    z-index: 1000;
                }
                
                .recent-quote-item {
                    padding: 12px 15px;
                    border-bottom: 1px solid #e9ecef;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .recent-quote-item:hover {
                    background: #f8f9fa;
                }
                
                .recent-quote-item:last-child {
                    border-bottom: none;
                }
                
                .recent-quote-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .recent-quote-info strong {
                    color: #003f7f;
                }
                
                .recent-quote-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 5px;
                    font-size: 0.875em;
                    color: #6c757d;
                }
            `;
            document.head.appendChild(styles);
        }
        
        container.appendChild(dropdown);
        
        // Toggle menu
        const toggle = dropdown.querySelector('.recent-quotes-toggle');
        const menu = dropdown.querySelector('.recent-quotes-menu');
        
        toggle.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
        
        // Handle selection
        dropdown.querySelectorAll('.recent-quote-item').forEach(item => {
            item.addEventListener('click', () => {
                const quoteId = item.dataset.quoteId;
                menu.style.display = 'none';
                if (onSelect) onSelect(quoteId);
            });
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }
    
    /**
     * Track page visibility
     */
    initVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateActivity();
                this.log('Page became visible, activity updated');
            }
        });
        
        // Update activity on user interaction
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                this.updateActivity();
            }, { passive: true, capture: true });
        });
    }
    
    /**
     * Generate session ID
     */
    generateSessionId() {
        return `${this.prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Format duration
     */
    formatDuration(ms) {
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
    
    /**
     * Format age
     */
    formatAge(ms) {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
    
    /**
     * Debug logging
     */
    log(...args) {
        if (this.debug) {
            console.log(`[QuoteSession:${this.prefix}]`, ...args);
        }
    }
    
    /**
     * Clear session
     */
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.recentKey);
        this.session = this.createNewSession();
        this.log('Session cleared');
    }
}

// Export for use in quote builders
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteSession;
}