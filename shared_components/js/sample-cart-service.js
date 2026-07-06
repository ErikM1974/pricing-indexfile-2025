/**
 * Sample Cart Service — shared sample-program engine
 *
 * Extracted from the retired pages/top-sellers-showcase.html inline script
 * (2026-07-06) so any page can offer "Request a sample" through one code path.
 * Used by: /catalog (top-sellers view via catalog-samples.js), product.html,
 * cart-drawer.js (reads window.sampleCart), pages/sample-cart.html checkout
 * (shares the same sessionStorage cart).
 *
 * Responsibilities: sample eligibility + pricing (API-driven, never hardcoded),
 * color/size variants, cart CRUD persisted in sessionStorage('sampleCart'),
 * live-inventory gate on add, toast notifications. Rendering of per-card
 * buttons belongs to the page module, not here.
 *
 * Pricing rule: blank min price < $10 → FREE sample; otherwise
 * minPrice / MarginDenominator (Caspio BLANK tier 1 — NEVER hardcoded; a stale
 * 0.57 literal here once drifted from Caspio's 0.53) rounded UP to the half
 * dollar. Margin unavailable → NOT eligible (visible absence, never a guess).
 */
(function () {
    'use strict';

    var FA_HREF = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

    function apiBase() {
        return (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) ||
            'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /** Lazy-load Font Awesome (drawer + toast icons) on pages that skip it. */
    function ensureIcons() {
        if (document.querySelector('link[href*="font-awesome"]')) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = FA_HREF;
        document.head.appendChild(link);
    }

    var SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

    class SampleCart {
        constructor() {
            this.samples = this.loadCart();
            this.eligibilityCache = {};
            this.variantsCache = {};
            this.apiBase = apiBase();
        }

        /** sessionStorage load with backward compatibility ({samples:[]} or bare []). */
        loadCart() {
            try {
                var parsed = JSON.parse(sessionStorage.getItem('sampleCart') || 'null');
                if (Array.isArray(parsed)) return parsed;
                if (parsed && Array.isArray(parsed.samples)) return parsed.samples;
            } catch (e) {
                console.error('[SampleCart] Error parsing cart data:', e);
            }
            return [];
        }

        save() {
            // Structured format expected by pages/sample-cart.html checkout
            sessionStorage.setItem('sampleCart', JSON.stringify({
                samples: this.samples,
                updatedAt: new Date().toISOString()
            }));
        }

        get count() { return this.samples.length; }

        has(styleNumber) {
            return this.samples.some(function (s) { return s.style === styleNumber; });
        }

        /**
         * Eligibility + sample price for a style (light: no variant fetches).
         * → { eligible, type:'free'|'paid', price, minCost } or { eligible:false, reason }
         */
        async checkEligibility(styleNumber) {
            if (this.eligibilityCache[styleNumber] !== undefined) {
                return this.eligibilityCache[styleNumber];
            }
            var result;
            try {
                var response = await fetch(this.apiBase + '/api/size-pricing?styleNumber=' + encodeURIComponent(styleNumber));
                var data = response.ok ? await response.json() : null;
                if (!data || data.error || !data.length) {
                    result = { eligible: false, reason: 'not_sanmar' };
                } else {
                    var prices = (data[0] && data[0].basePrices) || {};
                    var priceValues = Object.values(prices).filter(function (p) { return p > 0; });
                    if (!priceValues.length) {
                        result = { eligible: false, reason: 'no_pricing' };
                    } else {
                        var minPrice = Math.min.apply(Math, priceValues);
                        if (minPrice < 10) {
                            result = { eligible: true, type: 'free', price: 0, minCost: minPrice };
                        } else {
                            result = await this.pricePaidSample(styleNumber, minPrice);
                        }
                    }
                }
            } catch (error) {
                console.error('[SampleCart] Eligibility check failed for ' + styleNumber + ':', error);
                result = { eligible: false, reason: 'api_error' };
            }
            this.eligibilityCache[styleNumber] = result;
            return result;
        }

        /** Paid-sample price = minCost / Caspio BLANK MarginDenominator, half-dollar ceiling. */
        async pricePaidSample(styleNumber, minPrice) {
            var bundleResp = await fetch(this.apiBase + '/api/pricing-bundle?method=BLANK&styleNumber=' + encodeURIComponent(styleNumber));
            if (!bundleResp.ok) return { eligible: false, reason: 'api_error' };
            var bundle = await bundleResp.json();
            var blankTiers = bundle.tiersR || [];
            var tier1 = blankTiers.find(function (t) {
                return Number(t.MinQuantity) <= 1 && Number(t.MaxQuantity) >= 1;
            }) || blankTiers[0];
            var marginDenominator = parseFloat(tier1 && tier1.MarginDenominator);
            if (!marginDenominator || marginDenominator <= 0 || marginDenominator >= 1) {
                return { eligible: false, reason: 'no_margin' };
            }
            var samplePrice = Math.ceil((minPrice / marginDenominator) * 2) / 2;
            return { eligible: true, type: 'paid', price: samplePrice, minCost: minPrice };
        }

        /**
         * Colors + sizes for the drawer picker (fetched on demand, not per card).
         * Colors carry catalogColor (CATALOG_COLOR — required for ShopWorks) and
         * swatchUrl. → { colors:[{name,catalogColor,swatchUrl}], sizes:[] }
         */
        async getVariants(styleNumber) {
            if (this.variantsCache[styleNumber]) return this.variantsCache[styleNumber];

            var base = this.apiBase;
            var sizePricingReq = fetch(base + '/api/size-pricing?styleNumber=' + encodeURIComponent(styleNumber))
                .then(function (r) { return r.ok ? r.json() : []; });
            var swatchesReq = fetch(base + '/api/color-swatches?styleNumber=' + encodeURIComponent(styleNumber))
                .then(function (r) { return r.ok ? r.json() : []; })
                .catch(function () { return []; });

            var settled = await Promise.all([sizePricingReq, swatchesReq]);
            var data = settled[0] || [];
            var swatches = settled[1] || [];

            var colorNames = new Set();
            var sizesSet = new Set();
            data.forEach(function (item) {
                if (item.color) colorNames.add(item.color);
                Object.keys(item.basePrices || {}).forEach(function (size) { sizesSet.add(size); });
            });

            var colors = swatches.map(function (swatch) {
                return {
                    name: swatch.COLOR_NAME,          // display name
                    catalogColor: swatch.CATALOG_COLOR, // ShopWorks / inventory name
                    swatchUrl: swatch.COLOR_SQUARE_IMAGE
                };
            }).filter(function (color) { return colorNames.has(color.name); });
            if (!colors.length) {
                // Swatch API empty/down — fall back to display names (visible degradation:
                // gray swatches; catalogColor falls back to the display name)
                colors = Array.from(colorNames).map(function (name) {
                    return { name: name, catalogColor: name, swatchUrl: null };
                });
            }

            var sizes = Array.from(sizesSet).sort(function (a, b) {
                var ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
                if (ai !== -1 && bi !== -1) return ai - bi;
                if (ai !== -1) return -1;
                if (bi !== -1) return 1;
                return String(a).localeCompare(String(b));
            });

            var variants = { colors: colors, sizes: sizes };
            this.variantsCache[styleNumber] = variants;
            return variants;
        }

        /**
         * Add a sample (one per style). Checks live inventory first when the
         * inventory service is present — out of stock blocks the add.
         * → true when added.
         */
        async addSample(product) {
            if (this.has(product.style)) {
                this.showNotification('This item is already in your sample cart', 'info');
                return false;
            }

            if (window.sampleInventoryService && product.catalogColor && product.size) {
                try {
                    var availability = await window.sampleInventoryService.checkSizeAvailability(
                        product.style, product.catalogColor, product.size, 1);
                    if (!availability.available) {
                        this.showNotification(
                            product.name + ' (' + product.color + ') — size ' + product.size + ' is currently out of stock',
                            'warning');
                        return false;
                    }
                    if (availability.dataUnavailable) {
                        this.showNotification('Added — we’ll confirm stock when we process your request', 'info');
                    }
                    if (availability.isLowStock) {
                        this.showNotification('Added to cart (only ' + availability.qtyInStock + ' left in stock)', 'warning');
                    }
                } catch (error) {
                    // Inventory check is best-effort; the add still goes through
                    console.error('[SampleCart] Inventory check failed:', error);
                }
            }

            var type = product.type || 'free';
            var sizes = {};
            if (product.size) sizes[product.size] = 1;
            this.samples.push({
                style: product.style,
                name: product.name,
                description: product.description || '',
                imageUrl: product.imageUrl || '',
                color: product.color || '',
                colorCode: product.colorCode || '',
                catalogColor: product.catalogColor || product.color || '',
                size: product.size || '',   // singular — drawer display
                sizes: sizes,               // {size: qty} map — sample-cart.html checkout contract
                price: product.price || 0,
                type: type,                 // legacy field name
                sampleType: type,           // sample-cart.html pricing reads this one
                addedAt: new Date().toISOString()
            });
            this.save();
            this.updateUI();

            this.showNotification(product.type === 'paid'
                ? product.name + ' added — $' + Number(product.price).toFixed(2) + ' sample'
                : product.name + ' added — FREE sample', 'success');
            return true;
        }

        /** Remove by style number (string) or index (number). → true when removed. */
        removeSample(styleNumberOrIndex) {
            var index = typeof styleNumberOrIndex === 'number'
                ? styleNumberOrIndex
                : this.samples.findIndex(function (s) { return s.style === styleNumberOrIndex; });
            if (index < 0 || index >= this.samples.length) return false;
            var removed = this.samples.splice(index, 1)[0];
            this.save();
            this.updateUI();
            this.showNotification(removed.name + ' removed from samples', 'info');
            return true;
        }

        clearCart() {
            this.samples = [];
            this.save();
            this.updateUI();
        }

        /** Broadcast a cart change: legacy header count + 'cartUpdated' event. */
        updateUI() {
            if (window.universalCartHeader) window.universalCartHeader.updateCartCount();
            window.dispatchEvent(new CustomEvent('cartUpdated'));
        }

        showNotification(message, type) {
            ensureIcons();
            type = type || 'info';
            var icon = type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle';
            var toast = document.createElement('div');
            toast.className = 'drawer-toast drawer-toast-' + type;
            var text = document.createElement('span');
            text.textContent = message;
            toast.innerHTML = '<i class="fas fa-' + icon + '" aria-hidden="true"></i>';
            toast.appendChild(text);
            document.body.appendChild(toast);
            setTimeout(function () { toast.classList.add('show'); }, 10);
            setTimeout(function () {
                toast.classList.remove('show');
                setTimeout(function () { toast.remove(); }, 300);
            }, 3000);
        }

        getCartSummary() {
            return { items: this.samples, count: this.samples.length };
        }
    }

    window.SampleCartService = SampleCart;
    window.sampleCartEnsureIcons = ensureIcons;

    function boot() {
        if (!window.sampleCart) window.sampleCart = new SampleCart();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
