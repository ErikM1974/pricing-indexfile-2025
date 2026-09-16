/**
 * Embroidery builder — the ShopWorks import summary and the non-SanMar price button
 * (Erik 2026-09-16: the summary rendered as unstyled text and the $0.00 price could only be
 * clicked). Locks the keyboard and screen-reader behaviour the browser suite can't reach:
 *
 *   • the summary is the shared alert above the product table (never inside its scroll
 *     region), text only, read out from an empty live region, one button per product;
 *   • warning while a product still needs a price, success once all have one;
 *   • Dismiss and "go to price" move keyboard focus somewhere sensible;
 *   • the $0.00 price is a real button that says it needs a price, and the price editor is
 *     labelled, refuses $0 visibly and hands focus back to the button.
 */
const path = require('path');

[
    'renderOrderRecap', 'productThumbnailModal', 'formatPrice',
    'parseRatePercent', 'getLtmControlState', 'setLtmControlState',
    'updateQuantityNudge', 'renderLtmControlPanel', 'initLtmControlListeners',
    'renderShipToCard', 'updatePerUnitPrice', 'updateNotesBadge', 'markScreenPrintDirty',
    'reorderRowByProductType', 'updateArtworkCharges', 'markAsUnsaved',
].forEach((name) => { if (typeof globalThis[name] === 'undefined') globalThis[name] = () => {}; });
globalThis.QuoteOrderSummary = { configure: () => {}, render: () => {}, renderShipTo: () => {} };
globalThis.SKUValidationService = { validate: () => ({ valid: true }) };
globalThis.wrapWithRepricingIndicator = (fn) => fn;
globalThis.SIZE_TO_SUFFIX = globalThis.SIZE_TO_SUFFIX || {};
globalThis.EXTENDED_SIZE_ORDER = globalThis.EXTENDED_SIZE_ORDER || [];
globalThis.escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const toasts = [];
globalThis.showToast = (message, type) => toasts.push({ message, type });

require('../../shared_components/js/headwear-classifier.js');
const bundle = (name) => require(path.join(__dirname, '.bundles', name));
const embImport = bundle('emb-shopworks-import.cjs');
const embRows = bundle('emb-product-rows.cjs');
const embPricing = bundle('emb-pricing-sync.cjs');

const later = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

/** A product table with imported rows: vendor $0, vendor priced, vendor cost-plus, SanMar, and a manual vendor row. */
function page() {
    toasts.length = 0;
    document.body.innerHTML = `
        <main>
          <div class="search-row"><button id="before">search</button></div>
          <div class="product-table-wrapper" role="region" tabindex="0">
            <table id="product-table"><tbody id="product-tbody">
              <tr id="row-1" data-row-id="1" data-style="ABC1" data-product-name="Vendor tee" data-non-sanmar="true" data-import-data="{}"><td><input class="style-input" value="ABC1"></td><td class="cell-price" id="row-price-1"></td></tr>
              <tr id="row-2" data-row-id="2" data-style="XYZ9" data-product-name="&lt;img src=x onerror=alert(1)&gt;" data-non-sanmar="true" data-import-data="{}" data-sell-price="14.5"><td><input class="style-input" value="XYZ9"></td><td class="cell-price" id="row-price-2"></td></tr>
              <tr id="row-3" data-row-id="3" data-style="SS4000" data-product-name="S&amp;S tee" data-non-sanmar="true" data-import-data="{}" data-ns-pricing-mode="costPlus"><td><input class="style-input" value="SS4000"></td><td class="cell-price" id="row-price-3"></td></tr>
              <tr id="row-4" data-row-id="4" data-style="PC54" data-import-data="{}"><td><input class="style-input" value="PC54"></td><td class="cell-price" id="row-price-4"></td></tr>
              <tr id="row-5" data-row-id="5" data-style="MANUAL1" data-non-sanmar="true"><td><input class="style-input" value="MANUAL1"></td><td class="cell-price" id="row-price-5"></td></tr>
            </tbody></table>
          </div>
        </main>`;
    return document.querySelector('.product-table-wrapper');
}

