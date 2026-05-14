/**
 * Policies Admin Gate
 *
 * Resolves whether the current viewer can edit policies. Sets:
 *   window.IS_POLICIES_ADMIN = true | false
 *   window.POLICIES_USER     = { firstName, email } | null
 *
 * Three-step resolution (fastest first):
 *   1. GET /api/crm-session/me — if Express CRM session already has
 *      'policies-admin' in permissions, done.
 *   2. sessionStorage check — staff-dashboard.html stamps `nwca_user_name`
 *      and `nwca_user_email` when the user logs in. If present, POST
 *      /api/crm-session immediately to bootstrap. This is the normal path
 *      for anyone who got here via the staff dashboard.
 *   3. Caspio embed wait — if no sessionStorage, wait up to 3s for the
 *      Caspio [@authfield] placeholders to populate, then bootstrap. This
 *      is the cold-start path (visit policies-hub.html directly without
 *      logging in to staff dashboard first).
 *
 * Fires 'policies:admin-resolved' event on document so other modules can
 * react without polling. Verbose console logs (`[admin-gate]`) make
 * production debugging straightforward.
 */
(function () {
    'use strict';

    window.IS_POLICIES_ADMIN = false;
    window.POLICIES_USER = null;

    const log = (...args) => console.log('[admin-gate]', ...args);

    function readSessionStorage() {
        const name = sessionStorage.getItem('nwca_user_name') || '';
        const email = sessionStorage.getItem('nwca_user_email') || '';
        if (!name && !email) return null;
        const parts = name.split(/\s+/);
        return {
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' '),
            email
        };
    }

    function readCaspioAuth() {
        const fn = document.getElementById('auth-firstname')?.textContent?.trim() || '';
        const ln = document.getElementById('auth-lastname')?.textContent?.trim() || '';
        const em = document.getElementById('auth-email')?.textContent?.trim() || '';

        // Caspio renders literal `[@authfield:First_Name]` when not signed in
        // OR when the embed script hasn't replaced placeholders yet.
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

    async function bootstrapSession(user) {
        try {
            const fullName = user.firstName + (user.lastName ? ' ' + user.lastName : '');
            log('bootstrap → POST /api/crm-session', { name: fullName, email: user.email });
            const res = await fetch('/api/crm-session', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: fullName, email: user.email })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                log('bootstrap failed', res.status, data);
                return false;
            }
            log('bootstrap ok', data);
            return true;
        } catch (e) {
            log('bootstrap error', e);
            return false;
        }
    }

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
        // 1) Existing Express session?
        let me = await fetchMe();
        log('initial /me', me);

        // 2) Not authenticated → try sessionStorage (fast path, staff-dashboard set it)
        if (!me?.authenticated) {
            const ssUser = readSessionStorage();
            if (ssUser?.firstName) {
                log('sessionStorage user found', ssUser);
                const ok = await bootstrapSession(ssUser);
                if (ok) me = await fetchMe();
                log('after sessionStorage bootstrap /me', me);
            }
        }

        // 3) Still not authenticated → wait for Caspio embed (cold start)
        if (!me?.authenticated && document.getElementById('auth-firstname')) {
            log('waiting for Caspio embed…');
            const cu = await waitForCaspio();
            if (cu) {
                log('Caspio embed user found', cu);
                const ok = await bootstrapSession(cu);
                if (ok) me = await fetchMe();
                log('after Caspio bootstrap /me', me);
            } else {
                log('Caspio embed timeout — no auth available');
            }
        }

        const perms = (me && me.permissions) || [];
        window.IS_POLICIES_ADMIN = perms.includes('policies-admin');
        window.POLICIES_USER = me?.authenticated ? {
            firstName: me.firstName || '',
            lastName: me.lastName || '',
            email: me.email || ''
        } : null;

        log('resolved', { isAdmin: window.IS_POLICIES_ADMIN, user: window.POLICIES_USER });

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
