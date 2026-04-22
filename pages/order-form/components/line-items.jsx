// Line items — editable table with product search, size quantities, per-row decoration
const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL'];
const DECOS = [
  { key: 'embroidery',   label: 'Embroidery' },
  { key: 'screenprint',  label: 'Screen Print' },
  { key: 'dtg',          label: 'DTG' },
  { key: 'dtf',          label: 'DTF' },
];

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Session caches — avoid refetching the same style/color while the page is open.
const _stylesearchCache = new Map(); // query.toLowerCase() → [{value,label}]
const _colorsCache      = new Map(); // styleNumber.toUpperCase() → [{COLOR_NAME, CATALOG_COLOR, ...}]

async function searchStyles(query) {
  const q = (query || '').trim();
  if (!q) return [];
  const key = q.toLowerCase();
  if (_stylesearchCache.has(key)) return _stylesearchCache.get(key);
  try {
    const r = await fetch(`${API_BASE}/api/stylesearch?term=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const results = Array.isArray(data) ? data : (data.results || []);
    _stylesearchCache.set(key, results);
    return results;
  } catch (err) {
    console.error('[OrderForm] stylesearch failed:', err);
    return []; // visible empty state — no silent cache fallback (CLAUDE.md rule #4)
  }
}

async function fetchColors(styleNumber) {
  const sn = String(styleNumber || '').trim().toUpperCase();
  if (!sn) return [];
  if (_colorsCache.has(sn)) return _colorsCache.get(sn);
  try {
    const r = await fetch(`${API_BASE}/api/product-colors?styleNumber=${encodeURIComponent(sn)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const colors = (data && data.colors) || [];
    _colorsCache.set(sn, colors);
    return colors;
  } catch (err) {
    console.error('[OrderForm] product-colors failed:', err);
    return [];
  }
}

function makeBlankRow() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    style: '',
    desc: '',
    color: '',            // legacy free-text (pre-SanMar drafts)
    colorName: '',        // COLOR_NAME — shown in UI
    catalogColor: '',     // CATALOG_COLOR — sent to ShopWorks / inventory
    availableColors: [],  // populated on pick
    deco: 'embroidery',
    sizes: {},
    otherSize: '',
  };
}

function ProductCombobox({ value, desc, onPick, onChange, onDescChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [active, setActive] = useState(0);
  const wrap = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function handler(e) {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Live-search SanMar catalog via caspio-pricing-proxy /api/stylesearch.
  // Result shape: [{ value: "PC54", label: "Port & Company Core Cotton Tee" }]
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = (query || '').trim();
    if (q.length < 2) { setMatches([]); return; }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const results = await searchStyles(q);
      if (cancelled) return;
      const seen = new Set();
      const mapped = (results || []).map(r => {
        const style = (r.value || r.style || '').toString();
        let desc = (r.label || r.desc || '').toString();
        // /api/stylesearch label is "STYLE - description. STYLE" — strip the leading "STYLE - " and trailing ". STYLE"
        if (style) {
          desc = desc.replace(new RegExp(`^${style}\\s*-\\s*`), '');
          desc = desc.replace(new RegExp(`\\.?\\s*${style}\\s*$`), '');
        }
        return { style, desc };
      }).filter(r => {
        if (!r.style || seen.has(r.style)) return false;
        seen.add(r.style);
        return true;
      }).slice(0, 10);
      setMatches(mapped);
      setLoading(false);
    }, 200); // debounce
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  function pick(p) {
    onPick(p);
    setQuery(p.style);
    setOpen(false);
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) pick(matches[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className="combobox" ref={wrap}>
      <input
        className="cell-input mono"
        placeholder="Type style # or name…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {open && (
        <div className="combobox-menu">
          {loading && matches.length === 0 ? (
            <div className="combobox-empty">Searching SanMar…</div>
          ) : matches.length > 0 ? matches.map((p, i) => (
            <div
              key={`${p.style}-${i}`}
              className={"combobox-item" + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
            >
              <span className="style-no">{p.style}</span>
              <span className="desc">{p.desc}</span>
            </div>
          )) : (query || '').trim().length >= 2 ? (
            <div className="combobox-empty">No styles match "{query}"</div>
          ) : (
            <div className="combobox-empty">Type at least 2 characters…</div>
          )}
        </div>
      )}
    </div>
  );
}

// Color dropdown — populates from /api/product-colors once a style is picked.
// Stores CATALOG_COLOR (for ShopWorks/inventory) + displays COLOR_NAME (per CLAUDE.md two-field rule).
function ColorSelect({ style, colorName, onPick }) {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!style) { setColors([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchColors(style).then(list => { if (!cancelled) { setColors(list); setLoading(false); } });
    return () => { cancelled = true; };
  }, [style]);
  function onChange(e) {
    const name = e.target.value;
    const match = colors.find(c => (c.COLOR_NAME || '') === name);
    onPick({
      colorName: name,
      catalogColor: (match && (match.CATALOG_COLOR || name)) || name,
    });
  }
  if (!style) {
    return <input className="t-in" value={colorName || ''} onChange={e => onPick({ colorName: e.target.value, catalogColor: e.target.value })} placeholder="Pick style first" />;
  }
  if (loading && colors.length === 0) {
    return <input className="t-in" value="Loading colors…" readOnly />;
  }
  if (colors.length === 0) {
    // Fallback — free text when SanMar lookup returned nothing.
    return <input className="t-in" value={colorName || ''} onChange={e => onPick({ colorName: e.target.value, catalogColor: e.target.value })} placeholder="Color" />;
  }
  return (
    <select className="t-in" value={colorName || ''} onChange={onChange}>
      <option value="">—</option>
      {colors.map(c => (
        <option key={c.CATALOG_COLOR || c.COLOR_NAME} value={c.COLOR_NAME}>{c.COLOR_NAME}</option>
      ))}
    </select>
  );
}

