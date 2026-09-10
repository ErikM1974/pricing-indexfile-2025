/**
 * Box Labels — repack station ("Print-in-Box Labels")
 * ---------------------------------------------------
 * Look up a SanMar PO (or ShopWorks work order), arrange the physical boxes
 * with drag & drop / splits, and print the SAME 8.5×11 label receiving prints:
 * rendering goes through shared_components/js/box-label-template.js, data comes
 * from the proxy's shared assembly — so rush, due date, follow-on and method
 * can never differ between a receiving label and a repack label.
 *
 * Data:   GET {API}/api/sanmar-orders/label-data/:id?type=po|wo
 *         (same order shape as /inbound-today; ?refresh=1 bypasses its cache)
 * Print:  BoxLabelTemplate.renderLabel(...) + printSheet() → window.print()
 * State:  LOCAL ONLY. This station describes how a human just repacked
 *         physical boxes; the arrangement is a localStorage draft (24h),
 *         deliberately never written to Caspio (quota + no reader for it).
 *         Order-level fields are re-pulled at print time so a label never
 *         carries a stale rush/due — boxes keep the human arrangement.
 */

(function () {
  'use strict';

  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || '';
  if (!API_BASE) console.error('[box-labels] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

  // ── State ──
  // box: { key, po, source:'SanMar'|'Custom', trackingNumber, carrier, shipmentDate,
  //        items:[{style,title,color,size,qty}], verified, verifiedBy }
  const state = { identifier: '', type: 'po', orders: [], boxes: [], loadedAt: 0 };
  let sortables = [];
  let splitCtx = null;        // { fromKey, itemIdx }
  let draftTimer = null;
  let pendingDraft = null;
  let lookupGeneration = 0;
  let lookupPending = false;
  let printBusy = false;
  let printTimer = null;
  let printButtonContent = null;
  let splitReturn = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtNum(v) { return Math.round(Number(v) || 0).toLocaleString('en-US'); }
  function todayShort() {
    const n = new Date();
    return `${n.getMonth() + 1}-${n.getDate()}-${String(n.getFullYear()).slice(-2)}`;
  }

  // ── DOM ──
  const els = {};
  function grab(id) { return document.getElementById(id); }
  function initDomRefs() {
    ['searchInput', 'lookupBtn', 'repackerName', 'printAllBtn', 'loadingState', 'errorState',
      'errorMessage', 'errorActions', 'errorDismissBtn', 'draftNote', 'draftNoteText', 'draftResetBtn',
      'totalsBar', 'totalBoxed', 'totalShipped', 'totalOrdered', 'shortShipWarning',
      'mainContent', 'ordersContainer', 'orderReference', 'expandAllBtn', 'storageNotice', 'lookupHint',
      'splitModal', 'splitModalTitle', 'splitModalSubtitle', 'splitModalBody',
      'splitCancelBtn', 'splitConfirmBtn'].forEach(id => { els[id] = grab(id); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDomRefs();
    els.repackerName.value = readLocal('bl_repacker_name') || '';
    if (!window.BoxLabelTemplate) {
      // The shared renderer didn't load — nothing on this page can work without it.
      showError('box-label-template.js didn\'t load — refresh the page. Labels can\'t render without it.');
      els.lookupBtn.disabled = true;
      return;
    }
    bindEvents();
    const p = new URLSearchParams(window.location.search);
    const po = p.get('po'), wo = p.get('wo');
    if (po || wo) {
      els.searchInput.value = po || wo;
      document.querySelector(`input[name="searchType"][value="${po ? 'po' : 'wo'}"]`).checked = true;
      handleLookup();
    }
  });

  function bindEvents() {
    els.lookupBtn.addEventListener('click', handleLookup);
    els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLookup(); });
    els.printAllBtn.addEventListener('click', () => printLabels(null));
    els.expandAllBtn.addEventListener('click', toggleExpandAll);
    els.repackerName.addEventListener('change', () => writeLocal('bl_repacker_name', els.repackerName.value.trim()));
    window.addEventListener('pagehide', flushDraft);
    window.addEventListener('afterprint', finishPrinting);
    els.splitModal.addEventListener('cancel', e => { e.preventDefault(); closeSplitModal(); });
    els.splitModal.addEventListener('keydown', trapSplitFocus);
    els.errorDismissBtn.addEventListener('click', hideError);
    els.draftResetBtn.addEventListener('click', resetDraft);
    els.splitCancelBtn.addEventListener('click', closeSplitModal);
    els.splitConfirmBtn.addEventListener('click', confirmSplit);
    // Delegated clicks for everything rendered per-lookup.
    els.ordersContainer.addEventListener('click', onOrdersClick);
  }

  // ── Lookup ──
  async function handleLookup() {
    if (printBusy) return;
    const identifier = els.searchInput.value.trim();
    if (!identifier) { els.searchInput.focus(); return; }
    const type = document.querySelector('input[name="searchType"]:checked').value;
    flushDraft();
    closeSplitModal();
    const generation = ++lookupGeneration;
    lookupPending = true;
    state.orders = []; state.boxes = []; state.identifier = ''; state.loadedAt = 0;
    sortables.forEach(s => s.destroy()); sortables = [];
    els.ordersContainer.replaceChildren(); els.orderReference.replaceChildren();
    els.printAllBtn.disabled = true;
    els.lookupHint.hidden = true;
    showLoading(true); hideError(); hideDraftNote();
    try {
      const data = await fetchLabelData(identifier, type, false);
      if (generation !== lookupGeneration) return;
      if (!Array.isArray(data.orders)) throw new Error('Shipment response is not a list');
      state.identifier = identifier;
      state.type = type;
      state.orders = data.orders;
      state.loadedAt = Date.now();
      state.boxes = buildBoxesFromOrders(state.orders);
      if (!state.orders.length) {
        showError(data.note || `Nothing found for ${identifier}.`);
      } else {
        maybeRestoreDraft();
        fetchThumbnails(state.orders);
      }
      lookupPending = false;
      renderAll();
    } catch (err) {
      if (generation !== lookupGeneration) return;
      showError(`Lookup failed: ${err.message}`);
    } finally {
      if (generation === lookupGeneration) { lookupPending = false; showLoading(false); }
    }
  }

  async function fetchLabelData(identifier, type, refresh) {
    const url = `${API_BASE}/api/sanmar-orders/label-data/${encodeURIComponent(identifier)}?type=${type}${refresh ? '&refresh=1' : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.details || err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  function buildBoxesFromOrders(orders) {
    const boxes = [];
    for (const o of orders) {
      if (o.boxDetailAvailable && o.boxDetail && o.boxDetail.length) {
        o.boxDetail.forEach((b, i) => boxes.push({
          key: `${o.sanmarPO}#${i + 1}`, po: o.sanmarPO, source: 'SanMar',
          trackingNumber: b.trackingNumber || '', carrier: b.carrier || '', shipmentDate: b.shipmentDate || '',
          items: (b.items || []).map(it => ({ style: it.style || '', title: it.title || '', color: it.color || '', size: it.size || '', qty: it.qty || 0 })),
          verified: false, verifiedBy: '',
        }));
      } else {
        // No live box feed — one synthesized box from the PO lines (same rule the
        // receiving labels use). The repacker can split it into real boxes here.
        boxes.push({
          key: `${o.sanmarPO}#1`, po: o.sanmarPO, source: 'SanMar',
          trackingNumber: o.tracking || '', carrier: o.carrier || '', shipmentDate: o.shipDate || '',
          items: (o.lines || []).map(l => ({ style: l.style || '', title: l.title || '', color: l.color || '', size: l.size || '', qty: l.qtyShipped || l.qtyOrdered || 0 }))
            .filter(it => it.qty > 0),
          verified: false, verifiedBy: '',
        });
      }
    }
    return boxes;
  }

  // Best-effort design artwork for the label (same endpoint the inbound board uses).
  async function fetchThumbnails(orders) {
    const ids = [...new Set(orders.map(o => o.designNumber).filter(Boolean))];
    if (!ids.length) return;
    try {
      const resp = await fetch(`${API_BASE}/api/thumbnails/by-designs?ids=${encodeURIComponent(ids.join(','))}`);
      if (!resp.ok) return; // label falls back to "No artwork on file"
      const data = await resp.json();
      const map = (data && data.thumbnails) || {};
      for (const o of orders) { if (o.designNumber && map[o.designNumber]) o.logoUrl = map[o.designNumber]; }
    } catch (e) { /* artwork is best-effort; the label says "No artwork on file" */ }
  }

  // ── Draft (localStorage, 24h) ──
  function draftKey() { return `bl_draft_v2_${state.type}_${state.identifier.toUpperCase()}`; }
  function storageUnavailable() {
    els.storageNotice.textContent = 'Local saving is unavailable. Keep this page open until you finish; your box arrangement may not be available after closing it.';
    els.storageNotice.hidden = false;
  }
  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (error) { storageUnavailable(); return null; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { storageUnavailable(); }
  }
  function flushDraft() {
    clearTimeout(draftTimer);
    if (!pendingDraft) return;
    const draft = pendingDraft; pendingDraft = null;
    writeLocal(draft.key, draft.value);
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    if (!state.identifier) return;
    pendingDraft = { key: draftKey(), value: JSON.stringify({ savedAt: Date.now(), boxes: state.boxes }) };
    draftTimer = setTimeout(flushDraft, 300);
  }
  function maybeRestoreDraft() {
    let draft = null;
    try { draft = JSON.parse(readLocal(draftKey()) || 'null'); } catch (e) { draft = null; }
    if (!draft || !Array.isArray(draft.boxes) || (Date.now() - (draft.savedAt || 0)) > DRAFT_TTL_MS) return;
    const pos = new Set(state.orders.map(o => o.sanmarPO));
    const boxes = draft.boxes.filter(b => b && pos.has(b.po) && Array.isArray(b.items));
    if (!boxes.length) return;
    state.boxes = boxes;
    els.draftNoteText.textContent = `Restored your box arrangement from ${new Date(draft.savedAt).toLocaleString()} — SanMar's original cartons are one click away.`;
    els.draftNote.hidden = false;
  }
  function resetDraft() {
    if (printBusy || lookupPending) return;
    clearTimeout(draftTimer); pendingDraft = null;
    try { localStorage.removeItem(draftKey()); } catch (e) { storageUnavailable(); }
    state.boxes = buildBoxesFromOrders(state.orders);
    hideDraftNote();
    renderAll();
  }
  function hideDraftNote() { els.draftNote.hidden = true; }

  // ── Rendering ──
  function orderBoxes(po) { return state.boxes.filter(b => b.po === po); }
  function boxByKey(key) { return state.boxes.find(b => b.key === key); }
  function boxPieces(b) { return b.items.reduce((t, it) => t + (it.qty || 0), 0); }

  function renderAll() {
    const focus = captureBoxFocus();
    if (!state.orders.length) {
      els.mainContent.hidden = true;
      els.totalsBar.hidden = true;
      els.printAllBtn.disabled = true;
      return;
    }
    els.ordersContainer.innerHTML = state.orders.map(renderOrderGroup).join('');
    els.orderReference.innerHTML = state.orders.map(renderOrderReference).join('');
    els.mainContent.hidden = false;
    renderTotals();
    initDragDrop();
    els.printAllBtn.disabled = printBusy || !state.boxes.some(b => b.items.length);
    els.expandAllBtn.textContent = "Collapse All";
    setPrintBusy(printBusy);
    restoreBoxFocus(focus);
    saveDraft();
  }

  function renderOrderGroup(o) {
    const T = window.BoxLabelTemplate;
    const rush = T.rushText(o);
    const follow = T.followOnText(o);
    const boxes = orderBoxes(o.sanmarPO);
    return `
      <section class="bl-order" data-po="${esc(o.sanmarPO)}">
        <div class="bl-order__head" style="border-left-color:${T.METHOD_DARK[o.method] || '#444'}">
          <div class="bl-order__title">
            <span class="bl-order__company">${esc(o.company || `SanMar PO ${o.sanmarPO}`)}</span>
            <span class="bl-order__meta">WO# ${esc(o.workOrder || '?')} · PO ${esc(o.sanmarPO)} · ${esc(o.method || 'Other')}${o.dueDate ? ` · Due ${esc(o.dueDate)}` : ''}${o.salesRep ? ` · Rep ${esc(o.salesRep)}` : ''}</span>
          </div>
          <div class="bl-order__flags">
            ${rush ? `<span class="bl-rush-chip${o.pastDue ? ' bl-rush-chip--past' : ''}">⚡ ${esc(rush)}</span>` : ''}
            ${follow ? `<span class="bl-follow-chip">↩ ${esc(follow)}</span>` : ''}
            ${o.received && !o.followOnShipment ? `<span class="bl-received-chip">✓ Counted in${o.receivedDate ? ' ' + esc(o.receivedDate) : ''}</span>` : ''}
            ${!o.workOrder ? `<span class="bl-nowo-chip" title="No ShopWorks work order linked to this PO yet — the label prints WO '?'. Try the Work Order# lookup if you know it.">No WO linked</span>` : ''}
          </div>
        </div>
        ${boxes.map((b, i) => renderBoxCard(b, i + 1, boxes.length)).join('') || '<div class="bl-box-empty">No boxes on this PO</div>'}
        <button class="btn btn-secondary bl-btn bl-btn--small bl-btn--primary" data-act="add-box" data-po="${esc(o.sanmarPO)}">+ New Box</button>
      </section>`;
  }

  function renderBoxCard(b, posNo, posTotal) {
    const pcs = boxPieces(b);
    return `
      <div class="bl-box-card bl-box-card--expanded ${b.verified ? 'bl-box-card--verified' : ''}" data-key="${esc(b.key)}">
        <div class="bl-box-card__header">
          <button class="bl-box-card__title" data-act="toggle-box" aria-expanded="true" aria-controls="box-body-${esc(b.key)}">
            <div class="bl-box-card__number">${posNo}</div>
            <div class="bl-box-card__info">
              <div class="bl-box-card__label">Box ${posNo} of ${posTotal}
                <span class="bl-box-card__tag bl-box-card__tag--${b.source.toLowerCase()}">${esc(b.source)}</span>
              </div>
              <div class="bl-box-card__meta">
                ${b.trackingNumber ? `<span>${esc(b.carrier || '')} ${esc(b.trackingNumber)}</span>` : ''}
                <span>${b.items.length} line${b.items.length !== 1 ? 's' : ''}</span>
                <span>${fmtNum(pcs)} pcs</span>
              </div>
            </div>
          </button>
          <div class="bl-box-card__right">
            <button class="btn btn-secondary bl-box-card__verify ${b.verified ? 'bl-box-card__verify--checked' : ''}" data-act="verify" title="Mark contents checked" aria-pressed="${b.verified ? 'true' : 'false'}">
              ${b.verified ? '&#10003; Verified' : '&#9744; Verify'}
            </button>
            <span class="bl-box-card__chevron">&#9660;</span>
          </div>
        </div>
        <div class="bl-box-card__body" id="box-body-${esc(b.key)}">
          <div class="bl-item-list bl-droppable" data-key="${esc(b.key)}">
            ${b.items.map((it, i) => renderItemCard(it, i)).join('') || '<div class="bl-box-empty">Drop items here</div>'}
          </div>
          <div class="bl-box-card__actions">
            <button class="btn btn-secondary bl-btn bl-btn--small bl-btn--outline" data-act="print-box">&#128438; Print this box</button>
            <button class="btn btn-secondary bl-btn bl-btn--small bl-btn--danger" data-act="delete-box" ${b.items.length ? 'disabled title="Move all items out first"' : ''}>Delete Box</button>
          </div>
        </div>
      </div>`;
  }

  function renderItemCard(it, idx) {
    return `
      <div class="bl-item-card" data-idx="${idx}">
        <div class="bl-item-card__header">
          <div>
            <div class="bl-item-card__style">${esc(it.style)}${it.size ? ` <span class="bl-size-chip">${esc(it.size)}</span>` : ''}</div>
            <div class="bl-item-card__color">${esc(it.color || '—')}</div>
          </div>
          <div class="bl-item-card__qty">${fmtNum(it.qty)} pcs</div>
        </div>
        ${it.title ? `<div class="bl-item-card__desc">${esc(it.title)}</div>` : ''}
        ${it.qty > 0 ? `<button class="btn btn-secondary bl-btn bl-btn--small bl-btn--outline bl-item-card__split" data-act="split">${it.qty > 1 ? 'Split to another box' : 'Move to another box'}</button>` : ''}
      </div>`;
  }

  function renderOrderReference(o) {
    const rows = (o.lines || []).map(l => `
      <tr>
        <td>${esc(l.style)}</td><td>${esc(l.color || '—')}</td><td>${esc(l.size || '—')}</td>
        <td class="bl-num">${fmtNum(l.qtyOrdered)}</td><td class="bl-num">${fmtNum(l.qtyShipped)}</td>
      </tr>`).join('');
    return `
      <div class="bl-ref">
        <div class="bl-ref__head">PO ${esc(o.sanmarPO)} — SanMar order lines</div>
        ${rows ? `<table class="bl-ref__table"><thead><tr><th>Style</th><th>Color</th><th>Size</th><th class="bl-num">Ord</th><th class="bl-num">Shp</th></tr></thead><tbody>${rows}</tbody></table>`
          : '<div class="bl-box-empty">No line detail on file</div>'}
      </div>`;
  }

  function renderTotals() {
    const boxed = state.boxes.reduce((t, b) => t + boxPieces(b), 0);
    const shipped = state.orders.reduce((t, o) => t + (o.piecesShipped || 0), 0);
    const ordered = state.orders.reduce((t, o) => t + (o.piecesOrdered || 0), 0);
    els.totalBoxed.textContent = fmtNum(boxed);
    els.totalShipped.textContent = fmtNum(shipped);
    els.totalOrdered.textContent = fmtNum(ordered);
    els.shortShipWarning.hidden = !(ordered > 0 && shipped < ordered);
    els.totalsBar.hidden = false;
  }

  function captureBoxFocus() {
    const control = document.activeElement?.closest('[data-act]');
    if (!control) return null;
    return { act: control.dataset.act, key: control.closest('.bl-box-card')?.dataset.key, index: control.closest('.bl-item-card')?.dataset.idx, po: control.dataset.po };
  }
  function restoreBoxFocus(focus) {
    if (!focus) return;
    let container = focus.key ? document.querySelector(`.bl-box-card[data-key="${CSS.escape(focus.key)}"]`) : els.ordersContainer;
    if (focus.index !== undefined) container = container?.querySelector(`.bl-item-card[data-idx="${CSS.escape(focus.index)}"]`);
    const control = container?.querySelector(`[data-act="${CSS.escape(focus.act)}"]${focus.po ? '[data-po="' + CSS.escape(focus.po) + '"]' : ''}`);
    if (control && !control.disabled) control.focus({ preventScroll: true });
  }
  function setExpanded(card, expanded) {
    card.classList.toggle('bl-box-card--expanded', expanded);
    card.querySelector('[data-act="toggle-box"]').setAttribute('aria-expanded', String(expanded));
    card.querySelector('.bl-box-card__body').hidden = !expanded;
  }
  function clearVerification(...boxes) {
    boxes.forEach(box => { box.verified = false; box.verifiedBy = ''; });
  }
  function trapSplitFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...els.splitModal.querySelectorAll('button,input,select')].filter(n => !n.disabled && n.getClientRects().length);
    if ((event.shiftKey && document.activeElement === controls[0]) || (!event.shiftKey && document.activeElement === controls.at(-1))) {
      event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0]).focus();
    }
  }

  // ── Interactions (delegated) ──
  function onOrdersClick(e) {
    if (printBusy || lookupPending) return;
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const card = e.target.closest('.bl-box-card');
    const key = card && card.getAttribute('data-key');
    if (act === 'toggle-box') { setExpanded(card, !card.classList.contains('bl-box-card--expanded')); return; }
    if (act === 'add-box') { addBox(btn.getAttribute('data-po')); return; }
    if (!key) return;
    if (act === 'verify') { const b = boxByKey(key); b.verified = !b.verified; b.verifiedBy = b.verified ? repacker() : ''; renderAll(); }
    if (act === 'delete-box') { deleteBox(key); }
    if (act === 'print-box') { printLabels(key); }
    if (act === 'split') {
      const itemEl = e.target.closest('.bl-item-card');
      openSplitModal(key, parseInt(itemEl.getAttribute('data-idx'), 10));
    }
  }

  function toggleExpandAll() {
    if (printBusy || lookupPending) return;
    const cards = [...document.querySelectorAll('.bl-box-card')];
    const expand = !cards.every(c => c.classList.contains('bl-box-card--expanded'));
    cards.forEach(c => setExpanded(c, expand));
    els.expandAllBtn.textContent = expand ? 'Collapse All' : 'Expand All';
  }

  function addBox(po) {
    const n = orderBoxes(po).length + 1;
    state.boxes.push({ key: `${po}#custom${Date.now()}`, po, source: 'Custom', trackingNumber: '', carrier: '', shipmentDate: '', items: [], verified: false, verifiedBy: '' });
    renderAll();
  }

  function deleteBox(key) {
    const b = boxByKey(key);
    if (!b || b.items.length) return;
    state.boxes = state.boxes.filter(x => x.key !== key);
    renderAll();
  }

  function repacker() { return els.repackerName.value.trim(); }

  // ── Drag & drop ──
  function initDragDrop() {
    sortables.forEach(s => s.destroy());
    sortables = [];
    if (typeof window.Sortable !== "function") return;
    document.querySelectorAll('.bl-item-list.bl-droppable').forEach(list => {
      sortables.push(new window.Sortable(list, {
        group: 'bl-items', animation: 150, handle: '.bl-item-card', disabled: printBusy,
        filter: 'button', preventOnFilter: false,
        ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', chosenClass: 'sortable-chosen',
        onEnd: (evt) => {
          if (printBusy || lookupPending) { renderAll(); return; }
          const fromKey = evt.from.getAttribute('data-key');
          const toKey = evt.to.getAttribute('data-key');
          if (fromKey === toKey) return;
          const from = boxByKey(fromKey), to = boxByKey(toKey);
          if (!from || !to) return;
          if (from.po !== to.po) {
            // A label prints per PO/work order — items can't hop orders.
            showError('Items can only move between boxes of the same PO — each label belongs to one work order.');
            renderAll();
            return;
          }
          const [moved] = from.items.splice(evt.oldIndex, 1);
          if (moved) { to.items.splice(Math.min(evt.newIndex, to.items.length), 0, moved); clearVerification(from, to); }
          renderAll();
        },
      }));
    });
  }

  // ── Split modal ──
  function openSplitModal(fromKey, itemIdx) {
    const from = boxByKey(fromKey);
    const it = from && from.items[itemIdx];
    if (!it) return;
    splitCtx = { fromKey, itemIdx };
    splitReturn = captureBoxFocus();
    const targets = orderBoxes(from.po).filter(b => b.key !== fromKey);
    els.splitModalTitle.textContent = 'Split to another box';
    els.splitModalSubtitle.innerHTML = `<strong>${esc(it.style)} ${esc(it.size || '')} — ${esc(it.color || '')}</strong> · ${fmtNum(it.qty)} pcs in this box`;
    els.splitModalBody.innerHTML = `
      <div class="bl-split-row">
        <label for="splitQty">Move</label>
        <input class="field-input" type="number" id="splitQty" min="1" max="${it.qty}" value="1"> of ${fmtNum(it.qty)} pcs
      </div>
      <div class="bl-split-row">
        <label for="splitTarget">To</label>
        <select id="splitTarget" class="field-input">
          ${targets.map(b => `<option value="${esc(b.key)}">Box ${orderBoxes(from.po).indexOf(b) + 1}${b.trackingNumber ? ` (${esc(b.trackingNumber)})` : ''}</option>`).join('')}
          <option value="__new__">＋ New box</option>
        </select>
      </div>`;
    els.splitModal.showModal();
    grab('splitQty').focus();
  }

  function closeSplitModal() {
    if (els.splitModal.open) els.splitModal.close();
    splitCtx = null;
    restoreBoxFocus(splitReturn); splitReturn = null;
  }

  function confirmSplit() {
    if (printBusy || lookupPending) return;
    if (!splitCtx) return closeSplitModal();
    if (!grab("splitQty").reportValidity()) return;
    const from = boxByKey(splitCtx.fromKey);
    const it = from && from.items[splitCtx.itemIdx];
    if (!it) return closeSplitModal();
    const qty = Math.min(Math.max(parseInt(grab('splitQty').value, 10) || 0, 1), it.qty);
    let targetKey = grab('splitTarget').value;
    if (targetKey === '__new__') {
      const key = `${from.po}#custom${Date.now()}`;
      state.boxes.push({ key, po: from.po, source: 'Custom', trackingNumber: '', carrier: '', shipmentDate: '', items: [], verified: false, verifiedBy: '' });
      targetKey = key;
    }
    const to = boxByKey(targetKey);
    if (!to) return closeSplitModal();
    if (qty >= it.qty) {
      from.items.splice(splitCtx.itemIdx, 1);
      to.items.push(it);
    } else {
      it.qty -= qty;
      const existing = to.items.find(x => x.style === it.style && x.color === it.color && x.size === it.size && x.title === it.title);
      if (existing) existing.qty += qty;
      else to.items.push({ style: it.style, title: it.title, color: it.color, size: it.size, qty });
    }
    clearVerification(from, to);
    closeSplitModal();
    renderAll();
  }

  // ── Printing ──
  function makeQr(po) {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(`${window.location.origin}/pages/box-labels.html?po=${encodeURIComponent(po)}`);
      qr.make();
      return qr.createDataURL(4, 0);
    } catch (e) { return null; } // label simply prints without a QR
  }

  // Re-pull order-level fields right before printing so the label never carries a stale
  // rush/due (same stance as the receiving sheets' syncBeforeOutput) — but the BOXES stay
  // exactly as arranged: they describe what a human just physically packed.
  function setPrintBusy(busy) {
    if (busy && !printBusy) printButtonContent = els.printAllBtn.innerHTML;
    printBusy = busy;
    els.lookupBtn.disabled = busy;
    els.searchInput.disabled = busy;
    els.repackerName.disabled = busy;
    document.querySelectorAll('input[name="searchType"]').forEach(n => { n.disabled = busy; });
    els.draftResetBtn.disabled = busy;
    els.expandAllBtn.disabled = busy;
    els.printAllBtn.disabled = busy || lookupPending || !state.boxes.some(b => b.items.length);
    els.ordersContainer.querySelectorAll('button').forEach(button => {
      const box = boxByKey(button.closest('.bl-box-card')?.dataset.key);
      button.disabled = busy || (button.dataset.act === 'delete-box' && Boolean(box?.items.length));
    });
    sortables.forEach(sortable => sortable.option('disabled', busy));
  }

  function finishPrinting() {
    clearTimeout(printTimer);
    if (printButtonContent !== null) { els.printAllBtn.innerHTML = printButtonContent; printButtonContent = null; }
    setPrintBusy(false);
  }

  async function freshenOrders(generation) {
    const orders = state.orders;
    const data = await fetchLabelData(state.identifier, state.type, true);
    if (generation !== lookupGeneration) return false;
    if (!Array.isArray(data.orders)) throw new Error('Shipment response is not a list');
    const byPo = new Map(data.orders.map(o => [o.sanmarPO, o]));
    if (orders.some(o => !byPo.has(o.sanmarPO))) throw new Error('The refreshed response did not include every order');
    state.orders = orders.map(o => Object.assign({}, byPo.get(o.sanmarPO), { logoUrl: o.logoUrl || byPo.get(o.sanmarPO).logoUrl }));
    state.loadedAt = Date.now();
    return true;
  }

  async function printLabels(onlyKey) {
    if (lookupPending || printBusy || !state.identifier) return;
    const generation = lookupGeneration;
    hideError();
    setPrintBusy(true);
    els.printAllBtn.textContent = 'Re-checking order…';
    try {
      if (!await freshenOrders(generation)) { finishPrinting(); return; }
      renderAll();
    } catch (err) {
      finishPrinting();
      if (generation !== lookupGeneration) return;
      showError(`Couldn't re-check the order before printing (${err.message}). The rush/due info on the label may be out of date.`,
        [{ label: 'Print anyway', onClick: () => {
          if (generation !== lookupGeneration || lookupPending || printBusy) return;
          hideError(); setPrintBusy(true); doPrint(onlyKey);
        } }]);
      return;
    }
    doPrint(onlyKey);
  }

  function doPrint(onlyKey) {
    const T = window.BoxLabelTemplate;
    const printedOn = todayShort();
    const repackedBy = repacker();
    const pieces = [];
    for (const o of state.orders) {
      const boxes = orderBoxes(o.sanmarPO).filter(b => b.items.length);
      const qrUrl = makeQr(o.sanmarPO);
      boxes.forEach((b, i) => {
        if (onlyKey && b.key !== onlyKey) return;
        pieces.push(T.renderLabel(o, { items: b.items, trackingNumber: b.trackingNumber, carrier: b.carrier }, i + 1, boxes.length, {
          printedOn,
          repackedBy: repackedBy || undefined,
          qr: qrUrl ? { dataUrl: qrUrl, hint: 'Scan → reprint labels' } : undefined,
        }));
      });
    }
    if (!pieces.length) { finishPrinting(); showError('Nothing to print — every box is empty.'); return; }
    clearTimeout(printTimer);
    printTimer = setTimeout(finishPrinting, 1600);
    T.printSheet(pieces.join(''));
  }

  // ── UI chrome ──
  function showLoading(on) {
    els.loadingState.hidden = !on;
    if (on) { els.mainContent.hidden = true; els.totalsBar.hidden = true; }
  }
  function showError(msg, actions) {
    els.errorMessage.textContent = msg;
    els.errorActions.innerHTML = '';
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn btn-secondary bl-btn bl-btn--danger';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      els.errorActions.appendChild(b);
    });
    els.errorState.hidden = false;
  }
  function hideError() { els.errorState.hidden = true; els.errorActions.innerHTML = ''; }
})();
