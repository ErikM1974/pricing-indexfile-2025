// All six decoration methods exposed in the deco-checkbox cell.
// First four are 1:1 with the existing DECOS in line-items.jsx; sticker and
// emblem are non-garment methods that ship with their own pricing modules.
const ALL_DECOS = [
  { key: 'embroidery',  label: 'Embroidery' },
  { key: 'screenprint', label: 'Screen Print' },
  { key: 'dtg',         label: 'DTG' },
  { key: 'dtf',         label: 'DTF' },
  { key: 'sticker',     label: 'Stickers' },
  { key: 'emblem',      label: 'Emblems' },
];

// Pretty-print an uncommon SanMar size code for display. Internal storage
// (row.sizes keys) uses the raw SanMar code; this is just for the rep's eyes.
//   "3030"  → "30×30"   (pants waist × length)
//   "3432"  → "34×32"
//   "5/6T"  → "5/6T"    (left as-is, already readable)
//   "S/M"   → "S/M"     (left as-is)
// Anything else passes through unchanged.
function prettyPrintSize(s) {
  const raw = String(s || '').trim();
  if (!raw) return raw;
  // 4-digit numeric → W×L pants. Validate both halves are 2 digits.
  if (/^\d{4}$/.test(raw)) {
    return `${raw.slice(0, 2)}×${raw.slice(2)}`;
  }
  return raw;
}

