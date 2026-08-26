/* =====================================================
   STAFF DASHBOARD v3 — AUTH CONTROLLER

   Identity comes from GET /api/crm-session/me — the same first-party,
   SAML-session-backed endpoint nav-access-controller already uses.

   Until 2026-08-27 this polled a hidden third-party Caspio DataPage
   embed ([@authfield:…] placeholders + window.caspioUser) for up to
   8 seconds. That embed needed a live c3eku948.caspio.com session
   (not guaranteed — the page gate is SAML), silently failed in
   browsers blocking third-party cookies, and its runtime CSS
   injection forced the caspio-isolation.js MutationObserver hack.
   All three are retired together.
   ===================================================== */

import { store } from '../core/dashboard-store.js';

function applyUserToUI(user) {
    // Welcome message
    const welcome = document.getElementById('userWelcome');
    const name = document.getElementById('userName');
    if (welcome && name && user.firstname) {
        name.textContent = user.firstname;
        welcome.style.display = '';
    }

    // Persist for other modules (CRM session handoff, gap reports, etc.)
    store.set('user', user);

    // Mirror to legacy sessionStorage keys some downstream pages still read
    // (quote-management, art-request-detail, mockup-detail, invoice, …).
    try {
        sessionStorage.setItem('nwca_user_name', `${user.firstname || ''} ${user.lastname || ''}`.trim());
        sessionStorage.setItem('nwca_user_email', user.email || '');
        sessionStorage.setItem('nwca_user_role', user.role || '');
        sessionStorage.setItem('caspioUser', JSON.stringify(user));
    } catch { /* ignore quota/private-mode failures */ }

    // Fire a custom event so any late-loaded module can react. The event name
    // is kept from the Caspio era — listeners don't care where identity came from.
    document.dispatchEvent(new CustomEvent('caspioUserReady', { detail: user }));
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('is-hidden');
}

export async function initAuth() {
    let user = null;
    try {
        const res = await fetch('/api/crm-session/me', { credentials: 'same-origin' });
        if (res.ok) {
            const me = await res.json();
            if (me.authenticated && me.firstName) {
                const fullName = String(me.name || me.firstName);
                const lastname = fullName.startsWith(me.firstName)
                    ? fullName.slice(me.firstName.length).trim()
                    : '';
                user = {
                    firstname: me.firstName,
                    lastname,
                    email: me.email || '',
                    role: me.role || '',
                };
            }
        } else {
            console.warn('[auth] /api/crm-session/me HTTP', res.status);
        }
    } catch (err) {
        console.warn('[auth] identity fetch failed:', err.message);
    }

    if (user) {
        // Log just enough to confirm the welcome chip should light up —
        // never log the full user object (PII / email).
        console.info('[auth] session user resolved:', {
            firstname: user.firstname,
            hasEmail: !!user.email,
            role: user.role,
        });
        applyUserToUI(user);
    } else {
        console.warn('[auth] no authenticated session user — Welcome chip stays hidden.');
    }
    hideLoadingOverlay();
    return user;
}

export function getCurrentUser() {
    return store.get('user');
}
