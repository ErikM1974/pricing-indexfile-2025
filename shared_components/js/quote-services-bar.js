/**
 * Quote Services Bar (2026-06-03 v2) — shared, catalog-driven "Add to order" bar.
 *
 * A persistent strip of CATEGORY buttons under the line-items table. Each button
 * opens a dropdown of services; clicking one adds it as an editable LINE ITEM
 * (the builder supplies the add-callback). Variable-price items (e.g. Logo Mockup,
 * Rush Fee) show an inline "$ [amount] [Add]" field so the rep enters the amount
 * before it drops in. Grouping keeps the bar uncluttered as the catalog grows.
 *
 * Reusable across EMB / SCP / DTG / DTF: each builder passes its OWN grouped
 * catalog + an onAdd(code, opts) callback. Render + interaction live here once.
 *
 *   QuoteServicesBar.render('emb-services-bar', EMB_SERVICE_CATALOG,
 *       (code, opts) => addManualServiceRow(code, opts && opts.price));
 *
 * Catalog (grouped) shape:
 *   [ { group: 'Artwork', icon: 'fa-palette', items: [
 *         { code:'Logo Mockup', label:'Logo Mockup & Review', prompt:true, icon:'fa-palette' },
 *         { code:'Graphic Design', label:'Graphic Design', price:75, unit:'hr', icon:'fa-pencil-ruler' } ] },
 *     { group: 'Charges', icon: 'fa-plus-circle', items: [
 *         { code:'Rush', label:'Rush Fee', prompt:true, icon:'fa-bolt' } ] } ]
 *   (A flat array of items is also accepted — it renders under one "Add" group.)
 *
 * Item fields: code (passed to onAdd) · label · price (default, optional) ·
 *   unit ('hr'|'ea'|'flat') · prompt (true → inline amount field) · icon.
 *   prompt items call onAdd(code, { price }); others call onAdd(code).
 */
(function () {
  'use strict';

  function fmt(n) { return '$' + (Number(n) || 0).toFixed(2); }

  function hint(it) {
    if (it.priceLabel) return it.priceLabel;
    if (it.price == null) return '';
    const suffix = it.unit === 'hr' ? '/hr' : (it.unit === 'ea' ? '/ea' : '');
    return fmt(it.price) + suffix;
  }

  function itemHtml(it) {
    const icon = `<i class="fas ${it.icon || 'fa-plus'}"></i>`;
    // Picker item: inline selects (e.g. Garment/Cap + stitch size) → Add → onAdd(code, {fields})
    if (Array.isArray(it.fields) && it.fields.length) {
      const selects = it.fields.map((f) =>
        `<label class="sci-field-lbl">${f.label ? f.label + ' ' : ''}` +
        `<select class="sci-field" data-field="${f.name}">` +
        f.options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('') +
        `</select></label>`
      ).join('');
      return `
        <div class="service-cat-item sci-prompt sci-config" data-code="${it.code}">
          <span class="sci-name">${icon} ${it.label}</span>
          <span class="sci-config-wrap">${selects}<button type="button" class="sci-add sci-add-config" data-code="${it.code}">${it.addLabel || 'Add'}</button></span>
        </div>`;
    }
    if (it.prompt) {
      return `
        <div class="service-cat-item sci-prompt">
          <span class="sci-name">${icon} ${it.label}</span>
          <span class="sci-amt-wrap">$<input type="number" class="sci-amt" data-code="${it.code}" min="0" step="0.01" placeholder="0.00"><button type="button" class="sci-add" data-code="${it.code}">Add</button></span>
        </div>`;
    }
    return `
      <button type="button" class="service-cat-item" data-code="${it.code}">
        <span class="sci-name">${icon} ${it.label}</span>
        <span class="sci-hint">${hint(it)}</span>
      </button>`;
  }

  function render(mountId, catalog, onAdd) {
    const mount = document.getElementById(mountId);
    if (!mount) { console.warn('[ServicesBar] mount not found:', mountId); return; }
    if (!Array.isArray(catalog)) { console.warn('[ServicesBar] catalog not an array'); return; }

    // Accept a flat item array OR a grouped [{group, items}] array.
    const groups = (catalog[0] && catalog[0].items)
      ? catalog
      : [{ group: 'Add', icon: 'fa-plus', items: catalog }];

    mount.innerHTML =
      '<span class="service-bar-label"><i class="fas fa-plus-circle"></i> Add to order:</span>' +
      groups.map((g) => `
        <div class="service-cat">
          <button type="button" class="service-cat-btn">
            <i class="fas ${g.icon || 'fa-plus'}"></i> ${g.group} <i class="fas fa-caret-down service-cat-caret"></i>
          </button>
          <div class="service-cat-menu" hidden>${g.items.map(itemHtml).join('')}</div>
        </div>`).join('');

    const closeAll = () => mount.querySelectorAll('.service-cat-menu').forEach((m) => { m.hidden = true; });
    const add = (code, opts) => { try { onAdd(code, opts); } catch (e) { console.error('[ServicesBar] onAdd failed', code, e); } };

    // Category button → toggle its dropdown (close the others)
    mount.querySelectorAll('.service-cat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = btn.nextElementSibling;
        const wasOpen = !menu.hidden;
        closeAll();
        menu.hidden = wasOpen;
      });
    });

    // Fixed-price items → add directly
    mount.querySelectorAll('button.service-cat-item').forEach((it) => {
      it.addEventListener('click', (e) => { e.stopPropagation(); add(it.dataset.code); closeAll(); });
    });

    // Variable-price items → read the inline amount, then add
    const submitAmt = (inputEl) => {
      const amt = parseFloat(inputEl.value) || 0;
      add(inputEl.dataset.code, { price: amt });
      inputEl.value = '';
      closeAll();
    };
    mount.querySelectorAll('.sci-add').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.classList.contains('sci-add-config')) {
          const row = btn.closest('.sci-config');
          const fields = {};
          row.querySelectorAll('.sci-field').forEach((s) => { fields[s.dataset.field] = s.value; });
          add(btn.dataset.code, { fields });
          closeAll();
          return;
        }
        submitAmt(btn.previousElementSibling);
      });
    });
    mount.querySelectorAll('.sci-amt').forEach((inp) => {
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAmt(inp); } });
    });
    // Keep the dropdown open while typing in a prompt row
    mount.querySelectorAll('.sci-prompt').forEach((row) => row.addEventListener('click', (e) => e.stopPropagation()));

    // Click anywhere else closes open menus (bind once)
    if (!window.__svcBarOutsideBound) {
      window.__svcBarOutsideBound = true;
      document.addEventListener('click', () => {
        document.querySelectorAll('.service-cat-menu').forEach((m) => { m.hidden = true; });
      });
    }
  }

  window.QuoteServicesBar = { render };
})();
