/**
 * past-due-badge.js — live count on the sidebar's "Past Due Orders" link.
 *
 * Three states, and the distinction between the last two is the whole point:
 *   alert   — one or more orders past due. Red pill with the count; the section's clock
 *             icon becomes a red alert triangle (CSS, via data-pastdue).
 *   clear   — a CONFIRMED zero. Green "All clear" pill, so nobody has to open the page
 *             to find out there is nothing there.
 *   unknown — could not fetch. NO badge at all.
 *
 * 🔴 "unknown" must never render as "clear". A green all-clear that appears because the
 * request failed is the exact shape of Erik's #1 rule — silently telling someone
 * everything is fine when we have no idea. Failing to a blank slot is the safe direction:
 * it looks unfinished, which is what it is.
 *
 * Same-origin fetch on purpose — /api/crm-proxy/* is a requireStaff forwarder on this
 * server that adds the CRM secret. It is NOT the Heroku proxy base.
 */
(function () {
    'use strict';

    var ENDPOINT = '/api/crm-proxy/ae-dashboard/due-dates-all?days=30';
    var REFRESH_MS = 10 * 60 * 1000;   // the server caches 10 min; polling faster buys nothing

    document.addEventListener('DOMContentLoaded', function () {
        update();
        setInterval(function () {
            // A background tab polling every 10 minutes for hours is pure waste, and the
            // count is only interesting when someone is actually looking at the sidebar.
            if (!document.hidden) update();
        }, REFRESH_MS);
        // Coming back to the tab is exactly when a stale count matters.
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) update();
        });
    });

    async function update() {
        var badge = document.getElementById('nav-pd-badge');
        var section = document.querySelector('.nav-section[data-section="past-due-orders"]');
        if (!badge || !section) return;
        try {
            var resp = await fetch(ENDPOINT, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (data.error) throw new Error(data.error);
            var n = (data.counts && typeof data.counts.late === 'number') ? data.counts.late : null;
            if (n === null) throw new Error('no count in payload');
            paint(section, badge, n);
        } catch (err) {
            // Deliberately quiet in the UI — this is a sidebar ornament, not the page.
            // Clear any previous state so a stale count can't linger after a failure.
            console.warn('[past-due-badge] count unavailable:', err.message);
            section.removeAttribute('data-pastdue');
            badge.hidden = true;
            badge.textContent = '';
            badge.className = 'nav-pd-badge';
        }
    }

    function paint(section, badge, n) {
        badge.hidden = false;
        if (n > 0) {
            section.setAttribute('data-pastdue', 'alert');
            badge.className = 'nav-pd-badge nav-pd-badge--alert';
            badge.textContent = String(n);
            badge.setAttribute('title', n + (n === 1 ? ' order is' : ' orders are') + ' past due');
        } else {
            section.setAttribute('data-pastdue', 'clear');
            badge.className = 'nav-pd-badge nav-pd-badge--clear';
            badge.textContent = 'All clear';
            badge.setAttribute('title', 'Nothing past due in the last 30 days');
        }
    }
})();
