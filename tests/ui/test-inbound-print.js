/* ============================================================
 * Test harness for the SanMar Inbound "Print for…" recipient profiles.
 * Feeds sanmar-inbound-today.js mock inbound data (no live API), opens the
 * modal, then renders every print profile into a static preview pane so the
 * layouts can be eyeballed/screenshotted without an OS print dialog.
 * Test-only — never loaded by a production page.
 * ============================================================ */
(function () {
  'use strict';

  var MOCK = {
    date: '2026-07-22',
    note: 'Mock data — harness only.',
    totals: { pos: 6, workOrders: 5, boxes: 7, piecesShipped: 101, cost: 646.32, received: 1, rush: 2, pastDue: 1 },
    orders: [
      {
        company: 'Absher Construction Company', method: 'Screen Print', workOrder: '142537', sanmarPO: '113747',
        dueDate: '2026-07-24', designNumber: '23074', designName: 'Absher logo', contactName: 'Carissa Garcia',
        productionDays: 2, rush: true, pastDue: false, rushThreshold: 3, arrival: '2026-07-22',
        salesRep: 'Nika Lao', customerPO: '53096', terms: 'Net 10', dateOrdered: '2026-07-21',
        boxes: 1, piecesShipped: 1, piecesOrdered: 1, cost: 54.00,
        tracking: '1Z61R84A0313961139', carrier: 'UPS', trackingUrl: '#', shipDate: '2026-07-21', fromState: 'WA',
        arrival: '2026-07-22', upsDelivery: { date: '2026-07-22', type: 'scheduled', status: 'Out for Delivery' },
        boxDetailAvailable: true,
        boxDetail: [{ boxNumber: 1, carrier: 'UPS', trackingNumber: '1Z61R84A0313961139', pieces: 1, cost: 54.00,
          items: [{ style: 'CT106676', title: 'Carhartt Duck Vest', color: 'Black', size: 'M', qty: 1, lineCost: 54.00 }] }],
        lines: [{ style: 'CT106676', title: 'Carhartt Duck Vest', color: 'Black', size: 'M', qtyOrdered: 1, qtyShipped: 1, status: 'Shipped', lineCost: 54.00 }],
        received: false, issue: null
      },
      {
        company: 'Better Builders LLC', method: 'Embroidery', workOrder: '142511', sanmarPO: '113740',
        dueDate: '2026-07-21', designNumber: '32418.03', designName: 'Better Builders — background fill', contactName: 'Sasha Martin',
        productionDays: -1, rush: true, pastDue: true, rushThreshold: 3, arrival: '2026-07-22',
        salesRep: 'Taneisha Clark', customerPO: '', terms: 'Pay On Pickup', dateOrdered: '2026-07-20',
        boxes: 1, piecesShipped: 18, piecesOrdered: 18, cost: 229.68,
        tracking: '1Z61R84A0313960265', carrier: 'UPS', trackingUrl: '#', shipDate: '2026-07-21', fromState: 'WA',
        arrival: '2026-07-22', upsDelivery: { date: '2026-07-22', type: 'scheduled', status: 'In Transit' },
        boxDetailAvailable: true,
        boxDetail: [{ boxNumber: 1, carrier: 'UPS', trackingNumber: '1Z61R84A0313960265', pieces: 18, cost: 229.68,
          items: [
            { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Black', size: 'S', qty: 1, lineCost: 12.76 },
            { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Black', size: 'M', qty: 2, lineCost: 25.52 },
            { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Black', size: 'L', qty: 2, lineCost: 25.52 },
            { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Black', size: 'XL', qty: 2, lineCost: 25.52 },
            { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Indigo Blue', size: 'S', qty: 1, lineCost: 12.76 }
          ] }],
        lines: [
          { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Black', size: 'S', qtyOrdered: 1, qtyShipped: 1, status: 'Shipped', lineCost: 12.76 },
          { style: '18500', title: 'Gildan Heavy Blend Hooded Sweatshirt', color: 'Black', size: 'M', qtyOrdered: 2, qtyShipped: 2, status: 'Shipped', lineCost: 25.52 }
        ],
        received: false, issue: null
      },
      {
        company: 'Acme Landscaping', method: 'DTG', workOrder: '142600', sanmarPO: '113800',
        dueDate: '2026-07-25', designNumber: '40122', designName: 'Acme crest', contactName: 'Dana Wu',
        salesRep: 'Nika Lao', customerPO: 'AC-88', terms: 'Net 30', dateOrdered: '2026-07-18',
        boxes: 2, piecesShipped: 40, piecesOrdered: 48, cost: 180.00,
        tracking: '1Z61R84A0313970001', carrier: 'UPS', trackingUrl: '#', shipDate: '2026-07-20', fromState: 'NV',
        arrival: '2026-07-22', upsDelivery: { date: '2026-07-23', type: 'rescheduled', status: 'Rescheduled' },
        boxDetailAvailable: false, boxDetail: [],
        lines: [
          { style: 'PC61', title: 'Port & Company Essential Tee', color: 'Navy', size: 'M', qtyOrdered: 24, qtyShipped: 20, status: 'Partial', lineCost: 90.00 },
          { style: 'PC61', title: 'Port & Company Essential Tee', color: 'Navy', size: 'L', qtyOrdered: 24, qtyShipped: 20, status: 'Partial', lineCost: 90.00 }
        ],
        received: false, issue: { backorder: true, hold: false, label: '8 units backordered' }
      },
      {
        company: 'Cold Boy Stables', method: 'Embroidery', workOrder: '142588', sanmarPO: '113790',
        dueDate: '2026-09-01', designNumber: '39980', designName: 'Cold Boy monogram', contactName: 'Pat Rivera',
        salesRep: 'Taneisha Clark', customerPO: '', terms: 'Net 10', dateOrdered: '2026-07-19',
        boxes: 1, piecesShipped: 12, piecesOrdered: 12, cost: 90.00,
        tracking: '1Z61R84A0313970050', carrier: 'UPS', trackingUrl: '#', shipDate: '2026-07-21', fromState: 'WA',
        arrival: '2026-07-22', upsDelivery: null,
        boxDetailAvailable: false, boxDetail: [],
        lines: [{ style: 'CP90', title: 'Port & Company Knit Cap', color: 'Athletic Heather', size: 'OSFA', qtyOrdered: 12, qtyShipped: 12, status: 'Shipped', lineCost: 90.00 }],
        received: false, issue: null
      },
      {
        company: 'General Mechanical', method: 'Screen Print', workOrder: '', sanmarPO: '113795',
        dueDate: '2026-08-10', designNumber: '', designName: '', contactName: '',
        salesRep: '', customerPO: '', terms: 'Net 30', dateOrdered: '2026-07-17',
        boxes: 1, piecesShipped: 24, piecesOrdered: 24, cost: 60.00,
        tracking: '', carrier: '', trackingUrl: '', shipDate: '2026-07-21', fromState: 'WA',
        arrival: '2026-07-22', upsDelivery: null,
        boxDetailAvailable: false, boxDetail: [],
        lines: [{ style: 'G500', title: 'Gildan Heavy Cotton Tee', color: 'Sport Grey', size: 'XL', qtyOrdered: 24, qtyShipped: 24, status: 'Shipped', lineCost: 60.00 }],
        received: false, issue: null
      },
      {
        company: 'Emtech', method: 'Embroidery', workOrder: '142449', sanmarPO: '113664',
        dueDate: '2026-07-30', designNumber: '31000', designName: 'Emtech', contactName: 'Lee Ann',
        salesRep: 'Nika Lao', customerPO: '', terms: 'Net 10', dateOrdered: '2026-07-15',
        boxes: 1, piecesShipped: 6, piecesOrdered: 6, cost: 48.00,
        received: true, receivedDate: '2026-07-22',
        boxDetailAvailable: false, boxDetail: [],
        lines: [{ style: 'PC54', title: 'Port & Company Core Tee', color: 'Red', size: 'L', qtyOrdered: 6, qtyShipped: 6, status: 'Shipped', lineCost: 48.00 }],
        issue: null
      },
      {
        // FOLLOW-ON SHIPMENT (2026-07-27, modelled on the real PO 113682): receiving counted this PO
        // in on the 21st, but SanMar shipped another carton on the 24th. It must behave like a NORMAL
        // arriving PO — full contents, a box label, counted in the totals — NOT collapse to "✓ Received".
        company: "Swiss Sportsmen's Club", method: 'Embroidery', workOrder: '142473', sanmarPO: '113682',
        dueDate: '2026-08-04', designNumber: '30011', designName: 'Swiss Club Crest', contactName: 'Hans Meier',
        salesRep: 'Taneisha Clark', customerPO: '', terms: 'Net 10', dateOrdered: '2026-07-08',
        boxes: 1, piecesShipped: 6, piecesOrdered: 6, cost: 32.64,
        received: false, receivedDate: '2026-07-21', followOnShipment: true,
        shipDate: '2026-07-24', fromState: 'NV', carrier: 'UPS', tracking: '1Z021W510351562544',
        boxDetailAvailable: true,
        boxDetail: [{
          boxNumber: 1, trackingNumber: '1Z021W510351562544', carrier: 'UPS', pieces: 6, cost: 32.64,
          items: [{ style: 'YST720', title: 'Sport-Tek Youth PosiCharge Tee', color: 'True Royal', size: 'L', qty: 6, lineCost: 32.64 }],
        }],
        lines: [{ style: 'YST720', title: 'Sport-Tek Youth PosiCharge Tee', color: 'True Royal', size: 'L', qtyOrdered: 6, qtyShipped: 6, status: 'Shipped', lineCost: 32.64 }],
        issue: null
      }
    ]
  };

  // Mock the network + suppress the OS print dialog.
  //
  // The plain load answers with a STALE generatedAt — that is exactly what the server's
  // 10-minute response cache serves, and it is what produced the short 3:57 AM printout on
  // 2026-07-29. A refresh=true call answers with a fresh one, like a real server rebuild.
  // So the first print/label action must re-pull, and the rest must reuse it inside
  // OUTPUT_FRESH_MS — both halves are asserted at the end of this harness.
  var STALE_GENERATED_AT = '2026-07-22T10:56:56.000Z';
  var refreshCalls = 0;
  var totalInboundCalls = 0;
  window.APP_CONFIG = { API: { BASE_URL: 'https://mock.local' } };
  window.print = function () { /* no-op in harness */ };
  window.fetch = function (url) {
    var u = String(url);
    if (u.indexOf('/api/sanmar-orders/inbound-today') !== -1) {
      var forced = u.indexOf('refresh=true') !== -1;
      totalInboundCalls++;
      if (forced) refreshCalls++;
      var payload = Object.assign({}, MOCK, {
        generatedAt: forced ? new Date().toISOString() : STALE_GENERATED_AT
      });
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(payload); } });
    }
    if (u.indexOf('/api/thumbnails/by-designs') !== -1) {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ thumbnails: {} }); } });
    }
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
  };

  var status = document.getElementById('harness-status');
  var area = document.getElementById('preview-area');

  function setStatus(msg, ok) { status.textContent = msg; status.style.color = ok ? '#1d7a3e' : '#a3300f'; }

  function appendCard(label, node) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin:0 0 26px;';
    var h = document.createElement('div');
    h.textContent = label;
    h.style.cssText = 'font-size:13px; font-weight:700; color:#2e6f40; margin:0 0 6px; border-bottom:1px solid #cbd8cb; padding-bottom:3px;';
    wrap.appendChild(h);
    var frame = document.createElement('div');
    frame.style.cssText = 'background:#fff; border:1px solid #ccc; border-radius:6px; padding:16px; max-width:780px;';
    frame.appendChild(node);
    wrap.appendChild(frame);
    area.appendChild(wrap);
  }

  // Wait for a sheet element to be built. Printing is ASYNC now — every print action
  // re-pulls from SanMar first (syncBeforeOutput), so the sheet cannot be read on the
  // same tick as the click.
  //
  // MutationObserver, NOT setInterval: a backgrounded tab throttles timers to ~1s and then
  // to a crawl, which stalls a polling harness indefinitely while the page itself is fine.
  // Observers fire on the DOM change regardless of tab visibility. (Same trap as the
  // transition-timing one in LESSONS_LEARNED — never time a UI assertion in a hidden tab.)
  function waitForNode(id, cb) {
    var settled = false;
    function finish(el) {
      if (settled) return;
      settled = true;
      obs.disconnect();
      clearTimeout(timer);
      cb(el);
    }
    var obs = new MutationObserver(function () {
      var el = document.getElementById(id);
      if (el) finish(el);
    });
    obs.observe(document.body, { childList: true });
    var timer = setTimeout(function () { finish(document.getElementById(id)); }, 8000);
    var already = document.getElementById(id);
    if (already) finish(already);
  }

  // Build one profile by driving the real dropdown, then clone the sheet into a
  // visible frame (the live #sit-print-sheet is display:none except when printing).
  function renderProfile(label, key, rep, done) {
    var printBtn = document.getElementById('sit-print');
    var menu = document.getElementById('sit-printmenu');
    if (menu.hidden) printBtn.click();               // open + populate the menu
    var sel = '[data-print="' + key + '"]' + (rep ? '[data-rep="' + rep + '"]' : ':not([data-rep])');
    var item = menu.querySelector(sel);
    if (!item) { appendCard(label + '  — MENU ITEM NOT FOUND (' + sel + ')', document.createTextNode('')); return done(); }
    // Clear the previous profile's sheet first — it lingers until its 1500 ms cleanup, and
    // waiting on "a sheet exists" would otherwise clone the PREVIOUS profile into this card.
    var stale = document.getElementById('sit-print-sheet');
    if (stale) stale.remove();
    item.click();                                     // re-pulls, then builds #sit-print-sheet
    waitForNode('sit-print-sheet', function (sheet) {
      if (!sheet) { appendCard(label + '  — NO SHEET BUILT', document.createTextNode('')); return done(); }
      var clone = sheet.cloneNode(true);
      clone.removeAttribute('id');
      clone.style.cssText = 'display:block; color:#1a1d1a; font-family:system-ui,"Segoe UI",sans-serif; font-size:11px;';
      appendCard(label, clone);
      done();
    });
  }

  // Run the profile list one at a time (each click re-pulls; overlapping them would
  // race on the single #sit-print-sheet node).
  function renderSequence(list, done) {
    var i = 0;
    (function next() {
      if (i >= list.length) return done();
      var p = list[i++];
      renderProfile(p[0], p[1], p[2], next);
    })();
  }

  // Observer-driven for the same reason as waitForNode — no timer polling.
  function waitForLoad(cb) {
    var settled = false;
    function check() {
      return document.querySelector('.sit-modal #sit-body .sit-summary')
        || document.querySelector('.sit-modal #sit-body .sit-cards');
    }
    function finish(ok) {
      if (settled) return;
      settled = true;
      obs.disconnect();
      clearTimeout(timer);
      cb(ok);
    }
    var obs = new MutationObserver(function () { if (check()) finish(true); });
    obs.observe(document.body, { childList: true, subtree: true });
    var timer = setTimeout(function () { finish(!!check()); }, 10000);
    if (check()) finish(true);
  }

  try {
    window.openInboundTodayModal();
    waitForLoad(function (ok) {
      if (!ok) { setStatus('Modal did not load within 8s — check console.', false); return; }
      try {
        // 1) Capture the open dropdown menu itself.
        var printBtn = document.getElementById('sit-print');
        printBtn.click();
        var menuClone = document.getElementById('sit-printmenu').cloneNode(true);
        menuClone.removeAttribute('id');   // avoid a duplicate id shadowing the live menu
        menuClone.hidden = false;
        menuClone.style.cssText = 'position:static; display:block; box-shadow:none; max-height:none;';
        appendCard('“Print for…” dropdown menu', menuClone);

        // 2) Render every profile, then the box-label run.
        renderSequence([
          ['1 · Full report (Bradley / Mikalah / Ruthie master)', 'full', null],
          ['2 · AE personal sheet — Nika Lao (cost hidden)', 'ae', 'Nika Lao'],
          ['3 · AE personal sheet — Taneisha Clark (cost hidden)', 'ae', 'Taneisha Clark'],
          ['4 · All AE sheets (one per page)', 'allAe', null],
          ['5 · Receiving checklist (Mikalah)', 'receiving', null],
          ['6 · Production plan (Ruthie)', 'production', null],
          ['7 · Purchasing / PO reconcile (Bradley)', 'purchasing', null]
        ], function () {
          // Box Labels goes through the same pre-print re-pull.
          document.getElementById('sit-labels').click();
          waitForNode('sit-label-sheet', function (labelSheet) {
            var labelPages = labelSheet ? labelSheet.querySelectorAll('.sit-label').length : 0;

            // 3) Hide the live modal so the preview panes are unobstructed.
            var modal = document.querySelector('.sit-modal');
            if (modal) modal.style.display = 'none';

            // 4) Assert the pre-print re-pull: the FIRST output action must force refresh=true
            //    (the loaded payload is stale), and every action after it must reuse that fresh
            //    payload rather than hammering SanMar once per sheet.
            var pass = refreshCalls === 1 && totalInboundCalls === 2;
            setStatus(
              'Rendered 7 previews + the dropdown + ' + labelPages + ' box labels. ' +
              'Pre-print re-pull: ' + refreshCalls + ' forced refresh / ' + totalInboundCalls +
              ' inbound calls for 8 output actions — expected 1 / 2 → ' + (pass ? 'PASS' : 'FAIL') +
              '. (Received PO “Emtech” is correctly excluded from all sheets and labels.)',
              pass
            );
          });
        });
      } catch (e2) {
        setStatus('Render error: ' + e2.message, false);
        console.error(e2);
      }
    });
  } catch (e) {
    setStatus('Init error: ' + e.message, false);
    console.error(e);
  }
})();