// Popover picker for non-standard sizes. Renders inline chips for any non-
// standard sizes already entered, plus a "+ Add" button that opens a menu
// of remaining sizes the product offers (5XL, 6XL, 8XL, 10XL, LT, XLT, MT,
// ST, XST, XXS, 2XS, MR, SR, LR, XLR, LL, XLL, etc. — anything SanMar
// reports). Each picked size becomes an inline qty input. All sizes flow
// into row.sizes[] and push to MO with the correct _<size> suffix via
// the shared orderFormSizeSuffix() module.
//
// `availableSizes` — array of sizes the picked product comes in (from the
// pricing-bundle). The picker pulls its options FROM this list, filtered
// to anything not already in the standard XS-4XL grid. No hardcoded size
// list — whatever SanMar lists for the product is what shows.
function NonStandardSizePicker({ row, onChange, availableSizes }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    function handler(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sizes = row.sizes || {};
  const standardSet = new Set(PAPER_SIZES);

  // Display order for non-standard sizes — used both for the "+ Add" menu
  // ordering and for sorting the chips inline. Falls back to alphabetical
  // for sizes not in the priority list.
  const SORT_PRIORITY = ['5XL','6XL','7XL','8XL','9XL','10XL','XXL',
                         'XXS','2XS',
                         'OSFA',
                         'LT','XLT','2XLT','3XLT','4XLT','MT','ST','XST',
                         'YS','YM','YL','YXL','YXS',
                         'SR','MR','LR','XLR','2XLR','3XLR','4XLR','5XLR','6XLR',
                         'LL','XLL','2XLL','3XLL','XXXL',
                         'NB','06M','12M','18M','24M',
                         '2T','3T','4T','5T','5/6T','6T'];
  const sortIdx = sz => {
    const i = SORT_PRIORITY.indexOf(String(sz).toUpperCase());
    return i === -1 ? 999 + String(sz).charCodeAt(0) : i;
  };

  const enteredNonStd = Object.keys(sizes)
    .filter(k => !standardSet.has(k.toUpperCase()) && k in sizes)
    .sort((a, b) => sortIdx(a) - sortIdx(b));

  // Picker options: pull dynamically from availableSizes, filter to anything
  // not already in the standard XS-4XL grid AND not already entered.
  const remaining = (availableSizes || [])
    .filter(s => !standardSet.has(String(s).toUpperCase()))
    .filter(s => !(s in sizes))
    .sort((a, b) => sortIdx(a) - sortIdx(b));

  function setSize(s, v) {
    const next = { ...sizes };
    if (v) next[s] = v.replace(/[^0-9]/g, '');
    else delete next[s];
    onChange({ sizes: next });
  }

  function addSize(s) {
    onChange({ sizes: { ...sizes, [s]: '' } });
    setOpen(false);
  }

  return (
    <div className="nss-cell" ref={wrap}>
      {enteredNonStd.map(s => (
        <span key={s} className="nss-chip">
          <span className="nss-chip-label">{prettyPrintSize(s)}</span>
          <input
            className="nss-chip-qty"
            inputMode="numeric"
            value={sizes[s] || ''}
            onChange={(e) => setSize(s, e.target.value)}
            placeholder="0"
          />
          <button
            type="button"
            className="nss-chip-remove"
            onClick={() => setSize(s, '')}
            aria-label={`Remove ${s}`}
            tabIndex={-1}
          >×</button>
        </span>
      ))}
      <button type="button" className="nss-add-btn" onClick={() => setOpen(o => !o)}>+ Add</button>
      {open && (
        <div className="nss-menu">
          {availableSizes && availableSizes.length > 0 && (
            <div className="nss-menu-hint">
              Available for this product: {availableSizes.map(prettyPrintSize).join(', ')}
            </div>
          )}
          {remaining.length === 0 ? (
            <div className="nss-menu-empty">
              {availableSizes && availableSizes.length
                ? 'No non-standard sizes available for this product'
                : 'Pick a style first to see available sizes'}
            </div>
          ) : (
            <div className="nss-menu-grid">
              {remaining.map(s => (
                <button
                  type="button"
                  key={s}
                  className="nss-menu-item"
                  onMouseDown={(e) => { e.preventDefault(); addSize(s); }}
                >{prettyPrintSize(s)}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Paper-style form view — boxed fields, looks like the original PDF but editable.
//
// Auto-pricing: when `rowBreakdown` exists (active method module computed
// per-size unit prices for this row), the Price cell shows a representative
// auto-price with an "auto" badge. Clicking it switches to manual override
// (sets row.priceOverride=true). Total cell shows $ instead of qty.
function PaperRow({ row, onChange, onRemove, canRemove, idx, customerMode, onLightbox, rowBreakdown }) {
  const [mcpOpen, setMcpOpen] = useState(false);
  // Per-size SanMar inventory map — { 'S': 3229, 'M': 7045, 'XL': 1245, ... }
  // populated by the effect below when style + catalogColor are set.
  // status: 'ok' (we have data), 'unknown' (nothing to query / fetch failed
  // gracefully), 'loading' (request in flight).
  const [inventory, setInventory] = useState({ bySize: {}, status: 'unknown' });

  // Total qty across all sizes — same as before.
  const total = useMemo(() => {
    let t = 0;
    Object.values(row.sizes || {}).forEach(v => { t += Number(v || 0); });
    return t;
  }, [row]);

  function update(patch) { onChange({ ...row, ...patch }); }
  function setSize(s, v) { update({ sizes: { ...row.sizes, [s]: v.replace(/[^0-9]/g, '') } }); }

  // ----- Description auto-fill from product API -----
  // When the rep types a style without picking from the autocomplete dropdown,
  // ProductCombobox.onPick never fires and row.desc stays empty. Detect a
  // valid resolved style (the bundle came back, evidenced by row.imageUrl OR
  // a successful breakdown) and fill the description from /api/product-colors.
  // Only writes when desc is empty — never overwrites the rep's typing.
  useEffect(() => {
    if (!row.style || row.desc) return;
    if (!window.fetchProductInfo) return;
    let cancelled = false;
    window.fetchProductInfo(row.style).then(info => {
      if (cancelled) return;
      const title = (info?.productTitle || '').trim();
      if (title && !row.desc) update({ desc: title });
    }).catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [row.style]);

  // ----- SanMar inventory check -----
  // When style + color resolve, fan out inventory queries and populate
  // `inventory.bySize` for the size-cell badges. Skipped in manual-cost mode
  // (rep is overriding, no SanMar fulfillment) and for sticker/emblem
  // (custom products, not SanMar).
  useEffect(() => {
    if (!row.style || row.manualMode) return;
    if (row.deco === 'sticker' || row.deco === 'emblem') return;
    const catalogColor = row.catalogColor || row.colorName || row.color || '';
    if (!catalogColor) return;
    // Sizes the form has columns for, derived from breakdown extras when
    // available. If extras isn't ready yet, default to standard XS-4XL.
    const sizes = (rowBreakdown?.extras?.availableSizes && rowBreakdown.extras.availableSizes.length)
      ? rowBreakdown.extras.availableSizes
      : ['XS','S','M','L','XL','2XL','3XL','4XL'];
    const inv = window.OrderFormInventory;
    if (!inv) return;
    let cancelled = false;
    setInventory(prev => ({ ...prev, status: 'loading' }));
    inv.getInventoryForRow(row.style, catalogColor, sizes).then(result => {
      if (cancelled) return;
      setInventory(result);
    }).catch(() => {
      if (!cancelled) setInventory({ bySize: {}, status: 'unknown' });
    });
    return () => { cancelled = true; };
  }, [row.style, row.catalogColor, row.colorName, row.color, row.manualMode, row.deco,
      // re-run when availableSizes resolves
      JSON.stringify(rowBreakdown?.extras?.availableSizes || [])]);

  // ----- Auto-pricing display state -----
  const hasAutoPrice = !!(rowBreakdown && !rowBreakdown.error && rowBreakdown.rowSubtotal > 0);
  const showAutoPriceCell = hasAutoPrice && !row.priceOverride;
  const rowSubtotalDollars = rowBreakdown?.rowSubtotal || 0;
  // Per-size sizing metadata from the method module (when available).
  // basePrice = headline (S/M/L/XL price), sizeUpcharges = relative upcharges
  // for 2XL+, availableSizes = which sizes the product actually comes in.
  const extras = rowBreakdown?.extras || {};
  const basePrice = Number.isFinite(Number(extras.basePrice)) ? Number(extras.basePrice) : null;
  const sizeUpcharges = extras.sizeUpcharges || {};
  const availableSizes = extras.availableSizes || null;
  const availSet = (availableSizes && availableSizes.length)
    ? new Set(availableSizes.map(s => String(s).toUpperCase()))
    : null;
  // Headline unit: prefer the bundle's base price (S/M/L/XL); if unavailable
  // (e.g. cap OSFA, sticker, emblem), fall back to weighted average.
  const avgUnit = (showAutoPriceCell && total > 0) ? rowSubtotalDollars / total : 0;
  const headlineUnit = (basePrice != null) ? basePrice : avgUnit;
  // Which upcharged sizes actually have qty entered? Only those need to show
  // in the chip — no point cluttering with "+$2 2XL" when there's no 2XL qty.
  // Show the chip in BOTH auto and manual-override modes so the rep keeps
  // sight of the upcharges even after they've typed a custom price.
  const usedUpchargedSizes = Object.keys(sizeUpcharges)
    .filter(sz => Number(row.sizes?.[sz]) > 0);
  const showUpchargeChip = (rowBreakdown && !rowBreakdown.error && usedUpchargedSizes.length > 0);
  const upchargeChipText = showUpchargeChip
    ? usedUpchargedSizes
        .sort((a, b) => PAPER_SIZES.indexOf(a) - PAPER_SIZES.indexOf(b)
          || NON_STANDARD_SIZES.indexOf(a) - NON_STANDARD_SIZES.indexOf(b))
        .map(sz => `+$${Number(sizeUpcharges[sz]).toFixed(0)} ${sz}`)
        .join(' · ')
    : '';
  // Total cell: always show $ when there's any pricing (auto OR manual override).
  // Manual override applies the rep's typed price uniformly across all sizes.
  const manualUnit = Number(row.price) || 0;
  const overrideTotal = manualUnit * total;
  const totalDollars = showAutoPriceCell ? rowSubtotalDollars : (row.priceOverride ? overrideTotal : 0);
  const showTotalDollars = totalDollars > 0;

  // ----- Size-grid mode -----
  // Different products have different size models. Detect the right mode
  // from availableSizes + deco method:
  //   'standard'      — XS-4XL columns + Other picker (most garments)
  //   'cap-osfa'      — single OSFA cell (Richardson 112, NE201, etc.)
  //   'custom-sizes'  — horizontal mini-grid of whatever sizes the product
  //                     actually offers (NE1000: S/M, M/L, L/XL · fitted-
  //                     exact caps · pants W×L · anything else SanMar lists)
  //   'single-qty'    — sticker / emblem rows (one qty cell)
  // Falls back to 'standard' until the bundle resolves so the rep can start
  // typing right away. Once availableSizes comes back, the mode locks in.
  const STANDARD_GRID_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']);
  const sizeMode = (() => {
    if (row.deco === 'sticker' || row.deco === 'emblem') return 'single-qty';
    if (!availableSizes || !availableSizes.length) return 'standard';
    const upper = availableSizes.map(s => String(s).toUpperCase());
    if (upper.length === 1 && upper[0] === 'OSFA') return 'cap-osfa';
    // If ANY of the product's sizes match the standard XS-4XL grid, render
    // the standard grid (the rest get added via the "+ Add" picker which
    // already filters to availableSizes). Only when ZERO standard sizes
    // apply (e.g. fitted caps with only S/M, M/L, L/XL) do we morph the
    // grid completely.
    const hasAnyStandard = upper.some(s => STANDARD_GRID_SIZES.has(s));
    if (!hasAnyStandard) return 'custom-sizes';
    return 'standard';
  })();
  // The "size key" for collapsed modes — what key in row.sizes carries the qty.
  // For OSFA caps it's 'OSFA'. For sticker/emblem 'STK'/'EMB'. For custom-
  // sizes mode each size gets its own key (S/M, L/XL, etc.) — no single key.
  const collapsedSizeKey = sizeMode === 'cap-osfa' ? 'OSFA'
                         : row.deco === 'sticker' ? 'STK'
                         : row.deco === 'emblem' ? 'EMB'
                         : null;
  const collapsedQty = collapsedSizeKey ? (row.sizes?.[collapsedSizeKey] || '') : '';

  function applyManualCost({ manualCost, itemType }) {
    update({
      manualMode: true,
      manualCost,
      rowDecoConfig: { ...(row.rowDecoConfig || {}), capOrFlat: itemType === 'cap' ? 'cap' : 'flat' },
    });
    setMcpOpen(false);
  }

  function clearManualCost() {
    update({ manualMode: false, manualCost: '', rowDecoConfig: { ...(row.rowDecoConfig || {}), capOrFlat: 'auto' } });
  }

  return (
    <tr className={hasAutoPrice ? 'pf-row pf-row--priced' : 'pf-row'}>
      <td className="sel-wrap">
        <div className="style-cell">
          <ProductCombobox
            value={row.style}
            onChange={(v) => update({ style: v })}
            onPick={(p) => update({
              style: p.style,
              desc: row.desc || p.desc || '',
              ...(row.style && row.style !== p.style ? { colorName: '', catalogColor: '' } : {})
            })}
          />
          <button
            type="button"
            className={"manual-cost-toggle" + (row.manualMode ? ' on' : '')}
            onClick={() => setMcpOpen(o => !o)}
            title={row.manualMode ? 'Manual cost mode — click to clear' : 'Style not in SanMar? Click to enter blank cost manually'}
            aria-label="Manual cost"
          >$</button>
          {row.manualMode && <ManualCostPill row={row} onClear={clearManualCost} />}
          {mcpOpen && (
            <div className="manual-cost-prompt-wrap">
              <ManualCostPrompt
                row={row}
                onApply={applyManualCost}
                onCancel={() => setMcpOpen(false)}
              />
            </div>
          )}
        </div>
      </td>
      <td>
        <ColorSelect
          style={row.style}
          colorName={row.colorName || row.color || ''}
          onPick={({ colorName, catalogColor, imageUrl }) => update({ colorName, catalogColor, color: colorName, imageUrl: imageUrl || '' })}
        />
      </td>
      <td>
        <div className="desc-cell">
          {row.imageUrl && (
            <button
              type="button"
              className="row-thumb-btn"
              onClick={() => onLightbox && onLightbox(row.imageUrl)}
              title="Click to view full image"
              aria-label="View product image"
            >
              <img src={row.imageUrl} alt="" loading="lazy" />
            </button>
          )}
          <textarea
            className="t-in t-in-desc"
            rows={2}
            placeholder="Description"
            value={row.desc}
            onChange={e => update({ desc: e.target.value })}
          />
          {rowBreakdown && !rowBreakdown.error && rowBreakdown.tier && (
            <RowTierBadge rowBreakdown={rowBreakdown} />
          )}
        </div>
      </td>
      {sizeMode === 'cap-osfa' || sizeMode === 'single-qty' ? (
        // Collapsed grid for caps and stickers/emblems — single qty cell that
        // visually spans XS-4XL + Other (9 columns). Other rows in the table
        // keep the standard layout because <colgroup> defines fixed widths
        // and only this <td> uses colspan.
        <td colSpan={9} className={"size-collapsed size-collapsed--" + sizeMode}>
          <div className="size-collapsed-inner">
            <span className="size-collapsed-label">
              {sizeMode === 'cap-osfa' ? 'OSFA' : 'Qty'}
            </span>
            <input
              className="t-in num size-collapsed-qty"
              inputMode="numeric"
              value={collapsedQty}
              onChange={e => {
                // Strip non-digits, store under the right size key. Other size
                // keys are cleared so the row's sizes map stays clean.
                const v = e.target.value.replace(/[^0-9]/g, '');
                const next = {};
                if (v) next[collapsedSizeKey] = v;
                update({ sizes: next });
              }}
              placeholder="—"
            />
            {sizeMode === 'cap-osfa' && (
              <span className="size-collapsed-hint">One Size Fits All</span>
            )}
          </div>
        </td>
      ) : sizeMode === 'custom-sizes' ? (
        // Custom-sizes mode — horizontal mini-grid for products with non-
        // standard sizing (fitted caps S/M/L/XL, fitted-exact 7 1/8 etc.,
        // pants W×L, anything else SanMar reports). One labeled qty input
        // per available size; spans colspan=9 same as cap-osfa.
        <td colSpan={9} className="size-collapsed size-collapsed--custom-sizes">
          <div className="size-collapsed-inner size-collapsed-inner--multi">
            {availableSizes.map(sz => {
              const key = String(sz);
              return (
                <label key={key} className="size-custom-cell">
                  <span className="size-custom-label">{prettyPrintSize(key)}</span>
                  <input
                    className="t-in num size-custom-qty"
                    inputMode="numeric"
                    value={row.sizes?.[key] || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      const next = { ...row.sizes };
                      if (v) next[key] = v; else delete next[key];
                      update({ sizes: next });
                    }}
                    placeholder="—"
                  />
                </label>
              );
            })}
          </div>
        </td>
      ) : (
        <>
          {PAPER_SIZES.map(s => {
            // Three states for each size cell:
            //   1. UNAVAILABLE — product doesn't come in this size (bundle.uniqueSizes
            //      doesn't include it). Render N/A — hard block.
            //   2. OUT-OF-STOCK — product carries the size but SanMar inventory = 0.
            //      Render "0 in stock" — hard block too.
            //   3. AVAILABLE — render an <input>, badge underneath shows the
            //      per-size count + green/amber/red coloring.
            //
            // Escape hatch for both blocked states: rep clicks the $ icon in
            // the style cell to switch the row to manual-cost mode (manual mode
            // skips both availability AND inventory filters).
            const upper = s.toUpperCase();
            const unavailable = availSet && !availSet.has(upper);
            if (unavailable) {
              return (
                <td key={s} className="sz-unavail" title={`${row.style || 'this product'} doesn't come in ${s} — switch to manual cost (click $) to override`}>
                  <span className="sz-na">N/A</span>
                </td>
              );
            }
            const invAvailable = inventory.bySize?.[s];
            const invKnown = inventory.status === 'ok' && Number.isFinite(Number(invAvailable));
            const isOutOfStock = invKnown && Number(invAvailable) === 0;
            if (isOutOfStock) {
              return (
                <td key={s} className="sz-out-of-stock" title={`SanMar shows 0 in stock for ${row.colorName || 'this color'} ${s} — switch to manual cost (click $) to override`}>
                  <span className="sz-oos">0 STK</span>
                </td>
              );
            }
            const cellQty = Number(row.sizes[s]) || 0;
            const klass = invKnown
              ? window.OrderFormInventory.classifyInventory(cellQty, invAvailable)
              : 'unknown';
            const overflow = klass === 'over';
            return (
              <td key={s} className={overflow ? 'sz-overflow' : ''}>
                <input
                  className="t-in num"
                  inputMode="numeric"
                  value={row.sizes[s] || ''}
                  onChange={e => setSize(s, e.target.value)}
                  title={invKnown ? `Stock: ${invAvailable.toLocaleString()} ${s}${overflow ? ' — exceeds available' : ''}` : ''}
                />
                {invKnown && (
                  <span className={`sz-inv-badge sz-inv-${klass}`}>{invAvailable.toLocaleString()}</span>
                )}
              </td>
            );
          })}
          <td className="nss-td"><NonStandardSizePicker row={row} onChange={update} availableSizes={availableSizes} /></td>
        </>
      )}
      <td>
        {showAutoPriceCell ? (
          <button
            type="button"
            className={"t-in num auto-priced" + (showUpchargeChip ? ' has-upcharge' : '')}
            onClick={() => update({ priceOverride: true, price: headlineUnit ? headlineUnit.toFixed(2) : '' })}
            title="Auto-priced — click to override. Headline shows base (S/M/L/XL) price; upcharges are added per size automatically."
          >
            <span className="auto-priced-money">{fmt$(headlineUnit)}</span>
            <span className="auto-badge">auto</span>
            {showUpchargeChip && (
              <span className="upcharge-chip" title="Upcharges applied to bigger sizes">{upchargeChipText}</span>
            )}
          </button>
        ) : (
          <div className={"manual-price-cell" + (showUpchargeChip ? ' has-upcharge' : '')}>
            <input
              className="t-in num"
              inputMode="decimal"
              value={row.price || ''}
              onChange={e => update({ price: e.target.value.replace(/[^0-9.]/g, '') })}
              placeholder=""
            />
            {row.priceOverride && hasAutoPrice && (
              <button
                type="button"
                className="restore-auto-link"
                onClick={() => update({ priceOverride: false, price: '' })}
                title="Use auto-calculated price"
              >restore auto</button>
            )}
            {/* Upcharge chip persists in override mode — informational only since
                the manual price applies uniformly to all sizes. */}
            {showUpchargeChip && (
              <span className="upcharge-chip upcharge-chip--manual" title="Auto-pricing would apply these upcharges">
                {upchargeChipText}
              </span>
            )}
          </div>
        )}
      </td>
      <td>
        {/* Total cell: always $ when there's pricing (auto or manual override).
            Falls back to qty only when there's no pricing at all. */}
        {showTotalDollars
          ? <input className="t-in total t-in-money" value={fmt$(totalDollars)} readOnly tabIndex={-1} />
          : <input className="t-in total" value={total || ''} readOnly tabIndex={-1} />
        }
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// RowBreakdownLine — thin italic row directly below each priced PaperRow that
// makes the ShopWorks line-item split visible in the form. Same data the MO
// push uses (breakdown.unitPriceBySize keyed by size, then routed through the
// shared orderFormSizeSuffix() to derive the per-PN partition).
//
// Format: "{PN} × {qty} @ ${unit} (${lineTotal}) · {PN} × {qty} @ ${unit} ..."
// Skipped sizes (engine has no price) listed at the end with "skipped".
// Manual override mode: "Manual override: {PN} × {qty} ... — all @ ${manualPrice}"
// ---------------------------------------------------------------------------
function RowBreakdownLine({ row, rowBreakdown, customerMode }) {
  if (!row || !rowBreakdown || rowBreakdown.error) return null;
  const sizes = row.sizes || {};
  const totalQty = Object.values(sizes).reduce((a, v) => a + (Number(v) || 0), 0);
  if (!totalQty) return null;
  const partBase = (row.style || '').trim() || 'MISC';
  const suffixFn = window.orderFormSizeSuffix || ((p, s) => `${p}_${s}`);

  // Group sizes by ShopWorks part number (from suffix function), accumulating
  // qty + tracking unit price (auto-priced) or skip flag (no price in engine).
  const groups = new Map();   // partNumber -> { sizes: [{size,qty}], unit, skipped }
  Object.keys(sizes).forEach(sz => {
    const qty = Number(sizes[sz]) || 0;
    if (!qty) return;
    const pn = suffixFn(partBase, sz);
    const unit = rowBreakdown.unitPriceBySize?.[sz];
    const hasUnit = Number.isFinite(Number(unit)) && Number(unit) > 0;
    const key = pn + (hasUnit ? '@' + Number(unit).toFixed(2) : '@skip');
    if (!groups.has(key)) {
      groups.set(key, { partNumber: pn, sizes: [], unit: hasUnit ? Number(unit) : 0, skipped: !hasUnit });
    }
    groups.get(key).sizes.push({ size: sz, qty });
  });

  if (groups.size === 0) return null;

  // Sort groups: priced first (cheapest → most expensive), skipped last.
  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (a.skipped !== b.skipped) return a.skipped ? 1 : -1;
    return a.unit - b.unit;
  });

  const isOverride = !!row.priceOverride;
  const manualUnit = Number(row.price) || 0;

  // Render each group as an inline span.
  const segments = sortedGroups.map((g, i) => {
    const groupQty = g.sizes.reduce((a, s) => a + s.qty, 0);
    const sizeList = g.sizes.map(s => prettyPrintSize(s.size)).join('/');
    if (g.skipped && !isOverride) {
      return (
        <span key={i} className="pf-bd-seg pf-bd-seg--skip">
          <strong>{g.partNumber}</strong>
          <span className="pf-bd-sizes">{sizeList}</span>
          × {groupQty}
          <span className="pf-bd-skip-tag">skipped (no price)</span>
        </span>
      );
    }
    // Override mode: every group uses the manual unit.
    const unit = isOverride ? manualUnit : g.unit;
    const lineTotal = unit * groupQty;
    return (
      <span key={i} className="pf-bd-seg">
        <strong>{g.partNumber}</strong>
        {sizeList && sizeList !== g.partNumber.replace(partBase, '').replace('_','') && (
          <span className="pf-bd-sizes">{sizeList}</span>
        )}
        × {groupQty} @ {fmt$(unit)} = {fmt$(lineTotal)}
      </span>
    );
  });

  return (
    <tr className={"pf-breakdown-row" + (isOverride ? ' pf-breakdown-row--manual' : '')}>
      <td colSpan={14}>
        <span className="pf-bd-arrow">↳</span>
        {isOverride && <span className="pf-bd-prefix">Manual override:</span>}
        {!isOverride && <span className="pf-bd-prefix">Splits to ShopWorks:</span>}
        <span className="pf-bd-segments">{segments.reduce((acc, seg, i) => i === 0 ? [seg] : [...acc, <span key={`d${i}`} className="pf-bd-dot"> · </span>, seg], [])}</span>
      </td>
    </tr>
  );
}

const PAPER_SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL'];

const PF_API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const _companySearchCache = new Map(); // "q.toLowerCase()" → [contact, ...]

// Map Caspio's "Sales_Rep" text ("Nika Lao", "Taneisha Clark", ...) to the
// PaperForm's <select> value slug ("nika", "taneisha", ...). Unknown reps
// (e.g. "House") return '' — callers should fall back to existing salesRep.
function mapSalesRep(name) {
  if (!name) return '';
  const n = String(name).toLowerCase();
  if (n.includes('nika'))     return 'nika';
  if (n.includes('taneisha')) return 'taneisha';
  if (n.includes('erik'))     return 'erik';
  if (n.includes('ruth'))     return 'ruth';
  if (n.includes('jim'))      return 'jim';
  return '';
}

async function searchCompanies(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  if (_companySearchCache.has(key)) return _companySearchCache.get(key);
  try {
    const r = await fetch(`${PF_API_BASE}/api/company-contacts-2026/search?q=${encodeURIComponent(q)}&limit=10`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const results = Array.isArray(data?.companies) ? data.companies : [];
    _companySearchCache.set(key, results);
    return results;
  } catch (err) {
    console.error('[OrderForm] company search failed:', err);
    return []; // visible empty state — no silent cache fallback (CLAUDE.md rule #4)
  }
}

// Typeahead for the Company field. Mirrors ProductCombobox in line-items.jsx —
// debounced, arrow-key nav, click-outside close, no silent fallback.
// Picking a company calls onPick(company) where company is the grouped record
// returned by /company-contacts-2026/search (includes nested contacts[]).
function CompanyCombobox({ value, onChange, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [active, setActive] = useState(0);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrap = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function handler(e) {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = (query || '').trim();
    if (q.length < 2) { setMatches([]); return; }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const results = await searchCompanies(q);
      if (cancelled) return;
      setMatches(results || []);
      setActive(0);
      setLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  function pick(c) {
    onPick(c);
    setQuery(c.Company_Name || '');
    setOpen(false);
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter')     { if (matches[active]) { e.preventDefault(); pick(matches[active]); } }
    else if (e.key === 'Escape')    { setOpen(false); }
  }

  return (
    <div className="combobox combobox--company" ref={wrap} style={{position:'relative'}}>
      <input
        className="p-in"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        autoComplete="off"
      />
      {open && (
        <div className="combobox-menu">
          {loading && matches.length === 0 ? (
            <div className="combobox-empty">Searching customers…</div>
          ) : matches.length > 0 ? matches.map((c, i) => {
            const loc = [c.City, c.State].filter(Boolean).join(', ');
            const contactCount = (c.contacts || []).length;
            return (
              <div
                key={`${c.id_Customer}-${i}`}
                className={"combobox-item" + (i === active ? ' active' : '')}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              >
                <div className="style-no">{c.Company_Name}</div>
                <div className="desc">
                  {loc || '—'}
                  {contactCount > 0 ? ` · ${contactCount} contact${contactCount === 1 ? '' : 's'}` : ' · no email contacts'}
                </div>
              </div>
            );
          }) : (query || '').trim().length >= 2 ? (
            <div className="combobox-empty">No matches for "{query}" — keep typing to add a new customer</div>
          ) : (
            <div className="combobox-empty">Type at least 2 characters…</div>
          )}
        </div>
      )}
    </div>
  );
}

// Renders inside the Name cell when a company has been picked AND the company
// has at least one emailable contact. Single <select> + a "+ New contact"
// link to drop back into manual First/Last/Email entry.
function ContactPicker({ contacts, contactId, onPickContact, onManualEntry }) {
  return (
    <div className="contact-picker">
      <select
        className="p-in"
        value={contactId || ''}
        onChange={(e) => onPickContact(e.target.value)}
      >
        {contacts.map(c => (
          <option key={c.ID_Contact} value={String(c.ID_Contact)}>
            {c.ct_NameFull || `${c.NameFirst} ${c.NameLast}`.trim() || '(unnamed)'}
            {c.Email ? ` — ${c.Email}` : ''}
          </option>
        ))}
      </select>
      <button type="button" className="link-btn" onClick={onManualEntry}>+ New contact</button>
    </div>
  );
}

function PaperForm({ info, setInfo, rows, setRows, ship, setShip, orderNotes, setOrderNotes, files, setFiles, decoConfig = {}, setDecoConfig = () => {}, breakdown = null, customerMode = false, draftId = null, staffFilled = [] }) {
  const lockSalesRep = customerMode && staffFilled.includes('salesRep');
  const lockPO       = customerMode && staffFilled.includes('po');
  const activeDeco = decoConfig?.method || rows.find(r => r?.deco)?.deco || '';
  const decoSet = new Set([activeDeco].filter(Boolean));
  function toggleDeco(key) {
    // Single-deco form: clicking the active method again clears it; clicking
    // a different method swaps. Reseed decoConfig from the new method's
    // defaults so the ConfigBar shows the right inputs.
    const becomingActive = activeDeco !== key;
    const nextDeco = becomingActive ? key : '';
    setRows(rows.map(r => ({ ...r, deco: nextDeco })));
    if (becomingActive) {
      const mod = window.OrderFormPricing?.getMethod?.(key);
      setDecoConfig({ method: key, ...(mod?.defaultFormConfig?.() || {}) });
    } else {
      setDecoConfig({});
    }
  }
  function update(k, v) { setInfo({ ...info, [k]: v }); }
  function updateShip(k, v) { setShip({ ...ship, [k]: v }); }
  function addRow() { setRows([...rows, makeBlankRow()]); }

  const totals = useMemo(() => {
    let grand = 0;
    const byDeco = { embroidery: 0, screenprint: 0, dtg: 0, dtf: 0, sticker: 0, emblem: 0 };
    rows.forEach(r => {
      let t = 0;
      Object.values(r.sizes || {}).forEach(v => { t += Number(v || 0); });
      grand += t;
      byDeco[r.deco] = (byDeco[r.deco] || 0) + t;
    });
    return { grand, byDeco };
  }, [rows]);

  // Submit guard: at least one row must have a style (or manual cost) AND qty > 0.
  const canSubmit = useMemo(() => {
    return rows.some(r => {
      const hasQty = Object.values(r?.sizes || {}).some(v => Number(v) > 0);
      const hasStyle = !!(r?.style && r.style.trim());
      const hasManual = !!r?.manualMode && Number(r?.manualCost) > 0;
      return hasQty && (hasStyle || hasManual);
    });
  }, [rows]);

  // Pad to at least 14 rows visible for a paper-form feel
  const visibleRows = rows.length < 14
    ? [...rows, ...Array.from({ length: 14 - rows.length }, () => makeBlankRow())]
    : rows;

  // Ensure padding rows get real ids when edited
  function onRowChange(idx, next) {
    if (idx < rows.length) {
      setRows(rows.map((r, i) => i === idx ? next : r));
    } else {
      // promote a padding row into rows
      const pad = Array.from({ length: idx - rows.length }, () => makeBlankRow());
      setRows([...rows, ...pad, next]);
    }
  }

  const [caspioMsg, setCaspioMsg] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Close lightbox on ESC. Listener only attached while it's open.
  useEffect(() => {
    if (!lightboxUrl) return;
    function onKey(e) { if (e.key === 'Escape') setLightboxUrl(null); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  async function submit() {
    if (submitting) return;
    if (!canSubmit) {
      setCaspioMsg({ kind: 'err', text: 'Add at least one row with a style and quantity before submitting.' });
      setTimeout(() => setCaspioMsg(null), 5000);
      return;
    }
    setSubmitting(true);
    try {
      const res = await window.nwOrderAPI.submitOrder({ info, rows, ship, orderNotes, files, draftId, decoConfig, breakdown });
      if (res.ok) {
        const modeLabel = res.mode === 'mock' ? 'mock mode (backend unreachable)' : 'ShopWorks';
        let text = `Order ${res.orderId} — submitted to ${modeLabel}${res.shopWorksId ? ' · SW# ' + res.shopWorksId : ''}`;
        // Surface any sizes the engine couldn't price (e.g. PC61 XS) so the
        // rep knows what didn't make it into ShopWorks. They can re-submit
        // with a manual price override if those sizes were intentional.
        const skipped = Array.isArray(res.skippedLines) ? res.skippedLines : [];
        if (skipped.length) {
          const summary = skipped.map(s => `${s.style} ${s.size} (${s.quantity})`).join(', ');
          text += ` · ⚠ Skipped (no pricing): ${summary}`;
        }
        setCaspioMsg({ kind: skipped.length ? 'warn' : 'ok', text });
      } else {
        setCaspioMsg({ kind: 'err', text: `ShopWorks push failed: ${res.error}` });
      }
    } finally {
      setSubmitting(false);
      setTimeout(() => setCaspioMsg(null), 9000);
    }
  }

  async function generateCustomerLink() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await window.nwOrderAPI.saveDraft({ info, rows, ship, orderNotes, files, decoConfig });
      if (res && res.success && res.draftId) {
        const url = `${window.location.origin}/order-form/${res.draftId}`;
        setShareUrl(url);
        setCaspioMsg({ kind: 'ok', text: `Share link ready: ${res.draftId}` });
      } else {
        setCaspioMsg({ kind: 'err', text: 'Could not save draft — ' + (res?.error || 'unknown error') });
      }
    } catch (err) {
      setCaspioMsg({ kind: 'err', text: 'Draft save failed: ' + err.message });
    } finally {
      setSubmitting(false);
      setTimeout(() => setCaspioMsg(null), 9000);
    }
  }

  return (
    <div className="paper">
      {/* Header */}
      <div className="p-header">
        <div className="p-brand">
          <div className="p-mark"><LogoMark size={56}/></div>
        </div>
        <div className="p-title">
          <h1>Order Form</h1>
          <div className="contact">
            Northwest Custom Apparel &nbsp;·&nbsp; 1-800-851-3671<br/>
            <a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a>
            <span className="text-us"> · text us 253-922-5793</span>
          </div>
        </div>
        <div className="p-right">
          <div className="stamp">
            <strong>NW-{new Date().getFullYear()}</strong>
            {String(Math.floor(Math.random()*9000)+1000)}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="p-info">
        <div className="p-cell">
          <div className="lbl">Company</div>
          <CompanyCombobox
            value={info.company}
            onChange={(v) => {
              // Free typing — clear contact picker so user can switch back to manual entry.
              if (v !== info.company) {
                setInfo({ ...info, company: v, contacts: [], contactId: '' });
              } else {
                update('company', v);
              }
            }}
            onPick={(c) => {
              const cs = Array.isArray(c.contacts) ? c.contacts : [];
              const top = cs[0] || null;
              setInfo({
                ...info,
                company:    c.Company_Name || '',
                phone:      c.Company_Phone || '',
                address:    c.Address || '',
                city:       c.City || '',
                state:      c.State || '',
                zip:        c.Zip || '',
                salesRep:   mapSalesRep(c.Sales_Rep) || info.salesRep,
                contacts:   cs,
                contactId:  top ? String(top.ID_Contact) : '',
                buyerFirst: top ? (top.NameFirst || '') : '',
                buyerLast:  top ? (top.NameLast || '')  : '',
                email:      top ? (top.Email || '')     : '',
              });
            }}
          />
        </div>
        <div className="p-cell">
          <div className="lbl">Phone</div>
          <input className="p-in" value={info.phone} onChange={e => update('phone', e.target.value)} />
        </div>
        <div className="p-cell">
          <div className="lbl">Date in</div>
          <input className="p-in" type="date" value={info.dateIn} onChange={e => update('dateIn', e.target.value)} />
        </div>

        <div className="p-cell">
          <div className="lbl">{(info.contacts && info.contacts.length > 0) ? `Contact at ${info.company || 'company'}` : 'Name (first / last)'}</div>
          {(info.contacts && info.contacts.length > 0) ? (
            <ContactPicker
              contacts={info.contacts}
              contactId={info.contactId}
              onPickContact={(id) => {
                const c = info.contacts.find(x => String(x.ID_Contact) === String(id));
                if (!c) return;
                setInfo({
                  ...info,
                  contactId:  String(c.ID_Contact),
                  buyerFirst: c.NameFirst || '',
                  buyerLast:  c.NameLast || '',
                  email:      c.Email || '',
                });
              }}
              onManualEntry={() => setInfo({ ...info, contacts: [], contactId: '', buyerFirst: '', buyerLast: '', email: '' })}
            />
          ) : (
            <div className="p-name-row">
              <input className="p-in" value={info.buyerFirst} onChange={e => update('buyerFirst', e.target.value)} placeholder="First" />
              <input className="p-in" value={info.buyerLast} onChange={e => update('buyerLast', e.target.value)} placeholder="Last" />
            </div>
          )}
        </div>
        <div className="p-cell">
          <div className="lbl">Email</div>
          <input className="p-in" value={info.email} onChange={e => update('email', e.target.value)} readOnly={!!(info.contacts && info.contacts.length > 0)} />
        </div>
        <div className="p-cell">
          <div className="lbl">Date due</div>
          <input className="p-in" type="date" value={info.dateDue} onChange={e => update('dateDue', e.target.value)} />
        </div>

        <div className="p-cell">
          <div className="lbl">PO #{lockPO && <span style={{fontSize:9,color:'var(--ink-3)',marginLeft:6}}>(set by staff)</span>}</div>
          <input className="p-in" value={info.po} onChange={e => update('po', e.target.value)} readOnly={lockPO} />
        </div>
        <div className="p-cell">
          <div className="lbl">Sales Rep{lockSalesRep && <span style={{fontSize:9,color:'var(--ink-3)',marginLeft:6}}>(set by staff)</span>}</div>
          <select className="p-in" value={info.salesRep} onChange={e => update('salesRep', e.target.value)} disabled={lockSalesRep}>
            <option value="">—</option>
            <option value="nika">Nika Lao</option>
            <option value="erik">Erik Mickelson</option>
            <option value="ruth">Ruth Nhoung</option>
            <option value="taneisha">Taneisha Clark</option>
            <option value="jim">Jim Mickelson</option>
          </select>
        </div>
        <div className="p-cell deco-cell">
          {ALL_DECOS.map(d => (
            <label key={d.key} className={"p-deco" + (decoSet.has(d.key) ? ' on' : '')}>
              <input type="checkbox" checked={decoSet.has(d.key)} onChange={() => toggleDeco(d.key)} />
              <span className="p-chk"></span>
              <span>{d.label}</span>
            </label>
          ))}
        </div>

        <div className="p-cell" style={{gridColumn:'span 3'}}>
          <div className="lbl">Address</div>
          <input className="p-in" value={info.address} onChange={e => update('address', e.target.value)} />
        </div>

        <div className="p-cell">
          <div className="lbl">City</div>
          <input className="p-in" value={info.city} onChange={e => update('city', e.target.value)} />
        </div>
        <div className="p-cell">
          <div className="lbl">State</div>
          <input className="p-in" value={info.state} onChange={e => update('state', e.target.value)} />
        </div>
        <div className="p-cell">
          <div className="lbl">Zip</div>
          <input className="p-in" value={info.zip} onChange={e => update('zip', e.target.value)} />
        </div>
      </div>

      {/* Deco config strip — renders the active method's ConfigBar (stitch
          count + location for embroidery, ink colors for SP, etc.) plus a
          dismissible Beta chip for non-verified methods. Hidden when no
          deco is selected. Pricing pages this strip mirrors are linked from
          each method's `referenceUrl`. */}
      <DecoConfigStrip
        deco={activeDeco}
        decoConfig={decoConfig}
        setDecoConfig={setDecoConfig}
      />

      {/* Garments table */}
      <table className="p-table">
        <colgroup>
          <col className="c-style"/><col className="c-color"/><col className="c-desc"/>
          <col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/>
          <col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/>
          <col className="c-other"/>
          <col className="c-price"/>
          <col className="c-total"/>
        </colgroup>
        <thead>
          <tr>
            <th className="left">Style #</th>
            <th className="left">Color</th>
            <th className="left">Description</th>
            <th>XS</th><th>S</th><th>M</th><th>L</th><th>XL</th><th>2XL</th><th>3XL</th><th>4XL</th>
            <th className="nss-head">Other sizes</th>
            <th>Price</th>
            <th className="total-head">Total</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.slice(0, 14).flatMap((r, i) => {
            const rb = breakdown?.byRow?.get?.(r.id) || null;
            const rowEl = (
              <PaperRow
                key={r.id}
                row={r}
                idx={i}
                onChange={(next) => onRowChange(i, next)}
                canRemove={rows.length > 1}
                customerMode={customerMode}
                onLightbox={setLightboxUrl}
                rowBreakdown={rb}
              />
            );
            // Append the breakdown line directly under each priced row so the
            // ShopWorks-bound part numbers stay visible. Returns null when the
            // row has no qty / no breakdown — RowBreakdownLine guards itself.
            const bdEl = rb && !rb.error ? (
              <RowBreakdownLine
                key={`${r.id}-bd`}
                row={r}
                rowBreakdown={rb}
                customerMode={customerMode}
              />
            ) : null;
            return bdEl ? [rowEl, bdEl] : [rowEl];
          })}
        </tbody>
      </table>

      {/* Totals panel — slim, right-aligned summary; renders empty placeholders when no qty yet */}
      <TotalsPanel
        deco={activeDeco}
        decoConfig={decoConfig}
        breakdown={breakdown}
        customerMode={customerMode}
      />

      {/* Footer: Notes / Shipping */}
      <div className="p-footer">
        <div className="p-cell">
          <div style={{display:'flex',gap:12,alignItems:'flex-end',marginBottom:6}}>
            <div style={{flex:'0 0 140px'}}>
              <div className="lbl">Terms</div>
              <select className="p-in" value={info.terms || 'Prepaid'} onChange={e => update('terms', e.target.value)}>
                <option value="Prepaid">Prepaid</option>
                <option value="Pay On Pickup">Pay On Pickup</option>
              </select>
            </div>
            <div style={{flex:'1 1 auto'}}>
              <div className="lbl">Order notes</div>
              <textarea className="p-in textarea" rows={1}
                        value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-cell">
          <div className="p-ship-row">
            <strong>Ship</strong>
            {[{k:'ups',l:'UPS'},{k:'willcall',l:'Will Call'},{k:'other',l:'Other'}].map(m => (
              <label key={m.k} className={ship.method===m.k?'on':''}>
                <input type="radio" name="pship" checked={ship.method===m.k} onChange={() => updateShip('method', m.k)} />
                <span className={"p-chk" + (ship.method===m.k?' ':'') } style={ship.method===m.k?{background:'color-mix(in oklab, var(--accent) 14%, #fff)'}:{}}>
                  {ship.method===m.k && <span style={{color:'var(--accent)',fontWeight:800,fontSize:11,position:'relative',top:-1}}>✓</span>}
                </span>
                <span>{m.l}</span>
              </label>
            ))}
          </div>
          <div className="lbl">Ship to address</div>
          <input className="p-in" value={ship.address} onChange={e => updateShip('address', e.target.value)} />
          <div className="p-ship-csz">
            <div>
              <div className="lbl">City</div>
              <input className="p-in" value={ship.city} onChange={e => updateShip('city', e.target.value)} />
            </div>
            <div>
              <div className="lbl">State</div>
              <input className="p-in" value={ship.state} onChange={e => updateShip('state', e.target.value)} />
            </div>
            <div>
              <div className="lbl">Zip</div>
              <input className="p-in" value={ship.zip} onChange={e => updateShip('zip', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Artwork upload — drag/drop files, uploaded to Caspio hosted storage for ShopWorks */}
      <div className="p-artwork" style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--line)'}}>
        <div className="lbl" style={{marginBottom:8}}>Artwork (optional — for embroidery/print production)</div>
        <Artwork files={files} setFiles={setFiles} />
      </div>

      {/* Design # row — Design # is editable so reps can link to existing
          ShopWorks designs by number. Backend looks up id_Design and attaches
          {id_Design: N} to the MO push instead of creating a generic design.
          Empty `info.designNumber` falls back to whatever's parsed from
          uploaded artwork (files[].designNo). */}
      <div className="p-design">
        <div className="p-cell">
          <div className="lbl">Design # <span style={{fontSize:9,color:'var(--ink-3)',marginLeft:6}}>(known design? type the # to link in ShopWorks)</span></div>
          <input
            className="p-in"
            value={info.designNumber ?? files.map(f=>f.designNo).filter(Boolean).join(', ')}
            onChange={e => update('designNumber', e.target.value)}
            placeholder="e.g. 12345 — comma-separated for multiple"
          />
        </div>
        <div className="p-cell">
          <div className="lbl">Logo placement(s)</div>
          <input className="p-in" value={[...new Set(files.flatMap(f => f.placements || []))].join(', ')} readOnly />
        </div>
        <div className="p-cell">
          <div className="lbl">Art / production notes</div>
          <input className="p-in" value={info.artNotes || ''} onChange={e => update('artNotes', e.target.value)} placeholder="Thread color, stitch count, special instructions…" />
        </div>
      </div>

      {/* Customer-mode banner — shows when loaded from a share link */}
      {customerMode && draftId && (
        <div className="caspio-banner" style={{marginTop:16, background:'color-mix(in oklab, var(--accent) 8%, #fff)', borderColor:'var(--accent)'}}>
          <Icon name="info" size={16}/>
          <span>You're completing a shared order from Northwest Custom Apparel. Review the pre-filled info, add your garments, then click <strong>Submit order</strong> when ready. Reference: <strong>{draftId}</strong></span>
        </div>
      )}

      {/* Caspio status */}
      {caspioMsg && (
        <div className={"caspio-banner " + (caspioMsg.kind === 'ok' ? 'ok' : 'err')} style={{marginTop:16}}>
          <Icon name={caspioMsg.kind === 'ok' ? 'check' : 'info'} size={16}/>
          <span>{caspioMsg.text}</span>
        </div>
      )}

      {/* Share URL reveal (staff mode) */}
      {!customerMode && shareUrl && (
        <div className="caspio-banner ok" style={{marginTop:12, flexWrap:'wrap'}}>
          <Icon name="check" size={16}/>
          <span style={{flex:'1 1 auto', minWidth:0}}>
            <strong>Customer link:</strong>{' '}
            <input readOnly value={shareUrl} style={{width:'100%',fontFamily:'var(--font-mono)',fontSize:12,padding:'4px 6px',marginTop:4,border:'1px solid var(--line)',borderRadius:4}} onFocus={e=>e.target.select()} />
          </span>
          <button className="btn subtle sm" onClick={() => { navigator.clipboard.writeText(shareUrl); }}>Copy</button>
        </div>
      )}

      {/* Actions */}
      <div className="p-actions">
        <div className="aggregate">
          <span>Garments <strong className="num">{totals.grand}</strong></span>
          <span>Artwork <strong className="num">{files.length}</strong></span>
        </div>
        <div className="spacer" />
        <button className="btn subtle sm" onClick={addRow} disabled={submitting}>
          <Icon name="plus" size={14}/> Add row
        </button>
        <button className="btn ghost" onClick={() => {
          document.body.classList.add('print-preview');
          setTimeout(() => window.print(), 150);
        }}>
          <Icon name="doc" size={14}/> Print / PDF
        </button>
        {!customerMode && (
          <button className="btn ghost" onClick={generateCustomerLink} disabled={submitting}>
            <Icon name="upload" size={14}/> Get customer link
          </button>
        )}
        <button
          className="btn primary"
          onClick={submit}
          disabled={submitting || !canSubmit}
          title={!canSubmit ? 'Add at least one row with a style and quantity' : ''}
        >
          {customerMode ? 'Submit order' : 'Push to ShopWorks'} <Icon name="check" size={14}/>
        </button>
      </div>

      {lightboxUrl && (
        <div className="lightbox" onClick={() => setLightboxUrl(null)} role="dialog" aria-modal="true">
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close image"
          >×</button>
          <img
            src={lightboxUrl}
            alt="Product image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}

Object.assign(window, { PaperForm });
