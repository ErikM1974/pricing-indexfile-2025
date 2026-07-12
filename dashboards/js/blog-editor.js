/**
 * blog-editor.js — controller for dashboards/blog-editor.html.
 *
 * Staff CRUD for Caspio Blog_Posts through the SAME-ORIGIN session-gated
 * forwarder /api/crm-proxy/blog-posts* (which adds the CRM secret — that's
 * also what lets the editor see Drafts the public endpoint hides).
 *
 * Live preview POSTs the markdown to /api/blog-preview, which runs the SAME
 * renderer as the published pages (lib/blog.js) — preview never lies.
 * Hero + body images upload through the public /api/image-uploads.
 * Slug: auto-slugified from the title until first save; after a post has
 * ever been Published the slug field LOCKS (URLs are permanent for SEO).
 */
(function () {
    'use strict';

    var state = {
        posts: [],
        current: null,   // API post object being edited, or null for new
        dirty: false,
        publishedEver: false,
    };

    document.addEventListener('DOMContentLoaded', function () {
        wire();
        loadList();
    });

    // ---------- data ----------

    function api(path, options) {
        return fetch('/api/crm-proxy/blog-posts' + path, options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                return body;
            });
        });
    }

    function loadList() {
        api('?status=all').then(function (body) {
            state.posts = body.posts || [];
            renderList();
        }).catch(function (err) {
            console.error('[blog-editor] list failed:', err);
            DashPage.showError('Unable to load posts (' + err.message + '). Refresh to retry.');
            document.getElementById('postList').classList.remove('dash-loading');
            document.getElementById('postList').textContent = 'Posts unavailable.';
        });
    }

    // ---------- list view ----------

    function renderList() {
        var root = document.getElementById('postList');
        root.classList.remove('dash-loading');
        if (!state.posts.length) {
            root.innerHTML = '<p class="be-empty">No posts yet — hit <strong>New post</strong> and write the first one.</p>';
            return;
        }
        root.innerHTML = state.posts.map(function (p) {
            return '<button type="button" class="be-list-row" data-slug="' + esc(p.slug) + '">' +
                '<span class="be-list-status ' + (p.status === 'Published' ? 'is-live' : 'is-draft') + '">' + esc(p.status) + '</span>' +
                '<span class="be-list-title">' + esc(p.title) + '</span>' +
                '<span class="be-list-meta">' + esc(p.category || '') + (p.publishedAt ? ' · ' + esc(p.publishedAt.slice(0, 10)) : '') + '</span>' +
                '</button>';
        }).join('');
        root.querySelectorAll('.be-list-row').forEach(function (row) {
            row.addEventListener('click', function () { openPost(row.dataset.slug); });
        });
        // category datalist from existing posts
        var cats = {};
        state.posts.forEach(function (p) { if (p.category) cats[p.category] = 1; });
        document.getElementById('beCategories').innerHTML =
            Object.keys(cats).sort().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    }

    function openPost(slug) {
        api('/' + encodeURIComponent(slug)).then(function (body) {
            state.current = body.post;
            state.publishedEver = !!body.post.publishedAt;
            fillEditor(body.post);
            showEditor(true);
        }).catch(function (err) {
            DashPage.showError('Could not open that post: ' + err.message);
        });
    }

    // ---------- editor ----------

    function wire() {
        document.getElementById('newPostBtn').addEventListener('click', function () {
            state.current = null;
            state.publishedEver = false;
            fillEditor({ title: '', slug: '', metaDescription: '', category: '', author: 'Northwest Custom Apparel', heroImageUrl: '', bodyMarkdown: '', status: 'Draft' });
            showEditor(true);
        });
        document.getElementById('backToListBtn').addEventListener('click', function () {
            if (state.dirty && !window.confirm('Leave without saving? Unsaved changes will be lost.')) return;
            showEditor(false);
            loadList();
        });

        var title = document.getElementById('fldTitle');
        var slug = document.getElementById('fldSlug');
        title.addEventListener('input', function () {
            markDirty();
            if (!state.current && !slug.dataset.manual) slug.value = slugify(title.value);
            refreshGoogle();
        });
        slug.addEventListener('input', function () { slug.dataset.manual = '1'; markDirty(); refreshGoogle(); });

        var meta = document.getElementById('fldMeta');
        meta.addEventListener('input', function () {
            document.getElementById('metaCount').textContent = String(meta.value.length);
            markDirty();
            refreshGoogle();
        });

        ['fldCategory', 'fldAuthor', 'fldHeroUrl'].forEach(function (id) {
            document.getElementById(id).addEventListener('input', markDirty);
        });
        document.getElementById('fldHeroUrl').addEventListener('change', function () {
            setHeroPreview(this.value.trim());
        });
        document.getElementById('fldHeroFile').addEventListener('change', function () {
            uploadImage(this, function (url) {
                document.getElementById('fldHeroUrl').value = url;
                setHeroPreview(url);
                markDirty();
            });
        });

        var body = document.getElementById('fldBody');
        var previewTimer = null;
        body.addEventListener('input', function () {
            markDirty();
            if (previewTimer) clearTimeout(previewTimer);
            previewTimer = setTimeout(refreshPreview, 500);
        });

        document.querySelectorAll('.be-toolbar [data-md]').forEach(function (btn) {
            btn.addEventListener('click', function () { insertMd(btn.dataset.md); });
        });
        document.getElementById('fldBodyImage').addEventListener('change', function () {
            var input = this;
            uploadImage(input, function (url) {
                insertAtCursor('\n![Image](' + url + ')\n');
            });
        });

        document.getElementById('saveDraftBtn').addEventListener('click', function () { save('Draft'); });
        document.getElementById('publishBtn').addEventListener('click', function () { save('Published'); });
        document.getElementById('unpublishBtn').addEventListener('click', function () {
            if (window.confirm('Unpublish this post? It disappears from /blog until you publish again.')) save('Draft');
        });

        window.addEventListener('beforeunload', function (e) {
            if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    function fillEditor(p) {
        document.getElementById('fldTitle').value = p.title || '';
        var slug = document.getElementById('fldSlug');
        slug.value = p.slug || '';
        slug.dataset.manual = p.slug ? '1' : '';
        var locked = !!state.current && state.publishedEver;
        slug.disabled = locked;
        document.getElementById('slugLockNote').hidden = !locked;
        document.getElementById('fldMeta').value = p.metaDescription || '';
        document.getElementById('metaCount').textContent = String((p.metaDescription || '').length);
        document.getElementById('fldCategory').value = p.category || '';
        document.getElementById('fldAuthor').value = p.author || '';
        document.getElementById('fldHeroUrl').value = p.heroImageUrl || '';
        setHeroPreview(p.heroImageUrl || '');
        document.getElementById('fldBody').value = p.bodyMarkdown || '';
        document.getElementById('unpublishBtn').hidden = p.status !== 'Published';
        var live = document.getElementById('viewLiveLink');
        live.hidden = p.status !== 'Published';
        live.href = '/blog/' + (p.slug || '');
        state.dirty = false;
        setSaveState(p.status === 'Published' ? 'Published' : (state.current ? 'Draft' : 'New post'));
        refreshGoogle();
        refreshPreview();
    }

    function showEditor(on) {
        document.getElementById('listView').hidden = on;
        document.getElementById('editorView').hidden = !on;
        if (on) document.getElementById('fldTitle').focus();
    }

    function markDirty() { state.dirty = true; setSaveState('Unsaved changes…'); }
    function setSaveState(text) { document.getElementById('saveState').textContent = text; }

    // ---------- save ----------

    function collect() {
        return {
            slug: document.getElementById('fldSlug').value.trim(),
            title: document.getElementById('fldTitle').value.trim(),
            metaDescription: document.getElementById('fldMeta').value.trim(),
            category: document.getElementById('fldCategory').value.trim(),
            author: document.getElementById('fldAuthor').value.trim(),
            heroImageUrl: document.getElementById('fldHeroUrl').value.trim(),
            bodyMarkdown: document.getElementById('fldBody').value,
        };
    }

    function save(status) {
        var data = collect();
        data.status = status;
        if (!data.title) { DashPage.showError('Give the post a title before saving.'); return; }
        if (!/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/.test(data.slug) || data.slug.length < 3) {
            DashPage.showError('The slug needs 3–80 lowercase letters/numbers/dashes (it becomes the URL).');
            return;
        }
        if (status === 'Published' && !data.metaDescription) {
            DashPage.showError('Write the meta description before publishing — it\'s the Google snippet.');
            return;
        }

        setSaveState('Saving…');
        var req = state.current
            ? api('/' + encodeURIComponent(state.current.slug), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            : api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

        req.then(function () {
            state.dirty = false;
            setSaveState(status === 'Published' ? '✓ Published' : '✓ Draft saved');
            // reload the canonical copy (stamps, lock state)
            return api('/' + encodeURIComponent(data.slug)).then(function (body) {
                state.current = body.post;
                state.publishedEver = !!body.post.publishedAt;
                fillEditor(body.post);
            });
        }).catch(function (err) {
            console.error('[blog-editor] save failed:', err);
            setSaveState('');
            DashPage.showError('NOT saved: ' + err.message);
        });
    }

    // ---------- preview ----------

    function refreshGoogle() {
        var title = document.getElementById('fldTitle').value.trim() || 'Post title';
        var slug = document.getElementById('fldSlug').value.trim() || '…';
        var meta = document.getElementById('fldMeta').value.trim() || 'Meta description preview…';
        document.getElementById('gTitle').textContent = title + ' | Northwest Custom Apparel';
        document.getElementById('gUrl').textContent = 'www.teamnwca.com/blog/' + slug;
        document.getElementById('gDesc').textContent = meta;
    }

    function refreshPreview() {
        fetch('/api/blog-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown: document.getElementById('fldBody').value }),
        }).then(function (r) { return r.json(); }).then(function (body) {
            document.getElementById('previewPane').innerHTML = body.html || '';
        }).catch(function (err) {
            console.error('[blog-editor] preview failed:', err);
        });
    }

    // ---------- images ----------

    function uploadImage(input, done) {
        var file = input.files && input.files[0];
        if (!file) return;
        var base = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL || '').replace(/\/+$/, '');
        if (!base) { DashPage.showError('Config missing — cannot upload.'); return; }
        var fd = new FormData();
        fd.append('file', file);
        fd.append('description', 'Blog image — ' + (document.getElementById('fldTitle').value || 'untitled post'));
        setSaveState('Uploading image…');
        fetch(base + '/api/image-uploads', { method: 'POST', body: fd })
            .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.error || ('HTTP ' + r.status)); return b; }); })
            .then(function (b) {
                var url = (b.image && b.image.url) || '';
                if (!url) throw new Error('no url returned');
                done(url);
                setSaveState('Image uploaded — remember to save.');
            })
            .catch(function (err) {
                console.error('[blog-editor] upload failed:', err);
                DashPage.showError('Image upload failed: ' + err.message);
                setSaveState('');
            })
            .finally(function () { input.value = ''; });
    }

    function setHeroPreview(url) {
        var img = document.getElementById('heroPreview');
        if (url) { img.src = url; img.hidden = false; } else { img.hidden = true; }
    }

    // ---------- markdown helpers ----------

    function insertMd(kind) {
        var wraps = {
            bold: ['**', '**', 'bold text'],
            italic: ['*', '*', 'italic text'],
            h2: ['\n## ', '\n', 'Section heading'],
            h3: ['\n### ', '\n', 'Sub-heading'],
            ul: ['\n- ', '', 'list item'],
            quote: ['\n> ', '\n', 'quote'],
            link: ['[', '](https://)', 'link text'],
        };
        var w = wraps[kind];
        if (!w) return;
        var ta = document.getElementById('fldBody');
        var start = ta.selectionStart, end = ta.selectionEnd;
        var selected = ta.value.slice(start, end) || w[2];
        ta.setRangeText(w[0] + selected + w[1], start, end, 'end');
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function insertAtCursor(text) {
        var ta = document.getElementById('fldBody');
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function slugify(title) {
        return String(title || '').toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80)
            .replace(/-+$/g, '');
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
})();
