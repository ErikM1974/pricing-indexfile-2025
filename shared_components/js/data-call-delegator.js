/**
 * data-call-delegator.js — ONE click delegator for staff pages (Rule 3: no inline onclick=).
 *
 * Same contract as the quote-builder delegator in quote-builder-utils.js, packaged for the
 * ordinary dashboards/calculators that render markup with inline handlers:
 *
 *   <button data-call="deleteRoster" data-args='[12, "Team A"]'>      → window.deleteRoster(12, "Team A")
 *   <button data-call="dashboard.deleteRoster" data-args='[12]'>       → window.dashboard.deleteRoster(12)  (this = dashboard)
 *   <a data-href="/dashboards/leads.html">                             → location.href = …
 *   <button data-call="fn" data-args='["$this", "$event"]'>            → the clicked element / the click event
 *   data-stop="1"      stopPropagation      data-prevent="1"   preventDefault
 *   data-toggle-hidden="elementId"          toggles .hidden on that element
 *
 * `data-args` is JSON. In a JS template literal write
 *   data-args="${escapeHtml(JSON.stringify([id, name]))}"   — never a raw ${id} inside the JSON.
 * A missing global is reported loudly (toast when ToastNotifications/showToast exist, else console.error)
 * — never a silent dead click (Erik's #1 rule).
 *
 * Installs once on DOMContentLoaded (or immediately if the DOM is already parsed). Idempotent.
 */
(function () {
    'use strict';
    if (window.__nwcaDataCallDelegator) return;
    window.__nwcaDataCallDelegator = true;

    function report(msg) {
        if (window.ToastNotifications && typeof window.ToastNotifications.error === 'function') {
            window.ToastNotifications.error(msg);
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg, 'error', 6000);
        }
        console.error('[data-call] ' + msg);
    }

    function resolve(token, el, event) {
        if (token === '$this') return el;
        if (token === '$event') return event;
        if (typeof token === 'string' && token.startsWith('$this.')) {
            return token.slice(6).split('.').reduce((o, k) => (o == null ? o : o[k]), el);
        }
        return token;
    }

    function onClick(event) {
        const t = event.target;
        if (!(t instanceof Element)) return;
        const el = t.closest('[data-call], [data-href], [data-toggle-hidden]');
        if (!el) return;
        if (el.dataset.selfOnly === '1' && t !== el) return;
        if (el.dataset.stop === '1') event.stopPropagation();
        if (el.dataset.prevent === '1' || (el.tagName === 'A' && el.dataset.call && el.getAttribute('href') === '#')) event.preventDefault();

        if (el.dataset.toggleHidden) {
            const target = document.getElementById(el.dataset.toggleHidden);
            if (target) target.classList.toggle('hidden');
        }
        if (el.dataset.href) {
            window.location.href = el.dataset.href;
            return;
        }
        const name = el.dataset.call;
        if (!name) return;

        let args = [];
        if (el.dataset.args) {
            try { args = JSON.parse(el.dataset.args); } catch (e) { report(`Bad data-args on ${name}: ${el.dataset.args.slice(0, 60)}`); return; }
            if (!Array.isArray(args)) args = [args];
        }
        const path = name.split('.');
        const fn = path.reduce((o, k) => (o == null ? o : o[k]), window);
        if (typeof fn !== 'function') {
            report(`That action isn't available (${name}) — refresh the page and try again.`);
            return;
        }
        const thisObj = path.length > 1 ? path.slice(0, -1).reduce((o, k) => (o == null ? o : o[k]), window) : window;
        try {
            fn.apply(thisObj, args.map((a) => resolve(a, el, event)));
        } catch (err) {
            report(`${name} failed: ${err && err.message ? err.message : err}`);
            throw err;
        }
    }

    function install() {
        if (document.documentElement.dataset.nwcaDelegator === '1') return;
        document.documentElement.dataset.nwcaDelegator = '1';
        document.addEventListener('click', onClick);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();
