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
 *   <select data-change="manualCalc.onTypeChange" data-change-args='["$this"]'>  → called on `change`
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
        const el = t.closest('[data-call], [data-href], [data-open], [data-toggle-hidden], [data-stop]');
        if (!el) return;
        if (el.dataset.selfOnly === '1' && t !== el) return;
        if (el.dataset.stop === '1') event.stopPropagation();
        if (el.dataset.prevent === '1' || (el.tagName === 'A' && el.dataset.call && el.getAttribute('href') === '#')) event.preventDefault();

        if (el.dataset.toggleHidden) {
            const target = document.getElementById(el.dataset.toggleHidden);
            if (target) target.classList.toggle('hidden');
        }
        if (el.dataset.open) { window.open(el.dataset.open, '_blank', 'noopener'); return; }
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

    function onChange(event) {
        const t = event.target;
        if (!(t instanceof Element)) return;
        const el = t.closest('[data-change]');
        if (!el) return;
        const name = el.dataset.change;
        let args = [];
        if (el.dataset.changeArgs) {
            try { args = JSON.parse(el.dataset.changeArgs); } catch (e) { report(`Bad data-change-args on ${name}`); return; }
            if (!Array.isArray(args)) args = [args];
        }
        const path = name.split('.');
        const fn = path.reduce((o, k) => (o == null ? o : o[k]), window);
        if (typeof fn !== 'function') { report(`That action isn't available (${name}) — refresh the page and try again.`); return; }
        const thisObj = path.length > 1 ? path.slice(0, -1).reduce((o, k) => (o == null ? o : o[k]), window) : window;
        fn.apply(thisObj, args.map((a) => resolve(a, el, event)));
    }

    // 2026-09-06: input events, new-tab opens and image load/error outcomes — the last inline-handler
    // forms left on the staff pages (garment designer, AE dashboard, pride wall).
    //   <input data-input="fn" data-input-args='[…]'>        → fn(...) on every input event
    //   <button data-open="/path">                            → window.open(path, '_blank', 'noopener')
    //   <img data-onerror="hide|hide-parent|closest-class|parent-remove-class|call:obj.fn"
    //        data-onerror-closest=".sel" data-onerror-class="x" data-onerror-else="hide-parent">
    //   <img data-onload="parent-remove-class" data-onload-class="x">
    function onInput(event) {
        const t = event.target;
        if (!(t instanceof Element)) return;
        const el = t.closest('[data-input]');
        if (!el) return;
        const name = el.dataset.input;
        let args = [];
        if (el.dataset.inputArgs) {
            try { args = JSON.parse(el.dataset.inputArgs); } catch (e) { report(`Bad data-input-args on ${name}`); return; }
            if (!Array.isArray(args)) args = [args];
        }
        const path = name.split('.');
        const fn = path.reduce((o, k) => (o == null ? o : o[k]), window);
        if (typeof fn !== 'function') { report(`That action isn't available (${name}) — refresh the page and try again.`); return; }
        const thisObj = path.length > 1 ? path.slice(0, -1).reduce((o, k) => (o == null ? o : o[k]), window) : window;
        fn.apply(thisObj, args.map((a) => resolve(a, el, event)));
    }
    function imgOutcome(img, mode, ds) {
        if (!mode) return;
        if (mode.startsWith('call:')) {
            const fn = mode.slice(5).split('.').reduce((o, k) => (o == null ? o : o[k]), window);
            if (typeof fn === 'function') { fn(img); return; }
            mode = ds.onerrorElse || '';
        }
        if (mode === 'hide') img.hidden = true;
        else if (mode === 'hide-parent' && img.parentElement) img.parentElement.hidden = true;
        else if (mode === 'closest-class') { const t = ds.onerrorClosest && img.closest(ds.onerrorClosest); if (t && ds.onerrorClass) t.classList.add(ds.onerrorClass); }
        else if (mode === 'parent-remove-class' && img.parentElement && ds.onerrorClass) img.parentElement.classList.remove(ds.onerrorClass);
    }
    function onImgError(event) {
        const img = event.target;
        if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.onerror) return;
        imgOutcome(img, img.dataset.onerror, img.dataset);
        if (img.dataset.onerrorHtml && img.parentElement) img.parentElement.innerHTML = img.dataset.onerrorHtml;
    }
    function onImgLoad(event) {
        const img = event.target;
        if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.onload) return;
        if (img.dataset.onload === 'parent-remove-class' && img.parentElement && img.dataset.onloadClass) img.parentElement.classList.remove(img.dataset.onloadClass);
    }
    function install() {
        if (document.documentElement.dataset.nwcaDelegator === '1') return;
        document.documentElement.dataset.nwcaDelegator = '1';
        document.addEventListener('click', onClick);
        document.addEventListener('change', onChange);
        document.addEventListener('input', onInput);
        document.addEventListener('error', onImgError, true);
        document.addEventListener('load', onImgLoad, true);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();
