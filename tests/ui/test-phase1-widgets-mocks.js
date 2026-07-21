/* TEST HARNESS MOCKS — test-phase1-widgets.html only.
   Defines APP_CONFIG + a fetch stub BEFORE the dashboard modules load,
   and seeds localStorage so the Win Bell fires a celebration on load. */
(function () {
    'use strict';

    window.APP_CONFIG = { API: { BASE_URL: '/mock-api' } };

    // ── localStorage scenario ──
    // Win Bell: pretend a previous visit saw nothing → both mock wins are "fresh".
    localStorage.setItem('nwca-winbell-seen-v1', JSON.stringify({ ids: [], goalBand: 40 }));
    localStorage.removeItem('nwca-winbell-feed-v1');
    // My Stuff: one pin + two recents.
    localStorage.setItem('nwca-mystuff-v1', JSON.stringify({
        pins: [{ href: '/dashboards/production-shifts.html', label: 'Production Shifts', icon: 'fas fa-user-clock' }],
        recents: [
            { href: '/calculators/quick-quote/', label: 'Quick Quote', icon: 'fas fa-bolt' },
            { href: '/dashboards/finished-photos.html', label: 'Finished Photos', icon: 'fas fa-camera' },
        ],
    }));

    // ── canned data ──
    var sessions = [
        { QuoteID: 'CAP0720-9', Status: 'Payment Confirmed', CompanyName: 'Pacific Fire Dept', SubtotalAmount: '3890.00', TotalAmount: '4286.78', TaxAmount: '396.78', SalesRepName: 'Nika Lao', CreatedAt: new Date().toISOString() },
        { QuoteID: 'EMB0718-2', Status: 'Accepted', CompanyName: 'Gig Harbor Yacht Club', SubtotalAmount: '1720.00', TotalAmount: '1860.00', TaxAmount: '140.00', SalesRepName: 'Taneisha Clark', CreatedAt: new Date().toISOString() },
        { QuoteID: 'DTG0715-5', Status: 'Open', CompanyName: 'Ignored Co', SubtotalAmount: '100', TotalAmount: '100', TaxAmount: '0', CreatedAt: new Date().toISOString() },
    ];

    function svgPhoto(label, bg) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
            '<rect width="400" height="300" fill="' + bg + '"/>' +
            '<text x="200" y="158" font-family="sans-serif" font-size="26" fill="#fff" text-anchor="middle">' + label + '</text></svg>';
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }
    var hues = ['#3a7c52', '#2c5a7c', '#7c3a5a', '#7c6a2c', '#4a3a7c', '#2c7c6e', '#7c4a2c', '#52527c'];
    // uploadedDate deliberately out of array order so the harness proves the
    // Pride Wall's newest-first sort (not merely "no longer shuffled"). After
    // sorting, the frozen newest-6 left→right are: Ostrom Farms(7/21) ·
    // NW Paving(7/20) · Pacific Fire(7/19) · Drain-Pro(7/18) · WCTTR(7/15) ·
    // Streich Bros(7/11); Tacoma Plumbing(7/06) + Gig Harbor(6/28) fall off.
    // dsn: design number (WCTTR left blank on purpose — proves a tile drops the
    // # gracefully when the photo has none).
    var pmeta = [
        { co: 'Pacific Fire Dept', rep: 'Taneisha', date: '2026-07-19 10:12:00', dsn: '40477' },
        { co: 'Streich Bros', rep: 'Nika', date: '2026-07-11 09:03:00', dsn: '39812' },
        { co: 'Tacoma Plumbing', rep: 'Taneisha', date: '2026-07-06 14:20:00', dsn: '39104' },
        { co: 'WCTTR', rep: 'Nika', date: '2026-07-15 16:45:00', dsn: '' },
        { co: 'Drain-Pro', rep: 'Taneisha', date: '2026-07-18 08:30:00', dsn: '40655' },
        { co: 'Ostrom Farms', rep: 'Nika', date: '2026-07-21 07:55:00', dsn: '40901' },
        { co: 'Gig Harbor YC', rep: 'Taneisha', date: '2026-06-28 11:00:00', dsn: '38520' },
        { co: 'NW Paving', rep: 'Nika', date: '2026-07-20 13:15:00', dsn: '40888' },
    ];
    var photos = hues.map(function (h, i) {
        return {
            imageUrl: svgPhoto('Job #' + (128400 + i), h),
            companyName: pmeta[i].co,
            repName: pmeta[i].rep,
            uploadedDate: pmeta[i].date,
            designNumber: pmeta[i].dsn,
            showToCustomer: true,
        };
    });

    // ── fetch stub ──
    var realFetch = window.fetch.bind(window);
    window.fetch = function (url, opts) {
        var u = String(url);
        if (u.indexOf('/mock-api/quote_sessions') === 0) {
            return Promise.resolve(new Response(JSON.stringify(sessions), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.indexOf('/api/staff/finished-photos/library') === 0) {
            return Promise.resolve(new Response(JSON.stringify({ success: true, photos: photos, reps: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.indexOf('/api/staff/command-search') === 0) {
            var body = {
                success: true, q: 'mock', errors: {},
                customers: [{ idCustomer: 10428, company: 'Tacoma Longshoremen Credit Union', rep: 'Nika Lao', lastOrder: '2026-07-16', city: 'Tacoma', state: 'WA' }],
                orders: [{ idOrder: 142470, company: 'Tacoma Longshoremen Credit Union', rep: 'Nika Lao', idCustomer: 10428, placed: '2026-07-16', subtotal: 1240.5, orderType: '77 Account', shipped: false, invoiced: false }],
                quotes: [{ quoteID: 'EMB-2026-314', company: 'Cold Boy Stables', status: 'Open', subtotal: 420, rep: 'Erik Mickelson', created: '2026-07-15' }],
                designs: [{ designNumber: '40477', name: 'D SQUARE left chest', company: 'Schneider Electric', stitchCount: 9400, image: '', lastOrder: '2026-07-01' }],
            };
            return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch(url, opts);
    };
})();
