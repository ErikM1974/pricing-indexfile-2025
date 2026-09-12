/* Christmas gift boxes: one controller owns selection, navigation and submission. */
'use strict';
const RETAIL_PRICES = {
    jackets: {
        CT100617: 92, // Rain Defender
        CT103828: 137, // Detroit (Duck Detroit Jacket)
        CT104670: 174, // Storm Defender (Shoreline Jacket)
    },
    hoodies: 58,
    beanies: 35,
    gloves: 19,
    giftBox: 9,
    shipping: 25,
};

const PRODUCT_STYLES = {
    jackets: ['CT104670', 'CT100617', 'CT103828'],
    hoodies: ['CTK121', 'F281'],
    beanies: ['CT104597'],
    gloves: ['CTGD0794'],
};

function calculateItemValue(styleNumber, size, basePrice) {
    const upcharges = sizeUpchargeCache[styleNumber] || {};
    const upcharge = upcharges[size] || 0;
    return basePrice + upcharge;
}

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
    total += RETAIL_PRICES.giftBox || 9; // Gift box
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
const CB_API_BASE = window.APP_CONFIG?.API?.BASE_URL || '';
const CAMPAIGN_DEADLINE = new Date('2026-10-24T12:00:00-08:00').getTime();
const products = { jackets: [], hoodies: [], beanies: [], gloves: [] };
const sizeUpchargeCache = {};
let selectedItems = { jacket: null, hoodie: null, beanie: null, gloves: null };
let currentStep = 1;
let highestStepReached = 1;
let bonusShown = false;
let submitting = false;
let selectedLogoFile = null;
let selectedLogoDataURL = '';
let logoRead = 0;
let pendingOrder = null;
let orderService = null;
let lastSuccess = null;
let modalOpener = null;
const choices = new Map();
const types = ['jacket', 'hoodie', 'beanie', 'gloves'];
const categories = {
    jacket: 'jackets',
    hoodie: 'hoodies',
    beanie: 'beanies',
    gloves: 'gloves',
};
const el = (id) => document.getElementById(id);
const money = (value) => '$' + Number(value).toFixed(2);
const escapeHtml = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c],
    );