function SizeCell({ value, onChange }) {
  const has = value && Number(value) > 0;
  return (
    <input
      className={"li-size-input" + (has ? ' has-val' : '')}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="—"
      value={value || ''}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, '');
        onChange(v);
      }}
    />
  );
}

function LineRow({ row, onChange, onRemove, canRemove }) {
  const total = useMemo(() => {
    let t = 0;
    SIZES.forEach(s => { const n = Number(row.sizes[s] || 0); if (n) t += n; });
    const other = Number(row.otherSize || 0);
    if (other) t += other;
    return t;
  }, [row]);

  function update(patch) { onChange({ ...row, ...patch }); }
  function setSize(size, val) {
    update({ sizes: { ...row.sizes, [size]: val } });
  }

  return (
    <div className="li-row">
      <div>
        <ProductCombobox
          value={row.style}
          onChange={(v) => update({ style: v })}
          onPick={(p) => update({ style: p.style, desc: row.desc || p.desc })}
        />
      </div>
      <div>
        <input
          className="cell-input"
          placeholder="e.g. Forest Green"
          value={row.color}
          onChange={(e) => update({ color: e.target.value })}
        />
      </div>
      <div>
        <input
          className="cell-input"
          placeholder="Product description"
          value={row.desc}
          onChange={(e) => update({ desc: e.target.value })}
        />
      </div>
      {SIZES.map(s => (
        <div className="sz" key={s}>
          <SizeCell value={row.sizes[s]} onChange={(v) => setSize(s, v)} />
        </div>
      ))}
      <div className="sz">
        <input
          className="li-size-input"
          placeholder="—"
          value={row.otherSize}
          onChange={(e) => update({ otherSize: e.target.value })}
        />
      </div>
      <div className="total li-total">{total || '—'}</div>
      <div>
        <button
          className="li-remove"
          onClick={onRemove}
          disabled={!canRemove}
          style={!canRemove ? { opacity: 0.25, cursor: 'not-allowed' } : {}}
          aria-label="Remove row"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>

      {/* Per-row decoration bar */}
      <div className="deco">
        <span className="eyebrow">Decoration</span>
        <div className="chipgroup" role="radiogroup">
          {DECOS.map(d => (
            <button
              key={d.key}
              role="radio"
              aria-checked={row.deco === d.key}
              className={"chip" + (row.deco === d.key ? ' on' : '')}
              onClick={() => update({ deco: d.key })}
            >{d.label}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Row total <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600, marginLeft: 6 }}>{total}</span>
        </span>
      </div>
    </div>
  );
}

function LineItems({ rows, setRows }) {
  function updateRow(idx, next) {
    setRows(rows.map((r, i) => i === idx ? next : r));
  }
  function removeRow(idx) {
    setRows(rows.filter((_, i) => i !== idx));
  }
  function addRow() { setRows([...rows, makeBlankRow()]); }

  const grandTotal = useMemo(() => {
    let t = 0;
    rows.forEach(r => {
      SIZES.forEach(s => { t += Number(r.sizes[s] || 0); });
      t += Number(r.otherSize || 0);
    });
    return t;
  }, [rows]);

  const decoBreakdown = useMemo(() => {
    const b = { embroidery: 0, screenprint: 0, dtg: 0 };
    rows.forEach(r => {
      let t = 0;
      SIZES.forEach(s => { t += Number(r.sizes[s] || 0); });
      t += Number(r.otherSize || 0);
      b[r.deco] = (b[r.deco] || 0) + t;
    });
    return b;
  }, [rows]);

  return (
    <>
      <div className="lineitems">
        <div className="lineitems-scroll">
        <div className="li-head">
          <div>Style #</div>
          <div>Color</div>
          <div>Description</div>
          {SIZES.map(s => <div key={s} className="sz">{s}</div>)}
          <div className="sz">Other</div>
          <div className="total">Total</div>
          <div></div>
        </div>
        {rows.map((r, i) => (
          <LineRow
            key={r.id}
            row={r}
            onChange={(next) => updateRow(i, next)}
            onRemove={() => removeRow(i)}
            canRemove={rows.length > 1}
          />
        ))}
        </div>
        <div className="li-footer">
          <button className="btn subtle sm" onClick={addRow}>
            <Icon name="plus" size={14} /> Add line item
          </button>
          <div className="totals">
            <span className="t">Embroidery <strong>{decoBreakdown.embroidery || 0}</strong></span>
            <span className="t">Screen Print <strong>{decoBreakdown.screenprint || 0}</strong></span>
            <span className="t">DTG <strong>{decoBreakdown.dtg || 0}</strong></span>
            <span className="t" style={{ borderLeft: '1px solid var(--line)', paddingLeft: 22 }}>Total Garments <strong style={{ fontSize: 18 }}>{grandTotal || 0}</strong></span>
          </div>
        </div>
      </div>

      <div className="payment-bar">
        <Icon name="info" size={18} />
        <div className="txt">
          <strong>50% deposit</strong> on all new orders; balance on delivery.
          Prepayment required for all new artwork.
        </div>
        <div className="cards">
          <div className="c">VISA</div>
          <div className="c">MC</div>
          <div className="c">AMEX</div>
          <div className="c">ACH</div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { LineItems, makeBlankRow, SIZES, DECOS, ProductCombobox, ColorSelect, fetchColors, searchStyles });
