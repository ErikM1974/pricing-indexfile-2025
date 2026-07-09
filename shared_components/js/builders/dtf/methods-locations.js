/**
 * DTFQuoteBuilder prototype mixin — transfer-location model (selectedLocations + summary).
 * Batch 4.2 (2026-07-09): methods moved VERBATIM from quote-builder-class.js
 * (`this.` state intact — the class assembles via Object.assign(prototype, ...)).
 */

export const locationsMethods = {

    setupLocationListeners() {
        // Front radio buttons
        document.querySelectorAll('input[name="front-location"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateSelectedLocations());
        });

        // Back radio buttons
        document.querySelectorAll('input[name="back-location"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateSelectedLocations());
        });

        // Sleeve checkboxes
        document.querySelectorAll('input[name="sleeve-location"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedLocations());
        });
    },

    updateSelectedLocations() {
        this.selectedLocations = [];

        // Get front selection (radio)
        const frontRadio = /** @type {HTMLInputElement|null} */ (document.querySelector('input[name="front-location"]:checked'));
        if (frontRadio && frontRadio.value) {
            this.selectedLocations.push(/** @type {HTMLInputElement} */ (frontRadio).value);
        }

        // Get back selection (radio)
        const backRadio = /** @type {HTMLInputElement|null} */ (document.querySelector('input[name="back-location"]:checked'));
        if (backRadio && backRadio.value) {
            this.selectedLocations.push(/** @type {HTMLInputElement} */ (backRadio).value);
        }

        // Get sleeve selections (checkboxes)
        document.querySelectorAll('input[name="sleeve-location"]:checked').forEach(checkbox => {
            this.selectedLocations.push(/** @type {HTMLInputElement} */ (checkbox).value);
        });


        // Update UI
        this.updateLocationSummary();
        this.updateSearchState();
        this.updatePricing();

        // Mark dirty for auto-save
        if (this.persistence) {
            this.persistence.markDirty();
        }
        this.markAsUnsaved();
    },

    updateLocationSummary() {
        const locationDisplay = document.getElementById('location-display');
        const sidebarLocation = document.getElementById('sidebar-location');

        if (this.selectedLocations.length === 0) {
            if (locationDisplay) locationDisplay.textContent = 'None selected';
            if (sidebarLocation) sidebarLocation.textContent = '-';
            return;
        }

        // Build location names list
        const locationNames = this.selectedLocations.map(loc => {
            const config = this.locationConfig[loc];
            return config ? config.label : loc;
        });

        const displayText = locationNames.join(' + ');

        if (locationDisplay) locationDisplay.textContent = displayText;
        if (sidebarLocation) sidebarLocation.textContent = displayText;
    },

    /**
     * Get location codes string for display (e.g., "LC+CB" for Left Chest + Center Back)
     */
    getLocationCodesString() {
        if (this.selectedLocations.length === 0) return '--';

        const codeMap = {
            'left-chest': 'LC',
            'right-chest': 'RC',
            'left-sleeve': 'LS',
            'right-sleeve': 'RS',
            'back-of-neck': 'BN',
            'center-front': 'CF',
            'center-back': 'CB',
            'full-front': 'FF',
            'full-back': 'FB'
        };

        return this.selectedLocations.map(loc => codeMap[loc] || loc).join('+');
    },
};