describe('ShopWorks import summary', () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = jest.fn();
        window.matchMedia = jest.fn(() => ({ matches: false }));
    });

    test('sits above the product table as the shared warning alert, text only, one button per imported vendor product', async () => {
        const wrapper = page();
        const banner = embImport.showImportSummaryBanner(1);
        expect(banner.id).toBe('import-summary-banner');
        expect(banner.className).toBe('alert alert-warn emb-screen-notice');
        expect(banner.nextElementSibling).toBe(wrapper);
        expect(wrapper.contains(banner)).toBe(false);

        // The live region goes in empty and is filled after insertion; Dismiss is outside it.
        const live = banner.querySelector('[role="status"][aria-live="polite"][aria-atomic="true"]');
        expect(live.textContent).toBe('');
        await later();
        expect(live.querySelector('.banner-title').textContent).toBe('Import complete: 4 products');
        expect(live.querySelector('.banner-detail').textContent)
            .toBe('1 SanMar product priced automatically. 3 non-SanMar products — 1 still needs a price before you can save.');
        const dismiss = banner.querySelector('.btn-dismiss-banner');
        expect(dismiss.tagName).toBe('BUTTON');
        expect(dismiss.getAttribute('aria-label')).toBe('Dismiss the import summary');
        expect(live.contains(dismiss)).toBe(false);

        const items = [...banner.querySelectorAll('.import-summary-list > li > button.import-summary-item')];
        expect(items.map((b) => b.textContent)).toEqual([
            'ABC1 (Vendor tee) — needs a price',
            'XYZ9 (<img src=x onerror=alert(1)>) — $14.50 each',
            'SS4000 (S&S tee) — priced from blank cost',
        ]);
        expect(banner.querySelector('img')).toBeNull();                      // text only
        expect(items.map((b) => b.type)).toEqual(['button', 'button', 'button']);
        expect(items[0].querySelector('.is-unpriced').textContent).toBe('needs a price');
        expect(banner.querySelectorAll('.is-unpriced')).toHaveLength(1);
        for (const b of items) expect(b.getAttribute('aria-label').startsWith(b.textContent)).toBe(true);
        expect(items[0].dataset.call).toBe('scrollToProductRow');
        expect(JSON.parse(items[0].dataset.args)).toEqual([1]);
    });

    test('no imported vendor products → no summary; a new import replaces the old one', () => {
        page();
        document.querySelectorAll('[data-non-sanmar="true"][data-import-data]').forEach((r) => r.removeAttribute('data-import-data'));
        expect(embImport.showImportSummaryBanner(3)).toBeNull();
        expect(document.getElementById('import-summary-banner')).toBeNull();
        page();
        embImport.showImportSummaryBanner(1);
        embImport.showImportSummaryBanner(2);
        expect(document.querySelectorAll('#import-summary-banner')).toHaveLength(1);
    });

    test('turns into a success once every product has a price, and says so', async () => {
        page();
        const banner = embImport.showImportSummaryBanner(0);
        await later();
        document.getElementById('row-1').dataset.sellPrice = '12';
        embImport.syncImportSummary();
        expect(banner.className).toBe('alert alert-success emb-screen-notice');
        expect(banner.querySelector('.banner-detail').textContent).toBe('All non-SanMar products now have a price.');
        expect(banner.querySelector('.import-summary-item').textContent).toBe('ABC1 (Vendor tee) — $12.00 each');
        // A product removed from the quote says so instead of jumping nowhere.
        document.getElementById('row-2').remove();
        embImport.syncImportSummary();
        const gone = banner.querySelectorAll('.import-summary-item')[1];
        expect(gone.textContent).toBe('XYZ9 — no longer on the quote');
        expect(gone.disabled).toBe(true);
    });

    test('the live region is only rewritten when its words change; a removed last row is worded as removed', async () => {
        page();
        const banner = embImport.showImportSummaryBanner(0);
        await later();
        const live = banner.querySelector('[role="status"]');
        const title = live.querySelector('.banner-title');
        embImport.syncImportSummary();                       // nothing changed (e.g. a SanMar price edit)
        expect(live.querySelector('.banner-title')).toBe(title);
        document.getElementById('row-1').remove();           // the only unpriced product is deleted, not priced
        embImport.syncImportSummary();
        expect(banner.className).toBe('alert alert-success emb-screen-notice');
        expect(live.querySelector('.banner-detail').textContent).toBe('No product on this list still needs a price.');
    });

    test('Dismiss moves keyboard focus that was inside the summary to the product table', () => {
        const wrapper = page();
        const banner = embImport.showImportSummaryBanner(1);
        banner.querySelector('.btn-dismiss-banner').focus();
        embImport.dismissImportBanner();
        expect(document.getElementById('import-summary-banner')).toBeNull();
        expect(document.activeElement).toBe(wrapper);
        // Focus elsewhere stays where it is.
        embImport.showImportSummaryBanner(1);
        const before = document.getElementById('before');
        before.focus();
        embImport.dismissImportBanner();
        expect(document.activeElement).toBe(before);
    });

    test('"go to price" scrolls to the row, focuses its price and marks the row for a moment', async () => {
        page();
        embRows.updateNonSanmarPriceCell(document.getElementById('row-1'), 1);
        embImport.scrollToProductRow(1);
        const button = document.querySelector('#row-price-1 .ns-price-btn');
        expect(document.activeElement).toBe(button);
        expect(button.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        expect(document.getElementById('row-1').classList.contains('is-located')).toBe(true);
        await later(1600);
        expect(document.getElementById('row-1').classList.contains('is-located')).toBe(false);
        // Reduced motion: no smooth scroll. A row without a price button focuses its style box.
        window.matchMedia = jest.fn(() => ({ matches: true }));
        embImport.scrollToProductRow(4);
        expect(document.activeElement).toBe(document.querySelector('#row-4 .style-input'));
        expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'center', inline: 'nearest' });
    });

    test('a missing or hidden row says so visibly', () => {
        page();
        embImport.scrollToProductRow(99);
        expect(toasts.pop()).toEqual({ message: 'That product is no longer on the quote.', type: 'warning' });
        document.getElementById('row-4').style.display = 'none';
        embImport.scrollToProductRow(4);
        expect(toasts.pop()).toEqual({ message: 'That product is no longer on the quote.', type: 'warning' });
    });
});

