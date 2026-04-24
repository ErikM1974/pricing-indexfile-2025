/* Steve's Dashboard — Send to Supacolor button handler
 *
 * Steve's gallery is a Caspio DataPage embed, so we can't add per-card buttons.
 * Instead, header-level button asks for a design number, looks up the ArtRequest
 * to prefill company/customer/rep, then opens the shared Send-to-Supacolor modal.
 *
 * Depends on: transfer-actions-shared.js (window.TransferActions)
 */

(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Steve is always Steve on this dashboard — preset identity so the modal doesn't prompt
    var STEVE_USER = {
        email: 'steve@nwcustomapparel.com',
        name: 'Steve Deland'
    };

    async function lookupArtRequest(designNumber) {
        try {
            var url = API_BASE + '/api/artrequests?designNumber=' + encodeURIComponent(designNumber) + '&limit=1';
            var resp = await fetch(url);
            if (!resp.ok) return null;
            var data = await resp.json();
            var records = data.records || data.Result || [];
            return records[0] || null;
        } catch (err) {
            console.warn('ArtRequest lookup failed (non-fatal):', err);
            return null;
        }
    }

    async function onSendSupacolorClick() {
        if (!window.TransferActions) {
            alert('TransferActions helper not loaded. Please refresh.');
            return;
        }

        var designNumber = prompt('Enter the Design Number to send to Supacolor:');
        if (!designNumber) return;
        designNumber = String(designNumber).trim();
        if (!designNumber) return;

        // Best-effort ArtRequests lookup for prefill. Transfer can still be created without it.
        var art = await lookupArtRequest(designNumber);
        var prefill = {};
        if (art) {
            if (art.CompanyName || art.Company_Name) prefill.Company_Name = art.CompanyName || art.Company_Name;
            if (art.CustomerName || art.Customer_Name) prefill.Customer_Name = art.CustomerName || art.Customer_Name;
            if (art.Sales_Rep || art.User_Email) {
                prefill.Sales_Rep_Email = art.Sales_Rep || art.User_Email;
                prefill.Sales_Rep_Name = art.Sales_Rep_Name || prefill.Sales_Rep_Email;
            }
        } else {
            // L6 — Previously silent: user saw an empty modal and wondered why no
            // prefill. Now they get a console breadcrumb for debugging, and the
            // modal still opens so they can fill details manually.
            console.warn('[steve-send-supacolor] No ArtRequest found for Design #' + designNumber +
                ' — opening modal with empty prefill. User must fill Company / Rep manually.');
        }

        window.TransferActions.openSendModal({
            designNumber: designNumber,
            designId: art ? (art.ID_Design || art.PK_ID) : undefined,
            prefill: prefill,
            requestedBy: STEVE_USER,
            // Steve's dashboard is the canonical multi-line caller — enable the line repeater.
            // Mockup-detail and art-request-detail callers default to enableLines:false (single-line).
            enableLines: true,
            onSuccess: function (record) {
                console.log('Transfer created:', record.ID_Transfer);
            }
        });
    }

    function init() {
        var btn = document.getElementById('steve-send-supacolor-btn');
        if (!btn) return;
        btn.addEventListener('click', onSendSupacolorClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
