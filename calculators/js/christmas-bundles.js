/* Christmas gift boxes: one controller owns selection, navigation and submission. */
'use strict';
// Products, campaign copy and deadline live in /config/christmas-campaign.json.
let campaign = null;
let PRODUCT_STYLES = {};
let catalogLoading = false;
let promotionToken = '';
let currentEstimate = null;
let estimatedSelection = '';
let estimateRun = 0;
function itemPrice(color, size) {
    return color?.pricing?.bySize[size] ?? color?.pricing?.bySize[size === 'XXL' ? '2XL' : size];
}
function selectionRequest() {
    return {
        items: types
            .filter((type) => selectedItems[type])
            .map((type) => ({
                type,
                style: selectedItems[type].id,
                color: selectedItems[type].selectedColorCode,
                size: selectedItems[type].selectedSize,
            })),
        deliveryMethod: document.querySelector('input[name="deliveryMethod"]:checked').value,
        promotionToken,
    };
}
async function postHoliday(path, body) {
    const response = await fetch('/api/christmas-gift-box/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(data.error || 'The request could not be verified. Please try again.');
    return data;
}
async function applyGiftCode(event) {
    event.preventDefault();
    if (submitting) return;
    el('applyGiftCode').disabled = true;
    el('giftCodeStatus').textContent = 'Checking your invitation…';
    try {
        const result = await postHoliday('gift-code', { code: el('giftCode').value });
        promotionToken = result.promotionToken;
        el('giftCode').value = '';
        el('giftCodeStatus').textContent =
            'Invitation verified. Your selected box, standard embroidery and delivery are complimentary. Final availability is reviewed by our team.';
        hide(el('removeGiftCode'), false);
        updateSummary();
        if (currentStep === 7) await refreshEstimate();
    } catch (error) {
        el('giftCodeStatus').textContent = error.message;
    } finally {
        el('applyGiftCode').disabled = false;
    }
}
function removeGiftCode() {
    if (submitting) return;
    promotionToken = '';
    el('giftCodeStatus').textContent = 'Gift code removed. Standard holiday pricing applies.';
    hide(el('removeGiftCode'), true);
    updateSummary();
    if (currentStep === 7) refreshEstimate();
}
async function refreshEstimate() {
    const run = ++estimateRun;
    currentEstimate = null;
    el('submitBtn').disabled = true;
    el('estimateStatus').textContent = 'Verifying current prices and delivery charges…';
    hide(el('retryEstimate'), true);
    const body = selectionRequest(),
        signature = JSON.stringify(body);
    try {
        const result = await postHoliday('estimate', body);
        if (run !== estimateRun || signature !== JSON.stringify(selectionRequest())) return;
        currentEstimate = result;
        estimatedSelection = signature;
        renderEstimate();
        el('estimateStatus').textContent = result.complimentary
            ? 'Invitation verified. No payment is due for this sample request.'
            : 'Current 8-piece pricing verified for one box. Tax and any additional artwork charges are confirmed before invoicing.';
        el('submitBtn').disabled = submitting;
    } catch (error) {
        if (run !== estimateRun) return;
        el('estimateStatus').textContent = error.message;
        hide(el('retryEstimate'), false);
    }
}
function renderEstimate() {
    const p = currentEstimate;
    el('orderSummaryRetailValue').textContent = p ? money(p.subtotal - p.box) : '—';
    el('orderBoxCharge').textContent = p ? money(p.box) : '—';
    el('orderShippingCharge').textContent = p ? money(p.shipping) : '—';
    el('orderSummarySavings').textContent = p ? money(p.discount) : '—';
    hide(el('orderDiscountRow'), !p?.complimentary);
    el('orderEstimateTotal').textContent = p ? money(p.total) : 'Verifying…';
    el('orderTotalLabel').textContent = p?.complimentary
        ? 'Your sample cost'
        : 'Estimate before tax';
    el('boxPricingStatus').textContent = p
        ? (p.complimentary ? 'Complimentary invitation applied · ' : 'Box estimate before tax · ') +
          money(p.total)
        : 'Review your box to verify final item and delivery pricing.';
}
function renderHeroProducts() {
    el('heroProducts').innerHTML = products.jackets
        .filter((p) => !p.error)
        .slice(0, 3)
        .map(
            (p) =>
                '<img src="' +
                escapeHtml(imageUrl(p.image)) +
                '" alt="' +
                escapeHtml(p.brand + ' ' + p.name) +
                '">'
        )
        .join('');
}

const CB_API_BASE = window.APP_CONFIG?.API?.BASE_URL || '';
let CAMPAIGN_DEADLINE = 0;
const products = { jackets: [], hoodies: [], beanies: [], gloves: [] };
let selectedItems = { jacket: null, hoodie: null, beanie: null, gloves: null };
let currentStep = 1;
let highestStepReached = 1;
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
            })[c]
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
const typeFor = (id) => types.find((type) => products[categories[type]].some((p) => p.id === id));

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
        cache: 'no-store',
        signal: signal || AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Request failed (HTTP ' + response.status + ').');
    return response.json();
}
function updateCountdown() {
    if (!campaign) return;
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
        ? 'Request your sample box by ' + campaign.deadlineLabel + ' (Pacific time).'
        : 'This offer has ended. Contact sales for current promotions.';
    document.body.classList.toggle('cb-ended', !remaining);
}
async function loadCampaign() {
    campaign = window.ChristmasCampaign.validateCampaign(
        await fetchJson('/api/christmas-gift-box/campaign')
    );
    CAMPAIGN_DEADLINE = Date.parse(campaign.closesAt);
    PRODUCT_STYLES = Object.fromEntries(
        Object.entries(campaign.products).map(([category, items]) => [
            category,
            items.map((item) => item.style),
        ])
    );
    el('campaignHeadline').textContent = campaign.headline;
    el('campaignIntroduction').textContent = campaign.introduction;
    el('campaignEligibility').textContent = campaign.eligibility;
    document.querySelector('.deadline-date').textContent = campaign.deadlineLabel;
    document.title = 'Holiday Gift Boxes ' + campaign.year + ' | Northwest Custom Apparel';
    updateCountdown();
}

