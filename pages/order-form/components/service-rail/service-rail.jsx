// Order Form Service Rail — main ServiceRail component (Phase 3c, 2026-05-03).
//
// Sticky left-side panel that renders the active deco method's available
// services as draggable cards organized into 5 sections. Drives the
// drag-and-drop flow:
//
//   1. Rep clicks/grabs a card → setDragPayload({ service, qty, scope, params })
//   2. Each line-item row + the order-level zone become drop targets that
//      validate eligibility against the dragged service's scope
//   3. On drop → addOrReplace via window.OrderFormServiceCodes, mutate addOns
//   4. Card payload includes qty (auto-filled from row qty for per-row codes)
//      and unitPrice (already resolved by the card)
//
// Method-aware filtering is delegated to each pricing engine's
// getRailServices() implementation. When the rep changes the deco method,
// the rail re-renders with that method's service set.

(function () {
  'use strict';
  const { useState, useEffect, useMemo } = React;

  // Order rendered for the section list. RailGroup column drives membership;
  // this controls the visual order of sections. Unknown groups (e.g. Phase
  // 5a method-local additions like 'Emblem Extras', 'Sticker Extras') are
  // rendered after the canonical list, alphabetized — see render logic below.
  const SECTION_ORDER = [
    'Stitch Surcharges',
    'Cap Extras',
    'Garment Extras',
    'Setup Fees',
    'Order Fees',
    'Other',
  ];

  // Phase 6b (2026-05-03) — sessionStorage key + max length for the recent
  // drops list. Per-tab, not persisted long-term — the rail "remembers" the
  // last N codes the rep dropped so reps doing a series of similar orders
  // see their muscle-memory cards float to the top. Cleared on tab close.
  const RECENT_DROPS_KEY = 'orderForm.serviceRail.recentDrops.v1';
  const RECENT_DROPS_MAX = 8;
  function loadRecentDrops() {
    try {
      const raw = sessionStorage.getItem(RECENT_DROPS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(c => typeof c === 'string') : [];
    } catch (_) { return []; }
  }
  function recordRecentDrop(code) {
    if (!code || typeof code !== 'string') return;
    try {
      const current = loadRecentDrops();
      // Move-to-front: remove any prior occurrence, then unshift.
      const next = [code, ...current.filter(c => c !== code)].slice(0, RECENT_DROPS_MAX);
      sessionStorage.setItem(RECENT_DROPS_KEY, JSON.stringify(next));
    } catch (_) { /* quota / private mode — silently skip */ }
  }

  // Phase 6b — subsequence-based fuzzy match. Returns a relevance score
  // (lower is better) when the query characters appear IN ORDER inside the
  // target string, with adjacent matches scoring higher. Returns Infinity
  // when there's no match. Used to rank cards in filteredServices.
  //
  // Examples:
  //   match('mtl', 'metallic')        → ~3 (m,t,l found in order)
  //   match('cap', 'al-cap')          → ~5 (matches "cap" suffix)
  //   match('frnt', 'front print')    → ~4 (typo'd front)
  //   match('xyz', 'metallic')        → Infinity (no match)
  function fuzzyScore(query, target) {
    if (!query) return 0;  // empty query → all match (score 0)
    const q = String(query).toLowerCase();
    const t = String(target || '').toLowerCase();
    if (!t) return Infinity;
    if (t.includes(q)) return 0;  // exact substring is best
    let qi = 0;
    let lastMatchIdx = -1;
    let totalGap = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        if (lastMatchIdx >= 0) totalGap += (i - lastMatchIdx - 1);
        lastMatchIdx = i;
        qi += 1;
      }
    }
    if (qi < q.length) return Infinity;  // not all chars found
    // Add the leading offset so matches that start near the beginning of
    // the target outscore matches deep in the string.
    const leadingGap = t.indexOf(q[0]);
    return totalGap + leadingGap;
  }

  /**
   * @param {Object} props
   * @param {string} props.deco                active deco method ('embroidery', 'screenprint', etc.)
   * @param {Array} props.rows                 line item rows
   * @param {Object} props.breakdown           pricing breakdown (for cap/flat detection)
   * @param {Array} props.addOns               current addOns array
   * @param {Function} props.setAddOns         setter
   * @param {string|number} [props.customerId] for per-customer auto-suggest (Phase 4)
   */
  function ServiceRail({ deco, rows, breakdown, addOns, setAddOns, customerId, customerCompany }) {
    const [services, setServices] = useState([]);
    const [customerOverrides, setCustomerOverrides] = useState({});
    const [dragPayload, setDragPayload] = useState(null); // { service, qty, scope, params }
    const [selectedCard, setSelectedCard] = useState(null); // mobile tap-to-select
    const [searchQuery, setSearchQuery] = useState(''); // Phase 5.4 filter
    // Phase 6b — recent drops, populated from sessionStorage. Updated by
    // handleDrop on each successful drop. Empty until the rep has dropped
    // at least one card during the current tab session.
    const [recentCodes, setRecentCodes] = useState(() => loadRecentDrops());
    // Phase 6c — usage-history-based suggestion codes for the current
    // customer. Refetched whenever customerCompany changes. Empty for new
    // customers + when no company is set yet.
    const [suggestionCodes, setSuggestionCodes] = useState([]);

    // Detect touch device (no hover capability) — switches to tap-tap UX
    const isTouch = useMemo(() =>
      typeof window !== 'undefined' && window.matchMedia?.('(hover: none)')?.matches,
    []);

    // Phase 5.1 — empty-state nudge. Pulse the first non-Standard card when
    // the rep has no add-ons yet AND hasn't dismissed the nudge this session.
    const NUDGE_KEY = 'orderForm.serviceRail.nudgeDismissed.v1';
    const [nudgeDismissed, setNudgeDismissed] = useState(() => {
      try { return sessionStorage.getItem(NUDGE_KEY) === 'true'; }
      catch (_) { return false; }
    });
    const showNudge = !nudgeDismissed && (addOns?.length || 0) === 0;
    // Dismiss nudge on first drag/tap interaction
    useEffect(() => {
      if ((addOns?.length || 0) > 0 && !nudgeDismissed) {
        try { sessionStorage.setItem(NUDGE_KEY, 'true'); } catch (_) {}
        setNudgeDismissed(true);
      }
    }, [addOns]);

    // Load services from the active method's engine. Re-run when method
    // changes or when addOns mutate (so suggested badges can refresh).
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const SC = window.OrderFormServiceCodes;
        if (!SC) return;
        // Make sure the cache is warm before asking the engine
        await SC.fetch();
        // Also pre-warm tiered-pricing for any TIERED card to render live prices
        if (window.OrderFormTieredPricing?.preload) {
          window.OrderFormTieredPricing.preload();
        }
        if (cancelled) return;

        const reg = window.OrderFormPricing;
        const engine = reg?.getMethod?.(deco);
        if (!engine?.getRailServices) { setServices([]); return; }
        setServices(engine.getRailServices({ rows, breakdown }, customerOverrides));
      })();
      return () => { cancelled = true; };
    }, [deco, customerOverrides]);

    // Customer overrides (Phase 4 — wired but no-op when no Accounts table)
    useEffect(() => {
      if (!customerId) { setCustomerOverrides({}); return; }
      const SC = window.OrderFormServiceCodes;
      if (!SC?.getCustomerOverrides) return;
      SC.getCustomerOverrides(customerId).then(o => setCustomerOverrides(o || {}));
    }, [customerId]);

    // Phase 6c — fetch the customer's usage-history suggestions whenever
    // the company name changes. Cancellable so a quick string of edits to
    // the company field doesn't race a stale response into state.
    useEffect(() => {
      const co = String(customerCompany || '').trim();
      if (!co) { setSuggestionCodes([]); return; }
      const SC = window.OrderFormServiceCodes;
      if (!SC?.getCustomerSuggestions) return;
      let cancelled = false;
      SC.getCustomerSuggestions(co, { limit: 8 }).then(arr => {
        if (cancelled) return;
        setSuggestionCodes(Array.isArray(arr) ? arr.map(x => x.code).filter(Boolean) : []);
      });
      return () => { cancelled = true; };
    }, [customerCompany]);

    // Phase 6b — fuzzy filter. Score each service by best-of-three across
    // code / name / tier; keep matches with finite score; sort by relevance
    // (lower score = better match). When the query is empty, return all
    // services in their natural order.
    const filteredServices = useMemo(() => {
      const q = searchQuery.trim();
      if (!q) return services;
      return services
        .map(s => {
          const score = Math.min(
            fuzzyScore(q, s.ServiceCode || ''),
            fuzzyScore(q, s.DisplayName || ''),
            fuzzyScore(q, s.Tier || ''),
          );
          return { service: s, score };
        })
        .filter(x => Number.isFinite(x.score))
        .sort((a, b) => a.score - b.score)
        .map(x => x.service);
    }, [services, searchQuery]);

    // Group services by RailGroup
    const grouped = useMemo(() => {
      const SC = window.OrderFormServiceCodes;
      return SC?.groupedByRailGroup?.(filteredServices) || { Other: filteredServices };
    }, [filteredServices]);

    // Phase 6b — resolve the recent-codes list against the currently-filtered
    // services. Codes that aren't in the current method's rail (e.g. dropped
    // during a previous embroidery session, then rep switched to DTG) get
    // filtered out. Order preserved from sessionStorage (most recent first).
    // Hidden during search to keep the search results unambiguous.
    const recentlyUsedServices = useMemo(() => {
      if (searchQuery.trim()) return [];
      if (!recentCodes.length) return [];
      const byCode = new Map(filteredServices.map(s => [s.ServiceCode, s]));
      return recentCodes
        .map(c => byCode.get(c))
        .filter(Boolean);
    }, [recentCodes, filteredServices, searchQuery]);

    // Phase 6c — resolve customer-history codes against the current method's
    // rail. Codes the customer used previously but that aren't in the active
    // method's rail (cross-method history) silently fall out. De-dupe against
    // the Recently-used section so a code dropped THIS session and ALSO seen
    // in the customer's prior history doesn't render twice — Recent wins
    // (most acute signal).
    const suggestedServices = useMemo(() => {
      if (searchQuery.trim()) return [];
      if (!suggestionCodes.length) return [];
      const byCode = new Map(filteredServices.map(s => [s.ServiceCode, s]));
      const recentSet = new Set(recentlyUsedServices.map(s => s.ServiceCode));
      return suggestionCodes
        .map(c => byCode.get(c))
        .filter(s => s && !recentSet.has(s.ServiceCode));
    }, [suggestionCodes, filteredServices, recentlyUsedServices, searchQuery]);

    // Track the first non-Standard card across all sections for the nudge.
    // Falls back to ServiceCode for virtual cards (Phase 5a) that don't have
    // a Caspio PK_ID.
    const nudgeTargetPK = useMemo(() => {
      if (!showNudge) return null;
      for (const name of SECTION_ORDER) {
        const list = grouped[name] || [];
        const first = list.find(s => s.Tier !== 'Standard');
        if (first) return first.PK_ID || first.ServiceCode;
      }
      return null;
    }, [grouped, showNudge]);

    // Cap vs flat detection per row (lifted from add-on-picker.jsx pattern).
    // Used to validate drop-zone eligibility.
    function rowKindFor(row) {
      const rb = breakdown?.byRow?.get?.(row.id) || breakdown?.byRow?.[row.id];
      return rb?.extras?.capOrFlat || 'flat';
    }

    function rowQty(row) {
      if (!row?.sizes) return 0;
      let total = 0;
      for (const k of Object.keys(row.sizes)) total += Number(row.sizes[k]) || 0;
      return total;
    }

    function rowLabel(row) {
      const style = (row?.style || '').trim();
      const desc = (row?.desc || '').trim();
      if (style) return `${style} · ${desc.slice(0, 18)}`;
      return desc.slice(0, 24) || '(unnamed)';
    }

    // Filter rows that have qty > 0 — those are valid drop targets
    const eligibleRows = useMemo(() =>
      (rows || []).filter(r => rowQty(r) > 0),
    [rows]);

    function onDragStart(payload) {
      setDragPayload(payload);
      setSelectedCard(null); // clear tap-selection if drag starts
      // Phase 3e — broadcast drag state to the form's row renderer so rows
      // can show inline drop overlays.
      window.__railDragPayload = payload;
      document.body.classList.add('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragStart', { detail: payload }));
    }

    // Phase 3f — tap-to-select for touch devices.
    // Tap a card → enters "selected" state (matches drag payload). Rows pick
    // it up via the same window.__railDragPayload + railDragStart event the
    // desktop drag uses. Tap a row → places. Tap empty → cancels.
    function onTapCard(payload) {
      if (selectedCard && selectedCard.service.PK_ID === payload.service.PK_ID) {
        // Tap same card again → cancel selection
        setSelectedCard(null);
        window.__railDragPayload = null;
        document.body.classList.remove('rail-dragging');
        window.dispatchEvent(new CustomEvent('railDragEnd'));
        return;
      }
      setSelectedCard(payload);
      window.__railDragPayload = payload;
      document.body.classList.add('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragStart', { detail: payload }));
    }
    function onDragEnd() {
      setDragPayload(null);
      window.__railDragPayload = null;
      document.body.classList.remove('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragEnd'));
    }

    /**
     * onDrop handler — wires the dragged card into addOns state.
     * scope='order' for order-level, otherwise rowId is set.
     */
    function handleDrop({ zoneType, rowId, rowKind }) {
      // Read payload from local state OR window global (when called from
      // paper-form's row drop handlers).
      const payload = dragPayload || window.__railDragPayload;
      if (!payload) return;
      const { service, params } = payload;
      const code = service.ServiceCode;
      const SC = window.OrderFormServiceCodes;

      // Determine qty + scope. Phase 7a (2026-05-03) — order-level codes
      // (DD, GRT-50, RUSH, Freight, EMB-NEW-DESIGN, STK-NEW-ART, etc. —
      // see ORDER_LEVEL_CODES in service-codes.js) ALWAYS resolve to
      // scope='order' + qty=1, regardless of which zone caught the drop.
      // Otherwise dropping DD (FIXED $100) onto an empty row gave qty=0
      // and a $0 line total, and dropping it onto a populated row gave
      // qty=8 → $800 for what should be a single $100 setup fee.
      const isOrderLvl = SC?.isOrderLevel?.(code);
      let qty = 1;
      let scope;
      if (isOrderLvl) {
        qty = 1;
        scope = 'order';
      } else if (zoneType === 'row') {
        const r = (rows || []).find(x => x.id === rowId);
        qty = r ? rowQty(r) : 1;
        scope = { rowId };
      } else {
        qty = 1;
        scope = 'order';
      }

      const entry = {
        code,
        qty,
        scope,
        params: { ...params },
      };

      const result = SC?.addOrReplace?.(addOns || [], entry);
      if (result) {
        setAddOns(result.next);
        // Phase 3e — drop bounce signal: dispatch event that paper-form's
        // row + the new chip can listen to for animation
        window.dispatchEvent(new CustomEvent('railDropSuccess', {
          detail: { code, scope, rowId, ts: Date.now() },
        }));
        // Phase 6b — track muscle-memory: persist this code to recent
        // drops, then refresh local state so the "Recently used" section
        // re-renders with the freshly-dropped card on top.
        recordRecentDrop(code);
        setRecentCodes(loadRecentDrops());
      }
      setDragPayload(null);
      // Phase 6d/6e — also clear the tap/keyboard selection so the
      // placement banner closes after the drop lands.
      setSelectedCard(null);
      window.__railDragPayload = null;
      document.body.classList.remove('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragEnd'));
    }

    // Expose drop handler globally so paper-form's row drop zones can call it.
    // Re-bound on every render so the closure captures the latest addOns/setAddOns.
    useEffect(() => {
      window.__railHandleDrop = handleDrop;
      return () => {
        // Don't null on unmount — another instance may have remounted by then
      };
    });

    // Empty state — no method selected, or method has no services
    if (!deco) {
      return (
        <div className="of-rail rail-empty-wrap">
          <div className="rail-empty">Select a decoration method to see services</div>
        </div>
      );
    }
    if (services.length === 0) {
      return (
        <div className="of-rail rail-empty-wrap">
          <div className="rail-head">
            <h3 className="rail-title">Services</h3>
            <span className="rail-method-badge">{deco}</span>
          </div>
          <div className="rail-empty">No services configured for this method</div>
        </div>
      );
    }

    const RailCard = window.OrderFormRailCard;
    const RailSection = window.OrderFormRailSection;
    const DropZone = window.OrderFormDropZone;

    return (
      <div className="of-rail">
        <div className="rail-head">
          <h3 className="rail-title">Drag services →</h3>
          <span className="rail-method-badge">{deco}</span>
        </div>

        {/* Phase 5.4 — search filter input */}
        <div className="rail-search">
          <input
            className="rail-search-input"
            type="text"
            placeholder="Filter services…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              className="rail-search-clear"
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear filter"
            >×</button>
          ) : (
            <span className="rail-search-icon" aria-hidden>🔍</span>
          )}
        </div>

        {/* Phase 6d (2026-05-03) — selected-card placement banner. Visible
            ONLY when a card has been tap-selected (touch) or keyboard-
            selected (Phase 6e). Tells the rep what happens next ("tap a
            row to place this") and gives them a Cancel button. Hidden on
            desktop drag — they don't need this since they see the ghost. */}
        {selectedCard && (
          <div className="rail-selected-banner" role="status" aria-live="polite">
            <span className="rail-selected-banner-icon" aria-hidden>✓</span>
            <span className="rail-selected-banner-text">
              <strong>{selectedCard.service.DisplayName || selectedCard.service.ServiceCode}</strong>
              {' '}selected — tap a row to place it.
            </span>
            <button
              type="button"
              className="rail-selected-banner-cancel"
              onClick={() => onTapCard(selectedCard)}
              aria-label="Cancel selection"
            >Cancel</button>
          </div>
        )}

        {/* Empty filter result state */}
        {searchQuery && Object.values(grouped).every(arr => arr.length === 0) && (
          <div className="rail-empty">
            No services match "{searchQuery}"
            <div className="rail-empty-hint">
              Try a partial name like "metallic", "front", or just a code like "AL-CAP".
            </div>
          </div>
        )}

        {/* Phase 6c — Suggested for {Company} section. Surfaces codes this
            customer has historically used most, sourced from the Caspio
            Customer_Service_History table via /api/order-form/customer-
            suggestions. Renders ABOVE Recently used because it's the
            stronger cross-session signal. Hidden during search. */}
        {suggestedServices.length > 0 && (
          <RailSection
            name={`Suggested for ${(customerCompany || '').trim()}`}
            count={suggestedServices.length}
          >
            {suggestedServices.map(s => (
              <RailCard
                key={`suggested-${s.PK_ID || s.ServiceCode}-${s.Tier || ''}`}
                service={s}
                dragging={dragPayload && (dragPayload.service.PK_ID || dragPayload.service.ServiceCode) === (s.PK_ID || s.ServiceCode)}
                selected={selectedCard && (selectedCard.service.PK_ID || selectedCard.service.ServiceCode) === (s.PK_ID || s.ServiceCode)}
                isTouch={isTouch}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTap={onTapCard}
              />
            ))}
          </RailSection>
        )}

        {/* Phase 6b — Recently used section. Renders only when the rep has
            dropped cards earlier in this tab session AND hasn't typed a
            search query. Populated from sessionStorage; floats to the top
            so muscle memory finds the right card faster. */}
        {recentlyUsedServices.length > 0 && (
          <RailSection name="Recently used" count={recentlyUsedServices.length}>
            {recentlyUsedServices.map(s => (
              <RailCard
                key={`recent-${s.PK_ID || s.ServiceCode}-${s.Tier || ''}`}
                service={s}
                dragging={dragPayload && (dragPayload.service.PK_ID || dragPayload.service.ServiceCode) === (s.PK_ID || s.ServiceCode)}
                selected={selectedCard && (selectedCard.service.PK_ID || selectedCard.service.ServiceCode) === (s.PK_ID || s.ServiceCode)}
                isTouch={isTouch}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTap={onTapCard}
              />
            ))}
          </RailSection>
        )}

        {/* Render canonical sections first, then any unknown groups
            alphabetized after (Phase 5a — method-local groups like
            'Emblem Extras' that aren't in SECTION_ORDER). */}
        {(() => {
          const canonical = new Set(SECTION_ORDER);
          const extraGroups = Object.keys(grouped)
            .filter(g => !canonical.has(g) && (grouped[g] || []).length > 0)
            .sort();
          const order = [...SECTION_ORDER, ...extraGroups];
          return order.map(name => {
            const list = grouped[name] || [];
            if (!list.length) return null;
            return (
              <RailSection key={name} name={name} count={list.length}>
                {list.map(s => (
                  <RailCard
                    key={`${s.PK_ID || s.ServiceCode}-${s.Tier || ''}`}
                    service={s}
                    dragging={dragPayload && (dragPayload.service.PK_ID || dragPayload.service.ServiceCode) === (s.PK_ID || s.ServiceCode)}
                    selected={selectedCard && (selectedCard.service.PK_ID || selectedCard.service.ServiceCode) === (s.PK_ID || s.ServiceCode)}
                    isTouch={isTouch}
                    nudge={(s.PK_ID || s.ServiceCode) === nudgeTargetPK}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onTap={onTapCard}
                  />
                ))}
              </RailSection>
            );
          });
        })()}

        {/* Order-level drop zone — visible when dragging an order-eligible card */}
        {dragPayload && (
          <DropZone
            zoneType="order"
            dragging={{ code: dragPayload.service.ServiceCode }}
            onDrop={handleDrop}
          />
        )}

        {/* Per-row drop zones — visible only while dragging */}
        {dragPayload && eligibleRows.length > 0 && (
          <div className="rail-row-zones" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: '#868e96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Or drop on a row:
            </div>
            {eligibleRows.map(r => {
              const kind = rowKindFor(r);
              const label = `${rowLabel(r)} · ${kind === 'cap' ? '🧢' : '👕'} ${rowQty(r)}`;
              return (
                <DropZone
                  key={r.id}
                  zoneType="row"
                  rowId={r.id}
                  rowKind={kind}
                  label={label}
                  dragging={{ code: dragPayload.service.ServiceCode }}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  window.OrderFormServiceRail = ServiceRail;

  // ---------------------------------------------------------------------------
  // RailDropToast — Phase 4d (2026-05-03). Floating "✓ {DisplayName} added"
  // pill that appears whenever a card lands in addOns. Listens for the
  // 'railDropSuccess' event already fired by handleDrop above; auto-dismisses
  // after 2.4s. Stacks cleanly when multiple drops happen in quick succession.
  // Hidden in customerMode (passed via prop from PaperForm).
  // ---------------------------------------------------------------------------
  function RailDropToast({ customerMode }) {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
      function onDrop(e) {
        if (customerMode) return;
        const code = e?.detail?.code;
        const scope = e?.detail?.scope;
        const sc = window.OrderFormServiceCodes?.get?.(code);
        const label = sc?.DisplayName || code || 'Service';
        const scopeText = scope === 'order'
          ? 'to order'
          : (scope?.rowId ? 'to row' : '');
        const id = (e?.detail?.ts || Date.now()) + ':' + Math.random().toString(36).slice(2, 6);
        setToasts(prev => [...prev, { id, label, scopeText }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 2400);
      }
      window.addEventListener('railDropSuccess', onDrop);
      return () => window.removeEventListener('railDropSuccess', onDrop);
    }, [customerMode]);

    if (customerMode || toasts.length === 0) return null;
    return (
      <div className="rail-drop-toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="rail-drop-toast">
            <span className="rail-drop-toast-icon" aria-hidden>✓</span>
            <span className="rail-drop-toast-label">{t.label}</span>
            {t.scopeText && <span className="rail-drop-toast-scope">{t.scopeText}</span>}
          </div>
        ))}
      </div>
    );
  }

  window.OrderFormRailDropToast = RailDropToast;
})();
