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
        busy: false,
        viewId: 0,
        listId: 0,
        previewId: 0,
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
        var requestId = ++state.listId;
        state.posts = [];
        var root = document.getElementById('postList');
        root.classList.add('dash-loading');
        root.textContent = 'Loading posts…';
        api('?status=all').then(function (body) {
            if (requestId !== state.listId) return;
            if (!Array.isArray(body.posts) || !body.posts.every(function (p) { return p && typeof p.slug === 'string' && typeof p.title === 'string'; })) throw new Error('Post list response incomplete');
            DashPage.hideError();
            state.posts = body.posts;
            renderList();
        }).catch(function (err) {
            if (requestId !== state.listId) return;
            console.error('[blog-editor] list failed:', err);
            DashPage.showError('Unable to load posts (' + err.message + ').');
            root.classList.remove('dash-loading');
            root.innerHTML = '<p class="be-empty" role="alert">Posts unavailable (' + esc(err.message) + '). ' +
                '<button type="button" class="btn be-btn" id="postListRetry">Retry</button></p>';
            var rb = document.getElementById('postListRetry'); if (rb) rb.addEventListener('click', loadList);
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

    function validPost(post) {
        if (!post || typeof post.slug !== 'string' || !post.slug || typeof post.title !== 'string' ||
            typeof post.bodyMarkdown !== 'string' || !['Draft', 'Published'].includes(post.status)) throw new Error('Post response incomplete');
        return post;
    }

    function openPost(slug) {
        if (state.busy) return;
        var viewId = ++state.viewId;
        document.getElementById('postOpenState').textContent = 'Opening post…';
        api('/' + encodeURIComponent(slug)).then(function (body) {
            if (viewId !== state.viewId) return;
            var post = validPost(body.post);
            if (post.slug !== slug) throw new Error('Post response does not match the selection');
            state.current = post;
            state.publishedEver = !!post.publishedAt;
            DashPage.hideError();
            fillEditor(post);
            showEditor(true);
        }).catch(function (err) {
            if (viewId === state.viewId) DashPage.showError('Could not open that post: ' + err.message);
        }).finally(function () {
            if (viewId === state.viewId) document.getElementById('postOpenState').textContent = '';
        });
    }

    function holdEditor() {
        state.busy = true;
        var controls = [...document.querySelectorAll('#editorView input, #editorView textarea, #editorView button, #newPostBtn, .be-list-row')];
        var disabled = controls.map(function (control) { return control.disabled; });
        controls.forEach(function (control) { control.disabled = true; });
        return function () {
            state.busy = false;
            controls.forEach(function (control, index) { control.disabled = disabled[index]; });
            document.getElementById('fldSlug').disabled = !!state.current && state.publishedEver;
        };
    }

    // ---------- editor ----------

    function wire() {
        document.getElementById('newPostBtn').addEventListener('click', function () {
            if (state.busy) return;
            ++state.viewId;
            document.getElementById('postOpenState').textContent = '';
            DashPage.hideError();
            state.current = null;
            state.publishedEver = false;
            fillEditor({ title: '', slug: '', metaDescription: '', category: '', author: 'Northwest Custom Apparel', heroImageUrl: '', bodyMarkdown: '', status: 'Draft' });
            showEditor(true);
        });
        document.getElementById('backToListBtn').addEventListener('click', function () {
            if (state.busy) return;
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
            ++state.previewId;
            document.getElementById('previewPane').textContent = 'Updating preview…';
            if (previewTimer) clearTimeout(previewTimer);
            previewTimer = setTimeout(refreshPreview, 500);
        });

        document.querySelectorAll('.be-toolbar [data-md]').forEach(function (btn) {
            btn.addEventListener('click', function () { insertMd(btn.dataset.md); });
        });
        // Native buttons keep mouse and keyboard file selection equivalent.
        document.querySelectorAll('.be-file-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                var input = document.getElementById(button.dataset.file);
                if (input && !input.disabled) input.click();
            });
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

        window.addEventListener('beforeprint', function () {
            var post = collect();
            var fields = [['URL slug', post.slug], ['Category', post.category], ['Author', post.author], ['Meta description', post.metaDescription], ['Hero image URL', post.heroImageUrl]];
            document.getElementById('blogPrintMetadata').innerHTML = '<h1>' + esc(post.title || 'Untitled post') + '</h1>' +
                '<p>' + esc(document.getElementById('saveState').textContent) + '</p><dl>' +
                fields.filter(function (field) { return field[1]; }).map(function (field) {
                    return '<dt>' + esc(field[0]) + '</dt><dd>' + esc(field[1]) + '</dd>';
                }).join('') + '</dl>';
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
        if (!on) ++state.viewId;
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
        if (state.busy) return;
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

        DashPage.hideError();
        var release = holdEditor(), writeCompleted = false;
        setSaveState('Saving…');
        var req = state.current
            ? api('/' + encodeURIComponent(state.current.slug), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            : api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

        req.then(function () {
            writeCompleted = true;
            state.current = Object.assign({}, state.current || {}, data);
            state.publishedEver = state.publishedEver || status === 'Published';
            state.dirty = false;
            setSaveState(status === 'Published' ? '✓ Published' : '✓ Draft saved');
            // reload the canonical copy (stamps, lock state)
            return api('/' + encodeURIComponent(data.slug)).then(function (body) {
                var post = validPost(body.post);
                if (post.slug !== data.slug) throw new Error('Saved post response does not match');
                state.current = post;
                state.publishedEver = !!post.publishedAt;
                fillEditor(post);
            });
        }).catch(function (err) {
            console.error('[blog-editor] save failed:', err);
            if (writeCompleted) {
                DashPage.showError('Saved, but could not reload the post (' + err.message + '). Reopen it from All posts to check the saved copy.');
            } else {
                setSaveState('Save not confirmed');
                DashPage.showError('Could not confirm the save (' + err.message + '). Check All posts before retrying. Your draft is retained here.');
            }
        }).finally(release);
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
        var requestId = ++state.previewId, viewId = state.viewId;
        var markdown = document.getElementById('fldBody').value, pane = document.getElementById('previewPane');
        function current() { return requestId === state.previewId && viewId === state.viewId && markdown === document.getElementById('fldBody').value; }
        pane.textContent = 'Updating preview…';
        fetch('/api/blog-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown: markdown }),
        }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (body) {
            if (!current()) return;
            if (typeof body.html !== 'string') throw new Error('Preview response incomplete');
            pane.innerHTML = body.html;
        }).catch(function (err) {
            if (!current()) return;
            console.error('[blog-editor] preview failed:', err);
            pane.innerHTML = '<p class="be-preview-fail" role="alert">Preview unavailable (' + esc(err.message || 'request failed') + ') — keep writing, it retries on the next keystroke.</p>';
        });
    }

    // ---------- images ----------

    function uploadImage(input, done) {
        if (state.busy) return;
        var file = input.files && input.files[0];
        if (!file) return;
        var base = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL || '').replace(/\/+$/, '');
        if (!base) { DashPage.showError('Config missing — cannot upload.'); return; }
        var fd = new FormData();
        fd.append('file', file);
        fd.append('description', 'Blog image — ' + (document.getElementById('fldTitle').value || 'untitled post'));
        DashPage.hideError();
        var viewId = state.viewId, release = holdEditor();
        setSaveState('Uploading image…');
        fetch(base + '/api/image-uploads', { method: 'POST', body: fd })
            .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.error || ('HTTP ' + r.status)); return b; }); })
            .then(function (b) {
                if (viewId !== state.viewId) return;
                var url = (b.image && b.image.url) || '';
                if (!url) throw new Error('no url returned');
                done(url);
                setSaveState('Image uploaded — remember to save.');
            })
            .catch(function (err) {
                if (viewId !== state.viewId) return;
                console.error('[blog-editor] upload failed:', err);
                DashPage.showError('Image upload failed: ' + err.message);
                setSaveState('');
            })
            .finally(function () { if (viewId === state.viewId) input.value = ''; release(); });
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
