/**
 * gear-publisher.js — controller for the 253gear publisher tab.
 *
 * Steve finishes a design and puts it on 253gear.com from here, without opening the
 * Shopify admin. The product is created as a DRAFT; he reviews a preview and an
 * automated audit, then clicks Publish.
 *
 * NETWORKING. Everything Shopify-related goes through same-origin /api/gear/* so the
 * SAML cookie rides along and the Shopify credential stays on the proxy — the browser
 * never holds it. Relative paths on purpose: DashPage.apiUrl() points at the proxy,
 * which would both miss the cookie and 404. The one exception is the file upload,
 * which uses the proxy's open intake via APP_CONFIG (see gear-publisher-images.js).
 *
 * ⚠️ Long calls carry their own AbortController. shared_components/js/fetch-timeout.js
 * aborts any fetch at 15s unless the caller supplies a signal, and a create or a
 * publish routinely runs longer than that.
 */
(function (global) {
    'use strict';

    var POLL_MS = 2500;
    var state = { draft: null, config: null, polling: null };

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Same-origin call with an explicit timeout — never the 15s global default. */
    async function gearFetch(path, options, timeoutMs) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 30000);
        try {
            var resp = await fetch(path, Object.assign({}, options, {
                signal: controller.signal,
                headers: Object.assign({ Accept: 'application/json' }, (options && options.headers) || {})
            }));
            var body = {};
            try { body = await resp.json(); } catch (e) { /* non-JSON handled below */ }
            if (!resp.ok) {
                var msg = body.error || body.problems || ('Request failed (HTTP ' + resp.status + ')');
                var err = new Error(Array.isArray(msg) ? msg.join(' ') : msg);
                err.status = resp.status;
                err.body = body;
                throw err;
            }
            return body;
        } finally {
            clearTimeout(timer);
        }
    }

    function fail(message) {
        // Rule 4: an API failure is always visible. Never a silent fallback.
        global.DashPage.showError(message);
    }

    function persist() {
        global.GearStore.save(state.draft);
        renderStep();
    }

    // ── Step 1: identity ─────────────────────────────────────────────────────

    /**
     * Read a pasted ShopWorks screenshot. Everything extracted lands in an editable
     * field marked "from screenshot" — nothing OCR'd goes to Shopify unreviewed, and
     * the design number gets its own explicit confirm because it becomes the product
     * title suffix, the store's duplicate key and the admin's search key.
     */
    async function readScreenshot(file) {
        var status = $('gp-ocr-status');
        status.textContent = 'Reading the screenshot…';
        try {
            var dataUrl = await new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = function () { reject(new Error('Could not read that file')); };
                reader.readAsDataURL(file);
            });

            var out = await gearFetch('/api/gear/extract-shopworks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
            }, 60000);

            var found = [];
            if (out.designNumber) { state.draft.designNumber = String(out.designNumber); found.push('design number'); }
            if (out.designName) { state.draft.designName = String(out.designName); found.push('name'); }
            if (out.designDescription) { state.draft.designDescription = String(out.designDescription); found.push('description'); }
            state.draft.identitySource = 'screenshot';

            status.textContent = found.length
                ? 'Read the ' + found.join(', ') + '. Check them below before continuing.'
                : 'Could not read anything from that image — type the fields instead.';
            persist();
            if (state.draft.designNumber) checkDuplicate();
        } catch (e) {
            status.textContent = '';
            fail('Could not read the screenshot: ' + e.message);
        }
    }

    /** Warn on a duplicate at Step 1, not at Publish — before he builds the whole listing. */
    async function checkDuplicate() {
        var el = $('gp-dup-status');
        var number = String(state.draft.designNumber || '').trim();
        if (!/^\d{4,6}$/.test(number)) { el.textContent = ''; return; }
        el.textContent = 'Checking 253gear for #' + number + '…';
        try {
            var out = await gearFetch('/api/gear/products?designNumber=' + encodeURIComponent(number), {}, 20000);
            if (out.found) {
                el.className = 'gp-inline-warn';
                el.innerHTML = '#' + esc(number) + ' is already on 253gear as <strong>' + esc(out.product.title) +
                    '</strong>. <a href="' + esc(out.product.adminUrl) + '" target="_blank" rel="noopener">Open it</a>' +
                    ' — publishing again would resume that product, not make a second one.';
            } else {
                el.className = 'gp-inline-ok';
                el.textContent = '#' + number + ' is not on 253gear yet.';
            }
        } catch (e) {
            el.className = 'gp-inline-warn';
            el.textContent = 'Could not check for duplicates: ' + e.message;
        }
    }

    // ── Step 2: products ─────────────────────────────────────────────────────

    async function loadConfig() {
        try {
            var out = await gearFetch('/api/gear/config', {}, 20000);
            state.config = out.config;
            return out.config;
        } catch (e) {
            // A missing config is not something to paper over: without it we would be
            // guessing prices. Say so and stop.
            fail(e.status === 503
                ? 'The 253gear settings table is not set up yet, so prices are unknown. ' + e.message
                : 'Could not load 253gear settings: ' + e.message);
            return null;
        }
    }

    async function loadColors(styleNumber) {
        var base = global.DashPage.apiUrl('/api/product-details?styleNumber=' + encodeURIComponent(styleNumber));
        var resp = await fetch(base, { signal: AbortSignal.timeout(20000) });
        if (!resp.ok) throw new Error('Colour list unavailable (HTTP ' + resp.status + ')');
        var rows = await resp.json();
        var list = Array.isArray(rows) ? rows : (rows.result || []);
        var seen = {};
        return list.filter(function (r) {
            if (!r.CATALOG_COLOR || seen[r.CATALOG_COLOR]) return false;
            seen[r.CATALOG_COLOR] = true;
            return true;
        }).map(function (r) {
            return { colorName: r.COLOR_NAME, catalogColor: r.CATALOG_COLOR, swatchImage: r.COLOR_SQUARE_IMAGE || '' };
        });
    }

    // ── Step 3b: classify ────────────────────────────────────────────────────

    /**
     * Ask the server to read the hero photo. The answer is a SUGGESTION — the city
     * drives automatic collection membership, so a wrong tag files itself the moment
     * it is saved, and Steve confirms before it applies.
     */
    async function classify() {
        var hero = state.draft.images[state.draft.heroKey];
        if (!hero || !hero.externalKey) { fail('Add the main photo first — that is what gets read.'); return; }

        var box = $('gp-classify-result');
        box.innerHTML = '<p class="gp-muted">Reading the design…</p>';
        try {
            var out = await gearFetch('/api/gear/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalKey: hero.externalKey,
                    designName: state.draft.designName,
                    styles: state.draft.styles
                })
            }, 60000);

            state.draft.classification = out;
            if (out.city) state.draft.city = out.city;
            if (out.tags) state.draft.tags = out.tags;
            if (out.seo) {
                state.draft.seoTitle = state.draft.seoTitle || out.seo.title || '';
                state.draft.seoDescription = state.draft.seoDescription || out.seo.description || '';
            }
            if (!state.draft.altText && out.altText) state.draft.altText = out.altText;

            box.innerHTML = classificationMarkup(out);
            persist();
        } catch (e) {
            box.innerHTML = '';
            fail('Could not read the design: ' + e.message);
        }
    }

    function classificationMarkup(out) {
        var head = out.city
            ? '<p class="gp-inline-ok"><strong>' + esc(out.city) + '</strong> — ' + esc(out.reason) + '</p>'
            : '<p class="gp-inline-warn"><strong>Needs your call.</strong> ' + esc(out.reason) + '</p>';

        var conf = out.city
            ? '<p class="gp-muted">Confidence: ' + esc(out.confidence) +
              ' (' + (out.method === 'text' ? 'read from the artwork text' : 'inferred from the picture') + ')</p>'
            : '';

        var cols = out.collectionsKnown
            ? '<p class="gp-muted">Will appear in: ' +
              (out.collections && out.collections.handles.length ? esc(out.collections.handles.join(', ')) : 'no collection yet') + '</p>'
            : '<p class="gp-inline-warn">The live collection rules have not been read yet, so I cannot say which ' +
              'collections these tags will file into. Run "Refresh collection rules" first.</p>';

        var rejected = (out.rejectedTags && out.rejectedTags.length)
            ? '<p class="gp-inline-warn">Ignored (no collection files on them): ' + esc(out.rejectedTags.join(', ')) + '</p>'
            : '';

        return head + conf + cols + rejected +
            '<p class="gp-muted">Tags: ' + esc((out.tags || []).join(', ')) + '</p>' +
            '<details><summary>What it saw</summary><p class="gp-muted">' +
            esc(out.seen && out.seen.designText) + '</p></details>';
    }

    // ── Step 4: copy ─────────────────────────────────────────────────────────

    /** Stream a draft description. Facts in, sourced prose out, Steve edits it. */
    async function draftCopy() {
        var body = $('gp-body');
        var status = $('gp-copy-status');
        status.textContent = 'Drafting…';
        body.value = '';

        try {
            var resp = await fetch('/api/shopify-description-ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    designName: state.draft.designName,
                    city: state.draft.city,
                    facts: {
                        raw: $('gp-facts').value,
                        landmark: $('gp-fact-landmark').value,
                        years: $('gp-fact-years').value,
                        whoRanIt: $('gp-fact-who').value,
                        sources: $('gp-fact-sources').value
                    }
                })
            });
            if (!resp.ok || !resp.body) throw new Error('Draft request failed (HTTP ' + resp.status + ')');

            var reader = resp.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';
            for (;;) {
                var chunk = await reader.read();
                if (chunk.done) break;
                buffer += decoder.decode(chunk.value, { stream: true });
                var parts = buffer.split('\n\n');
                buffer = parts.pop();
                for (var i = 0; i < parts.length; i++) {
                    var m = /^event: (\w+)\ndata: (.*)$/s.exec(parts[i].trim());
                    if (!m) continue;
                    var data = {};
                    try { data = JSON.parse(m[2]); } catch (e) { continue; }
                    if (m[1] === 'delta' && data.text) {
                        body.value += data.text;
                        updateWordCount();
                    } else if (m[1] === 'tool_result') {
                        status.textContent = 'Checking a fact…';
                    } else if (m[1] === 'error') {
                        throw new Error(data.message);
                    }
                }
            }
            status.textContent = 'Draft ready — edit it, it is yours now.';
            state.draft.body = body.value;
            persist();
        } catch (e) {
            status.textContent = '';
            fail('Could not draft the description: ' + e.message);
        }
    }

    function updateWordCount() {
        var n = global.GearStore.wordCount($('gp-body').value);
        var el = $('gp-wordcount');
        el.textContent = n + ' / 200 words';
        el.className = n >= 200 ? 'gp-inline-ok' : 'gp-muted';
    }

    // ── Step 5/6: create, poll, publish ──────────────────────────────────────

    function createPayload() {
        var d = state.draft;
        return {
            designNumber: d.designNumber,
            designName: d.designName,
            designDescription: d.designDescription,
            city: d.city,
            styles: d.styles,
            sizes: d.sizes,
            colors: d.colors,
            seasonal: d.seasonal,
            seasons: d.seasons,
            descriptionHtml: global.GearStore.descriptionHtml(d),
            seoTitle: d.seoTitle,
            seoDescription: d.seoDescription,
            extraTags: d.tags,
            images: global.GearStore.uploadedImages(d)
        };
    }

    async function createDraftProduct() {
        var blockers = [];
        ['identity', 'products', 'photos', 'story'].forEach(function (step) {
            blockers = blockers.concat(global.GearStore.blockers(state.draft, step));
        });
        if (blockers.length) { fail('Not ready yet: ' + blockers.join(' ')); return; }

        if (!state.draft.idempotencyKey) {
            // One key per draft, so a double-click or a retry resumes the same job
            // rather than creating a second permanent product.
            state.draft.idempotencyKey = 'gear-' + state.draft.draftId;
        }

        $('gp-create-btn').disabled = true;
        $('gp-job-panel').hidden = false;
        try {
            var out = await gearFetch('/api/gear/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': state.draft.idempotencyKey },
                body: JSON.stringify(createPayload())
            }, 45000);
            startPolling(out.jobId || state.draft.designNumber);
        } catch (e) {
            $('gp-create-btn').disabled = false;
            fail('Could not start the build: ' + e.message);
        }
    }

    function startPolling(designNumber) {
        stopPolling();
        state.polling = setInterval(function () { pollOnce(designNumber); }, POLL_MS);
        pollOnce(designNumber);
    }

    function stopPolling() {
        if (state.polling) { clearInterval(state.polling); state.polling = null; }
    }

    async function pollOnce(designNumber) {
        try {
            var out = await gearFetch('/api/gear/jobs/' + encodeURIComponent(designNumber), {}, 25000);
            renderJob(out.job);

            var sh = out.job && out.job.shopify;
            if (sh) {
                state.draft.productGid = sh.productGid;
                state.draft.productId = String(sh.legacyId || '');
                state.draft.handle = sh.handle;
                state.draft.publishedAt = sh.publishedAt || '';
                global.GearStore.save(state.draft);
            }
            if (out.job && ['awaiting_review', 'published', 'failed', 'needs_attention'].indexOf(out.job.status) >= 0) {
                stopPolling();
                $('gp-create-btn').disabled = false;
            }
        } catch (e) {
            stopPolling();
            $('gp-create-btn').disabled = false;
            fail('Lost track of the build: ' + e.message);
        }
    }

    function renderJob(job) {
        if (!job) return;
        var sh = job.shopify || {};
        var audit = job.audit;

        var steps = (job.stepsDone || []).map(function (s) { return '<li class="gp-step-done">' + esc(s) + '</li>'; }).join('');
        var current = job.step && job.status === 'running' ? '<li class="gp-step-current">' + esc(job.step) + '…</li>' : '';

        var errors = (job.errors || []).map(function (e) {
            return '<li class="gp-inline-warn">' + esc(e.step) + ': ' + esc(e.message) + '</li>';
        }).join('');

        var binding = sh.variantsBound
            ? '<p class="' + (sh.variantsBound.bound === sh.variantsBound.total ? 'gp-inline-ok' : 'gp-inline-warn') + '">' +
              sh.variantsBound.bound + ' of ' + sh.variantsBound.total + ' variants have a photo bound.</p>'
            : '';

        $('gp-job-body').innerHTML =
            '<p><strong>' + esc(job.status || 'working') + '</strong>' +
            (job.stalled ? ' <span class="gp-inline-warn">(stalled — safe to resume)</span>' : '') + '</p>' +
            '<ul class="gp-steps">' + steps + current + '</ul>' + binding +
            (errors ? '<ul class="gp-errors">' + errors + '</ul>' : '') +
            (audit ? auditMarkup(audit) : '') +
            (sh.adminUrl ? '<p><a href="' + esc(sh.adminUrl) + '" target="_blank" rel="noopener">Open the draft in Shopify</a></p>' : '');

        var canPublish = audit && audit.pass && sh.productGid && !sh.publishedAt;
        var pubBtn = $('gp-publish-btn');
        pubBtn.disabled = !canPublish;
        $('gp-publish-reason').textContent = sh.publishedAt
            ? 'Already live.'
            : (audit && !audit.pass ? 'Publish is blocked until the checks below pass.' : (canPublish ? '' : 'Build the draft first.'));
    }

    function auditMarkup(audit) {
        return '<ul class="gp-audit">' + (audit.checks || []).map(function (c) {
            var icon = c.pass ? '✔' : (c.blocking ? '✖' : '⚠');
            var cls = c.pass ? 'gp-inline-ok' : (c.blocking ? 'gp-inline-fail' : 'gp-inline-warn');
            return '<li class="' + cls + '">' + icon + ' ' + esc(c.name) + ' — ' + esc(c.detail) +
                (c.items && c.items.length ? '<br><span class="gp-muted">' + esc(c.items.slice(0, 6).join(', ')) + '</span>' : '') +
                '</li>';
        }).join('') + '</ul>';
    }

    async function publish() {
        if (!state.draft.productId) { fail('No draft product to publish yet.'); return; }
        $('gp-publish-btn').disabled = true;
        try {
            var out = await gearFetch('/api/gear/products/' + encodeURIComponent(state.draft.productId) + '/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }, 90000);

            state.draft.publishedAt = out.publishedAt;
            state.draft.step = 'live';
            global.GearStore.save(state.draft);

            $('gp-live').hidden = false;
            $('gp-live-body').innerHTML =
                '<p class="gp-inline-ok"><strong>Live on 253gear.com.</strong></p>' +
                '<p><a href="' + esc(out.storefrontUrl) + '" target="_blank" rel="noopener">' + esc(out.storefrontUrl) + '</a></p>' +
                (out.verified && out.verified.verified
                    ? '<p class="gp-inline-ok">Checked from the server: the page returns 200.</p>'
                    : '<p class="gp-inline-warn">The storefront cache has not caught up yet (HTTP ' +
                      esc(out.verified && out.verified.httpStatus) + '). The product IS published — give it a few minutes ' +
                      'before judging it in a browser, which caches hard.</p>');
            renderStep();
        } catch (e) {
            $('gp-publish-btn').disabled = false;
            if (e.status === 409 && e.body && e.body.audit) {
                $('gp-job-body').innerHTML = auditMarkup(e.body.audit);
                fail('Publish blocked — the checks below have to pass first.');
            } else {
                fail('Could not publish: ' + e.message);
            }
        }
    }

    // ── Wizard ───────────────────────────────────────────────────────────────

    function renderStep() {
        var d = state.draft;
        global.GearStore.STEPS.forEach(function (s) {
            var pane = $('gp-step-' + s);
            if (pane) pane.hidden = s !== d.step;
            var tab = document.querySelector('[data-step="' + s + '"]');
            if (tab) tab.classList.toggle('is-current', s === d.step);
        });

        if (d.step === 'photos') global.GearImages.render($('gp-grid-host'), d);
        if (d.step === 'products') renderProducts();

        var blockers = global.GearStore.blockers(d, d.step);
        var nextBtn = $('gp-next-btn');
        if (nextBtn) {
            nextBtn.disabled = blockers.length > 0;
            $('gp-blockers').innerHTML = blockers.length
                ? '<ul>' + blockers.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
                : '';
        }
    }

    function renderProducts() {
        if (!state.config) return;
        var d = state.draft;
        $('gp-style-list').innerHTML = state.config.styles.map(function (s) {
            var on = d.styles.indexOf(s.option) >= 0;
            return '<label class="gp-check"><input type="checkbox" data-style="' + esc(s.option) + '"' +
                (on ? ' checked' : '') + '> ' + esc(s.option) +
                ' <span class="gp-muted">' + esc(s.sanmarStyle) + ' · $' + esc(s.price) + '</span></label>';
        }).join('');

        $('gp-size-list').innerHTML = (state.config.sizeOrder || []).map(function (sz) {
            var on = d.sizes.indexOf(sz) >= 0;
            return '<label class="gp-check"><input type="checkbox" data-size="' + esc(sz) + '"' +
                (on ? ' checked' : '') + '> ' + esc(sz) + '</label>';
        }).join('');

        $('gp-counter').textContent = d.colors.length + ' colours × ' +
            (d.seasonal ? d.seasons.length : d.styles.length) + ' garments × ' + d.sizes.length + ' sizes = ' +
            global.GearStore.variantCount(d) + ' variants → ' +
            global.GearStore.imagePlan(d).length + ' photos needed';
    }

    function goto(step) {
        state.draft.step = step;
        persist();
    }

    function nextStep() {
        var i = global.GearStore.STEPS.indexOf(state.draft.step);
        if (i >= 0 && i < global.GearStore.STEPS.length - 1) goto(global.GearStore.STEPS[i + 1]);
    }

    // ── Boot ─────────────────────────────────────────────────────────────────

    function bindEvents() {
        $('gp-next-btn').addEventListener('click', nextStep);
        $('gp-back-btn').addEventListener('click', function () {
            var i = global.GearStore.STEPS.indexOf(state.draft.step);
            if (i > 0) goto(global.GearStore.STEPS[i - 1]);
        });

        ['designNumber', 'designName', 'designDescription'].forEach(function (field) {
            var el = $('gp-' + field);
            el.addEventListener('input', function () {
                state.draft[field] = el.value;
                state.draft.identitySource = state.draft.identitySource || 'typed';
                global.GearStore.save(state.draft);
                renderStep();
            });
        });
        $('gp-designNumber').addEventListener('blur', checkDuplicate);

        $('gp-screenshot').addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) readScreenshot(e.target.files[0]);
        });
        document.addEventListener('paste', function (e) {
            if (state.draft.step !== 'identity') return;
            var items = (e.clipboardData && e.clipboardData.items) || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                    readScreenshot(items[i].getAsFile());
                    e.preventDefault();
                    return;
                }
            }
        });

        $('gp-style-list').addEventListener('change', async function (e) {
            var option = e.target.getAttribute('data-style');
            if (!option) return;
            var d = state.draft;
            if (e.target.checked) d.styles.push(option); else d.styles = d.styles.filter(function (s) { return s !== option; });

            if (d.styles.length && !d.colors.length) {
                var def = state.config.styles.filter(function (s) { return s.option === d.styles[0]; })[0];
                try {
                    var colors = await loadColors(def.sanmarStyle);
                    $('gp-color-list').innerHTML = colors.slice(0, 40).map(function (c) {
                        return '<label class="gp-check gp-swatch"><input type="checkbox" data-color="' +
                            esc(c.catalogColor) + '"> <img src="' + esc(c.swatchImage) + '" alt="" class="gp-swatch-img">' +
                            esc(c.colorName) + '</label>';
                    }).join('');
                    $('gp-color-list').dataset.loaded = JSON.stringify(colors);
                } catch (err) { fail('Could not load colours: ' + err.message); }
            }
            persist();
        });

        $('gp-color-list').addEventListener('change', function (e) {
            var catalogColor = e.target.getAttribute('data-color');
            if (!catalogColor) return;
            var all = JSON.parse($('gp-color-list').dataset.loaded || '[]');
            var picked = all.filter(function (c) { return c.catalogColor === catalogColor; })[0];
            var d = state.draft;
            if (e.target.checked && picked) d.colors.push(picked);
            else d.colors = d.colors.filter(function (c) { return c.catalogColor !== catalogColor; });
            persist();
        });

        $('gp-size-list').addEventListener('change', function (e) {
            var size = e.target.getAttribute('data-size');
            if (!size) return;
            var d = state.draft;
            if (e.target.checked) d.sizes.push(size); else d.sizes = d.sizes.filter(function (s) { return s !== size; });
            d.sizes.sort(function (a, b) {
                return (state.config.sizeOrder || []).indexOf(a) - (state.config.sizeOrder || []).indexOf(b);
            });
            persist();
        });

        // Grid: click a cell to pick a file, drop onto it, or set it as the hero.
        var host = $('gp-grid-host');
        host.addEventListener('click', function (e) {
            var cell = e.target.closest('.gp-cell');
            if (!cell) return;
            var act = e.target.getAttribute('data-act');
            var key = cell.getAttribute('data-key');
            if (act === 'remove') {
                delete state.draft.images[key];
                if (state.draft.heroKey === key) state.draft.heroKey = '';
                persist();
                return;
            }
            if (e.target.type === 'radio') return;
            pickFile(key);
        });
        host.addEventListener('change', function (e) {
            if (e.target.name === 'gp-hero') { state.draft.heroKey = e.target.value; persist(); }
        });
        host.addEventListener('dragover', function (e) { e.preventDefault(); });
        host.addEventListener('drop', function (e) {
            e.preventDefault();
            var cell = e.target.closest('.gp-cell');
            if (!cell || !e.dataTransfer.files.length) return;
            global.GearImages.accept(state.draft, cell.getAttribute('data-key'), e.dataTransfer.files[0], persist);
        });

        $('gp-alt').addEventListener('input', function () { state.draft.altText = this.value; global.GearStore.save(state.draft); });
        $('gp-classify-btn').addEventListener('click', classify);
        $('gp-draft-btn').addEventListener('click', draftCopy);
        $('gp-hook').addEventListener('input', function () { state.draft.hook = this.value; global.GearStore.save(state.draft); renderStep(); });
        $('gp-body').addEventListener('input', function () {
            state.draft.body = this.value; updateWordCount(); global.GearStore.save(state.draft); renderStep();
        });
        $('gp-create-btn').addEventListener('click', createDraftProduct);
        $('gp-publish-btn').addEventListener('click', publish);
        $('gp-refresh-collections').addEventListener('click', async function () {
            try {
                var out = await gearFetch('/api/gear/config/refresh-collections', { method: 'POST' }, 45000);
                $('gp-classify-result').innerHTML =
                    '<p class="gp-inline-ok">Read ' + out.collections + ' collections, ' + out.automatic +
                    ' automatic. Save these into the settings table: <code>' + esc(JSON.stringify(out.tagVocabulary)) + '</code></p>';
            } catch (e) { fail('Could not read the collection rules: ' + e.message); }
        });
    }

    function pickFile(key) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png';
        input.addEventListener('change', function () {
            if (input.files && input.files[0]) {
                global.GearImages.accept(state.draft, key, input.files[0], persist);
            }
        });
        input.click();
    }

    async function boot() {
        var params = new URLSearchParams(location.search);
        var draftId = params.get('draft') || String(Date.now());
        state.draft = global.GearStore.load(draftId) || global.GearStore.newDraft(draftId);

        bindEvents();
        renderStep();
        await loadConfig();
        renderStep();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    global.GearPublisher = { state: state, gearFetch: gearFetch, classify: classify, publish: publish };
}(window));
