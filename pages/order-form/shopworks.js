// Online Order Form — ShopWorks submit client (browser side).
// Sends the form state to the NWCA backend at POST /api/submit-order-form.
// The backend mirrors the 3-Day Tees flow: builds the camelCase ManageOrders payload
// and forwards to caspio-pricing-proxy's /api/manageorders/orders/create, which
// handles token auth, size-suffix translation (PC54_2X, etc.), tax flags, and MM/DD/YYYY date format.
//
// Mock mode: if the backend is unreachable (offline/dev), we stash the payload in
// localStorage.nw.shopworks.pending + console so Claude Code can inspect it.

window.nwOrderAPI = (function () {
  const SUBMIT_URL = '/api/submit-order-form';
  const DRAFT_URL  = '/api/order-form-drafts';
  const PUBLIC_QUOTE_URL = '/api/public/quote/';

  function serializableRow(r) {
    return {
      id: r.id,
      style: r.style || '',
      desc: r.desc || '',
      color: r.color || '',
      colorName: r.colorName || '',
      catalogColor: r.catalogColor || '',
      deco: r.deco || '',
      sizes: r.sizes || {},
      otherSize: r.otherSize || '',
      price: r.price || ''
    };
  }

  function serializableFile(f) {
    // Only persist hosted URLs — base64 previews can't be sent to ShopWorks.
    return {
      id: String(f.id || ''),
      name: f.name || 'file',
      size: f.size || 0,
      hostedUrl: f.hostedUrl || '',
      preview: f.preview && /^https?:/i.test(f.preview) ? f.preview : '',
      placements: f.placements || [],
      designNo: f.designNo || '',
      colors: f.colors || ''
    };
  }

  function buildBody(order, extras) {
    const { info, rows, ship, orderNotes, files } = order;
    return {
      info: { ...info },
      rows: (rows || []).map(serializableRow),
      ship: { ...ship },
      orderNotes: orderNotes || '',
      files: (files || []).map(serializableFile),
      ...(extras || {})
    };
  }

  async function submitOrder(order) {
    const draftId = order.draftId || null;
    const body = buildBody(order, draftId ? { draftId } : {});

    try {
      const r = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.success) {
        return { ok: true, mode: json.mode || 'live', orderId: json.extOrderId, shopWorksId: json.shopWorksId || null };
      }
      return { ok: false, error: json.error || `HTTP ${r.status}`, detail: json.detail };
    } catch (err) {
      // Network failure — fall back to mock mode so the staff can still see what would be sent.
      console.warn('[OrderForm] Backend unreachable, falling back to mock mode:', err.message);
      const key = 'nw.shopworks.pending';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const extOrderId = draftId || `WEB-OF-${Date.now()}`;
      list.push({ extOrderId, body, createdAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
      console.group('[OrderForm mock] would-submit payload');
      console.log(JSON.stringify(body, null, 2));
      console.groupEnd();
      return { ok: true, mode: 'mock', orderId: extOrderId };
    }
  }

  async function saveDraft(order) {
    const body = buildBody(order);
    const r = await fetch(DRAFT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json.success) throw new Error(json.error || `HTTP ${r.status}`);
    return json; // { success, draftId }
  }

  async function loadDraft(draftId) {
    const safe = String(draftId || '').trim();
    if (!/^OF-\d+$/.test(safe)) throw new Error('Invalid draft ID format');
    const r = await fetch(PUBLIC_QUOTE_URL + encodeURIComponent(safe));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const session = json && json.session;
    if (!session) throw new Error('Draft not found');
    let parsed = {};
    try { parsed = JSON.parse(session.Notes || '{}'); } catch (e) { parsed = {}; }
    return {
      draftId: safe,
      status: session.Status || 'Draft',
      info: parsed.info || {},
      rows: parsed.rows || [],
      ship: parsed.ship || {},
      orderNotes: parsed.orderNotes || '',
      files: parsed.files || [],
      staffFilled: parsed.staffFilled || []
    };
  }

  // Always live against our backend — no browser-side ManageOrders creds needed.
  return { submitOrder, saveDraft, loadDraft, isLive: true };
})();
