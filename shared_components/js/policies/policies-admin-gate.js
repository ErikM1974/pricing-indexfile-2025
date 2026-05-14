/**
 * Policies Admin Gate
 *
 * Resolves whether the current viewer can edit policies. Sets:
 *   window.IS_POLICIES_ADMIN = true | false
 *   window.POLICIES_USER     = { firstName, email } | null
 *
 * Two-step flow:
 *   1. GET /api/crm-session/me — if Express CRM session already exists and
 *      includes 'policies-admin' in permissions, we're done.
 *   2. If session not established but the page has the Caspio auth embed
 *      (#auth-firstname etc.) populated, POST /api/crm-session to bootstrap
 *      the session, then re-fetch /me. This lets logged-in Caspio users
 *      (like Erik) get admin affordances on the Policies Hub without first
 *      visiting one of the legacy CRM dashboards.
 *
 * Fires a 'policies:admin-resolved' event on document so other modules can
 * react without a polling race.
 */
(function () {
    'use strict';

    window.IS_POLICIES_ADMIN = false;
    window.POLICIES_USER = null;

    function readCaspioAuth() {
        const fn = document.getElementById('auth-firstname')?.textContent?.trim() || '';
        const ln = document.getElementById('auth-lastname')?.textContent?.trim() || '';
        const em = document.getElementById('auth-email')?.textContent?.trim() || '';

        // Caspio renders `[@authfield:First_Name]` literal if the user is NOT
        // signed in (or the embed hasn't loaded yet). Treat those as empty.
        const isReal = v => v && !v.includes('@authfield') && !v.includes('[@auth');

        if (!isReal(fn)) return null;
        return {
            firstName: fn,
            lastName: isReal(ln) ? ln : '',
            email: isReal(em) ? em : ''
        };
    }

    async function fetchMe() {
        try {
            const res = await fetch('/api/crm-session/me', { credentials: 'same-origin' });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    async function bootstrapSession(caspioUser) {
        try {
            const fullName = caspioUser.firstName + (caspioUser.lastName ? ' ' + caspioUser.lastName : '');
            const res = await fetch('/api/crm-session', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: fullName, email: caspioUser.email })
            });
            if (!res.ok) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Caspio's embed script populates the auth fields asynchronously. Poll
    // for up to ~3s before giving up — the embed usually lands in <500ms.
    function waitForCaspio(timeoutMs = 3000) {
        return new Promise(resolve => {
            const start = Date.now();
            const tick = () => {
                const user = readCaspioAuth();
                if (user) return resolve(user);
                if (Date.now() - start >= timeoutMs) return resolve(null);
                setTimeout(tick, 150);
            };
            tick();
        });
    }

    async function resolve() {
        // 1) Check existing Express session
        let me = await fetchMe();

        // 2) If not authenticated and the page embeds Caspio auth,
        //    try to bootstrap an Express session from it.
        if (!me?.authenticated && document.getElementById('auth-firstname')) {
            const caspioUser = await waitForCaspio();
            if (caspioUser) {
                const ok = await bootstrapSession(caspioUser);
                if (ok) me = await fetchMe();
            }
        }

        const perms = (me && me.permissions) || [];
        window.IS_POLICIES_ADMIN = perms.includes('policies-admin');
        window.POLICIES_USER = me?.authenticated ? {
            firstName: me.firstName || '',
            lastName: me.lastName || '',
            email: me.email || ''
        } : null;

        document.documentElement.classList.toggle('is-policies-admin', window.IS_POLICIES_ADMIN);
        document.dispatchEvent(new CustomEvent('policies:admin-resolved', {
            detail: { isAdmin: window.IS_POLICIES_ADMIN, user: window.POLICIES_USER }
        }));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
    } else {
        resolve();
    }

    window.PoliciesAdminGate = { resolve };
})();
