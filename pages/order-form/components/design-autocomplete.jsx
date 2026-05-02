// Online Order Form — Design # autocomplete (Phase B, 2026-05-02).
//
// Purpose: when the rep picks a known company from the company autocomplete,
// fetch the customer's past designs from /api/digitized-designs/by-customer
// and let the rep pick from a searchable dropdown. The picked design# flows
// to info.designNumber, which shopworks.js converts to a designNumbers array
// at submit time. Server.js then resolves the design# → real ShopWorks
// id_Design via /api/embroidery-designs/lookup, and ShopWorks links the
// order to the existing design (no new design row created).
//
// If the rep types a design# that's not in the customer's history, free-text
// is allowed — the server-side lookup handles arbitrary numbers. If the
// lookup fails (design# not in Caspio's lookup table), the order falls
// through to Phase A's no-Designs[] behavior so no orphan is created.

const API_BASE_DA = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// 5-minute in-memory cache keyed by customerId. The form session is short;
// no need to persist across reloads. Concurrent calls dedupe via in-flight
// promise tracking so two rapid focus events don't double-fetch.
const _designsCache    = new Map();   // customerId → { ts, designs }
const _designsInFlight = new Map();   // customerId → Promise
const DESIGNS_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchCustomerDesigns(customerId) {
  const id = String(customerId || '').trim();
  if (!id) return [];

  const cached = _designsCache.get(id);
  if (cached && Date.now() - cached.ts < DESIGNS_CACHE_TTL_MS) {
    return cached.designs;
  }
  if (_designsInFlight.has(id)) return _designsInFlight.get(id);

  const promise = (async () => {
    try {
      const r = await fetch(`${API_BASE_DA}/api/digitized-designs/by-customer?customerId=${encodeURIComponent(id)}`);
      if (!r.ok) return [];
      const json = await r.json().catch(() => null);
      const results = (json && Array.isArray(json.results)) ? json.results : [];
      // Sort by lastOrderDate desc (most recent designs first). Designs
      // without a date sink to the bottom.
      results.sort((a, b) => {
        const da = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
        const db = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
        return db - da;
      });
      _designsCache.set(id, { ts: Date.now(), designs: results });
      return results;
    } catch (err) {
      console.error('[OrderForm] fetchCustomerDesigns failed:', err);
      return [];
    } finally {
      _designsInFlight.delete(id);
    }
  })();
  _designsInFlight.set(id, promise);
  return promise;
}

// Format "2025-04-15T00:00:00" → "Apr 15, 2025" for display in the dropdown.
function fmtLastUsed(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return '';
  }
}

function DesignAutocomplete({ customerId, value, onChange, disabled }) {
  const [open, setOpen] = React.useState(false);
  const [designs, setDesigns] = React.useState([]);   // full customer list
  const [active, setActive] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const wrap = React.useRef(null);

  // Fetch when customerId changes.
  React.useEffect(() => {
    if (!customerId) { setDesigns([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchCustomerDesigns(customerId).then(list => {
      if (cancelled) return;
      setDesigns(list || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [customerId]);

  // Click-outside closes the dropdown.
  React.useEffect(() => {
    function handler(e) {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter the customer's designs by the typed value. Match against
  // designNumber AND designName so the rep can search either way. Blank
  // value shows everything (sorted by recency).
  const matches = React.useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    if (!q) return designs.slice(0, 50);
    return designs.filter(d => {
      const num  = String(d.designNumber || '').toLowerCase();
      const name = String(d.designName   || '').toLowerCase();
      return num.includes(q) || name.includes(q);
    }).slice(0, 50);
  }, [designs, value]);

  function pick(d) {
    onChange(String(d.designNumber || ''));
    setOpen(false);
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      // Enter selects the highlighted match if there is one; otherwise
      // closes the dropdown so free-typed numbers stick.
      if (matches[active]) { e.preventDefault(); pick(matches[active]); }
      else setOpen(false);
    }
    else if (e.key === 'Escape') setOpen(false);
  }

  const placeholder = customerId
    ? (loading ? 'Loading designs…' : (designs.length ? 'Search past designs…' : 'No past designs — type design #'))
    : 'Pick company first';

  return (
    <div className="design-combobox" ref={wrap}>
      <input
        className="p-in mono"
        placeholder={placeholder}
        value={value || ''}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {open && customerId && (
        <div className="design-combobox-menu">
          {loading && matches.length === 0 ? (
            <div className="design-combobox-empty">Loading…</div>
          ) : matches.length > 0 ? (
            <>
              <div className="design-combobox-hint">
                {designs.length} past design{designs.length === 1 ? '' : 's'} for this customer · most recent first
              </div>
              {matches.map((d, i) => (
                <div
                  key={`${d.designNumber}-${i}`}
                  className={"design-combobox-item" + (i === active ? ' active' : '')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(d); }}
                >
                  <div className="design-combobox-row1">
                    <span className="design-no">#{d.designNumber}</span>
                    <span className="design-name">{d.designName || '—'}</span>
                  </div>
                  <div className="design-combobox-row2">
                    {d.lastOrderDate && <span className="design-last">Last used {fmtLastUsed(d.lastOrderDate)}</span>}
                    {d.orderCount > 0 && <span className="design-count">· {d.orderCount} order{d.orderCount === 1 ? '' : 's'}</span>}
                    {d.maxStitchCount > 0 && <span className="design-stitches">· {d.maxStitchCount.toLocaleString()} stitches</span>}
                  </div>
                </div>
              ))}
            </>
          ) : (value || '').trim() ? (
            <div className="design-combobox-empty">No matches — type the full design # to push it through anyway. ShopWorks will leave the design blank if it can't find this number on file.</div>
          ) : (
            <div className="design-combobox-empty">No past designs found for this customer. Type a design # if you have one.</div>
          )}
        </div>
      )}
    </div>
  );
}

// Expose to window so paper-form.jsx (loaded after this file) can use it.
window.DesignAutocomplete = DesignAutocomplete;
window.fetchCustomerDesigns = fetchCustomerDesigns;
