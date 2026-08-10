/**
 * design-queue-briefs.js — "Draw these" on the Design Queue.
 *
 * The working end of the page. Everything else on the queue tells Steve WHICH subject;
 * this tells him what to put on the shirt, what the place looked like, and where to look.
 *
 * 🔴 REFERENCE IMAGES ARE LINKS, NEVER EMBEDS. Every photograph behind these subjects
 * belongs to somebody else — Facebook posters, the Tacoma Public Library. Steve opens the
 * link, looks, and draws original work. Rehosting them here would break the exact rule
 * Erik's own brief sets for him ("do not trace or directly reproduce old photographs"),
 * and it would do it on a staff page nobody would think to audit.
 *
 * The confidence field is load-bearing and must stay visible:
 *   confirmed  — a photograph or archive record exists
 *   memory     — first-hand accounts, no image yet
 * A "memory" subject can still be drawn, but not from imagination: the open questions on
 * that row are what has to be answered first. Two pages on this store had to be rewritten
 * because colourful detail got stated as fact, and that is the failure this field prevents.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var root = document.getElementById('briefs-root');
        if (!root) return;
        // The queue controller already fetches the file; read it again rather than couple
        // the two modules. It is a static file behind a 5-minute cache, so the cost is nil.
        fetch('/dashboards/data/design-queue.json?v=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (d) { render(root, d); })
            .catch(function (err) {
                console.error('[design-queue-briefs]', err);
                root.classList.remove('dash-loading');
                root.innerHTML = '';
                root.appendChild(el('p', 'dq-note', 'Could not load the briefs. Refresh — and if it persists the data file may not have deployed.'));
            });
    });

    function render(root, d) {
        root.classList.remove('dash-loading');
        root.innerHTML = '';

        var briefs = d.briefs || [];
        if (!briefs.length) {
            root.appendChild(el('p', 'dq-note', 'No briefs in the data file yet.'));
            return;
        }

        briefs.forEach(function (b) { root.appendChild(briefCard(b)); });

        if ((d.blocked || []).length) {
            root.appendChild(el('h3', 'dq-metrics-title', 'Do not draw these'));
            var list = el('div', 'dq-blocked-list');
            d.blocked.forEach(function (x) {
                var row = el('div', 'dq-blocked');
                row.appendChild(el('div', 'dq-blocked-subject', x.subject));
                row.appendChild(el('p', 'dq-notice-line', x.reason));
                if (x.instead) row.appendChild(el('p', 'dq-notice-line', 'Instead: ' + x.instead));
                list.appendChild(row);
            });
            root.appendChild(list);
        }
    }

    function briefCard(b) {
        var card = el('div', 'dq-brief-card');

        var head = el('div', 'dq-brief-head');
        head.appendChild(el('span', 'dq-brief-rank', String(b.rank)));
        var t = el('div');
        t.appendChild(el('div', 'dq-brief-subject', b.subject));
        t.appendChild(el('div', 'dq-brief-where', b.where));
        head.appendChild(t);
        head.appendChild(el('span', 'dq-conf dq-conf--' + b.confidence, b.confidence));
        card.appendChild(head);

        card.appendChild(el('p', 'dq-brief-why', b.why));

        // ── The shirt itself. Steve reads this first, so it looks like a shirt.
        var st = b.shirtText || {};
        var shirt = el('div', 'dq-shirt');
        shirt.appendChild(el('div', 'dq-shirt-label', 'Text on the shirt'));
        if (st.main) shirt.appendChild(el('div', 'dq-shirt-main', st.main));
        if (st.secondary) shirt.appendChild(el('div', 'dq-shirt-sec', st.secondary));
        if (st.small) shirt.appendChild(el('div', 'dq-shirt-small', st.small));
        card.appendChild(shirt);

        if (b.textNotes) card.appendChild(warnRow('Text rules', b.textNotes));
        if (b.designDirection) card.appendChild(row('What to draw', b.designDirection));
        if (b.signage) card.appendChild(warnRow('Signage', b.signage));
        if (b.theStory) card.appendChild(row('The story', b.theStory));

        // ── Archived reference images.
        //
        // These are the ONLY images shown on this page, and they are shown because the
        // Tacoma Public Library's own Rights field permits it: "Images used must credit
        // Tacoma Public Library as follows: Northwest Room at The Tacoma Public Library,
        // (image number)". Attribution-only, no commercial restriction.
        //
        // 🔴 THE CREDIT IS THE LICENCE, SO IT RENDERS WITH THE IMAGE, ALWAYS. Not in a
        // tooltip, not in a footer — under the picture, where anyone looking at the picture
        // reads it. If an image ever arrives here without a credit string it is NOT drawn,
        // because an uncredited copy is an unlicensed one.
        //
        // Facebook photographs are deliberately absent. They have no stated licence, and on
        // one of them the photographer is unknown and a request for credit went unanswered.
        if ((b.images || []).length) {
            var gal = el('div', 'dq-gallery');
            gal.appendChild(el('div', 'dq-row-label', 'Reference photographs'));
            var grid = el('div', 'dq-gallery-grid');
            b.images.forEach(function (im) {
                if (!im.url || !im.credit) return;      // no credit, no image
                var fig = document.createElement('figure');
                fig.className = 'dq-fig';
                var a = document.createElement('a');
                a.href = im.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                var img = document.createElement('img');
                img.src = im.url;
                img.alt = im.caption || im.imageNumber || 'reference photograph';
                // 🔴 NO loading="lazy". With it, these never fetched at all — currentSrc
                // stayed empty and complete stayed false even after scrolling them into
                // view, while an identical element without the attribute loaded instantly.
                // Five images at ~150KB is nothing for a staff page, and an artist opening
                // a brief to find five empty boxes is a far worse trade than the bytes.
                a.appendChild(img);
                fig.appendChild(a);
                var cap = document.createElement('figcaption');
                cap.className = 'dq-fig-cap';
                if (im.caption) cap.appendChild(el('span', 'dq-fig-note', im.caption));
                cap.appendChild(el('span', 'dq-fig-credit', im.credit));
                fig.appendChild(cap);
                grid.appendChild(fig);
            });
            gal.appendChild(grid);
            gal.appendChild(el('p', 'dq-ref-rule',
                'Draw your own work from these — do not trace or reproduce them. '
                + 'Wherever one of these pictures goes, the credit line goes with it.'));
            card.appendChild(gal);
        }

        // ── References. Links only — see the header note.
        if ((b.references || []).length) {
            var refs = el('div', 'dq-refs');
            refs.appendChild(el('div', 'dq-row-label', 'Look at these before you draw'));
            b.references.forEach(function (r) {
                var item = el('div', 'dq-ref');
                var a = document.createElement('a');
                a.className = 'dq-ref-link';
                a.href = r.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = r.label;
                item.appendChild(a);
                if (r.what) item.appendChild(el('p', 'dq-ref-what', r.what));
                refs.appendChild(item);
            });
            refs.appendChild(el('p', 'dq-ref-rule',
                'These are other people’s photographs — open them, look, and draw your own. '
                + 'Do not trace or reproduce them.'));
            card.appendChild(refs);
        }

        if ((b.firstHand || []).length) {
            var fh = el('div', 'dq-list-block');
            fh.appendChild(el('div', 'dq-row-label', 'People who were there'));
            var ul = document.createElement('ul');
            ul.className = 'dq-ul';
            b.firstHand.forEach(function (x) {
                var li = document.createElement('li');
                li.textContent = x;
                ul.appendChild(li);
            });
            fh.appendChild(ul);
            card.appendChild(fh);
        }

        if ((b.openQuestions || []).length) {
            var oq = el('div', 'dq-list-block');
            oq.appendChild(el('div', 'dq-row-label', 'Still unknown — answer before finals'));
            var ul2 = document.createElement('ul');
            ul2.className = 'dq-ul';
            b.openQuestions.forEach(function (x) {
                var li = document.createElement('li');
                li.textContent = x;
                ul2.appendChild(li);
            });
            oq.appendChild(ul2);
            card.appendChild(oq);
        }

        return card;
    }

    function row(label, text) {
        var d = el('div', 'dq-row-block');
        d.appendChild(el('div', 'dq-row-label', label));
        d.appendChild(el('p', 'dq-row-text', text));
        return d;
    }

    function warnRow(label, text) {
        var d = el('div', 'dq-row-block dq-row-block--warn');
        d.appendChild(el('div', 'dq-row-label', label));
        d.appendChild(el('p', 'dq-row-text', text));
        return d;
    }

    /* textContent only — never innerHTML with data (CLAUDE.md XSS rule) */
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== null && text !== undefined) n.textContent = text;
        return n;
    }
})();
