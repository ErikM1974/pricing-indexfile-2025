/* =====================================================
   STAFF DASHBOARD v3 — AUTH CONTROLLER
   Lifts the inline auth code out of staff-dashboard.html (Rule #3).

   The hidden Caspio DataPage at #caspio-auth populates four fields
   via the `[@authfield:...]` placeholder pattern. Once the DataPage
   fires its `DataPageReady` event, those fields contain the user's
   First_Name / Last_Name / Email / Role. We poll briefly with a
   timeout fallback because some Caspio loads race the DOMContentLoaded.
   ===================================================== */

import { store } from '../core/dashboard-store.js';

const POLL_INTERVAL = 500;
const POLL_TIMEOUT_MS = 8000;
const AUTH_FIELDS = ['firstname', 'lastname', 'email', 'role'];

function readAuthFields() {
    const result = {};
    for (const field of AUTH_FIELDS) {
        const el = document.getElementById(`auth-${field}`);
        const text = el?.textContent?.trim() || '';
        // Caspio leaves the placeholder text if the field hasn't been resolved yet
        if (!text || text.startsWith('[@authfield:')) return null;
        result[field] = text;
    }
    return result;
}

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
    try {
        sessionStorage.setItem('nwca_user_name', `${user.firstname || ''} ${user.lastname || ''}`.trim());
        sessionStorage.setItem('nwca_user_email', user.email || '');
        sessionStorage.setItem('nwca_user_role', user.role || '');
        sessionStorage.setItem('caspioUser', JSON.stringify(user));
    } catch { /* ignore quota/private-mode failures */ }

    // Fire a custom event so any late-loaded module can react
    document.dispatchEvent(new CustomEvent('caspioUserReady', { detail: user }));
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('is-hidden');
}

/**
 * Wait for Caspio auth fields to populate.
 * Returns the user object, or null if it never resolves.
 */
function waitForAuth() {
    return new Promise((resolve) => {
        // Try immediately
        const immediate = readAuthFields();
        if (immediate) return resolve(immediate);

        const start = Date.now();
        const interval = setInterval(() => {
            const user = readAuthFields();
            if (user) {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve(user);
            }
        }, POLL_INTERVAL);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            console.warn(`[auth] Caspio auth didn't resolve within ${POLL_TIMEOUT_MS}ms — proceeding without user.`);
            resolve(null);
        }, POLL_TIMEOUT_MS);

        // Caspio fires this when it's done injecting field values
        document.addEventListener('DataPageReady', () => {
            const user = readAuthFields();
            if (user) {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve(user);
            }
        }, { once: true });
    });
}

export async function initAuth() {
    const user = await waitForAuth();
    if (user) {
        applyUserToUI(user);
    }
    hideLoadingOverlay();
    return user;
}

export function getCurrentUser() {
    return store.get('user');
}
