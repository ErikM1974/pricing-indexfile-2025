/**
 * test-finished-photos-library-stub.js — fetch stub for tests/ui/test-finished-photos-library.html
 * Replaces window.fetch for the library page's same-origin calls so the page renders,
 * filters, and toggles publish without SAML/Caspio/Box. Images are inline SVG data URIs.
 */
(function () {
    'use strict';

    function daysAgo(d) { return new Date(Date.now() - d * 86400000).toISOString(); }
    function img(label, bg) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
            '<rect width="400" height="300" fill="' + bg + '"/>' +
            '<text x="200" y="155" font-family="sans-serif" font-size="28" fill="#fff" text-anchor="middle">' + label + '</text></svg>';
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    var photos = [
        { pkId: 9, idCustomer: '4581', companyName: 'Archterra Landscaping', designNumber: '40121', designName: 'Archterra Crew Polo', idOrder: '142476', caption: 'Front crest', imageUrl: img('Archterra 1', '#2f6f43'), uploadedBy: '', uploadedDate: daysAgo(0), showToCustomer: true, repName: 'Taneisha Clark' },
        { pkId: 8, idCustomer: '4581', companyName: 'Archterra Landscaping', designNumber: '40121', designName: 'Archterra Crew Polo', idOrder: '142476', caption: 'Back print', imageUrl: img('Archterra 2', '#388450'), uploadedBy: '', uploadedDate: daysAgo(0), showToCustomer: false, repName: 'Taneisha Clark' },
        { pkId: 7, idCustomer: '3120', companyName: 'Harbor Electric', designNumber: '39984', designName: 'Harbor Hi-Vis Tee', idOrder: '142449', caption: '', imageUrl: img('Harbor', '#b58c1f'), uploadedBy: '', uploadedDate: daysAgo(1), showToCustomer: true, repName: 'Nika Lao' },
        { pkId: 6, idCustomer: '2210', companyName: 'Temple Fitness <script>alert(1)</script>', designNumber: '', designName: '', idOrder: '', caption: 'XSS check — must render as text', imageUrl: img('Temple', '#7a3b8f'), uploadedBy: '', uploadedDate: daysAgo(3), showToCustomer: false, repName: '' },
        { pkId: 5, idCustomer: '3120', companyName: 'Harbor Electric', designNumber: '39984', designName: 'Harbor Hi-Vis Tee', idOrder: '', caption: 'Sleeve logo', imageUrl: img('Harbor 2', '#b5641f'), uploadedBy: '', uploadedDate: daysAgo(6), showToCustomer: false, repName: 'Nika Lao' },
    ];

    function libraryPayload() {
        return {
            success: true, generatedAt: new Date().toISOString(), cacheHit: false,
            totalCount: photos.length, count: photos.length, truncated: 0,
            reps: [
                { name: 'Taneisha Clark', count: 2 },
                { name: 'Nika Lao', count: 2 },
                { name: 'House / Unassigned', count: 1 },
            ],
            photos: photos,
        };
    }

    var realFetch = window.fetch;
    window.fetch = function (url, options) {
        var u = String(url);
        if (u.indexOf('/api/staff/finished-photos/library') !== -1) {
            return Promise.resolve(new Response(JSON.stringify(libraryPayload()), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }));
        }
        var m = /\/api\/staff\/finished-photos\/(\d+)$/.exec(u);
        if (m && options && options.method === 'PATCH') {
            var pk = Number(m[1]);
            var body = JSON.parse(options.body || '{}');
            photos.forEach(function (p) { if (p.pkId === pk) p.showToCustomer = !!body.show; });
            return Promise.resolve(new Response(JSON.stringify({ success: true }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }));
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] Finished Photos Library fetch stub active');
})();
