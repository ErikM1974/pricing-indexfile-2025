// Main app — composes sections, holds top-level form state
function App() {
  // Share-link detection. URL shape: /pages/order-form.html?draftId=OF0421-1234
  // (set by the /order-form/:draftId redirect in server.js).
  const params = new URLSearchParams(window.location.search);
  const draftId = params.get('draftId') || null;
  const customerMode = !!draftId;
  const [staffFilled, setStaffFilled] = useState([]);
  const [draftStatus, setDraftStatus] = useState(null);

  // Default Date Due = today + 21 days. Staff can override; once they touch
  // the field, we stop auto-bumping it as Date In changes.
  const _today = new Date();
  const _due = new Date(_today.getTime() + 21 * 86400000);

  // Customer info
  const [info, setInfo] = useState({
    company: '', buyerFirst: '', buyerLast: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '',
    po: '',
    salesRep: '',
    dateIn: _today.toISOString().slice(0, 10),
    dateDue: _due.toISOString().slice(0, 10),
    terms: 'Prepaid', // default payment terms (Pay On Pickup | Prepaid)
    // Set by CompanyCombobox after a pick. `contacts` drives the Name-cell ContactPicker;
    // when empty, the cell falls back to manual First/Last/Email inputs.
    contacts: [], contactId: '',
  });

  // Line items — pre-tagged with the default decoration method (embroidery)
  // so the rep doesn't have to remember to check Embroidery before they start
  // entering styles. Most NWCA orders are embroidery; reps switching to
  // another method click the appropriate checkbox which propagates via
  // toggleDeco() in paper-form.jsx (re-tags every row to the new method).
  const [rows, setRows] = useState([
    { ...makeBlankRow(), deco: 'embroidery' },
    { ...makeBlankRow(), deco: 'embroidery' },
    { ...makeBlankRow(), deco: 'embroidery' },
  ]);

  // Artwork
  const [files, setFiles] = useState([]);

  // Shipping
  const [ship, setShip] = useState({
    method: 'ups', address: '', city: '', state: '', zip: '', notes: '',
  });

  // Order notes
  const [orderNotes, setOrderNotes] = useState('');

  // Decoration config — form-wide settings for the active method (stitch count
  // + primary location for embroidery; color counts for SP; etc.). Reseeded
  // when toggleDeco picks a different method (see paper-form.jsx).
  //
  // Defaults to Embroidery + 8000 stitches + Left Chest because that's
  // ~80% of NWCA orders. Reps used to forget to check a method, then type
  // line items, then wonder why pricing didn't compute. With the default
  // pre-selected, the common case "just works" and reps switching to
  // SP/DTG/DTF/Sticker/Emblem still click their method as before.
  const [decoConfig, setDecoConfig] = useState({
    method: 'embroidery',
    stitchCount: 8000,
    primaryLocation: 'Left Chest',
  });

  // Computed pricing breakdown — recomputed (debounced 300ms) whenever rows /
  // decoConfig / customerMode changes. Source of truth for $ totals.
  const _zeroBreakdown = (window.OrderFormPricingShared
    ? window.OrderFormPricingShared.emptyOrderBreakdown()
    : { supported: false, byRow: new Map(), totalQty: 0, tier: null, subtotal: 0, ltmTotal: 0, taxEstimate: 0, depositDue: 0, grandTotal: 0, fees: [], errors: [] });
  const [breakdown, setBreakdown] = useState(_zeroBreakdown);

  // Tweaks panel
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Prefill from shared draft when draftId is present.
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    window.nwOrderAPI.loadDraft(draftId).then(draft => {
      if (cancelled) return;
      if (draft.info) setInfo(prev => ({ ...prev, ...draft.info }));
      if (Array.isArray(draft.rows) && draft.rows.length) {
        setRows(draft.rows.map(r => r.id ? r : { ...makeBlankRow(), ...r }));
      }
      if (draft.ship) setShip(prev => ({ ...prev, ...draft.ship }));
      if (draft.orderNotes) setOrderNotes(draft.orderNotes);
      if (Array.isArray(draft.files)) setFiles(draft.files);
      setStaffFilled(draft.staffFilled || []);
      setDraftStatus(draft.status);
      // Reseed decoConfig from saved rows (form-wide deco) so auto-pricing
      // resumes for the customer view.
      if (Array.isArray(draft.rows) && draft.rows.length) {
        const firstDeco = draft.rows.find(r => r && r.deco)?.deco || '';
        if (firstDeco && window.OrderFormPricing?.hasMethod(firstDeco)) {
          const mod = window.OrderFormPricing.getMethod(firstDeco);
          setDecoConfig({ method: firstDeco, ...(mod.defaultFormConfig?.() || {}) });
        }
      }
    }).catch(err => {
      console.error('[OrderForm] Failed to load draft:', err);
    });
    return () => { cancelled = true; };
  }, [draftId]);

  // Auto-pricing recompute. Debounced 300ms. Pulls breakdown from the active
  // method module via the registry. Breakdown is the source of truth for $
  // totals — rows stay focused on user input (style, sizes, manual flags).
  useEffect(() => {
    const reg = window.OrderFormPricing;
    const S   = window.OrderFormPricingShared;
    const deco = decoConfig?.method || '';
    if (!deco || !reg?.hasMethod(deco)) {
      setBreakdown(prev => prev.supported ? S.emptyOrderBreakdown() : prev);
      return;
    }
    let cancelled = false;
    const totalQty = S.totalQtyAcrossRows(rows);
    const formCtx = { deco, decoConfig, info, ship, totalQty, customerMode };
    const t = setTimeout(async () => {
      try {
        const result = await reg.priceForm({ rows, formCtx });
        if (!cancelled) setBreakdown(result);
      } catch (err) {
        if (!cancelled) console.error('[OrderForm] priceForm failed:', err);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [rows, decoConfig, customerMode]);

  useEffect(() => {
    function onMsg(e) {
      const m = e.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === '__activate_edit_mode')   { setTweaksOpen(true);  document.body.classList.add('tweaks-open'); }
      if (m.type === '__deactivate_edit_mode') { setTweaksOpen(false); document.body.classList.remove('tweaks-open'); }
    }
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Summary aggregates — qty only (dollar totals come from `breakdown`).
  // Walks all keys in row.sizes (standard XS-4XL plus any non-standard:
  // OSFA / youth / tall / 5-7XL / non-garment STK / EMB).
  const totals = useMemo(() => {
    let grand = 0;
    const byDeco = { embroidery: 0, screenprint: 0, dtg: 0, dtf: 0, sticker: 0, emblem: 0 };
    rows.forEach(r => {
      let t = 0;
      Object.values(r.sizes || {}).forEach(v => { t += Number(v) || 0; });
      grand += t;
      byDeco[r.deco] = (byDeco[r.deco] || 0) + t;
    });
    const filledRows = rows.filter(r => r.style || r.desc || Object.values(r.sizes || {}).some(v => v)).length;
    return { grand, byDeco, filledRows };
  }, [rows]);

  function update(field, v) { setInfo({ ...info, [field]: v }); }
  function updateShip(field, v) { setShip({ ...ship, [field]: v }); }

  return (
    <>
      <header className="topbar screen-only">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-logo"><LogoMark size={40}/></div>
          </div>
          <div className="topbar-meta">
            <span><span className="dot" />New order · Draft</span>
            <span>1-800-851-3671</span>
            <span>sales@nwcustomapparel.com</span>
          </div>
        </div>
      </header>


      <TweaksPanel open={tweaksOpen} />

      {/* Paper-style form view */}
      <div className="paper-wrap screen-only">
        <div className="paper-toolbar">
          <span className="status">
            <span className="dot"/>
            {customerMode
              ? `Customer view · ${draftId}${draftStatus ? ' · ' + draftStatus : ''}`
              : 'Staff · Draft · Auto-saves locally'}
          </span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)'}}>
            ShopWorks · NWCA-OrderForm
          </span>
        </div>
        <PaperForm
          info={info} setInfo={setInfo}
          rows={rows} setRows={setRows}
          ship={ship} setShip={setShip}
          orderNotes={orderNotes} setOrderNotes={setOrderNotes}
          files={files} setFiles={setFiles}
          decoConfig={decoConfig} setDecoConfig={setDecoConfig}
          breakdown={breakdown}
          customerMode={customerMode}
          draftId={draftId}
          staffFilled={staffFilled}
        />
      </div>

      {/* Print preview toolbar */}
      <div className="print-toolbar">
        <button className="btn sm subtle" onClick={() => document.body.classList.remove('print-preview')}>
          <Icon name="close" size={14}/> Close preview
        </button>
        <button className="btn sm primary" onClick={() => window.print()}>
          <Icon name="doc" size={14}/> Print / Save PDF
        </button>
      </div>

      {/* Print-only paper form */}
      <PrintSheet info={info} rows={rows} ship={ship} orderNotes={orderNotes} files={files} decoConfig={decoConfig} breakdown={breakdown} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
