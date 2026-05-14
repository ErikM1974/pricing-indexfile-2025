/**
 * Policies Admin Gate
 *
 * Resolves whether the current viewer can edit policies. Sets:
 *   window.IS_POLICIES_ADMIN = true | false
 *   window.POLICIES_USER     = { firstName, email } | null
 *
 * Mechanism: GET /api/crm-session/me — if response includes 'policies-admin'
 * in permissions array, edit affordances render. Otherwise read-only.
 *
 * Fires a 'policies:admin-resolved' event on document so other modules can
 * react without a polling race.
 */
(function () {
    'use strict';

    window.IS_POLICIES_ADMIN = false;
    window.POLICIES_USER = null;

    async function resolve() {
        try {
            const res = await fetch('/api/crm-session/me', { credentials: 'same-origin' });
            if (!res.ok) {
                window.IS_POLICIES_ADMIN = false;
                window.POLICIES_USER = null;
            } else {
                const data = await res.json();
                const perms = (data && data.permissions) || [];
                window.IS_POLICIES_ADMIN = perms.includes('policies-admin');
                window.POLICIES_USER = {
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || ''
                };
            }
        } catch (e) {
            console.warn('[policies-admin-gate] resolve failed:', e.message);
            window.IS_POLICIES_ADMIN = false;
            window.POLICIES_USER = null;
        }

        document.documentElement.classList.toggle('is-policies-admin', window.IS_POLICIES_ADMIN);
        document.dispatchEvent(new CustomEvent('policies:admin-resolved', {
            detail: { isAdmin: window.IS_POLICIES_ADMIN, user: window.POLICIES_USER }
        }));
    }

    // Auto-run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
    } else {
        resolve();
    }

    window.PoliciesAdminGate = { resolve };
})();
