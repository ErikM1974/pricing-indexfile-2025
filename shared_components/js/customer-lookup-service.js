/**
 * CustomerLookupService - Autocomplete search for Company_Contacts_Merge_ODBC
 * Used by quote builders to search and auto-fill customer information
 */
class CustomerLookupService {
    constructor(options = {}) {
        this.baseURL = options.baseURL || window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.minSearchLength = options.minSearchLength || 3;
        this.debounceMs = options.debounceMs || 300;
        this.maxResults = options.maxResults || 10;

        // Debounce timer
        this.debounceTimer = null;

        // Cache for recent searches (5 min TTL)
        this.searchCache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
    }

    /**
     * Search for contacts by query string
     * @param {string} query - Search term (company name, contact name, or email)
     * @returns {Promise<Array>} - Array of matching contacts
     */
    async search(query) {
        if (!query || query.length < this.minSearchLength) {
            return [];
        }

        const cacheKey = query.toLowerCase().trim();

        // Check cache
        const cached = this.searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            const url = `${this.baseURL}/api/company-contacts/search?q=${encodeURIComponent(query)}&limit=${this.maxResults}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            const contacts = data.contacts || [];

            // Cache results
            this.searchCache.set(cacheKey, {
                data: contacts,
                timestamp: Date.now()
            });

            // Limit cache size
            if (this.searchCache.size > 50) {
                const firstKey = this.searchCache.keys().next().value;
                this.searchCache.delete(firstKey);
            }

            return contacts;

        } catch (error) {
            console.error('CustomerLookupService search error:', error);
            return [];
        }
    }

    /**
     * Debounced search - use for input events
     * @param {string} query - Search term
     * @returns {Promise<Array>} - Array of matching contacts
     */
    searchDebounced(query) {
        return new Promise((resolve) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(async () => {
                const results = await this.search(query);
                resolve(results);
            }, this.debounceMs);
        });
    }

    /**
     * Get a single contact by ID
     * @param {number} contactId - ID_Contact value
     * @returns {Promise<Object|null>} - Contact object or null
     */
    async getById(contactId) {
        try {
            const url = `${this.baseURL}/api/company-contacts/${contactId}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Fetch failed: ${response.status}`);
            }

            const data = await response.json();
            return data.contact || null;

        } catch (error) {
            console.error('CustomerLookupService getById error:', error);
            return null;
        }
    }

    /**
     * Format contact for display in dropdown
     * @param {Object} contact - Contact object
     * @returns {string} - Formatted display string
     */
    formatContactDisplay(contact) {
        const parts = [];

        if (contact.CustomerCompanyName) {
            parts.push(contact.CustomerCompanyName);
        }

        if (contact.ct_NameFull) {
            parts.push(contact.ct_NameFull);
        }

        if (contact.ContactNumbersEmail) {
            parts.push(`(${contact.ContactNumbersEmail})`);
        }

        return parts.join(' - ') || 'Unknown Contact';
    }

    /**
     * Bind autocomplete to an input field
     * @param {string} inputId - ID of the search input element
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onSelect - Called when user selects a contact
     * @param {Function} callbacks.onClear - Called when user clears the search
     */
    bindToInput(inputId, callbacks = {}) {
        const input = document.getElementById(inputId);
        if (!input) {
            console.error(`CustomerLookupService: Input #${inputId} not found`);
            return;
        }

        // Create dropdown container
        const dropdownId = `${inputId}-dropdown`;
        let dropdown = document.getElementById(dropdownId);

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = dropdownId;
            dropdown.className = 'customer-lookup-dropdown';
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(dropdown);
        }

        // Handle input events
        input.addEventListener('input', async (e) => {
            const query = e.target.value.trim();

            if (query.length < this.minSearchLength) {
                this.hideDropdown(dropdown);
                return;
            }

            // Show loading state
            dropdown.innerHTML = '<div class="customer-lookup-loading">Searching...</div>';
            dropdown.style.display = 'block';

            const contacts = await this.searchDebounced(query);

            if (contacts.length === 0) {
                dropdown.innerHTML = '<div class="customer-lookup-no-results">No customers found</div>';
                return;
            }

            // Render results
            dropdown.innerHTML = contacts.map((contact, index) => `
                <div class="customer-lookup-item" data-index="${index}">
                    <div class="customer-lookup-company">${this.escapeHtml(contact.CustomerCompanyName || 'No Company')}</div>
                    <div class="customer-lookup-details">
                        <span class="customer-lookup-name">${this.escapeHtml(contact.ct_NameFull || '')}</span>
                        ${contact.ContactNumbersEmail ? `<span class="customer-lookup-email">${this.escapeHtml(contact.ContactNumbersEmail)}</span>` : ''}
                    </div>
                </div>
            `).join('');

            // Handle item clicks
            dropdown.querySelectorAll('.customer-lookup-item').forEach((item, index) => {
                item.addEventListener('click', () => {
                    const contact = contacts[index];
                    input.value = contact.CustomerCompanyName || contact.ct_NameFull || '';
                    input.dataset.selectedContactId = contact.ID_Contact;
                    this.hideDropdown(dropdown);

                    if (callbacks.onSelect) {
                        callbacks.onSelect(contact);
                    }
                });
            });
        });

        // Handle keyboard navigation
        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.customer-lookup-item');
            if (items.length === 0) return;

            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                this.highlightItem(items, nextIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                this.highlightItem(items, prevIndex);
            } else if (e.key === 'Enter' && currentIndex >= 0) {
                e.preventDefault();
                items[currentIndex].click();
            } else if (e.key === 'Escape') {
                this.hideDropdown(dropdown);
                if (callbacks.onClear) {
                    callbacks.onClear();
                }
            }
        });

        // Hide dropdown on blur (with delay to allow click)
        input.addEventListener('blur', () => {
            setTimeout(() => this.hideDropdown(dropdown), 200);
        });

        // Show dropdown on focus if has value
        input.addEventListener('focus', () => {
            if (input.value.length >= this.minSearchLength) {
                input.dispatchEvent(new Event('input'));
            }
        });

        return {
            clear: () => {
                input.value = '';
                delete input.dataset.selectedContactId;
                this.hideDropdown(dropdown);
                if (callbacks.onClear) {
                    callbacks.onClear();
                }
            },
            getSelectedContactId: () => input.dataset.selectedContactId
        };
    }

    /**
     * Highlight dropdown item
     */
    highlightItem(items, index) {
        items.forEach(item => item.classList.remove('highlighted'));
        if (items[index]) {
            items[index].classList.add('highlighted');
            items[index].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Hide dropdown
     */
    hideDropdown(dropdown) {
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Clear the search cache
     */
    clearCache() {
        this.searchCache.clear();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomerLookupService;
}
