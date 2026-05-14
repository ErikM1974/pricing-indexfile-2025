/**
 * Policies API Client
 *
 * Talks to two endpoints:
 *   - Public reads → caspio-pricing-proxy /api/policies-public/* (no auth)
 *   - Admin writes → local server.js /api/crm-proxy/policies/* (session + role)
 *
 * All admin calls use same-origin cookies for the Express session check.
 * 401 → redirect to staff login. 409 → conflict (optimistic concurrency).
 */
(function (global) {
    'use strict';

    const PUBLIC_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies-public';
    const ADMIN_BASE = '/api/crm-proxy/policies';

    function handleAuthError(response) {
        if (response.status === 401) {
            const here = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/dashboards/staff-login.html?redirect=${here}`;
            throw new Error('Session expired — redirecting to login.');
        }
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        handleAuthError(response);
        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            // non-JSON response — return empty
        }
        if (!response.ok) {
            const err = new Error((data && data.error) || `HTTP ${response.status}`);
            err.status = response.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    // ------------------ PUBLIC reads ------------------
    async function listPolicies({ category, parent } = {}) {
        const url = new URL(PUBLIC_BASE + '/');
        if (category) url.searchParams.set('category', category);
        if (parent !== undefined) url.searchParams.set('parent', parent);
        return fetchJson(url.toString());
    }

    async function getTree() {
        return fetchJson(PUBLIC_BASE + '/tree');
    }

    async function getPolicy(policyId) {
        return fetchJson(`${PUBLIC_BASE}/${encodeURIComponent(policyId)}`);
    }

    async function searchPolicies(q) {
        const url = new URL(PUBLIC_BASE + '/search');
        url.searchParams.set('q', q);
        return fetchJson(url.toString());
    }

    // ------------------ ADMIN reads (sees drafts too) ------------------
    async function adminListPolicies({ category, parent, status } = {}) {
        const url = new URL(ADMIN_BASE, window.location.origin);
        if (category) url.searchParams.set('category', category);
        if (parent !== undefined) url.searchParams.set('parent', parent);
        if (status) url.searchParams.set('status', status);
        return fetchJson(url.toString(), { credentials: 'same-origin' });
    }

    async function adminGetTree() {
        return fetchJson(ADMIN_BASE + '/tree', { credentials: 'same-origin' });
    }

    async function adminGetPolicy(policyId) {
        return fetchJson(`${ADMIN_BASE}/${encodeURIComponent(policyId)}`, { credentials: 'same-origin' });
    }

    // ------------------ ADMIN writes ------------------
    async function createPolicy(record) {
        return fetchJson(ADMIN_BASE, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
    }

    async function updatePolicy(policyId, patch, { ifMatch } = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (ifMatch) headers['If-Match'] = ifMatch;
        return fetchJson(`${ADMIN_BASE}/${encodeURIComponent(policyId)}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify(patch)
        });
    }

    async function archivePolicy(policyId) {
        return fetchJson(`${ADMIN_BASE}/${encodeURIComponent(policyId)}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
    }

    async function movePolicy(policyId, { parent_policy_id, sort_order } = {}) {
        return fetchJson(`${ADMIN_BASE}/${encodeURIComponent(policyId)}/move`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_policy_id, sort_order })
        });
    }

    global.PoliciesAPI = {
        // public
        listPolicies,
        getTree,
        getPolicy,
        searchPolicies,
        // admin reads
        adminListPolicies,
        adminGetTree,
        adminGetPolicy,
        // admin writes
        createPolicy,
        updatePolicy,
        archivePolicy,
        movePolicy
    };
})(window);
