/**
 * Stripe Payment Service for 3-Day Tees
 * Handles all Stripe-related operations with proper error handling
 *
 * Created: 2025-11-25
 * Purpose: Centralized Stripe payment handling with:
 *   - Proper initialization flow
 *   - Idempotency key support to prevent duplicate charges
 *   - Human-readable error messages
 *   - Split card element support
 */
class StripePaymentService {
    constructor() {
        this.stripe = null;
        this.elements = null;
        this.cardElements = {};
        this.isInitialized = false;
        this.paymentIntentId = null;
        this.initializationPromise = null;
    }

    /**
     * Initialize Stripe with publishable key from server
     * Returns a promise that can be awaited for initialization completion
     */
    async initialize() {
        // If already initializing, return the existing promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // If already initialized, return immediately
        if (this.isInitialized) {
            console.log('[StripeService] Already initialized');
            return true;
        }

        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        try {
            console.log('[StripeService] Fetching Stripe config...');

            const response = await fetch('/api/stripe-config');
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[StripeService] Config fetch failed:', response.status, errorText);
                throw new Error(`Failed to fetch Stripe config: ${response.status}`);
            }

            const data = await response.json();
            const { publishableKey } = data;

            if (!publishableKey) {
                throw new Error('No publishable key received from server');
            }

            // Verify key format
            if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
                console.warn('[StripeService] Key format unusual:', publishableKey.substring(0, 10) + '...');
            }

            console.log('[StripeService] Key prefix:', publishableKey.substring(0, 12) + '...');

            // Initialize Stripe
            if (typeof Stripe === 'undefined') {
                throw new Error('Stripe.js not loaded. Ensure <script src="https://js.stripe.com/v3/"></script> is included.');
            }

            this.stripe = Stripe(publishableKey);
            this.elements = this.stripe.elements();
            this.isInitialized = true;