async function loadChristmasProducts() {
    if (submitting || catalogLoading) return;
    catalogLoading = true;
    clearError();
    el('catalogStatus').textContent = 'Loading your sample collection…';
    try {
        await loadCampaign();
    } catch {
        catalogLoading = false;
        el('catalogStatus').textContent = 'The sample collection could not load.';
        hide(el('retryChristmasProducts'), false);
        showErrorBanner('Campaign details are unavailable. Retry the catalog or contact our team.');
        return;
    }
    choices.forEach((choice) => choice.controller?.abort());
    choices.clear();
    selectedItems = { jacket: null, hoodie: null, beanie: null, gloves: null };
    highestStepReached = 1;
    showStep(1, false);
    el('retryChristmasProducts').disabled = true;
    let failures = 0;
    await Promise.all(
        Object.entries(PRODUCT_STYLES).map(async ([category, styles]) => {
            const entries = await Promise.all(
                styles.map(async (id) => {
                    try {
                        const data = await fetchJson(
                            '/api/christmas-gift-box/products/' + encodeURIComponent(id)
                        );
                        if (
                            !Array.isArray(data.colors) ||
                            !data.colors.length ||
                            !Number.isFinite(data.minimum)
                        )
                            throw new Error('Current product pricing is unavailable.');
                        const color =
                            data.colors.find((c) =>
                                [c.COLOR_NAME, c.CATALOG_COLOR].includes(data.preferredColor)
                            ) || data.colors[0];
                        return {
                            ...data,
                            id,
                            retailPrice: data.minimum,
                            image:
                                color.MAIN_IMAGE_URL || color.FRONT_MODEL || color.FRONT_FLAT || '',
                        };
                    } catch (error) {
                        failures++;
                        return {
                            id,
                            type: types.find((type) => categories[type] === category),
                            error: error.message,
                        };
                    }
                })
            );
            products[category] = entries;
        })
    );
    renderProducts();
    renderHeroProducts();
    catalogLoading = false;
    el('catalogStatus').textContent = failures
        ? 'Some products need another try.'
        : 'Choose your color and size. Availability comes from SanMar warehouse stock.';
    hide(el('retryChristmasProducts'), !failures);
    el('retryChristmasProducts').disabled = false;
    if (failures)
        showErrorBanner(
            'Some gift-box products could not load. Retry the catalog to see current options.'
        );
    updateSummary();
    updateContinueButtons();
    ensureStepInventory(1);
}

