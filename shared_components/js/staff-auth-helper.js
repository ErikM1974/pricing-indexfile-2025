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
    autoSelectSalesRep(selectId = 'sales-rep') {
        const email = this.getLoggedInStaffEmail();
        if (!email) {
            console.log('[StaffAuthHelper] No logged-in staff email found');
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

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StaffAuthHelper;
}
