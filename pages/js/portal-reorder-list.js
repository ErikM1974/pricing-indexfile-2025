/**
 * portal-reorder-list.js — shared multi-item "Re-order List" for the customer portal.
 *
 * Loaded on BOTH the product page and the portal home. Items are added from the
 * (method-aware) product-page re-order; the list lives in sessionStorage so it persists
 * as the customer moves between portal pages. "Send all" posts ONE batch (a shared
 * Batch_Num) to the rep as a grouped ask — NO price, NO payment. Staff preview = read-only.
 *
 * API: window.ReorderList.add(item) / .count() / .open() / .render()
 *   item = { style, color, title, method, sizeBreakdown, qty, designNumber, designName, image }
 */
(function () {
    'use strict';

    var KEY = 'nwca.reorderList.v1';
    var MAX_ITEMS = 30;   // server hard-rejects a batch of >30 (server.js returns 400); cap here so a 31st item can't be queued and blow up the whole send.
    var PREVIEW = (function () { var m = location.pathname.match(/^\/portal-admin\/preview\/(\d+)\b/); return m ? m[1] : null; })();
    var API = '/api/portal/reorder-batch'; // preview never POSTs (read-only) — guarded in send()

    function read() { try { var a = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function write(a) { try { sessionStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* private mode */ } render(); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function add(item) {
        if (!item || !item.style) return;
        var a = read();
        // Cap at MAX_ITEMS: the server 400s a batch of >30 on send, so refuse the 31st here with a
        // visible message rather than let the customer build a list that fails to send (Erik's #1 rule).
        if (a.length >= MAX_ITEMS) {
            flash('Your Re-order List is full (' + MAX_ITEMS + ' items). Send it to your rep, then add more.');
            return;
        }
        a.push({
            style: item.style, color: item.color || '', title: item.title || item.style,
            method: item.method || '', sizeBreakdown: item.sizeBreakdown || '', qty: String(item.qty || ''),
            designNumber: item.designNumber || '', designName: item.designName || '', image: item.image || ''
        });
        write(a);
        flash('Added to your Re-order List (' + a.length + ')');
    }
    function removeAt(i) { var a = read(); a.splice(i, 1); write(a); }
    function clear() { write([]); }
    function count() { return read().length; }

    // ── UI: floating button + slide-in drawer (injected once) ──
    var root = null, badge = null, drawer = null;
    function ensureUI() {
        if (root) return;
        root = document.createElement('div'); root.className = 'rl-root';
        root.innerHTML =
            '<button type="button" class="rl-fab" id="rl-fab" style="display:none;" aria-label="Open your re-order list">' +
                '&#129534; Re-order List <span class="rl-fab-badge" id="rl-badge">0</span></button>' +
            '<div class="rl-drawer" id="rl-drawer" style="display:none;"><div class="rl-panel" role="dialog" aria-label="Your re-order list">' +
                '<div class="rl-head"><span>Your Re-order List</span><button type="button" class="rl-x" id="rl-close" aria-label="Close">&times;</button></div>' +
                '<p class="rl-sub">Everything here goes to your rep as one request for a fresh quote.</p>' +
                '<div class="rl-items" id="rl-items"></div>' +
                '<label class="rl-note-l">Notes <small>(deadline, anything the team should know)</small>' +
                    '<textarea id="rl-note" rows="2" placeholder="Optional"></textarea></label>' +
                '<div class="rl-err" id="rl-err"></div>' +
                '<button type="button" class="rl-send" id="rl-send">Send all to my rep</button>' +
                '<button type="button" class="rl-cont" id="rl-cont">Keep shopping</button>' +
            '</div></div>';
        document.body.appendChild(root);
        badge = document.getElementById('rl-badge');
        drawer = document.getElementById('rl-drawer');
        document.getElementById('rl-fab').addEventListener('click', open);
        document.getElementById('rl-close').addEventListener('click', close);
        document.getElementById('rl-cont').addEventListener('click', close);
        document.getElementById('rl-send').addEventListener('click', send);
        drawer.addEventListener('click', function (e) { if (e.target === drawer) close(); }); // click backdrop to close
        document.getElementById('rl-items').addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.rl-item-x'); if (b) removeAt(parseInt(b.getAttribute('data-i'), 10) || 0);
        });
    }
    function render() {
        ensureUI();
        var a = read();
        if (badge) badge.textContent = a.length;
        var fab = document.getElementById('rl-fab');
        if (fab) fab.style.display = a.length ? 'inline-flex' : 'none';
        if (!a.length && drawer && drawer.style.display !== 'none') close();
        var box = document.getElementById('rl-items');
        if (box) box.innerHTML = a.length ? a.map(function (it, i) {
            return '<div class="rl-item">' +
                '<div class="rl-item-img">' + (it.image ? '<img src="' + esc(it.image) + '" alt="" onerror="this.remove();">' : '') + '</div>' +
                '<div class="rl-item-body"><div class="rl-item-t">' + esc(it.title) + '</div>' +
                    '<div class="rl-item-s">' + esc([it.color, it.method, (it.qty ? it.qty + ' pcs' : '')].filter(Boolean).join(' · ')) + '</div>' +
                    (it.sizeBreakdown ? '<div class="rl-item-sz">' + esc(it.sizeBreakdown) + '</div>' : '') +
                '</div>' +
                '<button type="button" class="rl-item-x" data-i="' + i + '" aria-label="Remove">&times;</button></div>';
        }).join('') : '<div class="rl-empty">Your list is empty.</div>';
    }
    function open() { ensureUI(); render(); drawer.style.display = 'flex'; }
    function close() { if (drawer) drawer.style.display = 'none'; }

    function send() {
        var a = read(); if (!a.length) return;
        var err = document.getElementById('rl-err'); err.textContent = '';
        var note = (document.getElementById('rl-note') || {}).value || '';
        if (PREVIEW) { flash('Staff preview — the customer would send ' + a.length + ' item' + (a.length === 1 ? '' : 's') + ' to their rep.'); return; }
        var btn = document.getElementById('rl-send'); btn.disabled = true; btn.textContent = 'Sending…';
        fetch(API, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: a.map(function (it) {
                    return { style: it.style, color: it.color, product_title: it.title, design_number: it.designNumber, design_name: it.designName, qty: it.qty, size_breakdown: it.sizeBreakdown, method: it.method };
                }), note: note
            })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                btn.disabled = false; btn.textContent = 'Send all to my rep';
                if (!x.ok || !x.j.ok) { err.textContent = (x.j && x.j.error) || 'Could not send. Please try again.'; return; }
                var n = x.j.count || a.length;
                clear(); close();
                flash('Sent ' + n + ' item' + (n === 1 ? '' : 's') + ' to your rep' + (x.j.rep ? ' (' + x.j.rep + ')' : '') + '! They’ll follow up with a quote.');
            })
            .catch(function () { btn.disabled = false; btn.textContent = 'Send all to my rep'; err.textContent = 'Could not send. Please try again.'; });
    }

    // Toast — reuse the portal toast (#cp-toast) if present, else a tiny inline flash.
    function flash(msg) {
        var t = document.getElementById('cp-toast');
        if (t) { t.innerHTML = esc(msg); t.className = 'cp-toast show'; setTimeout(function () { t.className = 'cp-toast'; }, 4000); return; }
        var f = document.getElementById('rl-flash');
        if (!f) { f = document.createElement('div'); f.id = 'rl-flash'; f.className = 'rl-flash'; document.body.appendChild(f); }
        f.textContent = msg; f.classList.add('show'); setTimeout(function () { f.classList.remove('show'); }, 4000);
    }

    window.ReorderList = { add: add, count: count, open: open, render: render };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
