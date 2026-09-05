/**
 * Staff Authentication Helper
 *
 * Utility for auto-selecting sales rep based on staff dashboard login.
 * Uses sessionStorage values set by staff-dashboard.html when user logs in.
 *
 * Created: 2026-01-13 (Quote builder feature parity consolidation)
 */

const StaffAuthHelper = {
    /**
     * Staff name to email mapping
     * Used when sessionStorage only has name but we need email for dropdown
     */
    STAFF_EMAIL_MAP: {
        'Adriyella': 'adriyella@nwcustomapparel.com',
        'Bradley Wright': 'bradley@nwcustomapparel.com',
        'Erik Mickelson': 'erik@nwcustomapparel.com',
        'Jim Mickelson': 'jim@nwcustomapparel.com',
        'Nika Lao': 'nika@nwcustomapparel.com',
        'Ruth Nhong': 'ruth@nwcustomapparel.com',
        'Steve Deland': 'art@nwcustomapparel.com',
        'Taneisha Clark': 'taneisha@nwcustomapparel.com'
    },

    /**
     * SAML hydration (2026-09-05). The staff dashboard mirrors the SAML identity into the
     * sessionStorage keys below, but sessionStorage is per TAB: a bookmarked, typed or
     * new-tab (rel=noopener) open of any staff page arrives with nothing — Quote Management
     * showed "Guest" with every delete disabled, quote builders left the rep unpicked,
     * detail pages posted notes as "Staff". ready() asks /api/crm-session/me once, writes
     * the keys, resolves true when signed in. Kicked off at script load; callers that read
     * identity at init should `await StaffAuthHelper.ready()` (or listen for
     * 'staff-auth:ready'). Never throws.
     * @returns {Promise<boolean>} true when a staff session is known
     */
    _readyPromise: null,
    ready() {
        if (this._readyPromise) return this._readyPromise;
        if (this.isLoggedIn()) { this._readyPromise = Promise.resolve(true); return this._readyPromise; }
        if (typeof fetch !== 'function') { this._readyPromise = Promise.resolve(false); return this._readyPromise; }
        this._readyPromise = fetch('/api/crm-session/me', { credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : null))
            .then((me) => {
                if (!me || me.authenticated === false || !(me.name || me.email)) return false;
                sessionStorage.setItem('nwca_user_name', String(me.name || me.firstName || ''));
                sessionStorage.setItem('nwca_user_email', String(me.email || ''));
                if (me.role) sessionStorage.setItem('nwca_user_role', String(me.role));
                try { document.dispatchEvent(new CustomEvent('staff-auth:ready', { detail: me })); } catch (_) { /* old browsers */ }
                return true;
            })
            .catch(() => false);
        return this._readyPromise;
    },

    /**
     * Get the logged-in staff member's email
     * Checks sessionStorage for nwca_user_email or maps from nwca_user_name
     * @returns {string|null} Staff email or null if not logged in
     */
    getLoggedInStaffEmail() {
        // First try direct email from sessionStorage
        const email = sessionStorage.getItem('nwca_user_email');
        if (email) {
            return email;
        }

        // Fallback: Map from user name
        const userName = sessionStorage.getItem('nwca_user_name');
        if (userName && this.STAFF_EMAIL_MAP[userName]) {
            return this.STAFF_EMAIL_MAP[userName];
        }

        return null;
    },

    /**
     * Get the logged-in staff member's display name
     * @returns {string|null} Staff name or null if not logged in
     */
    getLoggedInStaffName() {
        return sessionStorage.getItem('nwca_user_name') || null;
    },

    /**
     * Check if a user is logged in via staff dashboard
     * @returns {boolean} True if user session exists
     */
    isLoggedIn() {
        return !!(sessionStorage.getItem('nwca_user_name') || sessionStorage.getItem('nwca_user_email'));
    },

    /**
     * Auto-select the sales rep dropdown based on logged-in staff
     * @param {string} selectId - The ID of the select element (default: 'sales-rep')
     * @returns {boolean} True if auto-selection was successful
     */
    autoSelectSalesRep(selectId = 'sales-rep', _retried = false) {
        const email = this.getLoggedInStaffEmail();
        if (!email) {
            // Not hydrated yet (fresh tab) — pick the rep once the SAML identity lands.
            // Without this every quote builder opened from a bookmark left the rep blank
            // and the quote's SalesRepEmail fell to sales@ (2026-09-05).
            if (!_retried) this.ready().then((ok) => { if (ok) this.autoSelectSalesRep(selectId, true); });
            return false;
        }

        const select = document.getElementById(selectId);
        if (!select) {
            console.log(`[StaffAuthHelper] Select element #${selectId} not found`);
            return false;
        }

        // Find matching option by value (email)
        const options = Array.from(select.options);
        const matchingOption = options.find(opt => opt.value === email);

        if (matchingOption) {
            select.value = email;
            console.log(`[StaffAuthHelper] Auto-selected sales rep: ${matchingOption.text} (${email})`);
            return true;
        } else {
            console.log(`[StaffAuthHelper] No matching option found for: ${email}`);
            return false;
        }
    },

    /**
     * Get session info for debugging
     * @returns {Object} Session info object
     */
    getSessionInfo() {
        return {
            name: sessionStorage.getItem('nwca_user_name'),
            email: sessionStorage.getItem('nwca_user_email'),
            role: sessionStorage.getItem('nwca_user_role'),
            isLoggedIn: this.isLoggedIn()
        };
    }
};

// Hydrate from the SAML session as soon as the script loads (browser only).
if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' && typeof fetch === 'function') {
    StaffAuthHelper.ready();
}

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StaffAuthHelper;
}