describe('non-SanMar price button', () => {
    test('$0.00 is a real button that says it needs a price; a price clears the warning', () => {
        page();
        const row = document.getElementById('row-1');
        embRows.updateNonSanmarPriceCell(row, 1);
        let button = document.querySelector('#row-price-1 button.ns-price-btn');
        expect(button.type).toBe('button');
        expect(button.textContent.replace(/\s+/g, ' ').trim()).toBe('$0.00 needs a price');
        expect(button.getAttribute('aria-label')).toBe('$0.00 needs a price — set the unit price for ABC1');
        expect(button.dataset.call).toBe('enablePriceOverride');
        expect(JSON.parse(button.dataset.args)).toEqual([1]);
        expect(row.classList.contains('price-warning')).toBe(true);
        expect(document.getElementById('row-price-1').classList.contains('ns-price-zero')).toBe(true);

        row.dataset.sellPrice = '9.5';
        embRows.updateNonSanmarPriceCell(row, 1);
        button = document.querySelector('#row-price-1 button.ns-price-btn');
        expect(button.textContent.trim()).toBe('$9.50');
        expect(button.getAttribute('aria-label')).toBe('$9.50 — edit the unit price for ABC1');
        expect(row.classList.contains('price-warning')).toBe(false);
        expect(document.getElementById('row-price-1').classList.contains('ns-price-zero')).toBe(false);
    });

    test('the style in the accessible name is escaped', () => {
        const html = embRows.nsPriceButtonHtml(7, 0, '"><img src=x>');
        const holder = document.createElement('div');
        holder.innerHTML = html;
        expect(holder.querySelector('img')).toBeNull();
        expect(holder.querySelector('button').getAttribute('aria-label')).toBe('$0.00 needs a price — set the unit price for "><img src=x>');
    });

    test('a $0.00 line drops any engine price left from the style it replaced', () => {
        page();
        const cell = document.getElementById('row-price-1');
        cell.dataset.exactUnitPrice = '15.5';
        const total = document.createElement('td');
        total.id = 'row-total-1';
        total.textContent = '$372.00';
        document.getElementById('row-1').appendChild(total);
        embRows.updateNonSanmarPriceCell(document.getElementById('row-1'), 1);
        expect(cell.dataset.exactUnitPrice).toBeUndefined();
        expect(total.textContent).toBe('-');
    });

    test('the unpriced-vendor check lists only vendor lines with no price and no cost', () => {
        page();
        document.getElementById('row-3').dataset.blankCost = '8.25';
        const products = [1, 2, 3, 4, 5].map((rowId) => ({
            rowId, style: document.getElementById(`row-${rowId}`).dataset.style,
            sellPriceOverride: parseFloat(document.getElementById(`row-${rowId}`).dataset.sellPrice) || 0,
        }));
        products.push({ rowId: 1, style: 'SERVICE', isService: true });
        expect(embPricing.vendorStylesWithoutPrice(products)).toEqual(['ABC1', 'MANUAL1']);
    });

    test('a cost-plus vendor row keeps the engine price (no button)', () => {
        page();
        const cell = document.getElementById('row-price-3');
        cell.textContent = '$8.25';
        embRows.updateNonSanmarPriceCell(document.getElementById('row-3'), 3);
        expect(cell.textContent).toBe('$8.25');
        expect(cell.querySelector('button')).toBeNull();
    });
});

