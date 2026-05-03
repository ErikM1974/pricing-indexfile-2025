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
function NonStandardSizePicker({ row, onChange, availableSizes, inventory }) {
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

  // Aliased keys are handled by the standard grid (e.g. XXL appears under
  // the 2XL column for ladies styles). Skip them in the picker so the same
  // value doesn't render in two places at once.
  // Guard: only treat the key as aliased if the standard column it maps
  // to is NOT also a native available size on this product. If a product
  // somehow carries BOTH 2XL and XXL, treat them as separate.
  const availSetForAlias = new Set((availableSizes || []).map(s => String(s).toUpperCase()));
  const isAliased = (k) => {
    const colKey = columnKeyForAliasedSize(k);
    if (!colKey) return false;
    return !availSetForAlias.has(colKey.toUpperCase());
  };

  const enteredNonStd = Object.keys(sizes)
    .filter(k => !standardSet.has(k.toUpperCase()) && !isAliased(k) && k in sizes)
    .sort((a, b) => sortIdx(a) - sortIdx(b));

  // Picker options: pull dynamically from availableSizes, filter to anything
  // not already in the standard XS-4XL grid AND not aliased to a standard
  // column AND not already entered.
  const remaining = (availableSizes || [])
    .filter(s => !standardSet.has(String(s).toUpperCase()))
    .filter(s => !isAliased(s))
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
      {enteredNonStd.map(s => {
        // SanMar inventory badge for non-standard sizes (5XL, 6XL, XXL, etc.).
        // Same lookup pattern as the standard grid cells — keys match the
        // SanMar endpoint's named-size response.
        const invAvailable = inventory?.bySize?.[s];
        const invKnown = inventory?.status === 'ok' && Number.isFinite(Number(invAvailable));
        const cellQty = Number(sizes[s]) || 0;
        const klass = invKnown && window.OrderFormInventory
          ? window.OrderFormInventory.classifyInventory(cellQty, invAvailable)
          : 'unknown';
        return (
          <span key={s} className="nss-chip">
            <span className="nss-chip-label">{prettyPrintSize(s)}</span>
            <input
              className="nss-chip-qty"
              inputMode="numeric"
              value={sizes[s] || ''}
              onChange={(e) => setSize(s, e.target.value)}
              placeholder="0"
              title={invKnown ? `SanMar stock: ${invAvailable.toLocaleString()} ${prettyPrintSize(s)}` : ''}
            />
            <button
              type="button"
              className="nss-chip-remove"
              onClick={() => setSize(s, '')}
              aria-label={`Remove ${s}`}
              tabIndex={-1}
            >×</button>
            {invKnown && (
              <span className={`sz-inv-badge sz-inv-${klass} nss-chip-inv`}>{invAvailable.toLocaleString()}</span>
            )}
          </span>
        );
      })}
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

// BulkSizePicker — used in custom-sizes mode for products with too many
// size variants to fit inline (PT20 has 72 W×L combos; CTB17 has 46).
// Renders as a single "+ Add size" button until the rep picks. Once a size
// is chosen, it appears as an inline chip with a qty input. Replaces the
// old mass-grid layout that wasted ~40% of the form's vertical space.
//
// Picker dropdown: filterable grid of all available sizes, each showing
// the SanMar inventory count below. Click a cell to add it as a chip.
//
// Pricing/storage: writes to row.sizes[<size>] just like the inline mode
// did. The pricing engine + ShopWorks push see no difference.
function BulkSizePicker({ row, onChange, availableSizes, inventory }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrap = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') { setOpen(false); setFilter(''); } }
    if (open) {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
      // Auto-focus the filter input when the picker opens
      setTimeout(() => filterRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sizes = row.sizes || {};
  const enteredSizes = Object.keys(sizes).filter(k => Number(sizes[k]) > 0 || sizes[k] === '');

  function setSizeQty(s, v) {
    const next = { ...sizes };
    if (v) next[s] = v.replace(/[^0-9]/g, '');
    else delete next[s];
    onChange({ sizes: next });
  }

  function addSize(s) {
    onChange({ sizes: { ...sizes, [s]: '' } });
    setOpen(false);
    setFilter('');
  }

  function removeSize(s) {
    const next = { ...sizes };
    delete next[s];
    onChange({ sizes: next });
  }

  // Filter the picker grid: match against pretty-printed AND raw size codes
  // so the rep can type "32" and find both "32×30" (W×L) and any plain "32".
  const filterLower = filter.trim().toLowerCase();
  const filteredAvailable = (availableSizes || []).filter(s => {
    if (!filterLower) return true;
    const raw = String(s).toLowerCase();
    const pretty = prettyPrintSize(s).toLowerCase();
    return raw.includes(filterLower) || pretty.includes(filterLower);
  });

  return (
    <div className="bulk-picker" ref={wrap}>
      <div className="bulk-picker-chips">
        {enteredSizes.map(s => {
          const inv = inventory?.bySize?.[s];
          const invKnown = inventory?.status === 'ok' && Number.isFinite(Number(inv));
          const cellQty = Number(sizes[s]) || 0;
          const klass = invKnown && window.OrderFormInventory
            ? window.OrderFormInventory.classifyInventory(cellQty, inv)
            : 'unknown';
          return (
            <span key={s} className="bulk-chip">
              <span className="bulk-chip-label">{prettyPrintSize(s)}</span>
              <input
                className="bulk-chip-qty"
                inputMode="numeric"
                value={sizes[s] ?? ''}
                onChange={(e) => setSizeQty(s, e.target.value)}
                placeholder="0"
                title={invKnown ? `SanMar stock: ${inv.toLocaleString()} ${prettyPrintSize(s)}` : ''}
              />
              <button
                type="button"
                className="bulk-chip-remove"
                onClick={() => removeSize(s)}
                aria-label={`Remove ${prettyPrintSize(s)}`}
                tabIndex={-1}
              >×</button>
              {invKnown && (
                <span className={`sz-inv-badge sz-inv-${klass} bulk-chip-inv`}>{inv.toLocaleString()}</span>
              )}
            </span>
          );
        })}
        <button
          type="button"
          className="bulk-add-btn"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          + Add size <span className="bulk-add-caret" aria-hidden="true">▾</span>
        </button>
      </div>

      {open && (
        <div className="bulk-picker-menu" role="dialog" aria-label="Add a size to this row">
          <div className="bulk-picker-head">
            <input
              ref={filterRef}
              type="text"
              className="bulk-picker-filter"
              placeholder="Filter sizes (try '32' for 32×N or N×32)…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <span className="bulk-picker-count">
              {filteredAvailable.length} of {(availableSizes || []).length} sizes
            </span>
          </div>
          {filteredAvailable.length === 0 ? (
            <div className="bulk-picker-empty">No sizes match "{filter}"</div>
          ) : (
            <div className="bulk-picker-grid">
              {filteredAvailable.map(s => {
                const inv = inventory?.bySize?.[s];
                const invKnown = inventory?.status === 'ok' && Number.isFinite(Number(inv));
                const isAlreadyEntered = s in sizes;
                return (
                  <button
                    type="button"
                    key={s}
                    className={"bulk-picker-cell" + (isAlreadyEntered ? ' bulk-picker-cell--entered' : '')}
                    onMouseDown={(e) => { e.preventDefault(); if (!isAlreadyEntered) addSize(s); }}
                    title={invKnown ? `SanMar stock: ${inv.toLocaleString()}${isAlreadyEntered ? ' (already added)' : ''}` : (isAlreadyEntered ? 'Already added' : '')}
                    disabled={isAlreadyEntered}
                  >
                    <span className="bulk-picker-cell-size">{prettyPrintSize(s)}</span>
                    {invKnown && (
                      <span className={"bulk-picker-cell-inv" + (Number(inv) === 0 ? ' is-oos' : '')}>
                        {Number(inv) === 0 ? '0' : inv.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
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
function PaperRow({ row, onChange, onRemove, canRemove, idx, customerMode, onLightbox, rowBreakdown, onInventoryChange }) {
  const [mcpOpen, setMcpOpen] = useState(false);
  // Per-size SanMar inventory map — { 'S': 3229, 'M': 7045, 'XL': 1245, ... }
  // populated by the effect below when style + catalogColor are set.
  // status: 'ok' (we have data), 'unknown' (nothing to query / fetch failed
  // gracefully), 'loading' (request in flight).
  const [inventory, setInventory] = useState({ bySize: {}, status: 'unknown' });

  // Phase 3e — Service Rail drop target state. When a rail card is being
  // dragged anywhere on the page, rows become drop targets. Visual feedback:
  // green outline on eligible rows, red on incompatible (e.g. AS-CAP onto
  // a tee row). On drop, invokes window.__railHandleDrop which lives in
  // ServiceRail (set via useEffect there).
  const [railDragging, setRailDragging] = useState(false);
  const [railOver, setRailOver] = useState(false);
  useEffect(() => {
    function onStart() { setRailDragging(true); }
    function onEnd() { setRailDragging(false); setRailOver(false); }
    window.addEventListener('railDragStart', onStart);
    window.addEventListener('railDragEnd', onEnd);
    return () => {
      window.removeEventListener('railDragStart', onStart);
      window.removeEventListener('railDragEnd', onEnd);
    };
  }, []);

  // Eligibility: read scope from the dragged payload + this row's capOrFlat
  function railEligible() {
    const payload = window.__railDragPayload;
    if (!payload) return false;
    const scopeOf = window.OrderFormDropZone_scopeOf;
    const sc = scopeOf ? scopeOf(payload.service.ServiceCode) : 'any';
    if (sc === 'any') return true; // universal/order-level can drop anywhere
    const kind = rowBreakdown?.extras?.capOrFlat;
    if (sc === 'cap') return kind === 'cap';
    if (sc === 'flat') return kind === 'flat';
    return true;
  }
  function handleRailDragOver(e) {
    if (!railDragging || !railEligible()) return;
    e.preventDefault();
    setRailOver(true);
  }
  function handleRailDragLeave() { setRailOver(false); }
  function handleRailDrop(e) {
    e.preventDefault();
    setRailOver(false);
    if (!railEligible() || !window.__railHandleDrop) return;
    window.__railHandleDrop({
      zoneType: 'row',
      rowId: row.id,
      rowKind: rowBreakdown?.extras?.capOrFlat || 'flat',
    });
  }

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
  // ProductCombobox.onPick never fires and row.desc would stay empty. This
  // effect fills it from /api/product-colors. It also REFRESHES on style
  // change so a rep who picks 111 then changes the style to 112FP gets the
  // 112FP description (was bug: stale 111 desc stuck under PartNumber 112FP
  // — see OF-0025).
  //
  // descSource gates the refresh: 'auto' (default) lets us overwrite,
  // 'manual' (set when the rep types in the desc textarea) leaves their
  // edit alone forever.
  useEffect(() => {
    if (!row.style) return;
    if (row.descSource === 'manual' && row.desc) return;  // honor rep edits
    if (!window.fetchProductInfo) return;
    let cancelled = false;
    window.fetchProductInfo(row.style).then(info => {
      if (cancelled) return;
      const title = (info?.productTitle || '').trim();
      if (!title) return;
      if (row.descSource === 'manual' && row.desc) return; // re-check after async
      if (title !== row.desc) update({ desc: title, descSource: 'auto' });
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
      // Surface to parent so submit() can do a stock-confirmation check
      // across all rows. Optional callback — parent isn't required to wire it.
      if (typeof onInventoryChange === 'function') onInventoryChange(row.id, result);
    }).catch(() => {
      if (!cancelled) {
        const empty = { bySize: {}, status: 'unknown' };
        setInventory(empty);
        if (typeof onInventoryChange === 'function') onInventoryChange(row.id, empty);
      }
    });
    return () => { cancelled = true; };
  }, [row.style, row.catalogColor, row.colorName, row.color, row.manualMode, row.deco,
      // re-run when availableSizes resolves
      JSON.stringify(rowBreakdown?.extras?.availableSizes || [])]);

  // ----- Stale alias-key migration -----
  // The bundle resolves AFTER the rep starts typing. If they enter qty in
  // the 2XL column for a ladies style (L500, etc.) before the bundle says
  // "this product uses XXL not 2XL", the qty lands in row.sizes['2XL'].
  // When the bundle resolves, the alias kicks in: input now reads
  // row.sizes['XXL'] (empty) and the pricing engine can't price '2XL'
  // (bundle.sizes lists 'XXL'). The qty appears to vanish + breakdown row
  // says SKIPPED (NO PRICE).
  //
  // Fix: when availSet changes, walk the standard grid columns and migrate
  // any orphan entries to their effective key. Only fires when the column
  // key isn't in availSet AND a value exists under it AND the alias slot
  // is empty (so we never clobber real data).
  useEffect(() => {
    const extras = rowBreakdown?.extras || {};
    const availableSizesNow = extras.availableSizes || null;
    if (!availableSizesNow || !availableSizesNow.length) return;
    const availSetNow = new Set(availableSizesNow.map(s => String(s).toUpperCase()));
    const sizes = row.sizes || {};
    const migrations = [];
    PAPER_SIZES.forEach(col => {
      const eff = effectiveSizeKey(col, availSetNow);
      if (eff && eff !== col && sizes[col] != null && sizes[eff] == null) {
        migrations.push([col, eff]);
      }
    });
    if (migrations.length === 0) return;
    const next = { ...sizes };
    migrations.forEach(([from, to]) => {
      next[to] = next[from];
      delete next[from];
    });
    update({ sizes: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rowBreakdown?.extras?.availableSizes || [])]);

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
  // Headline unit: the row's effective per-piece price (line subtotal ÷ qty).
  // For rows whose sizes span multiple price tiers (S-XL at $78 + 2XL at $80
  // + 3XL at $81 + 4XL at $82), this is the honest blended cost — every
  // size's actual price weighted by its qty. The N6 tier pills above the row
  // carry the per-size breakdown, so the rep can always see how the avg was
  // built. Single-tier rows (all sizes at one price) compute to that exact
  // price, so simple cases read identically to before.
  //
  // overrideDefault: when a rep clicks the cell to type a custom price, we
  // pre-fill the input with the BASE size price (clean whole-dollar number)
  // rather than the avg (which can have ugly cents like $78.82). They almost
  // always retype anyway; this is just a friendlier starting point.
  const avgUnit = (showAutoPriceCell && total > 0) ? rowSubtotalDollars / total : 0;
  const headlineUnit = (avgUnit > 0) ? avgUnit : (basePrice != null ? basePrice : 0);
  const overrideDefault = (basePrice != null) ? basePrice : headlineUnit;
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

  // Build row className with rail drop-target visuals when applicable
  let trCls = hasAutoPrice ? 'pf-row pf-row--priced' : 'pf-row';
  if (railDragging) {
    trCls += railEligible() ? ' pf-row--rail-eligible' : ' pf-row--rail-ineligible';
    if (railOver) trCls += ' pf-row--rail-over';
  }

  return (
    <tr
      className={trCls}
      onDragOver={handleRailDragOver}
      onDragLeave={handleRailDragLeave}
      onDrop={handleRailDrop}
    >
      <td className="sel-wrap">
        <div className="style-cell">
          <ProductCombobox
            value={row.style}
            onChange={(v) => update({ style: v })}
            onPick={(p) => update({
              style: p.style,
              // Refresh desc unless the rep typed it manually. Same logic as
              // the auto-fill effect — descSource='auto' means it's safe to
              // overwrite when the underlying style changes.
              ...(row.descSource === 'manual' && row.desc
                ? {}
                : { desc: p.desc || '', descSource: 'auto' }),
              ...(row.style && row.style !== p.style ? { colorName: '', catalogColor: '' } : {})
            })}
          />
          {/* Manual-cost UI (✎ toggle, ManualCostPill, ManualCostPrompt) was
              removed 2026-05-01 per Erik — reps don't use it. State + handlers
              (manualMode, mcpOpen, applyManualCost, clearManualCost) are kept
              live in case any saved row already has manualMode=true; the
              price cell still routes those into the manual-input branch
              below. To bring the affordance back, restore the button + popover
              JSX from git history. */}
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
            onChange={e => {
              const v = e.target.value;
              // Mark manual when rep types something; reset to 'auto' when
              // they clear the field (so the next style change re-auto-fills).
              update({ desc: v, descSource: v.trim() ? 'manual' : 'auto' });
            }}
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
            {sizeMode === 'cap-osfa' && (() => {
              // Inventory badge for OSFA — only render for cap-osfa, not single-qty
              // (sticker/emblem are custom products, not SanMar fulfillment).
              const invAvailable = inventory.bySize?.['OSFA'];
              const invKnown = inventory.status === 'ok' && Number.isFinite(Number(invAvailable));
              return (
                <>
                  <span className="size-collapsed-hint">One Size Fits All</span>
                  {invKnown && (
                    <span
                      className={`sz-inv-badge sz-inv-${window.OrderFormInventory.classifyInventory(Number(collapsedQty) || 0, invAvailable)}`}
                      title={`SanMar stock: ${invAvailable.toLocaleString()} OSFA`}
                    >{invAvailable.toLocaleString()}</span>
                  )}
                </>
              );
            })()}
          </div>
        </td>
      ) : sizeMode === 'custom-sizes' ? (
        // Custom-sizes mode — horizontal mini-grid for products with non-
        // standard sizing. Two layouts based on size count:
        //
        //   ≤ 12 sizes (fitted caps S/M/L/XL, tall LT-4XLT, fitted-exact
        //   7 1/8 etc., toddler 2T-6T) — INLINE GRID. All cells visible at
        //   once, like before.
        //
        //   > 12 sizes (pants W×L: PT20=72, CTB17=46, etc.) — BULK PICKER.
        //   Empty until rep picks; chips appear inline as picked. Avoids
        //   the 70-cell mass-grid that dominated the form's vertical space.
        availableSizes.length > 12 ? (
          <td colSpan={9} className="size-collapsed size-collapsed--bulk">
            <BulkSizePicker
              row={row}
              onChange={update}
              availableSizes={availableSizes}
              inventory={inventory}
            />
          </td>
        ) : (
          <td colSpan={9} className="size-collapsed size-collapsed--custom-sizes">
            <div className="size-collapsed-inner size-collapsed-inner--multi">
              {availableSizes.map(sz => {
                const key = String(sz);
                const invAvailable = inventory.bySize?.[key];
                const invKnown = inventory.status === 'ok' && Number.isFinite(Number(invAvailable));
                const cellQty = Number(row.sizes?.[key]) || 0;
                const klass = invKnown
                  ? window.OrderFormInventory.classifyInventory(cellQty, invAvailable)
                  : 'unknown';
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
                      title={invKnown ? `SanMar stock: ${invAvailable.toLocaleString()} ${prettyPrintSize(key)}` : ''}
                    />
                    {invKnown && (
                      <span className={`sz-inv-badge sz-inv-${klass}`}>{invAvailable.toLocaleString()}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </td>
        )
      ) : (
        <>
          {PAPER_SIZES.map(s => {
            // Three states for each size cell:
            //   1. UNAVAILABLE — product doesn't come in this size (bundle.uniqueSizes
            //      doesn't include it AND no alias is available). Render N/A.
            //   2. OUT-OF-STOCK — product carries the size but SanMar inventory = 0.
            //   3. AVAILABLE — render an <input>, badge shows per-size count.
            //
            // ALIASING: ladies styles (L500, L420, ...) carry XXL where unisex
            // carries 2XL. effectiveSizeKey() resolves the column key to the
            // bundle's true key — for L500's 2XL column, we read+write under
            // 'XXL'. The column header still says "2XL" so reps see what they
            // expect; a small "(XXL)" subscript below the cell makes the alias
            // visible. Pricing engines + ShopWorks push see XXL (the truth).
            const effectiveKey = effectiveSizeKey(s, availSet);
            const isAliased = effectiveKey != null && effectiveKey !== s;
            if (effectiveKey == null) {
              return (
                <td key={s} className="sz-unavail" title={`${row.style || 'this product'} doesn't come in ${s} — switch to manual cost (click $) to override`}>
                  <span className="sz-na">N/A</span>
                </td>
              );
            }
            const invAvailable = inventory.bySize?.[effectiveKey];
            const invKnown = inventory.status === 'ok' && Number.isFinite(Number(invAvailable));
            const notStockedLocally = inventory.status === 'not-stocked-local';
            // Out-of-stock used to hard-block this cell. Now a soft warning:
            // input stays enabled (rep may know about backorder, drop-ship,
            // future replenishment), badge shows red "0", submit-time modal
            // confirms before pushing to ShopWorks. Matches custom-sizes /
            // NSSP behavior for consistency. See submit() handler.
            const cellQty = Number(row.sizes[effectiveKey]) || 0;
            const klass = invKnown
              ? window.OrderFormInventory.classifyInventory(cellQty, invAvailable)
              : 'unknown';
            const overflow = klass === 'over';
            const carriedList = (inventory.carriedColors || []).join(', ');
            const aliasNote = isAliased ? ` (this product uses ${effectiveKey})` : '';
            const cellTitle = invKnown
              ? `SanMar stock: ${invAvailable.toLocaleString()} ${effectiveKey}${overflow ? ' — exceeds available' : ''}${aliasNote}`
              : (notStockedLocally
                  ? `${row.colorName || 'This color'} not stocked at NWCA — order from SanMar. ${carriedList ? `Carried locally: ${carriedList}` : ''}`
                  : aliasNote);
            return (
              <td key={s} className={overflow ? 'sz-overflow' : ''}>
                <input
                  className="t-in num"
                  inputMode="numeric"
                  value={row.sizes[effectiveKey] || ''}
                  onChange={e => setSize(effectiveKey, e.target.value)}
                  title={cellTitle}
                />
                {invKnown && (
                  <span className={`sz-inv-badge sz-inv-${klass}`}>{invAvailable.toLocaleString()}</span>
                )}
                {notStockedLocally && (
                  <span className="sz-inv-badge sz-inv-not-local" title={cellTitle}>SanMar</span>
                )}
                {/* In-cell alias label removed (was redundant — the breakdown
                    row below the order line already shows the actual stored
                    size + suffixed PN, e.g. "L500_XXL XXL × 1"). */}
              </td>
            );
          })}
          <td className="nss-td"><NonStandardSizePicker row={row} onChange={update} availableSizes={availableSizes} inventory={inventory} /></td>
        </>
      )}
      <td>
        {/* Per-row AUTO/MANUAL badges removed 2026-05-02 per Erik — every row is
            auto by default; if a row was manually overridden the rep sees the
            RESTORE AUTO pill (which is the actual signal). The badge text was
            redundant noise on every line. The price cell is still:
              - a clickable button when auto (click → flips to manual input)
              - a typeable input when override is active, with RESTORE AUTO
            so all functionality is preserved; only the badge JSX is gone. */}
        {showAutoPriceCell ? (
          <button
            type="button"
            className="t-in num auto-priced"
            onClick={() => update({ priceOverride: true, price: overrideDefault ? overrideDefault.toFixed(2) : '' })}
            title={showUpchargeChip
              ? `Avg per piece: ${fmt$(headlineUnit)} (${fmt$(rowSubtotalDollars)} ÷ ${total} pcs). Sizes span tiers — see tier pills above the row for per-size pricing. Click to enter a flat manual price.`
              : 'Auto-priced — all sizes at this price. Click to enter a flat manual price.'}
          >
            <span className="auto-priced-money">{fmt$(headlineUnit)}</span>
          </button>
        ) : (
          <div className="manual-price-cell">
            <input
              className="t-in num"
              inputMode="decimal"
              value={row.price || ''}
              onChange={e => update({ price: e.target.value.replace(/[^0-9.]/g, '') })}
              placeholder=""
              title={showUpchargeChip
                ? `Manual price — auto-pricing would apply: ${upchargeChipText}`
                : ''}
            />
            {row.priceOverride && hasAutoPrice && (
              <span className="manual-price-meta">
                <button
                  type="button"
                  className="restore-auto-link"
                  onClick={() => update({ priceOverride: false, price: '' })}
                  title="Use auto-calculated price"
                >restore auto</button>
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

  // Compute summary (count + total) for the prefix. Skipped groups don't add
  // to the total. Override mode applies manualUnit to every group.
  let pricedCount = 0;
  let runningTotal = 0;
  sortedGroups.forEach(g => {
    if (g.skipped && !isOverride) return;
    const groupQty = g.sizes.reduce((a, s) => a + s.qty, 0);
    const unit = isOverride ? manualUnit : g.unit;
    pricedCount += 1;
    runningTotal += unit * groupQty;
  });

  // Render each group as an inline span. Format choices:
  //   qty = 1: "{PN} ${unit}"               (no × or = math — trivial)
  //   qty > 1: "{PN} × {qty} = ${lineTotal}" (math kept — not trivial)
  // Skipped groups always show qty so the rep sees "still need a price".
  const segments = sortedGroups.map((g, i) => {
    const groupQty = g.sizes.reduce((a, s) => a + s.qty, 0);
    const sizeList = g.sizes.map(s => prettyPrintSize(s.size)).join('/');
    const showSizeList = sizeList && sizeList !== g.partNumber.replace(partBase, '').replace('_', '');
    if (g.skipped && !isOverride) {
      return (
        <span key={i} className="pf-bd-seg pf-bd-seg--skip">
          <strong>{g.partNumber}</strong>
          {showSizeList && <span className="pf-bd-sizes">{sizeList}</span>}
          {' × '}{groupQty}
          <span className="pf-bd-skip-tag">skipped (no price)</span>
        </span>
      );
    }
    const unit = isOverride ? manualUnit : g.unit;
    const lineTotal = unit * groupQty;
    return (
      <span key={i} className="pf-bd-seg">
        <strong>{g.partNumber}</strong>
        {showSizeList && <span className="pf-bd-sizes">{sizeList}</span>}
        {groupQty === 1
          ? <> {fmt$(unit)}</>
          : <> × {groupQty} = {fmt$(lineTotal)}</>}
      </span>
    );
  });

  // Summary phrase: "ShopWorks (5 SKUs · $226.00):" or "Manual override
  // (5 SKUs · $250.00):" — the count is the priced-group count (skipped
  // groups don't add to the total but still render as segments).
  const skuLabel = pricedCount === 1 ? '1 SKU' : `${pricedCount} SKUs`;
  const summaryText = pricedCount > 0
    ? `${skuLabel} · ${fmt$(runningTotal)}`
    : skuLabel;
  const prefixText = isOverride ? 'Manual override' : 'ShopWorks';

  return (
    <tr className={"pf-breakdown-row" + (isOverride ? ' pf-breakdown-row--manual' : '')}>
      <td colSpan={14}>
        <span className="pf-bd-arrow">↳</span>
        <span className="pf-bd-prefix">{prefixText} ({summaryText}):</span>
        <span className="pf-bd-segments">{segments.reduce((acc, seg, i) => i === 0 ? [seg] : [...acc, <span key={`d${i}`} className="pf-bd-dot"> · </span>, seg], [])}</span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// RowTierPills — thin pill strip rendered ABOVE each priced PaperRow showing
// the price tiers in N6 design style: each pill is "$PRICE SIZE-RANGE",
// surcharge tiers tinted spruce-green. Sizes are grouped by shared price and
// only ordered sizes are shown. Renders nothing when:
//   - no breakdown / no qty
//   - manual override (one flat price — no tiers to show)
// Manual override case is handled by RowBreakdownLine's "Manual override" prefix
// already, so a tier-pills row would be redundant.
// ---------------------------------------------------------------------------
function RowTierPills({ row, rowBreakdown }) {
  if (!row || !rowBreakdown || rowBreakdown.error) return null;
  if (row.priceOverride) return null;
  const sizes = row.sizes || {};
  const totalQty = Object.values(sizes).reduce((a, v) => a + (Number(v) || 0), 0);
  if (!totalQty) return null;

  // Build the canonical size order BEFORE grouping into tiers so each tier's
  // sizes come out in visual order naturally:
  //   1. Standard sizes (XS-4XL) in PAPER_SIZES order — same as the column grid
  //   2. Non-standard sizes (5XL+, OSFA, LT/XLT, etc.) in NON_STANDARD_SIZES order
  //   3. Custom sizes (cap S/M-L/XL, pants 3030/3032/...) in row insertion order —
  //      the row's sizes-object is built in availability order from the bundle, so
  //      Object.keys() preserves that. Avoids alphabetical sort flipping S/M after L/XL.
  const sizeKeys = Object.keys(sizes);
  const sizeKeyIdx = new Map(sizeKeys.map((k, i) => [k, i]));
  const sortIdx = (sz) => {
    const std = PAPER_SIZES.indexOf(sz);
    if (std !== -1) return std;
    const nss = NON_STANDARD_SIZES.indexOf(sz);
    if (nss !== -1) return PAPER_SIZES.length + nss;
    return PAPER_SIZES.length + NON_STANDARD_SIZES.length + (sizeKeyIdx.get(sz) ?? 9999);
  };
  const orderedKeys = sizeKeys.sort((a, b) => sortIdx(a) - sortIdx(b));

  // Group ordered sizes by unit price. Iteration order = canonical visual order.
  const tiers = new Map();
  orderedKeys.forEach(sz => {
    const qty = Number(sizes[sz]) || 0;
    if (!qty) return;
    const unit = rowBreakdown.unitPriceBySize?.[sz];
    if (!Number.isFinite(Number(unit)) || Number(unit) <= 0) return;
    const key = Number(unit).toFixed(2);
    if (!tiers.has(key)) tiers.set(key, { price: Number(unit), sizes: [] });
    tiers.get(key).sizes.push(sz);
  });
  if (tiers.size === 0) return null;

  // Sort tiers by price ascending so cheapest (base) tier is first.
  const tierList = [...tiers.values()].sort((a, b) => a.price - b.price);

  const basePrice = tierList[0].price;

  return (
    <tr className="pf-tier-row">
      <td colSpan={14}>
        <span className="pf-tier-pills">
          {tierList.map((t, i) => {
            const isSurcharge = t.price > basePrice;
            const range = t.sizes.length === 1
              ? prettyPrintSize(t.sizes[0])
              : `${prettyPrintSize(t.sizes[0])}–${prettyPrintSize(t.sizes[t.sizes.length - 1])}`;
            return (
              <span key={i} className={"pf-tier-pill" + (isSurcharge ? ' pf-tier-pill--surcharge' : '')}>
                <span className="pf-tier-price">{fmt$(t.price)}</span>
                <span className="pf-tier-range">{range}</span>
              </span>
            );
          })}
        </span>
      </td>
    </tr>
  );
}

const PAPER_SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL'];

// SIZE ALIASES — for products whose bundle reports a non-standard size that
// is *equivalent* to a standard grid column. Today we know of one case:
// ladies L-prefix styles (L500, L420, etc.) carry XXL where unisex carries
// 2XL. Without this, the form's 2XL column hard-blocks (N/A) on those
// products and reps assume "out of stock" → lost order. With this, typing
// in the 2XL column for L500 stores under XXL (the bundle's true key) so
// pricing + ShopWorks push are unchanged.
//
// Verified against the SanMar Integration Pricelist (14,775 SKUs, 2026-05):
// no product carries BOTH 2XL and XXL — they're mutually exclusive. The
// effectiveSizeKey() helper below guards anyway: it only aliases when the
// column key is absent from the bundle AND the alias is present.
const SIZE_ALIASES = {
  '2XL': ['XXL'],   // ladies styles use XXL where unisex uses 2XL
};

// Resolve a standard-grid column key to the actual size key the product
// carries. Returns:
//   - the columnKey itself if the bundle has it natively
//   - an alias key if the bundle has the alias but not the column key
//   - null if neither — render as N/A (truly not carried)
// availSet is a Set of UPPER-cased size strings from bundle.uniqueSizes.
function effectiveSizeKey(columnKey, availSet) {
  if (!availSet || availSet.size === 0) return columnKey;  // bundle not loaded
  const upper = String(columnKey).toUpperCase();
  if (availSet.has(upper)) return columnKey;
  const aliases = SIZE_ALIASES[upper] || [];
  for (const a of aliases) {
    if (availSet.has(a)) return a;
  }
  return null;
}

// Inverse: given a stored size key (e.g. 'XXL'), return the standard
// column it should appear under (e.g. '2XL'), or null if it should stay
// in the Other Sizes picker. Used by NonStandardSizePicker to hide
// aliased keys so XXL doesn't appear as both a 2XL cell + an Other-sizes
// chip on the same row.
function columnKeyForAliasedSize(storedKey) {
  const upper = String(storedKey).toUpperCase();
  for (const [col, aliases] of Object.entries(SIZE_ALIASES)) {
    if (aliases.includes(upper)) return col;
  }
  return null;
}

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

// Stock confirmation modal — shown when the rep clicks submit and one or
// more sizes have qty > 0 but SanMar shows 0 stock. Lists the offending
// items and asks "Proceed anyway?". Reps may know about backorders, drop-
// ships, or extended lead times so we don't hard-block.
function StockConfirmModal({ items, onConfirm, onCancel }) {
  // Close on ESC. Listener attached only while modal is open.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="stock-confirm-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="stock-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scm-head">
          <span className="scm-head-icon" aria-hidden="true">⚠</span>
          <h3 className="scm-title">Stock confirmation needed</h3>
        </div>
        <p className="scm-body">
          {items.length === 1 ? '1 size shows' : `${items.length} sizes show`} <strong>0 in stock</strong> at SanMar today.
          These may need backorder, drop-ship, or extended lead time. Continue anyway?
        </p>
        <ul className="scm-list">
          {items.map((it, idx) => (
            <li key={idx} className="scm-item">
              <span className="scm-item-style">{it.style}</span>
              <span className="scm-item-color">{it.color || '(no color)'}</span>
              <span className="scm-item-size">{it.size} × {it.qty}</span>
              <span className="scm-item-stock">0 in stock</span>
            </li>
          ))}
        </ul>
        <div className="scm-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn primary" onClick={onConfirm}>Proceed anyway</button>
        </div>
      </div>
    </div>
  );
}

function PaperForm({ info, setInfo, rows, setRows, ship, setShip, orderNotes, setOrderNotes, files, setFiles, decoConfig = {}, setDecoConfig = () => {}, addOns = [], setAddOns = () => {}, breakdown = null, customerMode = false, draftId = null, staffFilled = [] }) {
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
  function addRow() {
    // Inherit the form's currently-selected deco so a rep adding rows
    // mid-order doesn't end up with a row tagged to the default method
    // when they're actually working on a different one.
    setRows([...rows, { ...makeBlankRow(), deco: activeDeco || 'embroidery' }]);
  }

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
  // Stock-confirmation modal — populated when submit() finds 0-stock items
  // the rep is ordering. Shape: { items: [{style, color, size, qty, available}], onConfirm, onCancel }
  const [stockConfirm, setStockConfirm] = useState(null);
  // Per-row inventory snapshot — submit() needs to look up each row's
  // current bySize map to detect 0-stock cells. We collect into this Map
  // every time a row's inventory state lands. Keyed by row.id.
  const inventoryByRowRef = useRef(new Map());

  // Close lightbox on ESC. Listener only attached while it's open.
  useEffect(() => {
    if (!lightboxUrl) return;
    function onKey(e) { if (e.key === 'Escape') setLightboxUrl(null); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  // Walk all rows + their stored sizes, find any (style, color, size, qty)
  // where SanMar shows 0 stock for that exact size. Used by submit() to
  // surface a confirmation modal before pushing to ShopWorks. Skips manual-
  // mode rows (rep is overriding) and sticker/emblem (no SanMar fulfillment).
  function findZeroStockOrders() {
    const out = [];
    (rows || []).forEach(r => {
      if (!r) return;
      if (r.manualMode) return;
      if (r.deco === 'sticker' || r.deco === 'emblem') return;
      const inv = inventoryByRowRef.current.get(r.id);
      if (!inv || inv.status !== 'ok' || !inv.bySize) return;
      Object.entries(r.sizes || {}).forEach(([sz, qStr]) => {
        const q = Number(qStr) || 0;
        if (!q) return;
        const avail = inv.bySize[sz];
        if (Number.isFinite(Number(avail)) && Number(avail) === 0) {
          out.push({
            style: r.style || '?',
            color: r.colorName || r.color || '',
            size: sz,
            qty: q,
            available: 0,
          });
        }
      });
    });
    return out;
  }

  async function performSubmit() {
    setSubmitting(true);
    try {
      const res = await window.nwOrderAPI.submitOrder({ info, rows, ship, orderNotes, files, draftId, decoConfig, breakdown, addOns });
      if (res.ok) {
        const modeLabel = res.mode === 'mock' ? 'mock mode (backend unreachable)' : 'ShopWorks';
        let text = `✓ Order ${res.orderId} — submitted to ${modeLabel}${res.shopWorksId ? ' · SW# ' + res.shopWorksId : ''}`;
        const skipped = Array.isArray(res.skippedLines) ? res.skippedLines : [];
        if (skipped.length) {
          const summary = skipped.map(s => `${s.style} ${s.size} (${s.quantity})`).join(', ');
          text += ` · ⚠ Skipped (no pricing): ${summary}`;
        }
        setCaspioMsg({ kind: skipped.length ? 'warn' : 'ok', text });
        // Success/warn auto-dismiss after 12s. Errors stay until dismissed.
        setTimeout(() => setCaspioMsg(null), 12000);
      } else {
        setCaspioMsg({ kind: 'err', text: `✗ ShopWorks push failed: ${res.error}${res.detail ? ' — ' + res.detail : ''}` });
        // No auto-dismiss on errors — rep needs to read the message.
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (submitting) return;
    if (!canSubmit) {
      setCaspioMsg({ kind: 'err', text: 'Add at least one row with a style and quantity before submitting.' });
      setTimeout(() => setCaspioMsg(null), 5000);
      return;
    }
    // Pre-flight: any 0-stock items? If so, confirm before pushing.
    const zeroStock = findZeroStockOrders();
    if (zeroStock.length > 0) {
      setStockConfirm({
        items: zeroStock,
        onConfirm: () => { setStockConfirm(null); performSubmit(); },
        onCancel:  () => { setStockConfirm(null); },
      });
      return;
    }
    await performSubmit();
  }

  async function generateCustomerLink() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await window.nwOrderAPI.saveDraft({ info, rows, ship, orderNotes, files, decoConfig, addOns });
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

  // Phase 3 — Service Rail wrap. Renders a 2-column grid: left rail with
  // draggable service cards, right side is the existing paper form. Rail
  // is hidden in customerMode (customer doesn't add services) and when no
  // deco method is active. Falls back to single-column on narrow screens
  // (CSS media query at 1100px).
  const ServiceRail = window.OrderFormServiceRail;
  const showRail = !customerMode && activeDeco && ServiceRail;

  return (
    <div className={showRail ? 'of-layout' : 'of-layout of-layout--no-rail'}>
      {showRail && (
        <ServiceRail
          deco={activeDeco}
          rows={rows}
          breakdown={breakdown}
          addOns={addOns}
          setAddOns={setAddOns}
          customerId={info.companyId}
        />
      )}
      <div className="of-form paper">
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
              // Free typing — clear contact picker so user can switch back
              // to manual entry. Also clear companyId since the typed name
              // no longer matches the previously-picked CRM record.
              if (v !== info.company) {
                setInfo({ ...info, company: v, companyId: '', contacts: [], contactId: '' });
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
                // Capture the CRM customer ID at pick time. Surfaces to the
                // AE in Notes On Order and (eventually) lets the proxy use
                // it as ExtCustomerID for proper ShopWorks customer matching
                // across repeat orders.
                companyId:  c.id_Customer ? String(c.id_Customer) : '',
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
            <option value="ruth">Ruthie Nhoung</option>
            <option value="taneisha">Taneisha Clark</option>
            <option value="jim">Jim Mickelson</option>
          </select>
        </div>
        <div className="p-cell">
          <div className="lbl">Design #</div>
          {window.DesignAutocomplete ? (
            <window.DesignAutocomplete
              customerId={info.companyId}
              value={info.designNumber}
              onChange={v => update('designNumber', v)}
              disabled={customerMode}
            />
          ) : (
            <input
              className="p-in mono"
              placeholder="Design #"
              value={info.designNumber || ''}
              onChange={e => update('designNumber', e.target.value)}
              disabled={customerMode}
            />
          )}
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
            // Tier-pill strip rendered ABOVE the data row when this row has
            // an auto-priced breakdown with at least one tier. Skipped on
            // manual override (RowBreakdownLine's "Manual override" prefix
            // already conveys that all sizes are at one flat price).
            const tierEl = rb && !rb.error ? (
              <RowTierPills
                key={`${r.id}-tp`}
                row={r}
                rowBreakdown={rb}
              />
            ) : null;
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
                onInventoryChange={(id, inv) => inventoryByRowRef.current.set(id, inv)}
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
            return [tierEl, rowEl, bdEl].filter(Boolean);
          })}
        </tbody>
      </table>

      {/* Add-on picker (Phase 2b 2026-05-03) — fees + services dropdown.
          Renders below the line items table, above totals so the rep
          sees their fees factored into the order before the grand total.
          Hidden in customerMode (customers don't pick fees). */}
      {!customerMode && window.AddOnPicker && (
        <window.AddOnPicker
          addOns={addOns}
          setAddOns={setAddOns}
          rows={rows}
          breakdown={breakdown}
        />
      )}

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

      {/* Caspio / submit status — kind: 'ok' | 'warn' | 'err'.
          Errors get an explicit close button so reps can read them without
          worrying about an auto-dismiss timer. ok/warn auto-dismiss in submit(). */}
      {caspioMsg && (
        <div className={"caspio-banner " + (caspioMsg.kind === 'ok' ? 'ok' : (caspioMsg.kind === 'warn' ? 'warn' : 'err'))} style={{marginTop:16}}>
          <Icon name={caspioMsg.kind === 'ok' ? 'check' : 'info'} size={16}/>
          <span style={{flex:'1 1 auto'}}>{caspioMsg.text}</span>
          {caspioMsg.kind === 'err' && (
            <button
              type="button"
              className="caspio-banner-close"
              onClick={() => setCaspioMsg(null)}
              aria-label="Dismiss"
              title="Dismiss"
            >×</button>
          )}
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
          className={"btn primary" + (submitting ? ' is-submitting' : '')}
          onClick={submit}
          disabled={submitting || !canSubmit}
          title={!canSubmit ? 'Add at least one row with a style and quantity' : ''}
        >
          {submitting ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              {customerMode ? 'Submitting…' : 'Pushing to ShopWorks…'}
            </>
          ) : (
            <>
              {customerMode ? 'Submit order' : 'Push to ShopWorks'} <Icon name="check" size={14}/>
            </>
          )}
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

      {stockConfirm && (
        <StockConfirmModal
          items={stockConfirm.items}
          onConfirm={stockConfirm.onConfirm}
          onCancel={stockConfirm.onCancel}
        />
      )}

      </div>{/* /.of-form.paper */}
    </div>
  );
}

Object.assign(window, { PaperForm });
