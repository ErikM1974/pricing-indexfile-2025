/**
 * blog-teaser.js — homepage "From the blog" section (index.html).
 *
 * Client-fetches the 3 newest Published posts from the proxy's public
 * /api/blog-posts and reuses blog.css card styles. The section stays
 * [hidden] until posts actually render — a failed or empty fetch leaves
 * the homepage exactly as it was (a teaser is never worth an error state).
 * SEO note: the SSR /blog pages carry the search weight; this is décor.
 */
(function () {
    'use strict';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtDate(iso) {
        var d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function run() {
        var section = document.getElementById('blogTeaser');
        var grid = document.getElementById('blogTeaserGrid');
        if (!section || !grid) return;
        var base = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL || '').replace(/\/+$/, '');
        if (!base) return;

        fetch(base + '/api/blog-posts?limit=3')
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (body) {
                var posts = (body.posts || []).slice(0, 3);
                if (!posts.length) return;
                grid.innerHTML = posts.map(function (p) {
                    return '<a class="blog-card" href="/blog/' + esc(p.slug) + '">' +
                        (p.heroImageUrl
                            ? '<div class="blog-card-media"><img src="' + esc(p.heroImageUrl) + '" alt="" loading="lazy"></div>'
                            : '<div class="blog-card-media blog-card-media--empty"></div>') +
                        '<div class="blog-card-body">' +
                        (p.category ? '<span class="blog-chip">' + esc(p.category) + '</span>' : '') +
                        '<h2>' + esc(p.title) + '</h2>' +
                        '<p>' + esc(p.metaDescription) + '</p>' +
                        '<span class="blog-card-meta">' + esc(fmtDate(p.publishedAt)) + '</span>' +
                        '</div></a>';
                }).join('');
                section.hidden = false;
            })
            .catch(function (err) {
                console.error('[blog-teaser] hidden (fetch failed):', err.message);
            });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
