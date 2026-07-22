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
        { PK_ID: 1, Company: 'Milton Hardware & Supply', First_Name: 'Carl', Last_Name: 'Jensen', Contact_Name: 'Carl Jensen', Address: '1420 Meridian Ave E', City: 'Milton', State: 'WA', Zip: '98354', Phone: '253-555-0142', Email: 'carl@miltonhardware.example', Website: 'www.miltonhardware.example', Source: 'Milton Times', Category: 'Construction Prospect', Notes: 'Wants embroidered work shirts.', Created_At: '2026-07-20T00:00:00' },
        { PK_ID: 2, Company: 'Fife Family Diner', First_Name: 'Rosa', Last_Name: 'Alvarez', Contact_Name: 'Rosa Alvarez', Address: '', City: 'Fife', State: 'WA', Zip: '98424', Phone: '253-555-0199', Email: '', Website: '', Source: 'Pierce County Business Journal', Category: 'Landscaper', Notes: '', Created_At: '2026-07-21T00:00:00' },
        { PK_ID: 3, Company: 'Edgewood Little League', First_Name: '', Last_Name: '', Contact_Name: '', Address: '2607 Jovita Blvd', City: 'Edgewood', State: 'WA', Zip: '98372', Phone: '', Email: 'info@edgewoodll.example', Website: 'http://edgewoodll.example/', Source: 'Bigin import', Category: 'Fire Dept Prospect', Notes: 'Spring team jerseys — follow up in Feb.', Created_At: '2026-07-19T00:00:00' },
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

        // Mailchimp (Phase 2)
        if (/\/jim-mailing-list\/mailchimp\/status\b/.test(u) && method === 'GET') {
            return json(200, { ok: true, configured: true, dc: 'us7', audience: { name: "Jim's Prospects", members: 0 } });
        }
        if (/\/jim-mailing-list\/mailchimp\/sync\b/.test(u) && method === 'POST') {
            return json(200, { ok: true, audience: "Jim's Prospects", attempted: 2, created: 2, updated: 0, errors: 0, skippedNoEmail: 1, skippedDoNotMail: 0 });
        }
        if (/\/jim-mailing-list\/mailchimp\/record-sends\b/.test(u) && method === 'POST') {
            return json(200, { ok: true, campaigns: 1, recipients: 1, updated: 1 });
        }

        // AI capture — return the Copy Wrights directory-listing example.
        if (/\/jim-mailing-list\/extract\b/.test(u) && method === 'POST') {
            return json(200, {
                fields: {
                    company: 'Copy Wrights', first_name: 'Justin', last_name: 'Kasarda',
                    address: '2106 Tacoma Ave S', city: 'Tacoma', state: 'WA', zip: '98402',
                    phone: '(253) 922-5156', email: '', website: '',
                    category: 'Printing Services, Signs/Banners',
                    notes: 'General Manager. Fax (855) 594-3238; cell (253) 670-8702.',
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
