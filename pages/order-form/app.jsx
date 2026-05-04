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
    designNumber: '',  // Order-level design # → resolves to ShopWorks id_Design at submit; empty means no design attached (rep links in ShopWorks)
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

  // Add-on services (Phase 2a 2026-05-03) — fees pushed to ShopWorks as
  // additional LinesOE entries. Each entry: { id, code, qty, scope, params? }.
  // scope: 'order' for order-level singletons (DD, GRT-50, RUSH, etc.) or
  //        { rowId: 'r1' } for per-row attachments (3D Puff on a cap row).
  // The submit handler in server.js iterates this array and adds fee
  // line items via `resolvedPrice()` from window.OrderFormServiceCodes.
  // Singleton enforcement (replace order-level duplicates) lives in
  // window.OrderFormServiceCodes.addOrReplace() — UI in Phase 2b will
  // call it. Phase 2a path: add via console for end-to-end smoke test.
  const [addOns, setAddOns] = useState([]);

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
  //
  // Phase 4e (2026-05-03) — addOns are now folded into priceForm() so the
  // breakdown reflects per-row + order-level extras. Recomputes whenever
  // addOns change so adding/removing/editing a sub-row updates totals live.
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
        const result = await reg.priceForm({ rows, formCtx, addOns });
        if (!cancelled) setBreakdown(result);
      } catch (err) {
        if (!cancelled) console.error('[OrderForm] priceForm failed:', err);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [rows, decoConfig, customerMode, addOns]);

  // Phase 7b (2026-05-03) — auto-apply AS-CAP/AS-Garm MID/LARGE stitch
  // surcharges per row based on each row's primary stitch count. Reps were
  // forgetting to drag the surcharge after typing >10K stitches → undercharge.
  // This effect watches rows + addOns + decoConfig and keeps the right
  // surcharge attached to each row. Runs idempotent (only setAddOns when
  // there's an actual change). Marks auto entries with params._auto=true so
  // the auto-remove logic doesn't touch manually-dragged surcharges. If the
  // rep manually drags ANY AS-CAP/AS-Garm on a row, the auto entry yields
  // (manual takes precedence — we delete our auto entry on that row).
  //
  // Tier mapping (matches the canonical NWCA flat-tier policy):
  //    ≤ 10,000 stitches → no surcharge (Standard, included)
  //    10,001 – 15,000  → MID  (+$4/pc)
  //    15,001 – 25,000  → LARGE (+$10/pc)
  //    > 25,000         → DECG-FB territory — NOT auto-added (rep uses Quote Builder)
  useEffect(() => {
    if (decoConfig?.method !== 'embroidery') return;
    const F = window.ProductCategoryFilter;
    function detectCapOrFlat(row) {
      const override = row?.rowDecoConfig?.capOrFlat;
      if (override === 'cap' || override === 'flat') return override;
      const product = { label: row?.desc || '', value: row?.style || '', PRODUCT_TITLE: row?.desc || '' };
      if (F?.isFlatHeadwear?.(product)) return 'flat';
      if (F?.isStructuredCap?.(product)) return 'cap';
      const sizeKeys = Object.keys(row?.sizes || {}).filter(k => Number(row.sizes[k]) > 0);
      if (sizeKeys.length && sizeKeys.every(k => k === 'OSFA')) return 'cap';
      // Last-chance prefix match for known cap styles when desc hasn't loaded
      const styleUpper = String(row?.style || '').toUpperCase();
      if (/^(112|7706|3100|NE\d|C\d{3}|YP\d|FF\d)/.test(styleUpper)) return 'cap';
      return 'flat'; // default to garment — matches embroidery.jsx convention
    }
    function rowQty(row) {
      return Object.values(row?.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    }
    function isFilled(row) {
      return !!(row.style || row.desc || rowQty(row) > 0);
    }
    function findTierRow(code, tier) {
      const all = window.OrderFormServiceCodes?.all?.() || [];
      return all.find(s => s.ServiceCode === code && s.Tier === tier);
    }

    const seedStitch = Number(decoConfig?.stitchCount) || 8000;
    const next = [...addOns];
    let changed = false;

    for (const row of rows) {
      if (row.deco !== 'embroidery') continue;
      if (!isFilled(row)) continue;

      const stitch = Number.isFinite(Number(row?.rowDecoConfig?.primaryStitchCount))
        ? Number(row.rowDecoConfig.primaryStitchCount)
        : seedStitch;
      const cof = detectCapOrFlat(row);
      if (!cof) continue;

      const desiredCode = cof === 'cap' ? 'AS-CAP' : 'AS-Garm';
      const desiredTier = stitch <= 10000 ? null
                       : stitch <= 15000 ? 'Mid'
                       : stitch <= 25000 ? 'Large'
                       : null;

      const existingAutoIdx = next.findIndex(a =>
        (a.code === 'AS-CAP' || a.code === 'AS-Garm') &&
        a.scope && typeof a.scope === 'object' &&
        a.scope.rowId === row.id &&
        a.params?._auto === true
      );
      const hasManual = next.some(a =>
        (a.code === 'AS-CAP' || a.code === 'AS-Garm') &&
        a.scope && typeof a.scope === 'object' &&
        a.scope.rowId === row.id &&
        a.params?._auto !== true
      );
      if (hasManual) {
        if (existingAutoIdx >= 0) { next.splice(existingAutoIdx, 1); changed = true; }
        continue;
      }
      if (desiredTier === null) {
        if (existingAutoIdx >= 0) { next.splice(existingAutoIdx, 1); changed = true; }
        continue;
      }

      const tierRow = findTierRow(desiredCode, desiredTier);
      if (!tierRow) continue; // service-codes not loaded yet — try again next render
      const desiredUnitPrice = Number(tierRow.SellPrice) || (desiredTier === 'Mid' ? 4 : 10);
      const desiredQty = rowQty(row) || 0;

      if (existingAutoIdx >= 0) {
        const existing = next[existingAutoIdx];
        const codeChange = existing.code !== desiredCode;
        const tierChange = existing.params?.tier !== desiredTier;
        const qtyChange  = existing.qty !== desiredQty;
        const priceChange = Number(existing.params?.unitPrice) !== desiredUnitPrice;
        if (codeChange || tierChange || qtyChange || priceChange) {
          next[existingAutoIdx] = {
            ...existing,
            code: desiredCode,
            qty: desiredQty,
            params: { ...(existing.params || {}), tier: desiredTier, unitPrice: desiredUnitPrice, _auto: true },
          };
          changed = true;
        }
      } else {
        next.push({
          id: `auto_${row.id}_${desiredCode}`,
          code: desiredCode,
          qty: desiredQty,
          scope: { rowId: row.id },
          params: { tier: desiredTier, unitPrice: desiredUnitPrice, _auto: true },
        });
        changed = true;
      }
    }

    // Cleanup pass: drop auto entries whose row no longer qualifies (deleted,
    // method changed, no longer filled). Walks backwards so splice indices
    // stay stable.
    const validRowIds = new Set(
      rows.filter(r => r.deco === 'embroidery' && isFilled(r)).map(r => r.id)
    );
    for (let i = next.length - 1; i >= 0; i--) {
      const a = next[i];
      if (!a?.params?._auto) continue;
      if (a.code !== 'AS-CAP' && a.code !== 'AS-Garm') continue;
      if (!a.scope || typeof a.scope !== 'object' || !validRowIds.has(a.scope.rowId)) {
        next.splice(i, 1);
        changed = true;
      }
    }

    if (changed) setAddOns(next);
  }, [rows, addOns, decoConfig]);

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

  // Phase 2a 2026-05-03 — expose state setters on window for end-to-end
  // smoke testing of the add-on submit path before the UI lands in 2b.
  // Usage from browser devtools console:
  //   window.OrderFormApp.setAddOns([
  //     { id: 'a1', code: '3D-EMB', qty: 24, scope: { rowId: 'r1' } },
  //     { id: 'a2', code: 'GRT-50', qty: 1, scope: 'order' },
  //   ]);
  // This is safe in production: setAddOns just feeds React state — same as
  // any UI interaction would. Phase 2b removes the need by adding a UI.
  React.useEffect(() => {
    window.OrderFormApp = { addOns, setAddOns, info, rows, breakdown };
  }, [addOns, info, rows, breakdown]);

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

      {/* 2026-05-04 Phase D.2 — Customer view gets the polished
          CustomerApprovalView (cards, branded header, summary, approval CTA)
          instead of the staff PaperForm. Falls back to PaperForm if the new
          component fails to load (defensive). */}
      {customerMode && window.CustomerApprovalView ? (
        <div className="paper-wrap screen-only">
          <window.CustomerApprovalView
            info={info}
            rows={rows}
            ship={ship}
            orderNotes={orderNotes}
            decoConfig={decoConfig}
            addOns={addOns}
            breakdown={breakdown}
            draftId={draftId}
            draftStatus={draftStatus}
            files={files}
          />
        </div>
      ) : (
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
            addOns={addOns} setAddOns={setAddOns}
            breakdown={breakdown}
            customerMode={customerMode}
            draftId={draftId}
            staffFilled={staffFilled}
          />
        </div>
      )}

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
