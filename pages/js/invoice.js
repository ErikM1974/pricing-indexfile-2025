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

  // Date-only values must not shift a day west of Greenwich. Two shapes:
  //   - bare 'YYYY-MM-DD' — spec-parsed as UTC midnight;
  //   - ManageOrders date fields — ShopWorks stores date-only, MO serializes
  //     them as 'YYYY-MM-DDT00:00:00.000Z' (exact UTC midnight), so a
  //     requested-ship of Sep 4 rendered as Sep 3 in Pacific (WO 142999).
  // Both mean "this calendar day" — build them from parts (local time).
  function parseDateSafe(s) {
    const m = typeof s === 'string' &&
      s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(s);
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = parseDateSafe(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function fmtDateShort(s) {
    if (!s) return '';
    const d = parseDateSafe(s);
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
      this.isStaff = false;
      this.syncing = false;
      this.shipAction = false;
      this.shipSending = false;
    }

    parseQuoteId() {
      // Path is /invoice/:quoteId — last non-empty path segment.
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    }

    async init() {
      if (!this.quoteId) return this.showError('No quote ID provided in URL.');
      const identity = this.resolveStaffIdentity();
      try {
        await this.loadFullData();
        this.render();
        this.wireToolbar();
        $('loading').hidden = true;
        $('invoice').hidden = false;
        $('invoice-public-actions').hidden = false;
        document.title = `Invoice ${this.headerOrderNumber()} - Northwest Custom Apparel`;
        identity.then(isStaff => {
          this.isStaff = isStaff;
          $('toolbar').hidden = !isStaff;
          this.updateShipStationButton();
        });
        this.maybeAutoSync();
      } catch (err) {
        console.error('[invoice] load failed:', err);
        this.showError(err && err.message ? err.message : 'Failed to load invoice.');
      }
    }

    async resolveStaffIdentity() {
      try {
        const response = await fetch('/api/crm-session/me', { credentials: 'same-origin' });
        const me = response.ok ? await response.json() : null;
        return !!(me && me.authenticated !== false && (me.name || me.email));
      } catch (_) { return false; }
    }

    shareTokenParam() {
      const token = new URLSearchParams(window.location.search).get('k');
      return token ? '?k=' + encodeURIComponent(token) : '';
    }

    showError(msg) {
      $('loading').hidden = true;
      $('toolbar').hidden = true;
      $('invoice').hidden = true;
      $('invoice-public-actions').hidden = true;
      $('error-message').textContent = msg;
      $('error').hidden = false;
    }

    async loadFullData() {
      const resp = await fetch(`/api/quote-sessions/${encodeURIComponent(this.quoteId)}/full${this.shareTokenParam()}`);
      if (!resp.ok) {
        if (resp.status === 404) throw new Error(`Quote ${this.quoteId} was not found.`);
        throw new Error(`Server returned ${resp.status} when loading quote.`);
      }
      const fresh = await resp.json();
      this.fullData = fresh;
      // Cached storefront projections belong to the current response only.
      delete this._sfCustomer;
      delete this._sfSettings;
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

    // Storefront orders (custom-tees / custom-caps / samples) don't write the
    // Notes-JSON originalSubmission the quote builders do — their checkout
    // blobs live in flat session columns. Parse lazily, cache on the instance.
    storefrontBlob(column, cacheKey) {
      if (this[cacheKey] !== undefined) return this[cacheKey];
      let parsed = null;
      const raw = this.fullData?.sessionRaw?.[column];
      if (raw) {
        try { parsed = JSON.parse(raw); }
        catch (_) { /* not a storefront order */ }
      }
      this[cacheKey] = parsed;
      return parsed;
    }
    storefrontCustomerData()  { return this.storefrontBlob('CustomerDataJSON', '_sfCustomer'); }
    storefrontOrderSettings() { return this.storefrontBlob('OrderSettingsJSON', '_sfSettings'); }

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
      this.renderCustomerArtwork(data);
      this.renderTotals(data, order, orig);
      this.renderFooter(data, sw);
      this.renderSyncStatus(sw);
      this.renderStatusBanner(data, order);
      // Refresh the ShipStation button state — guarded with optional chaining
      // in case the toolbar isn't yet in the DOM during early renders.
      if (typeof this.updateShipStationButton === 'function') this.updateShipStationButton();
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
      const banner = $('status-banner');
      const text   = banner ? banner.querySelector('.invoice-status-text') : null;
      const icon   = banner ? banner.querySelector('.invoice-status-icon') : null;
      const detail = $('status-banner-detail');
      if (!banner) return;

      // CANCELLED state takes priority over RUSH. When ShopWorks operator
      // deleted the order, the cron flips Status='Cancelled_in_ShopWorks'
      // and the row is kept for 30 days before purge.
      if (data.status === 'Cancelled_in_ShopWorks') {
        banner.classList.add('invoice-status-banner--cancelled');
        if (icon) icon.textContent = '⊘';
        if (text) text.textContent = 'CANCELLED IN SHOPWORKS';
        if (detail) {
          const ts = data.sessionRaw?.ShopWorks_Last_Synced;
          detail.textContent = ts
            ? '— Order deleted in ShopWorks on ' + fmtDate(ts) + '. This record will be purged after 30 days.'
            : '— Order was deleted in ShopWorks. This record will be purged after 30 days.';
        }
        banner.hidden = false;
        return;
      }

      // Default RUSH state. Show banner when ANY of:
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

      if (!rushFlag) {
        banner.hidden = true;
        return;
      }
      banner.classList.remove('invoice-status-banner--cancelled');
      if (icon) icon.textContent = '⚡';
      if (text) text.textContent = 'RUSH ORDER';
      banner.hidden = false;

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

      // Storefront orders (custom-tees/caps/samples — the only writers of
      // CustomerDataJSON) land on the webstore CATCH-ALL customer, so once
      // imported, order.CustomerName and the CompanyContactsMerge2026 record
      // are OUR OWN store — not the buyer. The person who checked out IS the
      // bill-to: prefer their identity + billing address whenever the session
      // carries the storefront blob. (Erik 2026-09-01, seen on WO 142999.)
      const sfCd = this.storefrontCustomerData() || {};
      const isStorefront = !!this.storefrontCustomerData();
      const sfName = [sfCd.firstName, sfCd.lastName].filter(Boolean).join(' ');

      // Customer / company — three-tier priority (storefront buyer first)
      const customer =
        (isStorefront ? (sfCd.company || sfName || data.sessionRaw?.CustomerName) : '') ||
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
        (isStorefront ? sfName : '') ||
        swContact ||
        billing?.contactName ||
        orig?.info?.name ||
        data.sessionRaw?.CustomerName ||
        '';
      $('bill-contact-name').textContent = contact && contact !== customer ? contact : '';

      // Billing street address. Storefront: the checkout's billing block
      // (same per-field billing||shipping fallback the ShopWorks push uses,
      // so this matches what OnSite got; samples uses snake_case billing_*).
      // Builders: CompanyContactsMerge2026 first (authoritative), then
      // whatever the rep typed at submit.
      const sfBillA1 = isStorefront
        ? (sfCd.billingAddress1 || sfCd.billing_address1 || sfCd.address1 || sfCd.address || '')
        : '';
      // Storefront billing blocks never carry an address2 of their own — only
      // borrow the shipping address2 when the shipping address is standing in
      // for billing (no separate billing street was given).
      const sfBillA2 = isStorefront && !(sfCd.billingAddress1 || sfCd.billing_address1)
        ? (sfCd.address2 || sfCd.billing_address2 || '')
        : (sfCd.billing_address2 || '');
      const billAddr1 =
        sfBillA1 ||
        billing?.address1 ||
        orig?.info?.address ||
        orig?.info?.address1 ||
        orig?.info?.billingAddress ||
        '';
      const billAddr2 =
        (isStorefront ? sfBillA2 : '') ||
        billing?.address2 ||
        orig?.info?.address2 ||
        '';
      const billCity  = (isStorefront ? (sfCd.billingCity  || sfCd.billing_city  || sfCd.city  || '') : '') || billing?.city  || orig?.info?.city  || '';
      const billState = (isStorefront ? (sfCd.billingState || sfCd.billing_state || sfCd.state || '') : '') || billing?.state || orig?.info?.state || '';
      const billZip   = (isStorefront ? (sfCd.billingZip   || sfCd.billing_zip   || sfCd.zip || sfCd.zipCode || '') : '') || billing?.zip || orig?.info?.zip || '';
      const billCityState =
        [billCity, billState].filter(Boolean).join(', ') +
        (billZip ? ' ' + billZip : '');

      $('bill-address-line1').textContent = billAddr1;
      $('bill-address-line1').hidden = !billAddr1;

      $('bill-address-line2').textContent = billAddr2;
      $('bill-address-line2').hidden = !billAddr2;

      $('bill-address-citystate').textContent = billCityState.trim();
      $('bill-address-citystate').hidden = !billCityState.trim();

      // Email / phone — quote-specific contact info takes priority over
      // the company-record values (rep may have keyed a different contact).
      const email =
        order?.ContactEmail ||
        orig?.info?.email ||
        data.sessionRaw?.CustomerEmail ||
        billing?.email ||
        '';
      $('bill-email').textContent = email;

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
      $('bill-phone').textContent = phone;
    }

    renderShipTo(data, order, orig, pushed) {
      // ShopWorks /v1/orders doesn't expose ShippingAddresses;
      // the order-pull snapshot does (pushed.ShippingAddresses[0]).
      const pushedShip = (pushed?.ShippingAddresses || [])[0];
      let ship = pushedShip ? {
        method:    pushedShip.ShipMethod || '',
        address1:  pushedShip.ShipAddress01 || '',
        address2:  pushedShip.ShipAddress02 || '',
        city:      pushedShip.ShipCity || '',
        state:     pushedShip.ShipState || '',
        zip:       pushedShip.ShipZip || '',
        company:   pushedShip.ShipCompany || '',
        name:      pushedShip.ShipName || '',
      } : (orig?.ship || {});

      // Storefront fallback (pre-import): custom-tees/caps/samples orders have
      // no originalSubmission.ship — the address the customer typed at checkout
      // lives in the session's CustomerDataJSON column. Without this, Ship To
      // rendered "—" until ShopWorks imported + synced (DTG0831-2727).
      if (!ship.address1 && !ship.address && !ship.method && ship.isPickup !== true) {
        const cd = this.storefrontCustomerData();
        if (cd) {
          ship = {
            // Mirrors the push (server.js shipping.method): pickup or UPS Ground.
            // Samples-channel blobs use snake_case shipping_* field names.
            method:   cd.deliveryMethod === 'pickup' ? 'Customer Pickup' : (cd.shippingMethod || 'UPS Ground'),
            address1: cd.address1 || cd.address || cd.shipping_address1 || '',
            address2: cd.address2 || cd.shipping_address2 || '',
            city:     cd.city || cd.shipping_city || '',
            state:    cd.state || cd.shipping_state || '',
            zip:      cd.zip || cd.zipCode || cd.shipping_zip || '',
            company:  cd.company || '',
            name:     [cd.firstName, cd.lastName].filter(Boolean).join(' '),
          };
        }
      }

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
        recipient = ship.company || ship.name || data.sessionRaw?.CompanyName || orig?.info?.company || data.sessionRaw?.CustomerName || '—';
        line1     = ship.address1 || ship.address || '';
        line2     = ship.address2 || '';
        const city = ship.city || '';
        const state = ship.state || '';
        const zip = ship.zip || '';
        cityState = [city, state].filter(Boolean).join(', ') + (zip ? ' ' + zip : '');
      }

      $('ship-recipient').textContent = recipient;
      $('ship-line1').textContent     = line1;
      $('ship-line1').hidden = !line1;
      $('ship-line2').textContent     = line2;
      $('ship-line2').hidden = !line2;
      $('ship-citystate').textContent = cityState;
      $('ship-citystate').hidden = !cityState.trim();

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

      // Req Ship Date — storefront orders stamp the binding ship promise in
      // OrderSettingsJSON at checkout (shipPromise.iso = end of the window).
      const reqShip =
        order?.date_RequestedToShip ||
        orig?.info?.requestedShipDate ||
        data.sessionRaw?.RequestedShipDate ||
        this.storefrontOrderSettings()?.shipPromise?.iso ||
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
      // designTypeLabel() always returns at least '—' (truthy), which would
      // short-circuit this || chain BEFORE the quote-ID inference — leaving
      // DECORATION blank on every quote without a pushed design. Only use it
      // when it yields a REAL label, else fall through to the prefix inference
      // (which is never blank). (2026-06-01)
      const dtLabel = pushedFirstDesign?.id_DesignType
        ? designTypeLabel(pushedFirstDesign.id_DesignType, null)
        : null;
      let decoType =
        (method && METHOD_LABELS[String(method).toLowerCase()]) ||
        (dtLabel && dtLabel !== '—' ? dtLabel : null) ||
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

      // Audit fix H3: group size-suffixed SKUs back into one logical product.
      // PC90H + PC90H_2X + PC90H_3XL + PC90H_4XL → one PC90H header row
      // with per-size sub-rows underneath. Customer reads 1 product (correct)
      // instead of 4 separate line items.
      const grouped = this.groupLineItemsByBaseSku(rows);
      grouped.forEach(group => {
        if (group.children && group.children.length > 0) {
          tbody.appendChild(this.buildLineRow(group.parent, { isGroupParent: true }));
          group.children.forEach(child => {
            tbody.appendChild(this.buildLineRow(child, { isGroupChild: true }));
          });
        } else {
          tbody.appendChild(this.buildLineRow(group.parent));
        }
      });
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
      // TAX / SHIP / DISCOUNT are order-level — they belong in the totals block, not as
      // line items (they were rendering as rows, double-showing tax). (2026-06-04 audit)
      const ORDER_LEVEL = new Set(['TAX', 'SHIP', 'SHIPPING', 'DISCOUNT']);
      return items.filter(it =>
          !(String(it.EmbellishmentType || '').toLowerCase() === 'fee' && ORDER_LEVEL.has(it.StyleNumber))
      ).map(it => {
        const qty   = Number(it.Quantity) || Number(it.TotalQuantity) || 0;
        let unit    = Number(it.UnitPrice) || Number(it.FinalUnitPrice) || 0;
        const total = Number(it.LineTotal) || Number(it.TotalAmount) || (unit * qty);
        // Storefront rows store the BASE size price in FinalUnitPrice with
        // extended-size upcharges only in LineTotal — rendered literally that
        // read "2 @ $29.50 = $61.00" (DTG0831-2727). Show the blended
        // per-piece price so unit × qty foots to the line total.
        if (qty > 0 && total > 0 && Math.abs(unit * qty - total) > 0.009) {
          unit = Math.round((total / qty) * 100) / 100;
        }
        // Size breakdown (stored as JSON on storefront rows) → description,
        // same "… — XL: 1, 2XL: 1" shape the post-import ShopWorks path renders.
        let sizeStr = '';
        if (it.SizeBreakdown) {
          try {
            const sb = JSON.parse(it.SizeBreakdown);
            sizeStr = Object.keys(sb)
              .filter(k => Number(sb[k]) > 0)
              .map(k => `${k}: ${sb[k]}`).join(', ');
          } catch (_) { /* legacy/plain-text rows */ }
        }
        return {
          style: it.StyleNumber || it.ProductName || '—',
          color: it.Color || it.ColorName || '',
          desc:  [it.ProductName || it.Description || '', sizeStr].filter(Boolean).join(' — '),
          locations: it.PrintLocation || '',
          qty, unit, total,
        };
      });
    }

    buildLineRow(row, opts) {
      opts = opts || {};
      const tr = el('tr');
      // Apply grouping classes — CSS dims/indents children for visual hierarchy.
      if (opts.isGroupParent) tr.classList.add('invoice-item-row--group-parent');
      if (opts.isGroupChild)  tr.classList.add('invoice-item-row--group-child');

      // Item / Style — children show the size suffix only (parent shows base PN).
      tr.appendChild(el('td', { class: 'col-style', 'data-label': 'Item', text: row.style || '—' }));
      // Color
      tr.appendChild(el('td', { class: 'col-color', 'data-label': 'Color', text: row.color || '' }));
      // Description (with optional locations chip beneath)
      const descCell = el('td', { class: 'col-desc', 'data-label': 'Description' });
      if (row.desc) descCell.appendChild(document.createTextNode(row.desc));
      if (row.locations) {
        descCell.appendChild(el('div', {
          class: 'invoice-item-locations',
          text: row.locations,
        }));
      }
      tr.appendChild(descCell);
      // Qty
      tr.appendChild(el('td', { class: 'col-qty', 'data-label': 'Qty', text: row.qty ? String(row.qty) : '—' }));
      // Unit (parent of a group shows blank since per-size unit prices vary)
      tr.appendChild(el('td', { class: 'col-unit', 'data-label': 'Unit Price', text: row.unit ? fmtMoney(row.unit) : (opts.isGroupParent ? 'varies' : '—') }));
      // Total
      tr.appendChild(el('td', { class: 'col-total', 'data-label': 'Total', text: row.total ? fmtMoney(row.total) : '—' }));
      return tr;
    }

    /**
     * Audit fix H3: collapse size-suffixed SKUs back into one logical product.
     *
     * Input:  [{style:'PC90H',...}, {style:'PC90H_2X',...}, {style:'PC90H_3XL',...}, {style:'PC54Y',...}]
     * Output: [
     *   { parent: {style:'PC90H', qty:10, total:468, desc:base+'Sizes: S-4XL'}, children: [child1, child2, child3, child4] },
     *   { parent: {style:'PC54Y', ...}, children: [] }   // single-SKU products stay flat
     * ]
     *
     * Base SKU = PartNumber with any size suffix stripped. Suffix detection
     * regex matches: _XS, _XXS, _2X..._6X, _2XL..._6XL, _YXS/YS/YM/YL/YXL.
     * Same patterns as collectSizesFromLineItem so size labels align.
     *
     * Single-SKU groups (no siblings) collapse back to flat rows so a single-
     * size order doesn't get unnecessary visual nesting.
     */
    groupLineItemsByBaseSku(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const SUFFIX_RE = /_([0-9]+XL?|XS|XXS|YXS|YS|YM|YL|YXL)$/i;
      const byBase = new Map();          // base PN → array of row indices
      const insertOrder = [];            // preserves original order

      rows.forEach((row, i) => {
        const style = String(row.style || '').trim();
        const m = style.match(SUFFIX_RE);
        const baseKey = (m ? style.slice(0, m.index) : style) + '|' + (row.color || '');
        if (!byBase.has(baseKey)) {
          byBase.set(baseKey, []);
          insertOrder.push(baseKey);
        }
        byBase.get(baseKey).push(i);
      });

      const result = [];
      for (const key of insertOrder) {
        const indices = byBase.get(key);
        // Single-SKU groups → flat row (no grouping)
        if (indices.length === 1) {
          result.push({ parent: rows[indices[0]], children: [] });
          continue;
        }
        // Multi-SKU group → roll up qty + total + locations into parent.
        const groupRows = indices.map(i => rows[i]);
        // Pick the row WITHOUT a size suffix as the "base" — its PartDescription
        // is the canonical product name. Fall back to first row if all suffixed.
        const baseRow = groupRows.find(r => !SUFFIX_RE.test(String(r.style || ''))) || groupRows[0];
        const baseStyle = String(baseRow.style || '').replace(SUFFIX_RE, '');
        const baseDesc = (baseRow.desc || '').split(' — ')[0].split(',')[0]; // strip size detail
        const totalQty   = groupRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
        const totalDollars = groupRows.reduce((s, r) => s + (Number(r.total) || 0), 0);

        const parent = {
          style: baseStyle,
          color: baseRow.color,
          desc:  baseDesc || baseRow.desc,
          locations: baseRow.locations || '',
          qty:   totalQty,
          unit:  0,            // varies — buildLineRow shows "varies" placeholder
          total: totalDollars,
        };
        // Children = each per-size line, with style trimmed to just the suffix
        // (e.g. "_3XL" → "3XL") for cleaner display under the parent row.
        const children = groupRows.map(r => {
          const sStyle = String(r.style || '');
          const sm = sStyle.match(SUFFIX_RE);
          const sizeLabel = sm ? sm[1].toUpperCase().replace(/^([2-6]X)$/, '$1L') : (sStyle.replace(baseStyle, '').replace(/^_/, '') || '—');
          return {
            ...r,
            style: '↳ ' + sizeLabel,    // arrow indent + size label
            desc:  r.desc,
            color: '',                  // color inherits from parent; blank to avoid dup
            locations: '',              // locations only on parent
          };
        });
        result.push({ parent, children });
      }
      return result;
    }

    // ---------- customer artwork & mockups ----------

    /**
     * Customer Artwork & Mockups (2026-06-10) — Custom T-Shirts storefront
     * orders (QuoteID prefix DTG, e.g. DTG0610-1234) store the customer's
     * ORIGINAL uploaded art files + approved mockup renders in
     * quote_sessions.OrderSettingsJSON:
     *   frontLogo / backLogo: { fileUrl, fileName }   (Caspio Files via proxy)
     *   mockups:  [{ color, catalogColor, view, url }, ...]
     * Staff opening /invoice/:id need to view + download them. Quote types
     * without these keys render nothing. The section is screen-only —
     * @media print in invoice.css hides it so the PDF stays a clean invoice.
     * Defensive: malformed JSON must never break the rest of the page.
     */
    renderCustomerArtwork(data) {
      // A refresh may remove artwork; never leave the previous response's files visible.
      document.getElementById('customer-artwork-section')?.remove();
      try {
        const raw = data?.sessionRaw?.OrderSettingsJSON;
        if (!raw) return;

        let settings;
        try {
          settings = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        } catch (parseErr) {
          console.warn('[invoice] OrderSettingsJSON parse failed:', parseErr);
          return;
        }
        if (!settings || typeof settings !== 'object') return;

        const logos = [];
        if (settings.frontLogo && settings.frontLogo.fileUrl) {
          logos.push({ label: 'Front artwork', fileUrl: settings.frontLogo.fileUrl, fileName: settings.frontLogo.fileName || 'front-artwork' });
        }
        if (settings.backLogo && settings.backLogo.fileUrl) {
          logos.push({ label: 'Back artwork', fileUrl: settings.backLogo.fileUrl, fileName: settings.backLogo.fileName || 'back-artwork' });
        }
        const mockups = (Array.isArray(settings.mockups) ? settings.mockups : []).filter(m => m && m.url);
        if (!logos.length && !mockups.length) return;

        // fileUrl has no extension (proxy /api/files/<key>) — sniff image-ness
        // from the original fileName so PDFs/AI files get a 📄 instead of a
        // broken <img>.
        const isImageName = (name) => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(String(name || ''));

        const logoCard = (logo) => {
          const url = escapeHTML(logo.fileUrl);
          const name = escapeHTML(logo.fileName);
          const label = escapeHTML(logo.label);
          const thumb = isImageName(logo.fileName)
            ? `<img src="${url}" alt="${label}" loading="lazy"
                    data-art-fallback>
               <div class="cust-art-thumb-icon" hidden>📄</div>`
            : `<div class="cust-art-thumb-icon">📄</div>`;
          return `
            <div class="cust-art-card">
              <a class="cust-art-thumb" href="${url}" target="_blank" rel="noopener" title="Open full size in a new tab">${thumb}</a>
              <div class="cust-art-meta">
                <div class="cust-art-label">${label}</div>
                <div class="cust-art-filename" title="${name}">${name}</div>
                <a class="cust-art-download" href="${url}" download="${name}" target="_blank" rel="noopener">⬇ Download</a>
              </div>
            </div>
          `;
        };

        const mockupCard = (m, i) => {
          const url = escapeHTML(m.url);
          const viewRaw = String(m.view || '');
          const viewLabel = viewRaw ? viewRaw.charAt(0).toUpperCase() + viewRaw.slice(1) : `Mockup ${i + 1}`;
          const label = escapeHTML([viewLabel, m.color].filter(Boolean).join(' — '));
          const dlName = escapeHTML(
            [this.quoteId || 'mockup', viewRaw || (i + 1), m.catalogColor || m.color || '']
              .filter(Boolean).join('-').replace(/[^\w.-]+/g, '_') + '.png'
          );
          return `
            <div class="cust-art-card">
              <a class="cust-art-thumb" href="${url}" target="_blank" rel="noopener" title="Open full size in a new tab">
                <img src="${url}" alt="${label}" loading="lazy"
                     data-art-fallback>
                <div class="cust-art-thumb-icon" hidden>🖼</div>
              </a>
              <div class="cust-art-meta">
                <div class="cust-art-label">${label}</div>
                <a class="cust-art-download" href="${url}" download="${dlName}" target="_blank" rel="noopener">⬇ Download</a>
              </div>
            </div>
          `;
        };

        let html = '<div class="cust-art-heading">Customer Artwork &amp; Mockups</div>';
        if (logos.length) {
          html += `
            <div class="cust-art-subhead">Customer Artwork (original files)</div>
            <div class="cust-art-grid">${logos.map(logoCard).join('')}</div>
          `;
        }
        if (mockups.length) {
          html += `
            <div class="cust-art-subhead">Approved Mockups</div>
            <div class="cust-art-grid">${mockups.map(mockupCard).join('')}</div>
          `;
        }

        // Mount (idempotent across re-renders/syncs): between the line items
        // table and the totals block.
        let section = document.getElementById('customer-artwork-section');
        if (!section) {
          section = document.createElement('section');
          section.id = 'customer-artwork-section';
          section.className = 'cust-art-section';
          const totals = document.querySelector('.invoice-totals');
          if (totals && totals.parentNode) {
            totals.parentNode.insertBefore(section, totals);
          } else {
            const invoice = $('invoice');
            if (!invoice) return;
            invoice.appendChild(section);
          }
        }
        section.innerHTML = html;
        section.querySelectorAll('img[data-art-fallback]').forEach(image => {
          image.addEventListener('error', () => {
            image.hidden = true;
            if (image.nextElementSibling) image.nextElementSibling.hidden = false;
          });
        });
      } catch (err) {
        // Never let artwork rendering break the rest of the invoice.
        console.warn('[invoice] customer artwork render failed:', err);
      }
    }

    // ---------- totals ----------

    renderTotals(data, order, orig) {
      // Prefer ShopWorks dollars when present. Otherwise (pre-import quote) fall back to the
      // SAVED session amounts so the invoice foots. TotalAmount is the pre-tax total INCLUDING
      // all service/AL fees (it matches the rendered line items); SubtotalAmount is products-only
      // and would under-foot. Tax falls back to the saved TaxAmount (was $0 → wrong tax + pre-tax
      // grand on pre-import WA orders), and the grand is computed = subtotal + tax + shipping.
      // (2026-06-04 audit)
      const fromOrder = order && Number.isFinite(Number(order.cur_SubTotal));
      const subtotalNet = fromOrder ? Number(order.cur_SubTotal)   : Number(orig?.totals?.subtotal ?? data.sessionRaw?.TotalAmount ?? data.sessionRaw?.SubtotalAmount ?? 0);
      const tax       = fromOrder ? Number(order.cur_SalesTaxTotal) : Number(orig?.totals?.tax      ?? data.sessionRaw?.TaxAmount ?? 0);
      // P1-8 (audit 2026-06-06): pre-import, fall back to the saved SHIP fee item so shipping dollars are in
      // the grand total (they were omitted while still being taxed). Mirrors quote-view's getShippingFee().
      const _items = data.quoteItems || [];
      const _feeItem = (sn) => _items.find(i => String(i.EmbellishmentType).toLowerCase() === 'fee' && String(i.StyleNumber).toUpperCase() === sn);
      const _shipItem = _feeItem('SHIP') || _feeItem('SHIPPING');
      const shipping  = fromOrder ? Number(order.cur_Shipping)      : Number(orig?.totals?.shipping  ?? (_shipItem ? Number(_shipItem.LineTotal) : 0));
      // P1-7 (audit 2026-06-06): pre-import, surface the saved DISCOUNT so the invoice FOOTS — TotalAmount is
      // already net of discount, but the rendered line items are full price. Show a pre-discount subtotal +
      // a Discount row; the grand stays net + tax + shipping.
      const _discItem = _feeItem('DISCOUNT');
      const discount  = fromOrder ? 0 : (_discItem ? Math.abs(Number(_discItem.LineTotal)) : 0);
      const subtotal  = subtotalNet + discount;   // pre-discount — matches the rendered line items
      const grand     = fromOrder ? Number(order.cur_TotalInvoice)  : Number(orig?.totals?.total     ?? (subtotalNet + tax + shipping));
      const payments  = fromOrder ? Number(order.cur_Payments)      : 0;
      const balance   = fromOrder ? Number(order.cur_Balance)       : grand;
      // AMOUNT DUE = ShopWorks balance when known, otherwise grand - payments.
      const amountDue = fromOrder ? balance : (grand - payments);

      $('total-subtotal').textContent = fmtMoney(subtotal);
      $('total-tax').textContent      = fmtMoney(tax);
      $('total-shipping').textContent = fmtMoney(shipping);
      $('total-grand').textContent    = fmtMoney(grand);
      $('total-amount-due').textContent = fmtMoney(amountDue);

      // Discount row — only when there's a discount (P1-7)
      $('total-discount').textContent = discount > 0 ? '-' + fmtMoney(discount) : fmtMoney(0);
      $('discount-row').hidden = !(discount > 0);

      // Hide shipping row if zero
      $('shipping-row').hidden = !shipping;

      // Compute tax rate (when both subtotal and tax > 0). Three-state
      // display per audit fix M5:
      //   • "(X%)" — tax was charged
      //   • "(Tax Exempt)" — customer is tax-exempt per CompanyContactsMerge2026
      //   • "(0% — Out of State)" — non-WA customer, tax=0 by default
      //   • blank — no taxable base
      // [B9] (audit 2026-06-06): tax was computed on the POST-discount base, so the % label must divide by
      // subtotalNet — dividing by the pre-discount `subtotal` under-reported the rate on discounted quotes.
      const taxBase = subtotalNet + shipping;
      const rateEl = $('total-tax-rate');
      const isExempt = !!(data.billingContact && data.billingContact.isTaxExempt);
      rateEl.classList.remove('invoice-tax-exempt');
      if (tax > 0 && taxBase > 0) {
        rateEl.textContent = `(${((tax / taxBase) * 100).toFixed(2)}%)`;
      } else if (isExempt && subtotal > 0) {
        const cert = data.billingContact?.taxExemptNumber;
        rateEl.textContent = cert ? `(Tax Exempt · Cert # ${cert})` : '(Tax Exempt)';
        rateEl.classList.add('invoice-tax-exempt');  // forest green to match exempt status
      } else if (subtotal > 0 && tax === 0) {
        // Wholesale/resale (permit on file) is a different zero-tax reason than
        // shipping out of state — saying "Out of State" on a Milton wholesaler's
        // invoice reads as an error. (audit 2026-06-10)
        const isWholesale = data.sessionRaw?.IsWholesale === 'Yes' || data.sessionRaw?.IsWholesale === true;
        rateEl.textContent = isWholesale ? '(Wholesale / Resale — No Tax)' : '(0% — Out of State)';
        if (isWholesale) rateEl.classList.add('invoice-tax-exempt');
      } else {
        rateEl.textContent = '';
      }

      // Payments — only show when > 0 (most invoices: zero payments).
      $('paid-row').hidden = !(payments > 0);
      $('total-paid').textContent = payments > 0 ? '-' + fmtMoney(payments) : fmtMoney(0);

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
      $('invoice-public-actions').append($('btn-back-to-quote'), $('btn-print'));
      $('btn-print').addEventListener('click', () => { if (!this.syncing) window.print(); });
      $('btn-refresh').addEventListener('click', () => this.syncNow(true));
      const back = $('btn-back-to-quote');
      if (back) back.setAttribute('href', `/quote/${encodeURIComponent(this.quoteId)}${this.shareTokenParam()}`);
      // Wire the ShipStation button — initial visibility decided by
      // updateShipStationButton() which runs after each render.
      const ssBtn = $('btn-shipstation');
      if (ssBtn) ssBtn.addEventListener('click', () => this.sendToShipStation());
      this.updateShipStationButton();
    }

    /**
     * Show / hide / relabel the Send-to-ShipStation button based on current
     * data state. Called from wireToolbar (init) + after every render.
     *
     * States:
     *   • Hidden — when shipping = Customer Pickup OR no ShopWorks snapshot yet
     *   • "🚢 Send to ShipStation" — order is ready to ship, not yet sent
     *   • "✓ In ShipStation #N" (disabled) — already sent, awaiting label
     *   • "📦 Shipped — UPS 1Z..." (disabled, link) — label bought + tracking
     */
    updateShipStationButton() {
      const btn = $('btn-shipstation'), tracking = $('shipstation-tracking');
      const data = this.fullData || {}, ss = data.shipStation, order = data.shopWorks?.snapshot?.order;
      const pushedShip = (data.shopWorks?.snapshot?.pushed?.ShippingAddresses || [])[0];
      const method = (pushedShip?.ShipMethod || data.originalSubmission?.ship?.method || '').toString();
      const lower = method.toLowerCase();
      btn.classList.remove('invoice-ship-override');
      tracking.hidden = true;
      btn.hidden = !this.isStaff;
      if (!this.isStaff) return;
      // A terminal shipment always wins over the original carrier/method choice.
      if (ss && ss.status === 'shipped' && ss.trackingNumber) {
        btn.hidden = true;
        tracking.textContent = String(ss.trackingNumber);
        let href = '#';
        try { const url = new URL(ss.trackingURL || '#', location.origin); if (/^https?:$/.test(url.protocol)) href = url.href; } catch (_) { /* no usable tracking destination */ }
        tracking.href = href;
        tracking.title = `Shipped · Carrier: ${ss.trackingCarrier || 'unknown'}`;
        tracking.hidden = false;
        return;
      }
      if (ss && ss.status === 'shipped') {
        btn.disabled = true;
        btn.textContent = '✓ Shipped';
        btn.title = 'This order has already shipped. Tracking is not available yet.';
        return;
      }
      if (ss && ss.orderId) {
        btn.disabled = true;
        btn.textContent = `✓ In ShipStation #${ss.orderId}`;
        btn.title = 'Already pushed. Warehouse buys the label in ShipStation UI; tracking will appear here once shipped.';
        return;
      }
      if (lower.includes('pickup') || lower.includes('willcall') || (!order && !data.originalSubmission)) { btn.hidden = true; return; }
      if (this.shipSending || this.syncing) {
        btn.disabled = true;
        btn.textContent = this.shipSending ? 'Sending…' : 'Refreshing…';
        return;
      }
      if (Number(order?.sts_Produced) !== 1) {
        btn.disabled = true;
        btn.textContent = '🕐 Waiting for production';
        btn.title = `Order isn't decorated yet in ShopWorks (sts_Produced=${order?.sts_Produced ?? 'unknown'}). This button enables once production marks the order complete.`;
        return;
      }
      btn.disabled = false;
      if (lower.startsWith('ups') || lower.startsWith('fedex')) {
        btn.textContent = '🚢 Override → USPS via ShipStation';
        btn.title = `Order is currently ${method}. Click to override to a USPS service and route via ShipStation.`;
        btn.classList.add('invoice-ship-override');
      } else {
        btn.textContent = '🚢 Send to ShipStation';
        btn.title = 'Push this order to ShipStation. Warehouse will rate + buy the label there.';
      }
    }

    async sendToShipStation() {
      const data = this.fullData || {}, order = data.shopWorks?.snapshot?.order;
      const pushedShip = (data.shopWorks?.snapshot?.pushed?.ShippingAddresses || [])[0];
      const currentMethod = (pushedShip?.ShipMethod || data.originalSubmission?.ship?.method || '').toString();
      const currentLower = currentMethod.toLowerCase();
      if (!this.isStaff || this.syncing || this.shipAction || data.shipStation?.orderId || data.shipStation?.status === 'shipped' || Number(order?.sts_Produced) !== 1 || /pickup|willcall/.test(currentLower)) return;
      const isNonUSPS = currentLower.startsWith('ups') || currentLower.startsWith('fedex') ||
        (currentMethod && !currentLower.includes('usps') && !currentLower.includes('priority') && !currentLower.includes('mail'));
      this.shipAction = true;
      try {
        let overrideMethod = null;
        if (isNonUSPS) {
          overrideMethod = await this.openShipStationOverrideModal(currentMethod);
          if (overrideMethod === null) return;
        } else if (!(await this.openShipStationConfirm())) return;
        this.shipSending = true;
        $('btn-refresh').disabled = true;
        this.updateShipStationButton();
        const resp = await fetch(
          `/api/quote-sessions/${encodeURIComponent(this.quoteId)}/send-to-shipstation`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overrideMethod ? { overrideShipMethod: overrideMethod } : {}) }
        );
        const result = await resp.json();
        if (result.skipped) { window.ToastNotifications.info(`Skipped: ${result.message || result.reason}`); return; }
        if (!resp.ok || !result.success) throw new Error(result.error || `HTTP ${resp.status}`);
        if (!this.fullData.shipStation) this.fullData.shipStation = {};
        this.fullData.shipStation.orderId = result.shipstationOrderId;
        this.fullData.shipStation.status = result.status || 'awaiting_shipment';
        this.fullData.shipStation.lastSynced = result.lastSynced;
        if (result.alreadySent) window.ToastNotifications.success(`Already in ShipStation as #${result.shipstationOrderId}. No duplicate created.`);
        else window.ToastNotifications.success(`✓ Sent to ShipStation as #${result.shipstationOrderId}. The warehouse can now buy a label.`);
      } catch (err) {
        console.error('[invoice] sendToShipStation failed:', err);
        window.ToastNotifications.error('Failed to send to ShipStation:\n\n' + err.message);
      } finally {
        this.shipSending = false;
        this.shipAction = false;
        $('btn-refresh').disabled = this.syncing;
        this.updateShipStationButton();
      }
    }

    /**
     * Open a modal asking the rep how to route a non-USPS order.
     * Returns the chosen overrideShipMethod string, or null on cancel.
     *
     * Usage: when customer picked UPS but it's a small package the rep wants
     * to ship via USPS via ShipStation instead.
     */
    openShipStationOverrideModal(currentMethod) {
      return this.openShipmentDialog('shipstation-override-modal',
        `<h2 id="ss-modal-title">Send to ShipStation</h2>
         <p>This order was created with shipping method <strong>${escapeHTML(currentMethod || '(none)')}</strong>.
         ShipStation in NWCA's setup only supports USPS — to route this order there, choose a USPS service below.
         Otherwise, ${currentMethod && currentMethod.toLowerCase().startsWith('ups') ? 'use WorldShip' : "use the carrier's own tool"} instead.</p>
         <fieldset><legend>Override to USPS service:</legend>
          <label class="ss-override-opt"><input type="radio" name="ss-override" value="Priority Mail" checked><span><span class="ss-service-name">Priority Mail</span><span class="ss-service-note">2–3 business days · Recommended for 2-3 shirts</span></span></label>
          <label class="ss-override-opt"><input type="radio" name="ss-override" value="USPS First Class"><span><span class="ss-service-name">USPS First Class</span><span class="ss-service-note">3–5 days · Lightest packages (under 1 lb)</span></span></label>
          <label class="ss-override-opt"><input type="radio" name="ss-override" value="USPS Ground"><span><span class="ss-service-name">USPS Ground Advantage</span><span class="ss-service-note">2–5 days · Cheaper than Priority for heavier boxes</span></span></label>
         </fieldset>
         <div class="dialog-actions"><button type="button" class="btn" id="ss-modal-cancel">Cancel</button><button type="button" class="btn btn-primary" id="ss-modal-confirm">Override &amp; Send to ShipStation</button></div>`,
        modal => modal.querySelector('input[name="ss-override"]:checked')?.value || 'Priority Mail');
    }

    openShipStationConfirm() {
      return this.openShipmentDialog('shipstation-confirm-modal',
        `<h2 id="ss-modal-title">Send to ShipStation</h2>
         <p>Send order ${escapeHTML(this.quoteId)} to ShipStation?</p>
         <p>Warehouse will rate + buy the label in ShipStation. Tracking will appear back on this invoice automatically.</p>
         <div class="dialog-actions"><button type="button" class="btn" id="ss-modal-cancel">Cancel</button><button type="button" class="btn btn-primary" id="ss-modal-confirm">Send to ShipStation</button></div>`,
        () => true);
    }

    openShipmentDialog(id, content, chosen) {
      return new Promise(resolve => {
        const returnFocus = document.activeElement;
        const modal = el('dialog', { id, class: 'ui-dialog invoice-ship-dialog', 'aria-labelledby': 'ss-modal-title' });
        modal.innerHTML = content;
        document.body.appendChild(modal);
        let finished = false;
        const cleanup = value => {
          if (finished) return;
          finished = true;
          if (window.UiDialog) window.UiDialog.close(modal);
          modal.close();
          modal.remove();
          if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
          resolve(value);
        };
        modal.querySelector('#ss-modal-cancel').addEventListener('click', () => cleanup(null));
        modal.querySelector('#ss-modal-confirm').addEventListener('click', () => cleanup(chosen(modal)));
        modal.addEventListener('cancel', event => { event.preventDefault(); cleanup(null); });
        modal.addEventListener('click', event => {
          const bounds = modal.getBoundingClientRect();
          if (event.target === modal && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) cleanup(null);
        });
        modal.showModal();
        if (window.UiDialog) window.UiDialog.open(modal, { onDismiss: () => cleanup(null), focus: '#ss-modal-cancel' });
      });
    }

    async maybeAutoSync() {
      const sw = this.fullData?.shopWorks;
      const status = this.fullData?.status;
      const pushedToShopWorks = this.fullData?.sessionRaw?.PushedToShopWorks;
      // Only auto-sync quotes that have actually been pushed to ShopWorks.
      // Two dedup conventions across builders (2026-05-23):
      //   • DTG OF flow → Status flips to 'Processed' after push
      //   • EMB/SCP/DTF flow → Status stays 'Open', PushedToShopWorks timestamp set
      // Accept either signal so all 4 builders auto-sync.
      const wasPushed = status === 'Processed' || (pushedToShopWorks && pushedToShopWorks !== '');
      if (!wasPushed) return;
      const last = sw?.lastSynced ? new Date(sw.lastSynced).getTime() : 0;
      const ageMin = last ? (Date.now() - last) / 60000 : Infinity;
      if (ageMin > 30) {
        // Fire-and-forget — don't block UI
        this.syncNow(false);
      }
    }

    async syncNow(_showSpinner) {
      if (this.syncing || this.shipAction) return;
      this.syncing = true;
      $('btn-refresh').disabled = true;
      $('btn-refresh').textContent = 'Syncing…';
      $('btn-print').disabled = true;
      $('invoice-sync-error').hidden = true;
      this.updateShipStationButton();
      try {
        const resp = await fetch(
          `/api/quote-sessions/${encodeURIComponent(this.quoteId)}/sync-from-shopworks${this.shareTokenParam()}`,
          { method: 'POST' }
        );
        if (!resp.ok) throw new Error(`Sync failed (${resp.status})`);
        await resp.json();
        await this.loadFullData();
        this.render();
      } catch (err) {
        console.error('[invoice] sync failed:', err);
        $('invoice-sync-error').textContent = 'Sync failed. Displaying the last loaded invoice. Try again in a moment, or open the order in ShopWorks.';
        $('invoice-sync-error').hidden = false;
        window.ToastNotifications.error('Sync failed. Try again in a moment, or open the order in ShopWorks.');
      } finally {
        this.syncing = false;
        $('btn-refresh').disabled = false;
        $('btn-refresh').textContent = '🔄 Refresh from ShopWorks';
        $('btn-print').disabled = false;
        this.updateShipStationButton();
      }
    }
  }

  // boot
  document.addEventListener('DOMContentLoaded', () => {
    $('btn-invoice-retry').addEventListener('click', () => window.location.reload());
    const page = new InvoicePage();
    window.invoicePage = page;
    page.init();
  });
})();
