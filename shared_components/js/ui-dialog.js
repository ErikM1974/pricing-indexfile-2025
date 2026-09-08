/* Dialog behavior for migrated UI: focus, one-level dismissal and scroll restoration.
 * Existing pages opt in by loading this helper and calling UiDialog.open/close.
 * Business-specific dismissal/cleanup remains in the caller's onDismiss callback.
 */
(function (global) {
    'use strict';
    var stack = [];
    var previousOverflow = '';
    var inertChanges = [];
    var headingCount = 0;
    var focusSelector = 'a[href], button, input, select, textarea, [tabindex], summary';

    function element(value) {
        return typeof value === 'string' ? document.getElementById(value) : value;
    }

    function focusable(dialog) {
        return Array.prototype.filter.call(dialog.querySelectorAll(focusSelector), function (node) {
            return !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0 && !node.closest('[inert]');
        });
    }

    function restoreBackground() {
        inertChanges.forEach(function (item) { item.node.inert = item.previous; });
        inertChanges = [];
    }

    function updateBackground() {
        restoreBackground();
        if (!stack.length) return;
        var host = stack[stack.length - 1].host;
        Array.prototype.forEach.call(document.body.children, function (node) {
            if (node === host || node.contains(host) || /^(SCRIPT|STYLE|LINK)$/.test(node.tagName)) return;
            inertChanges.push({ node: node, previous: node.inert });
            node.inert = true;
        });
    }

    function focusInside(entry) {
        var requested = typeof entry.options.focus === 'string' ? entry.dialog.querySelector(entry.options.focus) : entry.options.focus;
        var target = requested && requested.getClientRects().length ? requested : focusable(entry.dialog)[0] || entry.dialog;
        target.focus({ preventScroll: true });
    }

    function open(value, options) {
        var host = element(value);
        if (!host) return;
        var found = stack.find(function (entry) { return entry.host === host; });
        if (found) { focusInside(found); return; }
        options = options || {};
        var dialog = options.dialog || (host.getAttribute('role') === 'dialog' ? host : host.querySelector('[role="dialog"], .bt-modal-content, .tas-modal-content, .product-image-modal-content')) || host;
        if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
            var heading = dialog.querySelector('h1, h2, h3');
            if (heading) {
                if (!heading.id) heading.id = 'ui-dialog-heading-' + (++headingCount);
                dialog.setAttribute('aria-labelledby', heading.id);
            }
        }
        if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
        var entry = { host: host, dialog: dialog, options: options, returnFocus: document.activeElement };
        if (!stack.length) previousOverflow = document.body.style.overflow;
        stack.push(entry);
        host.hidden = false;
        document.body.style.overflow = 'hidden';
        updateBackground();
        focusInside(entry);
    }

    function close(value) {
        var host = element(value);
        if (!host) return;
        var index = stack.findIndex(function (entry) { return entry.host === host; });
        host.hidden = true;
        if (index < 0) return;
        var entry = stack[index];
        // Closing a containing dialog also closes its nested overlays.
        stack.slice(index + 1).reverse().forEach(function (nested) {
            if (nested.options.onDismiss) nested.options.onDismiss();
            else close(nested.host);
        });
        stack.splice(index);
        updateBackground();
        if (!stack.length) document.body.style.overflow = previousOverflow;
        if (entry.returnFocus && entry.returnFocus.isConnected && entry.returnFocus.getClientRects().length && !entry.returnFocus.closest('[inert]')) {
            entry.returnFocus.focus({ preventScroll: true });
        } else if (stack.length) {
            focusInside(stack[stack.length - 1]);
        }
    }

    document.addEventListener('keydown', function (event) {
        if (!stack.length) return;
        var entry = stack[stack.length - 1];
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (entry.options.dismissible === false) return;
            if (entry.options.onDismiss) entry.options.onDismiss();
            else close(entry.host);
        } else if (event.key === 'Tab') {
            var controls = focusable(entry.dialog);
            var first = controls[0] || entry.dialog;
            var last = controls[controls.length - 1] || entry.dialog;
            if (!entry.dialog.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first) || !controls.length) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        }
    });

    global.UiDialog = { open: open, close: close };
}(window));
