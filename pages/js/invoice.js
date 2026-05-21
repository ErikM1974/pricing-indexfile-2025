/**
 * invoice.js — Single-page invoice view.
 *
 * Renders /invoice/:quoteId by fetching /api/quote-sessions/:quoteId/full
 * and projecting the data into the compact invoice layout. When
 * ShopWorks_Snapshot is present we render from ShopWorks (post-import,
 * source of truth); otherwise we fall back to the original submission.
 *
 * The page auto-syncs when its cached snapshot is more than 30 minutes
 * old, and exposes a manual "Refresh from ShopWorks" button.
 *
 * Print path: standard browser print stylesheet. No JS work needed —
 * @media print in invoice.css does the heavy lifting.
 */

(function () {
  'use strict';

  // ---------- helpers ----------

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, kids) => {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.substring(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      }
    }
    if (kids) {
      (Array.isArray(kids) ? kids : [kids]).forEach(k => {
        if (k == null) return;
        node.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
      });
    }
    return node;
  };

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '$0.00';
    return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function fmtDateShort(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtPhone(p) {
    if (!p) return '';
    const c = String(p).replace(/\D/g, '');
    if (c.length === 10) return `(${c.substr(0,3)}) ${c.substr(3,3)}-${c.substr(6)}`;
    return p;
  }

  function relativeTime(s) {
    if (!s) return '';
    const t = new Date(s).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    const min = Math.round(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    return `${day}d ago`;
  }

  // Map a decoration "method" code (from originalSubmission) to a display label.
  // These codes come from our quote-builder UI and are reliable.
  const METHOD_LABELS = {
    'dtg':           'DTG Digital Printing',
    'dtf':           'DTF Transfer',
    'emb':           'Embroidery',
    'embroidery':    'Embroidery',
    'cap-emb':       'Cap Embroidery',
    'sp':            'Screen Printing',
    'screen-print':  'Screen Printing',
    'screenprint':   'Screen Printing',
    'sticker':       'Sticker',
    'emblem':        'Emblem / Patch',
    'patch':         'Emblem / Patch',
    'laser':         'Laser Engraving',
    'jds':           'Laser Engraving',
  };

  // Map a ShopWorks DESIGN type id to a label. Used as a last-resort fallback —
  // ShopWorks's ORDER type ID lookup is a different table that we don't ship
  // client-side, so we DON'T treat id_OrderType as a design-type id here.
  function designTypeLabel(idDesignType, fallback) {
    const TYPE_NAMES = {
      1: 'Screen Printing', 2: 'Embroidery', 4: 'Sticker',
      5: 'Emblem', 8: 'DTF Transfer', 45: 'DTG Digital Printing',
    };
    return TYPE_NAMES[Number(idDesignType)] || fallback || '—';
  }

  // ---------- main ----------

  class InvoicePage {
    constructor() {
      this.quoteId = this.parseQuoteId();
      this.fullData = null;
    }

    parseQuoteId() {
      // Path is /invoice/:quoteId — last non-empty path segment.
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    }

    async init() {
      if (!this.quoteId) {
        return this.showError('No quote ID provided in URL.');
      }
      try {
        await this.loadFullData();
        this.render();
        this.wireToolbar();
        $('loading').style.display = 'none';
        $('toolbar').style.display = 'flex';
        $('invoice').style.display = 'block';
        document.title = `Invoice ${this.headerOrderNumber()} - Northwest Custom Apparel`;
        // Auto-sync if stale (and we have a Processed quote)
        this.maybeAutoSync();
      } catch (err) {
        console.error('[invoice] load failed:', err);
        this.showError(err && err.message ? err.message : 'Failed to load invoice.');
      }
    }

    showError(msg) {
      $('loading').style.display = 'none';
      $('toolbar').style.display = 'none';
      $('invoice').style.display = 'none';
      $('error-message').textContent = msg;
      $('error').style.display = 'block';
    }

    async loadFullData() {
      const resp = await fetch(`/api/quote-sessions/${encodeURIComponent(this.quoteId)}/full`);
      if (!resp.ok) {
        if (resp.status === 404) throw new Error(`Quote ${this.quoteId} was not found.`);
        throw new Error(`Server returned ${resp.status} when loading quote.`);
      }
      this.fullData = await resp.json();
    }

    // Pick the order number to show in the header / page title.
    headerOrderNumber() {
      const sw = this.fullData?.shopWorks;
      if (sw?.orderNumber) return `#${sw.orderNumber}`;
      // Manual WO# stashed on the row
      const manual = this.fullData?.sessionRaw?.ShopWorks_Order_Number;
      if (manual) return `#${manual}`;
      // Pre-import: show the quote ID instead
      return this.quoteId;
    }

    // ---------- render orchestration ----------

    render() {
      const data = this.fullData || {};
      const sw   = data.shopWorks;
      const orig = data.originalSubmission || {};
      const order = sw?.snapshot?.order || null;
      const lineItems = sw?.snapshot?.lineItems || [];
      const pushed = sw?.snapshot?.pushed || {};

      this.renderHeader(data, order);
      this.renderBillTo(data, order, orig);
      this.renderShipTo(data, order, orig, pushed);
      this.renderDetails(data, order, orig);
      this.renderLineItems(data, order, lineItems, orig);
      this.renderTotals(data, order, orig);
      this.renderFooter(data, sw);
      this.renderSyncStatus(sw);
      this.renderStatusBanner(data, order);
    }

    renderHeader(data, order) {
      const sw = data.shopWorks;
      const manualWo = data.sessionRaw?.ShopWorks_Order_Number;

      // Title flips PROFORMA vs INVOICE depending on import state.
      $('invoice-title').textContent = order ? 'INVOICE' : 'PROFORMA';

      // Order number — prefer ShopWorks WO, fall back to manual entry, otherwise blank.
      const woNum = sw?.orderNumber || manualWo;
      $('invoice-order-number').textContent = woNum ? `WO ${woNum}` : '— (pending import)';

      // Quote # (always our quote ID)
      $('invoice-quote-id').textContent = data.quoteId || this.quoteId;

      // Date: invoice date = today (this is when the doc was generated /
      // synced). Order date stays elsewhere as detail.
      $('invoice-date').textContent = fmtDate(new Date().toISOString());
    }

    renderStatusBanner(data, order) {
      // Show full-width RUSH banner above line items when ANY of:
      //  - originalSubmission.info.isRush / .rush
      //  - order has a Drop Dead date within 5 days
      //  - Notes mention "RUSH" (case-insensitive)
      const info = data.originalSubmission?.info || {};
      const dropDead = order?.date_DropDead;
      const dropDeadSoon = dropDead &&
        (new Date(dropDead).getTime() - Date.now() < 5 * 86400000);
      const rushFlag =
        info.isRush === true ||
        info.rush === true ||
        dropDeadSoon ||
        (Array.isArray(order?.Notes) &&
          order.Notes.some(n => /rush/i.test(n?.Note || n?.Notes || '')));

      const banner = $('status-banner');
      if (!banner) return;
      if (!rushFlag) {
        banner.style.display = 'none';
        return;
      }
      banner.style.display = 'flex';

      // Add context detail when we know WHY it's rush.
      const detail = $('status-banner-detail');
      if (detail) {
        if (dropDead) {
          detail.textContent = '— Required by ' + fmtDate(dropDead);
        } else {
          detail.textContent = '— Expedited production';
        }
      }
    }

    renderBillTo(data, order, orig) {
      const billing = data.billingContact || null;

      // Customer / company — three-tier priority
      const customer =
        order?.CustomerName ||
        billing?.companyName ||
        orig?.info?.company ||
        data.sessionRaw?.CompanyName ||
        data.sessionRaw?.CustomerName ||
        '—';
      $('bill-customer-name').textContent = customer;

      // Contact (prefer ShopWorks live, then billing-contact record, then quote)
      const first = order?.ContactFirstName || '';
      const last  = order?.ContactLastName  || '';
      const swContact = [first, last].filter(Boolean).join(' ').trim();
      const contact =
        swContact ||
        billing?.contactName ||
        orig?.info?.name ||
        data.sessionRaw?.CustomerName ||
        '';
      if (contact && contact !== customer) {
        $('bill-contact-name').textContent = contact;
      }

      // Billing street address — pull from CompanyContactsMerge2026 first
      // (authoritative), then fall back to whatever the rep typed at submit.
      const billAddr1 =
        billing?.address1 ||
        orig?.info?.address ||
        orig?.info?.address1 ||
        orig?.info?.billingAddress ||
        '';
      const billAddr2 =
        billing?.address2 ||
        orig?.info?.address2 ||
        '';
      const billCity  = billing?.city  || orig?.info?.city  || '';
      const billState = billing?.state || orig?.info?.state || '';
      const billZip   = billing?.zip   || orig?.info?.zip   || '';
      const billCityState =
        [billCity, billState].filter(Boolean).join(', ') +
        (billZip ? ' ' + billZip : '');

      if (billAddr1) $('bill-address-line1').textContent = billAddr1;
      else $('bill-address-line1').style.display = 'none';

      if (billAddr2) $('bill-address-line2').textContent = billAddr2;
      else $('bill-address-line2').style.display = 'none';

      if (billCityState.trim()) $('bill-address-citystate').textContent = billCityState.trim();
      else $('bill-address-citystate').style.display = 'none';

      // Email / phone — quote-specific contact info takes priority over
      // the company-record values (rep may have keyed a different contact).
      const email =
        order?.ContactEmail ||
        orig?.info?.email ||
        data.sessionRaw?.CustomerEmail ||
        billing?.email ||
        '';
      if (email) $('bill-email').textContent = email;

      // Phone priority:
      //   1. ShopWorks order.ContactPhone — set at order placement, most
      //      specific to THIS order
      //   2. originalSubmission.info.phone — what the rep typed at submit
      //   3. sessionRaw.Phone — quote_sessions column
      //   4. billing.phoneBest — curated "best phone" from CompanyContactsMerge2026
      //      (preferred over Company_Phone — Erik hand-picks it per contact)
      //   5. billing.phone — Company_Phone (legacy ShopWorks-imported)
      const phone = fmtPhone(
        order?.ContactPhone ||
        orig?.info?.phone ||
        data.sessionRaw?.Phone ||
        billing?.phoneBest ||
        billing?.phone ||
        ''
      );
      if (phone) $('bill-phone').textContent = phone;
    }

    renderShipTo(data, order, orig, pushed) {
      // ShopWorks /v1/orders doesn't expose ShippingAddresses;
      // the order-pull snapshot does (pushed.ShippingAddresses[0]).
      const pushedShip = (pushed?.ShippingAddresses || [])[0];
      const ship = pushedShip ? {
        method:    pushedShip.ShipMethod || '',
        address1:  pushedShip.ShipAddress01 || '',
        address2:  pushedShip.ShipAddress02 || '',
        city:      pushedShip.ShipCity || '',
        state:     pushedShip.ShipState || '',
        zip:       pushedShip.ShipZip || '',
        company:   pushedShip.ShipCompany || '',
        name:      pushedShip.ShipName || '',
      } : (orig?.ship || {});

      const method = (ship.method || ship.methodLabel || '').toString();
      const isPickup =
        method === 'Customer Pickup' ||
        ship.isPickup === true ||
        method.toLowerCase().includes('pickup') ||
        method.toLowerCase().includes('willcall');

      let recipient, line1, line2, cityState;
      if (isPickup) {
        recipient = 'Customer Pickup';
        line1     = 'Northwest Custom Apparel';
        line2     = '2025 Freeman Road East';
        cityState = 'Milton, WA 98354';
      } else {
        recipient = ship.company || ship.name || data.sessionRaw?.CompanyName || orig?.info?.company || '—';
        line1     = ship.address1 || ship.address || '';
        line2     = ship.address2 || '';
        const city = ship.city || '';
        const state = ship.state || '';
        const zip = ship.zip || '';
        cityState = [city, state].filter(Boolean).join(', ') + (zip ? ' ' + zip : '');
      }

      $('ship-recipient').textContent = recipient;
      $('ship-line1').textContent     = line1;
      if (!line1) $('ship-line1').style.display = 'none';
      $('ship-line2').textContent     = line2;
      if (!line2) $('ship-line2').style.display = 'none';
      $('ship-citystate').textContent = cityState;
      if (!cityState.trim()) $('ship-citystate').style.display = 'none';

      $('ship-method').textContent = method || (isPickup ? 'Customer Pickup' : '');
    }

    renderDetails(data, order, orig) {
      // PO
      const po =
        order?.CustomerPurchaseOrder ||
        orig?.info?.po ||
        data.sessionRaw?.PurchaseOrderNumber ||
        '';
      $('detail-po').textContent = po || '—';

      // Sales Rep
      const rep =
        order?.CustomerServiceRep ||
        orig?.info?.salesRep ||
        data.sessionRaw?.SalesRepName ||
        data.sessionRaw?.SalesRep ||
        '';
      $('detail-rep').textContent = rep || '—';

      // Req Ship Date
      const reqShip =
        order?.date_RequestedToShip ||
        orig?.info?.requestedShipDate ||
        data.sessionRaw?.RequestedShipDate ||
        '';
      $('detail-ship-date').textContent = fmtDateShort(reqShip) || '—';

      // Terms
      const terms =
        order?.TermsName ||
        orig?.info?.paymentTerms ||
        data.sessionRaw?.PaymentTerms ||
        '';
      $('detail-terms').textContent = terms || '—';

      // Decoration / order type. Source priority:
      //   1. originalSubmission.decoConfig.method — what the rep chose at submit
      //      time (most reliable; 'dtg', 'emb', 'screen-print', etc.)
      //   2. originalSubmission.rows[0].deco — per-row method
      //   3. originalSubmission.info.method — older shape
      //   4. The order's primary DesignType id (from pushed.Designs[0])
      //   5. Quote-ID prefix inference (last-resort)
      //
      // We do NOT use order.id_OrderType — that's a separate ShopWorks lookup
      // table and the IDs don't match the design-type table.
      const pushedFirstDesign = (this.fullData?.shopWorks?.snapshot?.pushed?.Designs || [])[0];
      const method =
        orig?.decoConfig?.method ||
        orig?.rows?.[0]?.deco ||
        orig?.info?.method;
      let decoType =
        (method && METHOD_LABELS[String(method).toLowerCase()]) ||
        designTypeLabel(pushedFirstDesign?.id_DesignType, null) ||
        this.inferDecorationFromQuoteId();
      $('detail-method').textContent = decoType;
    }

    inferDecorationFromQuoteId() {
      // Quote ID prefixes signal the decoration method:
      // DTG, RICH, EMB, EMBC, CEMB, LT, PATCH, SPC, SSC, WEB, OF
      const id = (this.quoteId || '').toUpperCase();
      if (id.startsWith('DTG'))   return 'DTG Digital Printing';
      if (id.startsWith('DTF'))   return 'DTF Transfer';
      if (id.startsWith('EMBC') || id.startsWith('CEMB')) return 'Contract Embroidery';
      if (id.startsWith('EMB'))   return 'Embroidery';
      if (id.startsWith('SPC'))   return 'Screen Print Contract';
      if (id.startsWith('SSC') || id.startsWith('SP')) return 'Screen Printing';
      if (id.startsWith('PATCH')) return 'Emblem / Patch';
      if (id.startsWith('LT'))    return 'Laser';
      return 'Custom Decoration';
    }

    // ---------- line items ----------

    renderLineItems(data, order, lineItems, orig) {
      const tbody = $('items-tbody');
      tbody.innerHTML = '';

      // Source priority:
      //   1. ShopWorks lineItems[] (live, post-import)
      //   2. originalSubmission rows (pre-import)
      //   3. quoteItems (Caspio child rows)
      let rows = [];
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        rows = this.shopWorksLinesToInvoiceRows(lineItems, order);
      } else if (Array.isArray(orig?.rows) && orig.rows.length > 0) {
        rows = this.originalRowsToInvoiceRows(orig.rows, orig);
      } else if (Array.isArray(data.quoteItems) && data.quoteItems.length > 0) {
        rows = this.quoteItemsToInvoiceRows(data.quoteItems);
      }

      if (rows.length === 0) {
        const tr = el('tr', { class: 'invoice-item-empty' });
        tr.appendChild(el('td', { colspan: '6', text: 'No line items available for this order.' }));
        tbody.appendChild(tr);
        return;
      }

      rows.forEach(row => tbody.appendChild(this.buildLineRow(row)));
    }

    // Map ShopWorks /v1/lineitems[] to display rows.
    shopWorksLinesToInvoiceRows(lineItems, order) {
      // Each line in ShopWorks may have multiple sizes (Size01..Size06).
      // For an invoice we surface qty/unit/total at the LINE level
      // (subtotal of all sizes), and put the size breakdown in the description.
      //
      // ShopWorks /v1/lineitems field names:
      //   LineQuantity   — total qty for this style/color line
      //   LineUnitPrice  — per-piece price
      //   PartNumber / PartColor / PartDescription
      //   Size01..Size06 — per-size qty (string-typed in MO)
      const out = [];
      lineItems.forEach(li => {
        const sizes = this.collectSizesFromLineItem(li);
        const qty   = Number(li.LineQuantity) ||
                      sizes.reduce((s, x) => s + x.qty, 0) ||
                      Number(li.TotalQuantity) || 0;
        const unit  = Number(li.LineUnitPrice) || Number(li.cur_UnitPrice) || Number(li.UnitPrice) || 0;
        const total = Number(li.cur_TotalPrice) || (unit * qty);

        const sizeStr = sizes.length
          ? sizes.map(x => `${x.size}: ${x.qty}`).join(', ')
          : '';
        const desc = [li.PartDescription, sizeStr].filter(Boolean).join(' — ');

        out.push({
          style: li.PartNumber || li.id_LineItem || '—',
          color: li.PartColor || '',
          desc:  desc || li.PartDescription || '',
          locations: this.locationsForDesign(order),
          qty, unit, total,
        });
      });
      return out;
    }

    collectSizesFromLineItem(li) {
      // Two cases:
      //
      // 1) Size-suffixed SKU (PC90H_2X, PC90H_3XL, PC90H_4XL, PC54Y_XS, etc.)
      //    These represent a SINGLE extended size; ShopWorks stores the qty in
      //    Size01 (or wherever) but the slot index is meaningless because the
      //    SKU's suffix itself IS the size. Always use the suffix as the label.
      //
      // 2) Base SKU (PC90H with no suffix) — sizes S–3XL map to Size01–06 in
      //    SanMar order; use the canonical labels.
      const partNum = li.PartNumber || '';
      const suffixMatch = partNum.match(/_([0-9]+XL?|XS|XXS|YXS|YS|YM|YL|YXL)$/i);
      if (suffixMatch) {
        let label = suffixMatch[1].toUpperCase();
        // Normalize bare "2X"/"3X"/"4X" mainframe codes to "2XL"/"3XL"/"4XL"
        if (/^[2-6]X$/.test(label)) label += 'L';
        // Total qty for the line lives in LineQuantity (preferred) — Size01..06
        // are the sub-buckets but for a size-suffixed SKU there's effectively
        // only one size, so use the line total.
        const totalQty = Number(li.LineQuantity) || 0;
        if (totalQty > 0) return [{ size: label, qty: totalQty }];
      }

      // Base SKU — map Size01–06 to S, M, L, XL, 2XL, 3XL (SanMar standard).
      const labels = ['S','M','L','XL','2XL','3XL'];
      const out = [];
      for (let i = 1; i <= 6; i++) {
        const key = 'Size0' + i;
        const q = Number(li[key]);
        if (q && q > 0) out.push({ size: labels[i - 1] || `Size${i}`, qty: q });
      }
      return out;
    }

    locationsForDesign(order) {
      // ShopWorks may list multiple designs each with locations. For
      // single-design invoices, surface their location names.
      const designs = order?.Designs || this.fullData?.shopWorks?.snapshot?.pushed?.Designs || [];
      if (!Array.isArray(designs) || designs.length === 0) return '';
      const locNames = [];
      designs.forEach(d => {
        const ls = d?.Locations || d?.locations || [];
        ls.forEach(l => {
          const name = l?.Name || l?.LocationName || l?.id_Location;
          if (name && !locNames.includes(String(name))) locNames.push(String(name));
        });
      });
      return locNames.join(' + ');
    }

    originalRowsToInvoiceRows(rows, orig) {
      // Submission rows look roughly like { style, color, sizes: {S:0,M:5,...}, unitPrice, ... }
      return rows.map(r => {
        const sizes = r.sizes || {};
        const totalQty = Object.values(sizes).reduce((s, n) => s + (Number(n) || 0), 0) || Number(r.qty) || 0;
        const unit = Number(r.unitPrice) || Number(r.pricePerPiece) || 0;
        const total = Number(r.totalPrice) || (unit * totalQty);
        const sizeBreakdown = Object.keys(sizes)
          .filter(k => Number(sizes[k]) > 0)
          .map(k => `${k.toUpperCase()}: ${sizes[k]}`).join(', ');
        return {
          style: r.style || r.styleNumber || r.partNumber || '—',
          color: r.color || r.colorName || '',
          desc: [r.description, sizeBreakdown].filter(Boolean).join(' — '),
          locations: Array.isArray(r.locations) ? r.locations.join(' + ') : (r.locations || ''),
          qty: totalQty, unit, total,
        };
      });
    }

    quoteItemsToInvoiceRows(items) {
      return items.map(it => {
        const qty   = Number(it.Quantity) || Number(it.TotalQuantity) || 0;
        const unit  = Number(it.UnitPrice) || Number(it.FinalUnitPrice) || 0;
        const total = Number(it.LineTotal) || Number(it.TotalAmount) || (unit * qty);
        return {
          style: it.StyleNumber || it.ProductName || '—',
          color: it.Color || it.ColorName || '',
          desc:  it.ProductName || it.Description || '',
          locations: it.PrintLocation || '',
          qty, unit, total,
        };
      });
    }

    buildLineRow(row) {
      const tr = el('tr');
      // Item / Style
      tr.appendChild(el('td', { class: 'col-style', text: row.style || '—' }));
      // Color
      tr.appendChild(el('td', { class: 'col-color', text: row.color || '' }));
      // Description (with optional locations chip beneath)
      const descCell = el('td', { class: 'col-desc' });
      if (row.desc) descCell.appendChild(document.createTextNode(row.desc));
      if (row.locations) {
        descCell.appendChild(el('div', {
          class: 'invoice-item-locations',
          text: row.locations,
        }));
      }
      tr.appendChild(descCell);
      // Qty
      tr.appendChild(el('td', { class: 'col-qty', text: row.qty ? String(row.qty) : '—' }));
      // Unit
      tr.appendChild(el('td', { class: 'col-unit', text: row.unit ? fmtMoney(row.unit) : '—' }));
      // Total
      tr.appendChild(el('td', { class: 'col-total', text: row.total ? fmtMoney(row.total) : '—' }));
      return tr;
    }

    // ---------- totals ----------

    renderTotals(data, order, orig) {
      // Prefer ShopWorks dollars when present
      const fromOrder = order && Number.isFinite(Number(order.cur_SubTotal));
      const subtotal  = fromOrder ? Number(order.cur_SubTotal)        : Number(orig?.totals?.subtotal || data.sessionRaw?.SubtotalAmount || 0);
      const tax       = fromOrder ? Number(order.cur_SalesTaxTotal)    : Number(orig?.totals?.tax      || 0);
      const shipping  = fromOrder ? Number(order.cur_Shipping)         : Number(orig?.totals?.shipping || 0);
      const grand     = fromOrder ? Number(order.cur_TotalInvoice)     : Number(orig?.totals?.total    || data.sessionRaw?.TotalAmount || 0);
      const payments  = fromOrder ? Number(order.cur_Payments)         : 0;
      const balance   = fromOrder ? Number(order.cur_Balance)          : grand;
      // AMOUNT DUE = ShopWorks balance when known, otherwise grand - payments.
      const amountDue = fromOrder ? balance : (grand - payments);

      $('total-subtotal').textContent = fmtMoney(subtotal);
      $('total-tax').textContent      = fmtMoney(tax);
      $('total-shipping').textContent = fmtMoney(shipping);
      $('total-grand').textContent    = fmtMoney(grand);
      $('total-amount-due').textContent = fmtMoney(amountDue);

      // Hide shipping row if zero
      if (!shipping) $('shipping-row').style.display = 'none';

      // Compute tax rate (when both subtotal and tax > 0). Use parenthetical
      // inline format "(9.50%)" — cleaner than the old "@ 9.50%" pill.
      const taxBase = subtotal + shipping;
      const rateEl = $('total-tax-rate');
      if (tax > 0 && taxBase > 0) {
        rateEl.textContent = `(${((tax / taxBase) * 100).toFixed(2)}%)`;
      } else {
        rateEl.textContent = '';
      }

      // Payments — only show when > 0 (most invoices: zero payments).
      if (payments > 0) {
        $('paid-row').style.display = 'flex';
        $('total-paid').textContent = '-' + fmtMoney(payments);
      }

      // Wire payment terms into the footer payment block.
      const termsText =
        order?.TermsName ||
        orig?.info?.paymentTerms ||
        data.sessionRaw?.PaymentTerms ||
        'on receipt';
      const termsEl = document.getElementById('invoice-payment-terms-text');
      if (termsEl) termsEl.textContent = termsText;
    }

    // ---------- footer / sync state ----------

    renderFooter(data, sw) {
      const lastSync = sw?.lastSynced;
      const bits = [];
      if (sw?.orderNumber) bits.push(`ShopWorks WO #${sw.orderNumber}`);
      if (lastSync) bits.push(`Synced ${relativeTime(lastSync)}`);
      $('footer-sync-info').textContent = bits.join(' · ');
    }

    renderSyncStatus(sw) {
      const statusEl = $('sync-status');
      if (!sw) {
        statusEl.innerHTML = '<span class="pill pill--pending">Pending import</span>';
        return;
      }
      const last = sw.lastSynced ? new Date(sw.lastSynced).getTime() : 0;
      const ageHours = last ? (Date.now() - last) / 3600000 : Infinity;
      const stale = ageHours > 24;
      const ok = sw.snapshot && !stale;
      const pillClass = ok ? 'pill--ok' : (sw.snapshot ? 'pill--stale' : 'pill--pending');
      const label = ok
        ? `ShopWorks #${sw.orderNumber} · ${relativeTime(sw.lastSynced)}`
        : (sw.snapshot
            ? `ShopWorks #${sw.orderNumber} · stale (${relativeTime(sw.lastSynced)})`
            : 'Pending import');
      statusEl.innerHTML = `<span class="pill ${pillClass}">${escapeHTML(label)}</span>`;
    }

    // ---------- toolbar ----------

    wireToolbar() {
      $('btn-print').addEventListener('click', () => window.print());
      $('btn-refresh').addEventListener('click', () => this.syncNow(true));
      const back = $('btn-back-to-quote');
      if (back) back.setAttribute('href', `/quote/${encodeURIComponent(this.quoteId)}`);
    }

    async maybeAutoSync() {
      const sw = this.fullData?.shopWorks;
      const status = this.fullData?.status;
      // Only auto-sync Processed quotes (i.e. already submitted to ShopWorks)
      // and only when the snapshot is missing or older than 30 minutes.
      if (status !== 'Processed') return;
      const last = sw?.lastSynced ? new Date(sw.lastSynced).getTime() : 0;
      const ageMin = last ? (Date.now() - last) / 60000 : Infinity;
      if (ageMin > 30) {
        // Fire-and-forget — don't block UI
        this.syncNow(false);
      }
    }

    async syncNow(showSpinner) {
      const btn = $('btn-refresh');
      if (showSpinner) {
        btn.disabled = true;
        btn.textContent = 'Syncing…';
      }
      try {
        const resp = await fetch(
          `/api/quote-sessions/${encodeURIComponent(this.quoteId)}/sync-from-shopworks`,
          { method: 'POST' },
        );
        if (!resp.ok) throw new Error(`Sync failed (${resp.status})`);
        const result = await resp.json();
        if (result.deleted) {
          // ShopWorks side removed this order → bounce back to staff queue.
          window.location.href = `/staff/quotes?deleted=${encodeURIComponent(this.quoteId)}`;
          return;
        }
        // Reload fresh data and re-render
        await this.loadFullData();
        this.render();
      } catch (err) {
        console.error('[invoice] sync failed:', err);
        if (showSpinner) {
          alert('Sync failed. Try again in a moment, or open the order in ShopWorks.');
        }
      } finally {
        if (showSpinner) {
          btn.disabled = false;
          btn.innerHTML = '🔄 Refresh from ShopWorks';
        }
      }
    }
  }

  // boot
  document.addEventListener('DOMContentLoaded', () => {
    const page = new InvoicePage();
    window.invoicePage = page;
    page.init();
  });
})();