describe('price editor', () => {
    const open = () => {
        page();
        const row = document.getElementById('row-1');
        embRows.updateNonSanmarPriceCell(row, 1);
        embRows.enablePriceOverride(1);
        return { row, input: document.querySelector('#row-price-1 .price-override-input') };
    };
    const key = (el, name) => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

    test('is labelled and starts from the row price', () => {
        page();
        const row = document.getElementById('row-2');
        embRows.updateNonSanmarPriceCell(row, 2);
        embRows.enablePriceOverride(2);
        const input = document.querySelector('#row-price-2 .price-override-input');
        expect(input.getAttribute('aria-label')).toBe('Unit price for XYZ9');
        expect(input.getAttribute('inputmode')).toBe('decimal');
        expect(input.value).toBe('14.50');
        expect(document.activeElement).toBe(input);
    });

    test('a $0.00 vendor line starts blank (never a stale engine price); leaving it blank changes nothing', async () => {
        page();
        const row = document.getElementById('row-1');
        embRows.updateNonSanmarPriceCell(row, 1);
        document.getElementById('row-price-1').dataset.exactUnitPrice = '15.5';
        embRows.enablePriceOverride(1);
        const input = document.querySelector('#row-price-1 .price-override-input');
        expect(input.value).toBe('');
        input.dispatchEvent(new Event('blur'));
        await later();
        expect(row.dataset.sellPrice).toBeUndefined();
        expect(toasts).toEqual([]);
        expect(document.querySelector('#row-price-1 .ns-price-btn').textContent).toContain('needs a price');
    });

    test('Escape puts the $0.00 button back and focuses it', async () => {
        const { input } = open();
        key(input, 'Escape');
        await later();
        const button = document.querySelector('#row-price-1 .ns-price-btn');
        expect(button.textContent).toContain('needs a price');
        expect(document.activeElement).toBe(button);
    });

    test('$0 is refused visibly; a real price is kept, announced to the summary and focused', async () => {
        let { input } = open();
        input.value = '0';
        key(input, 'Enter');
        expect(toasts.pop()).toEqual({ message: 'Enter a price above $0.00.', type: 'warning' });
        await later();
        expect(document.querySelector('#row-price-1 .ns-price-btn').textContent).toContain('needs a price');

        window.syncImportSummary = jest.fn();
        ({ input } = open());
        input.value = '12';
        key(input, 'Enter');
        await later();
        expect(document.getElementById('row-1').dataset.sellPrice).toBe('12');
        const button = document.querySelector('#row-price-1 .ns-price-btn');
        expect(button.textContent.trim()).toBe('$12.00');
        expect(document.activeElement).toBe(button);
        expect(window.syncImportSummary).toHaveBeenCalled();
        delete window.syncImportSummary;
    });
});