            console.log('[StripeService] ✓ Initialized successfully');
            return true;
        } catch (error) {
            console.error('[StripeService] Initialization failed:', error);
            this.initializationPromise = null; // Allow retry
            throw error;
        }
    }

    /**
     * Check if service is ready for payments
     */
    isReady() {
        return this.isInitialized && this.stripe !== null;
    }

    /**
     * Create card elements with consistent styling
     * @param {Object} containerIds - Object with number, expiry, cvc element IDs
     * @returns {Object} Card elements for attaching event handlers
     */
    createCardElements(containerIds) {
        if (!this.isInitialized) {
            throw new Error('Stripe not initialized. Call initialize() first.');
        }

        // Destroy any existing elements first
        this.destroyCardElements();

        const style = {
            base: {
                color: '#1f2937',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': { color: '#9ca3af' }
            },
            invalid: {
                color: '#ef4444',
                iconColor: '#ef4444'
            }
        };

        // Create split elements for better UX
        this.cardElements.number = this.elements.create('cardNumber', {
            style,
            showIcon: true
        });
        this.cardElements.expiry = this.elements.create('cardExpiry', { style });
        this.cardElements.cvc = this.elements.create('cardCvc', { style });

        // Mount to DOM
        if (containerIds.number) {
            this.cardElements.number.mount(containerIds.number);
        }
        if (containerIds.expiry) {
            this.cardElements.expiry.mount(containerIds.expiry);
        }
        if (containerIds.cvc) {
            this.cardElements.cvc.mount(containerIds.cvc);
        }

        console.log('[StripeService] ✓ Card elements created and mounted');

        // Return for error handling setup
        return this.cardElements;
    }

    /**
     * Create a single combined card element (simpler integration)
     * @param {string} containerId - Element ID to mount to
     * @returns {Object} Card element
     */
    createCombinedCardElement(containerId) {
        if (!this.isInitialized) {
            throw new Error('Stripe not initialized. Call initialize() first.');
        }

        // Destroy any existing elements first
        this.destroyCardElements();

        const style = {
            base: {
                color: '#1f2937',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': { color: '#9ca3af' }
            },
            invalid: {
                color: '#ef4444',
                iconColor: '#ef4444'
            }
        };

        this.cardElements.combined = this.elements.create('card', { style });
        this.cardElements.combined.mount(containerId);

        console.log('[StripeService] ✓ Combined card element created and mounted');

        return this.cardElements.combined;
    }

    /**
     * Get the primary card element (for payment confirmation)
     */
    getCardElement() {
        return this.cardElements.combined || this.cardElements.number;
    }

    /**
     * Process payment with proper error handling and idempotency
     * @param {number} amount - Amount in dollars (will be converted to cents)
     * @param {Object} billingDetails - Customer billing details
     * @param {string} orderId - Unique order identifier for idempotency
     * @returns {Object} Result with success status and payment details or error
     */
    async processPayment(amount, billingDetails, orderId = null) {
        if (!this.isInitialized) {
            return {
                success: false,
                error: 'Payment system not initialized. Please refresh the page.'
            };
        }

        const cardElement = this.getCardElement();
        if (!cardElement) {
            return {
                success: false,
                error: 'Card information not entered. Please enter your card details.'
            };
        }

        try {
            console.log('[StripeService] Creating payment intent for $' + amount.toFixed(2));

            // Generate idempotency key to prevent duplicate charges
            const idempotencyKey = orderId
                ? `${orderId}_${Date.now()}`
                : `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create payment intent
            const intentResponse = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: Math.round(amount * 100), // Convert to cents
                    currency: 'usd',
                    orderId: orderId,
                    idempotencyKey: idempotencyKey
                })
            });

            if (!intentResponse.ok) {
                let errorMessage = 'Failed to create payment';
                try {
                    const errorData = await intentResponse.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = await intentResponse.text() || errorMessage;
                }

                console.error('[StripeService] Payment intent creation failed:', errorMessage);
                return {
                    success: false,
                    error: this.getHumanReadableError({ message: errorMessage })
                };
            }

            const intentData = await intentResponse.json();
            const { clientSecret } = intentData;

            if (!clientSecret) {
                return {
                    success: false,
                    error: 'Payment setup failed. Please try again.'
                };
            }

            console.log('[StripeService] Payment intent created, confirming card payment...');

            // Confirm card payment
            const { error, paymentIntent } = await this.stripe.confirmCardPayment(
                clientSecret,
                {
                    payment_method: {
                        card: cardElement,
                        billing_details: billingDetails
                    }
                }
            );

            if (error) {
                console.error('[StripeService] Card confirmation error:', error);
                return {
                    success: false,
                    error: this.getHumanReadableError(error)
                };
            }

            if (paymentIntent.status === 'succeeded') {
                this.paymentIntentId = paymentIntent.id;
                console.log('[StripeService] ✓ Payment succeeded:', paymentIntent.id);
                return {
                    success: true,
                    paymentIntentId: paymentIntent.id,
                    amount: paymentIntent.amount / 100,
                    status: 'succeeded'
                };
            }

            if (paymentIntent.status === 'requires_action') {
                console.log('[StripeService] Payment requires additional action (3D Secure)');
                return {
                    success: false,
                    requiresAction: true,
                    error: 'Additional authentication required. Please complete 3D Secure verification.'
                };
            }

            console.log('[StripeService] Unexpected payment status:', paymentIntent.status);
            return {
                success: false,
                error: `Payment status: ${paymentIntent.status}. Please try again.`
            };

        } catch (error) {
            console.error('[StripeService] Payment processing error:', error);
            return {
                success: false,
                error: this.getHumanReadableError(error)
            };
        }
    }

    /**
     * Convert Stripe errors to user-friendly messages
     * @param {Object} error - Stripe error object
     * @returns {string} Human-readable error message
     */
    getHumanReadableError(error) {
        const errorMessages = {
            'card_declined': 'Your card was declined. Please try a different card.',
            'generic_decline': 'Your card was declined. Please try a different card.',
            'insufficient_funds': 'Insufficient funds. Please try a different card.',
            'expired_card': 'Your card has expired. Please use a different card.',
            'incorrect_cvc': 'The CVC number is incorrect. Please check and try again.',
            'incorrect_number': 'The card number is incorrect. Please check and try again.',
            'invalid_number': 'The card number is invalid. Please check and try again.',
            'invalid_expiry_month': 'The expiration month is invalid.',
            'invalid_expiry_year': 'The expiration year is invalid.',
            'processing_error': 'An error occurred while processing. Please try again.',
            'rate_limit': 'Too many requests. Please wait a moment and try again.',
            'authentication_required': 'Authentication required. Please try again.'
        };

        // Check for specific error code
        if (error.code && errorMessages[error.code]) {
            return errorMessages[error.code];
        }

        // Check for decline code
        if (error.decline_code && errorMessages[error.decline_code]) {
            return errorMessages[error.decline_code];
        }

        // Check for "Invalid API Key" in message
        if (error.message) {
            if (error.message.includes('Invalid API Key')) {
                return 'Payment system configuration error. Please contact support at 253-922-5793.';
            }
            if (error.message.includes('No such')) {
                return 'Payment configuration error. Please try again or contact support.';
            }
        }

        // Return the error message or a generic fallback
        return error.message || 'An unexpected error occurred. Please try again.';
    }

    /**
     * Get the last successful payment intent ID
     */
    getLastPaymentIntentId() {
        return this.paymentIntentId;
    }

    /**
     * Destroy card elements to prevent memory leaks
     */
    destroyCardElements() {
        Object.values(this.cardElements).forEach(element => {
            if (element) {
                try {
                    element.destroy();
                } catch (e) {
                    // Element may already be destroyed
                }
            }
        });
        this.cardElements = {};
    }

    /**
     * Full cleanup - destroy elements and reset state
     */
    destroy() {
        this.destroyCardElements();
        this.isInitialized = false;
        this.initializationPromise = null;
        this.stripe = null;
        this.elements = null;
        this.paymentIntentId = null;
        console.log('[StripeService] Destroyed and reset');
    }

    /**
     * Reset for a new payment (keeps Stripe initialized)
     */
    reset() {
        this.destroyCardElements();
        this.paymentIntentId = null;
        console.log('[StripeService] Reset for new payment');
    }
}

// Export as singleton for use across the application
window.StripePaymentService = new StripePaymentService();

// Also export the class for testing or multiple instances
window.StripePaymentServiceClass = StripePaymentService;

console.log('[StripeService] Module loaded');
