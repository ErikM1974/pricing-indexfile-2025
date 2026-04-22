// Main app — composes sections, holds top-level form state
function App() {
  // Share-link detection. URL shape: /pages/order-form.html?draftId=OF0421-1234
  // (set by the /order-form/:draftId redirect in server.js).
  const params = new URLSearchParams(window.location.search);
  const draftId = params.get('draftId') || null;
  const customerMode = !!draftId;
  const [staffFilled, setStaffFilled] = useState([]);
  const [draftStatus, setDraftStatus] = useState(null);

  // Customer info
  const [info, setInfo] = useState({
    company: '', buyerFirst: '', buyerLast: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '',
    po: '', salesRep: '', dateIn: new Date().toISOString().slice(0, 10), dateDue: '',
    terms: 'Prepaid', // default payment terms (Pay On Pickup | Prepaid)
  });

  // Line items
  const [rows, setRows] = useState([makeBlankRow(), makeBlankRow(), makeBlankRow()]);

  // Artwork
  const [files, setFiles] = useState([]);

  // Shipping
  const [ship, setShip] = useState({
    method: 'ups', address: '', city: '', state: '', zip: '', notes: '',
  });

  // Order notes
  const [orderNotes, setOrderNotes] = useState('');

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
    }).catch(err => {
      console.error('[OrderForm] Failed to load draft:', err);
    });
    return () => { cancelled = true; };
  }, [draftId]);

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

  // Summary aggregates
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
    const filledRows = rows.filter(r => r.style || r.desc || Object.values(r.sizes).some(v => v)).length;
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
      <PrintSheet info={info} rows={rows} ship={ship} orderNotes={orderNotes} files={files} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
