// Paper-style form view — boxed fields, looks like the original PDF but editable.
function PaperRow({ row, onChange, onRemove, canRemove, idx, customerMode }) {
  const total = useMemo(() => {
    let t = 0;
    PAPER_SIZES.forEach(s => { t += Number(row.sizes[s] || 0); });
    t += Number(row.otherSize || 0);
    return t;
  }, [row]);

  function update(patch) { onChange({ ...row, ...patch }); }
  function setSize(s, v) { update({ sizes: { ...row.sizes, [s]: v.replace(/[^0-9]/g, '') } }); }

  return (
    <tr>
      <td className="sel-wrap">
        <ProductCombobox
          value={row.style}
          onChange={(v) => update({ style: v })}
          onPick={(p) => update({
            style: p.style,
            desc: row.desc || p.desc || '',
            ...(row.style && row.style !== p.style ? { colorName: '', catalogColor: '' } : {})
          })}
        />
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
            <a className="row-thumb" href={row.imageUrl} target="_blank" rel="noopener" title="Open full image">
              <img src={row.imageUrl} alt="" loading="lazy" />
            </a>
          )}
          <input className="t-in" value={row.desc} onChange={e => update({ desc: e.target.value })} title={row.desc} />
        </div>
      </td>
      {PAPER_SIZES.map(s => (
        <td key={s}><input className="t-in num" inputMode="numeric" value={row.sizes[s] || ''} onChange={e => setSize(s, e.target.value)} /></td>
      ))}
      <td><input className="t-in num" value={row.otherSize || ''} onChange={e => update({ otherSize: e.target.value.replace(/[^0-9]/g, '') })} /></td>
      {!customerMode && (
        <td><input className="t-in num" inputMode="decimal" value={row.price || ''} onChange={e => update({ price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="" /></td>
      )}
      <td><input className="t-in total" value={total || ''} readOnly tabIndex={-1} /></td>
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

function PaperForm({ info, setInfo, rows, setRows, ship, setShip, orderNotes, setOrderNotes, files, setFiles, customerMode = false, draftId = null, staffFilled = [] }) {
  const lockSalesRep = customerMode && staffFilled.includes('salesRep');
  const lockPO       = customerMode && staffFilled.includes('po');
  const decoSet = new Set(rows.map(r => r.deco).filter(Boolean));
  function toggleDeco(key) {
    const next = rows.map(r => ({ ...r, deco: key }));
    setRows(next);
  }
  function update(k, v) { setInfo({ ...info, [k]: v }); }
  function updateShip(k, v) { setShip({ ...ship, [k]: v }); }
  function addRow() { setRows([...rows, makeBlankRow()]); }

  const totals = useMemo(() => {
    let grand = 0;
    const byDeco = { embroidery: 0, screenprint: 0, dtg: 0 };
    rows.forEach(r => {
      let t = 0;
      SIZES.forEach(s => { t += Number(r.sizes[s] || 0); });
      t += Number(r.otherSize || 0);
      grand += t;
      byDeco[r.deco] = (byDeco[r.deco] || 0) + t;
    });
    return { grand, byDeco };
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

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await window.nwOrderAPI.submitOrder({ info, rows, ship, orderNotes, files, draftId });
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
      const res = await window.nwOrderAPI.saveDraft({ info, rows, ship, orderNotes, files });
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
          {DECOS.map(d => (
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

      {/* Garments table */}
      <table className="p-table">
        <colgroup>
          <col className="c-style"/><col className="c-color"/><col className="c-desc"/>
          <col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/>
          <col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/>
          <col className="c-other"/>
          {!customerMode && <col className="c-price"/>}
          <col className="c-total"/>
        </colgroup>
        <thead>
          <tr>
            <th className="left">Style #</th>
            <th className="left">Color</th>
            <th className="left">Description</th>
            <th>XS</th><th>S</th><th>M</th><th>L</th><th>XL</th><th>2XL</th><th>3XL</th><th>4XL</th>
            <th>Other</th>
            {!customerMode && <th>Price</th>}
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
            />
          ))}
        </tbody>
      </table>

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

      {/* Design # row */}
      <div className="p-design">
        <div className="p-cell">
          <div className="lbl">Design #</div>
          <input className="p-in" value={files.map(f=>f.designNo).filter(Boolean).join(', ')} readOnly />
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
        <button className="btn primary" onClick={submit} disabled={submitting}>
          {customerMode ? 'Submit order' : 'Push to ShopWorks'} <Icon name="check" size={14}/>
        </button>
      </div>

    </div>
  );
}

Object.assign(window, { PaperForm });
