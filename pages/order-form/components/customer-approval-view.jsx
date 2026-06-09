// Customer Approval View — Phase D.2 (2026-05-04)
//
// The view a customer sees when they open an order via a share link
// (?draftId=OF-NNNN). Replaces the staff PaperForm with a polished,
// card-based, responsive layout that reads as "review your order" — not
// "fill in this spreadsheet."
//
// Design goals:
//   • Brand-forward header (NWCA mark, customer name, order #, status)
//   • Info card at top so they verify company/contact/address
//   • One card per line item — large image, sizes, decoration breakdown,
//     prominent per-piece + total
//   • Summary card with subtotal/tax/grand total (bold)
//   • Approval CTA at the bottom — Approve / Request Changes / Print
//
// Data source: same `breakdown` produced by priceForm() in app.jsx, same
// `rows`/`info`/`ship` state. No new fetch, no new pricing math — just a
// different render path.

(function () {
  'use strict';
  const { useState, useMemo } = React;

  // ---------- helpers ----------
  function fmt$(n) {
    if (!Number.isFinite(Number(n))) return '$0.00';
    return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function isVisibleRow(r) {
    if (!r) return false;
    const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
    if (!hasQty) return false;
    const hasProduct = (r.style && r.style.trim()) || (r.manualMode && Number(r.manualCost) > 0);
    return !!hasProduct;
  }

  // Render sizes as compact text: "S × 1 · M × 1 · L × 1 · XL × 1 · 2XL × 1"
  // Keeps natural display order from availableSizes when present, else falls
  // back to the row's own size keys.
  function sizesLine(row, breakdown) {
    const sizes = row.sizes || {};
    const order = (breakdown?.extras?.availableSizes && breakdown.extras.availableSizes.length)
      ? breakdown.extras.availableSizes
      : Object.keys(sizes);
    const parts = order
      .filter(sz => Number(sizes[sz]) > 0)
      .map(sz => `${sz} × ${Number(sizes[sz])}`);
    return parts.join('  ·  ');
  }

  function rowQtyTotal(row) {
    return Object.values(row.sizes || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }

  function decoLabel(deco) {
    switch (deco) {
      case 'embroidery':  return 'Embroidery';
      case 'screenprint': return 'Screen Print';
      case 'dtg':         return 'Direct-to-Garment';
      case 'dtf':         return 'DTF Transfer';
      case 'sticker':     return 'Sticker';
      case 'emblem':      return 'Patch / Emblem';
      default:            return deco ? deco.charAt(0).toUpperCase() + deco.slice(1) : '';
    }
  }

  // ---------- header ----------
  function CavHeader({ info, draftId, draftStatus }) {
    const company = info?.company || '';
    const buyer = [info?.buyerFirst, info?.buyerLast].filter(Boolean).join(' ');
    const statusLabel = (draftStatus === 'Approved')
      ? 'Approved'
      : 'Awaiting your approval';
    const statusVariant = (draftStatus === 'Approved') ? 'approved' : 'pending';
    return (
      <header className="cav-header">
        <div className="cav-header-brand">
          <img className="cav-logo"
               src="https://cdn.caspio.com/A0E15000/Northwest%20Custom%20Apparel/NWCA-logo.png"
               alt="Northwest Custom Apparel"
               onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="cav-header-brand-text">
            <span className="cav-brand-line">Northwest Custom Apparel</span>
            <span className="cav-brand-sub">Since 1977 · Family-owned</span>
            <span className="cav-brand-addr">2025 Freeman Road East</span>
            <span className="cav-brand-addr">Milton, Washington 98354</span>
            <span className="cav-brand-addr cav-brand-addr--mono">253-922-5793</span>
          </div>
        </div>
        <div className="cav-header-order">
          <span className="cav-eyebrow">Your Order</span>
          <h1 className="cav-order-num">{draftId || ''}</h1>
          <div className="cav-header-meta">
            {company && <span className="cav-header-company">{company}</span>}
            {buyer && <span className="cav-header-buyer">· {buyer}</span>}
          </div>
          <span className={`cav-status-pill cav-status-pill--${statusVariant}`}>
            {statusLabel}
          </span>
        </div>
      </header>
    );
  }

  // ---------- info card (read-only) ----------
  function CavInfoCard({ info, ship }) {
    const company = info?.company || '';
    const buyer = [info?.buyerFirst, info?.buyerLast].filter(Boolean).join(' ');
    const email = info?.email || '';
    const phone = info?.phone || '';
    const address = info?.address || '';
    const cityStateZip = [info?.city, info?.state].filter(Boolean).join(', ') + (info?.zip ? ' ' + info.zip : '');
    const po = info?.po || '';
    const salesRep = info?.salesRep || '';
    const dateDue = info?.dateDue || '';
    const shipMethod = ship?.method ? (ship.method.toUpperCase()) : '';

    function fmtDate(s) {
      if (!s) return '';
      try {
        const d = new Date(s + 'T12:00:00');
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      } catch (_) { return s; }
    }

    return (
      <section className="cav-card cav-info">
        <h2 className="cav-card-title">Order details</h2>
        <div className="cav-info-grid">
          {company && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Company</span>
              <span className="cav-info-val">{company}</span>
            </div>
          )}
          {buyer && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Contact</span>
              <span className="cav-info-val">{buyer}</span>
            </div>
          )}
          {email && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Email</span>
              <span className="cav-info-val cav-info-mono">{email}</span>
            </div>
          )}
          {phone && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Phone</span>
              <span className="cav-info-val cav-info-mono">{phone}</span>
            </div>
          )}
          {(address || cityStateZip.trim()) && (
            <div className="cav-info-item cav-info-item--wide">
              <span className="cav-info-lbl">Address</span>
              <span className="cav-info-val">
                {address}{address && cityStateZip ? ' · ' : ''}{cityStateZip}
              </span>
            </div>
          )}
          {po && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">PO #</span>
              <span className="cav-info-val cav-info-mono">{po}</span>
            </div>
          )}
          {salesRep && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Sales rep</span>
              <span className="cav-info-val">{salesRep}</span>
            </div>
          )}
          {dateDue && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Date needed</span>
              <span className="cav-info-val">{fmtDate(dateDue)}</span>
            </div>
          )}
          {shipMethod && (
            <div className="cav-info-item">
              <span className="cav-info-lbl">Delivery</span>
              <span className="cav-info-val">{shipMethod}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ---------- line item card ----------
  function CavLineItem({ row, breakdown, addOns, decoConfig }) {
    const qty = rowQtyTotal(row);
    const subtotal = breakdown?.rowSubtotal || 0;
    const basePrice = Number.isFinite(Number(breakdown?.extras?.basePrice))
      ? Number(breakdown.extras.basePrice) : null;
    const sizeUpcharges = breakdown?.extras?.sizeUpcharges || {};
    const tier = breakdown?.tier;
    const isCap = breakdown?.extras?.capOrFlat === 'cap';

    // Decoration line (deco · location · stitch count for embroidery)
    const dec = (() => {
      const m = row?.deco;
      if (!m) return '';
      const cfg = row.rowDecoConfig || {};
      const pos = cfg.primaryPosition || decoConfig?.primaryLocation || '';
      const sc  = cfg.primaryStitchCount || decoConfig?.stitchCount;
      const parts = [decoLabel(m)];
      if (pos) parts.push(pos);
      if (m === 'embroidery' && sc) parts.push(`${Number(sc).toLocaleString()} stitches`);
      return parts.join(' · ');
    })();

    // Per-row addons (additional logos, etc.)
    const myAddOns = (addOns || []).filter(a =>
      a && a.scope && typeof a.scope === 'object' && a.scope.rowId === row.id
    );

    return (
      <article className="cav-card cav-item">
        <div className="cav-item-photo">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.desc || row.style || ''} loading="lazy" />
          ) : (
            <div className="cav-item-photo-placeholder">
              <span>No image</span>
            </div>
          )}
        </div>

        <div className="cav-item-body">
          <div className="cav-item-head">
            <div className="cav-item-title">
              <span className="cav-item-style">{row.style || (row.manualMode ? 'Custom item' : '')}</span>
              <span className="cav-item-name">{row.desc || ''}</span>
            </div>
            {tier && (
              <span className={`cav-tier-pill ${isCap ? 'cav-tier-pill--cap' : ''}`}>
                Tier {tier}{isCap && <span className="cav-tier-cap">CAP</span>}
              </span>
            )}
          </div>

          {(row.colorName || row.color) && (
            <div className="cav-item-color">
              <span className="cav-info-lbl">Color</span>
              <span className="cav-info-val">{row.colorName || row.color}</span>
            </div>
          )}

          <div className="cav-item-sizes">
            <span className="cav-info-lbl">Sizes</span>
            <span className="cav-sizes-text">{sizesLine(row, breakdown)}</span>
          </div>

          {dec && (
            <div className="cav-item-deco">
              <span className="cav-deco-icon" aria-hidden="true">●</span>
              <span>{dec}</span>
            </div>
          )}

          {myAddOns.length > 0 && (
            <ul className="cav-item-addons">
              {myAddOns.map(a => (
                <li key={a.id}>
                  <span className="cav-addon-name">{a.name || a.code}</span>
                  {a.params?.position && <span className="cav-addon-pos"> · {a.params.position}</span>}
                  {a.params?.stitchCount && <span className="cav-addon-stitch"> · {Number(a.params.stitchCount).toLocaleString()} stitches</span>}
                </li>
              ))}
            </ul>
          )}

          {Object.keys(sizeUpcharges).length > 0 && (
            <div className="cav-upcharges">
              {Object.entries(sizeUpcharges)
                .filter(([sz]) => Number(row.sizes?.[sz]) > 0)
                .map(([sz, up]) => (
                  <span key={sz} className="cav-upcharge-chip">+{fmt$(up)} <em>{sz}</em></span>
                ))}
            </div>
          )}
        </div>

        <div className="cav-item-price">
          {basePrice != null && (
            <div className="cav-item-each">
              <span className="cav-item-each-amt">{fmt$(basePrice)}</span>
              <span className="cav-item-each-suffix">each</span>
            </div>
          )}
          <div className="cav-item-qty">{qty} pcs</div>
          <div className="cav-item-total">{fmt$(subtotal)}</div>
        </div>
      </article>
    );
  }

  // ---------- summary card ----------
  function CavSummary({ breakdown }) {
    const totalQty = breakdown?.totalQty || 0;
    const subtotal = breakdown?.subtotal || 0;
    const tax = breakdown?.taxEstimate || 0;
    const grand = (breakdown?.grandTotal || 0) + tax;
    const fees = breakdown?.fees || [];
    const deposit = breakdown?.depositDue || 0;

    return (
      <aside className="cav-card cav-summary">
        <h2 className="cav-card-title">Summary</h2>

        <div className="cav-sum-row">
          <span className="cav-sum-lbl">
            Subtotal
            {totalQty > 0 && <span className="cav-sum-dim"> ({totalQty} pcs)</span>}
          </span>
          <span className="cav-sum-val">{fmt$(subtotal)}</span>
        </div>

        {fees.filter(f => Number(f.amount) > 0).map((f, i) => (
          <div key={i} className="cav-sum-row cav-sum-row--small">
            <span className="cav-sum-lbl">{f.label || f.code}</span>
            <span className="cav-sum-val">{fmt$(f.amount)}</span>
          </div>
        ))}

        <div className="cav-sum-row cav-sum-row--small">
          <span className="cav-sum-lbl">{breakdown?.taxLabel || 'Estimated tax'}</span>
          <span className="cav-sum-val">{fmt$(tax)}</span>
        </div>

        <div className="cav-sum-divider" />

        <div className="cav-sum-row cav-sum-row--total">
          <span className="cav-sum-lbl">Total</span>
          <span className="cav-sum-val">{fmt$(grand)}</span>
        </div>

        {deposit > 0 && (
          <div className="cav-sum-row cav-sum-row--deposit">
            <span className="cav-sum-lbl">50% deposit due</span>
            <span className="cav-sum-val">{fmt$(deposit)}</span>
          </div>
        )}

        <p className="cav-sum-note">
          Estimated pricing — final confirmed by your sales rep before production.
        </p>
      </aside>
    );
  }

  // ---------- action bar ----------
  // Phase D.3 (2026-05-04) — Approve button flips the Caspio session
  // status to 'Approved' via window.nwOrderAPI.approveDraft.
  //
  // Phase D.3.1 (2026-05-04) — After server success, fires EmailJS to
  // notify the sales rep + erik@. Template `template_order_approved` on
  // service `service_jgrave3`. Email failure does NOT roll back the
  // approval — the source of truth is the Caspio status flip; the email
  // is a courtesy notification on top.
  const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
  const EMAILJS_SERVICE_ID = 'service_jgrave3';
  const EMAILJS_TEMPLATE_APPROVED = 'template_order_approved';

  // Helper that builds the params and sends. Designed to never throw —
  // worst case logs to console and returns false.
  async function sendApprovalEmail({ draftId, response, totalAmount, totalQty, customerName, customerCompany, customerEmail, customerPhone, summaryHtml }) {
    if (typeof window.emailjs === 'undefined') {
      console.warn('[CAV] EmailJS SDK not loaded — skipping notification');
      return false;
    }
    try {
      window.emailjs.init(EMAILJS_PUBLIC_KEY);
      const params = {
        // Recipient(s) — server returned the rep slug→email mapping
        to_email: response?.rep_email || 'erik@nwcustomapparel.com',
        rep_name: response?.rep_name || 'Sales Team',
        // Order identity
        draft_id: draftId,
        order_number: draftId,
        approved_at: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        // Customer
        customer_name: customerName || response?.customer_name || '',
        customer_company: customerCompany || response?.customer_company || '',
        customer_email: customerEmail || response?.customer_email || '',
        customer_phone: customerPhone || response?.customer_phone || '',
        // Totals
        total_amount: totalAmount || '$0.00',
        total_qty: totalQty || 0,
        // Order summary HTML (line items)
        summary_html: summaryHtml || '',
        // Branding / convenience
        company_name: 'Northwest Custom Apparel',
        company_phone: '253-922-5793',
        share_url: `${window.location.origin}/pages/order-form.html?draftId=${encodeURIComponent(draftId)}`,
        reply_to: customerEmail || 'sales@nwcustomapparel.com',
      };
      console.log(`[CAV] Sending approval email to ${params.to_email}…`);
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_APPROVED, params);
      console.log('[CAV] ✓ Approval email sent');
      return true;
    } catch (err) {
      // EmailJS template missing / network failure — log but don't bubble.
      // The approval is already saved server-side; this is a courtesy ping.
      console.error('[CAV] Approval email failed (non-blocking):', err?.text || err?.message || err);
      return false;
    }
  }

  function CavActions({ draftId, draftStatus, onLocalStatusChange, onSendEmail }) {
    const initiallyApproved = draftStatus === 'Approved';
    const [approving, setApproving] = useState(false);
    const [approved, setApproved] = useState(initiallyApproved);
    const [approveError, setApproveError] = useState('');
    const [requestOpen, setRequestOpen] = useState(false);
    const isApproved = approved || initiallyApproved;

    async function handleApprove() {
      if (isApproved || approving) return;
      if (!window.nwOrderAPI?.approveDraft) {
        setApproveError('Approval is temporarily unavailable. Please call your sales rep at 253-922-5793.');
        return;
      }
      setApproving(true);
      setApproveError('');
      try {
        const response = await window.nwOrderAPI.approveDraft(draftId);
        setApproved(true);
        if (typeof onLocalStatusChange === 'function') onLocalStatusChange('Approved');
        // D.3.1 — Fire the email AFTER the Caspio status is locked in.
        // Don't await; let it run in the background so the UI confirms
        // the approval without a delay. Email failure is non-blocking
        // (already approved in Caspio — the rep can also see the new
        // Status field directly).
        if (typeof onSendEmail === 'function') {
          onSendEmail(response).catch(err => console.error('[CAV] email send error (non-blocking):', err));
        }
        // Smooth-scroll back to the top so the green "Approved" pill is
        // immediately visible — confirms the action without a popup.
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
      } catch (err) {
        console.error('[CAV] approve failed:', err);
        setApproveError(`Could not record your approval: ${err.message || 'unknown error'}. Please call 253-922-5793.`);
      } finally {
        setApproving(false);
      }
    }
    function handlePrint() { window.print(); }

    return (
      <section className="cav-card cav-actions">
        <h2 className="cav-card-title">{isApproved ? 'Order approved' : 'Approve this order'}</h2>
        <p className="cav-actions-blurb">
          {isApproved
            ? 'Thank you — your sales rep has been notified and will be in touch shortly to confirm production timing.'
            : 'Review the order above. When everything looks right, click Approve. Anything you’d like changed? Use Request Changes — your sales rep gets the note immediately.'
          }
        </p>
        <div className="cav-actions-row">
          <button
            type="button"
            className="cav-btn cav-btn--primary"
            onClick={handleApprove}
            disabled={isApproved || approving}
          >
            {isApproved ? '✓ Approved' : (approving ? 'Approving…' : 'Approve order')}
          </button>
          {!isApproved && (
            <button
              type="button"
              className="cav-btn cav-btn--secondary"
              onClick={() => setRequestOpen(o => !o)}
            >
              Request changes
            </button>
          )}
          <button
            type="button"
            className="cav-btn cav-btn--ghost"
            onClick={handlePrint}
          >
            Print / Save PDF
          </button>
        </div>
        {approveError && (
          <div className="cav-approve-error" role="alert">
            {approveError}
          </div>
        )}
        {requestOpen && !isApproved && (
          <div className="cav-changes-form">
            <textarea
              className="cav-changes-text"
              placeholder="What would you like changed? (sizes, quantities, decoration placement, …)"
              rows={4}
            />
            <div className="cav-changes-help">
              Sales-rep email handoff ships in the next step. For now, please reply to your quote email or call <strong>253-922-5793</strong>.
            </div>
          </div>
        )}
      </section>
    );
  }

  // ---------- main ----------
  function CustomerApprovalView({
    info, rows, ship, orderNotes, decoConfig, addOns, breakdown, draftId, draftStatus, files,
  }) {
    const visibleRows = useMemo(() => (rows || []).filter(isVisibleRow), [rows]);
    const byRow = breakdown?.byRow;
    const getBreakdown = (id) => (byRow?.get?.(id) ?? byRow?.[id] ?? null);
    // Local-only status mirror so the header pill flips green the moment the
    // customer clicks Approve, without waiting for a full draft reload.
    const [localStatus, setLocalStatus] = useState(draftStatus);
    const effectiveStatus = localStatus || draftStatus;

    // D.3.1 — Build the EmailJS payload from the same render data the
    // customer just looked at. summaryHtml is a plain HTML <ul> the rep
    // sees in the notification email — no styling, just the products.
    async function handleSendApprovalEmail(serverResponse) {
      const tax = breakdown?.taxEstimate || 0;
      const grand = (breakdown?.grandTotal || 0) + tax;
      const totalQty = breakdown?.totalQty || 0;
      const lines = visibleRows.map(r => {
        const rb = getBreakdown(r.id);
        const subtotal = rb?.rowSubtotal || 0;
        const qty = Object.values(r.sizes || {}).reduce((a, v) => a + (Number(v) || 0), 0);
        const sizeStr = sizesLine(r, rb);
        const style = (r.style || (r.manualMode ? 'Custom item' : '')).replace(/[<>&]/g, ' ');
        const desc = (r.desc || '').replace(/[<>&]/g, ' ');
        return `<li><strong>${style}</strong>${desc ? ' — ' + desc : ''} (${sizeStr}) · ${qty} pcs · ${fmt$(subtotal)}</li>`;
      }).join('');
      const summaryHtml = `<ul style="margin:0;padding-left:18px;">${lines}</ul>`;

      return sendApprovalEmail({
        draftId,
        response: serverResponse,
        totalAmount: fmt$(grand),
        totalQty,
        customerName: [info?.buyerFirst, info?.buyerLast].filter(Boolean).join(' '),
        customerCompany: info?.company || '',
        customerEmail: info?.email || '',
        customerPhone: info?.phone || '',
        summaryHtml,
      });
    }

    return (
      <div className="cav">
        <CavHeader info={info} draftId={draftId} draftStatus={effectiveStatus} />
        <CavInfoCard info={info} ship={ship} />

        <div className="cav-main">
          <div className="cav-items-col">
            {visibleRows.length === 0 ? (
              <div className="cav-card cav-empty">
                <p>This order doesn't have any line items yet. Your sales rep will be in touch.</p>
              </div>
            ) : (
              visibleRows.map(r => (
                <CavLineItem
                  key={r.id}
                  row={r}
                  breakdown={getBreakdown(r.id)}
                  addOns={addOns}
                  decoConfig={decoConfig}
                />
              ))
            )}
            {orderNotes && (
              <section className="cav-card cav-notes">
                <h2 className="cav-card-title">Order notes</h2>
                <p className="cav-notes-text">{orderNotes}</p>
              </section>
            )}
          </div>
          <CavSummary breakdown={breakdown} />
        </div>

        <CavActions
          draftId={draftId}
          draftStatus={effectiveStatus}
          onLocalStatusChange={setLocalStatus}
          onSendEmail={handleSendApprovalEmail}
        />

        <footer className="cav-footer">
          <div className="cav-footer-line">Northwest Custom Apparel · 2025 Freeman Road East, Milton, Washington 98354</div>
          <div className="cav-footer-line">253-922-5793 · sales@nwcustomapparel.com · nwcustomapparel.com</div>
        </footer>
      </div>
    );
  }

  // Expose to window so app.jsx can render it
  window.CustomerApprovalView = CustomerApprovalView;
})();
