/**
 * gear-publisher-store.js — the draft model for the 253gear publisher.
 *
 * PURE. No DOM, no fetch. Everything the wizard knows lives in one object so a
 * refresh, a crash, or a dyno cycle mid-publish can resume from localStorage.
 *
 * The important thing in here is `imagePlan()`. The photo grid is not a convenience
 * — it IS the variant-to-image binding surface. Each cell carries its (Style, Colour)
 * pair, so the mapping is correct by construction rather than inferred from a
 * filename. Getting that wrong is the defect that shipped on 253gear.com twice: 644
 * variants after the tee/hoodie merge, then seven Fall variants of #40749, each
 * showing a hoodie photo above a T-Shirt price.
 */
(function (global) {
    'use strict';

    var STORAGE_PREFIX = 'gearPublisherDraft:';
    var STEPS = ['identity', 'products', 'photos', 'story', 'review', 'live'];

    // Shopify's zoom wants ~2048px on the long edge; below that a product photo
    // looks soft the moment a shopper zooms.
    var MIN_LONG_EDGE = 2048;
    var MAX_BYTES = 20 * 1024 * 1024;
    var ASPECT_TOLERANCE = 0.02;   // mixed ratios make the gallery jump between thumbnails

    function newDraft(draftId) {
        return {
            draftId: draftId,
            designNumber: '',
            designName: '',
            designDescription: '',
            identitySource: '',        // 'typed' | 'screenshot'
            city: '',
            styles: [],
            colors: [],                // [{ colorName, catalogColor, swatchImage }]
            sizes: [],
            seasonal: false,
            seasons: [],
            images: {},                // key -> { externalKey, hostedUrl, altText, state, error, width, height }
            heroKey: '',
            altText: '',
            hook: '',
            body: '',
            facts: {},
            seoTitle: '',
            seoDescription: '',
            tags: [],
            classification: null,
            step: 'identity',
            productGid: '',
            productId: '',
            handle: '',
            publishedAt: '',
            idempotencyKey: ''
        };
    }

    /** Stable key for one grid cell. Mirrors the server's binding key exactly. */
    function cellKey(styleOption, catalogColor) {
        return String(styleOption).trim().toLowerCase() + '|||' + String(catalogColor).trim().toLowerCase();
    }

    /**
     * Every product image the draft needs: one per (Style x Colour).
     *
     * Size deliberately does NOT appear. The live theme's photo-click handler treats
     * an option as "decided" by a photo only when every variant sharing that photo
     * agrees on it — so with one image per Style x Colour a click sets Style and
     * Colour while a shopper's chosen size survives. One image per variant would
     * break that; one per colour would stop a click setting Style.
     */
    function imagePlan(draft) {
        var plan = [];
        var primaries = draft.seasonal ? draft.seasons : draft.styles;
        for (var i = 0; i < primaries.length; i++) {
            for (var j = 0; j < draft.colors.length; j++) {
                var color = draft.colors[j];
                var catalogColor = color.catalogColor || color.colorName;
                plan.push({
                    key: cellKey(primaries[i], catalogColor),
                    styleOption: primaries[i],
                    colorName: color.colorName,
                    catalogColor: catalogColor,
                    swatchImage: color.swatchImage || ''
                });
            }
        }
        return plan;
    }

    function variantCount(draft) {
        var primaries = draft.seasonal ? draft.seasons.length : draft.styles.length;
        return primaries * draft.colors.length * draft.sizes.length;
    }

    /** Cells still waiting on a file. Non-empty means unbound variants — a hard stop. */
    function missingCells(draft) {
        return imagePlan(draft).filter(function (cell) {
            var img = draft.images[cell.key];
            return !img || img.state !== 'uploaded' || !img.externalKey;
        });
    }

    /** Images ready to send, in gallery order (hero first). */
    function uploadedImages(draft) {
        var plan = imagePlan(draft);
        var out = [];
        for (var i = 0; i < plan.length; i++) {
            var img = draft.images[plan[i].key];
            if (!img || !img.externalKey) continue;
            out.push({
                externalKey: img.externalKey,
                styleOption: plan[i].styleOption,
                catalogColor: plan[i].catalogColor,
                altText: (img.altText || draft.altText || '').trim(),
                primary: plan[i].key === draft.heroKey
            });
        }
        out.sort(function (a, b) { return (b.primary ? 1 : 0) - (a.primary ? 1 : 0); });
        return out;
    }

    /**
     * Validate one file BEFORE upload, so a bad photo is refused at its own cell with
     * a real reason instead of being silently accepted and softening a product page.
     * `existing` supplies the aspect ratio already established by the set.
     */
    function validateImage(file, dims, existingAspect) {
        var problems = [];
        if (!/^image\/(jpeg|png)$/.test(file.type)) {
            problems.push('Needs to be a JPEG or PNG (this is ' + (file.type || 'unknown') + ').');
        }
        if (file.size > MAX_BYTES) {
            problems.push('File is ' + Math.round(file.size / 1024 / 1024) + ' MB — the limit is 20 MB.');
        }
        if (dims) {
            var longEdge = Math.max(dims.width, dims.height);
            if (longEdge < MIN_LONG_EDGE) {
                problems.push('Only ' + dims.width + '×' + dims.height +
                    '. Shopify\'s zoom needs at least ' + MIN_LONG_EDGE + 'px on the long edge.');
            }
            if (existingAspect) {
                var aspect = dims.width / dims.height;
                if (Math.abs(aspect - existingAspect) > ASPECT_TOLERANCE) {
                    problems.push('Shape does not match the other photos (' + aspect.toFixed(2) +
                        ' vs ' + existingAspect.toFixed(2) + '). Mixed shapes make the gallery jump.');
                }
            }
        }
        return problems;
    }

    /** The aspect ratio the set has already committed to, if any. */
    function establishedAspect(draft) {
        var keys = Object.keys(draft.images);
        for (var i = 0; i < keys.length; i++) {
            var img = draft.images[keys[i]];
            if (img && img.width && img.height) return img.width / img.height;
        }
        return null;
    }

    /** What still blocks the next step. Empty array means go. */
    function blockers(draft, step) {
        var out = [];
        if (step === 'identity') {
            if (!/^\d{4,6}$/.test(String(draft.designNumber).trim())) out.push('A ShopWorks design number (4-6 digits).');
            if (!String(draft.designName).trim()) out.push('A design name.');
            if (!String(draft.designDescription).trim()) out.push('The ShopWorks design description.');
        }
        if (step === 'products') {
            if (!draft.styles.length) out.push('At least one garment.');
            if (!draft.colors.length) out.push('At least one colour.');
            if (!draft.sizes.length) out.push('At least one size.');
            if (draft.seasonal && draft.styles.length > 1) {
                out.push('A seasonal design can carry only one garment — Season, Size and Colour already fill Shopify\'s three options.');
            }
        }
        if (step === 'photos') {
            var missing = missingCells(draft);
            if (missing.length) {
                out.push(missing.length + ' photo' + (missing.length === 1 ? '' : 's') +
                    ' still needed — an empty cell means variants with no image.');
            }
            if (!draft.heroKey) out.push('Pick which photo is the main one.');
            if (!String(draft.altText).trim()) out.push('Alt text describing the design.');
        }
        if (step === 'story') {
            if (!String(draft.hook).trim()) out.push('A one-line hook.');
            if (!String(draft.body).trim()) out.push('The description body.');
        }
        return out;
    }

    function wordCount(text) {
        return String(text || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }

    /** Hook renders under the price; body follows. Kept separate so a rewrite can't lose the hook. */
    function descriptionHtml(draft) {
        var esc = function (s) {
            return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        var paras = String(draft.body || '').split(/\n{2,}/).filter(function (p) { return p.trim(); });
        return '<p>' + esc(draft.hook) + '</p>' +
            paras.map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
    }

    function save(draft) {
        try {
            global.localStorage.setItem(STORAGE_PREFIX + draft.draftId, JSON.stringify(draft));
        } catch (e) { /* quota or private mode — the draft still works in memory */ }
    }

    function load(draftId) {
        try {
            var raw = global.localStorage.getItem(STORAGE_PREFIX + draftId);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function list() {
        var out = [];
        try {
            for (var i = 0; i < global.localStorage.length; i++) {
                var k = global.localStorage.key(i);
                if (k && k.indexOf(STORAGE_PREFIX) === 0) {
                    try { out.push(JSON.parse(global.localStorage.getItem(k))); } catch (e) { /* skip */ }
                }
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    function remove(draftId) {
        try { global.localStorage.removeItem(STORAGE_PREFIX + draftId); } catch (e) { /* ignore */ }
    }

    global.GearStore = {
        newDraft: newDraft,
        cellKey: cellKey,
        imagePlan: imagePlan,
        variantCount: variantCount,
        missingCells: missingCells,
        uploadedImages: uploadedImages,
        validateImage: validateImage,
        establishedAspect: establishedAspect,
        blockers: blockers,
        wordCount: wordCount,
        descriptionHtml: descriptionHtml,
        save: save,
        load: load,
        list: list,
        remove: remove,
        STEPS: STEPS,
        MIN_LONG_EDGE: MIN_LONG_EDGE,
        MAX_BYTES: MAX_BYTES
    };
}(window));
