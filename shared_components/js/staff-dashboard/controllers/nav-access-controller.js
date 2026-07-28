/* =====================================================
   STAFF DASHBOARD v3 — NAV ACCESS CONTROLLER (2026-07-28)

   Role-aware sidebar. Any element carrying `data-requires-role="a,b"` ships
   `hidden` in the markup and is revealed only when GET /api/crm-session/me
   reports a matching permission. Today that's the Administration section.

   ⚠ THIS IS A UX LAYER, NOT SECURITY. The real gate is server-side:
   gateStaffPage + the Caspio Staff_Page_Access table, plus the explicit
   requireCrmRole / requireCrmEmail routes in server.js. Anyone can edit the
   DOM; nobody can edit the session. Never move a gate here.

   Two deliberate choices:

   1. REMOVE, don't hide. The Ctrl+K command palette harvests its registry
      from the live DOM (command-palette-controller.js → harvestRegistry) and
      re-harvests on every open, so a removed node stays out of search too.
      A merely-hidden node would still be findable by name.

   2. FAIL CLOSED. A failed or unauthenticated check yields no permissions, so
      the gated block is removed. Consistent with the server's own rule
      ("deny, never grant wrong access" — permissionsFromRole). The pages stay
      reachable by URL for a real admin, so a transient blip costs discovery,
      never access; it's logged loudly rather than swallowed.
   ===================================================== */

const ME_ENDPOINT = '/api/crm-session/me';

async function fetchPermissions() {
    const res = await fetch(ME_ENDPOINT, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const me = await res.json();
    if (!me || !me.authenticated) return [];
    return (me.permissions || []).map((p) => String(p).toLowerCase());
}

function requiredRoles(el) {
    return String(el.dataset.requiresRole || '')
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

export async function initNavAccess() {
    const gated = document.querySelectorAll('[data-requires-role]');
    if (!gated.length) return [];

    let permissions = [];
    try {
        permissions = await fetchPermissions();
    } catch (err) {
        // Loud, never silent — but still fail closed (see header note).
        console.error(
            '[nav-access] Permission check failed; role-gated nav stays hidden. ' +
            'Gated pages remain reachable by direct URL for anyone the server allows.',
            err
        );
    }

    gated.forEach((el) => {
        const needed = requiredRoles(el);
        const allowed = needed.length > 0 && needed.some((r) => permissions.includes(r));
        if (allowed) {
            el.hidden = false;
        } else {
            el.remove();
        }
    });

    return permissions;
}
