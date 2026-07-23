/**
 * request-a-quote.js — pages/request-a-quote.html (PUBLIC customer lead form)
 *
 * The structured replacement for the mailto: link — every request arrives
 * with contact info, project description, method, qty, date, and (optionally)
 * a style # verified against SanMar and an uploaded logo image. Saves as
 * formId quote-request (QRQ) → Forms Inbox + Slack lead ping.
 * Logo upload uses the public /api/image-uploads (Caspio Files); an upload
 * failure NEVER blocks the request — the lead matters more than the file.
 */
(function () {
    'use strict';

    var METHODS = [
        ['mEmbroidery', 'Embroidery'], ['mScreen', 'Screen Printing'], ['mDtg', 'DTG Print'],
        ['mDtf', 'DTF Transfers'], ['mLaser', 'Laser Engraving'], ['mPatches', 'Patches'],
        ['mNotSure', 'Not sure — help me choose'],
    ];
    var REPLY = [['rpEmail', 'Email'], ['rpCall', 'Call'], ['rpText', 'Text']];

    var logoUrl = '';
    var logoName = '';

    document.addEventListener('DOMContentLoaded', function () {
        NWCAFormDates.attach('fldNeedBy');
        NWCAFormStyles.attachRow({
            styleInput: document.getElementById('fldStyle'),
            descInput: document.getElementById('fldProduct'),
        });
        document.getElementById('fldLogoFile').addEventListener('change', uploadLogo);
        prefillFromUrl();

        NWCAPublicForm.init({
            formId: 'quote-request',
            submitId: 'submitQuoteBtn',
            required: [
                ['fldName', 'your name'],
                ['fldEmail', 'a valid email'],
                ['fldPhone', 'your phone number'],
                ['fldWhat', 'a sentence about the project'],
            ],
            build: buildSubmission,
        });
    });

    // Deep-link prefill: /request-a-quote.html?style=&product=&source= (used by
    // the Fall Catalog '26 landing page cards). Purely additive — a visitor with
    // no params sees the blank form exactly as before.
    function prefillFromUrl() {
        var p;
        try { p = new URLSearchParams(window.location.search); } catch (e) { return; }
        var style = (p.get('style') || '').trim();
        var product = (p.get('product') || '').trim();
        var source = (p.get('source') || '').trim();
        var styleEl = document.getElementById('fldStyle');
        var prodEl = document.getElementById('fldProduct');
        var whatEl = document.getElementById('fldWhat');
        if (style && styleEl && !styleEl.value) styleEl.value = style.toUpperCase();
        if (product && prodEl && !prodEl.value) prodEl.value = product;
        if (whatEl && !whatEl.value && (product || style)) {
            whatEl.value = "I'm interested in " + (product || style) +
                (style && product ? ' (' + style.toUpperCase() + ')' : '') +
                (source ? ' — from ' + source : '') +
                '. Please send decorated pricing.';
        }
    }

    function uploadLogo() {
        var input = document.getElementById('fldLogoFile');
        var status = document.getElementById('uploadStatus');
        var file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            status.textContent = 'That file is over 20 MB — email it to sales@nwcustomapparel.com instead (your request still goes through).';
            return;
        }
        var base = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL || '').replace(/\/+$/, '');
        if (!base) { status.textContent = 'Upload unavailable — email the logo instead; your request still goes through.'; return; }

        status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading ' + escapeText(file.name) + '…';
        var fd = new FormData();
        fd.append('file', file);
        fd.append('description', 'Quote request logo — ' + (NWCAPublicForm.val('fldCompany') || NWCAPublicForm.val('fldName') || 'web lead'));

        fetch(base + '/api/image-uploads', { method: 'POST', body: fd })
            .then(function (resp) { return resp.json().then(function (b) { if (!resp.ok) throw new Error(b.error || ('HTTP ' + resp.status)); return b; }); })
            .then(function (body) {
                logoUrl = (body.image && body.image.url) || '';
                logoName = file.name;
                status.innerHTML = '<i class="fas fa-circle-check ok"></i> Attached: ' + escapeText(file.name);
            })
            .catch(function (err) {
                console.error('[quote-request] upload failed:', err);
                logoUrl = '';
                logoName = '';
                status.textContent = 'Upload didn\'t work — no problem, email the logo to sales@nwcustomapparel.com. Your request still goes through.';
            });
    }

    function buildSubmission() {
        var V = NWCAPublicForm.val;
        var checksList = [];
        METHODS.concat(REPLY).forEach(function (p) {
            if (NWCAPublicForm.checked(p[0])) checksList.push(p[0].indexOf('rp') === 0 ? 'Reply by: ' + p[1] : p[1]);
        });
        var methods = METHODS.filter(function (p) { return NWCAPublicForm.checked(p[0]); }).map(function (p) { return p[1]; });

        return {
            company: V('fldCompany') || V('fldName'), // Inbox "Company" column always says who
            contactName: V('fldName'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            dueDateText: V('fldNeedBy'),
            summary: (V('fldQty') ? '~' + V('fldQty') + ' pcs · ' : '') + (methods[0] || 'method open') +
                     (V('fldStyle') ? ' · ' + V('fldStyle').toUpperCase() : '') +
                     (V('fldNeedBy') ? ' · needs ' + V('fldNeedBy') : '') +
                     (logoUrl ? ' · logo attached' : ''),
            payload: {
                fields: [
                    ['Name', V('fldName')], ['Company / Team', V('fldCompany')],
                    ['Email', V('fldEmail')], ['Phone', V('fldPhone')],
                    ['About how many pieces', V('fldQty')], ['Needed by', V('fldNeedBy')],
                    ['Style #', V('fldStyle').toUpperCase()], ['Product', V('fldProduct')],
                    ['Logo file', logoUrl ? logoName + ' — ' + logoUrl : ''],
                    ['Submitted by', 'Customer (public quote form)'],
                ],
                checks: checksList,
                tables: [],
                notes: [['Project', V('fldWhat')]],
            },
        };
    }

    function escapeText(v) {
        return String(v == null ? '' : v).replace(/[<>&"']/g, '');
    }
})();