function ensureStepInventory(step) {
    if (step > 4 || !campaign) return;
    const type = types[step - 1];
    for (const product of products[categories[type]]) {
        if (product.error || choices.has(product.id)) continue;
        const card = document.querySelector('[data-product-id="' + CSS.escape(product.id) + '"]');
        const buttons = [...card.querySelectorAll('.color-swatch')];
        const button =
            buttons.find((node) =>
                [node.dataset.color, node.dataset.colorCode].includes(product.preferredColor)
            ) || buttons[0];
        if (button) selectColor({ target: button }, product.id);
    }
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
        escapeHtml(product.brand + ' · ' + product.id) +
        '</p><h3 class="product-name">' +
        escapeHtml(product.name) +
        '</h3><p class="product-purpose">' +
        escapeHtml(product.summary) +
        '</p>' +
        '<div class="product-price"><span class="retail-value">' +
        money(product.retailPrice) +
        ' <span class="price-context">from · ' +
        (type === 'gloves' ? 'without embroidery' : 'with embroidery') +
        '</span></span></div>' +
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
                    '<button type="button" class="btn btn-secondary color-swatch" aria-pressed="false" data-color="' +
                    escapeHtml(name) +
                    '" data-color-code="' +
                    escapeHtml(code) +
                    '" data-call="selectColor" data-args="' +
                    dataArgs(['$event', product.id]) +
                    '">' +
                    (swatch ? '<img src="' + escapeHtml(swatch) + '" alt="">' : '') +
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
function inventorySizes(data, style, color) {
    return window.ChristmasCampaign.inventorySizes(data, style, color);
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
            (c) => (c.CATALOG_COLOR || c.COLOR_NAME) === button.dataset.colorCode
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
        choice.color.MAIN_IMAGE_URL || choice.color.FRONT_MODEL || choice.color.FRONT_FLAT;
    const imageButton = card.querySelector('.product-image'),
        img = imageButton.querySelector('img');
    if (img && imageUrl(image)) {
        img.src = imageUrl(image);
        img.alt = product.name + ' — ' + button.dataset.color;
    }
    imageButton.dataset.args = JSON.stringify([imageUrl(image) || imageUrl(product.image)]);
    try {
        if (!CB_API_BASE) throw new Error('Inventory service is unavailable.');
        const data = await fetchJson(
            CB_API_BASE +
                '/api/sanmar/inventory/' +
                encodeURIComponent(id) +
                '?color=' +
                encodeURIComponent(button.dataset.colorCode),
            AbortSignal.any([choice.controller.signal, AbortSignal.timeout(20000)])
        );
        if (choices.get(id) !== choice) return;
        if (!choice.color.pricing) throw new Error('Pricing for this color is unavailable.');
        choice.sizes = inventorySizes(data, id, choice.color).map((row) => ({
            ...row,
            price: itemPrice(choice.color, row.size),
        }));
        choice.checkedAt = Date.now();
        card.querySelector('.size-grid').innerHTML = choice.sizes
            .map(
                ({ size, quantity, price }) =>
                    '<button type="button" class="btn btn-secondary size-btn" data-size="' +
                    escapeHtml(size) +
                    '" aria-pressed="false" data-call="selectSize" data-args="' +
                    dataArgs(['$event', id]) +
                    '"' +
                    (quantity && Number.isFinite(price) ? '' : ' disabled') +
                    '>' +
                    escapeHtml(size) +
                    '<span class="size-quantity">' +
                    (quantity
                        ? Number.isFinite(price)
                            ? quantity.toLocaleString() + ' available'
                            : 'Price unavailable'
                        : 'Out of stock') +
                    '</span>' +
                    '</button>'
            )
            .join('');
        const available = choice.sizes.filter((s) => s.quantity > 0 && Number.isFinite(s.price));
        card.querySelector('.stock-status').textContent = available.length
            ? 'SanMar warehouse stock. Choose your size.'
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
            'Stock could not be verified for this color. Retry or choose another color.';
        hide(notice, false);
        hide(card.querySelector('.inventory-retry'), false);
        card.querySelector('.stock-status').textContent = 'Availability is unknown.';
    } finally {
        if (choices.get(id) === choice) {
            card.removeAttribute('aria-busy');
            updateContinueButtons();
        }
    }
}
function retryProductInventory(id) {
    const card = document.querySelector('[data-product-id="' + CSS.escape(id) + '"]');
    const button = card?.querySelector('.color-swatch.selected');
    if (button) return selectColor({ target: button }, id);
}
function selectSize(event, id) {
    if (submitting) return;
    const button = event.target.closest('.size-btn'),
        choice = choices.get(id);
    if (!button || button.disabled || !choice || choice.pending || choice.error) return;
    const stock = choice.sizes.find((s) => s.size === button.dataset.size && s.quantity > 0);
    if (!stock) return;
    choice.size = stock.size;
    const card = button.closest('.product-card'),
        type = typeFor(id);
    card.querySelectorAll('.size-btn').forEach((n) => {
        n.classList.toggle('selected', n === button);
        n.setAttribute('aria-pressed', String(n === button));
    });
    card.querySelector('.stock-status').textContent =
        stock.quantity.toLocaleString() +
        ' available in ' +
        stock.size +
        '. Stock is confirmed when your request is reviewed.';
    card.querySelector('.retail-value').textContent =
        money(itemPrice(choice.color, stock.size)) +
        (type === 'gloves' ? ' · without embroidery' : ' · with embroidery');
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
    if (!choice || choice.pending || choice.error || !choice.size || !choice.color) {
        showErrorBanner('Choose an available color and size first.');
        return;
    }
    selectedItems[type] = {
        ...product,
        selectedSize: choice.size,
        selectedColor: choice.color.COLOR_NAME || choice.color.CATALOG_COLOR,
        selectedColorCode: choice.color.CATALOG_COLOR || choice.color.COLOR_NAME,
        selectedColorData: choice.color,
        retailPrice: itemPrice(choice.color, choice.size),
    };
    document.querySelectorAll('[data-product-type="' + type + '"]').forEach((card) => {
        const selected = card.dataset.productId === id;
        card.classList.toggle('selected', selected);
        const button = card.querySelector('.select-btn');
        if (button) button.textContent = selected ? 'Selected' : 'Select this ' + type;
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
            item.image
    );
}
function itemMarkup(item, type, remove) {
    const image = selectedImage(item);
    return (
        '<div class="gift-item">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.name) + '">' : '') +
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
        '</span></div>' +
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
        ? selected.map((type) => itemMarkup(selectedItems[type], type, true)).join('')
        : '<p class="summary-empty">Start building your gift box</p>';
    if (estimatedSelection !== JSON.stringify(selectionRequest())) {
        currentEstimate = null;
        estimateRun++;
        el('submitBtn').disabled = true;
    }
    const subtotal = selected.reduce((sum, type) => sum + selectedItems[type].retailPrice, 0);
    hide(el('valueSummaryBanner'), !selected.length);
    el('totalValueAmount').textContent = money(subtotal);
    el('selectionCount').textContent = selected.length + ' of 4 items selected';
    el('invitationSummary').textContent = promotionToken
        ? 'Gift code applied · verify at review'
        : '8-piece pricing · one box';
    renderEstimate();
}

function updateContinueButtons() {
    types.forEach((type) => {
        el(type + 'Next').disabled = submitting || !selectedItems[type];
    });
    document.querySelectorAll('.step').forEach((button) => {
        const step = Number(button.dataset.step);
        button.disabled = submitting || step > highestStepReached;
        button.classList.toggle('active', step === currentStep);
        button.setAttribute('aria-current', step === currentStep ? 'step' : 'false');
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
    if (step === 7) {
        populateReviewData();
        refreshEstimate();
    }
    updateContinueButtons();
    ensureStepInventory(step);
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
    if (currentStep === 5) {
        const invalid = [...el('step5').querySelectorAll('input,select,textarea')].find(
            (node) => !node.disabled && !node.checkValidity()
        );
        if (invalid) {
            showErrorBanner('Check the highlighted customization or holiday planning field.');
            invalid.reportValidity();
            return;
        }
    }
    if (currentStep === 6 && !validateDelivery()) return;
    clearError();
    if (currentStep < 7) showStep(currentStep + 1);
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
    if (digits.length <= 6) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
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
    const pacificDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    const date = new Date(pacificDay + 'T00:00:00');
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
        (node) => !node.disabled && !node.checkValidity()
    );
    if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        showErrorBanner('Complete the highlighted contact or delivery field.');
        invalid.focus();
        return false;
    }
    const raw = el('deliveryDate').value,
        match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
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
        document.querySelector('input[name="deliveryMethod"]:checked')?.value === 'Ship';
    hide(el('shippingFields'), !shipping);
    hide(el('pickupInfo'), shipping);
    ['address1', 'city', 'state', 'zipCode'].forEach((id) => {
        el(id).required = shipping;
        el(id).disabled = !shipping;
    });
    el('address2').disabled = !shipping;
    updateSummary();
}
function collectQuoteData() {
    const v = (id) => el(id)?.value || '';
    return {
        firstName: v('firstName'),
        lastName: v('lastName'),
        email: v('email'),
        phone: v('phone'),
        company: v('companyName'),
        deliveryMethod: document.querySelector('input[name="deliveryMethod"]:checked').value,
        shippingAddress: v('address1'),
        shippingAddress2: v('address2'),
        shippingCity: v('city'),
        shippingState: v('state'),
        shippingZip: v('zipCode'),
        jacketEmbLocation: v('jacketEmbLocation'),
        hoodieEmbLocation: v('hoodieEmbLocation'),
        threadColors: v('threadColors'),
        specialInstructions: v('specialInstructions'),
        imageUpload: '',
        holidayTeamSize: v('holidayTeamSize'),
        holidayGiftDate: v('holidayGiftDate'),
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
        dueDate: v('deliveryDate'),
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
                    '</dd></div>'
            )
            .join('') +
        '</dl>'
    );
}
function populateReviewData() {
    const data = collectQuoteData();
    renderEstimate();
    el('reviewItems').innerHTML = types
        .filter((type) => selectedItems[type])
        .map((type) => itemMarkup(selectedItems[type], type, false))
        .join('');
    el('reviewCustomization').innerHTML = detailsMarkup([
        ['Logo', selectedLogoFile ? selectedLogoFile.name : 'No logo uploaded'],
        ['Jacket embroidery', el('jacketEmbLocation').selectedOptions[0].textContent],
        ['Hoodie embroidery', el('hoodieEmbLocation').selectedOptions[0].textContent],
        ['Thread colors', data.threadColors],
        ['Special instructions', data.specialInstructions],
    ]);
    el('reviewDelivery').innerHTML = detailsMarkup([
        ['Name', data.firstName + ' ' + data.lastName],
        ['Company', data.company],
        ['Email', data.email],
        ['Phone', data.phone],
        ['Delivery', data.deliveryMethod === 'Ship' ? 'Ship to address' : 'Factory pickup'],
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
        ['Holiday team size', data.holidayTeamSize],
        ['Holiday gift date', data.holidayGiftDate],
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
        !['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'application/pdf'].includes(
            file.type
        )
    ) {
        removeLogo();
        showErrorBanner('Choose a PNG, JPG, GIF, SVG or PDF logo no larger than 20 MB.');
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
                showErrorBanner('The logo preview could not be read. Choose the file again.');
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
    el('submitBtn').disabled = busy || !currentEstimate;
    updateContinueButtons();
}
function updateSubmissionProgress(step, message) {
    el('submissionOverlay').querySelector('.submission-message').textContent = message;
    el('submissionOverlay')
        .querySelectorAll('.submission-step')
        .forEach((node) => node.classList.toggle('active', node.dataset.step === step));
}
function showSuccessModal(status) {
    lastSuccess = status;
    el('referenceNumber').textContent = status.quoteID;
    el('requestSummaryLink').href = status.quoteUrl;
    el('orderConfirmationDetails').innerHTML = detailsMarkup([
        ['Request', status.pricing.complimentary ? 'Complimentary invitation' : 'Holiday gift box'],
        ['Estimate before tax', money(status.pricing.total)],
        ['Payment', 'No payment collected. Our team will follow up.'],
    ]);
    el('christmasConfirmationStatus').textContent = status.complete
        ? 'Your request is saved. Customer confirmation and sales notification were accepted by our email service.'
        : status.emailUncertain
          ? 'Your request is saved. Email delivery could not be confirmed; check your inbox or contact our team with this reference.'
          : 'Your request is saved. An email could not be sent. You can retry the unfinished confirmation below.';
    hide(el('retryChristmasEmail'), !status.emailRetryable);
    hide(el('requestRecovery'), true);
    document.body.classList.add('cb-confirmed');
    el('successModal').showModal();
}
async function submitOrder() {
    if (submitting || currentStep !== 7 || el('successModal').open) return;
    if (!campaign || Date.now() >= CAMPAIGN_DEADLINE) {
        showErrorBanner('This offer has ended. Contact sales for current options.');
        return;
    }
    if (!validateDelivery() || types.some((type) => !selectedItems[type])) return;
    if (!currentEstimate || estimatedSelection !== JSON.stringify(selectionRequest())) {
        await refreshEstimate();
        return;
    }
    clearError();
    pendingOrder = {
        ...selectionRequest(),
        estimateToken: currentEstimate.estimateToken,
        customer: collectQuoteData(),
        website: el('website').value,
    };
    setBusy(true);
    el('submissionOverlay').showModal();
    try {
        const result = await orderService.submit(
            pendingOrder,
            selectedLogoFile,
            updateSubmissionProgress
        );
        el('submissionOverlay').close();
        setBusy(false);
        showSuccessModal(result);
    } catch (error) {
        el('submissionOverlay').close();
        setBusy(false);
        if (error.canRevise) await refreshEstimate();
        showErrorBanner(error.message + ' Your selections are retained.');
        if (orderService.storageWarning)
            showErrorBanner(error.message + ' ' + orderService.storageWarning);
        hide(el('requestRecovery'), !orderService.record?.attempted);
    } finally {
        pendingOrder = null;
    }
}
async function resumeRequest() {
    if (submitting || !orderService?.record?.body) return;
    setBusy(true);
    try {
        const result = await orderService.retry();
        setBusy(false);
        showSuccessModal(result);
    } catch (error) {
        setBusy(false);
        showErrorBanner(error.message + ' Contact our team if the request cannot be completed.');
    }
}
async function retryChristmasEmail() {
    if (submitting || !lastSuccess?.emailRetryable) return;
    submitting = true;
    el('retryChristmasEmail').disabled = true;
    try {
        const result = await orderService.retry();
        el('successModal').close();
        showSuccessModal(result);
    } catch (error) {
        el('christmasConfirmationStatus').textContent =
            'Your request remains saved. ' + error.message;
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
    orderService.reset();
    currentEstimate = null;
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
    renderProducts();
    updateSummary();
    showStep(1);
}

document.addEventListener('DOMContentLoaded', () => {
    orderService =
        typeof ChristmasBundleQuoteService === 'function'
            ? new ChristmasBundleQuoteService()
            : null;
    el('giftCodeForm').addEventListener('submit', applyGiftCode);
    hide(el('requestRecovery'), !orderService?.record?.body);
    if (orderService?.storageWarning) showErrorBanner(orderService.storageWarning);
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
    el('deliveryForm').addEventListener('submit', (event) => event.preventDefault());
    document
        .querySelectorAll('input,select,textarea')
        .forEach((node) =>
            node.addEventListener('input', () => node.removeAttribute('aria-invalid'))
        );
    updateCountdown();
    setInterval(updateCountdown, 1000);
    initializeDeliveryDate();
    toggleDeliveryFields();
    showStep(1, false);
    loadChristmasProducts();
    if (!orderService)
        showErrorBanner('Ordering is unavailable. Refresh this page or contact sales.');
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
    removeItem,
    openZoomModal,
    closeZoomModal,
    removeLogo,
    refreshEstimate,
    removeGiftCode,
    resumeRequest,
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
        sheet.replaceChildren(el('successModal').querySelector('.modal-content').cloneNode(true));
        sheet.querySelectorAll('button,.success-icon').forEach((node) => node.remove());
        sheet.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
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
