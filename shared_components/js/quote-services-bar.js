/**
 * Quote Services Bar (2026-06-03) — shared, catalog-driven "Add a service" bar.
 *
 * A persistent strip of one-click service chips that sits under the line-items
 * table. Clicking a chip adds that service as an editable LINE ITEM (the builder
 * supplies the add-callback). The bar stays visible as items accumulate.
 *
 * Reusable across EMB / SCP / DTG / DTF: each builder passes its OWN catalog
 * (the list of chargeable services) + an onAdd(code) callback. The render +
 * interaction live here once; adding a new service is a one-line catalog edit.
 *
 *   QuoteServicesBar.render('emb-services-bar', EMB_SERVICE_CATALOG, addServiceLineItem);
 *
 * Catalog entry shape:
 *   { code: 'Logo Mockup',            // passed to onAdd()
 *     label: 'Logo Mockup & Review',  // chip text
 *     price: 0,                       // optional — shown as a hint ('$0' => 'Set price')
 *     unit: 'flat'|'hr'|'ea',         // optional — price suffix on the chip
 *     icon: 'fa-palette' }            // optional Font Awesome icon
 */
(function () {
  'use strict';

  function priceHint(s) {
    if (s.priceLabel) return s.priceLabel;                 // explicit override
    if (s.price == null) return '';
    if (Number(s.price) === 0) return 'Set price';
    const suffix = s.unit === 'hr' ? '/hr' : (s.unit === 'ea' ? '/ea' : '');
    return `$${Number(s.price).toFixed(2)}${suffix}`;
  }

  function render(mountId, catalog, onAdd) {
    const mount = document.getElementById(mountId);
    if (!mount) { console.warn('[ServicesBar] mount not found:', mountId); return; }
    if (!Array.isArray(catalog)) { console.warn('[ServicesBar] catalog is not an array'); return; }

    const chips = catalog.map((s) => {
      const hint = priceHint(s);
      return `
        <button type="button" class="service-chip" data-code="${s.code}"
                title="Add ${s.label} as a line item">
          <i class="fas ${s.icon || 'fa-plus'}" aria-hidden="true"></i>
          <span class="service-chip-name">${s.label}</span>
          ${hint ? `<span class="service-chip-price">${hint}</span>` : ''}
        </button>`;
    }).join('');

    mount.innerHTML = `
      <span class="service-bar-label"><i class="fas fa-plus-circle"></i> Add to order:</span>
      ${chips}`;

    mount.querySelectorAll('.service-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        try { onAdd(btn.dataset.code); }
        catch (e) { console.error('[ServicesBar] onAdd failed for', btn.dataset.code, e); }
      });
    });
  }

  window.QuoteServicesBar = { render };
})();
