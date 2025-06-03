/**
 * Mobile Collapsible Ultimate Fix
 * Complete overhaul to ensure mobile accordion functionality works
 */

(function() {
    'use strict';

    console.log('[ULTIMATE-FIX] Starting ultimate mobile collapsible fix...');

    // Wait for page to fully load
    window.addEventListener('load', function() {
        setTimeout(initializeUltimateFix, 2000);
    });

    function initializeUltimateFix() {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            console.log('[ULTIMATE-FIX] Not mobile, skipping');
            return;
        }

        console.log('[ULTIMATE-FIX] Mobile detected, applying ultimate fix...');

        // Remove any existing wrappers from previous attempts
        document.querySelectorAll('.simple-collapsible-wrapper, .collapsible-section').forEach(el => {
            const content = el.querySelector('.content-card, [id$="-info"], [id$="-details"], [id$="-builder"], [id="customization"]');
            if (content && el.parentNode) {
                el.parentNode.insertBefore(content, el);
                el.remove();
            }
        });

        // Define sections
        const sections = [
            { id: 'product-info', title: '🧢 Product Information', open: true },
            { id: 'customization', title: '🎨 Customization Options', open: true },
            { id: 'pricing-details', title: '💰 Pricing Details', open: false },
            { id: 'quote-builder', title: '📋 Quote Builder', open: false }
        ];

        // Process each section
        sections.forEach((section, index) => {
            const element = document.getElementById(section.id);
            if (!element) {
                console.warn('[ULTIMATE-FIX] Section not found:', section.id);
                return;
            }

            console.log('[ULTIMATE-FIX] Processing section:', section.id);

            // Create new accordion item
            const accordionItem = document.createElement('div');
            accordionItem.className = 'ultimate-accordion-item';
            accordionItem.setAttribute('data-section-id', section.id);

            // Create header
            const header = document.createElement('button');
            header.className = 'ultimate-accordion-header';
            header.setAttribute('aria-expanded', section.open ? 'true' : 'false');
            header.innerHTML = `
                <span class="ultimate-title">${section.title}</span>
                <span class="ultimate-icon">${section.open ? '−' : '+'}</span>
            `;

            // Create content wrapper
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'ultimate-accordion-content';
            if (section.open) {
                contentWrapper.classList.add('ultimate-open');
            }

            // Move original element into wrapper
            element.parentNode.insertBefore(accordionItem, element);
            contentWrapper.appendChild(element);
            accordionItem.appendChild(header);
            accordionItem.appendChild(contentWrapper);

            // Make all content visible
            makeContentVisible(element);

            // Add click handler
            header.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleAccordion(accordionItem, header, contentWrapper);
            });
        });

        // Add styles
        addUltimateStyles();

        console.log('[ULTIMATE-FIX] Ultimate fix applied successfully');
    }

    function toggleAccordion(item, header, content) {
        const isOpen = content.classList.contains('ultimate-open');
        console.log('[ULTIMATE-FIX] Toggling accordion, currently open:', isOpen);

        if (isOpen) {
            // Close
            content.classList.remove('ultimate-open');
            header.setAttribute('aria-expanded', 'false');
            header.querySelector('.ultimate-icon').textContent = '+';
            content.style.maxHeight = '0';
        } else {
            // Open
            content.classList.add('ultimate-open');
            header.setAttribute('aria-expanded', 'true');
            header.querySelector('.ultimate-icon').textContent = '−';
            
            // Calculate and set height
            content.style.maxHeight = 'none';
            const height = content.scrollHeight;
            content.style.maxHeight = '0';
            content.offsetHeight; // Force reflow
            content.style.maxHeight = height + 'px';

            // After animation, set to none for dynamic content
            setTimeout(() => {
                if (content.classList.contains('ultimate-open')) {
                    content.style.maxHeight = 'none';
                }
            }, 300);
        }
    }

    function makeContentVisible(element) {
        // Force all child elements to be visible
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            // Skip elements that should stay hidden
            if (el.classList.contains('hidden') || 
                el.classList.contains('loading-spinner') ||
                el.style.display === 'none' && !el.id) {
                return;
            }

            // Remove any hiding styles
            el.style.removeProperty('display');
            el.style.removeProperty('visibility');
            el.style.removeProperty('opacity');
        });

        // Specific fixes for known elements
        const fixes = {
            '#product-image-main': { display: 'block', maxWidth: '100%', height: 'auto' },
            '.color-grid': { display: 'grid' },
            '.pricing-table': { display: 'table' },
            '.form-section': { display: 'block' },
            '#color-swatches': { display: 'grid' }
        };

        Object.entries(fixes).forEach(([selector, styles]) => {
            const elements = element.querySelectorAll(selector);
            elements.forEach(el => {
                Object.assign(el.style, styles);
            });
        });
    }

    function addUltimateStyles() {
        const styleId = 'ultimate-accordion-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Ultimate Accordion Styles - Mobile Only */
            @media (max-width: 768px) {
                .ultimate-accordion-item {
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    overflow: hidden;
                    background: white;
                }

                .ultimate-accordion-header {
                    width: 100%;
                    padding: 16px;
                    background: #f8f9fa;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 16px;
                    font-weight: 600;
                    text-align: left;
                    transition: background 0.2s;
                    -webkit-tap-highlight-color: transparent;
                }

                .ultimate-accordion-header:active {
                    background: #e9ecef;
                }

                .ultimate-title {
                    flex: 1;
                }

                .ultimate-icon {
                    font-size: 24px;
                    font-weight: 300;
                    color: #666;
                    width: 30px;
                    text-align: center;
                }

                .ultimate-accordion-content {
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    max-height: 0;
                }

                .ultimate-accordion-content.ultimate-open {
                    overflow: visible;
                }

                /* Force content visibility */
                .ultimate-accordion-content .content-card {
                    display: block !important;
                    box-shadow: none !important;
                    margin: 0 !important;
                    border: none !important;
                }

                .ultimate-accordion-content .card-header {
                    display: none !important;
                }

                .ultimate-accordion-content .card-content {
                    padding: 16px !important;
                    display: block !important;
                }

                /* Force all content to show */
                .ultimate-accordion-content * {
                    visibility: visible !important;
                    opacity: 1 !important;
                }

                /* Fix specific elements */
                .ultimate-accordion-content img {
                    display: block !important;
                    max-width: 100% !important;
                    height: auto !important;
                }

                .ultimate-accordion-content .color-grid,
                .ultimate-accordion-content #color-swatches {
                    display: grid !important;
                    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important;
                    gap: 10px !important;
                }

                .ultimate-accordion-content .pricing-table {
                    display: table !important;
                    width: 100% !important;
                }

                .ultimate-accordion-content table,
                .ultimate-accordion-content tbody,
                .ultimate-accordion-content thead,
                .ultimate-accordion-content tr,
                .ultimate-accordion-content th,
                .ultimate-accordion-content td {
                    display: revert !important;
                }

                .ultimate-accordion-content select,
                .ultimate-accordion-content input,
                .ultimate-accordion-content button {
                    display: revert !important;
                }

                /* Ensure hidden things stay hidden */
                .ultimate-accordion-content .hidden,
                .ultimate-accordion-content [style*="display: none"]:not([id]) {
                    display: none !important;
                }
            }

            /* Desktop - Remove accordion */
            @media (min-width: 769px) {
                .ultimate-accordion-item {
                    display: contents;
                }

                .ultimate-accordion-header {
                    display: none;
                }

                .ultimate-accordion-content {
                    max-height: none !important;
                    overflow: visible !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const isMobile = window.innerWidth <= 768;
            const hasAccordion = document.querySelector('.ultimate-accordion-item');
            
            if (!isMobile && hasAccordion) {
                // Remove accordion on desktop
                document.querySelectorAll('.ultimate-accordion-item').forEach(item => {
                    const content = item.querySelector('.content-card, [id]');
                    if (content && item.parentNode) {
                        item.parentNode.insertBefore(content, item);
                        item.remove();
                    }
                });
            } else if (isMobile && !hasAccordion) {
                // Re-initialize on mobile
                initializeUltimateFix();
            }
        }, 250);
    });

})();