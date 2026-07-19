/**
 * test-unqualified-leads-stub.js — fetch stub for the Unqualified & Spam harness.
 * Serves fixture rows for /api/crm-proxy/form-submissions?category=spam|unqualified.
 */
(function () {
    'use strict';
    var SPAM = [
        { Submission_ID: 'JFL0622-9245', Company: 'Eagle Stitches LLC', Contact_Name: 'George Ryan', Email: 'george.eaglestitches@gmail.com', Summary: 'Dear Customer, we welcome you to our digitizing family…', Submitted_At: '2026-06-22T10:00:00' },
        { Submission_ID: 'JFL0603-9954', Company: 'Animated Explainer', Contact_Name: 'Chris Grayson', Email: 'chris@animateddexplainers.com', Summary: 'If your audience doesn’t understand your offer in seconds…', Submitted_At: '2026-06-03T10:00:00' },
        { Submission_ID: 'JFL0510-1000', Company: 'Sky Ltd', Contact_Name: 'Abdul Ahmed Saidik', Email: 'sky@example.com', Summary: 'Can you supply one million pieces of T-shirts and Caps', Submitted_At: '2026-05-10T10:00:00' },
    ];
    var UNQ = [
        { Submission_ID: 'JFL0607-3441', Company: 'None', Contact_Name: 'Dan Rahme', Email: 'bigzib79@yahoo.com', Summary: 'Looking for 1 die cut sticker to put on my camper', Submitted_At: '2026-06-07T10:00:00' },
        { Submission_ID: 'JFL0529-1037b', Company: 'Self', Contact_Name: 'Troy Vigil', Email: 'troy@example.com', Summary: 'PGA professional, need my golf bag embroidered with my name', Submitted_At: '2026-05-29T10:00:00' },
    ];
    window.fetch = function (url) {
        var u = String(url);
        if (u.indexOf('/api/crm-proxy/form-submissions') === -1) {
            return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({ error: 'stub: ' + u }); } });
        }
        var cat = (new URLSearchParams(u.split('?')[1] || '')).get('category');
        var rows = cat === 'spam' ? SPAM : cat === 'unqualified' ? UNQ : [];
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ submissions: rows }); } });
    };
})();
