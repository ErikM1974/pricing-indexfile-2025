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
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

  // ── State ──
  // box: { key, po, source:'SanMar'|'Custom', trackingNumber, carrier, shipmentDate,
  //        items:[{style,title,color,size,qty}], verified, verifiedBy }
  const state = { identifier: '', type: 'po', orders: [], boxes: [], loadedAt: 0 };
  let sortables = [];
  let splitCtx = null;        // { fromKey, itemIdx }
  let draftTimer = null;

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
      'mainContent', 'ordersContainer', 'orderReference', 'expandAllBtn',
      'splitModal', 'splitModalTitle', 'splitModalSubtitle', 'splitModalBody',
      'splitCancelBtn', 'splitConfirmBtn'].forEach(id => { els[id] = grab(id); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDomRefs();
    els.repackerName.value = localStorage.getItem('bl_repacker_name') || '';
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
    els.repackerName.addEventListener('change', () => localStorage.setItem('bl_repacker_name', els.repackerName.value.trim()));
    els.errorDismissBtn.addEventListener('click', hideError);
    els.draftResetBtn.addEventListener('click', resetDraft);
    els.splitCancelBtn.addEventListener('click', closeSplitModal);
    els.splitConfirmBtn.addEventListener('click', confirmSplit);
    // Delegated clicks for everything rendered per-lookup.
    els.ordersContainer.addEventListener('click', onOrdersClick);
  }

  // ── Lookup ──
  async function handleLookup() {
    const identifier = els.searchInput.value.trim();
    if (!identifier) { els.searchInput.focus(); return; }
    const type = document.querySelector('input[name="searchType"]:checked').value;

    showLoading(true); hideError(); hideDraftNote();
    try {
      const data = await fetchLabelData(identifier, type, false);
      state.identifier = identifier;
      state.type = type;
      state.orders = data.orders || [];
      state.loadedAt = Date.now();
      state.boxes = buildBoxesFromOrders(state.orders);
      if (!state.orders.length) {
        showError(data.note || `Nothing found for ${identifier}.`);
      } else {
        maybeRestoreDraft();
        fetchThumbnails(state.orders); // best-effort artwork for the labels
      }
      renderAll();
    } catch (err) {
      showError(`Lookup failed: ${err.message}`);
    } finally {
      showLoading(false);
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
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(), JSON.stringify({ savedAt: Date.now(), boxes: state.boxes }));
      } catch (e) { /* storage full — the arrangement still lives on screen */ }
    }, 300);
  }
  function maybeRestoreDraft() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) { draft = null; }
    if (!draft || !Array.isArray(draft.boxes) || (Date.now() - (draft.savedAt || 0)) > DRAFT_TTL_MS) return;
    const pos = new Set(state.orders.map(o => o.sanmarPO));
    const boxes = draft.boxes.filter(b => b && pos.has(b.po) && Array.isArray(b.items));
    if (!boxes.length) return;
    state.boxes = boxes;
    els.draftNoteText.textContent = `Restored your box arrangement from ${new Date(draft.savedAt).toLocaleString()} — SanMar's original cartons are one click away.`;
    els.draftNote.style.display = 'flex';
  }
  function resetDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) { /* nothing to lose */ }
    state.boxes = buildBoxesFromOrders(state.orders);
    hideDraftNote();
    renderAll();
  }
  function hideDraftNote() { els.draftNote.style.display = 'none'; }

  // ── Rendering ──
  function orderBoxes(po) { return state.boxes.filter(b => b.po === po); }
  function boxByKey(key) { return state.boxes.find(b => b.key === key); }
  function boxPieces(b) { return b.items.reduce((t, it) => t + (it.qty || 0), 0); }

  function renderAll() {
    if (!state.orders.length) {
      els.mainContent.style.display = 'none';
      els.totalsBar.style.display = 'none';
      els.printAllBtn.disabled = true;
      return;
    }
    els.ordersContainer.innerHTML = state.orders.map(renderOrderGroup).join('');
    els.orderReference.innerHTML = state.orders.map(renderOrderReference).join('');
    els.mainContent.style.display = 'flex';
    renderTotals();
    initDragDrop();
    els.printAllBtn.disabled = !state.boxes.some(b => b.items.length);
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
        <button class="bl-btn bl-btn--small bl-btn--primary" data-act="add-box" data-po="${esc(o.sanmarPO)}">+ New Box</button>
      </section>`;
  }

  function renderBoxCard(b, posNo, posTotal) {
    const pcs = boxPieces(b);
    return `
      <div class="bl-box-card bl-box-card--expanded ${b.verified ? 'bl-box-card--verified' : ''}" data-key="${esc(b.key)}">
        <div class="bl-box-card__header" data-act="toggle-box">
          <div class="bl-box-card__title">
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
          </div>
          <div class="bl-box-card__right">
            <button class="bl-box-card__verify ${b.verified ? 'bl-box-card__verify--checked' : ''}" data-act="verify" title="Mark contents checked">
              ${b.verified ? '&#10003; Verified' : '&#9744; Verify'}
            </button>
            <span class="bl-box-card__chevron">&#9660;</span>
          </div>
        </div>
        <div class="bl-box-card__body">
          <div class="bl-item-list bl-droppable" data-key="${esc(b.key)}">
            ${b.items.map((it, i) => renderItemCard(it, i)).join('') || '<div class="bl-box-empty">Drop items here</div>'}
          </div>
          <div class="bl-box-card__actions">
            <button class="bl-btn bl-btn--small bl-btn--outline" data-act="print-box">&#128438; Print this box</button>
            <button class="bl-btn bl-btn--small bl-btn--danger" data-act="delete-box" ${b.items.length ? 'disabled title="Move all items out first"' : ''}>Delete Box</button>
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
        ${it.qty > 1 ? `<button class="bl-btn bl-btn--small bl-btn--outline bl-item-card__split" data-act="split">Split to another box</button>` : ''}
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
    els.shortShipWarning.style.display = (ordered > 0 && shipped < ordered) ? 'inline-block' : 'none';
    els.totalsBar.style.display = 'flex';
  }

  // ── Interactions (delegated) ──
  function onOrdersClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const card = e.target.closest('.bl-box-card');
    const key = card && card.getAttribute('data-key');
    if (act === 'toggle-box' && !e.target.closest('button')) { card.classList.toggle('bl-box-card--expanded'); return; }
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
    const cards = [...document.querySelectorAll('.bl-box-card')];
    const expand = !cards.every(c => c.classList.contains('bl-box-card--expanded'));
    cards.forEach(c => c.classList.toggle('bl-box-card--expanded', expand));
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
    document.querySelectorAll('.bl-item-list.bl-droppable').forEach(list => {
      sortables.push(new Sortable(list, {
        group: 'bl-items', animation: 150, handle: '.bl-item-card',
        ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', chosenClass: 'sortable-chosen',
        onEnd: (evt) => {
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
          if (moved) to.items.splice(Math.min(evt.newIndex, to.items.length), 0, moved);
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
    const targets = orderBoxes(from.po).filter(b => b.key !== fromKey);
    els.splitModalTitle.textContent = 'Split to another box';
    els.splitModalSubtitle.innerHTML = `<strong>${esc(it.style)} ${esc(it.size || '')} — ${esc(it.color || '')}</strong> · ${fmtNum(it.qty)} pcs in this box`;
    els.splitModalBody.innerHTML = `
      <div class="bl-split-row">
        <label>Move</label>
        <input type="number" id="splitQty" min="1" max="${it.qty}" value="1"> of ${fmtNum(it.qty)} pcs
      </div>
      <div class="bl-split-row">
        <label>To</label>
        <select id="splitTarget">
          ${targets.map(b => `<option value="${esc(b.key)}">Box ${orderBoxes(from.po).indexOf(b) + 1}${b.trackingNumber ? ` (${esc(b.trackingNumber)})` : ''}</option>`).join('')}
          <option value="__new__">＋ New box</option>
        </select>
      </div>`;
    els.splitModal.style.display = 'flex';
    grab('splitQty').focus();
  }

  function closeSplitModal() { els.splitModal.style.display = 'none'; splitCtx = null; }

  function confirmSplit() {
    if (!splitCtx) return closeSplitModal();
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
    closeSplitModal();
    renderAll();
  }

  // ── Printing ──
  function makeQr(po) {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(`${window.location.origin}/pages/box-labels.html?po=${encodeURIComponent(po)}`);
      qr.make();
      return qr.createDataURL(4, 0);
    } catch (e) { return null; } // label simply prints without a QR
  }

  // Re-pull order-level fields right before printing so the label never carries a stale
  // rush/due (same stance as the receiving sheets' syncBeforeOutput) — but the BOXES stay
  // exactly as arranged: they describe what a human just physically packed.
  async function freshenOrders() {
    const data = await fetchLabelData(state.identifier, state.type, true);
    const byPo = new Map((data.orders || []).map(o => [o.sanmarPO, o]));
    state.orders = state.orders.map(o => {
      const fresh = byPo.get(o.sanmarPO);
      return fresh ? Object.assign({}, fresh, { logoUrl: o.logoUrl || fresh.logoUrl }) : o;
    });
    state.loadedAt = Date.now();
  }

  async function printLabels(onlyKey) {
    const T = window.BoxLabelTemplate;
    hideError();
    const btn = els.printAllBtn;
    const restore = btn.textContent;
    btn.disabled = true; btn.textContent = 'Re-checking order…';
    try {
      await freshenOrders();
      renderAll(); // fresh rush/due chips on screen too
    } catch (err) {
      // Loud, with an explicit escape hatch — never a silent stale label (Rule #4).
      btn.disabled = false; btn.textContent = restore;
      showError(`Couldn't re-check the order before printing (${err.message}). The rush/due info on the label may be out of date.`,
        [{ label: 'Print anyway', onClick: () => { hideError(); doPrint(onlyKey); } }]);
      return;
    }
    btn.disabled = false; btn.textContent = restore;
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
    if (!pieces.length) { showError('Nothing to print — every box is empty.'); return; }
    T.printSheet(pieces.join(''));
  }

  // ── UI chrome ──
  function showLoading(on) {
    els.loadingState.style.display = on ? 'block' : 'none';
    if (on) { els.mainContent.style.display = 'none'; els.totalsBar.style.display = 'none'; }
  }
  function showError(msg, actions) {
    els.errorMessage.textContent = msg;
    els.errorActions.innerHTML = '';
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'bl-btn bl-btn--danger';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      els.errorActions.appendChild(b);
    });
    els.errorState.style.display = 'flex';
  }
  function hideError() { els.errorState.style.display = 'none'; els.errorActions.innerHTML = ''; }
})();
