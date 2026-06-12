// storefront-quote-items.js — synthesize quote_items rows from a storefront
// order's colorConfigs (custom-tees / custom-caps), 2026-06-12 (Erik).
//
// WHY: storefront orders stored the cart ONLY in quote_sessions JSON blobs, so
// /quote and /invoice — which read the quote_items table — showed "No items"
// (and the tax-inclusive TotalAmount with no TaxAmount made /quote double-tax,
// /invoice show $0 tax). This module produces the line-item rows the readers
// need, footing exactly to the order subtotal. Pure logic, no I/O.
//
// Used by server.js save3DTQuoteSession (the shared storefront save path).
// Dual-export so it loads as a browser global AND require()s in node/jest.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StorefrontQuoteItems = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function r2(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  // Storefront channel → canonical quote_items.EmbellishmentType (matches the
  // staff builders + web-quote-service so /quote + /invoice render uniformly).
  function storefrontEmbType(channel) {
    return channel === 'custom-caps' ? 'cap-embroidery' : 'dtg';
  }

  // One row per color: LineTotal foots from per-size quantity × unitPrice;
  // FinalUnitPrice = first size's unit (OSFA for caps; base size for tees —
  // extended-size upcharges land in LineTotal, same convention as the builders).
  // A SHIP fee row is added when shipping > 0 (readers foot shipping per the
  // DTG Phase 2 contract). Returns [] for an empty/malformed colorConfigs.
  function buildStorefrontQuoteItems(quoteID, colorConfigs, orderTotals, orderSettings) {
    const items = [];
    let lineNumber = 1;
    const settings = orderSettings || {};
    const totals = orderTotals || {};
    const embType = storefrontEmbType(settings.channel);
    const styleNumber = settings.styleNumber || '';
    const productName = settings.productTitle || settings.styleName || styleNumber;
    const locCode = settings.printLocationCode || '';
    const locName = settings.printLocationName || '';
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, '');

    Object.keys(colorConfigs || {}).forEach((colorKey) => {
      const cfg = colorConfigs[colorKey] || {};
      const sizes = cfg.sizeBreakdown || {};
      const sizeQtys = {};
      let qty = 0;
      let lineTotal = 0;
      let baseUnit = null;
      Object.keys(sizes).forEach((sizeKey) => {
        const s = sizes[sizeKey] || {};
        const sQty = Number(s.quantity) || 0;
        const sUnit = Number(s.unitPrice) || 0;
        if (sQty <= 0) return;
        sizeQtys[sizeKey] = sQty;
        qty += sQty;
        lineTotal += sQty * sUnit;
        if (baseUnit === null) baseUnit = sUnit;
      });
      if (qty <= 0) return;
      items.push({
        QuoteID: quoteID,
        LineNumber: lineNumber++,
        StyleNumber: styleNumber,
        ProductName: productName + (cfg.displayColor ? ' - ' + cfg.displayColor : ''),
        Color: cfg.displayColor || colorKey,      // COLOR_NAME (display)
        ColorCode: cfg.catalogColor || colorKey,  // CATALOG_COLOR (inventory)
        EmbellishmentType: embType,
        PrintLocation: locCode,
        PrintLocationName: locName,
        Quantity: qty,
        HasLTM: 'No',
        BaseUnitPrice: r2(baseUnit || 0),
        LTMPerUnit: 0,
        FinalUnitPrice: r2(baseUnit || 0),
        LineTotal: r2(lineTotal),
        SizeBreakdown: JSON.stringify(sizeQtys),
        PricingTier: '',
        AddedAt: stamp
      });
    });

    const shipping = Number(totals.shipping) || 0;
    if (shipping > 0) {
      items.push({
        QuoteID: quoteID,
        LineNumber: lineNumber++,
        StyleNumber: 'SHIP',
        ProductName: 'Shipping',
        Color: '',
        ColorCode: '',
        EmbellishmentType: 'fee',
        PrintLocation: '',
        PrintLocationName: '',
        Quantity: 1,
        HasLTM: 'No',
        BaseUnitPrice: r2(shipping),
        LTMPerUnit: 0,
        FinalUnitPrice: r2(shipping),
        LineTotal: r2(shipping),
        SizeBreakdown: '',
        PricingTier: '',
        AddedAt: stamp
      });
    }
    return items;
  }

  return { storefrontEmbType, buildStorefrontQuoteItems };
}));
