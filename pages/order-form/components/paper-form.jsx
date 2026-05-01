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

// Popover picker for non-standard sizes (OSFA, youth, tall, 5XL+). Renders inline
// chips for any non-standard sizes already entered, plus a "+ Add" button that
// opens a small menu of remaining non-standard sizes. Each picked size becomes
// an inline qty input. All sizes flow into row.sizes[] and push to MO with the
// correct _<size> suffix via orderFormSizeSuffix() in server.js.
//
// `availableSizes` (optional) — array of sizes the picked product actually
// comes in (from the pricing-bundle). When provided, the "+ Add" menu only
// shows non-standard sizes that are valid for this product (e.g. PC61 →
// only 5XL/6XL, no Tall/Youth/OSFA). Without it, all non-standard sizes show.
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
  // Show a chip for any non-standard size key that's been added — even if qty
  // is still empty, so the user has a place to type the qty. Key is removed
  // (and chip disappears) only via the × button.
  const enteredNonStd = Object.keys(sizes)
    .filter(k => !standardSet.has(k) && k in sizes)
    .sort((a, b) => NON_STANDARD_SIZES.indexOf(a) - NON_STANDARD_SIZES.indexOf(b));
  // Filter the remaining list by what the product actually offers, when known.
  const availSet = (availableSizes && availableSizes.length)
    ? new Set(availableSizes.map(s => String(s).toUpperCase()))
    : null;
  const remaining = NON_STANDARD_SIZES.filter(s => {
    if (s in sizes) return false;
    if (availSet && !availSet.has(s.toUpperCase())) return false;
    return true;
  });

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
          <span className="nss-chip-label">{s}</span>
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
          {availSet && (
            <div className="nss-menu-hint">
              Available for this product: {availableSizes.join(', ')}
            </div>
          )}
          {remaining.length === 0 ? (
            <div className="nss-menu-empty">
              {availSet ? 'No non-standard sizes available for this product' : 'All non-standard sizes added'}
            </div>
          ) : (
            <div className="nss-menu-grid">
              {remaining.map(s => (
                <button
                  type="button"
                  key={s}
                  className="nss-menu-item"
                  onMouseDown={(e) => { e.preventDefault(); addSize(s); }}
                >{s}</button>
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

  // Total qty across all sizes — same as before.
  const total = useMemo(() => {
    let t = 0;
    Object.values(row.sizes || {}).forEach(v => { t += Number(v || 0); });
    return t;
  }, [row]);

  function update(patch) { onChange({ ...row, ...patch }); }
  function setSize(s, v) { update({ sizes: { ...row.sizes, [s]: v.replace(/[^0-9]/g, '') } }); }

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
  const usedUpchargedSizes = Object.keys(sizeUpcharges)
    .filter(sz => Number(row.sizes?.[sz]) > 0);
  const hasUpchargeChip = showAutoPriceCell && usedUpchargedSizes.length > 0;

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
      {PAPER_SIZES.map(s => {
        // Gray out sizes the picked product doesn't come in (e.g. PC61 has no XS).
        // Don't disable the input — the rep should still be able to type if they
        // know the product actually does come in that size and our data is wrong.
        const upper = s.toUpperCase();
        const unavailable = availSet && !availSet.has(upper);
        return (
          <td key={s} className={unavailable ? 'sz-unavail' : ''}>
            <input
              className={"t-in num" + (unavailable ? ' t-in--dim' : '')}
              inputMode="numeric"
              value={row.sizes[s] || ''}
              onChange={e => setSize(s, e.target.value)}
              title={unavailable ? `${row.style || 'this product'} doesn't come in ${s}` : ''}
            />
          </td>
        );
      })}
      <td className="nss-td"><NonStandardSizePicker row={row} onChange={update} availableSizes={availableSizes} /></td>
      <td>
        {showAutoPriceCell ? (
          <button
            type="button"
            className={"t-in num auto-priced" + (hasUpchargeChip ? ' has-upcharge' : '')}
            onClick={() => update({ priceOverride: true, price: headlineUnit ? headlineUnit.toFixed(2) : '' })}
            title="Auto-priced — click to override. Headline shows base (S/M/L/XL) price; upcharges are added per size automatically."
          >
            <span className="auto-priced-money">{fmt$(headlineUnit)}</span>
            <span className="auto-badge">auto</span>
            {hasUpchargeChip && (
              <span className="upcharge-chip" title="Upcharges applied to bigger sizes">
                {usedUpchargedSizes
                  .sort((a, b) => PAPER_SIZES.indexOf(a) - PAPER_SIZES.indexOf(b)
                    || NON_STANDARD_SIZES.indexOf(a) - NON_STANDARD_SIZES.indexOf(b))
                  .map(sz => `+$${Number(sizeUpcharges[sz]).toFixed(0)} ${sz}`)
                  .join(' · ')}
              </span>
            )}
          </button>
        ) : (
          <div className="manual-price-cell">
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
          </div>
        )}
      </td>
      <td>
        {showAutoPriceCell
          ? <input className="t-in total t-in-money" value={fmt$(rowSubtotalDollars)} readOnly tabIndex={-1} />
          : <input className="t-in total" value={total || ''} readOnly tabIndex={-1} />
        }
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
        setCaspioMsg({ kind: 'ok', text: `Order ${res.orderId} — submitted to ${modeLabel}${res.shopWorksId ? ' · SW# ' + res.shopWorksId : ''}` });
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
          {visibleRows.slice(0, 14).map((r, i) => (
            <PaperRow
              key={r.id}
              row={r}
              idx={i}
              onChange={(next) => onRowChange(i, next)}
              canRemove={rows.length > 1}
              customerMode={customerMode}
              onLightbox={setLightboxUrl}
              rowBreakdown={breakdown?.byRow?.get?.(r.id) || null}
            />
          ))}
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
