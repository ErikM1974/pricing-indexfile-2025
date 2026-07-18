/**
 * test-leads-stub.js — fetch stub for tests/ui/test-leads.html
 *
 * Replaces window.fetch for everything the Leads CRM controller calls —
 * crm-proxy form-submissions (list + PUT), crm-session, crm-proxy order-odbc,
 * and the public company-contacts endpoints (matched by path regardless of
 * host, since DashPage.fetchJson prefixes APP_CONFIG.API.BASE_URL) — so the
 * SAML-gated page logic can be exercised without a login. PUTs mutate the
 * in-memory fixtures so status/rep/link flows click through end-to-end.
 */
(function () {
    'use strict';

    function hoursAgo(h) { return new Date(Date.now() - h * 3600000).toISOString(); }

    var leads = [
        {
            Submission_ID: 'JFL0717-4821', Form_ID: 'jotform-lead',
            Company: 'Construction Industry Training Council of Washington',
            Contact_Name: 'Alex Popescu', Phone: '(253) 433-5405', Email: 'alex@citcwa.com',
            Customer_Number: '', Sales_Rep: 'Taneisha Clark', Due_Date: '', Status: 'New',
            Summary: 'Three window decals, about 18" diameter',
            Submitted_At: hoursAgo(19), Updated_At: hoursAgo(19), Updated_By: 'jotform-webhook',
            Art_Request_ID: '', External_Source: 'jotform:21764724640151',
            External_ID: '6601205825228149933', Matched_ID_Customer: '', Linked_Quote_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [
                    ['Email', 'alex@citcwa.com'],
                    ['Company Group Or', 'Construction Industry Training Council of Washington'],
                    ['First Name', 'Alex'], ['Last Name', 'Popescu'],
                    ['Phone Number', '(253) 433-5405'],
                    ['Address1', '405 Valley Ave NW'], ['Address2', 'Suite D'],
                    ['City', 'Puyallup'], ['State', 'Washington'], ['Zip Code', '98371'],
                    ['Project Description', 'Three window decals, about 18" diameter'],
                ],
                artworkUrls: ['https://www.jotform.com/uploads/nwca/fake/CITC-Council.jpg'],
                _source: {
                    system: 'jotform', formId: '21764724640151', formTitle: 'Leads NWCA #1',
                    submissionId: '6601205825228149933',
                    url: 'https://www.jotform.com/submission/6601205825228149933',
                },
            }),
        },
        {
            Submission_ID: 'JFL0716-1234', Form_ID: 'jotform-lead', Company: 'Drain Pro Inc.',
            Contact_Name: 'Mike Rowe', Phone: '253-555-0142', Email: 'mike@drainpro.com',
            Customer_Number: '', Sales_Rep: 'Nika Lao', Due_Date: '', Status: 'Contacted',
            Summary: 'Requesting embroidery pricing for 40 caps',
            Submitted_At: hoursAgo(46), Updated_At: hoursAgo(20), Updated_By: 'jotform-webhook',
            Art_Request_ID: '', External_Source: 'jotform:220514824751149',
            External_ID: '6600981122334455667', Matched_ID_Customer: '7740', Linked_Quote_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [
                    ['Name', 'Mike Rowe'], ['E-mail', 'mike@drainpro.com'],
                    ['Phone Number', '253-555-0142'], ['Company/Group', 'Drain Pro Inc.'],
                    ['Quote Request', 'Requesting embroidery pricing for 40 caps'],
                ],
                artworkUrls: [],
                _source: {
                    system: 'jotform', formId: '220514824751149',
                    formTitle: 'NW Embroidery Information Request',
                    submissionId: '6600981122334455667',
                    url: 'https://www.jotform.com/submission/6600981122334455667',
                },
            }),
        },
        {
            Submission_ID: 'QRQ0715-8802', Form_ID: 'quote-request', Company: 'Milton Little League',
            Contact_Name: 'Sara Fields', Phone: '253-555-0110', Email: 'sara@miltonll.org',
            Customer_Number: '', Sales_Rep: '', Due_Date: '', Status: 'New',
            Summary: '60 tees · DTG · needed by Aug 5',
            Submitted_At: hoursAgo(70), Updated_At: '', Updated_By: '',
            Art_Request_ID: '', External_Source: '', External_ID: '', Matched_ID_Customer: '', Linked_Quote_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [
                    ['Company', 'Milton Little League'], ['Quantity', '60'], ['Method', 'DTG'], ['Need By', '2026-08-05'],
                    // QRQ logo uploads arrive as "Name.ext — <proxy files url>" text (like Jordan Hibbard's real lead)
                    ['Logo file', 'NWE LOGO.webp — https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/testkey-b2b2556b'],
                ],
                checks: ['DTG', 'Reply by email'],
            }),
        },
        {
            Submission_ID: 'WSR0714-3301', Form_ID: 'webstore-request', Company: 'Cascade Clinic',
            Contact_Name: 'Dr. Lee', Phone: '', Email: 'admin@cascadeclinic.com',
            Customer_Number: '', Sales_Rep: 'Taneisha Clark', Due_Date: '', Status: 'In Progress',
            Summary: 'Staff webstore · ~120 employees',
            Submitted_At: hoursAgo(96), Updated_At: '', Updated_By: '',
            Art_Request_ID: '', External_Source: '', External_ID: '', Matched_ID_Customer: '', Linked_Quote_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Company', 'Cascade Clinic'], ['Headcount', '120'], ['Launch', 'September']],
            }),
        },
        {
            Submission_ID: 'RST0713-9911', Form_ID: 'team-roster', Company: 'Puyallup Vikings',
            Contact_Name: 'Coach Bell', Phone: '253-555-0199', Email: 'coach@vikings.org',
            Customer_Number: '', Sales_Rep: 'Erik Mickelson', Due_Date: '', Status: 'Entered in ShopWorks',
            Summary: '18 names · jerseys', Submitted_At: hoursAgo(120), Updated_At: '', Updated_By: '',
            Art_Request_ID: '', External_Source: '', External_ID: '', Matched_ID_Customer: '', Linked_Quote_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Company / Team', 'Puyallup Vikings'], ['Style #', 'ST350'], ['Color', 'Purple']],
            }),
        },
        {
            Submission_ID: 'JFL0301-0042', Form_ID: 'jotform-lead', Company: 'Old Historical Lead LLC',
            Contact_Name: 'Dusty Records', Phone: '', Email: 'dusty@example.com',
            Customer_Number: '', Sales_Rep: 'Taneisha Clark', Due_Date: '', Status: 'Archived',
            Summary: 'Ancient inquiry from the backfill',
            Submitted_At: '2023-03-01T18:00:00.000Z', Updated_At: '', Updated_By: 'jotform-backfill',
            Art_Request_ID: '', External_Source: 'jotform:21764724640151',
            External_ID: '5500000000000000001', Matched_ID_Customer: '', Linked_Quote_ID: '',
            Payload_JSON: JSON.stringify({
                fields: [['Project Description', 'Ancient inquiry from the backfill']],
                _source: { system: 'jotform', formId: '21764724640151', formTitle: 'Leads NWCA #1', submissionId: '5500000000000000001', url: 'https://www.jotform.com/submission/5500000000000000001' },
            }),
        },
    ];

    var drainProContact = {
        id_Customer: 7740, Company_Name: 'Drain Pro Inc.', CustomerCompanyName: 'Drain Pro Inc.',
        Email: 'mike@drainpro.com', ContactNumbersEmail: 'mike@drainpro.com',
        Sales_Rep: 'Nika Lao', CustomerCustomerServiceRep: 'Nika Lao',
        Account_Tier: 'A', YTD_Sales: 15230.5, Is_Active: 1,
        Last_Order_Date: '2026-06-30', Customerdate_LastOrdered: '2026-06-30',
    };

    var orders = [
        { ID_Order: 130221, date_OrderPlaced: '2026-06-28T00:00:00', cnCur_TotalInvoice: 1250.75, sts_Invoiced: 1, sts_Shipped: 1 },
        { ID_Order: 129804, date_OrderPlaced: '2026-05-14T00:00:00', cnCur_TotalInvoice: 682.10, sts_Invoiced: 1, sts_Shipped: 1 },
        { ID_Order: 129377, date_OrderPlaced: '2026-04-02T00:00:00', cnCur_TotalInvoice: 2210.00, sts_Invoiced: 0, sts_Shipped: 1 },
    ];

    function jsonResponse(status, body) {
        return Promise.resolve({
            ok: status >= 200 && status < 300,
            status: status,
            statusText: String(status),
            json: function () { return Promise.resolve(body); },
        });
    }

    window.fetch = function (url, options) {
        var u = String(url);
        var method = (options && options.method || 'GET').toUpperCase();
        console.log('[leads-stub]', method, u);

        if (u.indexOf('/api/crm-session/me') !== -1) {
            return jsonResponse(200, { email: 'erik@nwcustomapparel.com' });
        }

        if (u.indexOf('/api/crm-proxy/form-submissions') !== -1) {
            if (method === 'PUT') {
                var id = decodeURIComponent(u.split('/api/crm-proxy/form-submissions/')[1].split('?')[0]);
                var lead = leads.find(function (l) { return l.Submission_ID === id; });
                if (!lead) return jsonResponse(404, { error: 'not found' });
                var body = {};
                try { body = JSON.parse(options.body || '{}'); } catch (e) { body = {}; }
                ['Status', 'Sales_Rep', 'Matched_ID_Customer', 'Linked_Quote_ID', 'Updated_By'].forEach(function (k) {
                    if (body[k] !== undefined) lead[k] = body[k];
                });
                return jsonResponse(200, { updated: id, fields: body });
            }
            var qs = u.split('?')[1] || '';
            var params = new URLSearchParams(qs);
            var statusNot = params.get('statusNot');
            var out = leads.filter(function (l) { return !statusNot || l.Status !== statusNot; });
            return jsonResponse(200, { submissions: out });
        }

        if (u.indexOf('/api/crm-proxy/order-odbc') !== -1) {
            return jsonResponse(200, orders);
        }

        if (u.indexOf('/api/company-contacts/by-email/') !== -1) {
            if (u.indexOf(encodeURIComponent('mike@drainpro.com')) !== -1 || u.indexOf('mike@drainpro.com') !== -1) {
                return jsonResponse(200, { contact: drainProContact });
            }
            return jsonResponse(404, { error: 'Contact not found' });
        }

        if (u.indexOf('/api/company-contacts/by-customer/') !== -1) {
            return jsonResponse(200, { contacts: [drainProContact] });
        }

        if (u.indexOf('/api/company-contacts/search') !== -1) {
            return jsonResponse(200, {
                contacts: [
                    drainProContact,
                    { id_Customer: 5120, CustomerCompanyName: 'WCTTR', CustomerCustomerServiceRep: 'Taneisha Clark' },
                ],
            });
        }

        return jsonResponse(404, { error: 'stub has no route for ' + u });
    };
})();
