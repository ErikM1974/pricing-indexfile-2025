/* webstore-info.js — page script (extracted from inline <script>, Rule 3, 2026-09-05).
 * FAQ accordion (keyboard + aria-expanded), sample-store image modal (dialog, Esc, focus return),
 * smooth anchor scroll. */
(function () {
    'use strict';
    var modal = document.getElementById('imageModal');
    var returnFocus = null;

    function setFaq(q, open) {
        var item = q.parentElement;
        item.classList.toggle('active', open);
        q.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    document.querySelectorAll('.faq-question').forEach(function (q) {
        q.addEventListener('click', function () { setFaq(q, !q.parentElement.classList.contains('active')); });
        q.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q.click(); }
        });
    });

    function openModal() {
        if (!modal) return;
        returnFocus = document.activeElement;
        modal.classList.add('active');
        var c = modal.querySelector('.modal-close');
        if (c) setTimeout(function () { c.focus(); }, 30);
    }
    function closeModal() {
        if (!modal || !modal.classList.contains('active')) return;
        modal.classList.remove('active');
        if (returnFocus && document.body.contains(returnFocus)) { try { returnFocus.focus(); } catch (e) { /* gone */ } }
        returnFocus = null;
    }
    var sample = document.querySelector('.sample-image');
    if (sample) {
        sample.addEventListener('click', openModal);
        sample.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });
    }
    if (modal) {
        modal.addEventListener('click', function (e) { if (!e.target.closest('.modal-content') || e.target.closest('.modal-close')) closeModal(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(anchor.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();
