// Print sheet — mirrors the paper form layout using current form state.
// When auto-pricing is active (breakdown.supported), the printed sheet shows
// per-row $ totals, an order subtotal, estimated tax, grand total, and 50%
// deposit line. Without auto-pricing it falls back to qty-only behavior.
function PrintSheet({ info, rows, ship, orderNotes, files, decoConfig = {}, breakdown = null }) {
  const decoSet = new Set(rows.map(r => r.deco));
  const supported = !!breakdown?.supported;
  const byRow = breakdown?.byRow;

  // Build print-ready rows. When auto-pricing is active and the row spans
  // multiple price tiers (e.g. S/M/L/XL @ $25 + 2XL @ $27 + 3XL @ $28), the
  // print sheet auto-splits it into one printed line per tier — matching the
  // embroidery quote builder's invoice convention. Each tier shows just its
  // sizes' qtys with the tier's unit price and line subtotal.
  const printRows = [];
  rows.forEach(r => {
    if (!r) return;
    const rb = byRow?.get?.(r.id);
    let totalQty = 0;
    Object.values(r.sizes || {}).forEach(v => { totalQty += Number(v) || 0; });
    if (totalQty === 0) return;

    if (rb && !rb.error && rb.rowSubtotal > 0 && !r.priceOverride && rb.unitPriceBySize) {
      // Group sizes by their unit price → one printed line per group.
      // Skip sizes the product doesn't price (e.g. PC61 doesn't sell XS — the
      // method module's priceRow leaves unitPriceBySize.XS undefined). Those
      // sizes appear in the form's grayed-out cells but shouldn't print as
      // $0 lines or push to ShopWorks.
      const buckets = new Map();   // unitPriceKey → { unit, sizes: { sz: qty } }
      Object.keys(r.sizes).forEach(sz => {
        const qty = Number(r.sizes[sz]) || 0;
        if (!qty) return;
        const rawUnit = rb.unitPriceBySize[sz];
        if (rawUnit == null || !Number.isFinite(Number(rawUnit)) || Number(rawUnit) <= 0) return;
        const unit = Number(rawUnit);
        const key = unit.toFixed(2);
        if (!buckets.has(key)) buckets.set(key, { unit, sizes: {} });
        buckets.get(key).sizes[sz] = qty;
      });
      const sortedBuckets = [...buckets.values()].sort((a, b) => a.unit - b.unit);
      // Derive the ShopWorks part-number for each bucket from the FIRST size
      // in the bucket — buckets group sizes by unit price, and sizes within
      // the same price tier always share the same suffix family (S/M/L/XL
      // share base SKU; 2XL/3XL/4XL each get their own _2X/_3XL/_4XL).
      // Loaded as window.orderFormSizeSuffix from the shared module.
      const suffixFn = (typeof window !== 'undefined' && window.orderFormSizeSuffix)
        ? window.orderFormSizeSuffix
        : ((p, s) => `${p}_${s}`);
      sortedBuckets.forEach((b, idx) => {
        let q = 0; Object.values(b.sizes).forEach(v => { q += Number(v) || 0; });
        const firstSize = Object.keys(b.sizes)[0] || '';
        const partNumber = r.style ? suffixFn(r.style, firstSize) : '';
        printRows.push({
          id: `${r.id}-tier-${idx}`,
          // Show the per-tier ShopWorks PN on every line — production reading
          // the printed page should see EXACTLY what's pushed to MO. The
          // "style" cell shows the SKU; first row also carries color + desc;
          // continuation rows leave color/desc blank to keep the page clean.
          style: partNumber,
          color: idx === 0 ? (r.color || r.colorName || '') : '',
          desc:  idx === 0 ? r.desc : '',
          sizes: b.sizes,
          total: q,
          unitDollar: b.unit,
          lineDollar: b.unit * q,
          _continuation: idx > 0,
        });
      });
    } else {
      // Manual price OR no auto-pricing → single printed line summing all sizes.
      const unit = Number(r.price) || 0;
      printRows.push({
        ...r,
        color: r.color || r.colorName || '',
        total: totalQty,
        unitDollar: unit,
        lineDollar: unit * totalQty,
      });
    }
  });

  // Render ALL computed print rows — never truncate. A single multi-size style
  // can tier-split into 3+ printed lines, so capping rows would silently DROP
  // billable/production lines off the printed + PDF sheet (real data loss).
  // For short orders we still pad UP to MIN_BLANK_ROWS so the page keeps the
  // "paper form" look — but this is a COMPUTED minimum, never a cap.
  const MIN_BLANK_ROWS = 14;
  const padded = [...printRows];
  while (padded.length < MIN_BLANK_ROWS) padded.push({ id: 'blank-' + padded.length, style: '', color: '', desc: '', sizes: {}, total: 0, lineDollar: 0, unitDollar: 0, _blank: true });

  const designNo = info.designNumber || files.map(f => f.designNo).filter(Boolean).join(', ');
  const placements = [...new Set(files.flatMap(f => f.placements || []))].join(', ');

  // Currency formatter — local to this file to avoid coupling with totals.jsx.
  const usd = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Deco context line — "EMBROIDERY · 8,000 stitches · Tier 24-47 · Left Chest"
  const decoContext = (() => {
    if (!supported || !breakdown?.tier) return '';
    const method = decoConfig?.method || '';
    const label  = window.OrderFormPricing?.getMethod?.(method)?.label || method.toUpperCase();
    const parts = [`${label.toUpperCase()}`];
    if (method === 'embroidery' && decoConfig?.stitchCount) {
      parts.push(`${Number(decoConfig.stitchCount).toLocaleString()} stitches`);
    }
    if (decoConfig?.primaryLocation) parts.push(decoConfig.primaryLocation);
    parts.push(`Tier ${breakdown.tier}`);
    parts.push(`${breakdown.totalQty} pcs`);
    return parts.join(' · ');
  })();

  return (
    <div className="print-sheet" id="print-sheet">
      {/* Header */}
      <div className="ps-header">
        <div className="ps-brand">
          <div className="ps-logo"><LogoMark size={52}/></div>
        </div>
        <div className="ps-title">
          <h1>Order Form</h1>
          <div className="ps-contact">
            Northwest Custom Apparel &nbsp;·&nbsp; 1-800-851-3671<br/>
            sales@nwcustomapparel.com
          </div>
        </div>
        <div className="ps-right-plate">
          <strong>Text us</strong><br/>
          253-922-5793<br/>
          <span style={{ fontSize: '8pt' }}>Est. 1977 · Tacoma, WA</span>
        </div>
      </div>

      {/* Info grid */}
      <div className="ps-info">
        <div className="cell"><div className="lbl">Company</div><div className="val">{info.company}</div></div>
        <div className="cell"><div className="lbl">Phone</div><div className="val">{info.phone}</div></div>
        <div className="cell"><div className="lbl">Date in</div><div className="val">{info.dateIn}</div></div>

        <div className="cell"><div className="lbl">Buyer</div><div className="val">{[info.buyerFirst, info.buyerLast].filter(Boolean).join(' ')}</div></div>
        <div className="cell"><div className="lbl">Email</div><div className="val">{info.email}</div></div>
        <div className="cell"><div className="lbl">Date due</div><div className="val">{info.dateDue}</div></div>

        <div className="cell"><div className="lbl">Address</div><div className="val">{info.address}</div></div>
        <div className="cell"><div className="lbl">PO #</div><div className="val">{info.po}</div></div>
        <div className="cell" style={{ padding: 0 }}>
          <div className="deco-flags">
            <div className="flag"><span className={"ps-chk" + (decoSet.has('embroidery') ? ' on' : '')}></span> Embroidery</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('screenprint') ? ' on' : '')}></span> Screen Printing</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('dtg') ? ' on' : '')}></span> DTG Printing</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('dtf') ? ' on' : '')}></span> DTF Transfer</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('sticker') ? ' on' : '')}></span> Stickers</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('emblem') ? ' on' : '')}></span> Emblems</div>
          </div>
        </div>

        <div className="cell"><div className="lbl">City / State / Zip</div><div className="val">{[info.city, info.state, info.zip].filter(Boolean).join(', ')}</div></div>
        <div className="cell"></div>
        <div className="cell"></div>
      </div>

      {/* Deco context — under info grid, only when auto-pricing is live */}
      {decoContext && (
        <div className="ps-deco-context">{decoContext}</div>
      )}

      {/* Payment notice */}
      <div className="ps-notice">
        <div>
          50% down on all new orders. Balance on delivery.<br/>
          Prepayment on all new artwork.
        </div>
        <div className="cards">
          <span className="c">VISA</span>
          <span className="c">MC</span>
          <span className="c">AMEX</span>
          <span className="c">ACH</span>
        </div>
      </div>

      {/* Garments table */}
      <table className="ps-table">
        <colgroup>
          <col className="c-style"/>
          <col className="c-color"/>
          <col className="c-desc"/>
          <col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/>
          <col className="c-price"/>
          <col className="c-total"/>
        </colgroup>
        <thead>
          <tr>
            <th className="left">Style #</th>
            <th className="left">Color</th>
            <th className="left">Description</th>
            <th className="num">XS</th>
            <th className="num">S</th>
            <th className="num">M</th>
            <th className="num">L</th>
            <th className="num">XL</th>
            <th className="num">2XL</th>
            <th className="num">3XL</th>
            <th className="num">4XL</th>
            <th className="num">Price</th>
            <th className="ps-total-head">Total</th>
          </tr>
        </thead>
        <tbody>
          {padded.map((r, i) => (
            <tr key={r.id}>
              <td>{r.style}</td>
              <td>{r.color || r.colorName}</td>
              <td className="desc">{r.desc}</td>
              <td className="num">{r.sizes?.XS || ''}</td>
              <td className="num">{r.sizes?.S || ''}</td>
              <td className="num">{r.sizes?.M || ''}</td>
              <td className="num">{r.sizes?.L || ''}</td>
              <td className="num">{r.sizes?.XL || ''}</td>
              <td className="num">{r.sizes?.['2XL'] || ''}</td>
              <td className="num">{r.sizes?.['3XL'] || ''}</td>
              <td className="num">{r.sizes?.['4XL'] || ''}</td>
              <td className="num">{r.unitDollar ? usd(r.unitDollar) : (r.price ? '$' + r.price : '')}</td>
              <td className="total">{r.lineDollar ? usd(r.lineDollar) : (r.total || '')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals strip — printed only when auto-pricing computed something */}
      {supported && breakdown.subtotal > 0 && (
        <div className="ps-totals">
          {/* Itemized service/setup fees (setup, rush, AL, etc.) — read from
              breakdown.fees[] (single source). Printed BEFORE the subtotal so
              garment line totals + these fee lines foot exactly to the subtotal
              (the garment lines exclude fees; breakdown.subtotal includes them). */}
          {Array.isArray(breakdown.fees) && breakdown.fees.map((f, i) => (
            <div className="ps-totals-row ps-totals-row--dim" key={(f.code || 'fee') + '-' + i}>
              <span>{f.label || f.code}{f.scope && f.scope.rowId ? ' (per item)' : ''}</span>
              <span>{usd(f.amount)}</span>
            </div>
          ))}
          <div className="ps-totals-row">
            <span>Subtotal {breakdown.totalQty ? `(${breakdown.totalQty} pcs)` : ''}</span>
            <span>{usd(breakdown.subtotal)}</span>
          </div>
          {breakdown.taxEstimate > 0 && (
            <div className="ps-totals-row ps-totals-row--dim">
              <span>{breakdown.taxLabel || 'Estimated tax'}</span>
              <span>{usd(breakdown.taxEstimate)}</span>
            </div>
          )}
          <div className="ps-totals-row ps-totals-row--total">
            <span>Total {breakdown.taxEstimate > 0 ? '(estimated)' : ''}</span>
            <span>{usd((breakdown.subtotal || 0) + (breakdown.taxEstimate || 0))}</span>
          </div>
          <div className="ps-totals-row ps-totals-row--deposit">
            <span>50% deposit due</span>
            <span>{usd(breakdown.depositDue)}</span>
          </div>
          {breakdown.tier === '1-7' && (
            <div className="ps-totals-row ps-totals-row--note">
              <span>LTM ($50) built into per-piece pricing.</span>
            </div>
          )}
        </div>
      )}

      {/* Footer: Notes / Shipping */}
      <div className="ps-footer">
        <div className="cell">
          <div className="lbl">Order notes</div>
          <div className="val">{orderNotes}</div>
        </div>
        <div className="cell">
          <div className="ps-ship-methods">
            <strong style={{ fontSize: '9pt' }}>Ship</strong>
            <div className="m"><span className={"ps-chk" + (ship.method === 'ups' ? ' on' : '')}></span> UPS</div>
            <div className="m"><span className={"ps-chk" + (ship.method === 'willcall' ? ' on' : '')}></span> Will Call</div>
            <div className="m"><span className={"ps-chk" + (ship.method === 'other' ? ' on' : '')}></span> Other</div>
          </div>
          <div className="lbl">Ship to address</div>
          <div className="val" style={{ marginBottom: 4 }}>{ship.address}</div>
          <div className="lbl">City / State / Zip</div>
          <div className="val">{[ship.city, ship.state, ship.zip].filter(Boolean).join(', ')}</div>
        </div>
      </div>

      {/* Design # row */}
      <div className="ps-design-row">
        <div className="cell"><div className="lbl">Design #</div><div className="val">{designNo}</div></div>
        <div className="cell"><div className="lbl">Logo placement(s)</div><div className="val">{placements}</div></div>
        <div className="cell"><div className="lbl">Art / production notes</div><div className="val">{info.artNotes || ''}</div></div>
      </div>

      {/* Signature */}
      <div className="ps-sig-line"></div>
      <div className="ps-sig">Customer Signature</div>
    </div>
  );
}

Object.assign(window, { PrintSheet });