const hide = (node, hidden) => {
    if (node) {
        node.hidden = hidden;
        node.classList.toggle('hidden', hidden);
    }
};
const imageUrl = (value) => {
    try {
        const url = new URL(String(value || ''), location.origin);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
};
const dataArgs = (values) => escapeHtml(JSON.stringify(values));
const productFor = (id) =>
    Object.values(products)
        .flat()
        .find((p) => p.id === id);
const typeFor = (id) =>
    types.find((type) => products[categories[type]].some((p) => p.id === id));

function showErrorBanner(message) {
    const banner = el('giftBoxError');
    banner.querySelector('span').textContent = message;
    hide(banner, false);
    banner.focus();
}
function clearError() {
    hide(el('giftBoxError'), true);
}
async function fetchJson(url, signal) {
    const response = await fetch(url, {
        signal: signal || AbortSignal.timeout(20000),
    });
    if (!response.ok)
        throw new Error('Request failed (HTTP ' + response.status + ').');
    return response.json();
}
function updateCountdown() {
    const remaining = Math.max(0, CAMPAIGN_DEADLINE - Date.now());
    const values = [
        Math.floor(remaining / 86400000),
        Math.floor(remaining / 3600000) % 24,
        Math.floor(remaining / 60000) % 60,
        Math.floor(remaining / 1000) % 60,
    ];
    ['days', 'hours', 'minutes', 'seconds'].forEach((id, index) => {
        el(id).textContent = String(values[index]).padStart(2, '0');
    });
    document.querySelector('.countdown-message').textContent = remaining
        ? 'Free gift-box offer ends October 24, 2026 at 12:00 PM PST.'
        : 'This offer has ended. Contact sales for current promotions.';
    document.body.classList.toggle('cb-ended', !remaining);
}
function baseValue(type, id) {
    return type === 'jacket'
        ? RETAIL_PRICES.jackets[id]
        : RETAIL_PRICES[categories[type]];
}

async function loadChristmasProducts() {
    if (submitting) return;
    clearError();
    choices.forEach((choice) => choice.controller?.abort());
    choices.clear();
    selectedItems = { jacket: null, hoodie: null, beanie: null, gloves: null };
    highestStepReached = 1;
    bonusShown = false;
    showStep(1, false);
    el('retryChristmasProducts').disabled = true;
    let failures = 0;
    await Promise.all(
        Object.entries(PRODUCT_STYLES).map(async ([category, styles]) => {
            const entries = await Promise.all(
                styles.map(async (id) => {
                    try {
                        if (!CB_API_BASE)
                            throw new Error('Product service is unavailable.');
                        const [data, prices] = await Promise.all([
                            fetchJson(
                                '/api/product-colors?styleNumber=' +
                                    encodeURIComponent(id),
                            ),
                            fetchJson(
                                CB_API_BASE +
                                    '/api/size-pricing?styleNumber=' +
                                    encodeURIComponent(id),
                            ),
                        ]);
                        if (!Array.isArray(data.colors) || !data.colors.length)
                            throw new Error('No product colors returned.');
                        if (!Array.isArray(prices) || !prices[0]?.sizeUpcharges)
                            throw new Error(
                                'Size value adjustments are unavailable.',
                            );
                        sizeUpchargeCache[id] = prices[0].sizeUpcharges;
                        // Keep the existing campaign's excluded color; do not invent stock.
                        const colors = data.colors.filter(
                            (color) =>
                                !(
                                    id === 'CTK121' &&
                                    String(
                                        color.COLOR_NAME || color.CATALOG_COLOR,
                                    )
                                        .toLowerCase()
                                        .includes('dark brown')
                                ),
                        );
                        if (!colors.length)
                            throw new Error(
                                'No campaign colors are currently available.',
                            );
                        const type = types.find(
                            (type) => categories[type] === category,
                        );
                        return {
                            id,
                            type,
                            name: (data.productTitle || 'Style ' + id)
                                .split('.')[0]
                                .trim(),
                            description:
                                data.PRODUCT_DESCRIPTION ||
                                data.description ||
                                '',
                            colors,
                            retailPrice: baseValue(type, id),
                            price: 'FREE',
                            image:
                                colors[0].MAIN_IMAGE_URL ||
                                colors[0].FRONT_MODEL ||
                                colors[0].FRONT_FLAT ||
                                '',
                        };
                    } catch (error) {
                        failures++;
                        return {
                            id,
                            type: types.find(
                                (type) => categories[type] === category,
                            ),
                            error: error.message,
                        };
                    }
                }),
            );
            products[category] = entries;
        }),
    );
    renderProducts();
    hide(el('retryChristmasProducts'), !failures);
    el('retryChristmasProducts').disabled = false;
    if (failures)
        showErrorBanner(
            'Some gift-box products could not load. Retry the catalog to see current options.',
        );
    updateSummary();
    updateContinueButtons();
}
function renderProducts() {
    for (const type of types) {
        const grid = el(type + 'Grid');
        grid.replaceChildren();
        for (const product of products[categories[type]])
            grid.append(createProductCard(product, type));
    }
}
function createProductCard(product, type) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.productId = product.id;
    card.dataset.productType = type;
    if (product.error) {
        card.innerHTML =
            '<h3>' +
            escapeHtml(product.id) +
            '</h3><p class="product-error">Product options are unavailable. Retry the catalog.</p>';
        return card;
    }
    const image = imageUrl(product.image);
    card.innerHTML =
        '<button type="button" class="product-image" aria-label="Enlarge ' +
        escapeHtml(product.name) +
        '" data-call="openZoomModal" data-args="' +
        dataArgs([image]) +
        '">' +
        (image
            ? '<img src="' +
              escapeHtml(image) +
              '" alt="' +
              escapeHtml(product.name) +
              '" loading="lazy">'
            : '<span>Image unavailable</span>') +
        '</button>' +
        '<div class="product-info"><p class="product-style">' +
        escapeHtml(product.id) +
        '</p><h3 class="product-name">' +
        escapeHtml(product.name) +
        '</h3>' +
        '<div class="product-price"><span class="retail-value">' +
        money(product.retailPrice) +
        ' value</span><span class="free-badge">FREE!</span></div>' +
        '<details class="product-description"><summary>Product details</summary><p>' +
        escapeHtml(product.description) +
        '</p></details>' +
        '<fieldset class="selection-group"><legend>Select color</legend><div class="color-grid color-swatches">' +
        product.colors
            .map((color) => {
                const name = color.COLOR_NAME || color.CATALOG_COLOR,
                    code = color.CATALOG_COLOR || name,
                    swatch = imageUrl(color.COLOR_SQUARE_IMAGE);
                return (
                    '<button type="button" class="color-swatch" aria-pressed="false" data-color="' +
                    escapeHtml(name) +
                    '" data-color-code="' +
                    escapeHtml(code) +
                    '" data-call="selectColor" data-args="' +
                    dataArgs(['$event', product.id]) +
                    '">' +
                    (swatch
                        ? '<img src="' + escapeHtml(swatch) + '" alt="">'
                        : '') +
                    '<span>' +
                    escapeHtml(name) +
                    '</span></button>'
                );
            })
            .join('') +
        '</div></fieldset>' +
        '<fieldset class="selection-group"><legend>Select size</legend><p class="stock-status" role="status">Select a color to check available sizes.</p><div class="size-grid"></div></fieldset>' +
        '<p class="product-error" role="alert" hidden></p>' +
        '<button type="button" class="btn btn-secondary inventory-retry" data-call="retryProductInventory" data-args="' +
        dataArgs([product.id]) +
        '" hidden>Retry sizes</button>' +
        '<button type="button" class="btn btn-primary select-btn" data-call="selectProduct" data-args="' +
        dataArgs([product.id, type]) +
        '" disabled>Select this ' +
        type +
        '</button></div>';
    return card;
}
function inventorySizes(data) {
    if (
        !Array.isArray(data?.sizes) ||
        !Array.isArray(data?.sizeTotals) ||
        data.sizes.length !== data.sizeTotals.length
    )
        throw new Error('Inventory response is incomplete.');
    return data.sizes.map((size, i) => {
        const qty = Number(data.sizeTotals[i]);
        if (!String(size).trim() || !Number.isFinite(qty) || qty < 0)
            throw new Error('Inventory response is invalid.');
        return { size: String(size), quantity: qty };
    });
}
async function selectColor(event, id) {
    if (submitting) return;
    const button = event.target.closest('.color-swatch');
    if (!button) return;
    const product = productFor(id),
        card = button.closest('.product-card'),
        type = typeFor(id);
    const old = choices.get(id);
    if (old?.controller) old.controller.abort();
    const choice = {
        color: product.colors.find(
            (c) =>
                (c.CATALOG_COLOR || c.COLOR_NAME) === button.dataset.colorCode,
        ),
        sizes: [],
        size: null,
        pending: true,
        controller: new AbortController(),
    };
    choices.set(id, choice);
    if (selectedItems[type]?.id === id) {
        selectedItems[type] = null;
        card.classList.remove('selected');
        updateSummary();
    }
    card.querySelectorAll('.color-swatch').forEach((n) => {
        const selected = n === button;
        n.classList.toggle('selected', selected);
        n.setAttribute('aria-pressed', String(selected));
    });
    card.querySelector('.size-grid').replaceChildren();
    card.querySelector('.stock-status').textContent = 'Checking current sizes…';
    hide(card.querySelector('.product-error'), true);
    hide(card.querySelector('.inventory-retry'), true);
    card.querySelector('.select-btn').disabled = true;
    card.setAttribute('aria-busy', 'true');
    updateContinueButtons();
    const image =
        choice.color.MAIN_IMAGE_URL ||
        choice.color.FRONT_MODEL ||
        choice.color.FRONT_FLAT;
    const imageButton = card.querySelector('.product-image'),
        img = imageButton.querySelector('img');
    if (img && imageUrl(image)) {
        img.src = imageUrl(image);
        img.alt = product.name + ' — ' + button.dataset.color;
    }
    imageButton.dataset.args = JSON.stringify([
        imageUrl(image) || imageUrl(product.image),
    ]);
    try {
        const data = await fetchJson(
            '/api/sizes-by-style-color?styleNumber=' +
                encodeURIComponent(id) +
                '&color=' +
                encodeURIComponent(button.dataset.colorCode),
            AbortSignal.any([
                choice.controller.signal,
                AbortSignal.timeout(20000),
            ]),
        );
        if (choices.get(id) !== choice) return;
        choice.sizes = inventorySizes(data);
        card.querySelector('.size-grid').innerHTML = choice.sizes
            .map(
                ({ size, quantity }) =>
                    '<button type="button" class="btn btn-secondary size-btn" data-size="' +
                    escapeHtml(size) +
                    '" aria-pressed="false" data-call="selectSize" data-args="' +
                    dataArgs(['$event', id]) +
                    '"' +
                    (quantity ? '' : ' disabled') +
                    '>' +
                    escapeHtml(size) +
                    (quantity ? '' : ' — unavailable') +
                    '</button>',
            )
            .join('');
        const available = choice.sizes.filter((s) => s.quantity > 0);
        card.querySelector('.stock-status').textContent = available.length
            ? 'Choose an available size.'
            : 'This color is currently out of stock. Choose another color.';
        choice.pending = false;
        if (available.length === 1) {
            const only = card.querySelector('.size-btn:not([disabled])');
            selectSize({ target: only }, id);
        }
    } catch (error) {
        if (choices.get(id) !== choice) return;
        choice.pending = false;
        choice.error = true;
        const notice = card.querySelector('.product-error');
        notice.textContent =
            'Sizes could not be checked. Retry before selecting this product.';
        hide(notice, false);
        hide(card.querySelector('.inventory-retry'), false);
        card.querySelector('.stock-status').textContent =
            'Availability is unknown.';
    } finally {
        if (choices.get(id) === choice) {
            card.removeAttribute('aria-busy');
            updateContinueButtons();
        }
    }
}
function retryProductInventory(id) {
    const card = document.querySelector(
        '[data-product-id="' + CSS.escape(id) + '"]',
    );
    const button = card?.querySelector('.color-swatch.selected');
    if (button) return selectColor({ target: button }, id);
}
function selectSize(event, id) {
    if (submitting) return;
    const button = event.target.closest('.size-btn'),
        choice = choices.get(id);
    if (!button || button.disabled || !choice || choice.pending || choice.error)
        return;
    const stock = choice.sizes.find(
        (s) => s.size === button.dataset.size && s.quantity > 0,
    );
    if (!stock) return;
    choice.size = stock.size;
    const card = button.closest('.product-card'),
        type = typeFor(id),
        product = productFor(id);
    card.querySelectorAll('.size-btn').forEach((n) => {
        n.classList.toggle('selected', n === button);
        n.setAttribute('aria-pressed', String(n === button));
    });
    card.querySelector('.stock-status').textContent =
        stock.quantity + ' available in ' + stock.size + '.';
    card.querySelector('.retail-value').textContent =
        money(calculateItemValue(id, stock.size, product.retailPrice)) +
        ' value';
    card.querySelector('.select-btn').disabled = false;
    if (selectedItems[type]?.id === id) {
        selectedItems[type] = null;
        card.classList.remove('selected');
        updateSummary();
    }
    updateContinueButtons();
}
function selectProduct(id, type) {
    if (submitting) return;
    const choice = choices.get(id),
        product = productFor(id);
    if (
        !choice ||
        choice.pending ||
        choice.error ||
        !choice.size ||
        !choice.color
    ) {
        showErrorBanner('Choose an available color and size first.');
        return;
    }
    selectedItems[type] = {
        ...product,
        selectedSize: choice.size,
        selectedColor: choice.color.COLOR_NAME || choice.color.CATALOG_COLOR,
        selectedColorCode:
            choice.color.CATALOG_COLOR || choice.color.COLOR_NAME,
        selectedColorData: choice.color,
        retailPrice: calculateItemValue(id, choice.size, product.retailPrice),
    };
    document
        .querySelectorAll('[data-product-type="' + type + '"]')
        .forEach((card) => {
            const selected = card.dataset.productId === id;
            card.classList.toggle('selected', selected);
            const button = card.querySelector('.select-btn');
            if (button)
                button.textContent = selected
                    ? 'Selected'
                    : 'Select this ' + type;
        });
    clearError();
    updateSummary();
    updateContinueButtons();
}
function selectedImage(item) {
    return imageUrl(
        item.selectedColorData?.MAIN_IMAGE_URL ||
            item.selectedColorData?.FRONT_MODEL ||
            item.selectedColorData?.FRONT_FLAT ||
            item.image,
    );
}
function itemMarkup(item, type, remove) {
    const image = selectedImage(item);
    return (
        '<div class="gift-item">' +
        (image
            ? '<img src="' +
              escapeHtml(image) +
              '" alt="' +
              escapeHtml(item.name) +
              '">'
            : '') +
        '<div><strong>' +
        escapeHtml(item.name) +
        '</strong><p>' +
        escapeHtml(item.id) +
        ' · ' +
        escapeHtml(item.selectedColor) +
        ' · ' +
        escapeHtml(item.selectedSize) +
        '</p><span>' +
        money(item.retailPrice) +
        ' value</span></div>' +
        (remove
            ? '<button type="button" class="btn btn-secondary remove-item" aria-label="Remove ' +
              type +
              '" data-call="removeItem" data-args="' +
              dataArgs([type]) +
              '">Remove</button>'
            : '') +
        '</div>'
    );
}
function updateSummary() {
    const selected = types.filter((type) => selectedItems[type]);
    el('summaryItems').innerHTML = selected.length
        ? selected
              .map((type) => itemMarkup(selectedItems[type], type, true))
              .join('')
        : '<p class="summary-empty">Start building your gift box</p>';
    hide(el('valueSummaryBanner'), !selected.length);
    el('totalValueAmount').textContent = money(calculateRetailValue());
    el('totalSavingsAmount').textContent = money(calculateRetailValue());
}
function updateContinueButtons() {
    types.forEach((type) => {
        el(type + 'Next').disabled = submitting || !selectedItems[type];
    });
    document.querySelectorAll('.step').forEach((button) => {
        const step = Number(button.dataset.step);
        button.disabled = submitting || step > highestStepReached;
        button.classList.toggle('active', step === currentStep);
        button.setAttribute(
            'aria-current',
            step === currentStep ? 'step' : 'false',
        );
    });
}
function showStep(step, focus = true) {
    currentStep = step;
    highestStepReached = Math.max(highestStepReached, step);
    document.querySelectorAll('.section').forEach((node) => {
        const selected = node.id === 'step' + step;
        node.classList.toggle('active', selected);
        hide(node, !selected);
    });
    document.body.dataset.christmasStep = String(step);
    if (step === 7) populateReviewData();
    updateContinueButtons();
    if (focus) {
        const heading = el('step' + step).querySelector('h2');
        heading.tabIndex = -1;
        heading.focus();
        heading.scrollIntoView({ block: 'start' });
    }
}
function nextStep() {
    if (submitting) return;
    if (currentStep <= 4 && !selectedItems[types[currentStep - 1]]) {
        showErrorBanner('Select a color, size and product before continuing.');
        return;
    }
    if (currentStep === 6 && !validateDelivery()) return;
    clearError();
    if (currentStep === 4 && !bonusShown) {
        document.querySelectorAll('.section').forEach((node) => {
            const active = node.id === 'santaBonus';
            hide(node, !active);
            node.classList.toggle('active', active);
        });
        document.body.dataset.christmasStep = 'bonus';
        const heading = el('santaBonus').querySelector('h2');
        heading.tabIndex = -1;
        heading.focus();
        return;
    }
    if (currentStep < 7) showStep(currentStep + 1);
}
function proceedFromBonus() {
    if (!submitting) {
        bonusShown = true;
        showStep(5);
    }
}
function previousStep() {
    if (!submitting && currentStep > 1) {
        clearError();
        showStep(currentStep - 1);
    }
}
function goToStep(step) {
    if (!submitting && step >= 1 && step <= highestStepReached) {
        clearError();
        showStep(step);
    }
}
function removeItem(type) {
    if (submitting || !types.includes(type)) return;
    selectedItems[type] = null;
    document
        .querySelectorAll('[data-product-type="' + type + '"]')
        .forEach((n) => n.classList.remove('selected'));
    updateSummary();
    showStep(types.indexOf(type) + 1);
}
function formatPhoneNumber(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (!digits) return '';
    if (digits.length <= 3) return '(' + digits;
    if (digits.length <= 6)
        return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    return (
        '(' +
        digits.slice(0, 3) +
        ') ' +
        digits.slice(3, 6) +
        '-' +
        digits.slice(6)
    );
}
function calendarDate(date) {
    return (
        date.getFullYear() +
        '-' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getDate()).padStart(2, '0')
    );
}
function minimumDeliveryDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 14);
    while ([0, 6].includes(date.getDay())) date.setDate(date.getDate() + 1);
    return date;
}
function initializeDeliveryDate() {
    const minimum = calendarDate(minimumDeliveryDate());
    el('deliveryDate').min = minimum;
    if (!el('deliveryDate').value) el('deliveryDate').value = minimum;
}
function validateDelivery() {
    initializeDeliveryDate();
    toggleDeliveryFields();
    const form = el('deliveryForm');
    const invalid = [...form.querySelectorAll('input,select')].find(
        (node) => !node.disabled && !node.checkValidity(),
    );
    if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        showErrorBanner('Complete the highlighted contact or delivery field.');
        invalid.focus();
        return false;
    }
    const raw = el('deliveryDate').value,
        match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : null;
    if (
        !date ||
        calendarDate(date) !== raw ||
        date < minimumDeliveryDate() ||
        [0, 6].includes(date.getDay())
    ) {
        el('deliveryDate').setAttribute('aria-invalid', 'true');
        showErrorBanner('Choose a weekday at least two weeks from today.');
        el('deliveryDate').focus();
        return false;
    }
    return true;
}
function toggleDeliveryFields() {
    const shipping =
        document.querySelector('input[name="deliveryMethod"]:checked')
            ?.value === 'Ship';
    hide(el('shippingFields'), !shipping);
    hide(el('pickupInfo'), shipping);
    ['address1', 'city', 'state', 'zipCode'].forEach((id) => {
        el(id).required = shipping;
        el(id).disabled = !shipping;
    });
    el('address2').disabled = !shipping;
    el('rushOrder').disabled = !shipping;
}
function collectQuoteData() {
    const v = (id) => el(id)?.value || '';
    return {
        firstName: v('firstName'),
        lastName: v('lastName'),
        email: v('email'),
        phone: v('phone'),
        company: v('companyName'),
        deliveryMethod: document.querySelector(
            'input[name="deliveryMethod"]:checked',
        ).value,
        shippingAddress: v('address1'),
        shippingAddress2: v('address2'),
        shippingCity: v('city'),
        shippingState: v('state'),
        shippingZip: v('zipCode'),
        jacketEmbLocation: v('jacketEmbLocation'),
        hoodieEmbLocation: v('hoodieEmbLocation'),
        threadColors: v('threadColors'),
        specialInstructions: v('specialInstructions'),
        imageUpload: null,
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
        rushOrder: el('rushOrder').checked,
        dueDate: v('deliveryDate'),
        totalQuantity: calculateTotalQuantity(),
        totalPrice: calculateTotalPrice(),
        unitPrice: calculateUnitPrice(),
        description: generateBundleDescription(),
    };
}
function detailsMarkup(rows) {
    return (
        '<dl class="gift-details">' +
        rows
            .map(
                ([label, value]) =>
                    '<div><dt>' +
                    escapeHtml(label) +
                    '</dt><dd>' +
                    escapeHtml(value || 'Not provided') +
                    '</dd></div>',
            )
            .join('') +
        '</dl>'
    );
}
function populateReviewData() {
    const data = collectQuoteData();
    el('orderSummaryRetailValue').textContent = money(data.totalPrice);
    el('orderSummarySavings').textContent = money(data.totalPrice);
    el('reviewItems').innerHTML = types
        .filter((type) => selectedItems[type])
        .map((type) => itemMarkup(selectedItems[type], type, false))
        .join('');
    el('reviewCustomization').innerHTML = detailsMarkup([
        ['Logo', selectedLogoFile ? selectedLogoFile.name : 'No logo uploaded'],
        [
            'Jacket embroidery',
            el('jacketEmbLocation').selectedOptions[0].textContent,
        ],
        [
            'Hoodie embroidery',
            el('hoodieEmbLocation').selectedOptions[0].textContent,
        ],
        ['Thread colors', data.threadColors],
        ['Special instructions', data.specialInstructions],
    ]);
    el('reviewDelivery').innerHTML = detailsMarkup([
        ['Name', data.firstName + ' ' + data.lastName],
        ['Company', data.company],
        ['Email', data.email],
        ['Phone', data.phone],
        [
            'Delivery',
            data.deliveryMethod === 'Ship'
                ? 'Ship to address'
                : 'Factory pickup',
        ],
        [
            'Address',
            data.deliveryMethod === 'Ship'
                ? [
                      data.shippingAddress,
                      data.shippingAddress2,
                      data.shippingCity,
                      data.shippingState,
                      data.shippingZip,
                  ]
                      .filter(Boolean)
                      .join(', ')
                : 'Northwest Custom Apparel, 2025 Freeman Road East, Milton, WA 98354',
        ],
        ['Preferred date', data.dueDate],
        ['Rush order', data.rushOrder ? 'Requested' : 'No'],
    ]);
}
function openZoomModal(src) {
    if (!src || submitting) return;
    modalOpener = document.activeElement;
    el('zoomImage').src = src;
    el('imageZoomModal').showModal();
}
function closeZoomModal() {
    el('imageZoomModal').close();
    modalOpener?.focus();
}
function handleLogoUpload(event) {
    if (submitting) return;
    const file = event.target.files?.[0] || event.dataTransfer?.files?.[0];
    if (!file) return;
    if (
        file.size > 20 * 1024 * 1024 ||
        ![
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/svg+xml',
            'application/pdf',
        ].includes(file.type)
    ) {
        removeLogo();
        showErrorBanner(
            'Choose a PNG, JPG, GIF, SVG or PDF logo no larger than 20 MB.',
        );
        return;
    }
    selectedLogoFile = file;
    selectedLogoDataURL = '';
    const version = ++logoRead;
    const preview = el('uploadPreview');
    hide(preview, false);
    preview.replaceChildren();
    const name = document.createElement('p');
    name.textContent = file.name;
    preview.append(name);
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
            if (logoRead !== version) return;
            selectedLogoDataURL = String(reader.result);
            const image = document.createElement('img');
            image.src = selectedLogoDataURL;
            image.alt = 'Selected company logo';
            preview.prepend(image);
        };
        reader.onerror = () => {
            if (logoRead === version)
                showErrorBanner(
                    'The logo preview could not be read. Choose the file again.',
                );
        };
        reader.readAsDataURL(file);
    } else {
        const description = document.createElement('p');
        description.textContent = 'PDF selected';
        preview.append(description);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-secondary';
    remove.textContent = 'Remove logo';
    remove.dataset.call = 'removeLogo';
    preview.append(remove);
}
function removeLogo() {
    if (submitting) return;
    logoRead++;
    selectedLogoFile = null;
    selectedLogoDataURL = '';
    el('logoFile').value = '';
    el('uploadPreview').replaceChildren();
    hide(el('uploadPreview'), true);
    el('logoFile').focus();
}
function setBusy(busy) {
    submitting = busy;
    document.querySelector('main').inert = busy;
    el('submitBtn').disabled = busy;
    updateContinueButtons();
}
function updateSubmissionProgress(step, message) {
    el('submissionOverlay').querySelector('.submission-message').textContent =
        message;
    el('submissionOverlay')
        .querySelectorAll('.submission-step')
        .forEach((node) =>
            node.classList.toggle('active', node.dataset.step === step),
        );
}
function showSuccessModal(status) {
    lastSuccess = status;
    el('referenceNumber').textContent = status.quoteID;
    el('orderConfirmationDetails').innerHTML = detailsMarkup([
        ['Gift box value', money(orderService.record.quoteData.totalPrice)],
        ['Your cost', 'FREE'],
        ['Delivery', orderService.record.quoteData.deliveryMethod],
        ['Preferred date', orderService.record.quoteData.dueDate],
    ]);
    const message = status.complete
        ? 'Your gift-box request is saved and both confirmation emails have been sent.'
        : 'Your gift-box request is saved. ' +
          (!status.customerEmailSent
              ? 'Your confirmation email has not been sent. '
              : '') +
          (!status.salesEmailSent
              ? 'The sales notification has not been sent.'
              : '');
    el('christmasConfirmationStatus').textContent = message;
    hide(el('retryChristmasEmail'), status.complete);
    document.body.classList.add('cb-confirmed');
    el('successModal').showModal();
}
async function submitOrder() {
    if (submitting || currentStep !== 7 || el('successModal').open) return;
    if (Date.now() > CAMPAIGN_DEADLINE) {
        showErrorBanner(
            'This offer has ended. Contact sales for current promotions.',
        );
        return;
    }
    if (types.some((type) => !selectedItems[type])) {
        showErrorBanner('Select all four gift-box items before submitting.');
        return;
    }
    if (!validateDelivery()) return;
    if (!orderService) {
        showErrorBanner(
            'Ordering is unavailable. Refresh this page or contact sales.',
        );
        return;
    }
    clearError();
    // Capture every field and file before the first asynchronous operation.
    pendingOrder = {
        data: collectQuoteData(),
        items: JSON.parse(JSON.stringify(selectedItems)),
        file: selectedLogoFile,
    };
    setBusy(true);
    el('submissionOverlay').showModal();
    try {
        const result = await orderService.submit(
            pendingOrder.data,
            pendingOrder.items,
            RETAIL_PRICES,
            pendingOrder.file,
            updateSubmissionProgress,
        );
        el('submissionOverlay').close();
        setBusy(false);
        showSuccessModal(result);
    } catch (error) {
        el('submissionOverlay').close();
        setBusy(false);
        const reference = orderService.record?.quoteID;
        showErrorBanner(
            (orderService.record?.sessionSaved
                ? 'Your request is incomplete. '
                : 'Your request could not be completed. ') +
                error.message +
                (reference ? ' Reference: ' + reference + '.' : '') +
                ' Your selections are retained; retry to finish.',
        );
    } finally {
        pendingOrder = null;
    }
}
async function retryChristmasEmail() {
    if (submitting || !orderService?.record?.itemSaved) return;
    submitting = true;
    el('retryChristmasEmail').disabled = true;
    el('christmasConfirmationStatus').textContent =
        'Retrying the unfinished confirmation emails…';
    try {
        const result = await orderService.retryEmails();
        el('successModal').close();
        showSuccessModal(result);
    } catch (error) {
        el('christmasConfirmationStatus').textContent =
            'Your request remains saved. Email retry failed: ' + error.message;
    } finally {
        submitting = false;
        el('retryChristmasEmail').disabled = false;
    }
}
function closeModal() {
    if (submitting) return;
    el('successModal').close();
    document.body.classList.remove('cb-confirmed');
    if (lastSuccess) {
        resetForm();
        lastSuccess = null;
    } else el('submitBtn').focus();
}
function resetForm() {
    if (submitting) return;
    selectedItems = { jacket: null, hoodie: null, beanie: null, gloves: null };
    choices.forEach((choice) => choice.controller?.abort());
    choices.clear();
    selectedLogoFile = null;
    selectedLogoDataURL = '';
    logoRead++;
    el('logoFile').value = '';
    el('uploadPreview').replaceChildren();
    hide(el('uploadPreview'), true);
    el('deliveryForm').reset();
    el('threadColors').value = '';
    el('specialInstructions').value = '';
    el('deliveryDate').value = '';
    initializeDeliveryDate();
    toggleDeliveryFields();
    highestStepReached = 1;
    bonusShown = false;
    renderProducts();
    updateSummary();
    showStep(1);
}
function togglePricing() {
    const details = el('pricingDetails'),
        open = details.hidden;
    hide(details, !open);
    document
        .querySelector('.pricing-bar-toggle')
        .setAttribute('aria-expanded', String(open));
}
document.addEventListener('DOMContentLoaded', () => {
    orderService =
        typeof ChristmasBundleQuoteService === 'function'
            ? new ChristmasBundleQuoteService()
            : null;
    if (window.emailjs?.init)
        window.emailjs.init(window.APP_CONFIG?.EMAIL?.PUBLIC_KEY || '');
    el('imageZoomModal').addEventListener('close', () => modalOpener?.focus());
    el('submissionOverlay').addEventListener('cancel', (event) => {
        if (submitting) event.preventDefault();
    });
    el('successModal').addEventListener('cancel', (event) => {
        event.preventDefault();
        closeModal();
    });
    el('logoFile').addEventListener('change', handleLogoUpload);
    const upload = el('uploadArea');
    upload.addEventListener('dragover', (event) => event.preventDefault());
    upload.addEventListener('drop', (event) => {
        event.preventDefault();
        handleLogoUpload(event);
    });
    el('phone').addEventListener('input', (event) => {
        event.target.value = formatPhoneNumber(event.target.value);
    });
    el('deliveryForm').addEventListener('submit', (event) =>
        event.preventDefault(),
    );
    document
        .querySelectorAll('input,select,textarea')
        .forEach((node) =>
            node.addEventListener('input', () =>
                node.removeAttribute('aria-invalid'),
            ),
        );
    updateCountdown();
    setInterval(updateCountdown, 1000);
    initializeDeliveryDate();
    toggleDeliveryFields();
    showStep(1, false);
    loadChristmasProducts();
    if (!orderService)
        showErrorBanner(
            'Ordering is unavailable. Refresh this page or contact sales.',
        );
});
Object.assign(window, {
    selectColor,
    selectSize,
    selectProduct,
    retryProductInventory,
    loadChristmasProducts,
    nextStep,
    previousStep,
    goToStep,
    proceedFromBonus,
    removeItem,
    openZoomModal,
    closeZoomModal,
    removeLogo,
    togglePricing,
    toggleDeliveryFields,
    submitOrder,
    retryChristmasEmail,
    closeModal,
});

// Print from the top of the document. A native open dialog needs an in-flow copy.
let christmasPrintState = null;
window.addEventListener('beforeprint', () => {
    if (christmasPrintState) return;
    christmasPrintState = {
        x: window.scrollX,
        y: window.scrollY,
        focus: document.activeElement,
    };
    document.activeElement?.blur();
    window.scrollTo(0, 0);
    const sheet = el('giftPrintConfirmation');
    if (el('successModal').open) {
        sheet.replaceChildren(
            el('successModal').querySelector('.modal-content').cloneNode(true),
        );
        sheet
            .querySelectorAll('button,.success-icon')
            .forEach((node) => node.remove());
        sheet
            .querySelectorAll('[id]')
            .forEach((node) => node.removeAttribute('id'));
        sheet.hidden = false;
    }
});
window.addEventListener('afterprint', () => {
    if (!christmasPrintState) return;
    const sheet = el('giftPrintConfirmation');
    sheet.hidden = true;
    sheet.replaceChildren();
    const state = christmasPrintState;
    christmasPrintState = null;
    state.focus?.focus({ preventScroll: true });
    window.scrollTo(state.x, state.y);
});
