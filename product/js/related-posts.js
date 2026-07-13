/**
 * related-posts.js — "This style on our blog" block on the product page.
 *
 * Fetches /api/blog-product-map (style → published posts that link this style,
 * derived live from post bodies server-side in lib/blog.js) and reveals the
 * #blogPostsSection with links when the current style appears in the map.
 *
 * Progressive enhancement: any failure (offline API, empty map, style not
 * featured) leaves the section hidden — no error surface, this is internal
 * linking, not customer data. DOM is built with createElement/textContent so
 * post titles never ride through innerHTML.
 */
(function () {
    'use strict';

    function init() {
        var style = (new URLSearchParams(window.location.search).get('style') || '').trim().toUpperCase();
        if (!style) return;

        var section = document.getElementById('blogPostsSection');
        var list = document.getElementById('blogPostsList');
        if (!section || !list) return;

        fetch('/api/blog-product-map')
            .then(function (resp) { return resp.ok ? resp.json() : null; })
            .then(function (map) {
                var posts = map && map[style];
                if (!Array.isArray(posts) || !posts.length) return;
                posts.slice(0, 4).forEach(function (post) {
                    if (!post || !post.slug || !post.title) return;
                    var li = document.createElement('li');
                    var a = document.createElement('a');
                    a.href = '/blog/' + encodeURIComponent(post.slug);
                    a.textContent = post.title;
                    li.appendChild(a);
                    list.appendChild(li);
                });
                if (list.children.length) section.hidden = false;
            })
            .catch(function () { /* enhancement only — stay hidden */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
