/**
 * gear-publisher-images.js — the photo grid.
 *
 * Rows are colours, columns are garments, and every cell is labelled with the pair it
 * stands for ("Hoodie · Jet Black"). Dropping a file on a cell IS the variant-to-image
 * binding: the cell carries the (Style, Colour), so nothing is parsed out of a
 * filename and nothing is inferred. That is deliberate — a mis-binding is invisible in
 * the admin and shows a customer a hoodie photo above a T-Shirt price.
 *
 * Every cell must be filled before the wizard advances. An empty cell is not a
 * cosmetic gap, it is variants with no image.
 */
(function (global) {
    'use strict';

    var UPLOAD_TIMEOUT_MS = 120000;

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Natural dimensions, read before upload so a too-small file is refused instantly. */
    function readDimensions(file) {
        return new Promise(function (resolve) {
            if (!global.createImageBitmap) return resolve(null);
            global.createImageBitmap(file).then(function (bmp) {
                var dims = { width: bmp.width, height: bmp.height };
                if (bmp.close) bmp.close();
                resolve(dims);
            }).catch(function () { resolve(null); });
        });
    }

    /**
     * Upload one file to Caspio Files and return its externalKey.
     *
     * Goes straight to the proxy's /api/files/upload — the same open intake the art
     * forms and the /custom-tees checkout already use — rather than through a new
     * gated forwarder. The URL comes from APP_CONFIG (never a literal, which the
     * no-hardcoded-hosts ratchet forbids). Only the Shopify calls need the page gate;
     * the file itself is inert until a create references its key.
     *
     * XHR rather than fetch so the cell can show real progress on a 5 MB photo.
     */
    function uploadFile(file, onProgress) {
        return new Promise(function (resolve, reject) {
            var form = new FormData();
            form.append('file', file);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', global.DashPage.apiUrl('/api/files/upload'), true);
            xhr.timeout = UPLOAD_TIMEOUT_MS;

            xhr.upload.onprogress = function (e) {
                if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
            };
            xhr.onload = function () {
                var body = {};
                try { body = JSON.parse(xhr.responseText || '{}'); } catch (e) { /* handled below */ }
                if (xhr.status >= 200 && xhr.status < 300 && body.externalKey) {
                    resolve(body);
                } else {
                    reject(new Error(body.error || ('Upload failed (HTTP ' + xhr.status + ')')));
                }
            };
            xhr.onerror = function () { reject(new Error('Upload failed — network error')); };
            xhr.ontimeout = function () { reject(new Error('Upload timed out after 2 minutes')); };
            xhr.send(form);
        });
    }

    function cellMarkup(cell, img, isHero) {
        var state = (img && img.state) || 'empty';
        var body;

        if (state === 'uploaded' || state === 'ready') {
            body = '<img class="gp-cell-thumb" src="' + esc(img.previewUrl || '') + '" alt="">' +
                '<div class="gp-cell-actions">' +
                '<button type="button" class="gp-cell-btn" data-act="replace">Replace</button>' +
                '<button type="button" class="gp-cell-btn" data-act="remove">Remove</button>' +
                '</div>';
        } else if (state === 'uploading') {
            body = '<div class="gp-cell-progress"><div class="gp-cell-progress-bar" style="width:' +
                (img.progress || 0) + '%"></div></div>' +
                '<span class="gp-cell-status">Uploading ' + (img.progress || 0) + '%</span>';
        } else if (state === 'failed') {
            // The real reason, never "something went wrong" — Erik's rule 4.
            body = '<div class="gp-cell-error">' + esc(img.error || 'Upload failed') + '</div>' +
                '<button type="button" class="gp-cell-btn" data-act="retry">Try again</button>';
        } else {
            body = '<div class="gp-cell-empty"><span class="gp-cell-plus">+</span>' +
                '<span class="gp-cell-hint">Drop a photo</span></div>';
        }

        return '<div class="gp-cell gp-cell--' + state + (isHero ? ' gp-cell--hero' : '') + '"' +
            ' data-key="' + esc(cell.key) + '" tabindex="0" role="button"' +
            ' aria-label="Photo for ' + esc(cell.styleOption) + ', ' + esc(cell.colorName) + '">' +
            '<div class="gp-cell-label">' + esc(cell.styleOption) + ' · ' + esc(cell.colorName) + '</div>' +
            body +
            '<label class="gp-cell-hero"><input type="radio" name="gp-hero" value="' + esc(cell.key) + '"' +
            (isHero ? ' checked' : '') + '> Main photo</label>' +
            '</div>';
    }

    function render(container, draft) {
        var plan = global.GearStore.imagePlan(draft);
        if (!plan.length) {
            container.innerHTML = '<p class="gp-empty">Pick garments and colours first — the grid is built from them.</p>';
            return;
        }

        var missing = global.GearStore.missingCells(draft).length;
        var total = plan.length;
        var variants = global.GearStore.variantCount(draft);

        var summary = '<div class="gp-grid-summary' + (missing ? ' gp-grid-summary--blocked' : ' gp-grid-summary--ok') + '">' +
            (missing
                ? '<strong>' + missing + ' of ' + total + ' photos still needed.</strong> ' +
                  'Every garment-and-colour pair needs one, or those variants ship with no image.'
                : '<strong>' + variants + ' variants → ' + total + ' images. Every variant is bound. ✔</strong>') +
            '</div>';

        container.innerHTML = summary +
            '<div class="gp-grid">' +
            plan.map(function (cell) {
                return cellMarkup(cell, draft.images[cell.key], draft.heroKey === cell.key);
            }).join('') +
            '</div>' +
            '<details class="gp-binding"><summary>Show which photo each variant uses</summary>' +
            bindingTable(draft, plan) + '</details>';
    }

    /** The check that would have caught both prior incidents, on screen rather than buried. */
    function bindingTable(draft, plan) {
        var rows = [];
        for (var i = 0; i < plan.length; i++) {
            var cell = plan[i];
            var img = draft.images[cell.key];
            for (var s = 0; s < draft.sizes.length; s++) {
                rows.push('<tr class="' + (img && img.externalKey ? '' : 'gp-row-unbound') + '">' +
                    '<td>' + esc(cell.styleOption) + '</td>' +
                    '<td>' + esc(cell.colorName) + '</td>' +
                    '<td>' + esc(draft.sizes[s]) + '</td>' +
                    '<td>' + (img && img.externalKey ? 'bound' : '<strong>NO IMAGE</strong>') + '</td>' +
                    '</tr>');
            }
        }
        return '<table class="gp-binding-table"><thead><tr>' +
            '<th>Garment</th><th>Colour</th><th>Size</th><th>Photo</th></tr></thead><tbody>' +
            rows.join('') + '</tbody></table>';
    }

    /**
     * Take a file for one cell: validate, then upload.
     * Validation failures set the cell to `failed` with the reason and never upload.
     */
    async function accept(draft, key, file, onChange) {
        var dims = await readDimensions(file);
        var problems = global.GearStore.validateImage(file, dims, global.GearStore.establishedAspect(draft));

        if (problems.length) {
            draft.images[key] = { state: 'failed', error: problems.join(' '), width: dims && dims.width, height: dims && dims.height };
            onChange();
            return;
        }

        var previewUrl = global.URL.createObjectURL(file);
        draft.images[key] = { state: 'uploading', progress: 0, previewUrl: previewUrl, width: dims.width, height: dims.height };
        onChange();

        try {
            var result = await uploadFile(file, function (pct) {
                if (draft.images[key]) draft.images[key].progress = pct;
                onChange();
            });
            draft.images[key] = {
                state: 'uploaded',
                externalKey: result.externalKey,
                hostedUrl: result.hostedUrl || '',
                previewUrl: previewUrl,
                width: dims.width,
                height: dims.height,
                altText: (draft.images[key] && draft.images[key].altText) || ''
            };
            if (!draft.heroKey) draft.heroKey = key;   // first photo in is the default main
        } catch (e) {
            draft.images[key] = { state: 'failed', error: e.message, previewUrl: previewUrl, width: dims.width, height: dims.height };
        }
        onChange();
    }

    global.GearImages = {
        render: render,
        accept: accept,
        readDimensions: readDimensions,
        bindingTable: bindingTable
    };
}(window));
