/* Holiday discovery: public campaign details; invitations fetched only by the staff panel. */
(() => {
    'use strict';
    const panel = document.querySelector('[data-holiday-promotion]');
    if (!panel) return;
    const staff = panel.dataset.holidayPromotion === 'staff';
    const status = panel.querySelector('[data-holiday-status]');
    const retry = panel.querySelector('[data-holiday-retry]');
    const code = panel.querySelector('[data-holiday-code]');
    const copyCode = panel.querySelector('[data-holiday-copy="code"]');
    let expiresAt = 0;
    function expire() {
        if (!expiresAt || Date.now() < expiresAt) return;
        if (!staff) panel.hidden = true;
        else {
            code.textContent = 'Offer ended';
            copyCode.disabled = true;
            status.textContent = 'This holiday invitation has ended. Review existing requests in Quotes.';
        }
    }
    async function load() {
        if (retry) retry.hidden = true;
        if (staff) { code.textContent = 'Loading…'; copyCode.disabled = true; }
        try {
            const response = await fetch('/api/christmas-gift-box/' + (staff ? 'staff-invitation' : 'campaign'), {
                credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new Error('Holiday details unavailable');
            const data = await response.json();
            expiresAt = Date.parse(data.closesAt);
            if (!Number.isFinite(expiresAt) || typeof data.deadlineLabel !== 'string') throw new Error('Invalid holiday details');
            if (staff && !data.closed && (typeof data.code !== 'string' || !data.code.trim())) throw new Error('Invitation unavailable');
            if (staff) { code.textContent = data.code || 'Offer ended'; copyCode.disabled = !!data.closed; }
            status.textContent = 'Offer ends ' + data.deadlineLabel + ', Pacific time.';
            expire();
        } catch {
            if (staff) { code.textContent = 'Unavailable'; status.textContent = 'Invitation code could not load. Retry or contact Erik.'; }
            else status.textContent = 'Offer details could not load. Open the collection or contact our team.';
            if (retry) retry.hidden = false;
        }
    }
    panel.addEventListener('click', async event => {
        const button = event.target.closest('[data-holiday-copy]');
        if (!button || button.disabled) return;
        expire();
        if (button.disabled) return;
        const kind = button.dataset.holidayCopy;
        const link = panel.querySelector('[data-holiday-link]').href;
        try {
            await navigator.clipboard.writeText(kind === 'code' ? code.textContent : link);
            status.textContent = kind === 'code' ? 'Invitation code copied. Share with invited customers.' : 'Customer link copied.';
        } catch {
            status.textContent = kind === 'code' ? 'Copy was blocked. Select and copy the invitation code above.' : 'Copy was blocked. Right-click Open gift box and copy its link.';
        }
    });
    retry?.addEventListener('click', load);
    document.addEventListener('visibilitychange', expire);
    window.setInterval(expire, 60000);
    load();
})();
