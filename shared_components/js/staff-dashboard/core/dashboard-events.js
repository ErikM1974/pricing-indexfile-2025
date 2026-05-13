/* =====================================================
   STAFF DASHBOARD v3 — DELEGATED EVENT ROUTER
   Replaces inline `onclick=` attributes (Rule #3 violation).

   Markup:  <button data-action="metrics:refresh">…</button>
   Listen:  events.register('metrics:refresh', (el, e) => …)

   Why delegated: the dashboard rebuilds entire sections via
   innerHTML, which would orphan listeners attached directly.
   Delegation is immune to innerHTML re-renders.
   ===================================================== */

const handlers = new Map();

let installed = false;

function dispatch(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const handler = handlers.get(action);
    if (!handler) return;

    try {
        handler(el, e);
    } catch (err) {
        console.error(`[dashboard-events] Handler "${action}" threw:`, err);
    }
}

/**
 * Register a handler for a `data-action` value.
 * Calling register() twice for the same action overwrites — handy
 * during hot-reload / incremental refactor; warn so accidental
 * duplicates aren't silent.
 */
export function register(action, fn) {
    if (typeof action !== 'string' || !action) {
        throw new Error('[dashboard-events] register(action, fn) — action must be non-empty string');
    }
    if (typeof fn !== 'function') {
        throw new Error(`[dashboard-events] register("${action}", fn) — fn must be a function`);
    }
    if (handlers.has(action)) {
        console.warn(`[dashboard-events] Overwriting handler for "${action}"`);
    }
    handlers.set(action, fn);
}

/**
 * Remove a registered handler.
 */
export function unregister(action) {
    handlers.delete(action);
}

/**
 * Install the document-level click delegator. Idempotent.
 * Auto-installed on module load.
 */
export function install() {
    if (installed) return;
    document.addEventListener('click', dispatch);
    installed = true;
}

/**
 * For tests / cleanup.
 */
export function uninstall() {
    if (!installed) return;
    document.removeEventListener('click', dispatch);
    installed = false;
    handlers.clear();
}

// Auto-install when the module loads
if (typeof document !== 'undefined') {
    install();
}

export const events = { register, unregister, install, uninstall };
