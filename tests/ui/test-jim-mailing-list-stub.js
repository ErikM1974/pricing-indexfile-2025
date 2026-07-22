/**
 * test-jim-mailing-list-stub.js — in-memory fetch stub for the Jim Mailing List
 * harness. Overrides window.fetch for /api/crm-proxy/jim-mailing-list* so the REAL
 * controller (dashboards/js/jim-mailing-list.js) runs full add/edit/delete/search
 * with no SAML session and no Caspio. Load BEFORE the controller script.
 */
(function () {
    'use strict';

    var seq = 3;
    var rows = [
        { PK_ID: 1, Company: 'Milton Hardware & Supply', Contact_Name: 'Carl Jensen', Address: '1420 Meridian Ave E', City: 'Milton', State: 'WA', Zip: '98354', Phone: '253-555-0142', Email: 'carl@miltonhardware.example', Website: 'www.miltonhardware.example', Source: 'Milton Times', Category: 'Construction Prospect', Notes: 'Wants embroidered work shirts for the crew.' },
        { PK_ID: 2, Company: 'Fife Family Diner', Contact_Name: 'Rosa Alvarez', Address: '', City: 'Fife', State: 'WA', Zip: '98424', Phone: '253-555-0199', Email: '', Website: '', Source: 'Saw in Pierce County Business Journal', Category: '', Notes: '' },
        { PK_ID: 3, Company: 'Edgewood Little League', Contact_Name: '', Address: '2607 Jovita Blvd', City: 'Edgewood', State: 'WA', Zip: '98372', Phone: '', Email: 'info@edgewoodll.example', Website: 'http://edgewoodll.example/', Source: 'Bigin import', Category: 'Fire Dept Prospect', Notes: 'Spring team jerseys — follow up in Feb.' },
    ];

    function json(status, body) {
        return Promise.resolve({
            ok: status >= 200 && status < 300,
            status: status,
            json: function () { return Promise.resolve(body); },
        });
    }

    var realFetch = window.fetch ? window.fetch.bind(window) : null;

    window.fetch = function (url, options) {
        var u = String(url);
        options = options || {};
        var method = (options.method || 'GET').toUpperCase();

        if (u.indexOf('/api/crm-proxy/jim-mailing-list') !== 0) {
            return realFetch ? realFetch(url, options) : json(404, { error: 'not stubbed' });
        }

        // AI capture — return the Copy Wrights directory-listing example.
        if (/\/jim-mailing-list\/extract\b/.test(u) && method === 'POST') {
            return json(200, {
                fields: {
                    company: 'Copy Wrights', contact_name: 'Justin Kasarda (General Manager)',
                    address: '2106 Tacoma Ave S', city: 'Tacoma', state: 'WA', zip: '98402',
                    phone: '(253) 922-5156', email: '', website: '',
                    category: 'Printing Services, Signs/Banners',
                    notes: 'Fax (855) 594-3238; cell (253) 670-8702. 30+ years.',
                },
            });
        }

        // pull an id off the end if present
        var m = /\/jim-mailing-list\/(\d+)/.exec(u);
        var id = m ? parseInt(m[1], 10) : null;
        var body = {};
        try { body = options.body ? JSON.parse(options.body) : {}; } catch (e) { body = {}; }

        if (method === 'GET') {
            var sorted = rows.slice().sort(function (a, b) { return String(a.Company).localeCompare(String(b.Company)); });
            return json(200, { entries: sorted });
        }
        if (method === 'POST') {
            if (!body.Company) return json(400, { error: 'Company name is required' });
            var rec = Object.assign({ PK_ID: ++seq }, body);
            rows.push(rec);
            return json(201, { created: rec });
        }
        if (method === 'PUT') {
            var row = rows.filter(function (r) { return r.PK_ID === id; })[0];
            if (!row) return json(404, { error: 'Entry ' + id + ' not found' });
            Object.keys(body).forEach(function (k) { row[k] = body[k]; });
            return json(200, { updated: id });
        }
        if (method === 'DELETE') {
            var before = rows.length;
            rows = rows.filter(function (r) { return r.PK_ID !== id; });
            if (rows.length === before) return json(404, { error: 'Entry ' + id + ' not found' });
            return json(200, { deleted: id });
        }
        return json(405, { error: 'method not allowed' });
    };
})();
