        // ========================================
        // Phase Navigation & Location Selection
        // ========================================

        let currentPhase = 1;
        let selectedLocation = null;  // Will be 'LC', 'FF', 'LC_FB', or 'FF_FB'
        let selectedLocations = [];   // Array of selected location codes

        // ========================================
        // Service Layer Initialization (Tier 1)
        // ========================================
        const apiService = new ApiService({
            baseURL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
            retryAttempts: 3,
            retryDelay: 1000,
            timeout: 30000,
            logRequests: true
        });

        const inventoryService = new InventoryService(apiService, {
            cacheTTL: 5 * 60 * 1000, // 5 minutes
            cachePrefix: 'inv_cache_',
            enableLogging: true
        });

        /**
         * Handle location toggle clicks
         */
        function handleToggleLocation(locationCode) {
            const toggle = document.getElementById(`toggle-${locationCode}`);
            const isCurrentlyActive = toggle.classList.contains('active');

            if (isCurrentlyActive) {
                // Deactivate this location
                selectedLocations = selectedLocations.filter(loc => loc !== locationCode);
                toggle.classList.remove('active');
                toggle.querySelector('.toggle-switch')?.classList.remove('on');
            } else {
                // Activate this location

                // Handle mutual exclusivity: LC and FF cannot both be selected
                if (locationCode === 'LC' && selectedLocations.includes('FF')) {
                    // User clicked LC while FF is active - deactivate FF
                    selectedLocations = selectedLocations.filter(loc => loc !== 'FF');
                    const ffToggle = document.getElementById('toggle-FF');
                    ffToggle.classList.remove('active');
                    ffToggle.querySelector('.toggle-switch')?.classList.remove('on');
                } else if (locationCode === 'FF' && selectedLocations.includes('LC')) {
                    // User clicked FF while LC is active - deactivate LC
                    selectedLocations = selectedLocations.filter(loc => loc !== 'LC');
                    const lcToggle = document.getElementById('toggle-LC');
                    lcToggle.classList.remove('active');
                    lcToggle.querySelector('.toggle-switch')?.classList.remove('on');
                }

                // Add the new location
                selectedLocations.push(locationCode);
                toggle.classList.add('active');
                toggle.querySelector('.toggle-switch')?.classList.add('on');
            }

            // Update UI based on new selection state
            updateToggleUI();
            updateLocationDisplay();
            updatePricingTable();  // Update pricing table when location changes
            updateContinueButton();
        }

        /**
         * Update toggle UI states
         */
        function updateToggleUI() {
            // Ensure toggle classes match selectedLocations array
            ['LC', 'FF', 'FB'].forEach(loc => {
                const toggle = document.getElementById(`toggle-${loc}`);
                const toggleSwitch = toggle?.querySelector('.toggle-switch');
                if (selectedLocations.includes(loc)) {
                    toggle.classList.add('active');
                    toggleSwitch?.classList.add('on');
                } else {
                    toggle.classList.remove('active');
                    toggleSwitch?.classList.remove('on');
                }
            });
        }

        /**
         * Update the selected location display box
         */
        function updateLocationDisplay() {
            const displayBox = document.getElementById('selected-location-display');
            const displayText = document.getElementById('selected-location-text');

            if (selectedLocations.length === 0) {
                displayBox.style.display = 'none';
                selectedLocation = null;
                return;
            }

            // Determine final location string
            const hasFront = selectedLocations.includes('LC') || selectedLocations.includes('FF');
            const hasBack = selectedLocations.includes('FB');

            if (!hasFront) {
                // Only FB selected (not valid - should have front location)
                displayBox.style.display = 'none';
                selectedLocation = null;
                return;
            }

            const frontLocation = selectedLocations.includes('LC') ? 'LC' : 'FF';

            if (hasBack) {
                selectedLocation = `${frontLocation}_FB`;
                const frontName = frontLocation === 'LC' ? 'Left Chest' : 'Full Front';
                displayText.textContent = `${frontName} + Full Back`;
            } else {
                selectedLocation = frontLocation;
                displayText.textContent = frontLocation === 'LC' ? 'Left Chest' : 'Full Front';
            }

            displayBox.style.display = 'block';
        }

        /**
         * Update pricing table based on selected location
         */
        function updatePricingTable() {
            const pricingTableBody = document.getElementById('pricing-table-body');
            const pricingTableContainer = document.getElementById('pricing-info-table');

            // Validation: Check if elements exist
            if (!pricingTableBody || !pricingTableContainer) {
                console.warn('[PricingTable] Table elements not found');
                return;
            }

            // Validation: Only show table if location is selected
            if (!selectedLocation) {
                pricingTableContainer.style.display = 'none';
                console.log('[PricingTable] Hidden - no location selected');
                return;
            }

            // Validation: Check pricing data is loaded
            if (!state.pricingData || !state.pricingData.tiersR || !state.pricingData.allDtgCostsR) {
                console.warn('[PricingTable] Pricing data not loaded yet');
                pricingTableContainer.style.display = 'none';
                return;
            }

            console.log('[PricingTable] Updating for location:', selectedLocation);

            // Define tiers (tier 1 uses tier 2 pricing per user requirement)
            const tiers = [
                { range: '1-23 pieces', qty: 24, note: '+$75 LTM fee applies' },
                { range: '24-47 pieces', qty: 24, note: '' },
                { range: '48-71 pieces', qty: 48, note: '' },
                { range: '72+ pieces', qty: 72, note: '' }
            ];

            // Calculate pricing for each tier using Medium size as base
            let rows = '';
            let hasErrors = false;

            tiers.forEach((tier, index) => {
                try {
                    // Calculate price for this tier using Medium size
                    const pricing = calculatePrice(tier.qty, selectedLocation, 'M');

                    // Validation: Check if price was calculated
                    if (!pricing || pricing.finalPrice === 0) {
                        console.warn(`[PricingTable] Zero price for tier ${index + 1}:`, tier.range);
                        hasErrors = true;
                        return;
                    }

                    const priceDisplay = `$${pricing.finalPrice.toFixed(2)}`;

                    // Log for debugging
                    console.log(`[PricingTable] Tier ${index + 1} (${tier.range}):`, {
                        qty: tier.qty,
                        location: selectedLocation,
                        price: priceDisplay,
                        breakdown: {
                            base: pricing.basePrice.toFixed(2),
                            rush: pricing.rushFee.toFixed(2),
                            final: pricing.finalPrice.toFixed(2)
                        }
                    });

                    // Build table row
                    rows += `
                        <tr style="border-top: 1px solid #e5e7eb;">
                            <td style="padding: 12px; color: #374151;">${tier.range}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600; color: #059669; font-size: 1.125rem;">${priceDisplay}</td>
                            <td style="padding: 12px; color: #6b7280; font-size: 0.875rem;">${tier.note}</td>
                        </tr>
                    `;
                } catch (error) {
                    console.error(`[PricingTable] Error calculating tier ${index + 1}:`, error);
                    hasErrors = true;
                }
            });

            // Only show table if we successfully calculated all prices
            if (rows && !hasErrors) {
                pricingTableBody.innerHTML = rows;
                pricingTableContainer.style.display = 'block';
                console.log('[PricingTable] ✓ Table updated successfully');
            } else {
                pricingTableContainer.style.display = 'none';
                console.error('[PricingTable] Failed to generate pricing table');
            }
        }

        /**
         * Update continue button state
         */
        function updateContinueButton() {
            const continueBtn = document.getElementById('continue-to-products');

            // Button enabled if we have a valid location selection
            if (selectedLocation) {
                continueBtn.disabled = false;
            } else {
                continueBtn.disabled = true;
            }
        }

        /**
         * Move to a specific phase
         */
        function moveToPhase(newPhase) {
            // Hide all phase sections
            document.querySelectorAll('.phase-section').forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active');
            });

            // Show the target phase
            let targetPhaseId;
            if (newPhase === 1) targetPhaseId = 'location-phase';
            else if (newPhase === 2) targetPhaseId = 'product-phase';
            else if (newPhase === 3) targetPhaseId = 'checkout-phase';
            else if (newPhase === 4) targetPhaseId = 'review-phase';

            const targetSection = document.getElementById(targetPhaseId);
            if (targetSection) {
                targetSection.style.display = 'block';
                targetSection.classList.add('active');
            }

            // Update phase navigation indicator
            document.querySelectorAll('.phase-step').forEach((step, index) => {
                step.classList.remove('active', 'completed');
                const stepNumber = index + 1;

                if (stepNumber < newPhase) {
                    step.classList.add('completed');
                } else if (stepNumber === newPhase) {
                    step.classList.add('active');
                }
            });

            // Update phase connectors
            document.querySelectorAll('.phase-connector').forEach((connector, index) => {
                const connectorNumber = index + 1;
                if (connectorNumber < newPhase) {
                    connector.classList.add('completed');
                } else {
                    connector.classList.remove('completed');
                }
            });

            currentPhase = newPhase;

            // If moving to Phase 2, update the location display in the header
            if (newPhase === 2) {
                const phase2LocationSpan = document.getElementById('phase2-location');
                if (phase2LocationSpan && selectedLocation) {
                    const locationNames = {
                        'LC': 'Left Chest',
                        'FF': 'Full Front',
                        'LC_FB': 'Left Chest + Full Back',
                        'FF_FB': 'Full Front + Full Back'
                    };
                    phase2LocationSpan.textContent = locationNames[selectedLocation] || selectedLocation;
                }
            }

            // If moving to Phase 3 (checkout), update the checkout summary from state
            if (newPhase === 3) {
                updateOrderSummaryDOM();
            }

            // If moving to Phase 4 (review), update the review summary from state
            if (newPhase === 4) {
                updateReviewSummaryDOM();
            }

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ========================================
        // Event Listeners (Phase Navigation)
        // ========================================

        // Initialize event listeners for UI controls
        function initEventListeners() {
            // Location toggle event listeners
            document.querySelectorAll('.toggle-item').forEach(toggle => {
                toggle.addEventListener('click', function() {
                    const locationCode = this.dataset.location;
                    handleToggleLocation(locationCode);
                });
            });

            // Continue to products button
            const continueBtn = document.getElementById('continue-to-products');
            if (continueBtn) {
                continueBtn.addEventListener('click', function() {
                    if (selectedLocation) {
                        moveToPhase(2);
                        // Pricing will be recalculated when products are loaded/added
                    }
                });
            }

            // ========================================
            // Clickable Phase Navigation (Backward Only)
            // ========================================

            // Phase 1 indicator - clickable when on Phase 2 or 3
            const phase1Nav = document.getElementById('phase-1-nav');
            if (phase1Nav) {
                phase1Nav.addEventListener('click', function() {
                    if (currentPhase > 1) {
                        console.log('[Navigation] User clicked Step 1 from Step', currentPhase);
                        moveToPhase(1);
                    }
                });
            }

            // Phase 2 indicator - clickable when on Phase 3
            const phase2Nav = document.getElementById('phase-2-nav');
            if (phase2Nav) {
                phase2Nav.addEventListener('click', function() {
                    if (currentPhase > 2) {
                        console.log('[Navigation] User clicked Step 2 from Step', currentPhase);
                        moveToPhase(2);
                    }
                });
            }

            // Phase 3 indicator - not clickable (shows current state only)
            // No click handler needed - user is already on Step 3

            // ========================================
            // "Same as Shipping" Checkbox Handler
            // ========================================
            const sameAsShippingCheckbox = document.getElementById('sameAsShipping');
            if (sameAsShippingCheckbox) {
                sameAsShippingCheckbox.addEventListener('change', function() {
                    const billingFields = document.getElementById('billingAddressFields');

                    if (this.checked) {
                        // Copy shipping address to billing address
                        const address1 = document.getElementById('address1');
                        const city = document.getElementById('city');
                        const state = document.getElementById('state');
                        const zip = document.getElementById('zip');

                        const billingAddress1 = document.getElementById('billingAddress1');
                        const billingCity = document.getElementById('billingCity');
                        const billingState = document.getElementById('billingState');
                        const billingZip = document.getElementById('billingZip');

                        if (address1) billingAddress1.value = address1.value;
                        if (city) billingCity.value = city.value;
                        if (state) billingState.value = state.value;
                        if (zip) billingZip.value = zip.value;

                        // Disable and dim billing fields to show they're auto-filled
                        if (billingFields) {
                            billingFields.style.opacity = '0.5';
                            billingFields.querySelectorAll('input').forEach(input => {
                                input.disabled = true;
                                input.removeAttribute('required'); // Remove required while disabled
                            });
                        }

                        console.log('[3DayTees] Billing address copied from shipping address');
                    } else {
                        // Enable billing fields for manual entry
                        if (billingFields) {
                            billingFields.style.opacity = '1';
                            billingFields.querySelectorAll('input').forEach(input => {
                                input.disabled = false;
                                input.setAttribute('required', 'required'); // Restore required
                            });
                        }

                        console.log('[3DayTees] Billing address fields enabled for manual entry');
                    }
                });
            }

            // ========================================
            // State Field Change - Trigger Sales Tax Recalculation
            // ========================================
            const stateField = document.getElementById('state');
            if (stateField) {
                const debouncedRecalculate = debounce(function() {
                    // Recalculate pricing when state changes (affects sales tax)
                    recalculateAllPricing();
                    console.log('[3DayTees] State changed to:', this.value, '- sales tax recalculated');
                }, 300); // 300ms delay to prevent excessive calculations during typing

                stateField.addEventListener('input', debouncedRecalculate);
            }

            // ========================================
            // Continue to Review Button (Phase 3 → Phase 4)
            // ========================================
            const continueToReviewBtn = document.getElementById('continueToReview');
            if (continueToReviewBtn) {
                continueToReviewBtn.addEventListener('click', function() {
                    console.log('[3DayTees] Validating checkout form...');

                    // Manual field-by-field validation
                    const fieldsToValidate = [
                        { id: 'firstName', label: 'First Name', pattern: /^.{2,}$/, message: 'First name must be at least 2 characters' },
                        { id: 'lastName', label: 'Last Name', pattern: /^.{2,}$/, message: 'Last name must be at least 2 characters' },
                        { id: 'email', label: 'Email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address' },
                        { id: 'phone', label: 'Phone', pattern: /^[\d\s\-\(\)]+$/, message: 'Please enter a valid phone number' },
                        { id: 'address1', label: 'Street Address', pattern: /^.{5,}$/, message: 'Street address must be at least 5 characters' },
                        { id: 'city', label: 'City', pattern: /^.{2,}$/, message: 'City must be at least 2 characters' },
                        { id: 'state', label: 'State', pattern: /^[A-Za-z]{2}$/, message: 'State must be 2 letters (e.g., WA)' },
                        { id: 'zip', label: 'ZIP Code', pattern: /^\d{5}$/, message: 'ZIP code must be 5 digits' }
                    ];

                    // Check if billing address validation is needed
                    const sameAsShipping = document.getElementById('sameAsShipping');
                    const needsBillingValidation = sameAsShipping && !sameAsShipping.checked;

                    if (needsBillingValidation) {
                        fieldsToValidate.push(
                            { id: 'billingAddress1', label: 'Billing Street Address', pattern: /^.{5,}$/, message: 'Billing street address must be at least 5 characters' },
                            { id: 'billingCity', label: 'Billing City', pattern: /^.{2,}$/, message: 'Billing city must be at least 2 characters' },
                            { id: 'billingState', label: 'Billing State', pattern: /^[A-Za-z]{2}$/, message: 'Billing state must be 2 letters (e.g., WA)' },
                            { id: 'billingZip', label: 'Billing ZIP Code', pattern: /^\d{5}$/, message: 'Billing ZIP code must be 5 digits' }
                        );
                    }

                    // Validate all fields
                    let isValid = true;
                    let firstInvalidField = null;
                    let firstErrorMessage = '';

                    fieldsToValidate.forEach(field => {
                        const input = document.getElementById(field.id);
                        if (!input) {
                            console.warn(`[3DayTees] Field not found: ${field.id}`);
                            return;
                        }

                        const value = input.value.trim();
                        const fieldValid = value !== '' && field.pattern.test(value);

                        // Apply visual feedback
                        if (fieldValid) {
                            input.classList.remove('is-invalid');
                            input.classList.add('is-valid');
                        } else {
                            input.classList.remove('is-valid');
                            input.classList.add('is-invalid');
                            isValid = false;

                            // Track first invalid field
                            if (!firstInvalidField) {
                                firstInvalidField = input;
                                firstErrorMessage = field.message;
                            }
                        }
                    });

                    if (isValid) {
                        console.log('[3DayTees] ✓ All fields valid - Moving to review phase');
                        moveToPhase(4);
                    } else {
                        console.log('[3DayTees] ✗ Validation failed');

                        // Scroll to first invalid field and focus it
                        if (firstInvalidField) {
                            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                firstInvalidField.focus();
                            }, 300);
                        }

                        // Show error message
                        alert(`Please fix the following error:\n\n${firstErrorMessage}`);
                    }
                });
            }

            console.log('[Navigation] Clickable step indicators initialized');
        }

        // Initialize Stripe (will be set after loading config)
        let stripe = null;
        let cardElement = null;
        let paymentIntentClientSecret = null;
        let isProcessingPayment = false;  // Flag to prevent duplicate payment processing

        // Load Stripe publishable key from server and initialize
        async function initializeStripe() {
            try {
                console.log('[3-Day Tees] Initializing Stripe via ApiService...');
                const { publishableKey } = await apiService.get('/api/stripe-config');
                console.log('[3-Day Tees] ✓ Stripe config loaded');
                stripe = Stripe(publishableKey);

                // Create Stripe Elements
                const elements = stripe.elements();
                cardElement = elements.create('card', {
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#1f2937',
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            '::placeholder': {
                                color: '#9ca3af'
                            }
                        },
                        invalid: {
                            color: '#ef4444'
                        }
                    }
                });

                // Mount card element when payment modal is shown
                // (We'll mount it when the modal opens)
            } catch (error) {
                console.error('[Stripe] Failed to initialize:', error);
                showToast('Payment system initialization failed. Please refresh the page.', 'error');
            }
        }

        // Initialize third-party services (EmailJS and Stripe)
        function initThirdPartyServices() {
            // Initialize EmailJS
            emailjs.init('4qSbDO-SQs19TbP80');

            // Initialize Stripe payment processing
            initializeStripe();
        }

        // Toast Notification System
        function showToast(message, type = 'info', duration = 5000) {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            // Icon based on type
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            // Title based on type
            const titles = {
                success: 'Success',
                error: 'Error',
                warning: 'Warning',
                info: 'Information'
            };

            toast.innerHTML = `
                <i class="fas ${icons[type]} toast-icon"></i>
                <div class="toast-content">
                    <div class="toast-title">${titles[type]}</div>
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(toast);

            // Auto-remove after duration
            if (duration > 0) {
                setTimeout(() => {
                    toast.classList.add('hiding');
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }

            return toast;
        }

        // Update existing toast message (used for upload progress)
        function updateToast(toastElement, message, type = 'info') {
            if (!toastElement) return;

            const messageDiv = toastElement.querySelector('.toast-message');
            if (messageDiv) {
                messageDiv.textContent = message;
            }

            // Update toast type if changed
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            const iconElement = toastElement.querySelector('.toast-icon');
            if (iconElement && type) {
                iconElement.className = `fas ${icons[type]} toast-icon`;
                toastElement.className = `toast ${type}`;
            }
        }

        // Close toast manually
        function closeToast(toastElement) {
            if (!toastElement) return;

            toastElement.classList.add('hiding');
            setTimeout(() => toastElement.remove(), 300);
        }

        // Inventory cache configuration
        const INVENTORY_CACHE_KEY = '3day_tees_inventory_cache';
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
        const CACHE_VERSION = 3; // Increment to invalidate old cache format (v3: force fresh API calls)

        // Helper: Load inventory cache from sessionStorage
        function loadInventoryCacheFromStorage() {
            try {
                const cached = sessionStorage.getItem(INVENTORY_CACHE_KEY);
                if (!cached) return {};

                const data = JSON.parse(cached);
                const now = Date.now();

                // Filter out expired, old version, and invalid entries
                const validCache = {};
                let expiredCount = 0;
                let expiredColors = [];
                let invalidCount = 0;
                let invalidReasons = [];

                for (const [color, entry] of Object.entries(data)) {
                    // Check 1: TTL validation
                    if (!entry.timestamp || (now - entry.timestamp >= CACHE_TTL)) {
                        expiredCount++;
                        expiredColors.push(color);
                        continue;
                    }

                    // Check 2: Cache version validation (CRITICAL FIX)
                    if (!entry.cacheVersion || entry.cacheVersion !== CACHE_VERSION) {
                        invalidCount++;
                        invalidReasons.push(`${color} (old version: ${entry.cacheVersion || 'none'})`);
                        console.warn(`[3-Day Tees] Discarding ${color} cache - wrong version (expected ${CACHE_VERSION}, got ${entry.cacheVersion || 'none'})`);
                        continue;
                    }

                    // Check 3: Data integrity validation (CRITICAL FIX)
                    if (entry.sizeInventory) {
                        const allSizes = Object.values(entry.sizeInventory);
                        const totalInventory = allSizes.reduce((sum, qty) => sum + (qty || 0), 0);

                        if (totalInventory === 0 && allSizes.length > 0) {
                            invalidCount++;
                            invalidReasons.push(`${color} (all sizes zero)`);
                            console.warn(`[3-Day Tees] Discarding ${color} cache - all inventory is zero (suspicious/stale)`);
                            continue;
                        }
                    }

                    // All checks passed - cache entry is valid
                    validCache[color] = entry;
                    const age = Math.round((now - entry.timestamp) / 1000);
                    console.log(`[3-Day Tees] Cache for ${color}: age=${age}s, total=${entry.total || 0}, version=${entry.cacheVersion}`);
                }

                // Log and clean up invalid entries
                if (expiredCount > 0) {
                    console.log(`[3-Day Tees] Removed ${expiredCount} expired cache entries:`, expiredColors);
                }
                if (invalidCount > 0) {
                    console.warn(`[3-Day Tees] Removed ${invalidCount} invalid/stale cache entries:`, invalidReasons);
                }

                // Save the filtered cache back to remove expired/invalid entries
                if (expiredCount > 0 || invalidCount > 0) {
                    if (Object.keys(validCache).length > 0) {
                        sessionStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(validCache));
                    } else {
                        sessionStorage.removeItem(INVENTORY_CACHE_KEY);
                    }
                }

                console.log(`[3-Day Tees] Loaded ${Object.keys(validCache).length} valid cached inventory entries from sessionStorage`);
                return validCache;
            } catch (error) {
                console.error('[3-Day Tees] Error loading cache from sessionStorage:', error);
                return {};
            }
        }

        // Helper: Save inventory cache to sessionStorage
        function saveInventoryCacheToStorage(cache) {
            try {
                sessionStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(cache));
            } catch (error) {
                console.error('[3-Day Tees] Error saving cache to sessionStorage:', error);
            }
        }

        // Helper: Clear inventory cache and refresh
        async function clearInventoryCache() {
            console.log('[3-Day Tees] Clearing inventory cache...');

            // Clear sessionStorage
            sessionStorage.removeItem(INVENTORY_CACHE_KEY);

            // Clear in-memory cache
            state.inventoryCache = {};

            // Get button reference for progress updates
            const button = event.target?.closest('button');
            const originalText = button?.innerHTML || '<i class="fas fa-sync"></i> Refresh Inventory';

            // NEW: Use bulk endpoint for instant refresh (no delays!)
            if (button) {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                button.disabled = true;
            }

            console.log('[3-Day Tees] Refreshing inventory via bulk endpoint...');

            try {
                // Initialize inventory using bulk endpoint (1 call instead of 15!)
                const success = await initializeInventory();

                if (success) {
                    console.log('[3-Day Tees] ✓ Inventory refreshed successfully');
                } else {
                    console.warn('[3-Day Tees] Bulk refresh failed, falling back to individual fetches');
                    // Fallback: reload individual colors if bulk fails
                    for (const catalogColor of state.selectedColors) {
                        try {
                            delete state.inventoryCache[catalogColor];
                            await loadSizeInventory(catalogColor);
                        } catch (error) {
                            console.error(`[3-Day Tees] Failed to load ${catalogColor}:`, error);
                        }
                    }
                }
            } catch (error) {
                console.error('[3-Day Tees] Error during refresh:', error);
            }

            // Show success feedback
            if (button) {
                button.innerHTML = '<i class="fas fa-check"></i> Refreshed!';
                button.disabled = true;
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                }, 2000);
            }
        }

        // State - MULTI-COLOR SUPPORT
        const state = {
            selectedColors: [],           // Array of catalog colors (multi-color support)
            colorConfigs: {},             // Object keyed by catalogColor with per-color state
                                         // Structure: { 'Jet Black': { displayColor, catalogColor, sizeBreakdown, totalQuantity, images }, ... }
            selectedLocation: null,       // Front location: 'LC' or 'FF'
            hasBackPrint: false,          // Optional back print: true/false
            pricingData: null,
            uploadedFiles: [],
            frontLogo: null,              // Front logo file object (required)
            backLogo: null,               // Back logo file object (optional)
            inventoryCache: loadInventoryCacheFromStorage(),  // Load cached inventory from sessionStorage (5-minute TTL)
            orderTotals: {                // Calculated order totals (single source of truth)
                subtotal: 0,
                rushFee: 0,
                ltmFee: 0,
                salesTax: 0,
                shipping: 30,
                grandTotal: 0
            },
            colors: [
                { name: 'Jet Black', catalogColor: 'Jet Black', hex: '#000000' },
                { name: 'White', catalogColor: 'White', hex: '#FFFFFF' },
                { name: 'Navy', catalogColor: 'Navy', hex: '#001f3f' },
                { name: 'Athletic Heather', catalogColor: 'Ath Heather', hex: '#9ca3af' },
                { name: 'Dark Heather Grey', catalogColor: 'Dk Hthr Grey', hex: '#6b7280' }
            ],
            sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL']
        };

        // Initialize services
        const pricingService = new DTGPricingService();
        const orderService = new ThreeDayTeesOrderService();

        // Helper function to upload file to Caspio storage
        // Returns URL to hosted file instead of base64 data (reduces payload size by 99%)
        // Uses XMLHttpRequest for progress tracking (important for large 5-20MB artwork files)
        async function uploadFileToCaspio(file, externalKey) {
            const formData = new FormData();
            formData.append('file', file);

            console.log(`[3-Day Tees] Uploading ${file.name} to Caspio storage...`);

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                // Track upload progress
                let progressToastId = null;
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        const message = `Uploading ${file.name}... ${percentComplete}%`;

                        // Update existing toast or create new one
                        if (progressToastId) {
                            updateToast(progressToastId, message, 'info');
                        } else {
                            progressToastId = showToast(message, 'info', 30000); // 30s timeout
                        }

                        console.log(`[3-Day Tees] Upload progress: ${percentComplete}%`);
                    }
                });

                // Handle successful upload
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);

                            // Construct file URL from externalKey
                            const fileUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/${result.externalKey}`;

                            console.log(`[3-Day Tees] ✓ File uploaded: ${result.fileName} (${result.externalKey})`);

                            // Close progress toast and show success
                            if (progressToastId) {
                                closeToast(progressToastId);
                            }
                            showToast(`✓ ${file.name} uploaded successfully`, 'success', 3000);

                            resolve({
                                success: true,
                                url: fileUrl,
                                externalKey: result.externalKey,
                                fileName: result.fileName,
                                originalName: result.originalName,
                                size: result.size,
                                mimeType: result.mimeType
                            });
                        } catch (parseError) {
                            if (progressToastId) closeToast(progressToastId);
                            reject(new Error(`Upload succeeded but response parsing failed: ${parseError.message}`));
                        }
                    } else {
                        if (progressToastId) closeToast(progressToastId);
                        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
                    }
                });

                // Handle upload errors
                xhr.addEventListener('error', () => {
                    if (progressToastId) closeToast(progressToastId);
                    reject(new Error(`Network error uploading ${file.name}`));
                });

                // Handle upload abort
                xhr.addEventListener('abort', () => {
                    if (progressToastId) closeToast(progressToastId);
                    reject(new Error(`Upload cancelled for ${file.name}`));
                });

                // Send request
                xhr.open('POST', 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload');
                xhr.send(formData);
            });
        }

        // Load available colors from API
        async function loadAvailableColors() {
            try {
                console.log('[3-Day Tees] Loading available colors via ApiService...');
                const products = await apiService.get('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/product-details?styleNumber=PC54');
                console.log('[3-Day Tees] ✓ Product details loaded');

                // Deduplicate by CATALOG_COLOR and filter to desired colors
                // Match exact color names from ShopWorks inventory
                const desiredColors = [
                    'Jet Black',                        // Black (exact match from inventory)
                    'White',                            // White (exact match from inventory)
                    'Navy',                             // Navy (exact match from inventory)
                    'Ath Heather',                      // Athletic Heather (exact match from inventory)
                    'Dk Hthr Grey'                      // Dark Heather Grey (exact match from inventory)
                ];
                const uniqueColors = [...new Map(
                    products.map(p => [p.CATALOG_COLOR, p])
                ).values()];

                const apiColors = uniqueColors
                    .filter(p => desiredColors.includes(p.CATALOG_COLOR))
                    .map(p => ({
                        name: p.COLOR_NAME || p.CATALOG_COLOR,
                        catalogColor: p.CATALOG_COLOR,
                        hex: getHexForColor(p.CATALOG_COLOR), // Fallback hex
                        swatchImage: p.COLOR_SQUARE_IMAGE,
                        frontModel: p.FRONT_MODEL,
                        backModel: p.BACK_MODEL,
                        frontFlat: p.FRONT_FLAT || p.PRODUCT_IMAGE
                    }));

                console.log('[3-Day Tees] Loaded colors from API:', apiColors);
                return apiColors.length > 0 ? apiColors : state.colors; // Fallback to hardcoded if API fails
            } catch (error) {
                console.error('[3-Day Tees] Error loading colors from API:', error);
                return state.colors; // Fallback to hardcoded colors
            }
        }

        // Fallback hex colors for color swatches
        function getHexForColor(catalogColor) {
            const hexMap = {
                // Exact color names from ShopWorks inventory
                'Jet Black': '#000000',
                'White': '#FFFFFF',
                'Navy': '#001f3f',
                'Ath Heather': '#9ca3af',
                'Dk Hthr Grey': '#6b7280'
            };
            return hexMap[catalogColor] || '#cccccc';
        }

        // Load pricing data on page load
        async function init() {
            try {
                showLoading(true);

                // Fetch DTG pricing bundle
                console.log('[3-Day Tees] Loading DTG pricing via ApiService...');
                state.pricingData = await apiService.get('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTG&styleNumber=PC54');
                console.log('[3-Day Tees] ✓ Pricing data loaded');

                console.log('[3-Day Tees] Pricing data loaded:', state.pricingData);

                // Load colors from API
                state.colors = await loadAvailableColors();

                // Render UI
                renderColors();
                // Note: Location selector is now static HTML (radio buttons + checkbox)

                // Set Jet Black as default selected color
                const jetBlackColor = state.colors.find(c => c.catalogColor === 'Jet Black');
                if (jetBlackColor) {
                    // Add Jet Black to selected colors
                    state.selectedColors.push('Jet Black');

                    // Initialize colorConfig for Jet Black
                    state.colorConfigs['Jet Black'] = {
                        displayColor: jetBlackColor.name,
                        catalogColor: 'Jet Black',
                        sizeBreakdown: {},
                        totalQuantity: 0,
                        images: {
                            frontModel: jetBlackColor.frontModel || null,
                            backModel: jetBlackColor.backModel || null,
                            frontFlat: jetBlackColor.frontFlat || null
                        }
                    };

                    // Initialize size breakdown with 0 quantity for all sizes
                    state.sizes.forEach(size => {
                        state.colorConfigs['Jet Black'].sizeBreakdown[size] = {
                            quantity: 0,
                            unitPrice: 0,
                            basePrice: 0,
                            upcharge: 0
                        };
                    });

                    // Update UI to show Jet Black as selected
                    renderColors(); // Re-render to show checkmark on Jet Black
                    renderSelectedColors(); // Show size breakdown card
                    recalculateAllPricing(); // Update pricing
                }

                // NEW: Load all PC54 inventory using bulk endpoint (1 call instead of 15!)
                await initializeInventory();

                // After initialization, ensure all badges are updated with cached inventory data
                // Use requestAnimationFrame instead of setTimeout for better reliability
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        console.log('[3-Day Tees] Ensuring all badges show current inventory...');
                        state.colors.forEach(color => {
                            const cached = state.inventoryCache[color.catalogColor];
                            if (cached && cached.total !== undefined) {
                                updateInventoryBadge(color.catalogColor, cached.total);
                                console.log(`[3-Day Tees] Badge updated for ${color.catalogColor}: ${cached.total} units`);
                            } else {
                                // If no cache yet, show loading state
                                const badgeId = `stock-${color.catalogColor.replace(/\s+/g, '-')}`;
                                const badge = document.getElementById(badgeId);
                                if (badge) {
                                    badge.className = 'stock-badge loading';
                                    badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                                }
                            }
                        });
                    });
                });

                // Initialize collapsible sections
                initCollapsibleSections();

                showLoading(false);
            } catch (error) {
                console.error('[3-Day Tees] Initialization error:', error);
                showToast('Failed to load pricing data. Please refresh the page or call 253-922-5793.', 'error', 0);  // 0 = don't auto-hide
                showLoading(false);
            }
        }

        // Initialize collapsible sections for progressive disclosure
        function initCollapsibleSections() {
            const collapsibleHeaders = document.querySelectorAll('.collapsible-header');

            collapsibleHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const content = header.nextElementSibling;
                    const icon = header.querySelector('.collapse-icon');

                    if (content && content.classList.contains('collapsible-content')) {
                        content.classList.toggle('collapsed');
                        if (icon) {
                            icon.classList.toggle('collapsed');
                        }

                        // Save collapse state to localStorage
                        const sectionId = header.closest('.card').id || header.id;
                        if (sectionId) {
                            const isCollapsed = content.classList.contains('collapsed');
                            localStorage.setItem(`collapse_${sectionId}`, isCollapsed);
                        }
                    }
                });
            });

            // Restore collapse states from localStorage
            collapsibleHeaders.forEach(header => {
                const sectionId = header.closest('.card').id || header.id;
                if (sectionId) {
                    const isCollapsed = localStorage.getItem(`collapse_${sectionId}`) === 'true';
                    if (isCollapsed) {
                        const content = header.nextElementSibling;
                        const icon = header.querySelector('.collapse-icon');
                        if (content && content.classList.contains('collapsible-content')) {
                            content.classList.add('collapsed');
                            if (icon) {
                                icon.classList.add('collapsed');
                            }
                        }
                    }
                }
            });
        }

        // Render color selector - MULTI-COLOR SUPPORT
        function renderColors() {
            const grid = document.getElementById('colorGrid');
            grid.innerHTML = state.colors.map(color => {
                // Use swatch image if available, otherwise use hex color
                const swatchStyle = color.swatchImage
                    ? `background-image: url('${color.swatchImage}'); background-size: cover; background-position: center;`
                    : `background: ${color.hex};`;
                const whiteBorder = color.name === 'White' ? 'border: 2px solid #ccc;' : '';

                // Check if color is already selected
                const isSelected = state.selectedColors.includes(color.catalogColor);
                const selectedClass = isSelected ? 'selected' : '';

                return `
                    <div class="color-swatch-option ${selectedClass}" onclick="toggleColor('${color.catalogColor}', event)">
                        <div class="color-swatch" style="${swatchStyle} ${whiteBorder}"></div>
                        <div class="color-label">${color.name}</div>
                        <div class="stock-badge" id="stock-${color.catalogColor.replace(/\s+/g, '-')}">...</div>
                    </div>
                `;
            }).join('');

            // Update badges with cached inventory data (if available)
            // Use DOUBLE requestAnimationFrame to ensure DOM elements are painted and queryable
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    state.colors.forEach(color => {
                        const cached = state.inventoryCache[color.catalogColor];
                        if (cached && cached.total !== undefined) {
                            updateInventoryBadge(color.catalogColor, cached.total);
                        } else {
                            // Show loading state if inventory not cached yet
                            const badgeId = `stock-${color.catalogColor.replace(/\s+/g, '-')}`;
                            const badge = document.getElementById(badgeId);
                            if (badge && badge.textContent === '...') {
                                badge.className = 'stock-badge loading';
                                badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading';
                            }
                        }
                    });
                });
            });

            // Update hero image to show first color or first selected color
            updateHeroImage();
        }

        // Update hero product image based on selected colors
        function updateHeroImage() {
            const heroImg = document.getElementById('heroProductImage');
            if (!heroImg) return;

            // Priority: First selected color, otherwise first available color
            let imageColor;
            if (state.selectedColors.length > 0) {
                // Find first selected color's data
                imageColor = state.colors.find(c => c.catalogColor === state.selectedColors[0]);
            } else {
                // Show first available color
                imageColor = state.colors[0];
            }

            // Use API image for all colors
            if (imageColor && imageColor.frontModel) {
                // Use API image for all colors
                heroImg.src = imageColor.frontModel;
                heroImg.style.display = 'block';
                heroImg.alt = `${imageColor.name} - Port & Company PC54`;
            } else {
                // Hide if no image available
                heroImg.style.display = 'none';
            }
        }

        // Helper function to update inventory badge display
        function updateInventoryBadge(catalogColor, total) {
            const badgeId = `stock-${catalogColor.replace(/\s+/g, '-')}`;
            console.log(`[DEBUG] updateInventoryBadge called for ${catalogColor}, total: ${total}`);
            console.log(`[DEBUG] Looking for badge ID: ${badgeId}`);

            const badge = document.getElementById(badgeId);
            console.log(`[DEBUG] Badge element found:`, badge !== null);

            if (!badge) {
                console.error(`[3-Day Tees] Badge not found for ${catalogColor}`);
                return;
            }

            // Adjusted thresholds for local warehouse inventory
            if (total > 25) {
                badge.className = 'stock-badge in-stock';
                badge.textContent = 'In Stock';
            } else if (total > 0) {
                badge.className = 'stock-badge low-stock';
                badge.textContent = 'Low Stock';
            } else {
                badge.className = 'stock-badge out-of-stock';
                badge.textContent = 'Out of Stock';
            }
        }

        // NEW: Bulk fetch ALL PC54 inventory at once (93% faster - 1 call vs 15 calls)
        async function fetchAllPC54Inventory() {
            try {
                console.log('[3-Day Tees] Fetching ALL PC54 inventory (bulk endpoint)...');

                console.log('[3-Day Tees] Loading bulk PC54 inventory via ApiService...');
                const data = await apiService.get('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/pc54-inventory');
                console.log('[3-Day Tees] ✓ Bulk inventory received:', data);

                // Return the colors object from the response
                return data.colors; // { "Jet Black": {...}, "White": {...}, ... }
            } catch (error) {
                console.error('[3-Day Tees] Error fetching bulk inventory:', error);
                return null;
            }
        }

        // NEW: Initialize inventory cache from bulk endpoint
        async function initializeInventory() {
            console.log('[3-Day Tees] Initializing inventory cache from bulk endpoint...');

            try {
                // Fetch all colors in one call
                const bulkData = await fetchAllPC54Inventory();

                if (!bulkData) {
                    console.error('[3-Day Tees] Bulk fetch failed, falling back to individual fetches');
                    return false;
                }

                // Populate cache with all colors
                Object.keys(bulkData).forEach(catalogColor => {
                    const colorData = bulkData[catalogColor];

                    // ✅ CORRECTED: Parse sizeInventory from bulk data structure
                    // Bulk API returns colorData.sizes directly, not colorData.standardData.result[0]
                    const sizeInventory = {
                        'S': colorData.sizes?.S || 0,
                        'M': colorData.sizes?.M || 0,
                        'L': colorData.sizes?.L || 0,
                        'XL': colorData.sizes?.XL || 0,
                        '2XL': colorData.sizes?.['2XL'] || 0,
                        '3XL': colorData.sizes?.['3XL'] || 0
                    };

                    // Store in cache with actual bulk data structure
                    state.inventoryCache[catalogColor] = {
                        total: colorData.total,
                        sizeInventory: sizeInventory,  // ✅ Now contains actual inventory, not zeros
                        skus: colorData.skus,          // ✅ Use actual bulk API field
                        timestamp: Date.now(),
                        cacheVersion: CACHE_VERSION
                    };

                    console.log(`[3-Day Tees] ✓ Cached inventory for ${catalogColor}: ${colorData.total} units with sizeInventory:`, sizeInventory);

                    // CRITICAL FIX: Update badge for ALL colors, not just selected ones
                    // Badges exist in the color grid regardless of selection state
                    updateInventoryBadge(catalogColor, colorData.total);
                });

                // Save to sessionStorage
                saveInventoryCacheToStorage(state.inventoryCache);

                console.log('[3-Day Tees] ✓ Inventory cache initialized successfully');
                return true;

            } catch (error) {
                console.error('[3-Day Tees] Error initializing inventory:', error);
                return false;
            }
        }

        // Load inventory for a color from local warehouse (ManageOrders)
        // Helper function: Fetch inventory using InventoryService (with caching and retry logic)
        async function fetchInventoryWithRetry(catalogColor, retryCount = 0) {
            try {
                console.log(`[3-Day Tees] Fetching inventory for "${catalogColor}" via InventoryService...`);

                // Use InventoryService for intelligent caching and retry logic
                const inventoryData = await inventoryService.fetchMultiSKUInventory(catalogColor);

                console.log(`[3-Day Tees] ✓ Inventory fetched for "${catalogColor}" (cached: ${inventoryData.combined && inventoryData.fromCache ? 'yes' : 'no'})`);

                // Map service response to expected property names for compatibility
                return {
                    standardData: inventoryData.standard,
                    twoXLData: inventoryData.twoXL,
                    threeXLData: inventoryData.threeXL
                };
            } catch (error) {
                console.error(`[3-Day Tees] ✗ Inventory fetch failed for "${catalogColor}":`, error);
                throw error;
            }
        }

        // Load size-specific inventory for selected color from local warehouse
        async function loadSizeInventory(catalogColor) {
            try {
                // Check cache first to avoid rate limiting
                let standardData, twoXLData, threeXLData;

                if (state.inventoryCache[catalogColor]) {
                    console.log(`[3-Day Tees] Using cached size inventory for ${catalogColor}`);
                    const cached = state.inventoryCache[catalogColor];

                    // Use cached data (property names match cache structure)
                    standardData = cached.standardData || { result: [] };
                    twoXLData = cached.twoXLData || { result: [] };
                    threeXLData = cached.threeXLData || { result: [] };
                } else {
                    // Query all 3 SKUs with retry logic for rate limiting
                    const responses = await fetchInventoryWithRetry(catalogColor);
                    standardData = responses.standardData;
                    twoXLData = responses.twoXLData;
                    threeXLData = responses.threeXLData;
                }

                // Build inventory by size
                const sizeInventory = {};

                // PC54: Size01=S, Size02=M, Size03=L, Size04=XL
                if (standardData.result && standardData.result.length > 0) {
                    const inventory = standardData.result[0];
                    // ManageOrders API returns Size01, Size02, etc. (no _Onhand suffix)
                    sizeInventory['S'] = inventory.Size01 || 0;
                    sizeInventory['M'] = inventory.Size02 || 0;
                    sizeInventory['L'] = inventory.Size03 || 0;
                    sizeInventory['XL'] = inventory.Size04 || 0;
                } else {
                    // No standard sizes found
                    sizeInventory['S'] = 0;
                    sizeInventory['M'] = 0;
                    sizeInventory['L'] = 0;
                    sizeInventory['XL'] = 0;
                }

                // PC54_2X: Size05=2XL (not Size06!)
                if (twoXLData.result && twoXLData.result.length > 0) {
                    sizeInventory['2XL'] = twoXLData.result[0].Size05 || 0;
                } else {
                    sizeInventory['2XL'] = 0;
                }

                // PC54_3X: Size06=3XL
                if (threeXLData.result && threeXLData.result.length > 0) {
                    sizeInventory['3XL'] = threeXLData.result[0].Size06 || 0;
                } else {
                    sizeInventory['3XL'] = 0;
                }

                // Debug: Log size inventory for this color
                console.log(`[DEBUG SIZE INVENTORY] ${catalogColor}:`, sizeInventory);
                console.log(`[DEBUG SIZE INVENTORY] ${catalogColor} - Sizes in stock:`,
                    Object.entries(sizeInventory).filter(([size, qty]) => qty > 0).map(([size, qty]) => `${size}:${qty}`).join(', '));

                // Calculate total inventory and update badge
                const total = Object.values(sizeInventory).reduce((sum, qty) => sum + qty, 0);
                updateInventoryBadge(catalogColor, total);

                // Store the sizeInventory in cache for re-use
                if (state.inventoryCache[catalogColor]) {
                    console.log(`[3-Day Tees] Updating cache for ${catalogColor} with sizeInventory:`, sizeInventory);
                    state.inventoryCache[catalogColor].sizeInventory = sizeInventory;
                    state.inventoryCache[catalogColor].total = total;
                    state.inventoryCache[catalogColor].timestamp = Date.now();
                    state.inventoryCache[catalogColor].cacheVersion = CACHE_VERSION; // Add version
                    saveInventoryCacheToStorage(state.inventoryCache);
                    console.log(`[3-Day Tees] Cache updated for ${catalogColor}. Total: ${total} units, version: ${CACHE_VERSION}`);
                } else {
                    // Create cache entry with sizeInventory
                    console.log(`[3-Day Tees] Creating new cache for ${catalogColor} with sizeInventory:`, sizeInventory);
                    state.inventoryCache[catalogColor] = {
                        cacheVersion: CACHE_VERSION, // Add version first
                        sizeInventory: sizeInventory,
                        standardData: standardData,
                        twoXLData: twoXLData,
                        threeXLData: threeXLData,
                        total: total,
                        timestamp: Date.now()
                    };
                    saveInventoryCacheToStorage(state.inventoryCache);
                    console.log(`[3-Day Tees] Cache created for ${catalogColor}. Total: ${total} units, version: ${CACHE_VERSION}`);
                }

                // Update each size input with max constraint and enforcement
                state.sizes.forEach(size => {
                    const stock = sizeInventory[size] || 0;
                    const input = document.getElementById(`qty-${catalogColor}-${size}`);
                    const stockIndicator = document.getElementById(`stock-qty-${catalogColor}-${size}`);

                    if (input) {
                        if (stock === 0) {
                            // Out of stock: disable input
                            input.disabled = true;
                            input.value = '';
                            input.max = 0;

                            // Update stock indicator - "OUT" in red
                            if (stockIndicator) {
                                stockIndicator.textContent = 'OUT';
                                stockIndicator.className = 'table-stock-indicator out-of-stock';
                                stockIndicator.style.color = '#dc2626'; // Red
                                stockIndicator.style.fontWeight = '600';
                            }
                        } else {
                            // In stock: set max and add enforcement
                            input.disabled = false;
                            input.max = stock;

                            // Update stock indicator - "X avail" with color-coding
                            if (stockIndicator) {
                                stockIndicator.textContent = `${stock} avail`;
                                stockIndicator.className = 'table-stock-indicator';
                                stockIndicator.style.fontWeight = '500';

                                // Color-code by stock level
                                if (stock >= 50) {
                                    // Green: Excellent stock
                                    stockIndicator.style.color = '#16a34a';
                                } else if (stock >= 10) {
                                    // Yellow: Good stock
                                    stockIndicator.style.color = '#ca8a04';
                                } else if (stock >= 3) {
                                    // Orange: Low stock
                                    stockIndicator.style.color = '#ea580c';
                                } else {
                                    // Red-orange: Very low stock (1-2 pieces)
                                    stockIndicator.style.color = '#dc2626';
                                    stockIndicator.style.fontWeight = '600';
                                }
                            }

                            // Add input event listener to enforce max constraint
                            // Remove existing listener to avoid duplicates
                            input.removeEventListener('input', input._inventoryEnforcer);

                            // Create new enforcer function
                            input._inventoryEnforcer = function() {
                                const maxStock = parseInt(this.max);
                                const currentValue = parseInt(this.value) || 0;

                                if (currentValue > maxStock) {
                                    showToast(
                                        `Only ${maxStock} units of size ${size} available in ${catalogColor}. Your quantity has been adjusted to ${maxStock}.`,
                                        'warning',
                                        7000
                                    );
                                    this.value = maxStock;
                                    // Trigger the onchange handler to update pricing
                                    updateSizeQuantity(catalogColor, size, maxStock);
                                }
                            };

                            // Attach the enforcer
                            input.addEventListener('input', input._inventoryEnforcer);
                        }
                    }
                });

                console.log(`[3-Day Tees] Multi-SKU size inventory for ${catalogColor}:`, {
                    sizes: sizeInventory,
                    PC54: standardData.result?.[0] || 'No data',
                    PC54_2X: twoXLData.result?.[0] || 'No data',
                    PC54_3X: threeXLData.result?.[0] || 'No data'
                });
            } catch (error) {
                console.error('[3-Day Tees] Size inventory load error:', catalogColor, error);

                // Provide specific error feedback
                let errorMessage = 'Unable to load size-specific inventory.';

                if (error.message.includes('fetch') || error.message.includes('network') || !navigator.onLine) {
                    errorMessage = 'Network error: Unable to connect to inventory system. Please check your internet connection and try again.';
                } else if (error.name === 'SyntaxError') {
                    errorMessage = 'API error: Inventory system returned invalid data. Please try again or contact support.';
                } else if (error.message.includes('RATE_LIMIT')) {
                    errorMessage = 'Rate limit: Too many inventory requests. Colors are loading sequentially to avoid this. Please wait a moment.';
                    showToast(
                        'Inventory system is rate-limited. Colors are now loading one at a time to avoid this issue. Please wait a moment.',
                        'info',
                        8000
                    );
                }

                // Disable all size inputs for this color as a safety measure
                state.sizes.forEach(size => {
                    const input = document.getElementById(`qty-${catalogColor}-${size}`);
                    if (input) {
                        input.disabled = true;
                        input.value = 0;
                        input.title = errorMessage;
                    }
                });

                console.warn(`[3-Day Tees] ${errorMessage}`);
            }
        }

        // Toggle color selection - MULTI-COLOR SUPPORT
        function toggleColor(catalogColor, event) {
            event.stopPropagation(); // Prevent bubbling

            const colorData = state.colors.find(c => c.catalogColor === catalogColor);
            if (!colorData) return;

            // Check if color is already selected
            const index = state.selectedColors.indexOf(catalogColor);

            if (index === -1) {
                // Add color
                state.selectedColors.push(catalogColor);

                // Initialize colorConfig for this color
                state.colorConfigs[catalogColor] = {
                    displayColor: colorData.name,
                    catalogColor: catalogColor,
                    sizeBreakdown: {},
                    totalQuantity: 0,
                    images: {
                        frontModel: colorData.frontModel || null,
                        backModel: colorData.backModel || null,
                        frontFlat: colorData.frontFlat || null
                    }
                };

                // Initialize size breakdown with 0 quantity
                state.sizes.forEach(size => {
                    state.colorConfigs[catalogColor].sizeBreakdown[size] = {
                        quantity: 0,
                        unitPrice: 0,
                        basePrice: 0,
                        upcharge: 0
                    };
                });

                if (DEBUG_PRICING) {
                    console.log('[3-Day Tees] Color added:', catalogColor);
                }

                // Check if inventory is already cached and update badge immediately
                if (state.inventoryCache[catalogColor]) {
                    console.log(`[3-Day Tees] Using cached inventory for badge update: ${catalogColor}`);
                    const cached = state.inventoryCache[catalogColor];
                    updateInventoryBadge(catalogColor, cached.total);
                } else {
                    console.log(`[3-Day Tees] No cached inventory for ${catalogColor}, badge will show loading state`);
                }

                // Inventory will be loaded by renderColors() below (prevents race condition)
            } else {
                // Remove color
                state.selectedColors.splice(index, 1);
                delete state.colorConfigs[catalogColor];

                if (DEBUG_PRICING) {
                    console.log('[3-Day Tees] Color removed:', catalogColor);
                }
            }

            // Update UI - Toggle visual selection without rebuilding entire DOM
            // Find the clicked color swatch element and update its class directly
            const clickedElement = event.target.closest('.color-swatch-option');
            if (clickedElement) {
                if (index === -1) {
                    // Color was added - add selected class
                    clickedElement.classList.add('selected');
                } else {
                    // Color was removed - remove selected class
                    clickedElement.classList.remove('selected');
                }
            }

            // CRITICAL FIX: Refresh inventory badge for ALL colors after toggle
            // This ensures badges always show current inventory, not placeholder "..."
            requestAnimationFrame(() => {
                state.colors.forEach(color => {
                    const cached = state.inventoryCache[color.catalogColor];
                    if (cached && cached.total !== undefined) {
                        updateInventoryBadge(color.catalogColor, cached.total);
                    } else {
                        // Show loading state if inventory not cached yet
                        const badgeId = `stock-${color.catalogColor.replace(/\s+/g, '-')}`;
                        const badge = document.getElementById(badgeId);
                        if (badge) {
                            badge.className = 'stock-badge loading';
                            badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        }
                    }
                });
            });

            // Update dependent UI elements (these don't rebuild the color grid)
            renderSelectedColors();
            recalculateAllPricing();
        }


        // Render selected colors list with unified size table
        async function renderSelectedColors() {
            const container = document.getElementById('selectedColorsContainer');
            if (!container) return;

            if (state.selectedColors.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <p>No colors selected yet. Select colors above to get started.</p>
                    </div>
                `;
                return;
            }

            // Build unified table with sizes as rows, colors as columns
            const tableHTML = `
                <div class="unified-size-table-container">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; color: var(--text-primary);">
                        Size Selection for All Colors
                    </h3>
                    <table class="unified-size-table">
                        <thead>
                            <tr>
                                <th>Color</th>
                                ${state.sizes.map(size => `
                                    <th>
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                                            <span style="font-weight: 600;">${size}</span>
                                            <span id="header-price-${size}" style="font-size: 0.875rem; color: var(--text-secondary); font-weight: 500;">$0.00</span>
                                        </div>
                                    </th>
                                `).join('')}
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${state.selectedColors.map(catalogColor => {
                                const config = state.colorConfigs[catalogColor];
                                const colorData = state.colors.find(c => c.catalogColor === catalogColor);
                                return `
                                    <tr data-color="${catalogColor}">
                                        <td>
                                            <div class="color-header-cell">
                                                <div class="table-color-swatch" style="background: ${colorData.hex}; ${colorData.name === 'White' ? 'border-color: #999;' : ''}"></div>
                                                <span>${config.displayColor}</span>
                                                <button class="table-remove-btn" onclick="removeColor('${catalogColor}')" title="Remove this color">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        </td>
                                        ${state.sizes.map(size => `
                                            <td>
                                                <div class="table-cell-content">
                                                    <input type="number"
                                                           id="qty-${catalogColor}-${size}"
                                                           class="table-size-input"
                                                           min="0"
                                                           value="${state.colorConfigs[catalogColor].sizeBreakdown[size]?.quantity || 0}"
                                                           placeholder="0"
                                                           onchange="updateSizeQuantity('${catalogColor}', '${size}', this.value)">
                                                    <span id="stock-qty-${catalogColor}-${size}" class="table-stock-indicator">Checking...</span>
                                                </div>
                                            </td>
                                        `).join('')}
                                        <td class="row-total-cell">
                                            <div id="total-${catalogColor}" class="row-total-value">0 pieces</div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <!-- Subtotal Row -->
                            <tr class="subtotal-row">
                                <td style="font-weight: 700; background: #f0f9ff; color: #0369a1; padding: 1rem;">
                                    <i class="fas fa-calculator"></i> SUBTOTAL
                                </td>
                                ${state.sizes.map(size => `
                                    <td style="background: #f0f9ff; font-weight: 600; text-align: center; padding: 0.75rem;" id="subtotal-${size}">
                                        0
                                    </td>
                                `).join('')}
                                <td style="background: #0369a1; color: white; font-weight: 700; text-align: center; padding: 1rem;" id="grand-total">
                                    0 pieces
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            container.innerHTML = tableHTML;

            // Load size-specific inventory ONLY for NEW colors without cached data
            // Filter for new colors that need loading
            const newColors = state.selectedColors.filter(catalogColor =>
                !state.inventoryCache[catalogColor] ||
                !state.inventoryCache[catalogColor].sizeInventory
            );

            // Load new colors sequentially to avoid rate limiting
            if (newColors.length > 0) {
                console.log(`[3-Day Tees] Loading inventory for ${newColors.length} new colors sequentially`);

                for (let i = 0; i < newColors.length; i++) {
                    const catalogColor = newColors[i];
                    const colorName = state.colorConfigs[catalogColor]?.displayColor || catalogColor;

                    console.log(`[3-Day Tees] Loading size inventory ${i + 1}/${newColors.length} for new color: ${catalogColor}`);

                    try {
                        await loadSizeInventory(catalogColor);

                        // Add delay between colors (except after the last one)
                        if (i < newColors.length - 1) {
                            console.log('[3-Day Tees] Waiting 7 seconds before next color to respect rate limit...');
                            await new Promise(resolve => setTimeout(resolve, 7000));
                        }
                    } catch (error) {
                        console.error(`[3-Day Tees] Failed to load inventory for ${catalogColor}:`, error);
                    }
                }

                console.log('[3-Day Tees] ✓ All new colors loaded');
            }

            // Update UI with ALL colors (new and cached) in requestAnimationFrame to ensure DOM stability
            requestAnimationFrame(() => {
                console.log('[3-Day Tees] Updating size inventory UI for all selected colors...');

                state.selectedColors.forEach(catalogColor => {
                    const cached = state.inventoryCache[catalogColor];
                    if (cached) {
                        console.log(`[3-Day Tees] Using cached size inventory for ${catalogColor}:`, {
                            hasCached: !!cached,
                            hasSizeInventory: !!(cached && cached.sizeInventory),
                            sizeInventory: cached?.sizeInventory || {},
                            total: cached?.total || 0,
                            timestamp: cached?.timestamp || null,
                            age: cached?.timestamp ? `${Math.round((Date.now() - cached.timestamp) / 1000)}s` : 'unknown'
                        });

                        if (cached.sizeInventory) {
                            const total = cached.total;  // ✅ Use cached total directly instead of recalculating
                            console.log(`[3-Day Tees] Cached inventory total for ${catalogColor}: ${total} units`);
                            updateInventoryBadge(catalogColor, total);

                            // Update the size indicators with cached data (NOW DOM IS STABLE)
                            state.sizes.forEach(size => {
                                const stock = cached.sizeInventory[size] || 0;
                                const stockIndicator = document.getElementById(`stock-qty-${catalogColor}-${size}`);
                                const input = document.getElementById(`qty-${catalogColor}-${size}`);

                                if (stockIndicator) {
                                    if (stock === 0) {
                                        stockIndicator.textContent = 'OUT';
                                        stockIndicator.className = 'table-stock-indicator out-of-stock';
                                        stockIndicator.style.color = '#dc2626';
                                        stockIndicator.style.fontWeight = '600';

                                        // Disable input for out-of-stock
                                        if (input) {
                                            input.disabled = true;
                                            input.value = '';
                                            input.max = 0;
                                        }
                                    } else {
                                        stockIndicator.textContent = `${stock} avail`;
                                        stockIndicator.className = 'table-stock-indicator';
                                        stockIndicator.style.fontWeight = '500';

                                        // Color-code by stock level
                                        if (stock >= 50) {
                                            stockIndicator.style.color = '#16a34a'; // Green
                                        } else if (stock >= 10) {
                                            stockIndicator.style.color = '#ca8a04'; // Yellow
                                        } else if (stock >= 3) {
                                            stockIndicator.style.color = '#ea580c'; // Orange
                                        } else {
                                            stockIndicator.style.color = '#dc2626'; // Red
                                            stockIndicator.style.fontWeight = '600';
                                        }

                                        // Enable input and set max
                                        if (input) {
                                            input.disabled = false;
                                            input.max = stock;
                                        }
                                    }
                                } else {
                                    console.warn(`[3-Day Tees] Could not find stock indicator element: stock-qty-${catalogColor}-${size}`);
                                }
                            });
                        }
                    }
                });

                // Measure and match actual content height to prevent overflow expansion
                const container = document.getElementById('selectedColorsContainer');
                if (container && state.selectedColors.length > 0) {
                    const actualHeight = container.scrollHeight;
                    container.style.minHeight = `${actualHeight}px`;
                }

                console.log('[3-Day Tees] ✓ Size inventory UI update complete');
            });
        }

        // Remove color from selection
        function removeColor(catalogColor) {
            const index = state.selectedColors.indexOf(catalogColor);
            if (index !== -1) {
                state.selectedColors.splice(index, 1);
                delete state.colorConfigs[catalogColor];

                if (DEBUG_PRICING) {
                    console.log('[3-Day Tees] Color removed:', catalogColor);
                }

                // Update UI - Find and update the specific color element without rebuilding
                const colorElements = document.querySelectorAll('.color-swatch-option');
                colorElements.forEach(element => {
                    // Extract the catalogColor from the onclick attribute
                    const onclickAttr = element.getAttribute('onclick');
                    if (onclickAttr) {
                        const match = onclickAttr.match(/toggleColor\('([^']+)'/);
                        if (match && match[1] === catalogColor) {
                            element.classList.remove('selected');
                            console.log(`[3-Day Tees] Removed selected class from ${catalogColor} element`);
                        }
                    }
                });

                // Update other UI elements (don't rebuild color grid)
                renderSelectedColors();
                recalculateAllPricing();
            }
        }

        /**
         * Update the total display for a specific color immediately
         * This provides instant feedback when user changes quantities
         */
        function updateColorTotal(catalogColor) {
            const config = state.colorConfigs[catalogColor];
            if (!config || !config.sizeBreakdown) return;

            // Calculate total for this color
            const total = Object.values(config.sizeBreakdown)
                .reduce((sum, s) => sum + (s.quantity || 0), 0);

            // Update display immediately
            const totalEl = document.getElementById(`total-${catalogColor}`);
            if (totalEl) {
                totalEl.textContent = `${total} piece${total !== 1 ? 's' : ''}`;
                console.log(`[3DayTees] Updated ${catalogColor} total: ${total} pieces`);
            }
        }

        // Update size quantity for a specific color
        function updateSizeQuantity(catalogColor, size, value) {
            const quantity = parseInt(value) || 0;

            if (!state.colorConfigs[catalogColor]) return;

            // Update quantity
            state.colorConfigs[catalogColor].sizeBreakdown[size].quantity = quantity;

            // Update this color's total immediately (instant feedback)
            updateColorTotal(catalogColor);

            // Debounce the recalculation to prevent excessive updates
            clearTimeout(recalculationTimer);
            recalculationTimer = setTimeout(() => {
                recalculateAllPricing();
            }, 150);  // 150ms delay
        }

        // Debug flag - set to false in production to reduce console logging
        const DEBUG_PRICING = false;

        // Debounce timer for recalculation
        let recalculationTimer = null;

        /**
         * Update Order Summary DOM from state (one-way data flow: state → DOM)
         * This ensures DOM always reflects the single source of truth (state.orderTotals)
         * Updates BOTH Step 2 (step2-*) and Step 3 (step3-*) order summary sections
         */
        function updateOrderSummaryDOM() {
            const { subtotal, rushFee, ltmFee, salesTax, shipping, grandTotal } = state.orderTotals;

            // Helper function to update a set of pricing elements with a given prefix
            function updatePricingElements(prefix) {
                const subtotalEl = document.getElementById(`${prefix}-subtotal`);
                const rushFeeEl = document.getElementById(`${prefix}-rushFee`);
                const ltmFeeEl = document.getElementById(`${prefix}-ltmFee`);
                const salesTaxEl = document.getElementById(`${prefix}-salesTax`);
                const shippingEl = document.getElementById(`${prefix}-shipping`);
                const grandTotalEl = document.getElementById(`${prefix}-grandTotal`);

                // Update values with dollar signs
                if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
                if (rushFeeEl) rushFeeEl.textContent = `$${rushFee.toFixed(2)}`;
                if (ltmFeeEl) {
                    ltmFeeEl.textContent = `$${ltmFee.toFixed(2)}`;
                    // Show/hide LTM fee row
                    const ltmRow = document.getElementById(`${prefix}-ltmFeeRow`) || ltmFeeEl.closest('.pricing-row');
                    if (ltmRow) {
                        ltmRow.style.display = ltmFee > 0 ? '' : 'none';
                    }
                }

                // Show/hide rush fee row
                const rushFeeRow = document.getElementById(`${prefix}-rushFeeRow`);
                if (rushFeeRow) {
                    rushFeeRow.style.display = rushFee > 0 ? '' : 'none';
                }

                // Handle sales tax display
                if (salesTaxEl) {
                    // Check if we have a shipping state selected (Step 3)
                    const stateField = document.getElementById('state');
                    const hasState = stateField && stateField.value && stateField.value.trim() !== '';

                    // Step 2 shows deferred message, Step 3 shows actual amount
                    if (prefix === 'step3' && hasState) {
                        // Show actual tax amount on Step 3 when state is selected
                        salesTaxEl.textContent = `$${salesTax.toFixed(2)}`;
                        salesTaxEl.style.fontSize = '';
                        salesTaxEl.style.color = '';
                    } else if (prefix === 'step2') {
                        // Show deferred message on Step 2
                        salesTaxEl.textContent = 'Calculated at checkout';
                        salesTaxEl.style.fontSize = '0.9em';
                        salesTaxEl.style.color = '#6b7280';
                    } else if (salesTax > 0) {
                        // Show actual tax if calculated
                        salesTaxEl.textContent = `$${salesTax.toFixed(2)}`;
                        salesTaxEl.style.fontSize = '';
                        salesTaxEl.style.color = '';
                    } else {
                        // Fallback to deferred message
                        salesTaxEl.textContent = 'Calculated at checkout';
                        salesTaxEl.style.fontSize = '0.9em';
                        salesTaxEl.style.color = '#6b7280';
                    }
                }

                if (shippingEl) shippingEl.textContent = `$${shipping.toFixed(2)}`;
                if (grandTotalEl) grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
            }

            // Update both Step 2 and Step 3 order summaries
            updatePricingElements('step2');
            updatePricingElements('step3');

            console.log('[3DayTees] Order summary DOM updated from state (Step 2 & Step 3):', state.orderTotals);
        }

        // ========================================
        // Update Pricing Breakdown Display
        // ========================================
        function updatePricingBreakdown() {
            // Calculate quantities for each size category
            let standardQty = 0;
            let qty2XL = 0;
            let qty3XL = 0;

            // Sum quantities across all selected colors using state data
            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];

                if (!config || !config.sizeBreakdown) {
                    return;
                }

                Object.entries(config.sizeBreakdown).forEach(([size, sizeData]) => {
                    const value = parseInt(sizeData.quantity) || 0;

                    if (size === '2XL') {
                        qty2XL += value;
                    } else if (size === '3XL') {
                        qty3XL += value;
                    } else if (value > 0) {
                        standardQty += value;
                    }
                });
            });

            const totalQty = standardQty + qty2XL + qty3XL;

            // Only update if we have quantities
            if (totalQty > 0) {
                // Calculate tier pricing (use total quantity for tier determination)
                const selectedLocation = state.selectedLocation || 'LC_FB';

                // Get pricing for each size category
                const standardPrice = calculatePrice(totalQty, selectedLocation, 'M');
                const price2XL = calculatePrice(totalQty, selectedLocation, '2XL');
                const price3XL = calculatePrice(totalQty, selectedLocation, '3XL');

                // Update price displays
                const standardPriceEl = document.getElementById('standardSizesPrice');
                const price2XLEl = document.getElementById('price2XL');
                const price3XLEl = document.getElementById('price3XL');

                if (standardPriceEl) {
                    standardPriceEl.textContent = `$${standardPrice.finalPrice.toFixed(2)} each`;
                }
                if (price2XLEl) {
                    price2XLEl.textContent = `$${price2XL.finalPrice.toFixed(2)} each`;
                }
                if (price3XLEl) {
                    price3XLEl.textContent = `$${price3XL.finalPrice.toFixed(2)} each`;
                }

                // Show/hide pricing tiers based on selection
                const pricing2xlDiv = document.getElementById('pricing-2xl');
                const pricing3xlDiv = document.getElementById('pricing-3xl');

                if (pricing2xlDiv) {
                    pricing2xlDiv.style.display = qty2XL > 0 ? 'flex' : 'none';
                }
                if (pricing3xlDiv) {
                    pricing3xlDiv.style.display = qty3XL > 0 ? 'flex' : 'none';
                }

                // Update selection breakdown
                const selectionBreakdownEl = document.getElementById('selection-breakdown');
                if (selectionBreakdownEl) {
                    let breakdownText = '';
                    const parts = [];

                    if (standardQty > 0) {
                        parts.push(`${standardQty} standard`);
                    }
                    if (qty2XL > 0) {
                        parts.push(`${qty2XL} 2XL`);
                    }
                    if (qty3XL > 0) {
                        parts.push(`${qty3XL} 3XL`);
                    }

                    if (parts.length > 0) {
                        breakdownText = parts.join(' + ') + ` = ${totalQty} pieces`;
                    } else {
                        breakdownText = '0 pieces';
                    }

                    selectionBreakdownEl.textContent = breakdownText;
                }

                // Show the pricing panel
                const pricingPanel = document.getElementById('pricingPanel');
                if (pricingPanel) {
                    pricingPanel.style.display = 'block';
                }
            } else {
                // Hide pricing panel if no quantities
                const pricingPanel = document.getElementById('pricingPanel');
                if (pricingPanel) {
                    pricingPanel.style.display = 'none';
                }
            }
        }

        // ========================================
        // Update Review Phase Order Summary
        // ========================================
        function updateReviewSummaryDOM() {
            const { subtotal, rushFee, ltmFee, salesTax, shipping, grandTotal } = state.orderTotals;

            // Update all order summary elements using review-prefixed IDs
            const reviewSubtotalEl = document.getElementById('review-subtotal');
            const reviewRushFeeEl = document.getElementById('review-rushFee');
            const reviewLtmFeeEl = document.getElementById('review-ltmFee');
            const reviewSalesTaxEl = document.getElementById('review-salesTax');
            const reviewShippingEl = document.getElementById('review-shipping');
            const reviewGrandTotalEl = document.getElementById('review-grandTotal');

            // Add dollar signs to values
            if (reviewSubtotalEl) reviewSubtotalEl.textContent = `$${subtotal.toFixed(2)}`;
            if (reviewRushFeeEl) reviewRushFeeEl.textContent = `$${rushFee.toFixed(2)}`;
            if (reviewLtmFeeEl) {
                reviewLtmFeeEl.textContent = `$${ltmFee.toFixed(2)}`;
                // Show/hide LTM fee row
                const ltmRow = reviewLtmFeeEl.closest('.pricing-row');
                if (ltmRow) {
                    ltmRow.style.display = ltmFee > 0 ? '' : 'none';
                }
            }
            if (reviewSalesTaxEl) reviewSalesTaxEl.textContent = `$${salesTax.toFixed(2)}`;
            if (reviewShippingEl) reviewShippingEl.textContent = `$${shipping.toFixed(2)}`;
            if (reviewGrandTotalEl) reviewGrandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;

            // Update order review details
            updateReviewOrderDetails();

            console.log('[3DayTees] Review phase summary DOM updated from state:', state.orderTotals);
        }

        // ========================================
        // Update Review Phase Order Details
        // ========================================
        function updateReviewOrderDetails() {
            // Update print location display
            const reviewLocationEl = document.getElementById('reviewLocation');
            if (reviewLocationEl && selectedLocation) {
                const locationNames = {
                    'LC': 'Left Chest',
                    'FF': 'Full Front',
                    'LC_FB': 'Left Chest + Full Back',
                    'FF_FB': 'Full Front + Full Back'
                };
                reviewLocationEl.textContent = locationNames[selectedLocation] || selectedLocation;
            }

            // Update total pieces
            const reviewTotalPiecesEl = document.getElementById('reviewTotalPieces');
            if (reviewTotalPiecesEl) {
                const totalPieces = state.selectedColors.reduce((sum, colorState) => {
                    return sum + Object.values(colorState.sizes).reduce((s, qty) => s + qty, 0);
                }, 0);
                reviewTotalPiecesEl.textContent = totalPieces;
            }

            // Update selected colors display
            const reviewColorsEl = document.getElementById('reviewColors');
            if (reviewColorsEl) {
                const colorNames = state.selectedColors
                    .map(colorState => colorState.colorName)
                    .join(', ');
                reviewColorsEl.textContent = colorNames || 'None';
            }

            // Update contact information
            const reviewContactEl = document.getElementById('reviewContact');
            if (reviewContactEl) {
                const firstName = document.getElementById('firstName')?.value || '';
                const lastName = document.getElementById('lastName')?.value || '';
                const email = document.getElementById('email')?.value || '';
                const phone = document.getElementById('phone')?.value || '';

                let contactInfo = '';
                if (firstName || lastName) {
                    contactInfo += `${firstName} ${lastName}`.trim();
                }
                if (email) {
                    contactInfo += contactInfo ? `<br>${email}` : email;
                }
                if (phone) {
                    contactInfo += contactInfo ? `<br>${phone}` : phone;
                }

                reviewContactEl.innerHTML = contactInfo || 'Not provided';
            }

            // Update detailed order items in summaryContent
            const summaryContentEl = document.getElementById('summaryContent');
            if (summaryContentEl && state.selectedColors.length > 0) {
                let itemsHTML = '';

                state.selectedColors.forEach((colorState, index) => {
                    const colorQty = Object.values(colorState.sizes).reduce((sum, qty) => sum + qty, 0);
                    if (colorQty > 0) {
                        itemsHTML += `
                            <div style="padding: 0.75rem; background: #f8fafc; border-radius: 6px; margin-bottom: 0.75rem;">
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
                                    ${colorState.colorName} (${colorQty} pieces)
                                </div>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                    ${Object.entries(colorState.sizes)
                                        .filter(([size, qty]) => qty > 0)
                                        .map(([size, qty]) => `${size}: ${qty}`)
                                        .join(' • ')}
                                </div>
                            </div>
                        `;
                    }
                });

                if (itemsHTML) {
                    summaryContentEl.innerHTML = itemsHTML;
                } else {
                    summaryContentEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No items selected yet</p>';
                }
            }

            // Update artwork file review display
            updateArtworkReview();

            console.log('[3DayTees] Review order details updated');
        }

        // ========================================
        // Update Artwork Review Display (Phase 4)
        // ========================================
        function updateArtworkReview() {
            // Update front logo review
            const frontFileReviewEl = document.getElementById('frontFileReview');
            if (frontFileReviewEl) {
                if (state.frontLogo) {
                    const fileSize = (state.frontLogo.size / 1024).toFixed(1); // KB
                    frontFileReviewEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                            <span style="font-weight: 500; color: var(--text-primary);">${state.frontLogo.name}</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">(${fileSize} KB)</span>
                        </div>
                    `;
                } else {
                    frontFileReviewEl.innerHTML = '<span style="color: var(--text-secondary);">No file uploaded</span>';
                }
            }

            // Update back logo review
            const backFileReviewEl = document.getElementById('backFileReview');
            if (backFileReviewEl) {
                if (state.backLogo) {
                    const fileSize = (state.backLogo.size / 1024).toFixed(1); // KB
                    backFileReviewEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                            <span style="font-weight: 500; color: var(--text-primary);">${state.backLogo.name}</span>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">(${fileSize} KB)</span>
                        </div>
                    `;
                } else {
                    backFileReviewEl.innerHTML = '<span style="color: var(--text-secondary);">No file uploaded</span>';
                }
            }

            console.log('[3DayTees] Artwork review updated - Front:', !!state.frontLogo, 'Back:', !!state.backLogo);
        }

        /**
         * Recalculate pricing for all colors and update all displays
         *
         * @description
         * This is the master orchestration function that recalculates all pricing across the entire order
         * whenever colors, quantities, locations, or shipping state changes. It handles the complete
         * pricing workflow from per-piece calculations to the final order total.
         *
         * CRITICAL CONCEPT: Uses COMBINED quantity across ALL colors for tier determination.
         * This means a 12-piece black order + 12-piece navy order = 24 total pieces,
         * which qualifies for the 24-47 tier pricing (better rates than 12-23 tier).
         *
         * Process Flow (6 major steps):
         *
         * Step 1: Calculate Grand Total Quantity
         *   - Sums quantities across ALL selected colors and sizes
         *   - This combined quantity determines the pricing tier for all calculations
         *   - Example: 10 black + 15 navy + 8 white = 33 total pieces
         *
         * Step 2: Recalculate Prices Using Combined Quantity
         *   - For each color and size:
         *     - Calls calculatePrice() with COMBINED quantity (not per-color quantity)
         *     - Updates unit price, base price, and upcharge for each size
         *     - Updates price display cells with tooltip showing breakdown
         *     - Accumulates subtotal for sizes with quantity > 0
         *   - Tooltip displays:
         *     - Base price (garment + print location)
         *     - Rush fee (25%)
         *     - Size upcharge (if applicable)
         *     - Total per piece
         *
         * Step 3: Update Grand Total Display
         *   - Updates the header showing total pieces across all colors
         *   - Format: "48 pieces" or "12 pieces"
         *
         * Step 4: Show/Hide LTM Warning
         *   - Displays warning banner if 6-23 pieces (LTM range)
         *   - Hides banner if 0-5 pieces (below minimum) or 24+ pieces (meets minimum)
         *   - Warning explains $75 LTM fee and encourages ordering 24+ pieces
         *
         * Step 5: Calculate and Update Order Summary
         *   - Subtotal: Sum of all line items (includes rush fee in unit prices)
         *   - LTM Fee: $75 for 6-23 pieces, $0 otherwise
         *   - Sales Tax: 10.1% for Washington state only, applied to (subtotal + LTM)
         *   - Shipping: $30 flat rate for all orders
         *   - Grand Total: subtotal + LTM + tax + shipping
         *   - Stores totals in state.orderTotals (single source of truth)
         *   - Updates DOM via updateOrderSummaryDOM()
         *   - Shows/hides fee rows based on applicability
         *
         * Step 6: Update Live Pricing Display Panel
         *   - Shows sample pricing for Medium size
         *   - Displays base price, rush fee, upcharge (if any), final price
         *   - Shows/hides upcharge row dynamically
         *   - Hides panel if no location selected or zero quantity
         *
         * Additional Updates:
         *   - Calls updateHeaderPrices() to update size column headers
         *   - Calls updateSubtotalRow() to update quantity totals row
         *   - Logs detailed pricing breakdown in debug mode
         *
         * @example
         * // Scenario: User adds quantities to multiple colors
         * // Black: S(5), M(10), L(5) = 20 pieces
         * // Navy:  S(3), M(5),  L(2) = 10 pieces
         * // Total: 30 pieces → Uses 24-47 tier pricing
         *
         * recalculateAllPricing();
         * // Result:
         * // - All prices calculated using 24-47 tier rates
         * // - Subtotal: ~$525 (30 pieces × ~$17.50 average)
         * // - LTM Fee: $0 (30 pieces meets minimum)
         * // - Tax: $53.03 (10.1% for WA, applied to $525)
         * // - Shipping: $30
         * // - Total: $608.03
         *
         * @example
         * // Scenario: Small order under minimum
         * // Black only: S(5), M(10) = 15 pieces
         * // Total: 15 pieces → Uses 24-47 tier pricing but triggers LTM
         *
         * recalculateAllPricing();
         * // Result:
         * // - All prices calculated using 24-47 tier rates
         * // - Subtotal: ~$262.50 (15 pieces × ~$17.50 average)
         * // - LTM Fee: $75 (15 pieces is 6-23 range)
         * // - LTM Warning: Displayed to user
         * // - Tax: $34.09 (10.1% of $262.50 + $75)
         * // - Shipping: $30
         * // - Total: $401.59
         */
        function recalculateAllPricing() {
            if (!state.pricingData || !selectedLocation || state.selectedColors.length === 0) {
                return;
            }

            // Step 1: Calculate grand total quantity across ALL colors
            let grandTotalQuantity = 0;
            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];
                config.totalQuantity = Object.values(config.sizeBreakdown)
                    .reduce((sum, s) => sum + s.quantity, 0);
                grandTotalQuantity += config.totalQuantity;
            });

            if (DEBUG_PRICING) {
                console.log('[3-Day Tees] Recalculating pricing with combined quantity:', grandTotalQuantity);
            }

            // Step 2: Calculate prices using COMBINED quantity for ALL colors
            let grandSubtotal = 0;
            let totalRushFee = 0;

            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];
                let colorSubtotal = 0;

                // Calculate unit price for each size using COMBINED quantity
                state.sizes.forEach(size => {
                    const sizeData = config.sizeBreakdown[size];
                    const qty = sizeData.quantity;

                    // Calculate price for this size (even if qty is 0, for display purposes)
                    const priceBreakdown = calculatePrice(grandTotalQuantity || 1, selectedLocation, size);
                    sizeData.unitPrice = priceBreakdown.finalPrice;
                    sizeData.basePrice = priceBreakdown.basePrice;
                    sizeData.upcharge = priceBreakdown.upcharge;

                    // Update price display (always show pricing with tooltip)
                    const priceEl = document.getElementById(`price-${catalogColor}-${size}`);
                    if (priceEl) {
                        // Build tooltip content - location names from Phase 1
                        const locationNames = {
                            'LC': 'Left Chest',
                            'FF': 'Full Front',
                            'LC_FB': 'Left Chest + Full Back',
                            'FF_FB': 'Full Front + Full Back'
                        };
                        const locationDisplay = locationNames[selectedLocation] || selectedLocation;

                        const tooltipContent = `
                            <div class="price-tooltip-row">
                                <span class="price-tooltip-label">Base (Garment + ${locationDisplay}):</span>
                                <span class="price-tooltip-value">$${priceBreakdown.basePrice.toFixed(2)}</span>
                            </div>
                            <div class="price-tooltip-row">
                                <span class="price-tooltip-label">Rush Fee (25%):</span>
                                <span class="price-tooltip-value warning">$${priceBreakdown.rushFee.toFixed(2)}</span>
                            </div>
                            ${priceBreakdown.upcharge > 0 ? `
                                <div class="price-tooltip-row">
                                    <span class="price-tooltip-label">Size Upcharge:</span>
                                    <span class="price-tooltip-value">$${priceBreakdown.upcharge.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div class="price-tooltip-row total">
                                <span class="price-tooltip-label">Total Per Piece:</span>
                                <span class="price-tooltip-value">$${priceBreakdown.finalPrice.toFixed(2)}</span>
                            </div>
                        `;

                        if (qty > 0) {
                            // Active size: show price in primary color with tooltip
                            priceEl.innerHTML = `
                                <div class="price-with-tooltip">
                                    <strong style="color: var(--primary-color);">$${priceBreakdown.finalPrice.toFixed(2)}</strong>
                                    <i class="fas fa-info-circle price-info-icon"></i>
                                    <div class="price-tooltip">${tooltipContent}</div>
                                </div>
                            `;
                        } else {
                            // Inactive size: show price in muted color with tooltip
                            priceEl.innerHTML = `
                                <div class="price-with-tooltip">
                                    <span style="color: var(--text-secondary);">$${priceBreakdown.finalPrice.toFixed(2)}</span>
                                    <i class="fas fa-info-circle price-info-icon"></i>
                                    <div class="price-tooltip">${tooltipContent}</div>
                                </div>
                            `;
                        }
                    }

                    // Only accumulate to subtotal if quantity > 0
                    if (qty > 0) {
                        // Use finalPrice (what customer sees) for accurate line item total
                        // This ensures Stripe charge matches exactly what customer sees
                        colorSubtotal += qty * priceBreakdown.finalPrice;

                        // Calculate rush fee component for display purposes only (not used in calculations)
                        // This is just to show the breakdown to customer
                        const rushFeePerPiece = Math.round(priceBreakdown.basePrice * 0.25 * 100) / 100;
                        totalRushFee += qty * rushFeePerPiece;
                    }
                });

                // Update per-color total
                const totalEl = document.getElementById(`total-${catalogColor}`);
                if (totalEl) {
                    totalEl.textContent = `${config.totalQuantity} pieces`;
                }

                grandSubtotal += colorSubtotal;
            });

            // Step 3: Update grand total display
            document.getElementById('grand-total').textContent = `${grandTotalQuantity} pieces`;

            // Step 4: Show/hide LTM warning
            const ltmWarning = document.getElementById('ltmWarning');
            if (ltmWarning) {
                if (grandTotalQuantity >= 6 && grandTotalQuantity < 24) {
                    ltmWarning.style.display = 'block';
                } else {
                    ltmWarning.style.display = 'none';
                }
            }

            // Step 5: Calculate and update order summary
            // LTM (Less Than Minimum) fee: $75 for orders of 6-23 pieces
            const ltmFee = (grandTotalQuantity >= 6 && grandTotalQuantity < 24) ? 75 : 0;

            // Conditional sales tax: Only apply 10.1% if shipping to Washington state
            const stateField = document.getElementById('state');
            const shippingState = stateField ? stateField.value.trim().toUpperCase() : '';
            const salesTaxRate = (shippingState === 'WA' || shippingState === 'WASHINGTON') ? 0.101 : 0;
            // Tax calculated on line items total (grandSubtotal now includes rush fee)
            const salesTax = (grandSubtotal + ltmFee) * salesTaxRate;

            console.log("[DEBUG TAX] Sales Tax Calculation:", {
                shippingState: shippingState,
                salesTaxRate: salesTaxRate,
                taxableAmount: (grandSubtotal + ltmFee).toFixed(2),
                salesTax: salesTax.toFixed(2)
            });

            const shipping = 30;
            console.log('[DEBUG A] Shipping calculated:', shipping, 'Type:', typeof shipping);
            // Grand total now matches exactly: line items + LTM + tax + shipping
            const grandTotal = grandSubtotal + ltmFee + salesTax + shipping;

            // Store calculated totals in state (single source of truth)
            state.orderTotals = {
                subtotal: grandSubtotal,
                rushFee: totalRushFee,
                ltmFee: ltmFee,
                salesTax: salesTax,
                shipping: shipping,
                grandTotal: grandTotal
            };
            console.log('[DEBUG B] State updated with shipping:', state.orderTotals.shipping, 'Full state:', state.orderTotals);

            // Update DOM from state (one-way data flow: state → DOM)
            updateOrderSummaryDOM();

            // Update pricing breakdown display
            updatePricingBreakdown();

            // Show/hide fee rows in order summary (now handled in updateOrderSummaryDOM)
            // Keeping this here for backwards compatibility if needed
            const ltmRowEl = document.getElementById('checkout-ltmFeeRow');
            const rushRowEl = document.getElementById('checkout-rushFeeRow');

            if (ltmRowEl) {
                ltmRowEl.style.display = ltmFee > 0 ? 'flex' : 'none';
            }
            if (rushRowEl) {
                rushRowEl.style.display = totalRushFee > 0 ? 'flex' : 'none';
            }

            // Step 6: Update live pricing display panel
            const pricingPanel = document.getElementById('pricingPanel');
            if (pricingPanel && selectedLocation && grandTotalQuantity > 0) {
                // Calculate sample price for standard size (M) to display in panel
                const sampleSize = 'M';
                const samplePricing = calculatePrice(grandTotalQuantity, selectedLocation, sampleSize);

                // Update panel elements
                const liveBasePrice = document.getElementById('liveBasePrice');
                const liveRushFee = document.getElementById('liveRushFee');
                const liveUpcharge = document.getElementById('liveUpcharge');
                const liveUpchargeRow = document.getElementById('liveUpchargeRow');
                const liveFinalPrice = document.getElementById('liveFinalPrice');

                if (liveBasePrice) liveBasePrice.textContent = `$${samplePricing.basePrice.toFixed(2)}`;
                if (liveRushFee) liveRushFee.textContent = `$${samplePricing.rushFee.toFixed(2)}`;
                if (liveFinalPrice) liveFinalPrice.textContent = `$${samplePricing.finalPrice.toFixed(2)}`;

                // Show/hide upcharge row
                if (samplePricing.upcharge > 0 && liveUpcharge && liveUpchargeRow) {
                    liveUpchargeRow.style.display = 'flex';
                    liveUpcharge.textContent = `$${samplePricing.upcharge.toFixed(2)}`;
                } else if (liveUpchargeRow) {
                    liveUpchargeRow.style.display = 'none';
                }

                // Show panel
                pricingPanel.style.display = 'block';
            } else if (pricingPanel) {
                // Hide panel if no location selected or no quantity
                pricingPanel.style.display = 'none';
            }

            if (DEBUG_PRICING) {
                console.log('[3-Day Tees] Pricing recalculated:', {
                grandTotalQuantity,
                subtotal: grandSubtotal.toFixed(2),
                totalRushFee: totalRushFee.toFixed(2),
                ltmFee: ltmFee.toFixed(2),
                salesTax: salesTax.toFixed(2),
                shipping: shipping.toFixed(2),
                grandTotal: grandTotal.toFixed(2)
                });
            }

            // Update header prices after recalculation
            updateHeaderPrices();

            // Update subtotal row after recalculation
            updateSubtotalRow();
        }

        /**
         * Update size column header prices based on current order quantity
         *
         * @description
         * This function updates the price display in each size column header (S, M, L, XL, 2XL, 3XL)
         * based on the current combined quantity across all selected colors. The header prices show
         * what each size costs per piece at the current quantity tier, including all fees and upcharges.
         *
         * Process:
         * 1. Calculate combined quantity across all colors and sizes
         * 2. Use Math.max(combinedQuantity, 1) to prevent division by zero
         * 3. For each size, call calculatePrice() with combined quantity
         * 4. Update the header price display with the final price
         *
         * The header prices dynamically update as the user:
         * - Adds or removes colors
         * - Changes quantities in any size/color combination
         * - Changes print location (affects decoration cost)
         *
         * This provides immediate visual feedback showing how quantity affects pricing,
         * helping users understand volume discounts and tier pricing.
         *
         * @example
         * // User has 10 black shirts + 15 navy shirts = 25 total
         * updateHeaderPrices();
         * // Result: All size headers show pricing at 24-47 tier
         * // - S header: "$16.50" (base tier price, no upcharge)
         * // - M header: "$16.50"
         * // - L header: "$16.50"
         * // - XL header: "$16.50"
         * // - 2XL header: "$18.50" (includes $2 upcharge)
         * // - 3XL header: "$19.50" (includes $3 upcharge)
         *
         * @example
         * // User increases order to 50 total pieces
         * updateHeaderPrices();
         * // Result: All headers recalculate with 48-71 tier (better rates)
         * // - S header: "$15.50" (improved tier pricing)
         * // - M header: "$15.50"
         * // - 2XL header: "$17.50" (tier savings + upcharge)
         */
        function updateHeaderPrices() {
            if (!state.pricingData || !selectedLocation || state.selectedColors.length === 0) {
                return;
            }

            // Calculate combined quantity across all colors
            let combinedQuantity = 0;
            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];
                combinedQuantity += Object.values(config.sizeBreakdown)
                    .reduce((sum, s) => sum + s.quantity, 0);
            });

            // Use a minimum of 1 for calculation (prevents division by zero)
            const calcQuantity = Math.max(combinedQuantity, 1);

            // Update price for each size header
            state.sizes.forEach(size => {
                const headerPriceEl = document.getElementById(`header-price-${size}`);
                if (headerPriceEl) {
                    const priceBreakdown = calculatePrice(calcQuantity, selectedLocation, size);
                    headerPriceEl.textContent = `$${priceBreakdown.finalPrice.toFixed(2)}`;
                }
            });

            if (DEBUG_PRICING) {
                console.log('[3-Day Tees] Header prices updated for quantity:', calcQuantity);
            }
        }

        /**
         * Update the subtotal row with column totals for each size and grand total
         *
         * @description
         * This function calculates and displays:
         * - Column totals: Sum of quantities for each size across all selected colors
         * - Grand total: Total pieces across all sizes and colors
         *
         * The subtotal row provides a quick summary of how many pieces are ordered
         * for each size, regardless of color selection.
         *
         * @example
         * // If user has selected:
         * // Black: S(5), M(10), L(15)
         * // Navy:  S(3), M(7),  L(10)
         * // Result: S(8), M(17), L(25), Total: 50 pieces
         */
        function updateSubtotalRow() {
            if (state.selectedColors.length === 0) {
                return;
            }

            // Calculate column totals (sum quantities for each size across all colors)
            const columnTotals = {};
            let grandTotal = 0;

            state.sizes.forEach(size => {
                let sizeTotal = 0;
                state.selectedColors.forEach(catalogColor => {
                    const qty = state.colorConfigs[catalogColor]?.sizeBreakdown[size]?.quantity || 0;
                    sizeTotal += qty;
                });
                columnTotals[size] = sizeTotal;
                grandTotal += sizeTotal;
            });

            // Update subtotal cells
            state.sizes.forEach(size => {
                const subtotalEl = document.getElementById(`subtotal-${size}`);
                if (subtotalEl) {
                    subtotalEl.textContent = columnTotals[size];
                }
            });

            // Update grand total
            const grandTotalEl = document.getElementById('grand-total');
            if (grandTotalEl) {
                grandTotalEl.textContent = `${grandTotal} pieces`;
            }

            if (DEBUG_PRICING) {
                console.log('[3-Day Tees] Subtotal row updated:', { columnTotals, grandTotal });
            }
        }

        /**
         * Calculate the final price for 3-Day Tees orders using the 7-step DTG pricing formula + 25% rush fee
         *
         * @param {number} quantity - The total number of t-shirts being ordered (determines pricing tier)
         * @param {string} location - The print location code (e.g., 'LC', 'FF', 'LC_FB', 'FF_FB')
         *                           Combo locations with '_FB' suffix will sum front + back costs
         * @param {string} size - The t-shirt size (e.g., 'S', 'M', 'L', 'XL', '2XL', '3XL')
         *
         * @returns {Object} Price breakdown with the following properties:
         * @returns {number} returns.finalPrice - The final price per unit including all fees and upcharges
         * @returns {number} returns.basePrice - The base DTG price before rush fee (rounded to half-dollar)
         * @returns {number} returns.rushFee - The 25% rush fee amount (rounded to half-dollar)
         * @returns {number} returns.upcharge - The size-specific upcharge amount
         *
         * @description
         * Pricing Formula (7 Steps + Rush Fee):
         *
         * Step 1: Base Garment Cost
         *   - Gets the lowest price from available sizes in the pricing data
         *   - Example: $2.85 for PC54
         *
         * Step 2: Marked Up Garment
         *   - Applies tier-specific margin denominator to base cost
         *   - Formula: baseCost / tier.MarginDenominator
         *   - Example: $2.85 / 0.6 = $4.75
         *
         * Step 3: Print Cost
         *   - For single locations: Gets print cost for the specified location
         *   - For combo locations (LC_FB, FF_FB): Sums front location + back location costs
         *   - Example: Left Chest = $6.00, or LC_FB = $6.00 + $8.50 = $14.50
         *
         * Step 4: Base DTG Price
         *   - Combines marked up garment + print cost
         *   - Formula: markedUpGarment + totalPrintCost
         *   - Example: $4.75 + $6.00 = $10.75
         *
         * Step 5: Round Base
         *   - Rounds to half-dollar ceiling (always rounds up)
         *   - Formula: Math.ceil(baseDTGPrice * 2) / 2
         *   - Example: $10.75 → $11.00
         *
         * Step 6: Calculate 25% Rush Fee
         *   - Applies 25% rush fee for 3-day turnaround
         *   - Formula: roundedBase * 0.25
         *   - Example: $11.00 * 0.25 = $2.75
         *
         * Step 7: Final Rounding
         *   - Rounds price with rush fee to half-dollar ceiling
         *   - Formula: Math.ceil((roundedBase + rushFee) * 2) / 2
         *   - Example: ($11.00 + $2.75) = $13.75 → $14.00
         *
         * Step 8: Add Size Upcharge
         *   - Adds size-specific upcharge from pricing data
         *   - Standard sizes (S-XL): typically $0
         *   - Oversized (2XL, 3XL): typically $2-$3
         *   - Example: $14.00 + $2.00 = $16.00
         *
         * @example
         * // Single location (Left Chest) - 48 pieces, Large
         * const result = calculatePrice(48, 'LC', 'L');
         * // Returns: {
         * //   finalPrice: 14.00,  // Base $11.00 + Rush $2.75 (rounded to $3.00) = $14.00
         * //   basePrice: 11.00,    // Marked up garment + print cost, rounded
         * //   rushFee: 3.00,       // 25% of base, rounded
         * //   upcharge: 0          // No upcharge for Large
         * // }
         *
         * @example
         * // Combo location (Left Chest + Full Back) - 24 pieces, 2XL
         * const result = calculatePrice(24, 'LC_FB', '2XL');
         * // Returns: {
         * //   finalPrice: 23.00,  // Base $18.00 + Rush $4.50 (→ $5.00) + Upcharge $2.00
         * //   basePrice: 18.00,    // Marked up garment + (LC + FB costs), rounded
         * //   rushFee: 5.00,       // 25% of base, rounded
         * //   upcharge: 2.00       // 2XL upcharge
         * // }
         */
        function calculatePrice(quantity, location, size) {
            if (!state.pricingData || !location || quantity === 0) {
                return { finalPrice: 0, basePrice: 0, rushFee: 0, upcharge: 0 };
            }

            // Find tier
            const tier = state.pricingData.tiersR.find(t =>
                quantity >= t.MinQuantity && quantity <= t.MaxQuantity
            ) || state.pricingData.tiersR[0];

            // Step 1: Base garment cost
            const baseCost = Math.min(...state.pricingData.sizes
                .map(s => parseFloat(s.price))
                .filter(p => p > 0)
            );

            // Step 2: Marked up garment
            const markedUpGarment = baseCost / tier.MarginDenominator;

            // Step 3: Print cost - Handle combo locations (LC_FB, FF_FB)
            let totalPrintCost = 0;

            // Parse location to detect combo (location will be 'LC', 'FF', 'LC_FB', or 'FF_FB')
            const isComboLocation = location && location.includes('_FB');
            const frontLocation = isComboLocation ? location.split('_')[0] : location;

            // Add front location cost
            const frontCost = state.pricingData.allDtgCostsR.find(c =>
                c.PrintLocationCode === frontLocation && c.TierLabel === tier.TierLabel
            )?.PrintCost || 0;
            totalPrintCost += frontCost;

            // Add back location cost if combo location
            if (isComboLocation) {
                const backCost = state.pricingData.allDtgCostsR.find(c =>
                    c.PrintLocationCode === 'FB' && c.TierLabel === tier.TierLabel
                )?.PrintCost || 0;
                totalPrintCost += backCost;

                if (DEBUG_PRICING) {
                    console.log(`[3-Day Tees] Combo location pricing: ${frontLocation} ($${frontCost.toFixed(2)}) + FB ($${backCost.toFixed(2)}) = $${totalPrintCost.toFixed(2)}`);
                }
            } else {
                if (DEBUG_PRICING) {
                    console.log(`[3-Day Tees] Single location pricing: ${frontLocation} = $${frontCost.toFixed(2)}`);
                }
            }

            // Step 4: Base DTG price
            const baseDTGPrice = markedUpGarment + totalPrintCost;

            // Step 5: Round base
            const roundedBase = Math.ceil(baseDTGPrice * 2) / 2;

            // Step 6: Calculate 25% rush fee
            const rushFee = roundedBase * 0.25;
            const priceWithRush = roundedBase + rushFee;

            // Step 7: Final rounding
            const finalPrice = Math.ceil(priceWithRush * 2) / 2;

            // Step 8: Add size upcharge (API uses 'sellingPriceDisplayAddOns' not 'upcharges')
            const upcharge = (state.pricingData.sellingPriceDisplayAddOns || {})[size] || 0;

            // Return breakdown for transparent pricing
            return {
                finalPrice: finalPrice + upcharge,
                basePrice: roundedBase,
                rushFee: Math.ceil(rushFee * 2) / 2,  // Round rush fee separately
                upcharge: upcharge
            };
        }

        // Front Logo Upload Handling
        document.getElementById('frontUploadZone').addEventListener('click', () => {
            document.getElementById('frontFileInput').click();
        });

        document.getElementById('frontFileInput').addEventListener('change', (e) => {
            handleFileUpload(e.target.files, 'front');
        });

        // Back Logo Upload Handling
        document.getElementById('backUploadZone').addEventListener('click', () => {
            document.getElementById('backFileInput').click();
        });

        document.getElementById('backFileInput').addEventListener('change', (e) => {
            handleFileUpload(e.target.files, 'back');
        });

        // Common file upload handler
        function handleFileUpload(files, position) {
            const filesArray = Array.from(files);
            if (filesArray.length === 0) return;

            const file = filesArray[0]; // Only take first file for each position

            // Validate file size
            if (file.size > 20 * 1024 * 1024) {
                showToast(
                    `File "${file.name}" is too large. Maximum file size is 20MB.`,
                    'error',
                    8000
                );
                return;
            }

            // Validate file type
            const acceptedExtensions = ['.ai', '.eps', '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.psd'];
            const fileName = file.name.toLowerCase();
            const isValidType = acceptedExtensions.some(ext => fileName.endsWith(ext));

            if (!isValidType) {
                showToast(
                    'Invalid file type. Only AI, EPS, PDF, PNG, JPG, TIFF, and PSD files are accepted.',
                    'error',
                    6000
                );
                return;
            }

            // Store file with position marker
            if (position === 'front') {
                state.frontLogo = file;
                state.frontLogo.position = 'front';
                renderFileList('front');
                showToast('Front logo uploaded successfully', 'success', 3000);
            } else {
                state.backLogo = file;
                state.backLogo.position = 'back';
                renderFileList('back');
                showToast('Back logo uploaded successfully', 'success', 3000);
            }

            // Sync uploaded files array (CRITICAL FIX)
            syncUploadedFilesArray();
        }

        // Sync frontLogo/backLogo into uploadedFiles array
        // This ensures the upload loop in submitOrderWithPayment has files to process
        function syncUploadedFilesArray() {
            state.uploadedFiles = [];

            if (state.frontLogo) {
                state.uploadedFiles.push(state.frontLogo);
            }

            if (state.backLogo) {
                state.uploadedFiles.push(state.backLogo);
            }

            console.log('[3-Day Tees] Synced uploadedFiles array:', state.uploadedFiles.length, 'files');
        }

        // Continue to Checkout button event listener
        const continueToCheckoutBtn = document.getElementById("continueToCheckout");
        if (continueToCheckoutBtn) {
            continueToCheckoutBtn.addEventListener("click", function() {
                console.log("[3-Day Tees] Continue to Checkout clicked");

                // Validate Step 2 requirements
                if (!validateStep2()) {
                    showToast("Please complete all required fields before continuing.", "error", 5000);
                    return;
                }

                // Navigate to Step 3
                moveToPhase(3);
                console.log("[3-Day Tees] Navigated to Step 3 (Checkout)");
            });
        }

        // Validation function for Step 2 (Colors & Quantities)
        function validateStep2() {
            // Check front logo upload (REQUIRED)
            const frontFileList = document.getElementById("frontFileList");
            const hasFrontLogo = frontFileList && frontFileList.children.length > 0;

            if (!hasFrontLogo) {
                console.log("[3-Day Tees] Validation failed: Front logo required");
                showToast("Front logo is required. Please upload your artwork.", "error", 5000);
                return false;
            }

            // Check if at least one size has quantity > 0
            const hasQuantity = state.selectedColors.some(catalogColor => {
                const colorConfig = state.colorConfigs[catalogColor];
                return colorConfig &&
                       colorConfig.sizeBreakdown &&
                       Object.values(colorConfig.sizeBreakdown).some(sizeData => sizeData.quantity > 0);
            });

            if (!hasQuantity) {
                console.log("[3-Day Tees] Validation failed: No quantities selected");
                showToast("Please select at least one size and quantity.", "error", 5000);
                return false;
            }

            console.log("[3-Day Tees] Step 2 validation passed");
            return true;
        }

        // Front Logo Drag and Drop
        setupDragAndDrop('frontUploadZone', 'front');

        // Back Logo Drag and Drop
        setupDragAndDrop('backUploadZone', 'back');

        function setupDragAndDrop(zoneId, position) {
            const uploadZone = document.getElementById(zoneId);
            if (!uploadZone) return;

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            // Highlight drop zone when dragging over it
            ['dragenter', 'dragover'].forEach(eventName => {
                uploadZone.addEventListener(eventName, () => {
                    uploadZone.style.borderColor = 'var(--primary-color)';
                    uploadZone.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                }, false);
            });

            // Remove highlight when dragging leaves
            ['dragleave', 'drop'].forEach(eventName => {
                uploadZone.addEventListener(eventName, () => {
                    uploadZone.style.borderColor = '';
                    uploadZone.style.backgroundColor = '';
                }, false);
            });

            // Handle dropped files
            uploadZone.addEventListener('drop', (e) => {
                const files = Array.from(e.dataTransfer.files);
                handleFileUpload(files, position);
            }, false);
        }

        function renderFileList(position) {
            const file = position === 'front' ? state.frontLogo : state.backLogo;
            const listId = position === 'front' ? 'frontFileList' : 'backFileList';
            const uploadZoneId = position === 'front' ? 'frontUploadZone' : 'backUploadZone';
            const list = document.getElementById(listId);
            const uploadZone = document.getElementById(uploadZoneId);

            if (!file) {
                list.innerHTML = '';
                // Remove the has-file class when no file
                if (uploadZone) {
                    uploadZone.classList.remove('has-file');
                    uploadZone.querySelector('i').className = 'fas fa-cloud-upload-alt';
                    uploadZone.querySelector('p').textContent = `Click or Drag ${position === 'front' ? 'Front' : 'Back'} Logo Here`;
                }
                return;
            }

            // Add the has-file class when file is present
            if (uploadZone) {
                uploadZone.classList.add('has-file');
                uploadZone.querySelector('i').className = 'fas fa-check-circle';
                uploadZone.querySelector('p').textContent = `${position === 'front' ? 'Front' : 'Back'} Logo Uploaded`;
            }

            list.innerHTML = `
                <div class="file-item">
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onclick="removeFile('${position}')">×</button>
                </div>
            `;
        }

        function removeFile(position) {
            if (position === 'front') {
                state.frontLogo = null;
                renderFileList('front');
                showToast('Front logo removed', 'info', 2000);
            } else {
                state.backLogo = null;
                renderFileList('back');
                showToast('Back logo removed', 'info', 2000);
            }

            // Sync uploaded files array after removal
            syncUploadedFilesArray();
        }

        // Payment Modal Functions
        function showPaymentModal() {
            // Read pricing breakdown from state (single source of truth)
            const { subtotal, rushFee, ltmFee, salesTax: tax, shipping, grandTotal: total } = state.orderTotals;

            // Update payment modal with amounts
            document.getElementById('paymentSubtotal').textContent = `$${subtotal.toFixed(2)}`;
            document.getElementById('paymentRushFee').textContent = `$${rushFee.toFixed(2)}`;

            // Show/hide LTM fee row based on whether it applies
            const ltmFeeRow = document.getElementById('paymentLtmFeeRow');
            if (ltmFee > 0) {
                ltmFeeRow.style.display = 'flex';
                document.getElementById('paymentLtmFee').textContent = `$${ltmFee.toFixed(2)}`;
            } else {
                ltmFeeRow.style.display = 'none';
            }

            document.getElementById('paymentTax').textContent = `$${tax.toFixed(2)}`;
            document.getElementById('paymentShipping').textContent = `$${shipping.toFixed(2)}`;
            document.getElementById('paymentTotal').textContent = `$${total.toFixed(2)}`;
            document.getElementById('payButtonAmount').textContent = `$${total.toFixed(2)}`;

            // Mount Stripe card element if not already mounted
            if (cardElement && !cardElement._parent) {
                cardElement.mount('#card-element');

                // Handle real-time validation errors
                cardElement.on('change', (event) => {
                    const displayError = document.getElementById('card-errors');
                    if (event.error) {
                        displayError.textContent = event.error.message;
                    } else {
                        displayError.textContent = '';
                    }
                });
            }

            // Show modal
            document.getElementById('paymentModal').classList.add('active');
        }

        function closePaymentModal() {
            document.getElementById('paymentModal').classList.remove('active');
            // Clear errors
            document.getElementById('card-errors').textContent = '';
        }

        /**
         * Restore Pay button to its original enabled state
         * Used when payment fails and user needs to retry
         */
        function restorePayButton() {
            const payButton = document.getElementById('payButton');
            payButton.disabled = false;
            payButton.innerHTML = 'Pay Now';
        }

        /**
         * Get user-friendly error message for Stripe error
         */
        function getStripeErrorMessage(error) {
            console.error('[Payment] Stripe error:', error);

            // CRITICAL: Check decline_code FIRST (more specific than error.code)
            // This is essential for security-sensitive errors like lost/stolen cards
            if (error.decline_code) {
                const declineMessages = {
                    // SECURITY: Lost/stolen cards - NO RETRY
                    'lost_card': 'This card has been reported lost. Please use a different card.\n\nIf you need assistance, please call us at 253-922-5793.',
                    'stolen_card': 'This card has been reported stolen. Please use a different card.\n\nIf you need assistance, please call us at 253-922-5793.',

                    // FINANCIAL: Insufficient funds
                    'insufficient_funds': 'Insufficient funds. Please try a different card or add funds to your account.',

                    // Bank decline reasons
                    'do_not_honor': 'Your bank declined this transaction. Please contact your bank or try a different card.',
                    'fraudulent': 'This transaction was flagged as potentially fraudulent. Please contact your bank.',
                    'generic_decline': 'Your card was declined. Please contact your bank for more information.',
                    'invalid_account': 'The card account is invalid. Please check your card details or use a different card.',
                    'new_account_information_available': 'Your card information may be outdated. Please check with your bank.',
                    'no_action_taken': 'Your bank did not approve this payment. Please try a different card or contact your bank.',
                    'not_permitted': 'This type of transaction is not permitted on your card. Please try a different card.',
                    'pickup_card': 'This card cannot be used. Please contact your bank or use a different card.',
                    'restricted_card': 'This card has restrictions. Please contact your bank or use a different card.',
                    'revocation_of_all_authorizations': 'All authorizations have been revoked for this card. Please use a different card.',
                    'revocation_of_authorization': 'Authorization was revoked for this card. Please use a different card.',
                    'security_violation': 'Security violation detected. Please contact your bank.',
                    'service_not_allowed': 'This service is not allowed on your card. Please try a different card.',
                    'stop_payment_order': 'A stop payment order exists for this card. Please contact your bank.',
                    'testmode_decline': 'Test card declined. Please use a real card number.',
                    'transaction_not_allowed': 'This transaction is not allowed. Please try a different card or contact your bank.',
                    'try_again_later': 'Temporary issue with your bank. Please try again in a few moments.',
                    'withdrawal_count_limit_exceeded': 'You have exceeded your card\'s transaction limit. Please try again later or use a different card.'
                };

                if (declineMessages[error.decline_code]) {
                    return {
                        message: declineMessages[error.decline_code],
                        code: error.decline_code,
                        canRetry: !['lost_card', 'stolen_card'].includes(error.decline_code) // SECURITY: No retry for lost/stolen
                    };
                }
            }

            // Then check generic error codes
            const errorMessages = {
                // Card errors
                'card_declined': 'Your card was declined. Please try a different payment method or contact your bank.',
                'insufficient_funds': 'Insufficient funds. Please try a different card or add funds to your account.',
                'expired_card': 'Your card has expired. Please check the expiration date or use a different card.',
                'incorrect_cvc': 'Incorrect security code (CVC). Please check the 3-digit code on the back of your card.',
                'incorrect_number': 'Invalid card number. Please check your card number and try again.',
                'invalid_expiry_month': 'Invalid expiration month. Please check your card\'s expiration date.',
                'invalid_expiry_year': 'Invalid expiration year. Please check your card\'s expiration date.',
                'invalid_cvc': 'Invalid security code. Please enter the 3-digit CVC from your card.',
                'invalid_number': 'Your card number is invalid.',

                // Processing errors
                'processing_error': 'Error processing your payment. Please try again in a moment.',
                'rate_limit': 'Too many payment attempts. Please wait a moment before trying again.',

                // Authentication errors
                'authentication_required': 'Your bank requires additional authentication. Please complete the verification step.',
                'approve_with_id': 'Your payment requires approval. Please contact your bank to authorize this transaction.',

                // Network/system errors
                'api_connection_error': 'Connection error. Please check your internet connection and try again.',
                'api_error': 'Payment system error. Please try again or contact support at 253-922-5793.',

                // Generic decline
                'generic_decline': 'Your card was declined. Please contact your bank or try a different card.'
            };

            // Get specific error message based on error.code
            if (error.code && errorMessages[error.code]) {
                return {
                    message: errorMessages[error.code],
                    code: error.code,
                    canRetry: true // Generic errors can be retried
                };
            }

            // Default error message
            return {
                message: error.message || 'Payment failed. Please check your card details and try again, or contact support at 253-922-5793.',
                code: error.code || 'unknown',
                canRetry: true
            };
        }

        async function processPayment() {
            // Check if payment is already being processed
            if (isProcessingPayment) {
                console.log('[Payment] Already processing payment, ignoring duplicate request');
                return null;
            }

            if (!stripe || !cardElement) {
                showToast('Payment system not ready. Please refresh the page.', 'error');
                return null;
            }

            // Set flag to prevent duplicate processing
            isProcessingPayment = true;

            try {
                showLoading(true);

                // Read order total from state (single source of truth)
                const total = state.orderTotals.grandTotal;

                // Create payment intent on server via ApiService
                console.log('[Payment] Creating payment intent via ApiService...');
                const { clientSecret } = await apiService.post('/api/create-payment-intent', {
                    amount: Math.round(total * 100), // Convert to cents
                    currency: 'usd'
                });
                paymentIntentClientSecret = clientSecret;
                console.log('[Payment] ✓ Payment intent created');

                // Confirm card payment
                const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
                            email: document.getElementById('email').value
                        }
                    }
                });

                showLoading(false);

                if (error) {
                    // Payment failed - get user-friendly error message
                    const errorInfo = getStripeErrorMessage(error);
                    console.error('[Payment] Payment failed:', errorInfo.code, errorInfo.message);

                    // Show error to user with longer display time for important messages
                    const displayTime = errorInfo.canRetry ? 10000 : 15000;
                    showToast(errorInfo.message, 'error', displayTime);

                    // Log for debugging
                    console.error('[Payment] Full error details:', {
                        code: error.code,
                        decline_code: error.decline_code,
                        type: error.type,
                        message: error.message,
                        canRetry: errorInfo.canRetry
                    });

                    return null;
                } else if (paymentIntent.status === 'succeeded') {
                    // Payment succeeded
                    console.log('[Payment] Payment succeeded:', paymentIntent.id);

                    // Return complete payment object for API
                    return {
                        paymentId: paymentIntent.id,
                        paymentDate: new Date(paymentIntent.created * 1000).toISOString().split('T')[0], // Unix timestamp to YYYY-MM-DD
                        amount: paymentIntent.amount / 100, // Convert cents to dollars
                        status: paymentIntent.status,
                        paymentIntent: paymentIntent // Keep full object for reference
                    };
                } else if (paymentIntent.status === 'requires_action') {
                    // 3D Secure or other authentication required
                    console.log('[Payment] Additional authentication required');
                    showToast('Additional authentication required. Please complete the verification step.', 'warning', 8000);
                    return null;
                } else if (paymentIntent.status === 'requires_payment_method') {
                    // Payment method failed, need new one
                    console.log('[Payment] Payment method failed, needs replacement');
                    showToast('Payment method failed. Please try a different card.', 'error', 10000);
                    return null;
                } else {
                    // Other unexpected status
                    console.warn('[Payment] Unexpected payment status:', paymentIntent.status);
                    showToast('Payment status uncertain. Please contact support at 253-922-5793.', 'warning', 12000);
                    return null;
                }

            } catch (error) {
                showLoading(false);
                console.error('[Payment] Unexpected error:', error);

                // Check if network error
                if (error.message === 'Failed to fetch' || error.message.includes('network')) {
                    showToast('Network error. Please check your internet connection and try again.', 'error', 10000);
                } else if (error.message.includes('payment intent')) {
                    showToast('Payment system error. Please try again or contact support at 253-922-5793.', 'error', 12000);
                } else {
                    showToast('Unexpected error processing payment. Please try again or contact support at 253-922-5793.', 'error', 12000);
                }

                return null;
            } finally {
                // Always reset the processing flag
                isProcessingPayment = false;
            }
        }

        /**
         * Calculate the complete order total including all fees and taxes
         *
         * @returns {Object} Order total breakdown with the following properties:
         * @returns {number} returns.subtotal - Base cost of all items before rush fee
         * @returns {number} returns.rushFee - 25% rush fee applied to subtotal
         * @returns {number} returns.ltmFee - Less Than Minimum fee ($75 for 6-23 pieces)
         * @returns {number} returns.tax - Sales tax (10.1% for Washington state only, includes rush fee and LTM in taxable base)
         * @returns {number} returns.shipping - Flat shipping fee ($30)
         * @returns {number} returns.total - Grand total including all fees and taxes
         *
         * @description
         * Complete Order Total Calculation Process:
         *
         * Step 1: Calculate Total Quantity
         *   - Sums quantities across all selected colors and sizes
         *   - Determines pricing tier based on total quantity
         *
         * Step 2: Find Pricing Tier
         *   - Matches total quantity to appropriate pricing tier
         *   - For quantities under 24 (LTM), uses lowest tier (24-47) pricing
         *   - Tier determines margin denominator and print costs
         *
         * Step 3: Calculate Base Cost Per Piece
         *   - Gets lowest garment price from pricing data
         *   - Applies tier-specific margin denominator
         *   - Formula: baseCost / tier.MarginDenominator
         *
         * Step 4: Add Print Cost
         *   - Single locations: Adds one print cost (LC or FF)
         *   - Combo locations (LC_FB, FF_FB): Sums front + back costs
         *   - Print costs vary by tier
         *
         * Step 5: Calculate Subtotal with Size Upcharges
         *   - For each color and size:
         *     - Base price = markedUpGarment + printCost (rounded to half-dollar)
         *     - Add size-specific upcharge (2XL, 3XL, etc.)
         *     - Multiply by quantity for that size
         *   - Sum all line items to get subtotal
         *
         * Step 6: Apply 25% Rush Fee
         *   - Rush fee = subtotal × 0.25
         *   - Added to subtotal for 3-day turnaround
         *
         * Step 7: Calculate LTM Fee
         *   - $75 flat fee for orders with 6-23 pieces
         *   - No LTM fee for 0-5 pieces (below minimum)
         *   - No LTM fee for 24+ pieces (meets minimum)
         *
         * Step 8: Add Shipping
         *   - Flat $30 shipping fee for all orders
         *
         * Step 9: Calculate Sales Tax
         *   - Washington state only: 10.1% tax rate
         *   - All other states: 0% (no tax collected)
         *   - Taxable base includes: subtotal + rush fee + LTM fee
         *   - Shipping is NOT taxable
         *   - Formula: (subtotalWithRush + ltmFee) × 0.101
         *
         * Step 10: Calculate Grand Total
         *   - total = subtotal + rushFee + ltmFee + tax + shipping
         *
         * @example
         * // Example order: 20 pieces (2XL) to Washington state
         * // Single location (Left Chest)
         * const result = calculateOrderTotal();
         * // Returns: {
         * //   subtotal: 350.00,    // 20 pieces × $17.50 (base + upcharge)
         * //   rushFee: 87.50,      // 25% of $350
         * //   ltmFee: 75.00,       // LTM fee (6-23 pieces)
         * //   tax: 51.77,          // 10.1% of ($350 + $87.50 + $75)
         * //   shipping: 30.00,     // Flat rate
         * //   total: 594.27        // Grand total
         * // }
         *
         * @example
         * // Example order: 50 pieces (mixed sizes) to California
         * // Combo location (Left Chest + Full Back)
         * const result = calculateOrderTotal();
         * // Returns: {
         * //   subtotal: 950.00,    // 50 pieces × ~$19 avg (varies by size)
         * //   rushFee: 237.50,     // 25% of $950
         * //   ltmFee: 0,           // No LTM (50 pieces meets minimum)
         * //   tax: 0,              // No tax (California)
         * //   shipping: 30.00,     // Flat rate
         * //   total: 1217.50       // Grand total
         * // }
         */
        function calculateOrderTotal() {
            // Calculate total quantity across all colors
            let grandTotalQuantity = 0;
            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];
                const qty = Object.values(config.sizeBreakdown).reduce((sum, s) => sum + s.quantity, 0);
                grandTotalQuantity += qty;
            });

            // Get pricing data directly (not nested under .pricing)
            const pricingData = state.pricingData || {};

            console.log('[Payment] Looking for tier for quantity:', grandTotalQuantity);
            console.log('[Payment] Available tiers:', (pricingData.tiersR || []).map(t => {
                return `${t.TierLabel}: ${t.MinQuantity}-${t.MaxQuantity}`;
            }));

            // Find tier for quantity - Handle LTM (Less Than Minimum) case
            let tier = (pricingData.tiersR || []).find(t =>
                grandTotalQuantity >= t.MinQuantity && grandTotalQuantity <= t.MaxQuantity
            );

            // If no tier found and quantity is under 24, use the 24-47 tier (lowest tier)
            if (!tier && grandTotalQuantity < 24) {
                const lowestTier = (pricingData.tiersR || []).sort((a, b) => a.MinQuantity - b.MinQuantity)[0];
                if (lowestTier) {
                    console.log('[Payment] Quantity under minimum, using lowest tier:', lowestTier.TierLabel);
                    tier = lowestTier;
                }
            }

            if (!tier) {
                console.error('[Payment] No tier found for quantity:', grandTotalQuantity);
                console.error('[Payment] Available tiers:', pricingData.tiersR);
                return { subtotal: 0, rushFee: 0, tax: 0, total: 0 };
            }

            console.log('[Payment] Using tier:', tier.TierLabel, `(${tier.MinQuantity}-${tier.MaxQuantity})`);


            // Calculate base cost per piece
            const baseCost = Math.min(...(pricingData.sizes || []).map(s => parseFloat(s.price)).filter(p => p > 0));
            const markedUp = baseCost / tier.MarginDenominator;

            // Get print cost - parse location from Phase 1 selection
            let totalPrintCost = 0;

            // selectedLocation will be 'LC', 'FF', 'LC_FB', or 'FF_FB' from Phase 1
            const isComboLocation = selectedLocation && selectedLocation.includes('_FB');
            const frontLocation = isComboLocation ? selectedLocation.split('_')[0] : selectedLocation;

            // Add front location cost
            const frontPrintCost = (pricingData.allDtgCostsR || []).find(c =>
                c.PrintLocationCode === frontLocation &&
                c.TierLabel === tier.TierLabel
            )?.PrintCost || 0;
            totalPrintCost += frontPrintCost;

            // Add back print cost if location includes Full Back (combo location)
            if (isComboLocation) {
                const backPrintCost = (pricingData.allDtgCostsR || []).find(c =>
                    c.PrintLocationCode === 'FB' &&
                    c.TierLabel === tier.TierLabel
                )?.PrintCost || 0;
                totalPrintCost += backPrintCost;

                console.log(`[Payment] Combo location pricing: ${frontLocation} ($${frontPrintCost.toFixed(2)}) + FB ($${backPrintCost.toFixed(2)}) = $${totalPrintCost.toFixed(2)}`);
            } else {
                console.log(`[Payment] Single location pricing: ${frontLocation} = $${frontPrintCost.toFixed(2)}`);
            }

            // Calculate base price per piece using total print cost
            const basePrice = markedUp + totalPrintCost;
            const roundedBase = Math.ceil(basePrice * 2) / 2;

            // Calculate subtotal with size upcharges
            let subtotal = 0;
            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];
                Object.entries(config.sizeBreakdown).forEach(([size, sizeData]) => {
                    const upcharge = (pricingData.sellingPriceDisplayAddOns || {})[size] || 0;
                    const pricePerPiece = roundedBase + upcharge;
                    subtotal += pricePerPiece * sizeData.quantity;
                });
            });

            // Apply 25% rush fee
            const rushFee = subtotal * 0.25;
            const subtotalWithRush = subtotal + rushFee;

            // Calculate LTM fee for orders 6-23 pieces
            const ltmFee = (grandTotalQuantity >= 6 && grandTotalQuantity < 24) ? 75 : 0;

            // Add shipping fee
            const shipping = 30;

            // Apply conditional sales tax (10.1% for WA only, includes LTM in taxable base)
            const stateField = document.getElementById('state');
            const shippingState = stateField ? stateField.value.trim().toUpperCase() : '';
            const taxRate = (shippingState === 'WA' || shippingState === 'WASHINGTON') ? 0.101 : 0;
            const tax = (subtotalWithRush + ltmFee) * taxRate;

            // Calculate grand total with all fees
            const total = subtotalWithRush + ltmFee + tax + shipping;

            return {
                subtotal: subtotal,
                rushFee: rushFee,
                ltmFee: ltmFee,
                tax: tax,
                shipping: shipping,
                total: total
            };
        }

        // Initialize payment button handler
        function initPaymentHandlers() {
            const payButton = document.getElementById('payButton');
            if (payButton) {
                payButton.addEventListener('click', async () => {
                    // Disable button during processing
                    payButton.disabled = true;
                    payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

                    // Process payment
                    const paymentId = await processPayment();

                    if (paymentId) {
                        // Close payment modal
                        closePaymentModal();

                        // Submit order with payment ID
                        await submitOrderWithPayment(paymentId);
                    } else {
                        // Re-enable button on failure
                        payButton.disabled = false;
                        const total = parseFloat(document.getElementById('grandTotal').textContent.replace('$', '').replace(',', '')) || 0;
                        payButton.innerHTML = `<i class="fas fa-lock"></i> Pay $${total.toFixed(2)}`;
                    }
                });
            }
        }

        // Submit order with payment ID
        async function submitOrderWithPayment(paymentId) {
            try {
                showLoading(true);

                // Collect customer data
                const customerData = {
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value,
                    company: document.getElementById('company').value || '',
                    address1: document.getElementById('address1').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    zip: document.getElementById('zip').value,
                    notes: document.getElementById('notes').value || ''
                };

                // Generate order number for file upload (same format as order service)
                const now = new Date();
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const day = now.getDate().toString().padStart(2, '0');
                const hours = now.getHours().toString().padStart(2, '0');
                const sequence = Math.floor(Math.random() * 1000);
                const tempOrderNumber = `3DT-${month}${day}-${hours}-${sequence}`;

                // Upload files to Caspio storage (returns URLs instead of base64)
                console.log('[3-Day Tees] Uploading files to Caspio storage...');
                console.log('[3-Day Tees] Files to upload:', state.uploadedFiles.length);
                const uploadedFiles = [];

                for (let i = 0; i < state.uploadedFiles.length; i++) {
                    const file = state.uploadedFiles[i];
                    const position = file.position || (i === 0 ? 'front' : 'back'); // Get position marker

                    try {
                        console.log(`[3-Day Tees] Uploading ${position} logo: ${file.name}`);

                        // Generate unique filename: orderNum_timestamp_position_originalName
                        const timestamp = Date.now();
                        const fileExt = file.name.split('.').pop();
                        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        const uniqueFileName = `${tempOrderNumber}_${timestamp}_${position}_${baseName}.${fileExt}`;

                        // Create renamed file
                        const renamedFile = new File([file], uniqueFileName, { type: file.type });

                        const uploadResult = await uploadFileToCaspio(renamedFile, tempOrderNumber);

                        uploadedFiles.push({
                            position: position,  // Preserve position (front/back)
                            fileName: file.name,  // Original name for display
                            uniqueFileName: uniqueFileName,  // Unique name for storage
                            fileUrl: uploadResult.url,  // URL instead of base64 data
                            fileSize: file.size,
                            fileType: file.type,
                            category: 'artwork',
                            description: position === 'front' ? 'Front Artwork' : 'Back Artwork'
                        });

                        console.log(`[3-Day Tees] ✓ Uploaded ${position} logo: ${file.name} → ${uniqueFileName}`);
                    } catch (uploadError) {
                        console.error(`[3-Day Tees] Upload failed for ${file.name}:`, uploadError);

                        // Show specific error based on type
                        let errorMessage = uploadError.message || 'Unknown error';

                        if (errorMessage.includes('409') || errorMessage.includes('already exists')) {
                            showToast(
                                `File already exists. Please rename "${file.name}" and try again.`,
                                'error',
                                8000
                            );
                        } else if (errorMessage.includes('Network') || errorMessage.includes('Failed to fetch')) {
                            showToast(
                                `Network error uploading "${file.name}". Please check your internet connection.`,
                                'error',
                                8000
                            );
                        } else {
                            showToast(
                                `Upload failed for "${file.name}": ${errorMessage}`,
                                'error',
                                8000
                            );
                        }

                        showLoading(false);
                        throw uploadError;
                    }
                }

                // Collect order settings
                // Location name mapping for new Phase 1 location system
                const locationNames = {
                    'LC': 'Left Chest',
                    'FF': 'Full Front',
                    'LC_FB': 'Left Chest + Full Back',
                    'FF_FB': 'Full Front + Full Back'
                };

                // Extract front and back logos from uploaded files by position
                const frontLogo = uploadedFiles.find(f => f.position === 'front');
                const backLogo = uploadedFiles.find(f => f.position === 'back');

                console.log('[3-Day Tees] Extracted logos:', {
                    frontLogo: frontLogo ? frontLogo.fileName : 'none',
                    backLogo: backLogo ? backLogo.fileName : 'none'
                });

                const orderSettings = {
                    printLocationCode: selectedLocation, // From Phase 1 global variable
                    printLocationName: locationNames[selectedLocation] || selectedLocation,
                    hasBackPrint: selectedLocation && selectedLocation.includes('_FB'), // Detect back print from combo location
                    uploadedFiles: uploadedFiles, // Use uploaded file URLs (not base64)
                    frontLogo: frontLogo,  // Explicit front logo for order service
                    backLogo: backLogo,    // Explicit back logo for order service
                    paymentData: paymentId, // Complete payment object (not just ID)
                    shippingState: document.getElementById('state').value, // Required for conditional sales tax (Phase 2.3)
                    colorConfigs: state.colorConfigs, // Pass color configurations
                    ltmFee: state.orderTotals.ltmFee || 0 // Add LTM fee for orders under 24 pieces
                };

                console.log('[3-Day Tees] Submitting order with payment ID:', paymentId);

                // Get pricing totals from state (single source of truth)
                const { grandTotal: orderTotal, salesTax, shipping: shippingCost } = state.orderTotals;
                console.log('[DEBUG C] Shipping extracted from state:', shippingCost, 'Type:', typeof shippingCost);

                console.log('[DEBUG D] About to call submitOrder with shipping:', shippingCost);
                // Submit order using ThreeDayTeesOrderService
                const result = await orderService.submitOrder(
                    customerData,
                    state.colorConfigs,
                    orderSettings,
                    orderTotal,
                    salesTax,
                    shippingCost
                );

                showLoading(false);

                if (result.success) {
                    // Show success message
                    document.getElementById('orderNumber').textContent = `Order #${result.orderNumber}`;

                    // Calculate and display estimated delivery date (3 business days)
                    const estimatedDeliveryDate = calculateDeliveryDate(3);
                    document.getElementById('estimatedDelivery').textContent = estimatedDeliveryDate;

                    // Show warning if API failed but saved to database
                    if (result.warning) {
                        const successText = document.querySelector('#successModal p');
                        if (successText) {
                            successText.innerHTML += `<br><br><strong>Note:</strong> ${result.warning}`;
                        }
                    }

                    document.getElementById('successModal').classList.add('active');
                } else {
                    // Show error with toast
                    showToast(
                        `Order submission failed: ${result.error}. Payment was processed successfully (ID: ${paymentId}). Please call 253-922-5793 for assistance.`,
                        'error',
                        15000  // 15 seconds for errors
                    );
                }

            } catch (error) {
                showLoading(false);
                console.error('[Order] Error:', error);
                showToast(
                    `Order submission error. Payment was processed (ID: ${paymentId}). Please call 253-922-5793 immediately.`,
                    'error',
                    15000
                );
            }
        }

        // DUPLICATE EVENT LISTENER REMOVED - Pay button listener is now only attached in DOMContentLoaded
        // This duplicate was causing race conditions and "in-flight confirmCardPayment" errors
        // The correct listener is at lines 2581-2606 inside DOMContentLoaded

        // Submit order - MULTI-COLOR SUPPORT
        document.getElementById('submitOrder').addEventListener('click', async () => {
            // Validate multi-color selections
            if (state.selectedColors.length === 0) {
                showToast('Please select at least one color to continue', 'warning');
                return;
            }

            if (!selectedLocation) {
                showToast('Please select a print location in Step 1', 'warning');
                return;
            }

            // Calculate total quantity across all colors
            let grandTotalQuantity = 0;
            state.selectedColors.forEach(catalogColor => {
                const config = state.colorConfigs[catalogColor];
                config.totalQuantity = Object.values(config.sizeBreakdown)
                    .reduce((sum, s) => sum + s.quantity, 0);
                grandTotalQuantity += config.totalQuantity;
            });

            if (grandTotalQuantity === 0) {
                showToast('Please enter quantities for at least one size', 'warning');
                return;
            }

            // Validate minimum order quantity (6 pieces)
            if (grandTotalQuantity < 6) {
                showToast('Minimum order is 6 pieces. Please add more items to your order.', 'error', 0);
                return;
            }

            if (!document.getElementById('firstName').value || !document.getElementById('lastName').value) {
                showToast('Please fill in your first and last name', 'warning');
                return;
            }

            if (!document.getElementById('email').value) {
                showToast('Please provide your email address', 'warning');
                return;
            }

            if (!document.getElementById('address1').value || !document.getElementById('city').value || !document.getElementById('state').value || !document.getElementById('zip').value) {
                showToast('Please fill in all required shipping address fields', 'warning');
                return;
            }

            // Validate front logo is uploaded (required)
            if (!state.frontLogo) {
                showToast('Front logo is required. Please upload your artwork in Step 2.', 'error', 6000);

                // Scroll to Step 2
                const step2 = document.querySelector('#step2');
                if (step2) {
                    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Highlight front upload zone with error state
                const frontZone = document.getElementById('frontUploadZone');
                if (frontZone) {
                    frontZone.style.borderColor = '#ef4444';
                    frontZone.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';

                    // Remove highlight after 3 seconds
                    setTimeout(() => {
                        frontZone.style.borderColor = '';
                        frontZone.style.backgroundColor = '';
                    }, 3000);
                }

                return;
            }

            // Validation passed - show payment modal
            console.log('[3-Day Tees] Validation passed, showing payment modal...');
            console.log('[3-Day Tees] Colors:', state.selectedColors);
            console.log('[3-Day Tees] Total quantity:', grandTotalQuantity);

            // Show payment modal (reads Order Summary DOM values automatically)
            showPaymentModal();
        });

        // NOTE: Order number generation and email sending now handled by ThreeDayTeesOrderService

        // Calculate delivery date (business days)
        function calculateDeliveryDate(businessDays) {
            const today = new Date();
            let daysAdded = 0;
            let currentDate = new Date(today);

            while (daysAdded < businessDays) {
                currentDate.setDate(currentDate.getDate() + 1);
                // Skip weekends (0 = Sunday, 6 = Saturday)
                const dayOfWeek = currentDate.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    daysAdded++;
                }
            }

            // Format: "Monday, January 15, 2025"
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            return currentDate.toLocaleDateString('en-US', options);
        }

        // Loading overlay
        function showLoading(show) {
            const overlay = document.getElementById('loadingOverlay');
            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }

        // Ship Date Calculation (matches backend logic)
        // Non-business days: US federal holidays + factory closure (Dec 26-31 annually)
        const NON_BUSINESS_DAYS = [
            // 2025 US Federal Holidays
            '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26',
            '2025-06-19', '2025-07-04', '2025-09-01', '2025-10-13',
            '2025-11-11', '2025-11-27', '2025-11-28', '2025-12-25',
            // 2025 Factory Closure (Dec 26-31)
            '2025-12-26', '2025-12-27', '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31',

            // 2026 US Federal Holidays
            '2026-01-01', '2026-01-02', '2026-01-19', '2026-02-16', '2026-05-25',
            '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12',
            '2026-11-11', '2026-11-26', '2026-11-27', '2026-12-25',
            // 2026 Factory Closure (Dec 26-31)
            '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',

            // 2027 US Federal Holidays
            '2027-01-01', '2027-01-02', '2027-01-18', '2027-02-15', '2027-05-31',
            '2027-06-18', '2027-07-05', '2027-09-06', '2027-10-11',
            '2027-11-11', '2027-11-25', '2027-11-26', '2027-12-24',
            // 2027 Factory Closure (Dec 26-31)
            '2027-12-26', '2027-12-27', '2027-12-28', '2027-12-29', '2027-12-30', '2027-12-31',

            // 2028 US Federal Holidays
            '2028-01-01', '2028-01-02', '2028-01-17', '2028-02-21', '2028-05-29',
            '2028-06-19', '2028-07-04', '2028-09-04', '2028-10-09',
            '2028-11-10', '2028-11-23', '2028-11-24', '2028-12-25',
            // 2028 Factory Closure (Dec 26-31)
            '2028-12-26', '2028-12-27', '2028-12-28', '2028-12-29', '2028-12-30', '2028-12-31',

            // 2029 US Federal Holidays
            '2029-01-01', '2029-01-02', '2029-01-15', '2029-02-19', '2029-05-28',
            '2029-06-19', '2029-07-04', '2029-09-03', '2029-10-08',
            '2029-11-12', '2029-11-22', '2029-11-23', '2029-12-25',
            // 2029 Factory Closure (Dec 26-31)
            '2029-12-26', '2029-12-27', '2029-12-28', '2029-12-29', '2029-12-30', '2029-12-31',

            // 2030 US Federal Holidays
            '2030-01-01', '2030-01-02', '2030-01-21', '2030-02-18', '2030-05-27',
            '2030-06-19', '2030-07-04', '2030-09-02', '2030-10-14',
            '2030-11-11', '2030-11-28', '2030-11-29', '2030-12-25',
            // 2030 Factory Closure (Dec 26-31)
            '2030-12-26', '2030-12-27', '2030-12-28', '2030-12-29', '2030-12-30', '2030-12-31',

            // 2031 US Federal Holidays (partial - for year boundary)
            '2031-01-01', '2031-01-02'
        ];

        function isBeforeCutoff() {
            const now = new Date();
            const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

            // Check if today is weekend or holiday
            const dayOfWeek = pstTime.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isTodayHoliday = isHoliday(pstTime);

            // If today is not a business day, cutoff doesn't apply today
            if (isWeekend || isTodayHoliday) {
                return false;
            }

            // Today is a business day - check if before 9 AM
            return pstTime.getHours() < 9;
        }

        function getOrderDate() {
            const now = new Date();
            if (!isBeforeCutoff()) {
                // After 9 AM - order counts as tomorrow
                now.setDate(now.getDate() + 1);
            }

            // Advance to next business day if on weekend or holiday
            // Production clock only starts Monday-Friday, non-holidays
            while (now.getDay() === 0 || now.getDay() === 6 || isHoliday(now)) {
                now.setDate(now.getDate() + 1);
            }

            return now;
        }

        function isHoliday(date) {
            const dateStr = date.toISOString().split('T')[0];
            return NON_BUSINESS_DAYS.includes(dateStr);
        }

        function calculateShipDate(orderDate) {
            const date = new Date(orderDate);
            let businessDaysAdded = 0;

            while (businessDaysAdded < 3) {
                date.setDate(date.getDate() + 1);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHolidayDate = isHoliday(date);

                if (!isWeekend && !isHolidayDate) {
                    businessDaysAdded++;
                }
            }

            return date;
        }

        function formatShipDate(date) {
            const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        }

        function getNextBusinessDayCutoff() {
            const now = new Date();
            const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

            // Start with tomorrow
            const nextCutoff = new Date(pstTime);
            nextCutoff.setDate(nextCutoff.getDate() + 1);
            nextCutoff.setHours(9, 0, 0, 0);

            // Skip weekends and holidays
            while (nextCutoff.getDay() === 0 || nextCutoff.getDay() === 6 || isHoliday(nextCutoff)) {
                nextCutoff.setDate(nextCutoff.getDate() + 1);
            }

            return nextCutoff;
        }

        function getTimeUntilCutoff() {
            const now = new Date();
            const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

            // Calculate time until 9 AM PST today
            const cutoff = new Date(pstTime);
            cutoff.setHours(9, 0, 0, 0);

            // Check if today is a business day
            const dayOfWeek = pstTime.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isTodayHoliday = isHoliday(pstTime);

            // If already past cutoff OR today is not a business day, use next business day's cutoff
            let targetCutoff;
            if (pstTime >= cutoff || isWeekend || isTodayHoliday) {
                targetCutoff = getNextBusinessDayCutoff();
            } else {
                targetCutoff = cutoff;
            }

            const diff = targetCutoff - pstTime;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            return { hours, minutes, cutoffDate: targetCutoff };
        }

        function updateShipDateDisplay() {
            const messageEl = document.getElementById('shipDateMessage');
            const countdownEl = document.getElementById('shipDateCountdown');

            if (!messageEl || !countdownEl) return;

            // Get dynamic timezone abbreviation (PST or PDT)
            const now = new Date();
            const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
            const tzAbbr = pstTime.toLocaleTimeString('en-US', {
                timeZone: 'America/Los_Angeles',
                timeZoneName: 'short'
            }).split(' ').pop();

            const orderDate = getOrderDate();
            const shipDate = calculateShipDate(orderDate);
            const formattedShipDate = formatShipDate(shipDate);

            if (isBeforeCutoff()) {
                messageEl.textContent = `Order by 9 AM ${tzAbbr} today → Ships from our facility ${formattedShipDate}`;

                const { hours, minutes } = getTimeUntilCutoff();
                countdownEl.textContent = `⏱ ${hours}h ${minutes}m remaining until cutoff`;
            } else {
                messageEl.textContent = `Orders placed now will ship ${formattedShipDate}`;

                const { hours, minutes, cutoffDate } = getTimeUntilCutoff();
                const dayName = cutoffDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' });
                countdownEl.textContent = `Next cutoff: ${dayName} at 9 AM ${tzAbbr} (${hours}h ${minutes}m)`;
            }
        }

        // Year boundary warning - Check if holiday data is current
        function checkHolidayDataExpiration() {
            const now = new Date();
            const lastHoliday = new Date('2030-12-31');
            const warningDate = new Date('2030-10-01'); // 3 months warning

            if (now > lastHoliday) {
                console.error('[3-Day Tees] ⚠️ CRITICAL: Holiday data expired! Update NON_BUSINESS_DAYS array for 2031+');
                // Show warning banner to admin/developer
                const banner = document.createElement('div');
                banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc3545;color:white;padding:10px;text-align:center;z-index:9999;font-weight:bold;';
                banner.textContent = '⚠️ ADMIN: Holiday data expired - ship dates may be incorrect. Update NON_BUSINESS_DAYS array.';
                document.body.prepend(banner);
            } else if (now > warningDate) {
                console.warn('[3-Day Tees] ⚡ Holiday data expires soon. Add holidays for 2031+ to NON_BUSINESS_DAYS array.');
            }
        }

        // Update ship date display on load and every minute
        updateShipDateDisplay();
        setInterval(updateShipDateDisplay, 60000); // Update every 60 seconds

        // Initialize on page load - Unified initialization block
        document.addEventListener('DOMContentLoaded', () => {
            checkHolidayDataExpiration();  // Check holiday data first
            initThirdPartyServices();       // Initialize EmailJS and Stripe
            initEventListeners();           // Setup UI event handlers
            initPaymentHandlers();          // Setup payment button
            init();                         // Initialize the page with data
        });
