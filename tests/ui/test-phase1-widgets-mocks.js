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
        { QuoteID: 'CAP0720-9', Status: 'Payment Confirmed', CompanyName: 'Pacific Fire Dept', TotalAmount: '3890.00', TaxAmount: '396.78', CreatedAt: new Date().toISOString() },
        { QuoteID: 'EMB0718-2', Status: 'Accepted', CompanyName: 'Gig Harbor Yacht Club', TotalAmount: '1720.00', TaxAmount: '140.00', CreatedAt: new Date().toISOString() },
        { QuoteID: 'DTG0715-5', Status: 'Open', CompanyName: 'Ignored Co', TotalAmount: '100', TaxAmount: '0', CreatedAt: new Date().toISOString() },
    ];

    function svgPhoto(label, bg) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
            '<rect width="400" height="300" fill="' + bg + '"/>' +
            '<text x="200" y="158" font-family="sans-serif" font-size="26" fill="#fff" text-anchor="middle">' + label + '</text></svg>';
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }
    var hues = ['#3a7c52', '#2c5a7c', '#7c3a5a', '#7c6a2c', '#4a3a7c', '#2c7c6e', '#7c4a2c', '#52527c'];
    var photos = hues.map(function (h, i) {
        return {
            imageUrl: svgPhoto('Job #' + (128400 + i), h),
            companyName: ['Pacific Fire Dept', 'Streich Bros', 'Tacoma Plumbing', 'WCTTR', 'Drain-Pro', 'Ostrom Farms', 'Gig Harbor YC', 'NW Paving'][i],
            repName: i % 2 ? 'Nika' : 'Taneisha',
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
        return realFetch(url, opts);
    };
})();
