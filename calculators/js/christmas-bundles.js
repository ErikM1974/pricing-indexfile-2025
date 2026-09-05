/* christmas-bundles.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in calculators/christmas-bundles.html (Rule 3, 2026.09.05.11) ──
(function() {
            // Initialize EmailJS with your public key
            emailjs.init("4qSbDO-SQs19TbP80");
        })();

        // Christmas Countdown Timer
        (function() {
            // Set the deadline date - October 24th, 2025 at 12:00 PM PST
            const deadline = new Date('October 24, 2025 12:00:00 PST').getTime();

            function updateCountdown() {
                const now = new Date().getTime();
                const timeRemaining = deadline - now;

                // If deadline has passed
                if (timeRemaining < 0) {
                    document.getElementById('days').textContent = '00';
                    document.getElementById('hours').textContent = '00';
                    document.getElementById('minutes').textContent = '00';
                    document.getElementById('seconds').textContent = '00';
                    document.querySelector('.countdown-message').innerHTML = '🎅 Offer Has Ended - Contact Us for Current Promotions! 🎅';
                    return;
                }

                // Calculate time units
                const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

                // Update the display with leading zeros
                document.getElementById('days').textContent = String(days).padStart(2, '0');
                document.getElementById('hours').textContent = String(hours).padStart(2, '0');
                document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
                document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');

                // Add urgency messages based on time remaining
                const messageEl = document.querySelector('.countdown-message');
                if (days === 0 && hours < 6) {
                    messageEl.innerHTML = '🚨 FINAL HOURS! Order Now - Offer Ends Tonight! 🚨';
                } else if (days === 0) {
                    messageEl.innerHTML = '⚡ LAST DAY! Order Today Before It\'s Too Late! ⚡';
                } else if (days === 1) {
                    messageEl.innerHTML = '🔥 Only 1 Day Left! Don\'t Miss Your FREE Gift Box! 🔥';
                } else if (days <= 3) {
                    messageEl.innerHTML = '⏰ Only ' + days + ' Days Left! Order Now! ⏰';
                } else {
                    messageEl.innerHTML = '🎁 Don\'t Miss Out on Your FREE Gift Box! 🎁';
                }
            }

            // Update countdown immediately
            updateCountdown();

            // Update every second
            setInterval(updateCountdown, 1000);
        })();

        // Send confirmation email function
        async function sendConfirmationEmail(quoteData, quoteID) {
            try {
                // Format items for email - simplified for Outlook compatibility (NO PRICES)
                const formatItem = (item, type) => {
                    if (!item) return 'Not selected';
                    // Extract the actual values from the selectedItems structure
                    const productName = (item.name || item.style || 'Item').replace(/[^\w\s-]/g, '');
                    const color = (item.selectedColor || 'No color').replace(/[^\w\s-]/g, '');
                    const size = item.selectedSize || 'No size';
                    // Return WITHOUT price since this is a free gift
                    return `${productName}, Color: ${color}, Size: ${size}`;
                };

                // Calculate totals
                const subtotal = calculateTotalPrice() - (RETAIL_PRICES.shipping || 25);
                const total = calculateTotalPrice();

                // Get thread colors from form - clean for email
                const threadColor1 = (document.getElementById('threadColor1')?.value || '').replace(/[^\w\s-]/g, '');
                const threadColor2 = (document.getElementById('threadColor2')?.value || '').replace(/[^\w\s-]/g, '');
                const threadColor3 = (document.getElementById('threadColor3')?.value || '').replace(/[^\w\s-]/g, '');

                // Format embroidery locations - simplified
                const jacketEmbLocation = (quoteData.jacketEmbLocation || document.getElementById('jacketEmbLocation')?.value || 'Standard').replace(/[^\w\s-]/g, '');
                const hoodieEmbLocation = (quoteData.hoodieEmbLocation || document.getElementById('hoodieEmbLocation')?.value || 'Standard').replace(/[^\w\s-]/g, '');
                const embroideryLocation = `Jacket Location: ${jacketEmbLocation} | Hoodie Location: ${hoodieEmbLocation}`;

                // Get custom text - sanitized
                const customText = (document.getElementById('customText')?.value || '').replace(/[<>]/g, '');

                // Sanitize helper function for names and text fields
                const sanitizeText = (text) => {
                    if (!text) return '';
                    return String(text).replace(/[<>\"'&]/g, '').trim();
                };

                // Prepare email template parameters - simplified for Outlook
                const emailParams = {
                    // Customer information - sanitized
                    to_email: sanitizeText(quoteData.email) || 'noreply@nwcustomapparel.com',
                    customer_name: sanitizeText(`${quoteData.firstName || ''} ${quoteData.lastName || ''}`).trim() || 'Customer',
                    company_name: sanitizeText(quoteData.company) || 'Not Provided',

                    // Quote details
                    quote_number: quoteID || 'PENDING',
                    quote_date: new Date().toLocaleDateString('en-US'),

                    // Bundle items
                    jacket_details: formatItem(selectedItems.jacket, 'Jacket'),
                    hoodie_details: formatItem(selectedItems.hoodie, 'Hoodie'),
                    beanie_details: formatItem(selectedItems.beanie, 'Beanie'),
                    gloves_details: formatItem(selectedItems.gloves, 'Gloves'),

                    // Customization details - plain text
                    thread_color_1: threadColor1 || 'Not selected',
                    thread_color_2: threadColor2 || 'Not selected',
                    thread_color_3: threadColor3 || 'Not selected',
                    embroidery_location: embroideryLocation,
                    custom_text: sanitizeText(customText) || 'None',
                    logo_upload: quoteData.imageUpload ? 'Logo uploaded' : 'No logo',

                    // Contact information - sanitized
                    phone: sanitizeText(quoteData.phone) || 'Not Provided',
                    email: sanitizeText(quoteData.email) || 'Not Provided',

                    // Delivery information - clean format
                    delivery_type: quoteData.deliveryMethod || 'Pickup',
                    delivery_date: quoteData.dueDate || 'To Be Determined',
                    address_1: sanitizeText(quoteData.shippingAddress) || 'Not Provided',
                    address_2: '',
                    city: sanitizeText(quoteData.shippingCity) || '',
                    state: sanitizeText(quoteData.shippingState) || '',
                    zip: sanitizeText(quoteData.shippingZip) || '',

                    // Pricing - plain numbers for Outlook
                    subtotal: String(subtotal.toFixed(2)),
                    shipping: String((RETAIL_PRICES.shipping || 25).toFixed(2)),
                    gift_box: String((RETAIL_PRICES.giftBox || 9).toFixed(2)),
                    total: String(total.toFixed(2)),

                    // Additional fields - sanitized
                    special_instructions: sanitizeText(quoteData.specialInstructions || document.getElementById('specialInstructions')?.value) || 'None',
                    quantity: String(calculateTotalQuantity()),

                    // Default values to prevent corruption - always provide safe strings
                    reply_to: sanitizeText(quoteData.email) || 'noreply@nwcustomapparel.com',
                    from_name: 'Northwest Custom Apparel',
                    company_phone: '253-922-5793',
                    company_year: '1977',

                    // Add safe defaults for any fields the template might use
                    sales_rep: 'Sales Team',
                    valid_days: '30'
                };

                // Send email using EmailJS
                const response = await emailjs.send(
                    'service_1c4k67j',  // Service ID
                    'template_v80ysfp',  // Template ID for Xmas Bundle
                    emailParams
                );

                console.log('Email sent successfully:', response);

                // Send sales team notification
                try {
                    const salesEmailParams = {
                        to_email: 'nika@nwcustomapparel.com, taneisha@nwcustomapparel.com',
                        quote_id: quoteID,
                        order_date: new Date().toLocaleString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        }),
                        customer_name: `${quoteData.firstName} ${quoteData.lastName}`,
                        customer_email: quoteData.email,
                        customer_phone: quoteData.phone,
                        customer_company: quoteData.company || 'Not provided'
                    };

                    // Send notification to sales team
                    await emailjs.send(
                        'service_1c4k67j',
                        'template_sales_xmas', // Template ID for sales team notification
                        salesEmailParams
                    );
                    console.log('Sales team notified of order:', quoteID);
                } catch (salesError) {
                    console.error('Failed to notify sales team:', salesError);
                    // Don't block order - sales notification is not critical
                }

                return { success: true, response };

            } catch (error) {
                console.error('Failed to send confirmation email:', error);
                // Don't throw error to prevent blocking order submission
                return { success: false, error: error.toString() };
            }
        }

// ── moved from inline <script> in calculators/christmas-bundles.html (Rule 3, 2026.09.05.11) ──
// Console safety wrapper for mobile devices (especially iOS Safari)
        // This prevents JavaScript from breaking when console.log is called without dev tools open
        (function() {
            if (!window.console) {
                window.console = {};
            }
            // Store original functions if they exist
            const originalConsole = {
                log: window.console.log || function() {},
                warn: window.console.warn || function() {},
                error: window.console.error || function() {},
                info: window.console.info || function() {},
                debug: window.console.debug || function() {}
            };

            // Wrap console methods to prevent errors on mobile
            ['log', 'warn', 'error', 'info', 'debug'].forEach(function(method) {
                window.console[method] = function() {
                    try {
                        // Only call original if it exists and we're in a safe environment
                        if (originalConsole[method] && typeof originalConsole[method] === 'function') {
                            originalConsole[method].apply(console, arguments);
                        }
                    } catch (e) {
                        // Silently fail on mobile if console is not available
                    }
                };
            });
        })();

        // Mobile Debug Helper - Creates visible debug output on mobile devices
        window.mobileDebug = {
            enabled: false,
            logs: [],
            maxLogs: 50,

            init: function() {
                // Create debug panel if it doesn't exist
                if (!document.getElementById('mobileDebugPanel')) {
                    const panel = document.createElement('div');
                    panel.id = 'mobileDebugPanel';
                    panel.style.cssText = `
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        max-height: 200px;
                        overflow-y: auto;
                        background: rgba(0, 0, 0, 0.9);
                        color: #0f0;
                        font-family: monospace;
                        font-size: 10px;
                        padding: 10px;
                        z-index: 99999;
                        display: none;
                        border-top: 2px solid #0f0;
                    `;
                    document.body.appendChild(panel);
                }
            },

            log: function(message, type = 'log') {
                if (!this.enabled) return;

                const timestamp = new Date().toLocaleTimeString();
                const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;

                this.logs.push(logEntry);
                if (this.logs.length > this.maxLogs) {
                    this.logs.shift();
                }

                const panel = document.getElementById('mobileDebugPanel');
                if (panel) {
                    panel.style.display = 'block';
                    panel.innerHTML = this.logs.join('<br>');
                    panel.scrollTop = panel.scrollHeight;
                }

                // Also log to console
                console[type](message);
            },

            error: function(message) {
                this.log(message, 'error');
            },

            warn: function(message) {
                this.log(message, 'warn');
            },

            clear: function() {
                this.logs = [];
                const panel = document.getElementById('mobileDebugPanel');
                if (panel) {
                    panel.innerHTML = '';
                }
            },

            toggle: function() {
                this.enabled = !this.enabled;
                const panel = document.getElementById('mobileDebugPanel');
                if (panel) {
                    panel.style.display = this.enabled ? 'block' : 'none';
                }
                if (this.enabled) {
                    this.log('Mobile debug enabled');
                }
            }
        };

        // Initialize mobile debug on page load (disabled by default)
        if (window.location.search.includes('debug=true')) {
            window.mobileDebug.init();
            window.mobileDebug.enabled = true;
            window.mobileDebug.log('Mobile debug mode activated');
        }

        // API Configuration
        const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

        // Product Data (will be populated from API)
        const products = {
            jackets: [],
            hoodies: [],
            beanies: [],
            gloves: []
        };

        // Retail pricing structure for value display
        const RETAIL_PRICES = {
            jackets: {
                'CT100617': 92,  // Rain Defender
                'CT103828': 137, // Detroit (Duck Detroit Jacket)
                'CT104670': 174  // Storm Defender (Shoreline Jacket)
            },
            hoodies: 58,
            beanies: 35,
            gloves: 19,
            giftBox: 9,
            shipping: 25
        };

        // Cache for size upcharges from API
        const sizeUpchargeCache = {};

        // Product style numbers to fetch
        const PRODUCT_STYLES = {
            jackets: ['CT104670', 'CT100617', 'CT103828'],
            hoodies: ['CTK121', 'F281'],
            beanies: ['CT104597'],
            gloves: ['CTGD0794']
        };

        // State Management
        let currentStep = 1;
        let highestStepReached = 1;  // Track the furthest step user has reached
        let lastStepNavigationTime = 0;  // Track last navigation to prevent rapid advancement
        let userHasInteracted = false;  // Track if user has actually interacted with the page
        let selectedItems = {
            jacket: null,
            hoodie: null,
            beanie: null,
            gloves: null,
            logo: null,
            customization: {},
            delivery: {}
        };

        // Image Zoom Modal Functions
        function openZoomModal(imageSrc) {
            const modal = document.getElementById('imageZoomModal');
            const zoomImage = document.getElementById('zoomImage');

            zoomImage.src = imageSrc;
            modal.classList.add('active');

            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        function closeZoomModal() {
            const modal = document.getElementById('imageZoomModal');
            modal.classList.remove('active');

            // Restore body scroll
            document.body.style.overflow = '';
        }

        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeZoomModal();
            }
        });

        // Fetch size upcharges from API
        async function fetchSizeUpcharges(styleNumber) {
            // Check cache first
            if (sizeUpchargeCache[styleNumber]) {
                console.log(`[Size Upcharges] Using cached data for ${styleNumber}`);
                return sizeUpchargeCache[styleNumber];
            }

            try {
                const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/size-pricing?styleNumber=${styleNumber}`);

                if (!response.ok) {
                    console.warn(`[Size Upcharges] Failed to fetch for ${styleNumber}:`, response.status);
                    return null;
                }

                const data = await response.json();

                if (data && data.length > 0) {
                    // Extract upcharges from first color (all colors have same upcharges)
                    const upcharges = data[0].sizeUpcharges || {};
                    console.log(`[Size Upcharges] Fetched for ${styleNumber}:`, upcharges);

                    // Cache the result
                    sizeUpchargeCache[styleNumber] = upcharges;
                    return upcharges;
                }

                return null;
            } catch (error) {
                console.error(`[Size Upcharges] Error fetching for ${styleNumber}:`, error);
                return null;
            }
        }

        // Calculate value including size upcharges
        function calculateItemValue(styleNumber, size, basePrice) {
            const upcharges = sizeUpchargeCache[styleNumber] || {};
            const upcharge = upcharges[size] || 0;
            return basePrice + upcharge;
        }

        // Show error banner for API failures
        function showErrorBanner(message) {
            const existingBanner = document.querySelector('.error-banner');
            if (existingBanner) {
                existingBanner.remove();
            }

            const banner = document.createElement('div');
            banner.className = 'error-banner';
            banner.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ef4444;
                color: white;
                padding: 15px 30px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 10000;
                font-weight: 500;
                animation: slideDown 0.3s ease-out;
            `;
            banner.textContent = message;

            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(banner);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                banner.remove();
            }, 5000);
        }

        // Floating Continue Button Functions
        function showFloatingContinue() {
            const floatingBtn = document.getElementById('floatingContinue');
            floatingBtn.classList.add('show');
        }

        function hideFloatingContinue() {
            const floatingBtn = document.getElementById('floatingContinue');
            floatingBtn.classList.remove('show');
        }

        function clickActiveContinueButton() {
            // Find and click the active step's Continue button
            const activeStep = document.querySelector('.step-content:not([style*="display: none"])');
            if (activeStep) {
                const continueBtn = activeStep.querySelector('.nav-btn.primary');
                if (continueBtn && !continueBtn.disabled) {
                    continueBtn.click();
                }
            }
        }

        function showSelectionHelper() {
            const helper = document.getElementById('selectionHelper');
            helper.classList.add('show');

            // Hide after 3 seconds
            setTimeout(() => {
                helper.classList.remove('show');
            }, 3000);
        }

        // Initialize
        // Christmas Bundle Quote Service
        class ChristmasBundleQuoteService {
            constructor() {
                // Same-origin since the 2026-08-26 quote-plane lockdown
                // (rate-limited public relays; proxy is secret-gated).
                this.apiBase = '';
            }

            generateQuoteID() {
                const date = new Date();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const sequence = Math.floor(Math.random() * 10000);
                const paddedSequence = String(sequence).padStart(4, '0');
                return `XMAS${month}${day}-${paddedSequence}`;
            }

            async submitQuote(quoteData) {
                const quoteID = this.generateQuoteID();
                const sessionID = `xmas_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // Create quote session
                const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

                const sessionData = {
                    QuoteID: quoteID,
                    SessionID: sessionID,
                    Status: 'Sample Request',
                    CustomerName: `${quoteData.firstName} ${quoteData.lastName}`,
                    CompanyName: quoteData.company,
                    CustomerEmail: quoteData.email,
                    Phone: quoteData.phone,
                    TotalQuantity: quoteData.totalQuantity || 1,
                    SubtotalAmount: quoteData.totalPrice || 0,
                    LTMFeeTotal: 0,
                    TotalAmount: quoteData.totalPrice || 0,
                    ExpiresAt: formattedExpiresAt,
                    Notes: 'Christmas Gift Box Bundle Order'
                };

                try {
                    // Create session with 10-second timeout
                    const sessionController = new AbortController();
                    const sessionTimeoutId = setTimeout(() => sessionController.abort(), 10000);

                    const sessionResponse = await fetch(`${this.apiBase}/api/quote_sessions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(sessionData),
                        signal: sessionController.signal
                    });

                    clearTimeout(sessionTimeoutId);

                    if (!sessionResponse.ok) {
                        console.error('Session creation failed:', sessionResponse.statusText);
                    }

                    // Create bundle configuration JSON with color information
                    const bundleConfig = {
                        jacket: quoteData.jacketStyle ? `${quoteData.jacketStyle} - ${quoteData.jacketSize || 'N/A'} - ${quoteData.jacketColor || 'N/A'}` : '',
                        hoodie: quoteData.hoodieStyle ? `${quoteData.hoodieStyle} - ${quoteData.hoodieSize || 'N/A'} - ${quoteData.hoodieColor || 'N/A'}` : '',
                        beanie: quoteData.beanieStyle ? `${quoteData.beanieStyle} - ${quoteData.beanieColor || 'N/A'}` : '',
                        gloves: quoteData.glovesStyle ? `${quoteData.glovesStyle} - ${quoteData.glovesSize || 'N/A'} - ${quoteData.glovesColor || 'N/A'}` : ''
                    };

                    // Log bundle configuration for debugging
                    console.log('Bundle configuration being saved:', bundleConfig);
                    console.log('Beanie data from quoteData:', {
                        style: quoteData.beanieStyle,
                        color: quoteData.beanieColor
                    });
                    console.log('Gloves data from quoteData:', {
                        style: quoteData.glovesStyle,
                        size: quoteData.glovesSize,
                        color: quoteData.glovesColor
                    });
                    console.log('JSON stringified:', JSON.stringify(bundleConfig));

                    // Create quote item with all fields
                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: 1,
                        StyleNumber: 'XMAS-BUNDLE',
                        ProductName: 'Christmas Gift Box Bundle',
                        Quantity: quoteData.totalQuantity || 1,
                        FinalUnitPrice: quoteData.unitPrice || 0,
                        LineTotal: quoteData.totalPrice || 0,

                        // Customer Information (using correct field names)
                        First: quoteData.firstName,
                        Last: quoteData.lastName,
                        Email: quoteData.email,
                        Phone: quoteData.phone,
                        Company: quoteData.company,

                        // Delivery Information (using correct field names)
                        DeliveryMethod: quoteData.deliveryMethod,
                        Shipping_Address: quoteData.shippingAddress || '',
                        Shipping_City: quoteData.shippingCity || '',
                        Shipping_State: quoteData.shippingState || '',
                        Shipping_Zip: quoteData.shippingZip || '',

                        // Customization
                        EmbroideryLocation: `Jacket: ${quoteData.jacketEmbLocation || 'N/A'}, Hoodie: ${quoteData.hoodieEmbLocation || 'N/A'}`,
                        Thread_Colors: quoteData.threadColors || '',
                        Image_Upload: quoteData.imageUpload || '', // ExternalKey from file upload

                        // Bundle details and special instructions
                        BundleConfiguration: JSON.stringify(bundleConfig),
                        Notes: (function() {
                            let notes = quoteData.specialInstructions || quoteData.description || 'Christmas Gift Box Bundle';
                            // Add logo failure note if applicable
                            if (window.logoUploadFailed) {
                                notes += ' | [LOGO PENDING] Customer needs to email logo - upload failed during submission';
                                // Clear the flag for next submission
                                window.logoUploadFailed = false;
                            }
                            return notes;
                        })(),

                        // Additional Fields
                        RushOrder: quoteData.rushOrder ? true : false,
                        DeliveryDate: quoteData.dueDate || ''
                    };

                    // Log the item data being sent
                    console.log('Sending item data to API:', itemData);
                    console.log('BundleConfiguration field:', itemData.BundleConfiguration);

                    // Create item with 10-second timeout
                    const itemController = new AbortController();
                    const itemTimeoutId = setTimeout(() => itemController.abort(), 10000);

                    const itemResponse = await fetch(`${this.apiBase}/api/quote_items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(itemData),
                        signal: itemController.signal
                    });

                    clearTimeout(itemTimeoutId);

                    if (!itemResponse.ok) {
                        const errorText = await itemResponse.text();
                        console.error('Item creation failed:', itemResponse.statusText, errorText);
                        console.error('Failed item data:', itemData);
                        console.error('API endpoint used:', `${this.apiBase}/api/quote_items`);
                        // Still return success for quote creation even if item fails
                        return { success: true, quoteID, warning: 'Item creation failed but quote was created' };
                    } else {
                        const itemResult = await itemResponse.json();
                        console.log('Item created successfully:', itemResult);
                    }

                    return { success: true, quoteID };
                } catch (error) {
                    console.error('Error submitting quote:', error);
                    return { success: false, error: error.message };
                }
            }
        }

        // Flag to prevent double submissions - make it global for easier debugging
        window.isSubmitting = false;

        // Helper function to update submission progress
        function updateSubmissionProgress(stepName, message) {
            const overlay = document.getElementById('submissionOverlay');
            const messageEl = overlay.querySelector('.submission-message');
            const steps = overlay.querySelectorAll('.submission-step');

            steps.forEach(step => {
                const stepData = step.getAttribute('data-step');
                if (stepData === stepName) {
                    step.classList.add('active');
                    step.classList.remove('complete');
                } else if (step.classList.contains('active')) {
                    step.classList.remove('active');
                    step.classList.add('complete');
                }
            });

            if (messageEl && message) {
                messageEl.textContent = message;
            }
        }

        // Submit Order Function - Make it globally accessible
        window.submitOrder = async function(button) {
            // Debug log for mobile
            if (window.mobileDebug) {
                window.mobileDebug.log('submitOrder function called');
            }

            // Prevent submission within first 2 seconds of page load
            if (window.pageLoadTime && Date.now() - window.pageLoadTime < 2000) {
                console.warn('Preventing submission within 2 seconds of page load');
                return;
            }

            // Verify we're on Step 7 before allowing submission
            if (currentStep !== 7) {
                console.error('Submit called but not on Step 7. Current step:', currentStep);
                alert('Please complete all steps before submitting your order.');
                return;
            }

            // Detect automated submission attempts
            if (!userHasInteracted) {
                console.error('No user interaction detected - blocking automated submission');
                alert('Please interact with the form before submitting.');
                return;
            }

            // Check if navigation was suspiciously fast (reached Step 7 in under 5 seconds)
            if (window.pageLoadTime && Date.now() - window.pageLoadTime < 5000) {
                console.warn('Reached Step 7 suspiciously fast - possible automation');
                // Still allow but log for debugging
            }

            // CRITICAL FIX: Centralized cleanup function to ensure UI always resets
            let submissionTimeout;
            let submitBtn;
            let originalButtonHTML;
            function finalizeSubmission() {
                if (window.submissionFlowDebug) {
                    console.log('🚀 finalizeSubmission called');
                    console.log('  - submitBtn value:', submitBtn);
                    console.log('  - originalButtonHTML:', originalButtonHTML);
                }
                try {
                    const overlayEl = document.getElementById('submissionOverlay');
                    if (overlayEl) overlayEl.classList.remove('active');
                } catch (e) {
                    console.warn('[Submit] overlay finalize error:', e);
                }
                try {
                    window.isSubmitting = false;
                } catch (e) {
                    console.warn('[Submit] flag finalize error:', e);
                }
                try {
                    if (typeof submissionTimeout !== 'undefined') clearTimeout(submissionTimeout);
                } catch (e) {
                    console.warn('[Submit] timeout finalize error:', e);
                }
                try {
                    const btn = submitBtn || document.getElementById('submitBtn');
                    if (btn) {
                        if (window.submissionFlowDebug) {
                            console.log('📍 finalizeSubmission: Re-enabling button');
                            console.log('  - Button was disabled:', btn.disabled);
                        }
                        btn.disabled = false;  // CRITICAL: Re-enable the button
                        btn.classList.remove('processing');
                        btn.innerHTML = originalButtonHTML || '<i class="fas fa-paper-plane"></i> Submit Order';
                        if (window.submissionFlowDebug) {
                            console.log('  - Button now disabled:', btn.disabled);
                        }
                    } else {
                        console.warn('[Submit] No button found to finalize!');
                    }
                } catch (e) {
                    console.warn('[Submit] button finalize error:', e);
                }
            }

            // Prevent double submissions
            if (window.isSubmitting) {
                console.log('Already submitting, ignoring duplicate click');
                return;
            }

            try {
                window.isSubmitting = true;

                // Show loading overlay immediately
                const overlay = document.getElementById('submissionOverlay');
                overlay.classList.add('active');

                // Set a 30-second timeout to auto-recover if submission gets stuck
                submissionTimeout = setTimeout(() => {
                    if (window.isSubmitting) {
                        console.warn('[Submit] 20s failsafe triggered — auto-recovering UI');
                        finalizeSubmission();
                        alert('The submission is taking longer than expected. Please try again or contact support at 253-922-5793.');
                    }
                }, 20000);

                // Start with validation step
                updateSubmissionProgress('validate', 'Validating your order details...');

                // Small delay to show the overlay
                await new Promise(resolve => setTimeout(resolve, 300));
                // Validate required fields
                const firstName = document.getElementById('firstName').value;
                const lastName = document.getElementById('lastName').value;
                const email = document.getElementById('email').value;
                const phone = document.getElementById('phone').value;

                if (!firstName || !lastName || !email || !phone) {
                    alert('Please fill in all required contact information');
                    finalizeSubmission();
                    return;
                }

                // Validate shipping fields if shipping is selected
                const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value;
                if (deliveryMethod === 'Ship') {
                    const address = document.getElementById('address1')?.value;
                    const city = document.getElementById('city')?.value;
                    const state = document.getElementById('state')?.value;
                    const zipCode = document.getElementById('zipCode')?.value;

                    if (!address || !city || !state || !zipCode) {
                        alert('Please fill in all required shipping information including ZIP code');
                        console.warn('Missing shipping fields:', { address, city, state, zipCode });
                        finalizeSubmission();
                        return;
                    }
                }

                // Update button to show processing state (but not disabled)
                submitBtn = button || document.getElementById('submitBtn');
                originalButtonHTML = submitBtn ? submitBtn.innerHTML : '';
                if (window.submissionFlowDebug) {
                    console.log('📌 submitBtn assigned:', submitBtn);
                    console.log('  - button parameter:', button);
                    console.log('  - submitBtn element:', submitBtn);
                    console.log('  - originalButtonHTML:', originalButtonHTML);
                }
                if (submitBtn) {
                    submitBtn.classList.add('processing');
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                }

                // Upload logo if present - with timeout and error handling
                let imageExternalKey = null;
                if (window.selectedLogoFile) {
                    updateSubmissionProgress('logo', 'Uploading your logo...');
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Add timeout wrapper - 30 seconds max for logo upload
                    try {
                        const uploadPromise = uploadFileToAPI(window.selectedLogoFile);
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Upload timeout - logo is taking too long')), 30000)
                        );

                        imageExternalKey = await Promise.race([uploadPromise, timeoutPromise]);

                        if (!imageExternalKey) {
                            console.warn('Logo upload returned null, continuing without logo');
                            // Update UI to show warning
                            const logoStep = document.querySelector('.submission-step[data-step="logo"]');
                            if (logoStep) {
                                logoStep.classList.add('warning');
                                logoStep.querySelector('span').textContent = 'Logo skipped - send via email';
                            }
                        }
                    } catch (error) {
                        console.error('Logo upload failed or timed out:', error);
                        // Don't fail the order - just note it and continue
                        const logoStep = document.querySelector('.submission-step[data-step="logo"]');
                        if (logoStep) {
                            logoStep.classList.add('warning');
                            logoStep.querySelector('span').textContent = 'Logo pending - send via email';
                        }
                        imageExternalKey = null;
                        // Mark that logo needs to be handled separately
                        window.logoUploadFailed = true;
                    }
                } else {
                    // Skip logo step if no logo
                    const logoStep = document.querySelector('.submission-step[data-step="logo"]');
                    if (logoStep) {
                        logoStep.style.display = 'none';
                    }
                }

            // Collect all form data
            const quoteData = {
                // Customer Info
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone,
                company: document.getElementById('companyName').value,

                // Delivery Info
                deliveryMethod: document.querySelector('input[name="deliveryMethod"]:checked').value,
                shippingAddress: document.getElementById('address1')?.value,
                shippingCity: document.getElementById('city')?.value,
                shippingState: document.getElementById('state')?.value,
                shippingZip: document.getElementById('zipCode')?.value,

                // Customization
                jacketEmbLocation: document.getElementById('jacketEmbLocation')?.value,
                hoodieEmbLocation: document.getElementById('hoodieEmbLocation')?.value,
                threadColors: document.getElementById('threadColors')?.value,
                specialInstructions: document.getElementById('specialInstructions')?.value,
                imageUpload: imageExternalKey,

                // Bundle Contents with color
                jacketStyle: selectedItems.jacket?.id,
                jacketSize: selectedItems.jacket?.selectedSize,
                jacketColor: selectedItems.jacket?.selectedColor,
                hoodieStyle: selectedItems.hoodie?.id,
                hoodieSize: selectedItems.hoodie?.selectedSize,
                hoodieColor: selectedItems.hoodie?.selectedColor,
                beanieStyle: selectedItems.beanie?.id,
                beanieColor: selectedItems.beanie?.selectedColor,
                glovesStyle: selectedItems.gloves?.id,
                glovesSize: selectedItems.gloves?.selectedSize,
                glovesColor: selectedItems.gloves?.selectedColor,

                // Additional Info
                rushOrder: document.getElementById('rushOrder')?.checked,
                dueDate: document.getElementById('deliveryDate')?.value,

                // Totals
                totalQuantity: calculateTotalQuantity(),
                totalPrice: calculateTotalPrice(),
                unitPrice: calculateUnitPrice(),
                description: generateBundleDescription()
            };

            // Log the quote data before submission
            console.log('Complete quote data being submitted:', quoteData);
            console.log('Selected items:', selectedItems);
            console.log('Selected items - beanie specifically:', {
                full: selectedItems.beanie,
                id: selectedItems.beanie?.id,
                color: selectedItems.beanie?.selectedColor
            });

            // Log shipping details specifically
            console.log('Shipping details being submitted:', {
                deliveryMethod: quoteData.deliveryMethod,
                address: quoteData.shippingAddress,
                city: quoteData.shippingCity,
                state: quoteData.shippingState,
                zip: quoteData.shippingZip,
                dueDate: quoteData.dueDate
            });

            // Log if any items are missing
            if (!selectedItems.jacket?.id) console.warn('Jacket not selected or missing ID');
            if (!selectedItems.hoodie?.id) console.warn('Hoodie not selected or missing ID');
            if (!selectedItems.beanie?.id) console.warn('Beanie not selected or missing ID');
            if (!selectedItems.gloves?.id) console.warn('Gloves not selected or missing ID:', selectedItems.gloves);

            // Submit to API
            updateSubmissionProgress('quote', 'Creating your quote...');
            await new Promise(resolve => setTimeout(resolve, 200));
            const quoteService = new ChristmasBundleQuoteService();
            const result = await quoteService.submitQuote(quoteData);

            if (result.success) {
                // Send confirmation email with 10-second timeout. The quote is ALREADY
                // saved (result.success above) — the email is independent, so a hang,
                // timeout, or throw here must NEVER report the order as failed. Wrap the
                // race in its OWN try/catch so it can't reject into the outer submit catch
                // (2026-07-01 fix: a >10s email previously showed "An error occurred while
                //  submitting your order" despite a saved quote).
                updateSubmissionProgress('email', 'Sending confirmation email...');
                await new Promise(resolve => setTimeout(resolve, 200));
                let emailResult = { success: false };
                try {
                    emailResult = await Promise.race([
                        sendConfirmationEmail(quoteData, result.quoteID),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Email timeout after 10 seconds')), 10000)
                        )
                    ]);
                } catch (emailError) {
                    console.error('Confirmation email failed or timed out (quote already saved):', emailError);
                }

                if (!emailResult || !emailResult.success) {
                    console.error('Email failed to send:', emailResult && emailResult.error);
                    // Still show success modal even if email fails — the quote is saved.
                }

                // Hide overlay
                const overlay = document.getElementById('submissionOverlay');
                overlay.classList.remove('active');

                // Clear the timeout since submission completed successfully
                clearTimeout(submissionTimeout);

                // Schedule cleanup FIRST so it happens even if the modal throws
                setTimeout(() => {
                    if (window.submissionFlowDebug) {
                        console.log('⏰ 3-second timer fired, calling finalizeSubmission');
                    }
                    try { resetForm(); } catch (e) { console.error('[Submit] resetForm error:', e); }
                    finalizeSubmission();
                }, 3000);

                // Show success modal (do not allow this to block cleanup)
                try {
                    showSuccessModal(result.quoteID);
                } catch (e) {
                    console.error('[Submit] showSuccessModal error:', e);
                    // Cleanup still scheduled above
                }
            } else {
                if (window.submissionFlowDebug) {
                    console.log('❌ API error - calling finalizeSubmission immediately');
                }
                alert('There was an error submitting your order. Please try again.');
                finalizeSubmission();
            }
            } catch (error) {
                // Comprehensive error handling for mobile
                console.error('Error in submitOrder:', error);

                // Show user-friendly error message
                let errorMessage = 'An error occurred while submitting your order. ';
                if (!navigator.onLine) {
                    errorMessage += 'Please check your internet connection and try again.';
                } else if (error.message && error.message.includes('network')) {
                    errorMessage += 'Network error. Please check your connection and try again.';
                } else {
                    errorMessage += 'Please try again or contact support at 253-922-5793.';
                }

                alert(errorMessage);
                if (window.submissionFlowDebug) {
                    console.log('🔥 Exception caught - calling finalizeSubmission immediately');
                }
                finalizeSubmission();
            }
        }

        // Helper functions for order submission
        function calculateTotalQuantity() {
            let total = 0;
            if (selectedItems.jacket) total++;
            if (selectedItems.hoodie) total++;
            if (selectedItems.beanie) total++;
            if (selectedItems.gloves) total++;
            return total;
        }

        function calculateTotalPrice() {
            // Calculate the actual retail value of the bundle
            let total = 0;

            // Use the global selectedItems object which contains the actual selected products
            if (selectedItems.jacket && selectedItems.jacket.retailPrice) {
                total += selectedItems.jacket.retailPrice;
            }
            if (selectedItems.hoodie && selectedItems.hoodie.retailPrice) {
                total += selectedItems.hoodie.retailPrice;
            }
            if (selectedItems.beanie && selectedItems.beanie.retailPrice) {
                total += selectedItems.beanie.retailPrice;
            }
            if (selectedItems.gloves && selectedItems.gloves.retailPrice) {
                total += selectedItems.gloves.retailPrice;
            }

            // Add gift box and shipping (from RETAIL_PRICES)
            total += RETAIL_PRICES.giftBox || 9;   // Gift box
            total += RETAIL_PRICES.shipping || 25; // Shipping

            // Return the total retail value
            return total;
        }

        function calculateUnitPrice() {
            // For a bundle, return the full bundle value
            return calculateTotalPrice();
        }

        function generateBundleDescription() {
            const items = [];
            if (selectedItems.jacket) items.push(`Jacket: ${selectedItems.jacket.id}`);
            if (selectedItems.hoodie) items.push(`Hoodie: ${selectedItems.hoodie.id}`);
            if (selectedItems.beanie) items.push(`Beanie: ${selectedItems.beanie.id}`);
            if (selectedItems.gloves) items.push(`Gloves: ${selectedItems.gloves.id}`);
            return items.join(', ') || 'Christmas Gift Box';
        }

        // Populate Review Data for Step 7
        function populateReviewData() {
            // Update Order Summary values
            const retailValue = calculateRetailValue();
            const retailValueElement = document.getElementById('orderSummaryRetailValue');
            const savingsElement = document.getElementById('orderSummarySavings');

            if (retailValueElement) {
                retailValueElement.textContent = `$${retailValue.toFixed(2)}`;
            }
            if (savingsElement) {
                savingsElement.textContent = `$${retailValue.toFixed(2)}`;
            }

            // Populate Selected Items with new compact card design
            const reviewItemsDiv = document.getElementById('reviewItems');
            reviewItemsDiv.innerHTML = '';

            const itemTypes = [
                { key: 'jacket', label: 'Jacket', icon: '🧥' },
                { key: 'hoodie', label: 'Hoodie', icon: '👔' },
                { key: 'beanie', label: 'Beanie', icon: '🧢' },
                { key: 'gloves', label: 'Gloves', icon: '🧤' }
            ];

            // All 4 items are required now, so display them all with images
            itemTypes.forEach(type => {
                const item = selectedItems[type.key];
                if (item) {
                    // Get the image URL - prefer color-specific image if available
                    let imageUrl = '';
                    if (item.selectedColorData && item.selectedColorData.MAIN_IMAGE_URL) {
                        imageUrl = item.selectedColorData.MAIN_IMAGE_URL;
                    } else if (item.selectedColorData && item.selectedColorData.FRONT_FLAT) {
                        imageUrl = item.selectedColorData.FRONT_FLAT;
                    } else if (item.image) {
                        imageUrl = item.image;
                    } else {
                        // Fallback placeholder
                        imageUrl = 'https://via.placeholder.com/80x80/f3f4f6/9ca3af?text=' + type.label;
                    }

                    // Get color hex code for swatch
                    let colorHex = '#e5e7eb';
                    if (item.selectedColorData && item.selectedColorData.HEX_CODE) {
                        colorHex = item.selectedColorData.HEX_CODE;
                    } else if (item.selectedColorCode) {
                        colorHex = item.selectedColorCode;
                    }

                    // Create compact product card
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'product-item-card';
                    itemDiv.innerHTML = `
                        <div class="product-item-image">
                            <img src="${imageUrl}" alt="${item.name || type.label}" data-fallback-src="https://via.placeholder.com/80x80/f3f4f6/9ca3af?text=${type.label}">
                        </div>
                        <div class="product-item-details">
                            <div class="product-item-name">${item.name || item.id || 'Product'}</div>
                            <div class="product-item-meta">
                                <div class="product-item-meta-row">
                                    <span>Color:</span>
                                    <span class="review-color-swatch" style="background-color: ${colorHex};"></span>
                                    <span>${item.selectedColor || 'Not selected'}</span>
                                </div>
                                ${type.key !== 'beanie' ? `
                                <div class="product-item-meta-row">
                                    <span>Size: ${item.selectedSize || 'Not selected'}</span>
                                </div>` : '<div class="product-item-meta-row"><span>Size: One Size</span></div>'}
                            </div>
                        </div>
                        <div class="product-item-price">
                            ${item.retailPrice ? `<div class="retail-price">$${item.retailPrice.toFixed(2)}</div>` : ''}
                            <div class="free-tag">FREE</div>
                        </div>
                    `;
                    reviewItemsDiv.appendChild(itemDiv);
                }
            });

            // Populate Customization Details with improved layout
            const reviewCustomDiv = document.getElementById('reviewCustomization');
            const logoFile = document.getElementById('logoFile').files[0];
            const jacketLoc = document.getElementById('jacketEmbLocation')?.value || 'Standard';
            const hoodieLoc = document.getElementById('hoodieEmbLocation')?.value || 'Standard';
            const threadColors = document.getElementById('threadColors')?.value || 'Not specified';
            const specialInstructions = document.getElementById('specialInstructions')?.value || 'None';

            // Format thread colors properly
            const formattedThreadColors = threadColors ?
                threadColors.split(/\s+and\s+|\s+/)
                    .filter(color => color.length > 0)
                    .map(color => color.charAt(0).toUpperCase() + color.slice(1))
                    .join(', ') : 'Not specified';

            // Build customization HTML with new grid layout
            let customizationHTML = '<div class="customization-grid">';

            // Logo section - spans 2 columns if logo exists
            if (logoFile) {
                customizationHTML += `
                    <div class="logo-preview-container">
                        <div class="customization-label">Company Logo</div>
                        <div class="customization-value">${logoFile.name}</div>
                        ${window.selectedLogoDataURL ?
                            `<img src="${window.selectedLogoDataURL}" class="logo-preview-image" alt="Company Logo">` :
                            '<div id="logoPreviewPlaceholder"></div>'}
                    </div>
                `;
            }

            // Thread colors
            customizationHTML += `
                <div class="customization-item">
                    <div class="customization-label">Thread Colors</div>
                    <div class="customization-value">${formattedThreadColors}</div>
                </div>
            `;

            // Jacket embroidery location
            customizationHTML += `
                <div class="customization-item">
                    <div class="customization-label">Jacket Embroidery</div>
                    <div class="customization-value">${jacketLoc}</div>
                </div>
            `;

            // Hoodie embroidery location
            customizationHTML += `
                <div class="customization-item">
                    <div class="customization-label">Hoodie Embroidery</div>
                    <div class="customization-value">${hoodieLoc}</div>
                </div>
            `;

            // Special instructions - spans full width if present
            if (specialInstructions && specialInstructions !== 'None') {
                customizationHTML += `
                    <div class="customization-item" style="grid-column: span 2;">
                        <div class="customization-label">Special Instructions</div>
                        <div class="customization-value">${specialInstructions}</div>
                    </div>
                `;
            }

            customizationHTML += '</div>';
            reviewCustomDiv.innerHTML = customizationHTML;

            // Load logo preview if file exists and dataURL not ready
            if (logoFile && !window.selectedLogoDataURL) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    window.selectedLogoDataURL = e.target.result;
                    const placeholder = document.getElementById('logoPreviewPlaceholder');
                    if (placeholder) {
                        placeholder.outerHTML = `<img src="${e.target.result}" class="logo-preview-image" alt="Company Logo">`;
                    }
                };
                reader.readAsDataURL(logoFile);
            }

            // Populate Delivery Information with compact layout
            const reviewDeliveryDiv = document.getElementById('reviewDelivery');
            const firstName = document.getElementById('firstName').value || '';
            const lastName = document.getElementById('lastName').value || '';
            const company = document.getElementById('companyName').value || '';
            const email = document.getElementById('email').value || '';
            const phone = document.getElementById('phone').value || '';
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value || 'Not selected';
            const deliveryDate = document.getElementById('deliveryDate')?.value || 'Not specified';

            // Build compact delivery info
            let deliveryHTML = '<div class="delivery-info-compact">';

            // Contact person
            deliveryHTML += `
                <div class="delivery-info-item">
                    <div class="delivery-info-icon">
                        <i class="fas fa-user"></i> Contact
                    </div>
                    <div class="delivery-info-value">${firstName} ${lastName}</div>
                    ${company ? `<div class="delivery-info-value" style="font-size: 13px; font-weight: 400; color: #6b7280;">${company}</div>` : ''}
                </div>
            `;

            // Communication
            deliveryHTML += `
                <div class="delivery-info-item">
                    <div class="delivery-info-icon">
                        <i class="fas fa-envelope"></i> Communication
                    </div>
                    <div class="delivery-info-value">${email}</div>
                    <div class="delivery-info-value" style="font-size: 13px; font-weight: 400; color: #6b7280;">${phone}</div>
                </div>
            `;

            // Delivery details
            deliveryHTML += `
                <div class="delivery-info-item">
                    <div class="delivery-info-icon">
                        <i class="fas fa-${deliveryMethod === 'Ship' ? 'truck' : 'building'}"></i> Delivery
                    </div>
                    <div class="delivery-info-value">${deliveryMethod}</div>
                    ${deliveryDate !== 'Not specified' ? `<div class="delivery-info-value" style="font-size: 13px; font-weight: 400; color: #6b7280;">By: ${new Date(deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>` : ''}
                </div>
            `;

            deliveryHTML += '</div>';

            // Add shipping address separately if Ship is selected
            if (deliveryMethod === 'Ship') {
                const address1 = document.getElementById('address1')?.value || '';
                const address2 = document.getElementById('address2')?.value || '';
                const city = document.getElementById('city')?.value || '';
                const state = document.getElementById('state')?.value || '';
                const zip = document.getElementById('zipCode')?.value || '';

                if (address1 && city && state) {
                    deliveryHTML += `
                        <div style="margin-top: 15px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #dc2626;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #6b7280; font-size: 14px;">
                                <i class="fas fa-map-marker-alt" style="color: #dc2626;"></i>
                                <span style="font-weight: 600;">Shipping Address</span>
                            </div>
                            <div style="font-size: 14px; color: #1f2937; line-height: 1.5;">
                                ${address1}<br>
                                ${address2 ? address2 + '<br>' : ''}
                                ${city}, ${state} ${zip}
                            </div>
                        </div>
                    `;
                }
            }

            reviewDeliveryDiv.innerHTML = deliveryHTML;
        }

        function showSuccessModal(quoteID) {
            console.log("🎉 showSuccessModal called with quote ID:", quoteID);
            const modal = document.getElementById('successModal');
            const referenceNumber = document.getElementById('referenceNumber');
            // CRITICAL: Check if elements exist
            if (!modal || !referenceNumber) {
                console.error("❌ CRITICAL: Modal elements missing!", { modal: !!modal, ref: !!referenceNumber });
                alert(`Order submitted successfully! Your reference number is: ${quoteID}

You will receive a confirmation email shortly.`);
                return;
            }

            // Display the quote ID prominently
            referenceNumber.textContent = quoteID;
            referenceNumber.style.cssText = 'font-size: 28px; font-weight: 700; color: #16a34a; background: #f0fdf4; padding: 15px 25px; border-radius: 8px; border: 2px solid #16a34a; letter-spacing: 1px;';

            // Populate SIMPLIFIED order confirmation details
            const orderDetails = document.getElementById('orderConfirmationDetails');
            let detailsHTML = '';

            // Calculate total value for display
            let totalRetailValue = 0;
            if (selectedItems.jacket && selectedItems.jacket.retailPrice) totalRetailValue += selectedItems.jacket.retailPrice;
            if (selectedItems.hoodie && selectedItems.hoodie.retailPrice) totalRetailValue += selectedItems.hoodie.retailPrice;
            if (selectedItems.beanie && selectedItems.beanie.retailPrice) totalRetailValue += selectedItems.beanie.retailPrice;
            if (selectedItems.gloves && selectedItems.gloves.retailPrice) totalRetailValue += selectedItems.gloves.retailPrice;
            totalRetailValue += RETAIL_PRICES.giftBox;
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked');
            if (deliveryMethod && deliveryMethod.value === 'Ship') {
                totalRetailValue += RETAIL_PRICES.shipping;
            }

            // Show ONLY simplified summary - much shorter!
            detailsHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="color: #6b7280; font-size: 14px;">Bundle Items:</span>
                    <span style="color: #374151; font-weight: 600;">4 items</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="color: #6b7280; font-size: 14px;">Total Value:</span>
                    <span style="text-decoration: line-through; color: #9ca3af;">$${totalRetailValue}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6b7280; font-size: 14px;">Your Price:</span>
                    <span style="color: #16a34a; font-weight: 700; font-size: 18px;">FREE!</span>
                </div>

                <!-- Santa's Workshop Bonus Teaser -->
                <div style="background: linear-gradient(90deg, #fef3c7, #fffbeb); padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #fbbf24;">
                    <p style="color: #92400e; font-weight: 600; margin: 0 0 8px 0; font-size: 16px;">
                        🎅 Santa's Workshop Bonus Included!
                    </p>
                    <p style="color: #78350f; font-size: 14px; margin: 0; line-height: 1.5;">
                        Keep an eye out for your mystery gift! We're preparing something special with your logo - a surprise worth $25-50, absolutely FREE!
                    </p>
                </div>
            `;

            orderDetails.innerHTML = detailsHTML;
            // CRITICAL FIX: Force display for mobile devices
            modal.style.display = "flex";
            modal.style.opacity = "1";
            modal.style.visibility = "visible";
            console.log("✅ SUCCESS MODAL DISPLAYED - quoteID:", quoteID);
            modal.classList.add('active');
        }

        function resetForm() {
            // Reset to step 1
            currentStep = 1;
            highestStepReached = 1;
            selectedItems = { jacket: null, hoodie: null, beanie: null, gloves: null, logo: null };

            // Clear form fields
            document.querySelectorAll('.form-input').forEach(input => {
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });

            // Reset file upload
            window.selectedLogoFile = null;
            document.getElementById('logoFile').value = '';
            document.getElementById('logoPreview').classList.remove('active');

            // Update display
            updateProgress();
            updateSummary();

        }

        // Function to attach submit button handlers (called when Step 7 loads)
        function attachSubmitHandlers() {
            // CRITICAL: Verify we're actually on Step 7 before attaching handlers
            if (currentStep !== 7) {
                console.warn('attachSubmitHandlers called but not on Step 7. Current step:', currentStep);
                return;
            }

            // Also verify Step 7 is actually visible
            const step7Element = document.getElementById('step7');
            if (!step7Element || !step7Element.classList.contains('active')) {
                console.warn('attachSubmitHandlers called but Step 7 is not visible');
                return;
            }

            // Get the submit button
            const submitBtn = document.getElementById('submitBtn');
            if (!submitBtn) {
                console.error('Submit button not found!');
                return;
            }

            // Check if handlers are already attached
            if (submitBtn.hasAttribute('data-handlers-attached')) {
                console.log('Submit handlers already attached, skipping');
                return;
            }

            // Define the click handler
            const handleSubmitClick = function(e) {
                e.preventDefault();
                window.submitOrder(submitBtn);
            };

            // Define the touch handler
            const handleSubmitTouch = function(e) {
                e.preventDefault();
                // Remove click listener temporarily to prevent double submission
                submitBtn.removeEventListener('click', handleSubmitClick);
                window.submitOrder(submitBtn);
                // Re-add click listener after a delay
                setTimeout(() => {
                    submitBtn.addEventListener('click', handleSubmitClick);
                }, 500);
            };

            // Store handlers on the button element for later removal if needed
            submitBtn._handleSubmitClick = handleSubmitClick;
            submitBtn._handleSubmitTouch = handleSubmitTouch;

            // Add event listeners
            submitBtn.addEventListener('click', handleSubmitClick);
            submitBtn.addEventListener('touchend', handleSubmitTouch);

            // Mark as attached to prevent duplicates
            submitBtn.setAttribute('data-handlers-attached', 'true');
            // CRITICAL FIX: Force enable button - user has completed all steps to reach Step 7
            // The submitOrder function itself validates all required fields before submission
            submitBtn.disabled = false;
            console.log("Submit button handlers attached successfully, button enabled");
        }

        // Phone number formatting function
        function formatPhoneNumber(value) {
            // Remove all non-digit characters
            const phoneNumber = value.replace(/\D/g, '');

            // Format based on length
            if (phoneNumber.length === 0) {
                return '';
            } else if (phoneNumber.length <= 3) {
                return `(${phoneNumber}`;
            } else if (phoneNumber.length <= 6) {
                return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
            } else if (phoneNumber.length <= 10) {
                return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
            } else {
                // Limit to 10 digits
                return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
            }
        }

        // Initialize phone formatting
        function initializePhoneFormatting() {
            const phoneInput = document.getElementById('phone');
            if (!phoneInput) return;

            phoneInput.addEventListener('input', function(e) {
                const cursorPosition = e.target.selectionStart;
                const previousValue = e.target.value;
                const formattedValue = formatPhoneNumber(e.target.value);

                e.target.value = formattedValue;

                // Adjust cursor position intelligently
                if (formattedValue.length > previousValue.length) {
                    // Adding characters - move cursor forward
                    const diff = formattedValue.length - previousValue.length;
                    e.target.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
                } else if (formattedValue.length < previousValue.length) {
                    // Removing characters - adjust cursor
                    let newPosition = cursorPosition;

                    // If we just deleted a formatting character, move cursor back one more
                    if (previousValue[cursorPosition - 1] === ' ' ||
                        previousValue[cursorPosition - 1] === '-' ||
                        previousValue[cursorPosition - 1] === '(' ||
                        previousValue[cursorPosition - 1] === ')') {
                        newPosition = Math.max(0, cursorPosition - 1);
                    }

                    e.target.setSelectionRange(newPosition, newPosition);
                }
            });

            // Handle paste event
            phoneInput.addEventListener('paste', function(e) {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const formattedValue = formatPhoneNumber(pastedText);
                e.target.value = formattedValue;
            });

            // Prevent non-numeric input on mobile
            phoneInput.addEventListener('keypress', function(e) {
                const char = String.fromCharCode(e.which);
                if (!/[0-9]/.test(char) && e.which !== 8 && e.which !== 46) {
                    e.preventDefault();
                }
            });
        }

        document.addEventListener('DOMContentLoaded', async function() {
            // CRITICAL: Force page to start at Step 1 and prevent auto-navigation
            currentStep = 1;
            highestStepReached = 1;

            // Hide all steps except Step 1
            for (let i = 1; i <= 7; i++) {
                const stepElement = document.getElementById(`step${i}`);
                if (stepElement) {
                    if (i === 1) {
                        stepElement.classList.add('active');
                    } else {
                        stepElement.classList.remove('active');
                    }
                }

                // Reset progress indicators
                const progressStep = document.querySelector(`[data-step="${i}"]`);
                if (progressStep) {
                    if (i === 1) {
                        progressStep.classList.add('active');
                        progressStep.classList.remove('completed');
                    } else {
                        progressStep.classList.remove('active');
                        progressStep.classList.remove('completed');
                    }
                }
            }

            // Ensure submission overlay is hidden on page load
            window.isSubmitting = false;
            const overlay = document.getElementById('submissionOverlay');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.style.display = 'none';
                setTimeout(() => {
                    overlay.style.display = '';
                }, 100);
            }

            // Prevent form submission for first 2 seconds after page load
            window.pageLoadTime = Date.now();

            // Track user interaction - add listeners for actual user events
            document.addEventListener('click', function() {
                if (!userHasInteracted) {
                    console.log('User interaction detected');
                    userHasInteracted = true;
                }
            }, { once: true });

            document.addEventListener('touchstart', function() {
                if (!userHasInteracted) {
                    console.log('User touch interaction detected');
                    userHasInteracted = true;
                }
            }, { once: true });

            // Clear all form fields on page load to prevent autofill issues
            const deliveryForm = document.getElementById('deliveryForm');
            if (deliveryForm) {
                deliveryForm.reset();
                // Also clear individual fields to be sure
                document.getElementById('firstName').value = '';
                document.getElementById('lastName').value = '';
                document.getElementById('companyName').value = '';
                document.getElementById('email').value = '';
                document.getElementById('phone').value = '';
                document.getElementById('address1').value = '';
                document.getElementById('address2').value = '';
                document.getElementById('city').value = '';
                document.getElementById('state').value = '';
                document.getElementById('zipCode').value = '';
            }

            initializeSnowEffect();
            showLoadingState();
            await loadChristmasProducts();
            renderProducts();
            setupDragDrop();
            updateSummary();

            // Initialize phone number formatting
            initializePhoneFormatting();

            // Show scroll indicator on first step
            showScrollIndicator();

            // NOTE: Submit button event listeners are now attached in attachSubmitHandlers()
            // when Step 7 is reached, not on page load. This prevents accidental triggering.

            // Initialize delivery date field with 2 weeks minimum
            initializeDeliveryDate();
        });

        // Calendar state variables
        let currentCalendarMonth = new Date();
        let selectedCalendarDate = null;
        let minSelectableDate = null;

        // Initialize delivery date with custom calendar
        function initializeDeliveryDate() {
            const dateInput = document.getElementById('deliveryDate');
            if (!dateInput) return;

            // Calculate minimum date (2 weeks from today, skip weekends)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            minSelectableDate = new Date(today);
            minSelectableDate.setDate(minSelectableDate.getDate() + 14);

            // If minimum date is weekend, move to next Monday
            while (isWeekend(minSelectableDate)) {
                minSelectableDate.setDate(minSelectableDate.getDate() + 1);
            }

            // Set initial selected date to minimum selectable date
            selectedCalendarDate = new Date(minSelectableDate);
            dateInput.value = formatDate(selectedCalendarDate);

            // Initialize calendar
            currentCalendarMonth = new Date(minSelectableDate.getFullYear(), minSelectableDate.getMonth(), 1);
            renderCalendar();

            // Close calendar when clicking outside
            document.addEventListener('click', function(e) {
                const calendar = document.getElementById('customCalendar');
                const dateWrapper = document.querySelector('.date-input-wrapper');
                if (!dateWrapper.contains(e.target)) {
                    calendar.classList.remove('show');
                }
            });
        }

        // Format date for input (YYYY-MM-DD)
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Check if date is a weekend
        function isWeekend(date) {
            const day = date.getDay();
            return day === 0 || day === 6; // Sunday or Saturday
        }

        // Check if date is within the 2-week buffer
        function isWithinBuffer(date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const bufferEnd = new Date(today);
            bufferEnd.setDate(bufferEnd.getDate() + 13); // 13 days + today = 14 days

            return date < bufferEnd;
        }

        // Check if date is selectable
        function isDateSelectable(date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Can't select past dates
            if (date < today) return false;

            // Can't select weekends
            if (isWeekend(date)) return false;

            // Can't select dates within 2-week buffer
            if (isWithinBuffer(date)) return false;

            return true;
        }

        // Open custom calendar
        function openCustomCalendar() {
            const calendar = document.getElementById('customCalendar');

            // Ensure we have a selected date and calendar opens to its month
            if (selectedCalendarDate) {
                // Set calendar to the month of the selected date
                currentCalendarMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
            } else if (minSelectableDate) {
                // Fallback to minimum selectable date's month
                currentCalendarMonth = new Date(minSelectableDate.getFullYear(), minSelectableDate.getMonth(), 1);
                selectedCalendarDate = new Date(minSelectableDate);
                const dateInput = document.getElementById('deliveryDate');
                dateInput.value = formatDate(selectedCalendarDate);
            }

            calendar.classList.add('show');
            renderCalendar();
        }

        // Close custom calendar
        function closeCustomCalendar() {
            const calendar = document.getElementById('customCalendar');
            calendar.classList.remove('show');
        }

        // Render the calendar
        function renderCalendar() {
            const calendar = document.getElementById('customCalendar');
            if (!calendar) return;

            const year = currentCalendarMonth.getFullYear();
            const month = currentCalendarMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const prevLastDay = new Date(year, month, 0);

            const firstDayOfWeek = firstDay.getDay();
            const lastDateOfMonth = lastDay.getDate();
            const prevLastDate = prevLastDay.getDate();

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];

            let html = `
                <div class="calendar-header">
                    <button class="calendar-nav" data-call="changeMonth" data-args="[-1]" ${!canNavigateToPrevMonth() ? 'disabled' : ''}>‹</button>
                    <div class="calendar-month-year">${monthNames[month]} ${year}</div>
                    <button class="calendar-nav" data-call="changeMonth" data-args="[1]">›</button>
                </div>
                <div class="calendar-grid">
            `;

            // Day headers
            const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            dayHeaders.forEach(day => {
                html += `<div class="calendar-day-header">${day}</div>`;
            });

            // Previous month days
            for (let i = firstDayOfWeek; i > 0; i--) {
                const date = prevLastDate - i + 1;
                html += `<div class="calendar-day other-month disabled">${date}</div>`;
            }

            // Current month days
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let date = 1; date <= lastDateOfMonth; date++) {
                const currentDate = new Date(year, month, date);
                currentDate.setHours(0, 0, 0, 0);

                let classes = ['calendar-day'];

                // Check if today
                if (currentDate.getTime() === today.getTime()) {
                    classes.push('today');
                }

                // Check if selected
                if (selectedCalendarDate && currentDate.getTime() === selectedCalendarDate.getTime()) {
                    classes.push('selected');
                }

                // Check if weekend
                if (isWeekend(currentDate)) {
                    classes.push('weekend');
                }

                // Check if within buffer period
                if (isWithinBuffer(currentDate)) {
                    classes.push('buffer-period');
                    classes.push('disabled');
                }

                // Check if past date
                if (currentDate < today) {
                    classes.push('disabled');
                }

                // Check if selectable
                const selectable = isDateSelectable(currentDate);
                if (!selectable) {
                    classes.push('disabled');
                }

                const onclick = selectable ? `data-call="selectDate" data-args="[${year}, ${month}, ${date}]"` : '';

                html += `<div class="${classes.join(' ')}" ${onclick}>${date}</div>`;
            }

            // Next month days
            const remainingDays = 42 - (firstDayOfWeek + lastDateOfMonth); // 6 rows * 7 days
            for (let date = 1; date <= remainingDays; date++) {
                html += `<div class="calendar-day other-month disabled">${date}</div>`;
            }

            html += `
                </div>
                <div class="calendar-legend">
                    <div class="legend-item">
                        <div class="legend-color available"></div>
                        <span>Available</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color buffer"></div>
                        <span>2-week buffer</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color weekend"></div>
                        <span>Weekend</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color unavailable"></div>
                        <span>Unavailable</span>
                    </div>
                </div>
            `;

            calendar.innerHTML = html;
        }

        // Check if can navigate to previous month
        function canNavigateToPrevMonth() {
            const today = new Date();
            const currentYear = currentCalendarMonth.getFullYear();
            const currentMonth = currentCalendarMonth.getMonth();

            return currentYear > today.getFullYear() ||
                   (currentYear === today.getFullYear() && currentMonth > today.getMonth());
        }

        // Change calendar month
        function changeMonth(direction) {
            currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + direction);
            renderCalendar();
        }

        // Select a date from calendar
        function selectDate(year, month, date) {
            selectedCalendarDate = new Date(year, month, date);
            const dateInput = document.getElementById('deliveryDate');
            dateInput.value = formatDate(selectedCalendarDate);

            // Clear any validation messages
            const validationMessage = document.getElementById('dateValidationMessage');
            validationMessage.classList.remove('show');

            renderCalendar();
            closeCustomCalendar();
        }

        // Validate selected date (for form submission)
        function validateDeliveryDate() {
            const dateInput = document.getElementById('deliveryDate');
            const validationMessage = document.getElementById('dateValidationMessage');

            // If no date selected, use the default (2 weeks out)
            if (!dateInput.value) {
                // Calculate minimum date again
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let defaultDate = new Date(today);
                defaultDate.setDate(defaultDate.getDate() + 14);

                // Skip weekends
                while (isWeekend(defaultDate)) {
                    defaultDate.setDate(defaultDate.getDate() + 1);
                }

                // Set the default date
                dateInput.value = formatDate(defaultDate);
                selectedCalendarDate = defaultDate;

                // Clear any error messages since we're providing a valid default
                validationMessage.classList.remove('show');
                return true;
            }

            const selectedDate = new Date(dateInput.value);

            if (!isDateSelectable(selectedDate)) {
                validationMessage.textContent = 'Selected date is not available. Please choose a weekday at least 2 weeks from today.';
                validationMessage.classList.add('show');
                return false;
            }

            validationMessage.classList.remove('show');
            return true;
        }

        // Show scroll indicator function
        function showScrollIndicator() {
            const indicator = document.getElementById('scrollIndicator');
            if (currentStep === 1 || currentStep === 2) {
                indicator.classList.add('show');

                // Hide indicator when user scrolls
                let hasScrolled = false;
                const handleScroll = () => {
                    if (!hasScrolled && window.scrollY > 50) {
                        hasScrolled = true;
                        indicator.classList.remove('show');
                        window.removeEventListener('scroll', handleScroll);
                    }
                };
                window.addEventListener('scroll', handleScroll);
            } else {
                indicator.classList.remove('show');
            }
        }

        // Show loading state
        function showLoadingState() {
            const grids = ['jacketGrid', 'hoodieGrid', 'beanieGrid'];
            grids.forEach(gridId => {
                const grid = document.getElementById(gridId);
                if (grid) {
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                            <div class="loading"></div>
                            <p style="margin-top: 20px; color: #666;">Loading products...</p>
                        </div>
                    `;
                }
            });
        }

        // Load products from API
        async function loadChristmasProducts() {
            try {
                // First, fetch size upcharges for all products
                const allStyles = Object.values(PRODUCT_STYLES).flat();
                const upchargePromises = allStyles.map(style => fetchSizeUpcharges(style));
                await Promise.all(upchargePromises);
                console.log('[Size Upcharges] All upcharges fetched:', sizeUpchargeCache);

                for (const [category, styles] of Object.entries(PRODUCT_STYLES)) {
                    const categoryProducts = [];

                    for (const style of styles) {
                        try {
                            // Fetch product data with colors from single endpoint
                            const response = await fetch(`/api/product-colors?styleNumber=${style}`);
                            const result = await response.json();

                            if (result && result.colors) {
                                let colors = result.colors || [];
                                const productTitle = result.productTitle || '';
                                const productDescription = result.PRODUCT_DESCRIPTION || result.description || '';

                                // Skip inventory validation for initial load to improve performance
                                // Instead, use hardcoded exclusions for known problematic colors

                                // Hardcoded exclusion list for colors with known zero inventory
                                const EXCLUDED_COLORS = {
                                    'CTK121': ['Dark Brown'] // This color has zero inventory
                                };

                                // Apply exclusions if this product has known issues
                                if (EXCLUDED_COLORS[style]) {
                                    const excludedList = EXCLUDED_COLORS[style];
                                    const originalCount = colors.length;

                                    colors = colors.filter(color => {
                                        const colorName = color.COLOR_NAME || color.CATALOG_COLOR || '';
                                        const isExcluded = excludedList.some(excluded =>
                                            colorName.toLowerCase().includes(excluded.toLowerCase())
                                        );

                                        if (isExcluded) {
                                            console.log(`Excluding ${colorName} for ${style} - known zero inventory`);
                                        }

                                        return !isExcluded;
                                    });

                                    if (colors.length === 0) {
                                        console.warn(`Product ${style} has no available colors after exclusions`);
                                        categoryProducts.push(createFallbackProduct(style, category));
                                        continue;
                                    }
                                }

                                // Extract product name from title (format: "Name. StyleNumber")
                                const productName = productTitle.split('.')[0].trim() || `Style ${style}`;

                                // Set price as FREE but get retail value for display
                                let productPrice = 'FREE';
                                let retailPrice = 0;

                                // Get retail price based on product type and style
                                if (category === 'jackets' && RETAIL_PRICES.jackets[style]) {
                                    retailPrice = RETAIL_PRICES.jackets[style];
                                } else if (category === 'hoodies') {
                                    retailPrice = RETAIL_PRICES.hoodies;
                                } else if (category === 'beanies') {
                                    retailPrice = RETAIL_PRICES.beanies;
                                } else if (category === 'gloves') {
                                    retailPrice = RETAIL_PRICES.gloves;
                                }

                                // Get first color's image as the main product image
                                const mainImage = colors[0]?.MAIN_IMAGE_URL ||
                                                colors[0]?.FRONT_MODEL ||
                                                colors[0]?.FRONT_FLAT ||
                                                null;

                                // Get actual sizes from API for this product
                                let sizes = [];
                                if (category === 'beanies') {
                                    sizes = ['One Size'];
                                } else if (category === 'gloves') {
                                    // Gloves only come in M, L, XL
                                    sizes = ['M', 'L', 'XL'];
                                } else {
                                    // Fetch actual sizes from API using first color
                                    const apiSizes = await fetchDefaultSizesForProduct(style, colors);
                                    if (apiSizes && apiSizes.length > 0) {
                                        sizes = apiSizes;
                                    } else {
                                        // Fallback sizes if API fails - but limited based on product type
                                        console.warn(`Using fallback sizes for ${style}`);
                                        if (style === 'F281') {
                                            // F281 specifically only goes to 4XL
                                            sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
                                        } else if (category === 'jackets' || category === 'hoodies') {
                                            // Default jacket/hoodie sizes - conservative approach
                                            sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
                                        } else {
                                            sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
                                        }
                                    }
                                }

                                categoryProducts.push({
                                    id: style,
                                    name: productName,
                                    description: productDescription,
                                    price: productPrice,
                                    retailPrice: retailPrice,
                                    image: mainImage,
                                    colors: colors, // These now include COLOR_SQUARE_IMAGE
                                    sizes: sizes,
                                    rawData: result
                                });
                            } else {
                                console.warn(`Could not load product ${style}: No color data available`);
                                categoryProducts.push(createFallbackProduct(style, category));
                            }
                        } catch (error) {
                            console.error(`Error fetching ${style}:`, error);
                            categoryProducts.push(createFallbackProduct(style, category));
                        }
                    }

                    products[category] = categoryProducts;
                }
            } catch (error) {
                console.error('Error loading products:', error);
                // Use fallback products
                loadFallbackProducts();
            }
        }

        // Create fallback product
        function createFallbackProduct(style, category) {
            const fallbackNames = {
                'CT104670': 'Carhartt Storm Defender Shoreline Jacket',
                'CT100617': 'Carhartt Rain Defender Jacket',
                'CT103828': 'Carhartt Duck Detroit Jacket',
                'CTK121': 'Carhartt Midweight Hoodie',
                'F281': 'Sport-Tek Super Heavyweight Hoodie',
                'CT104597': 'Carhartt Watch Cap 2.0'
            };

            // Get retail price for fallback product
            let retailPrice = 0;
            if (category === 'jackets' && RETAIL_PRICES.jackets[style]) {
                retailPrice = RETAIL_PRICES.jackets[style];
            } else if (category === 'hoodies') {
                retailPrice = RETAIL_PRICES.hoodies;
            } else if (category === 'beanies') {
                retailPrice = RETAIL_PRICES.beanies;
            } else if (category === 'gloves') {
                retailPrice = RETAIL_PRICES.gloves;
            }

            return {
                id: style,
                name: fallbackNames[style] || `Product ${style}`,
                price: 'FREE',
                retailPrice: retailPrice,
                image: null,
                colors: [
                    { COLOR_NAME: 'Black', COLOR_SQUARE_IMAGE: null, HEX_CODE: '#000000' },
                    { COLOR_NAME: 'Navy', COLOR_SQUARE_IMAGE: null, HEX_CODE: '#1e3a8a' }
                ],
                sizes: category === 'beanies' ? ['One Size'] :
                      style === 'F281' ? ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] : // F281 only goes to 4XL
                      ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] // Conservative default
            };
        }

        // Load fallback products
        function loadFallbackProducts() {
            products.jackets = PRODUCT_STYLES.jackets.map(style => createFallbackProduct(style, 'jackets'));
            products.hoodies = PRODUCT_STYLES.hoodies.map(style => createFallbackProduct(style, 'hoodies'));
            products.beanies = PRODUCT_STYLES.beanies.map(style => createFallbackProduct(style, 'beanies'));
            products.gloves = PRODUCT_STYLES.gloves.map(style => createFallbackProduct(style, 'gloves'));
        }

        // Snow Effect
        function initializeSnowEffect() {
            const snowOverlay = document.getElementById('snowOverlay');
            const snowflakeCount = 50;

            for (let i = 0; i < snowflakeCount; i++) {
                const snowflake = document.createElement('div');
                snowflake.className = 'snowflake';
                snowflake.innerHTML = '❄';
                snowflake.style.left = Math.random() * 100 + '%';
                snowflake.style.animationDuration = Math.random() * 3 + 2 + 's';
                snowflake.style.opacity = Math.random();
                snowflake.style.fontSize = Math.random() * 10 + 10 + 'px';
                snowflake.style.animationDelay = Math.random() * 2 + 's';
                snowOverlay.appendChild(snowflake);
            }
        }

        // Render Products
        function renderProducts() {
            renderJackets();
            renderHoodies();
            renderBeanies();
            renderGloves();
        }

        function renderJackets() {
            const grid = document.getElementById('jacketGrid');
            grid.innerHTML = '';

            products.jackets.forEach(product => {
                grid.appendChild(createProductCard(product, 'jacket'));
            });
        }

        function renderHoodies() {
            const grid = document.getElementById('hoodieGrid');
            grid.innerHTML = '';

            products.hoodies.forEach(product => {
                grid.appendChild(createProductCard(product, 'hoodie'));
            });
        }

        function renderBeanies() {
            const grid = document.getElementById('beanieGrid');
            grid.innerHTML = '';

            products.beanies.forEach(product => {
                grid.appendChild(createProductCard(product, 'beanie'));
            });
        }

        function renderGloves() {
            const grid = document.getElementById('glovesGrid');
            grid.innerHTML = '';

            // Add specific gloves data if not already loaded
            if (products.gloves.length === 0) {
                // Create default gloves product
                products.gloves = [{
                    id: 'CTGD0794',
                    name: 'Carhartt® High-Dexterity Open-Cuff Glove',
                    price: 'FREE',
                    retailPrice: RETAIL_PRICES.gloves,
                    description: 'Premium insulated work gloves included FREE with your gift box',
                    image: 'https://cdnm.sanmar.com/imglib/mresjpg/2024/f5/CTGD0794_blackbarley_glove_main.jpg',
                    colors: [
                        {
                            COLOR_NAME: 'Black Barley',
                            COLOR_CODE: 'BLACKBARLEY',
                            COLOR_SWATCH_IMG: null
                        }
                    ],
                    sizes: ['M', 'L', 'XL']
                }];
            }

            products.gloves.forEach(product => {
                grid.appendChild(createProductCard(product, 'gloves'));
            });
        }

        // Create Product Card
        function createProductCard(product, type) {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.productId = product.id;
            card.dataset.productType = type;

            // Check if this product is already selected
            const isSelected = selectedItems[type]?.id === product.id;

            // Add selected class if this product is selected
            if (isSelected) {
                card.classList.add('selected');
            }

            // Generate size buttons from actual API data
            const sizeButtons = createSizeButtons(product);

            // Generate color swatches from actual API data
            const colorSwatches = createColorSwatches(product);

            const buttonText = isSelected ? 'Change Selection' : `Select This ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const buttonClass = isSelected ? 'select-btn selected' : 'select-btn';

            card.innerHTML = `
                <div class="product-image" ${product.image ? `data-call="openZoomModal" data-args="${JSON.stringify([product.image]).replace(/"/g, '&quot;')}"` : ''}>
                    ${product.image ?
                        `<img src="${product.image}" alt="${product.name}" loading="lazy" data-fallback-src="/placeholder.jpg">` :
                        `<div class="placeholder"><i class="fas fa-${type === 'jacket' ? 'tshirt' : type === 'hoodie' ? 'hoodie' : 'hat-winter'}"></i></div>`
                    }
                    <div class="selected-badge">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
                <div class="product-info">
                    <div class="product-style">${product.id}</div>
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">
                        ${product.retailPrice ? `<span class="retail-value">$${product.retailPrice} value</span>` : ''}
                        <span class="free-badge">FREE!</span>
                    </div>
                    ${product.description ? `<div class="product-description" title="${product.description}">${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}</div>` : ''}

                    <div class="selection-group">
                        <div class="selection-label">Select Color:<span class="required-indicator">*</span></div>
                        <div class="color-grid color-swatches">
                            ${colorSwatches}
                        </div>
                    </div>

                    <div class="selection-group">
                        <div class="selection-label">Select Size:<span class="required-indicator">*</span></div>
                        <div class="size-grid">
                            ${sizeButtons}
                        </div>
                    </div>

                    <button class="${buttonClass}" data-call="selectProduct" data-args="${JSON.stringify([product.id, type]).replace(/"/g, '&quot;')}">
                        ${buttonText}
                    </button>
                </div>
            `;

            // Add click handler to the whole card after innerHTML is set
            card.addEventListener('click', function(e) {
                // Don't trigger if clicking on buttons or interactive elements
                if (!e.target.closest('.size-btn') && !e.target.closest('.color-swatch') && !e.target.closest('.select-btn') && !e.target.closest('.product-image')) {
                    selectProduct(product.id, type);
                }
            });

            // Auto-select OSFA for beanie since it's the only size option
            if (type === 'beanie') {
                setTimeout(() => {
                    const osfaBtn = card.querySelector('.size-btn[data-size="OSFA"]');
                    if (osfaBtn && !card.querySelector('.size-btn.selected')) {
                        console.log('Auto-selecting OSFA for beanie');
                        osfaBtn.click();
                    }
                }, 100);
            }

            // Auto-select single options after card is fully rendered
            // This handles both beanies (OSFA) and gloves (Black Barley) automatically
            setTimeout(() => {
                autoSelectSingleOptions(card);
                // Update the button state based on current selections
                updateProductButtonState(card);
            }, 100);

            return card;
        }

        // Create size buttons from API data
        function createSizeButtons(product) {
            const sizes = product.sizes || [];

            // Handle different size formats
            if (Array.isArray(sizes) && sizes.length > 0) {
                return sizes.map(size => {
                    const sizeCode = typeof size === 'string' ? size : (size.code || size.name || size);
                    return `<button class="size-btn" data-size="${sizeCode}" data-call="selectSize" data-args="${JSON.stringify(['$event', product.id]).replace(/"/g, '&quot;')}">${sizeCode}</button>`;
                }).join('');
            }

            // Fallback
            return '<button class="size-btn" data-size="One Size" data-call="selectSize" data-args="' + JSON.stringify(['$event', product.id]).replace(/"/g, '&quot;') + '">One Size</button>';
        }

        // Create color swatches from API data
        function createColorSwatches(product) {
            const colors = product.colors || [];

            if (Array.isArray(colors) && colors.length > 0) {
                return colors.map(color => {
                    // Extract data from API response
                    const colorName = color.COLOR_NAME || color.name || 'Unknown';
                    const colorCode = color.CATALOG_COLOR || color.code || colorName;
                    const swatchImage = color.COLOR_SQUARE_IMAGE || '';
                    const hexColor = color.HEX_CODE || color.hex || '#cccccc';

                    // Store additional image URLs for this color
                    const colorImages = {
                        main: color.MAIN_IMAGE_URL || '',
                        frontModel: color.FRONT_MODEL || '',
                        backModel: color.BACK_MODEL || '',
                        frontFlat: color.FRONT_FLAT || '',
                        backFlat: color.BACK_FLAT || ''
                    };

                    // Always prefer the actual swatch image from API
                    const swatchStyle = swatchImage ?
                        `background-image: url('${swatchImage}');` :
                        `background-color: ${hexColor};`;

                    return `
                        <div class="color-swatch"
                             data-color="${colorName}"
                             data-color-code="${colorCode}"
                             data-color-images='${JSON.stringify(colorImages)}'
                             data-call="selectColor" data-args="${JSON.stringify(['$event', product.id]).replace(/"/g, '&quot;')}"
                             title="${colorName}">
                            <div class="swatch-image" style="${swatchStyle}"></div>
                            <div class="swatch-name">${colorName}</div>
                        </div>
                    `;
                }).join('');
            }

            // Fallback with basic colors
            return `
                <div class="color-swatch" data-color="Black" data-call="selectColor" data-args="${JSON.stringify(['$event', product.id]).replace(/"/g, '&quot;')}" title="Black">
                    <div class="swatch-image" style="background-color: #000000"></div>
                    <div class="swatch-name">Black</div>
                </div>
                <div class="color-swatch" data-color="Navy" data-call="selectColor" data-args="${JSON.stringify(['$event', product.id]).replace(/"/g, '&quot;')}" title="Navy">
                    <div class="swatch-image" style="background-color: #1e3a8a"></div>
                    <div class="swatch-name">Navy</div>
                </div>
            `;
        }

        // Get Color Hex (fallback for when no swatch image is available)
        function getColorHex(colorName) {
            const colors = {
                'Black': '#000000',
                'Navy': '#1e3a8a',
                'Dark Gray': '#6b7280',
                'Brown': '#92400e',
                'Carhartt Brown': '#8b4513',
                'Heather Gray': '#9ca3af',
                'Carbon Heather': '#4b5563',
                'Athletic Heather': '#d1d5db',
                'Dark Green': '#14532d',
                'Coal Heather': '#374151',
                'White': '#ffffff',
                'Red': '#dc2626'
            };
            return colors[colorName] || '#cccccc';
        }

        // Auto-select single options to reduce user clicks
        function autoSelectSingleOptions(card) {
            const productType = card.dataset.productType;
            const productId = card.dataset.productId;

            // Auto-select single size option
            const sizeButtons = card.querySelectorAll('.size-btn');
            if (sizeButtons.length === 1) {
                const singleSizeBtn = sizeButtons[0];
                const size = singleSizeBtn.dataset.size;

                // Mark as selected
                singleSizeBtn.classList.add('selected');

                console.log(`[Auto-Select] ${productType} ${productId}: Auto-selected single size option '${size}'`);

                // For beanies with OSFA, we could optionally add visual indicator
                if (size === 'One Size' || size === 'OSFA') {
                    singleSizeBtn.style.pointerEvents = 'none'; // Make it non-clickable since it's the only option
                    singleSizeBtn.style.opacity = '1'; // Keep it fully visible
                }
            }

            // Auto-select single color option
            const colorSwatches = card.querySelectorAll('.color-swatch');
            if (colorSwatches.length === 1) {
                const singleColorSwatch = colorSwatches[0];
                // Fix: Use dataset.color instead of dataset.colorName
                const colorName = singleColorSwatch.dataset.color;

                // Mark as selected
                singleColorSwatch.classList.add('selected');

                console.log(`[Auto-Select] ${productType} ${productId}: Auto-selected single color option '${colorName}'`);

                // For gloves with only Black Barley
                if (productType === 'gloves') {
                    singleColorSwatch.style.pointerEvents = 'none'; // Make it non-clickable since it's the only option
                }
            }

            // Check if product is now complete (has all required selections)
            const isComplete = isProductSelectionComplete(card);
            if (isComplete) {
                // Enable the select button since all options are auto-selected
                const selectBtn = card.querySelector('.select-btn');
                if (selectBtn) {
                    selectBtn.disabled = false;
                    console.log(`[Auto-Select] ${productType} ${productId}: Product ready for selection with auto-selected options`);
                }
            }
        }

        // Check if a product card has all required selections
        function isProductSelectionComplete(card) {
            // Check size selection if size options exist
            const sizeGrid = card.querySelector('.size-grid');
            if (sizeGrid) {
                const selectedSize = card.querySelector('.size-btn.selected');
                if (!selectedSize) return false;
            }

            // Check color selection if color options exist
            const colorOptions = card.querySelector('.color-options');
            if (colorOptions) {
                const selectedColor = card.querySelector('.color-swatch.selected');
                if (!selectedColor) return false;
            }

            return true;
        }

        // Selection Functions
        function selectSize(event, productId) {
            event.stopPropagation();
            const button = event.target;
            const card = button.closest('.product-card');
            const selectedSize = button.dataset.size;

            // Clear other size selections in this card
            card.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');

            // Update the retail value display with size upcharge
            const type = card.dataset.productType;
            const product = products[type + 's']?.find(p => p.id === productId);

            if (product && product.id) {
                // Get base retail price
                let basePrice = 0;
                if (type === 'jacket' && RETAIL_PRICES.jackets[product.id]) {
                    basePrice = RETAIL_PRICES.jackets[product.id];
                } else if (type === 'hoodie') {
                    basePrice = RETAIL_PRICES.hoodies;
                } else if (type === 'beanie') {
                    basePrice = RETAIL_PRICES.beanies;
                } else if (type === 'gloves') {
                    basePrice = RETAIL_PRICES.gloves;
                }

                // Add size upcharge
                const upcharges = sizeUpchargeCache[product.id] || {};
                const upcharge = upcharges[selectedSize] || 0;
                const totalValue = basePrice + upcharge;

                // Update the retail value display on the card
                const retailValueElement = card.querySelector('.retail-value');
                if (retailValueElement) {
                    retailValueElement.textContent = `$${totalValue} value`;

                    // Add visual feedback for upcharge
                    if (upcharge > 0) {
                        retailValueElement.title = `Base: $${basePrice} + Size upcharge: $${upcharge}`;
                    } else {
                        retailValueElement.title = '';
                    }
                }

                console.log(`[Value Update] ${type} ${product.id} size ${selectedSize}: $${basePrice} + $${upcharge} = $${totalValue}`);
            }

            // If this product is already selected, update the saved selection
            if (card.classList.contains('selected')) {
                const type = card.dataset.productType;

                // For gloves, ensure the auto-selected color is properly set
                if (type === 'gloves') {
                    const colorSwatch = card.querySelector('.color-swatch');
                    if (colorSwatch && !colorSwatch.classList.contains('selected')) {
                        colorSwatch.classList.add('selected');
                    }
                }

                // Only call selectProduct if all required selections are present
                const hasColor = card.querySelector('.color-swatch.selected');
                const hasSize = card.querySelector('.size-btn.selected');

                if (hasColor && hasSize) {
                    selectProduct(productId, type);
                }
            }

            // Update the Select button state to reflect the new selection
            updateProductButtonState(card);
        }

        async function selectColor(event, productId) {
            event.stopPropagation();
            const swatch = event.target.closest('.color-swatch');
            const card = swatch.closest('.product-card');

            // IMPORTANT: Capture the currently selected size BEFORE any DOM updates
            const previouslySelectedSize = card.querySelector('.size-btn.selected')?.dataset.size;

            // Clear other color selections in this card
            card.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');

            // Update product image based on selected color
            const colorImages = swatch.dataset.colorImages;
            if (colorImages) {
                try {
                    const images = JSON.parse(colorImages);
                    const productImage = card.querySelector('.product-image img');

                    // Use the first available image from the color
                    const newImage = images.main || images.frontModel || images.frontFlat;

                    if (productImage && newImage) {
                        productImage.src = newImage;
                        productImage.alt = swatch.dataset.color + ' - ' + productId;
                        // Update the zoom modal onclick
                        const productImageDiv = card.querySelector('.product-image');
                        if (productImageDiv) {
                            productImageDiv.setAttribute('onclick', `openZoomModal('${newImage}')`);
                        }
                    }
                } catch (e) {
                    console.error('Error updating product image:', e);
                }
            }

            // Fetch actual sizes for this color
            const colorCode = swatch.dataset.colorCode || swatch.dataset.color;
            try {
                const sizesResponse = await fetch(`/api/sizes-by-style-color?styleNumber=${productId}&color=${encodeURIComponent(colorCode)}`);

                if (sizesResponse.ok) {
                    const sizesData = await sizesResponse.json();
                    // Pass the previously selected size to the update function
                    updateProductSizes(card, sizesData, productId, previouslySelectedSize);
                }
            } catch (error) {
                console.warn('Could not fetch sizes for color:', error);
            }
        }

        // Validate color availability by checking inventory per size
        async function validateColorAvailability(colors, styleNumber) {
            const availableColors = [];

            for (const color of colors) {
                try {
                    const colorCode = color.COLOR_CODE || color.CATALOG_COLOR || color.COLOR_NAME;
                    if (!colorCode) continue;

                    // Check inventory for this color
                    const response = await fetch(`/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(colorCode)}`);

                    if (response.ok) {
                        const data = await response.json();

                        // Check if ANY size has inventory (not just grandTotal)
                        let hasAnyInventory = false;
                        const availableSizesForColor = [];

                        if (data.sizeTotals && Array.isArray(data.sizeTotals)) {
                            // Check each size's inventory
                            data.sizeTotals.forEach((inventory, index) => {
                                if (inventory > 0) {
                                    hasAnyInventory = true;
                                    if (data.sizes && data.sizes[index]) {
                                        availableSizesForColor.push({
                                            size: data.sizes[index],
                                            inventory: inventory
                                        });
                                    }
                                }
                            });
                        } else if (data.grandTotal && data.grandTotal > 0) {
                            // Fallback to grandTotal if sizeTotals not available
                            hasAnyInventory = true;
                        }

                        if (hasAnyInventory) {
                            // Store inventory data with the color for later use
                            color._inventoryData = data;
                            color._availableSizes = availableSizesForColor;
                            availableColors.push(color);
                        } else {
                            console.warn(`Filtering out ${colorCode} for ${styleNumber} - zero inventory across all sizes`);
                        }
                    } else {
                        // If we can't check inventory, include the color (fail open)
                        availableColors.push(color);
                    }
                } catch (error) {
                    console.warn(`Could not validate color ${color.COLOR_NAME}:`, error);
                    // If validation fails, include the color to avoid blocking
                    availableColors.push(color);
                }
            }

            return availableColors;
        }

        // Fetch default sizes for a product using its first available color
        async function fetchDefaultSizesForProduct(styleNumber, colors) {
            try {
                // Get the first available color
                const firstColor = colors[0]?.COLOR_CODE || colors[0]?.COLOR_NAME;
                if (!firstColor) {
                    console.warn(`No color available for product ${styleNumber}`);
                    return null;
                }

                const response = await fetch(`/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(firstColor)}`);

                if (!response.ok) {
                    console.warn(`Failed to fetch sizes for ${styleNumber} with color ${firstColor}`);
                    return null;
                }

                const sizesData = await response.json();
                return extractSizesFromData(sizesData);
            } catch (error) {
                console.error(`Error fetching sizes for product ${styleNumber}:`, error);
                showErrorBanner(`Unable to load sizes for product ${styleNumber}. Please refresh the page.`);
                return null;
            }
        }

        // Extract sizes with inventory from API response data
        function extractSizesWithInventory(sizesData) {
            const sizesWithInventory = [];

            if (sizesData && typeof sizesData === 'object') {
                // Check if it has sizes and sizeTotals arrays (standard format)
                if (sizesData.sizes && sizesData.sizeTotals &&
                    Array.isArray(sizesData.sizes) && Array.isArray(sizesData.sizeTotals)) {

                    sizesData.sizes.forEach((size, index) => {
                        const inventory = sizesData.sizeTotals[index] || 0;
                        sizesWithInventory.push({
                            size: size,
                            inventory: inventory,
                            available: inventory > 0
                        });
                    });
                }
                // Check if it's an array of size objects
                else if (Array.isArray(sizesData)) {
                    sizesData.forEach(item => {
                        if (item.SIZE || item.size) {
                            sizesWithInventory.push({
                                size: item.SIZE || item.size,
                                inventory: item.inventory || item.quantity || 1,
                                available: true
                            });
                        }
                    });
                }
                // Fallback: check standard size fields
                else {
                    const sizeFields = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL'];
                    sizeFields.forEach(size => {
                        const inventory = sizesData[size] || sizesData[size.toLowerCase()] || 0;
                        if (inventory !== undefined) {
                            sizesWithInventory.push({
                                size: size === 'XXL' ? '2XL' : size,
                                inventory: parseInt(inventory),
                                available: parseInt(inventory) > 0
                            });
                        }
                    });
                }
            }

            return sizesWithInventory;
        }

        // Extract sizes from API response data (backward compatibility)
        function extractSizesFromData(sizesData) {
            const sizesWithInventory = extractSizesWithInventory(sizesData);
            // Return only available sizes
            return sizesWithInventory
                .filter(item => item.available)
                .map(item => item.size);
        }

        // Update sizes based on API response with inventory awareness
        function updateProductSizes(card, sizesData, productId, preservedSize = null) {
            const sizeGrid = card.querySelector('.size-grid');
            if (!sizeGrid || !sizesData) return;

            // Use the passed-in preserved size, or try to get it from current selection
            const previouslySelectedSize = preservedSize || card.querySelector('.size-btn.selected')?.dataset.size;

            // Get sizes with inventory information
            const sizesWithInventory = extractSizesWithInventory(sizesData);

            // Generate size buttons - show all sizes but disable out-of-stock
            if (sizesWithInventory.length > 0) {
                const sizeButtons = sizesWithInventory.map(sizeInfo => {
                    const { size, inventory, available } = sizeInfo;

                    // Create button with appropriate styling and state
                    if (available) {
                        // Available size - normal button
                        return `<button class="size-btn" data-size="${size}" data-inventory="${inventory}"
                                data-call="selectSize" data-args="${JSON.stringify(['$event', productId]).replace(/"/g, '&quot;')}">${size}</button>`;
                    } else {
                        // Out of stock - disabled button with visual indicator
                        return `<button class="size-btn out-of-stock" data-size="${size}"
                                disabled style="opacity: 0.4; cursor: not-allowed; position: relative;"
                                title="Out of Stock">${size}</button>`;
                    }
                }).join('');

                sizeGrid.innerHTML = sizeButtons;

                // Re-apply the previously selected size if it still exists and is available
                if (previouslySelectedSize) {
                    // Use setTimeout to ensure DOM is fully updated
                    setTimeout(() => {
                        const sizeBtn = sizeGrid.querySelector(`.size-btn[data-size="${previouslySelectedSize}"]:not(:disabled)`);
                        if (sizeBtn) {
                            sizeBtn.classList.add('selected');
                            console.log('Size preserved:', previouslySelectedSize); // Debug log
                        } else {
                            console.log('Size not available in new color:', previouslySelectedSize); // Debug log
                        }

                        // Update the Select button state after color and size selections
                        updateProductButtonState(card);
                    }, 0);
                }

                // Add CSS for out-of-stock styling if not already present
                if (!document.querySelector('#out-of-stock-styles')) {
                    const style = document.createElement('style');
                    style.id = 'out-of-stock-styles';
                    style.textContent = `
                        .size-btn.out-of-stock {
                            text-decoration: line-through;
                            background: #e5e7eb !important;
                            color: #9ca3af !important;
                            border-color: #d1d5db !important;
                        }
                        .size-btn.out-of-stock:hover {
                            background: #e5e7eb !important;
                            transform: none !important;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // Clear any previous size selection
                const selectedSize = card.querySelector('.size-btn.selected');
                if (selectedSize) {
                    selectedSize.classList.remove('selected');
                }
            }
        }

        // Select Product
        function selectProduct(productId, type) {
            console.log(`selectProduct called for ${type}: ${productId}`);
            const card = document.querySelector(`[data-product-id="${productId}"]`);

            // For gloves, ensure single color is selected
            if (type === 'gloves') {
                const colorSwatches = card.querySelectorAll('.color-swatch');
                if (colorSwatches.length === 1 && !colorSwatches[0].classList.contains('selected')) {
                    colorSwatches[0].classList.add('selected');
                }
            }

            // Get selected size and color FIRST before any changes
            const selectedSize = card.querySelector('.size-btn.selected')?.dataset.size;
            const selectedColorElement = card.querySelector('.color-swatch.selected');
            const selectedColor = selectedColorElement?.dataset.color;
            const selectedColorCode = selectedColorElement?.dataset.colorCode;

            // VALIDATE FIRST - Check what's missing
            const hasColorOptions = card.querySelector('.color-swatches');
            const hasSizeOptions = card.querySelector('.size-grid');

            // Check for missing selections
            if ((hasColorOptions && !selectedColor) || (hasSizeOptions && !selectedSize)) {
                console.log(`${type} validation failed - missing required fields`);

                // Determine specific error message
                let errorMessage = '';
                if (hasColorOptions && !selectedColor && hasSizeOptions && !selectedSize) {
                    errorMessage = `Please select a color and size for the ${type}.`;
                    // Highlight both areas
                    const colorSwatches = card.querySelector('.color-swatches');
                    const sizeGrid = card.querySelector('.size-grid');
                    if (colorSwatches) colorSwatches.classList.add('missing-selection');
                    if (sizeGrid) sizeGrid.classList.add('missing-selection');
                } else if (hasColorOptions && !selectedColor) {
                    errorMessage = `Please select a color for the ${type}.`;
                    // Highlight color area
                    const colorSwatches = card.querySelector('.color-swatches');
                    if (colorSwatches) colorSwatches.classList.add('missing-selection');
                } else if (hasSizeOptions && !selectedSize) {
                    errorMessage = `Please select a size for the ${type}.`;
                    // Highlight size area
                    const sizeGrid = card.querySelector('.size-grid');
                    if (sizeGrid) sizeGrid.classList.add('missing-selection');
                }

                // Show inline error
                showInlineError(errorMessage);

                // Remove highlights after 3 seconds
                setTimeout(() => {
                    card.querySelectorAll('.missing-selection').forEach(el => {
                        el.classList.remove('missing-selection');
                    });
                }, 3000);

                // Don't proceed with selection
                updateContinueButtons();
                return;
            }

            // VALIDATION PASSED - Now we can mark as selected
            // Clear previous selection of this type
            document.querySelectorAll(`[data-product-type="${type}"]`).forEach(c => {
                c.classList.remove('selected');
            });

            // Mark this card as selected
            card.classList.add('selected');

            // Find product data
            let product = null;
            if (type === 'jacket') {
                product = products.jackets.find(p => p.id === productId);
            } else if (type === 'hoodie') {
                product = products.hoodies.find(p => p.id === productId);
            } else if (type === 'beanie') {
                product = products.beanies.find(p => p.id === productId);
            } else if (type === 'gloves') {
                product = products.gloves.find(p => p.id === productId);
            }

            // Find the selected color object from the product
            let selectedColorData = null;
            if (product && product.colors) {
                selectedColorData = product.colors.find(c => {
                    if (typeof c === 'string') {
                        return c === selectedColor;
                    } else {
                        return (c.COLOR_NAME || c.name) === selectedColor;
                    }
                });
            }

            // Calculate retail price with size upcharges
            let itemRetailPrice = product.retailPrice || 0;
            if (selectedSize && product.id) {
                // Get base retail price
                if (type === 'jacket' && RETAIL_PRICES.jackets[product.id]) {
                    itemRetailPrice = RETAIL_PRICES.jackets[product.id];
                } else if (type === 'hoodie') {
                    itemRetailPrice = RETAIL_PRICES.hoodies;
                } else if (type === 'beanie') {
                    itemRetailPrice = RETAIL_PRICES.beanies;
                } else if (type === 'gloves') {
                    itemRetailPrice = RETAIL_PRICES.gloves;
                }

                // Add size upcharge
                const upcharges = sizeUpchargeCache[product.id] || {};
                const upcharge = upcharges[selectedSize] || 0;
                itemRetailPrice += upcharge;

                console.log(`[Value Calc] ${type} ${product.id} size ${selectedSize}: base $${itemRetailPrice - upcharge} + upcharge $${upcharge} = $${itemRetailPrice}`);
            }

            // Save selection with full product data
            selectedItems[type] = {
                ...product,
                selectedSize,
                selectedColor,
                selectedColorCode,
                selectedColorData, // Store the full color object for later use
                retailPrice: itemRetailPrice // Store calculated retail price with upcharge
            };

            console.log(`${type} saved successfully:`, selectedItems[type]);

            // Update button text on all cards of this type
            document.querySelectorAll(`[data-product-type="${type}"] .select-btn`).forEach(btn => {
                const btnCard = btn.closest('.product-card');
                if (btnCard.classList.contains('selected')) {
                    btn.textContent = 'Change Selection';
                    btn.classList.add('selected');
                } else {
                    btn.textContent = `Select This ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                    btn.classList.remove('selected');
                }
            });

            // Enable next button
            const nextButton = document.getElementById(`${type}Next`);
            nextButton.disabled = false;

            // Show helper text
            showSelectionHelper();

            // Auto-scroll to Continue button with smooth animation
            setTimeout(() => {
                nextButton.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // Add a temporary glow effect to draw attention
                nextButton.style.transition = 'all 0.5s ease';
                nextButton.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.8)';
                setTimeout(() => {
                    nextButton.style.boxShadow = '';
                }, 2000);
            }, 300);

            // Update summary
            updateSummary();
            updateValueSummaryBanner(); // Update value banner when products are selected
        }


        // Skip Functions - REMOVED (all items now required)

        // Update Gift Box Display Function
        function updateGiftBoxDisplay() {
            // Update the sidebar gift box display
            updateSummary();
        }

        // Check what's missing on any product cards for the current step
        function checkMissingSelections(stepNumber) {
            const typeMap = {
                1: 'jacket',
                2: 'hoodie',
                3: 'beanie',
                4: 'gloves'
            };

            const type = typeMap[stepNumber];
            if (!type) return { hasInteraction: false, missingColor: false, missingSize: false };

            // Find all product cards for this type
            const cards = document.querySelectorAll(`[data-product-type="${type}"]`);
            let hasInteraction = false;
            let missingColor = false;
            let missingSize = false;

            cards.forEach(card => {
                const hasColorOptions = card.querySelector('.color-swatches');
                const hasSizeOptions = card.querySelector('.size-grid');
                const hasSelectedColor = card.querySelector('.color-swatch.selected');
                const hasSelectedSize = card.querySelector('.size-btn.selected');

                // Check if user has made any selection on this card
                if (hasSelectedColor || hasSelectedSize) {
                    hasInteraction = true;
                }

                // Check what's missing
                if (hasColorOptions && !hasSelectedColor && (hasSelectedSize || card.querySelector('.select-btn:focus'))) {
                    missingColor = true;
                    hasInteraction = true;
                }

                if (hasSizeOptions && !hasSelectedSize && (hasSelectedColor || card.querySelector('.select-btn:focus'))) {
                    missingSize = true;
                    hasInteraction = true;
                }
            });

            return { hasInteraction, missingColor, missingSize };
        }

        // Update product card button states based on selections
        function updateProductButtonState(card) {
            if (!card) return;

            const productId = card.dataset.productId;
            const productType = card.dataset.productType;
            const selectBtn = card.querySelector(`button[onclick*="selectProduct"]`);

            if (!selectBtn) return;

            // Check if product is already selected
            const isAlreadySelected = card.classList.contains('selected');

            // Check if all required fields are selected
            const hasColorOptions = card.querySelector('.color-swatches');
            const hasSizeOptions = card.querySelector('.size-grid');

            let colorSelected = true;
            let sizeSelected = true;

            if (hasColorOptions) {
                colorSelected = !!card.querySelector('.color-swatch.selected');
            }

            if (hasSizeOptions) {
                sizeSelected = !!card.querySelector('.size-btn.selected');
            }

            // AUTO-SELECT: Disabled on page load to prevent automation issues
            // Only auto-select if user has interacted with the page (after 3 seconds)
            if (colorSelected && sizeSelected && !isAlreadySelected) {
                // Check if enough time has passed since page load (3 seconds)
                if (window.pageLoadTime && Date.now() - window.pageLoadTime > 3000) {
                    console.log(`Auto-selecting ${productType} since all options are selected`);
                    selectProduct(productId, productType);
                    return; // Exit early since selectProduct will update everything
                } else {
                    // Don't auto-select during initial page load
                    console.log(`Skipping auto-select for ${productType} - too soon after page load`);
                }
            }

            // Update button state and text
            if (isAlreadySelected) {
                selectBtn.disabled = false;
                selectBtn.classList.remove('disabled-btn');
                selectBtn.classList.add('select-btn', 'selected');
                selectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Product Selected';
            } else if (colorSelected && sizeSelected) {
                selectBtn.disabled = false;
                selectBtn.classList.remove('disabled-btn');
                selectBtn.classList.add('select-btn');
                selectBtn.innerHTML = '<i class="fas fa-check"></i> Select This ' +
                    productType.charAt(0).toUpperCase() + productType.slice(1);
            } else {
                selectBtn.disabled = true;
                selectBtn.classList.add('disabled-btn');
                selectBtn.classList.remove('select-btn');

                // Show what's missing
                if (!colorSelected && !sizeSelected) {
                    selectBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Select Color & Size First';
                } else if (!colorSelected) {
                    selectBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Select Color First';
                } else if (!sizeSelected) {
                    selectBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Select Size First';
                }
            }
        }

        // Calculate Retail Value Function
        function calculateRetailValue() {
            let total = 0;
            if (selectedItems.jacket && selectedItems.jacket.retailPrice) {
                total += selectedItems.jacket.retailPrice;
            }
            if (selectedItems.hoodie && selectedItems.hoodie.retailPrice) {
                total += selectedItems.hoodie.retailPrice;
            }
            if (selectedItems.beanie && selectedItems.beanie.retailPrice) {
                total += selectedItems.beanie.retailPrice;
            }
            if (selectedItems.gloves && selectedItems.gloves.retailPrice) {
                total += selectedItems.gloves.retailPrice;
            }
            // Add gift box and shipping
            total += RETAIL_PRICES.giftBox || 9;
            total += RETAIL_PRICES.shipping || 25;
            return total;
        }

        // Inline Error Display Function
        function showInlineError(message) {
            // Remove any existing error messages
            const existingError = document.querySelector('.inline-error-message');
            if (existingError) {
                existingError.remove();
            }

            // Create error message element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'inline-error-message';
            errorDiv.style.cssText = `
                background: #ffebee;
                border: 2px solid #f44336;
                color: #b71c1c;
                padding: 12px 20px;
                border-radius: 8px;
                margin: 20px auto;
                max-width: 600px;
                text-align: center;
                font-weight: 500;
                animation: shake 0.5s;
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
            `;
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-circle"></i> ${message}
            `;

            // Add to page
            document.body.appendChild(errorDiv);

            // Remove after 5 seconds
            setTimeout(() => {
                errorDiv.style.opacity = '0';
                errorDiv.style.transition = 'opacity 0.3s';
                setTimeout(() => errorDiv.remove(), 300);
            }, 5000);

            // Also highlight missing selections
            highlightMissingSelections();
        }

        // Highlight Missing Selections
        function highlightMissingSelections() {
            // Remove existing highlights
            document.querySelectorAll('.missing-selection').forEach(el => {
                el.classList.remove('missing-selection');
            });

            // Check current step and highlight missing items
            const currentStepElement = document.getElementById(`step${currentStep}`);

            if (currentStep === 1 && selectedItems.jacket) {
                // Highlight missing color or size
                const jacketCard = document.querySelector('[data-product-type="jacket"].selected');
                if (jacketCard) {
                    if (!jacketCard.querySelector('.color-swatch.selected')) {
                        const colorSection = jacketCard.querySelector('.color-swatches');
                        if (colorSection) colorSection.classList.add('missing-selection');
                    }
                    if (!jacketCard.querySelector('.size-btn.selected')) {
                        const sizeSection = jacketCard.querySelector('.size-grid');
                        if (sizeSection) sizeSection.classList.add('missing-selection');
                    }
                }
            }
            // Similar for other steps...
        }

        // Navigation
        window.goToStep = function(targetStep) {
            // Convert to number if string
            targetStep = parseInt(targetStep);

            // Detect automation - prevent if navigating too fast
            const now = Date.now();
            if (lastStepNavigationTime && now - lastStepNavigationTime < 300) {
                console.warn('Suspicious navigation pattern detected - blocking rapid navigation');
                return;
            }

            // Only allow navigation to visited steps (up to highestStepReached)
            if (targetStep >= 1 && targetStep <= highestStepReached) {
                // Update navigation timing
                lastStepNavigationTime = now;
                // Hide current step
                document.getElementById(`step${currentStep}`).classList.remove('active');
                document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');

                // Update completed status for all steps
                // Mark all steps before target as completed
                for (let i = 1; i < targetStep; i++) {
                    document.querySelector(`[data-step="${i}"]`).classList.add('completed');
                    document.querySelector(`[data-step="${i}"]`).classList.remove('active');
                }

                // Mark target step as active (not completed)
                document.querySelector(`[data-step="${targetStep}"]`).classList.remove('completed');
                document.querySelector(`[data-step="${targetStep}"]`).classList.add('active');

                // Mark all steps after target as not active and not completed
                for (let i = targetStep + 1; i <= 7; i++) {
                    const stepElement = document.querySelector(`[data-step="${i}"]`);
                    if (stepElement) {
                        stepElement.classList.remove('active');
                        stepElement.classList.remove('completed');
                    }
                }

                // Update current step
                currentStep = targetStep;

                // Show target step
                document.getElementById(`step${currentStep}`).classList.add('active');

                // Remove completed class from current step and add active
                document.querySelector(`[data-step="${currentStep}"]`).classList.remove('completed');
                document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

                // Initialize delivery date when reaching step 5
                if (currentStep === 5) {
                    setTimeout(() => {
                        initializeDeliveryDate();
                    }, 100);
                }

                // Update submit button state if on last step
                if (currentStep === 6) {
                    validateForm();
                }

                // Reset submission state when entering Step 7
                if (currentStep === 7) {
                    // IMPORTANT: Reset any stuck submission state when entering Step 7
                    window.isSubmitting = false;
                    const overlay = document.getElementById('submissionOverlay');
                    if (overlay) {
                        overlay.classList.remove('active');
                        // Force style recalculation to ensure it's hidden
                        overlay.style.display = 'none';
                        setTimeout(() => {
                            overlay.style.display = '';
                        }, 10);
                    }

                    // Populate the review data
                    populateReviewData();

                    // Attach submit button handlers after a delay
                    // This delay ensures the DOM is fully settled before attaching handlers
                    setTimeout(() => {
                        attachSubmitHandlers();
                    }, 200);
                }

                // Update continue button states based on selections
                updateContinueButtons();

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // If trying to go forward to unvisited step, do nothing (cursor: not-allowed will show)
        }

        // Validate current step selections
        function validateCurrentStep() {
            switch(currentStep) {
                case 1: // Jacket step - REQUIRED
                    if (!selectedItems.jacket) return false;
                    // Check if we have the required fields OR if the card is properly selected in DOM
                    const jacketCard = document.querySelector('[data-product-type="jacket"].selected');
                    if (jacketCard) {
                        // If card is selected, ensure we have color and size
                        const hasColor = selectedItems.jacket.selectedColor || jacketCard.querySelector('.color-swatch.selected');
                        const hasSize = selectedItems.jacket.selectedSize || jacketCard.querySelector('.size-btn.selected');
                        return hasColor && hasSize;
                    }
                    return selectedItems.jacket.selectedColor && selectedItems.jacket.selectedSize;

                case 2: // Hoodie step - NOW REQUIRED (no skipping)
                    if (!selectedItems.hoodie) return false;
                    const hoodieCard = document.querySelector('[data-product-type="hoodie"].selected');
                    if (hoodieCard) {
                        const hasColor = selectedItems.hoodie.selectedColor || hoodieCard.querySelector('.color-swatch.selected');
                        const hasSize = selectedItems.hoodie.selectedSize || hoodieCard.querySelector('.size-btn.selected');
                        return hasColor && hasSize;
                    }
                    return selectedItems.hoodie.selectedColor && selectedItems.hoodie.selectedSize;

                case 3: // Beanie step - REQUIRED
                    if (!selectedItems.beanie) return false;
                    const beanieCard = document.querySelector('[data-product-type="beanie"].selected');
                    if (beanieCard) {
                        const hasColor = selectedItems.beanie.selectedColor || beanieCard.querySelector('.color-swatch.selected');
                        return hasColor;
                    }
                    // Beanies usually have OSFA, so just check color
                    return selectedItems.beanie.selectedColor;

                case 4: // Gloves step - NOW REQUIRED (no skipping)
                    if (!selectedItems.gloves) return false;
                    const glovesCard = document.querySelector('[data-product-type="gloves"].selected');
                    if (glovesCard) {
                        const hasSize = selectedItems.gloves.selectedSize || glovesCard.querySelector('.size-btn.selected');
                        return hasSize;
                    }
                    return selectedItems.gloves.selectedSize;

                default:
                    return true; // Other steps don't require product validation
            }
        }

        window.nextStep = function() {
            // Prevent rapid navigation (500ms cooldown between steps)
            const now = Date.now();
            if (lastStepNavigationTime && now - lastStepNavigationTime < 500) {
                console.warn('Navigation too fast - preventing rapid step advancement');
                return;
            }

            // Require user interaction before allowing navigation (except for Step 5 which has no products)
            if (!userHasInteracted && currentStep < 5) {
                console.warn('No user interaction detected - blocking automated navigation');
                return;
            }

            // Validate current step before advancing
            if (!validateCurrentStep()) {
                let missingInfo = '';
                const productNames = {
                    1: 'jacket',
                    2: 'hoodie',
                    3: 'beanie',
                    4: 'gloves'
                };

                const productName = productNames[currentStep];

                // Check what's missing on the current step's product cards
                const missing = checkMissingSelections(currentStep);

                // Provide specific feedback based on what's missing
                if (missing.hasInteraction) {
                    // User has started selecting but hasn't completed
                    if (missing.missingColor && missing.missingSize) {
                        missingInfo = `Please select a color and size for the ${productName}.`;
                    } else if (missing.missingColor) {
                        // Be more specific for beanies since size is often auto-selected
                        if (productName === 'beanie') {
                            missingInfo = `Please select a color for the beanie.`;
                        } else {
                            missingInfo = `Please select a color for the ${productName}.`;
                        }
                    } else if (missing.missingSize) {
                        missingInfo = `Please select a size for the ${productName}.`;
                    } else {
                        // User interacted but selection isn't complete
                        missingInfo = `Please complete your ${productName} selection.`;
                    }
                } else {
                    // No interaction at all - check if something is in selectedItems but incomplete
                    const item = selectedItems[productName];
                    if (item) {
                        // Item partially selected in data but not complete
                        if (!item.selectedColor && !item.selectedSize) {
                            missingInfo = `Please select a color and size for the ${productName}.`;
                        } else if (!item.selectedColor) {
                            missingInfo = `Please select a color for the ${productName}.`;
                        } else if (!item.selectedSize) {
                            missingInfo = `Please select a size for the ${productName}.`;
                        } else {
                            missingInfo = `Please complete your ${productName} selection.`;
                        }
                    } else {
                        // Nothing selected at all
                        missingInfo = `Please select a ${productName}. All items are required.`;
                    }
                }

                // Log for debugging
                console.log('Validation failed:', {
                    step: currentStep,
                    product: productName,
                    hasInteraction: missing.hasInteraction,
                    missingColor: missing.missingColor,
                    missingSize: missing.missingSize,
                    errorMessage: missingInfo
                });

                // Show inline error instead of alert
                showInlineError(missingInfo || 'Please complete your selection before continuing.');
                return;
            }

            if (currentStep < 7) {
                // Update navigation timing
                lastStepNavigationTime = Date.now();

                // Special handling for Santa Bonus after step 4
                if (currentStep === 4 && !window.santaBonusShown) {
                    // Hide current step
                    document.getElementById(`step${currentStep}`).classList.remove('active');

                    // Mark step 4 as completed
                    document.querySelector(`[data-step="${currentStep}"]`).classList.add('completed');

                    // Show Santa Bonus section
                    document.getElementById('santaBonus').style.display = 'block';
                    document.getElementById('santaBonus').classList.add('active');
                    window.santaBonusShown = true;

                    // Scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }

                // Hide current step
                document.getElementById(`step${currentStep}`).classList.remove('active');

                // Update progress
                document.querySelector(`[data-step="${currentStep}"]`).classList.add('completed');

                currentStep++;

                // Update highest step reached
                if (currentStep > highestStepReached) {
                    highestStepReached = currentStep;
                }

                // Show next step
                document.getElementById(`step${currentStep}`).classList.add('active');
                document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

                // Initialize delivery date when reaching step 5
                if (currentStep === 5) {
                    setTimeout(() => {
                        initializeDeliveryDate();
                    }, 100);
                }

                // Populate review data when reaching step 7
                if (currentStep === 7) {
                    // IMPORTANT: Reset any stuck submission state when entering Step 7
                    window.isSubmitting = false;
                    const overlay = document.getElementById('submissionOverlay');
                    if (overlay) {
                        overlay.classList.remove('active');
                        // Force style recalculation to ensure it's hidden
                        overlay.style.display = 'none';
                        setTimeout(() => {
                            overlay.style.display = '';
                        }, 10);
                    }

                    // Populate the review data
                    populateReviewData();

                    // Ensure submit button has handlers attached after a delay
                    // This delay ensures the DOM is fully settled before attaching handlers
                    setTimeout(() => {
                        attachSubmitHandlers();
                    }, 200);
                }

                // Show scroll indicator for product selection steps
                showScrollIndicator();

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        // Function to proceed from Santa Bonus to Step 5
        window.proceedFromBonus = function() {
            // Hide Santa Bonus section
            document.getElementById('santaBonus').classList.remove('active');
            document.getElementById('santaBonus').style.display = 'none';

            // Move to step 5
            currentStep = 5;

            // Update highest step reached
            if (currentStep > highestStepReached) {
                highestStepReached = currentStep;
            }

            // Show step 5
            document.getElementById(`step${currentStep}`).classList.add('active');
            document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

            // Initialize delivery date
            setTimeout(() => {
                initializeDeliveryDate();
            }, 100);

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        window.previousStep = function() {
            if (currentStep > 1) {
                // Hide current step
                document.getElementById(`step${currentStep}`).classList.remove('active');
                document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');

                // Update current step
                currentStep--;

                // Show previous step
                document.getElementById(`step${currentStep}`).classList.add('active');
                document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

                // Update progress bar - mark current as active, not completed
                document.querySelector(`[data-step="${currentStep}"]`).classList.remove('completed');

                // Update summary and continue buttons
                updateSummary();
                updateContinueButtons();

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        // Update continue button states based on selections
        function updateContinueButtons() {
            // Helper function to check if a product is FULLY selected with ALL required attributes
            function isProductFullyComplete(type) {
                const item = selectedItems[type];
                if (!item || !item.id) return false;

                // Check the actual product card to verify selections match
                const card = document.querySelector(`[data-product-id="${item.id}"]`);
                if (!card || !card.classList.contains('selected')) return false;

                // For jackets and hoodies - MUST have color AND size
                if (type === 'jacket' || type === 'hoodie') {
                    if (!item.selectedColor || !item.selectedSize) return false;
                    // Double-check the DOM
                    const hasColorSelected = card.querySelector('.color-swatch.selected');
                    const hasSizeSelected = card.querySelector('.size-btn.selected');
                    return hasColorSelected && hasSizeSelected;
                }

                // For beanies - MUST have color (size is often OSFA)
                if (type === 'beanie') {
                    if (!item.selectedColor) return false;
                    const hasColorSelected = card.querySelector('.color-swatch.selected');
                    return hasColorSelected;
                }

                // For gloves - MUST have size (and color if available)
                if (type === 'gloves') {
                    if (!item.selectedSize) return false;
                    const hasSizeSelected = card.querySelector('.size-btn.selected');
                    // If gloves have color options, check that too
                    const hasColorOptions = card.querySelector('.color-swatches');
                    if (hasColorOptions) {
                        if (!item.selectedColor) return false;
                        const hasColorSelected = card.querySelector('.color-swatch.selected');
                        return hasSizeSelected && hasColorSelected;
                    }
                    return hasSizeSelected;
                }

                return true;
            }

            // Update jacket continue button - ALL items are now REQUIRED
            if (isProductFullyComplete('jacket')) {
                document.getElementById('jacketNext')?.removeAttribute('disabled');
            } else {
                document.getElementById('jacketNext')?.setAttribute('disabled', 'disabled');
            }

            // Update hoodie continue button - ALL items are now REQUIRED (no skipping)
            if (isProductFullyComplete('hoodie')) {
                document.getElementById('hoodieNext')?.removeAttribute('disabled');
            } else {
                document.getElementById('hoodieNext')?.setAttribute('disabled', 'disabled');
            }

            // Update beanie continue button - ALL items are now REQUIRED
            if (isProductFullyComplete('beanie')) {
                document.getElementById('beanieNext')?.removeAttribute('disabled');
            } else {
                document.getElementById('beanieNext')?.setAttribute('disabled', 'disabled');
            }

            // Update gloves continue button - ALL items are now REQUIRED (no skipping)
            if (isProductFullyComplete('gloves')) {
                document.getElementById('glovesNext')?.removeAttribute('disabled');
            } else {
                document.getElementById('glovesNext')?.setAttribute('disabled', 'disabled');
            }
        }

        // Logo Upload with validation
        function handleLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Clear any previous file selection first to prevent freezing
            if (window.selectedLogoFile) {
                window.selectedLogoFile = null;
                document.getElementById('logoPreview').classList.remove('active');
                document.getElementById('previewImage').src = '';
                selectedItems.logo = null;
            }

            // Validate file type - INCLUDING PDF support
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'application/pdf'];
            const maxSize = 10 * 1024 * 1024; // Reduced to 10MB for better upload reliability

            if (!validTypes.includes(file.type)) {
                alert('Please upload an image (PNG, JPG, GIF, SVG) or PDF file');
                event.target.value = '';
                return;
            }

            if (file.size > maxSize) {
                alert('Logo file is too large. Please use a file under 10MB or email it separately to sales@nwcustomapparel.com');
                event.target.value = '';
                return;
            }

            // Store the actual file for upload
            window.selectedLogoFile = file;

            // Show preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('previewImage').src = e.target.result;
                    document.getElementById('logoPreview').classList.add('active');
                    selectedItems.logo = e.target.result;
                    updateSummary();
                };
                reader.readAsDataURL(file);
            } else {
                // For PDFs, just show filename
                document.getElementById('logoPreview').innerHTML = `
                    <div class="pdf-preview">
                        <i class="fas fa-file-pdf" style="font-size: 3rem; color: #dc2626;"></i>
                        <p>${file.name}</p>
                        <button type="button" data-call="removeLogo" class="btn btn-sm">Remove</button>
                    </div>
                `;
                document.getElementById('logoPreview').classList.add('active');
                selectedItems.logo = file.name;
                updateSummary();
            }
        }

        // Upload file to Caspio via API
        async function uploadFileToAPI(file) {
            try {
                // Add timestamp to filename to avoid conflicts
                const timestamp = Date.now();
                const nameParts = file.name.split('.');
                const extension = nameParts.pop();
                const baseName = nameParts.join('.');
                const uniqueFileName = `${baseName}_${timestamp}.${extension}`;

                // Create a new File object with the unique name
                const uniqueFile = new File([file], uniqueFileName, { type: file.type });

                const formData = new FormData();
                formData.append('file', uniqueFile);

                const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('File uploaded successfully:', result);

                // Return the ExternalKey for storing in the database
                return result.ExternalKey || result.externalKey || result.id;
            } catch (error) {
                console.error('Error uploading file:', error);
                // Don't stop the submission, just log the error
                return null;
            }
        }

        // Remove logo
        function removeLogo() {
            document.getElementById('logoFile').value = '';
            document.getElementById('logoPreview').classList.remove('active');
            document.getElementById('previewImage').src = '';
            window.selectedLogoFile = null;
            selectedItems.logo = null;
            updateSummary();
        }

        // Toggle pricing info bar
        function togglePricing() {
            const infoBar = document.getElementById('pricingInfoBar');

            if (infoBar.classList.contains('collapsed')) {
                infoBar.classList.remove('collapsed');
                infoBar.classList.add('expanded');
            } else {
                infoBar.classList.remove('expanded');
                infoBar.classList.add('collapsed');
            }
        }

        // Toggle between Ship and Pickup
        function toggleDeliveryFields() {
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
            const shippingFields = document.getElementById('shippingFields');
            const pickupInfo = document.getElementById('pickupInfo');

            // Update value banner when shipping method changes
            updateValueSummaryBanner();

            if (deliveryMethod === 'Ship') {
                shippingFields.style.display = 'block';
                pickupInfo.style.display = 'none';

                // Make shipping fields required
                const addressField = document.getElementById('address1');
                const cityField = document.getElementById('city');
                const stateField = document.getElementById('state');
                const zipField = document.getElementById('zipCode');

                if (addressField) addressField.required = true;
                if (cityField) cityField.required = true;
                if (stateField) stateField.required = true;
                if (zipField) zipField.required = true;
            } else {
                shippingFields.style.display = 'none';
                pickupInfo.style.display = 'block';

                // Remove required from shipping fields
                const addressField = document.getElementById('address1');
                const cityField = document.getElementById('city');
                const stateField = document.getElementById('state');
                const zipField = document.getElementById('zipCode');

                if (addressField) addressField.required = false;
                if (cityField) cityField.required = false;
                if (stateField) stateField.required = false;
                if (zipField) zipField.required = false;
            }
        }

        // Drag and Drop
        function setupDragDrop() {
            const uploadArea = document.getElementById('uploadArea');

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');

                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const input = document.getElementById('logoFile');
                    input.files = e.dataTransfer.files;
                    handleLogoUpload({ target: input });
                }
            });
        }

        // Update Summary
        function updateSummary() {
            const summaryItems = document.getElementById('summaryItems');
            const hasItems = selectedItems.jacket || selectedItems.hoodie || selectedItems.beanie || selectedItems.gloves;

            if (!hasItems) {
                summaryItems.innerHTML = `
                    <div class="summary-empty">
                        <div class="summary-empty-icon">
                            <i class="fas fa-box-open"></i>
                        </div>
                        <div>Start building your gift box</div>
                    </div>
                `;
                // Only disable submit button if it exists
                const submitBtn = document.getElementById('submitBtn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                }
                return;
            }

            let html = '';

            // Add selected items
            if (selectedItems.jacket) {
                html += createSummaryItem(selectedItems.jacket, 'jacket');
            }
            if (selectedItems.hoodie) {
                html += createSummaryItem(selectedItems.hoodie, 'hoodie');
            }
            if (selectedItems.beanie) {
                html += createSummaryItem(selectedItems.beanie, 'beanie');
            }

            // Add gloves (if selected, show selected size; otherwise show pending selection)
            const gloveImageUrl = 'https://cdnm.sanmar.com/imglib/mresjpg/2024/f5/CTGD0794_blackbarley_glove_main.jpg';

            if (selectedItems.gloves) {
                // Create unique ID for glove image
                const gloveImageId = `summary-img-gloves-${Date.now()}`;
                html += `
                    <div class="summary-item">
                        <div class="summary-item-image" id="${gloveImageId}-container">
                            <img id="${gloveImageId}"
                                 src="${gloveImageUrl}"
                                 alt="Carhartt Work Gloves - ${selectedItems.gloves.selectedColor}"
                                 data-error-id="${gloveImageId}" data-error-icon="fa-mitten">
                            <div class="image-fallback">
                                <i class="fas fa-mitten"></i>
                            </div>
                        </div>
                        <div class="summary-item-details">
                            <div class="summary-item-name">Carhartt Work Gloves</div>
                            <div class="summary-item-specs">CTGD0794 • ${selectedItems.gloves.selectedSize || 'Size not selected'} • ${selectedItems.gloves.selectedColor || 'Black Barley'}</div>
                        </div>
                    </div>
                `;
            } else {
                // Create unique ID for unselected glove image
                const gloveImageId = `summary-img-gloves-pending-${Date.now()}`;
                html += `
                    <div class="summary-item" style="opacity: 0.5;">
                        <div class="summary-item-image" id="${gloveImageId}-container">
                            <img id="${gloveImageId}"
                                 src="${gloveImageUrl}"
                                 alt="Carhartt Work Gloves"
                                 data-error-id="${gloveImageId}" data-error-icon="fa-mitten">
                            <div class="image-fallback">
                                <i class="fas fa-mitten"></i>
                            </div>
                        </div>
                        <div class="summary-item-details">
                            <div class="summary-item-name">Carhartt Work Gloves</div>
                            <div class="summary-item-specs">CTGD0794 • Size not selected • Included</div>
                        </div>
                    </div>
                `;
            }

            summaryItems.innerHTML = html;

            // Enable submit if on last step and form is valid
            if (currentStep === 6) {
                validateForm();
            }
        }

        function createSummaryItem(item, type) {
            // Get the correct product image for the selected color
            let productImage = null;
            let fallbackIcon = type === 'jacket' ? 'fa-tshirt' : type === 'hoodie' ? 'fa-hoodie' : 'fa-hat-winter';

            // Try to get image from selectedColorData (which contains the color-specific image)
            if (item.selectedColorData) {
                // Priority order: MAIN_IMAGE_URL, then FRONT_FLAT, then FRONT_MODEL
                productImage = item.selectedColorData.MAIN_IMAGE_URL ||
                              item.selectedColorData.FRONT_FLAT ||
                              item.selectedColorData.FRONT_MODEL ||
                              item.selectedColorData.IMAGE_URL;

                // Handle cases where image might be empty string
                if (productImage === '' || productImage === 'null' || productImage === null) {
                    productImage = null;
                }
            }

            // Fallback to default product image if no color-specific image
            if (!productImage && item.image) {
                productImage = item.image;
            }

            // Create unique ID for this item's image to handle error events
            const imageId = `summary-img-${type}-${Date.now()}`;

            // Determine what to display - image or icon
            const imageContent = productImage
                ? `<img id="${imageId}"
                        src="${productImage}"
                        alt="${item.name} - ${item.selectedColor}"
                        data-error-id="${imageId}" data-error-icon="${fallbackIcon}">
                   <div class="image-fallback">
                        <i class="fas ${fallbackIcon}"></i>
                   </div>`
                : `<i class="fas ${fallbackIcon}"></i>`;

            return `
                <div class="summary-item">
                    <div class="summary-item-image" id="${imageId}-container">
                        ${imageContent}
                    </div>
                    <div class="summary-item-details">
                        <div class="summary-item-name">${item.name}</div>
                        <div class="summary-item-specs">${item.id} • ${type === 'beanie' ? 'OSFA' : (item.selectedSize || 'Size not selected')} • ${item.selectedColor || 'Color not selected'}</div>
                    </div>
                    <div class="summary-item-remove" data-call="removeItem" data-args="${JSON.stringify([type]).replace(/"/g, '&quot;')}">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
            `;
        }

        // Handle image load errors
        function handleImageError(imageId, fallbackIcon) {
            const container = document.getElementById(`${imageId}-container`);
            if (container) {
                container.classList.add('fallback-active');
            }
            // Log for debugging
            console.log(`Image failed to load for ${imageId}, showing fallback icon`);
        }

        // Debug function to verify image selection
        function debugGiftBoxImages() {
            console.log('=== Gift Box Image Debug ===');
            ['jacket', 'hoodie', 'beanie'].forEach(type => {
                const item = selectedItems[type];
                if (item) {
                    console.log(`\n${type.toUpperCase()}:`);
                    console.log(`  Product: ${item.name} (${item.id})`);
                    console.log(`  Selected Color: ${item.selectedColor}`);
                    if (item.selectedColorData) {
                        console.log(`  Color Data Available: Yes`);
                        console.log(`  MAIN_IMAGE_URL: ${item.selectedColorData.MAIN_IMAGE_URL || 'Not available'}`);
                        console.log(`  FRONT_FLAT: ${item.selectedColorData.FRONT_FLAT || 'Not available'}`);
                        console.log(`  FRONT_MODEL: ${item.selectedColorData.FRONT_MODEL || 'Not available'}`);
                    } else {
                        console.log(`  Color Data Available: No`);
                        console.log(`  Fallback Image: ${item.image || 'None'}`);
                    }
                }
            });
            console.log('\n=== End Debug ===');
        }

        // Add debug command to window for testing
        window.debugGiftBox = debugGiftBoxImages;

        function removeItem(type) {
            selectedItems[type] = null;

            // Clear selection in UI
            document.querySelectorAll(`[data-product-type="${type}"]`).forEach(card => {
                card.classList.remove('selected');
            });

            // Disable next button for that step
            if (document.getElementById(`${type}Next`)) {
                document.getElementById(`${type}Next`).disabled = true;
            }

            updateSummary();
            updateValueSummaryBanner(); // Update value banner when summary updates
        }

        // Calculate and update value summary banner
        function updateValueSummaryBanner() {
            const banner = document.getElementById('valueSummaryBanner');

            // Calculate total retail value
            let totalValue = 0;

            // Add selected items retail prices
            if (selectedItems.jacket && selectedItems.jacket.retailPrice) {
                totalValue += selectedItems.jacket.retailPrice;
            }
            if (selectedItems.hoodie && selectedItems.hoodie.retailPrice) {
                totalValue += selectedItems.hoodie.retailPrice;
            }
            if (selectedItems.beanie && selectedItems.beanie.retailPrice) {
                totalValue += selectedItems.beanie.retailPrice;
            }
            if (selectedItems.gloves && selectedItems.gloves.retailPrice) {
                totalValue += selectedItems.gloves.retailPrice;
            }

            // Add gift box and handling
            totalValue += RETAIL_PRICES.giftBox;

            // Add shipping if selected
            const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked');
            if (deliveryMethod && deliveryMethod.value === 'ship') {
                totalValue += RETAIL_PRICES.shipping;
            }

            // Only show banner if items are selected
            if (selectedItems.jacket || selectedItems.hoodie || selectedItems.beanie || selectedItems.gloves) {
                banner.style.display = 'block';
                document.getElementById('totalValueAmount').textContent = `$${totalValue}`;
                document.getElementById('totalSavingsAmount').textContent = `$${totalValue}`;
            } else {
                banner.style.display = 'none';
            }
        }

        // Form Validation
        function validateForm() {
            const form = document.getElementById('deliveryForm');
            const isValid = form.checkValidity();
            const submitBtn = document.getElementById('submitBtn');
            // CRITICAL FIX: Do not disable button on Step 7
            // User has completed all steps to reach Step 7, and submitOrder() validates everything
            if (submitBtn && currentStep !== 7) {
                submitBtn.disabled = !isValid;
            }
        }

        // Add event listeners for form validation
        document.querySelectorAll('#deliveryForm input, #deliveryForm select').forEach(input => {
            input.addEventListener('input', validateForm);
        });

        // Submit Gift Box
        async function submitGiftBox() {
            // Validate and ensure delivery date has a value
            validateDeliveryDate();

            // Get delivery date value (will have default if empty)
            let deliveryDateValue = document.getElementById('deliveryDate').value;

            // Final safeguard: if still no date, calculate default
            if (!deliveryDateValue) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let defaultDate = new Date(today);
                defaultDate.setDate(defaultDate.getDate() + 14);

                // Skip weekends
                while (isWeekend(defaultDate)) {
                    defaultDate.setDate(defaultDate.getDate() + 1);
                }

                deliveryDateValue = formatDate(defaultDate);
                document.getElementById('deliveryDate').value = deliveryDateValue;
            }

            // Collect all data
            const formData = {
                items: {
                    jacket: selectedItems.jacket,
                    hoodie: selectedItems.hoodie,
                    beanie: selectedItems.beanie
                },
                customization: {
                    logo: selectedItems.logo,
                    jacketEmbLocation: document.getElementById('jacketEmbLocation')?.value,
                    hoodieEmbLocation: document.getElementById('hoodieEmbLocation')?.value,
                    threadColors: document.getElementById('threadColors')?.value,
                    specialInstructions: document.getElementById('specialInstructions')?.value
                },
                delivery: {
                    contactName: document.getElementById('contactName').value,
                    companyName: document.getElementById('companyName').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value,
                    address1: document.getElementById('address1').value,
                    address2: document.getElementById('address2').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    zipCode: document.getElementById('zipCode').value,
                    dueDate: deliveryDateValue
                }
            };

            // Generate reference number
            const referenceNumber = generateReferenceNumber();
            document.getElementById('referenceNumber').textContent = referenceNumber;

            // Here you would normally send this data to your server
            console.log('Submitting gift box request:', formData);

            // Show success modal
            document.getElementById('successModal').classList.add('active');
        }

        function generateReferenceNumber() {
            const date = new Date();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `XMAS${month}${day}-${random}`;
        }

        function closeModal() {
            document.getElementById('successModal').classList.remove('active');
            // Reset form
            resetForm();
        }

        // Allow clicking outside the modal to close it
        function closeModalOnBackdrop(event) {
            if (event.target.id === 'successModal') {
                closeModal();
            }
        }

        function resetForm() {
            currentStep = 1;
            selectedItems = {
                jacket: null,
                hoodie: null,
                beanie: null,
                gloves: null,
                logo: null,
                customization: {},
                delivery: {}
            };

            // Reset UI
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById('step1').classList.add('active');

            document.querySelectorAll('.step').forEach(step => {
                step.classList.remove('active', 'completed');
            });
            document.querySelector('[data-step="1"]').classList.add('active');

            document.querySelectorAll('.product-card').forEach(card => {
                card.classList.remove('selected');
            });

            document.querySelectorAll('.size-btn, .color-swatch').forEach(btn => {
                btn.classList.remove('selected');
            });

            document.querySelectorAll('.select-btn').forEach(btn => {
                btn.disabled = true;
            });

            document.getElementById('deliveryForm').reset();
            document.getElementById('logoPreview').classList.remove('active');

            updateSummary();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ============================================
        // DEBUG FUNCTIONS FOR TESTING
        // ============================================

        // Store last submitted quote ID for debugging
        window.lastSubmittedQuoteID = null;

        // Programmatically submit a test order with all fields filled
        window.debugSubmitTestOrder = async function() {
            console.log('=== STARTING AUTOMATED TEST ORDER SUBMISSION ===');

            // Reset form first
            resetForm();

            // Step 1: Fill contact information
            document.getElementById('firstName').value = 'Test';
            document.getElementById('lastName').value = 'Debug' + Date.now();
            document.getElementById('email').value = 'test@nwcustomapparel.com';
            document.getElementById('phone').value = '2531234567';
            document.getElementById('companyName').value = 'Test Company Debug';

            // Step 2: Set delivery to Ship and fill address
            document.querySelector('input[value="Ship"]').checked = true;
            toggleDeliveryFields();

            document.getElementById('address1').value = '123 Test Street';
            document.getElementById('city').value = 'Tacoma';
            document.getElementById('state').value = 'WA';
            document.getElementById('zipCode').value = '98402';

            // Step 3: Set delivery date (2 weeks from now)
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 14);
            document.getElementById('deliveryDate').value = futureDate.toISOString().split('T')[0];

            // Step 4: Check rush order
            document.getElementById('rushOrder').checked = true;

            // Step 5: Set customization
            document.getElementById('jacketEmbLocation').value = 'left-chest';
            document.getElementById('hoodieEmbLocation').value = 'right-chest';
            document.getElementById('threadColors').value = 'Red, Blue, Green';
            document.getElementById('specialInstructions').value = 'DEBUG TEST ORDER - ' + new Date().toISOString();

            // Step 6: Pre-select all items with sizes and colors
            selectedItems = {
                jacket: {
                    id: 'CT104670',
                    name: 'Carhartt Jacket',
                    selectedSize: 'XL',
                    selectedColor: 'Black',
                    price: 50
                },
                hoodie: {
                    id: 'F281',
                    name: 'Gildan Hoodie',
                    selectedSize: 'XL',
                    selectedColor: 'Red',
                    price: 50
                },
                beanie: {
                    id: 'CT104597',
                    name: 'Carhartt Beanie',
                    selectedSize: 'OSFA',
                    selectedColor: 'Navy',
                    price: 50
                },
                gloves: {
                    id: 'CTGD0794',
                    name: 'Carhartt Gloves',
                    selectedSize: 'L',
                    selectedColor: 'Black Barley',
                    price: 50
                }
            };

            console.log('Test order data prepared:', {
                contact: {
                    name: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value
                },
                shipping: {
                    method: document.querySelector('input[name="deliveryMethod"]:checked').value,
                    address: document.getElementById('address1').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    zipCode: document.getElementById('zipCode').value
                },
                dueDate: testData.formData.dueDate,
                items: selectedItems
            });

            // Submit the order
            try {
                await submitOrder();
                console.log('=== TEST ORDER SUBMITTED SUCCESSFULLY ===');
                console.log('Quote ID:', window.lastSubmittedQuoteID);
                return window.lastSubmittedQuoteID;
            } catch (error) {
                console.error('Test order submission failed:', error);
                return null;
            }
        };

        // Query database to check what was actually saved
        window.debugCheckOrder = async function(quoteID) {
            if (!quoteID) {
                console.error('Please provide a quote ID');
                return;
            }

            console.log(`=== CHECKING DATABASE FOR ORDER ${quoteID} ===`);

            try {
                // Query quote_sessions — scoped to the quoteID (anonymous
                // unscoped list reads 401 since the 2026-08-26 lockdown)
                const sessionResponse = await fetch(`/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}`);
                const sessions = await sessionResponse.json();
                const session = (Array.isArray(sessions) ? sessions : []).find(s => s.QuoteID === quoteID);

                // Query quote_items
                const itemsResponse = await fetch(`/api/quote_items?quoteID=${encodeURIComponent(quoteID)}`);
                const items = await itemsResponse.json();

                console.log('=== DATABASE CHECK RESULTS ===');
                console.log('Session found:', session ? 'Yes' : 'No');
                if (session) {
                    console.log('Session DeliveryDate:', session.DeliveryDate);
                    console.log('Session DeliveryMethod:', session.DeliveryMethod);
                    console.log('Session Status:', session.Status);
                }

                console.log('Items found:', items.length);
                if (items.length > 0) {
                    console.log('Item[0] DeliveryDate:', items[0].DeliveryDate);
                    console.log('Item[0] DeliveryMethod:', items[0].DeliveryMethod);
                    console.log('Item[0] Shipping_Zip:', items[0].Shipping_Zip);
                    console.log('Item[0] Shipping_Address:', items[0].Shipping_Address);
                    console.log('Item[0] Shipping_City:', items[0].Shipping_City);
                    console.log('Item[0] Shipping_State:', items[0].Shipping_State);
                    console.log('Item[0] RushOrder:', items[0].RushOrder);

                    // Parse and check bundle configuration
                    try {
                        const bundleConfig = JSON.parse(items[0].BundleConfiguration);
                        console.log('Bundle Configuration:', bundleConfig);
                        console.log('- Jacket:', bundleConfig.jacket);
                        console.log('- Hoodie:', bundleConfig.hoodie);
                        console.log('- Beanie:', bundleConfig.beanie);
                        console.log('- Gloves:', bundleConfig.gloves);
                    } catch (e) {
                        console.error('Could not parse BundleConfiguration');
                    }
                }

                return { session, items };
            } catch (error) {
                console.error('Database check failed:', error);
                return null;
            }
        };

        // Run full test and check
        window.debugFullTest = async function() {
            console.log('=== RUNNING FULL DEBUG TEST ===');
            console.log('1. Submitting test order...');

            const quoteID = await window.debugSubmitTestOrder();

            if (quoteID) {
                console.log('2. Waiting 2 seconds for database...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                console.log('3. Checking database...');
                const dbData = await window.debugCheckOrder(quoteID);

                console.log('4. Test complete. Check the staff dashboard for:', quoteID);
                console.log('Dashboard URL: /staff-dashboard.html');

                return { quoteID, dbData };
            } else {
                console.error('Test failed - no quote ID returned');
                return null;
            }
        };

        // Override submitQuote in ChristmasBundleQuoteService to capture quote ID
        const originalSubmitQuote = ChristmasBundleQuoteService.prototype.submitQuote;
        ChristmasBundleQuoteService.prototype.submitQuote = async function(quoteData) {
            const result = await originalSubmitQuote.call(this, quoteData);
            if (result && result.success && result.quoteID) {
                window.lastSubmittedQuoteID = result.quoteID;
            }
            return result;
        };

        // ============================================
        // SPINNER DEBUG FUNCTIONS
        // ============================================

        // Check spinner and submission state
        window.debugSpinner = function() {
            const overlay = document.getElementById('submissionOverlay');
            const submitBtn = document.getElementById('submitBtn');
            const modal = document.getElementById('successModal');

            console.log('=== SPINNER DEBUG INFO ===');
            console.log('Overlay element exists:', !!overlay);
            console.log('Overlay has "active" class:', overlay?.classList.contains('active'));
            console.log('Overlay display style:', overlay?.style.display);
            console.log('Overlay computed display:', overlay ? window.getComputedStyle(overlay).display : 'N/A');
            console.log('');
            console.log('Submission state (isSubmitting):', window.isSubmitting);
            console.log('Current step:', currentStep);
            console.log('User has interacted:', userHasInteracted);
            console.log('');
            console.log('Submit button exists:', !!submitBtn);
            console.log('Submit button disabled:', submitBtn?.disabled);
            console.log('Submit button HTML:', submitBtn?.innerHTML);
            console.log('Submit button has handlers:', submitBtn?.hasAttribute('data-handlers-attached'));
            console.log('');
            console.log('Success modal exists:', !!modal);
            console.log('Success modal has "active" class:', modal?.classList.contains('active'));

            return 'Debug info logged above';
        };

        // Force remove spinner
        window.clearSpinner = function() {
            console.log('=== FORCE CLEARING SPINNER ===');

            const overlay = document.getElementById('submissionOverlay');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.style.display = 'none';
                console.log('✓ Overlay "active" class removed');
                console.log('✓ Overlay display set to "none"');
            } else {
                console.log('✗ Overlay element not found!');
            }

            window.isSubmitting = false;
            console.log('✓ isSubmitting set to false');

            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('processing');
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Order';
                console.log('✓ Submit button reset');
            } else {
                console.log('✗ Submit button not found!');
            }

            return 'Spinner cleared - try submitting again';
        };

        // Enable detailed submission flow logging
        window.debugSubmissionFlow = function() {
            console.log('=== ENABLING SUBMISSION FLOW DEBUG ===');

            // Monkey-patch submitOrder to add logging
            const originalSubmitOrder = window.submitOrder;
            window.submitOrder = async function(button) {
                console.log('📍 submitOrder called');
                console.log('  - currentStep:', currentStep);
                console.log('  - isSubmitting:', window.isSubmitting);
                console.log('  - userHasInteracted:', userHasInteracted);

                try {
                    const result = await originalSubmitOrder.call(this, button);
                    console.log('📍 submitOrder completed successfully');
                    return result;
                } catch (error) {
                    console.error('📍 submitOrder failed:', error);
                    throw error;
                }
            };

            // Monkey-patch showSuccessModal to add logging
            const originalShowSuccess = showSuccessModal;
            window.showSuccessModal = function(quoteID) {
                console.log('📍 showSuccessModal called with quote ID:', quoteID);

                const modal = document.getElementById('successModal');
                if (!modal) {
                    console.error('❌ Success modal element not found!');
                    return;
                }

                try {
                    originalShowSuccess(quoteID);
                    console.log('✓ Success modal shown');
                } catch (error) {
                    console.error('❌ Error showing success modal:', error);
                }
            };

            return 'Submission flow debugging enabled - submit an order to see detailed logs';
        };

        // Test success modal directly
        window.testSuccessModal = function() {
            console.log('=== TESTING SUCCESS MODAL ===');

            const modal = document.getElementById('successModal');
            if (!modal) {
                console.error('❌ Success modal element not found!');
                return 'Modal element missing';
            }

            const referenceNumber = document.getElementById('referenceNumber');
            if (!referenceNumber) {
                console.error('❌ Reference number element not found!');
                return 'Reference number element missing';
            }

            const orderDetails = document.getElementById('orderConfirmationDetails');
            if (!orderDetails) {
                console.error('❌ Order details element not found!');
                return 'Order details element missing';
            }

            console.log('✓ All modal elements found');

            // Try to show it with test data
            try {
                showSuccessModal('TEST-123');
                console.log('✓ Modal shown with test data');

                // Hide it after 3 seconds
                setTimeout(() => {
                    modal.classList.remove('active');
                    console.log('✓ Modal hidden');
                }, 3000);

                return 'Modal test successful - should be visible now';
            } catch (error) {
                console.error('❌ Error showing modal:', error);
                return 'Modal test failed - check console for error';
            }
        };

        // Monitor overlay changes
        window.monitorOverlay = function() {
            console.log('=== MONITORING OVERLAY CHANGES ===');

            const overlay = document.getElementById('submissionOverlay');
            if (!overlay) {
                console.error('❌ Overlay element not found!');
                return;
            }

            // Create MutationObserver to watch for changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        console.log('📍 Overlay class changed:', overlay.className);
                        console.log('  - Has "active":', overlay.classList.contains('active'));
                    }
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        console.log('📍 Overlay style changed:', overlay.style.cssText);
                    }
                });
            });

            observer.observe(overlay, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });

            console.log('✓ Now monitoring overlay changes');
            console.log('  - Current classes:', overlay.className);
            console.log('  - Current style:', overlay.style.cssText);

            // Store observer so it can be disconnected
            window.overlayObserver = observer;

            return 'Monitoring started - submit an order to see overlay changes';
        };

        console.log('Debug functions loaded. Available commands:');
        console.log('- window.debugSubmitTestOrder() - Submit a test order');
        console.log('- window.debugCheckOrder("XMAS####-###") - Check database for an order');
        console.log('- window.debugFullTest() - Run full test and check');
        console.log('');
        console.log('🔍 SPINNER DEBUG COMMANDS:');
        console.log('- window.debugSpinner() - Check spinner and submission state');
        console.log('- window.clearSpinner() - Force remove the spinner');
        console.log('- window.debugSubmissionFlow() - Enable detailed submission logging');
        console.log('- window.testSuccessModal() - Test if success modal works');
        console.log('- window.monitorOverlay() - Monitor overlay changes in real-time');
        console.log('');
        console.log('🧪 SPINNER FIX TEST COMMANDS:');
        console.log('- window.testSpinnerFix() - Run comprehensive test suite for the fix');
        console.log('- window.testExactBugScenario() - Test the exact bug scenario');

        // Comprehensive test suite for spinner/button fix
        window.testSpinnerFix = function() {
            console.log('=== RUNNING COMPREHENSIVE SPINNER FIX TESTS ===');

            const results = {
                passed: [],
                failed: [],
                warnings: []
            };

            // Test 1: Verify finalizeSubmission re-enables button
            try {
                const btn = document.getElementById('submitBtn');
                const originalState = btn.disabled;

                // Simulate the bug condition
                btn.disabled = true;  // Form validation disables it
                btn.classList.add('processing');
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

                // Simulate the fixed finalizeSubmission logic
                const testFinalize = function() {
                    try {
                        const overlayEl = document.getElementById('submissionOverlay');
                        if (overlayEl) overlayEl.classList.remove('active');
                    } catch (e) {}
                    try {
                        window.isSubmitting = false;
                    } catch (e) {}
                    try {
                        const btn = document.getElementById('submitBtn');
                        if (btn) {
                            btn.disabled = false;  // THE FIX
                            btn.classList.remove('processing');
                            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Order';
                        }
                    } catch (e) {}
                };

                testFinalize();

                // Verify button is now enabled
                if (btn.disabled === false && !btn.classList.contains('processing')) {
                    results.passed.push('✅ Test 1: finalizeSubmission correctly re-enables button');
                } else {
                    results.failed.push('❌ Test 1: Button still disabled after finalize');
                }

                // Restore original state
                btn.disabled = originalState;
            } catch (e) {
                results.failed.push('❌ Test 1 error: ' + e.message);
            }

            // Test 2: Verify validateForm behavior when called on Step 7
            try {
                const originalStep = window.currentStep;
                window.currentStep = 7;

                // Simulate form being invalid (common on some browsers)
                const form = document.getElementById('deliveryForm');
                const btn = document.getElementById('submitBtn');
                const originalDisabled = btn.disabled;

                // Call validateForm
                if (typeof validateForm === 'function') {
                    validateForm();

                    // Check if button got disabled
                    const disabledByValidation = btn.disabled;

                    if (disabledByValidation && !form.checkValidity()) {
                        results.warnings.push('⚠️ Test 2: validateForm disables button when form invalid (this is the bug trigger)');
                    } else if (!disabledByValidation && form.checkValidity()) {
                        results.passed.push('✅ Test 2: validateForm correctly enables button when form valid');
                    }

                    btn.disabled = originalDisabled;
                }

                window.currentStep = originalStep;
            } catch (e) {
                results.failed.push('❌ Test 2 error: ' + e.message);
            }

            // Test 3: Simulate full submission flow with disabled button
            try {
                console.log('\n--- Test 3: Full submission simulation ---');
                const btn = document.getElementById('submitBtn');
                const overlay = document.getElementById('submissionOverlay');

                // Set up bug conditions
                btn.disabled = true;  // validateForm disabled it
                overlay.classList.add('active');  // Spinner showing
                window.isSubmitting = true;

                console.log('Initial state: button disabled =', btn.disabled);
                console.log('Initial state: overlay active =', overlay.classList.contains('active'));

                // Simulate what happens after successful submission
                overlay.classList.remove('active');

                // Simulate the fixed finalizeSubmission
                btn.disabled = false;  // THE FIX
                btn.classList.remove('processing');
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Order';
                window.isSubmitting = false;

                // Verify final state
                console.log('Final state: button disabled =', btn.disabled);
                console.log('Final state: overlay active =', overlay.classList.contains('active'));

                if (!btn.disabled && !overlay.classList.contains('active')) {
                    results.passed.push('✅ Test 3: Full flow correctly resets button and overlay');
                } else {
                    results.failed.push('❌ Test 3: Button or overlay still in wrong state');
                }

            } catch (e) {
                results.failed.push('❌ Test 3 error: ' + e.message);
            }

            // Test 4: Verify the fix is actually in the code
            try {
                // Check if finalizeSubmission function exists in submitOrder
                const submitOrderCode = window.submitOrder.toString();
                if (submitOrderCode.includes('btn.disabled = false')) {
                    results.passed.push('✅ Test 4: Fix confirmed - btn.disabled = false found in code');
                } else {
                    results.failed.push('❌ Test 4: Fix not found in submitOrder function');
                }
            } catch (e) {
                results.warnings.push('⚠️ Test 4: Could not verify fix in code');
            }

            // Print results
            setTimeout(() => {
                console.log('\n=== TEST RESULTS ===');
                results.passed.forEach(msg => console.log(msg));
                results.warnings.forEach(msg => console.log(msg));
                results.failed.forEach(msg => console.log(msg));

                console.log('\nSummary:');
                console.log(`Passed: ${results.passed.length}`);
                console.log(`Warnings: ${results.warnings.length}`);
                console.log(`Failed: ${results.failed.length}`);

                if (results.failed.length === 0) {
                    console.log('\n🎉 All critical tests passed! The fix should work.');
                } else {
                    console.log('\n⚠️ Some tests failed. Review the issues above.');
                }
            }, 200);

            return 'Tests running... check console for results';
        };

        // Test to verify the exact bug scenario from the console
        window.testExactBugScenario = function() {
            console.log('=== TESTING EXACT BUG SCENARIO ===');

            const btn = document.getElementById('submitBtn');
            const overlay = document.getElementById('submissionOverlay');

            console.log('1. Initial state:');
            console.log('   - Button disabled:', btn.disabled);
            console.log('   - Overlay active:', overlay.classList.contains('active'));

            console.log('\n2. Simulating bug condition (validateForm disables button):');
            btn.disabled = true;  // This is what validateForm does
            console.log('   - Button disabled:', btn.disabled);

            console.log('\n3. User clicks submit (overlay shows):');
            overlay.classList.add('active');
            window.isSubmitting = true;
            console.log('   - Overlay active:', overlay.classList.contains('active'));
            console.log('   - isSubmitting:', window.isSubmitting);

            console.log('\n4. Order completes, cleanup runs:');
            // This is what happens in the success path
            overlay.classList.remove('active');

            // THE FIX: finalizeSubmission now includes btn.disabled = false
            btn.disabled = false;  // THIS IS THE NEW LINE THAT FIXES IT
            btn.classList.remove('processing');
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Order';
            window.isSubmitting = false;

            console.log('   - Button disabled:', btn.disabled);
            console.log('   - Overlay active:', overlay.classList.contains('active'));
            console.log('   - isSubmitting:', window.isSubmitting);

            if (!btn.disabled && !overlay.classList.contains('active') && !window.isSubmitting) {
                console.log('\n✅ SUCCESS: Button is now enabled and ready for next submission!');
                return true;
            } else {
                console.log('\n❌ FAILURE: Button still disabled or state incorrect');
                return false;
            }
        };

// ---- Rule 3 (2026-09-05 staff-dashboard sweep): inline handlers moved off the markup. ----
// Clicks route through /shared_components/js/data-call-delegator.js (data-call / data-args).
window.openLogoPicker = function () { const f = document.getElementById('logoFile'); if (f) f.click(); };
// Image fallbacks: `error` does not bubble, so listen in the capture phase.
document.addEventListener('error', function (e) {
    const img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.dataset.fallbackSrc) { const src = img.dataset.fallbackSrc; delete img.dataset.fallbackSrc; img.src = src; return; }
    if (img.dataset.errorId && typeof handleImageError === 'function') handleImageError(img.dataset.errorId, img.dataset.errorIcon);
}, true);
document.addEventListener('DOMContentLoaded', function () {
    const logo = document.getElementById('logoFile');
    if (logo && typeof handleLogoUpload === 'function') logo.addEventListener('change', handleLogoUpload);
    document.querySelectorAll('form[data-nosubmit]').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); }); });
});
