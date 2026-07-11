/**
 * test-form-submissions-stub.js — fetch stub for tests/ui/test-form-submissions.html
 *
 * Replaces window.fetch for the crm-proxy + session endpoints the Forms Inbox
 * controller calls, so the SAML-gated page logic can be exercised without a
 * login. PUTs mutate the in-memory fixtures so check-in flows can be clicked
 * through end-to-end in the harness.
 */
(function () {
    'use strict';

    function iso(daysFromNow) {
        var d = new Date(Date.now() + daysFromNow * 86400000);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    var submissions = [
        {
            Submission_ID: 'DRP0711-1001', Form_ID: 'garment-drop-off', Company: 'Drain Pro Inc.',
            Contact_Name: 'Mike Rowe', Phone: '253-555-0142', Email: 'mike@drainpro.com',
            Customer_Number: '7740', Sales_Rep: 'Taneisha', Due_Date: iso(4), Status: 'New',
            Summary: '15 pcs · Embroidery', Submitted_At: new Date(Date.now() - 2 * 3600000).toISOString(),
            Updated_At: '', Updated_By: '', Art_Request_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Company', 'Drain Pro Inc.'], ['Contact Name', 'Mike Rowe'], ['Phone', '253-555-0142'], ['Date Needed', '7/15/2026']],
                checks: ['Embroidery'],
                tables: [{ title: 'Garment Details', columns: ['Style', 'Color', 'Desc', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Other', 'Total'], rows: [['K87', 'Black', 'Pocket Tee', '2', '4', '6', '3', '', '', '', '15']] }],
                notes: [['Order Notes', 'Left chest logo, NWCA green thread.']],
            }),
        },
        {
            Submission_ID: 'ART0711-2002', Form_ID: 'artwork-request', Company: 'Streich Bros',
            Contact_Name: 'Amy Streich', Phone: '', Email: 'amy@streich.com',
            Customer_Number: '2210', Sales_Rep: 'Nika', Due_Date: iso(9), Status: 'New',
            Summary: 'Anniversary logo · Embroidery · $150', Submitted_At: new Date(Date.now() - 26 * 3600000).toISOString(),
            Updated_At: '', Updated_By: '', Art_Request_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Company', 'Streich Bros'], ['Project Name / Event', 'Anniversary logo'], ['Quantity', '48'], ['Art Budget $', '150']],
                checks: ['Embroidery', 'Existing logo provided'],
                tables: [],
                notes: [['Sketch / Layout Notes', '75th anniversary banner across the top.']],
            }),
        },
        {
            Submission_ID: 'SMP0709-3003', Form_ID: 'sample-checkout', Company: 'WCTTR',
            Contact_Name: 'Pat Chen', Phone: '253-555-0177', Email: 'pat@wcttr.org',
            Customer_Number: '5120', Sales_Rep: 'Taneisha', Due_Date: iso(-2), Status: 'Checked Out',
            Summary: '2 items out · due ' + iso(-2), Submitted_At: new Date(Date.now() - 16 * 86400000).toISOString(),
            Updated_At: '', Updated_By: '', Art_Request_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Company', 'WCTTR'], ['Checkout Date', iso(-16)], ['Return Due Date', iso(-2)], ['Grace Deadline', iso(0)]],
                checks: ['Source: Showroom', 'Unworn', 'Original tags attached'],
                tables: [],
                notes: [],
            }),
        },
        {
            Submission_ID: 'NAM0711-4004', Form_ID: 'name-personalization', Company: 'Milton FD',
            Contact_Name: 'Chief Adams', Phone: '', Email: '', Customer_Number: '', Sales_Rep: 'Jim',
            Due_Date: iso(12), Status: 'In Progress', Summary: '12 names · Embroidery',
            Submitted_At: new Date(Date.now() - 3 * 86400000).toISOString(),
            Updated_At: '', Updated_By: '', Art_Request_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Company', 'Milton FD'], ['Name Location', 'Right chest'], ['Font', 'Block'], ['Total Names', '12']],
                checks: ['Embroidery', 'ALL CAPS'],
                tables: [{ title: 'Name List', columns: ['#', 'Name', 'Garment', 'Color', 'Size', 'Qty', 'Notes'], rows: [['1', 'ADAMS', 'Eisenhower Jacket', 'Navy', 'L', '1', 'Chief']] }],
                notes: [],
            }),
        },
    ];

    var items = [
        { PK_ID: 11, Submission_ID: 'SMP0709-3003', Line_Number: '1', Source: 'Showroom', Brand: 'Carhartt', Style: 'K87', Description: 'Pocket Tee', Color: 'Black', Size: 'L', Qty: '1', Retail_Value: '29.99', Charge_Value: '22.49', Item_Status: 'Out', Date_Returned: '', Condition: '', Checked_In_By: '' },
        { PK_ID: 12, Submission_ID: 'SMP0709-3003', Line_Number: '2', Source: 'Vendor', Brand: 'CornerStone', Style: 'CS410', Description: 'Polo', Color: 'Navy', Size: 'XL', Qty: '1', Retail_Value: '39.99', Charge_Value: '29.99', Item_Status: 'Out', Date_Returned: '', Condition: '', Checked_In_By: '' },
    ];

    function json(body, status) {
        return Promise.resolve(new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
    }

    var realFetch = window.fetch.bind(window);

    window.fetch = function (url, options) {
        var u = String(url);
        var method = (options && options.method || 'GET').toUpperCase();

        if (u.indexOf('/api/crm-session/me') !== -1) {
            return json({ authenticated: true, name: 'Test Staff', firstName: 'Test', email: 'test@nwcustomapparel.com', permissions: ['staff'] });
        }

        if (u.indexOf('/api/crm-proxy/form-submissions') !== -1) {
            var tail = u.split('/api/crm-proxy/form-submissions')[1] || '';
            if (method === 'GET' && (tail === '' || tail.indexOf('?') === 0)) return json({ submissions: submissions });
            if (method === 'GET' && tail === '/items/open') {
                return json({ items: items.filter(function (i) { return i.Item_Status === 'Out'; }) });
            }
            if (method === 'PUT' && tail.indexOf('/items/') === 0) {
                var pk = parseInt(tail.split('/items/')[1], 10);
                var item = items.filter(function (i) { return i.PK_ID === pk; })[0];
                if (!item) return json({ error: 'Item not found' }, 404);
                var body = JSON.parse(options.body || '{}');
                Object.keys(body).forEach(function (k) { if (k in item) item[k] = body[k]; });
                var siblings = items.filter(function (i) { return i.Submission_ID === item.Submission_ID; });
                var out = siblings.filter(function (i) { return i.Item_Status === 'Out'; }).length;
                var parentStatus = out === siblings.length ? 'Checked Out' : (out === 0 ? 'Returned' : 'Partially Returned');
                submissions.forEach(function (s) { if (s.Submission_ID === item.Submission_ID) s.Status = parentStatus; });
                return json({ updated: pk, submissionId: item.Submission_ID, parentStatus: parentStatus });
            }
            if (method === 'GET') {
                var id = decodeURIComponent(tail.replace(/^\//, ''));
                var sub = submissions.filter(function (s) { return s.Submission_ID === id; })[0];
                if (!sub) return json({ error: 'not found' }, 404);
                return json({ submission: sub, items: items.filter(function (i) { return i.Submission_ID === id; }) });
            }
            if (method === 'PUT') {
                var pid = decodeURIComponent(tail.replace(/^\//, ''));
                var target = submissions.filter(function (s) { return s.Submission_ID === pid; })[0];
                if (!target) return json({ error: 'not found' }, 404);
                var fields = JSON.parse(options.body || '{}');
                Object.keys(fields).forEach(function (k) { if (k in target) target[k] = fields[k]; });
                return json({ updated: pid, fields: fields });
            }
        }

        if (u.indexOf('/api/artrequests') !== -1 && method === 'POST') {
            return json({ success: true, PK_ID: 90210 }, 201);
        }

        return realFetch(url, options);
    };
})();
