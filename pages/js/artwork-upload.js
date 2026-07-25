/**
 * artwork-upload.js — the artwork step for the public instant-quote pages.
 * Shared by /custom-stickers and /custom-banners. One implementation, two
 * consumers; a change here must be checked on both.
 *
 * 🔴 THE UPLOAD MUST NEVER COST US THE LEAD. Artwork is OPTIONAL at every point.
 * A rejected file, an oversized file, a dead network, a missing APP_CONFIG — none
 * of them may block the quote request or lose what the customer typed. Every
 * failure path ends the same way: keep going, email it later. That posture is
 * copied deliberately from pages/request-a-quote.js, which learned it the hard
 * way; the worst outcome here is a customer who wanted a quote not getting one
 * because a PDF was 21 MB.
 *
 * Uploads happen ON SELECTION, not on submit, so the customer sees the result
 * while they are still filling in their details and the submit stays instant.
 *
 * The client-side type/size checks are for FAST, HUMAN feedback only. The server
 * is the authority (see caspio-pricing-proxy files-simple.js — mimetype
 * allow-list plus an extension guard on the octet-stream wildcard).
 */
(function (global) {
    'use strict';

    var MAX_BYTES = 20 * 1024 * 1024;   // matches the server's multer limit

    // What a sticker/banner customer actually sends. Mirrors the competitor's
    // list plus the vector formats our printer wants.
    var ACCEPT_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'svgz',
                      'tif', 'tiff', 'pdf', 'psd', 'ai', 'eps', 'ps'];

    var ACCEPT_ATTR = [
        'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
        'image/tiff', 'application/pdf', 'image/vnd.adobe.photoshop',
        'application/postscript', 'application/illustrator',
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.svgz',
        '.tif', '.tiff', '.pdf', '.psd', '.ai', '.eps', '.ps'
    ].join(',');

    function extensionOf(name) {
        var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        return m ? m[1] : '';
    }

    function formatBytes(n) {
        if (!(n > 0)) return '';
        if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Pure. Returns {ok:true} or {ok:false, reason, message}.
     * Messages are written to be read by a customer, not a developer: each one
     * says what happened AND that their quote is unaffected.
     */
    function validate(file) {
        if (!file) return { ok: false, reason: 'none', message: '' };
        if (file.size > MAX_BYTES) {
            return {
                ok: false, reason: 'too_big',
                message: 'That file is over 20 MB. Email it to sales@nwcustomapparel.com and we\'ll match it up — your quote request still goes through.'
            };
        }
        if (file.size === 0) {
            return {
                ok: false, reason: 'empty',
                message: 'That file looks empty. Try re-saving it, or email it to sales@nwcustomapparel.com.'
            };
        }
        if (ACCEPT_EXT.indexOf(extensionOf(file.name)) === -1) {
            return {
                ok: false, reason: 'type',
                message: 'We can\'t read that file type. Send a PNG, JPG, PDF, SVG, AI, EPS or PSD — or email it to sales@nwcustomapparel.com and we\'ll sort it out.'
            };
        }
        return { ok: true };
    }

    function apiBase() {
        if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
            return global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /**
     * Wire up an artwork dropzone.
     *
     * opts: { zone, input, status, remove, describe, onChange }
     *   zone     — the drop target (also the visual affordance)
     *   input    — a REAL <input type="file">; drag/drop is an enhancement on top,
     *              so the control stays keyboard- and screen-reader-operable
     *   status   — aria-live element for progress and errors
     *   remove   — "Remove" button, hidden until a file is attached
     *   describe — () => string, a label sent with the upload so the file is
     *              identifiable in the Artwork folder without opening it
     *   onChange — (state) => void; state = {url, name, size, status}
     */
    function init(opts) {
        var zone = opts.zone, input = opts.input, status = opts.status,
            remove = opts.remove;
        if (!zone || !input) return null;

        input.setAttribute('accept', ACCEPT_ATTR);

        var state = { url: '', key: '', name: '', size: 0, status: 'idle' };
        var reqId = 0;   // guards against a slow first upload landing after a second

        function emit() { if (opts.onChange) opts.onChange(Object.assign({}, state)); }

        function say(html, kind) {
            status.innerHTML = html;
            status.className = 'aw-status' + (kind ? ' is-' + kind : '');
        }

        function reset(msg, kind) {
            state = { url: '', key: '', name: '', size: 0, status: msg ? 'error' : 'idle' };
            if (remove) remove.hidden = true;
            zone.classList.remove('has-file');
            if (msg) say(msg, kind || 'error'); else say('', '');
            emit();
        }

        function upload(file) {
            var v = validate(file);
            if (!v.ok) { input.value = ''; reset(esc(v.message), 'error'); return; }

            var base = apiBase();
            if (!base) {
                input.value = '';
                reset('Upload isn\'t available right now — email your artwork to ' +
                      '<a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a>. ' +
                      'Your quote request still goes through.', 'error');
                return;
            }

            var mine = ++reqId;
            state.status = 'uploading';
            state.name = file.name;
            state.size = file.size;
            emit();
            say('Uploading ' + esc(file.name) + '…', 'busy');

            var fd = new FormData();
            fd.append('file', file);
            if (opts.describe) {
                try { fd.append('description', String(opts.describe()).slice(0, 200)); } catch (_) {}
            }

            fetch(base + '/api/files/upload', { method: 'POST', body: fd })
                .then(function (r) {
                    return r.json().catch(function () { return {}; }).then(function (b) {
                        if (!r.ok || !b.success) {
                            var e = new Error(b.error || ('HTTP ' + r.status));
                            e.code = b.code; e.httpStatus = r.status;
                            throw e;
                        }
                        return b;
                    });
                })
                .then(function (b) {
                    if (mine !== reqId) return;      // superseded by a later pick
                    state.key = b.externalKey || '';
                    state.url = state.key ? base + '/api/files/' + encodeURIComponent(state.key) : '';
                    state.name = b.originalName || file.name;
                    state.size = b.size || file.size;
                    state.status = 'done';
                    zone.classList.add('has-file');
                    if (remove) remove.hidden = false;
                    say('Attached: <strong>' + esc(state.name) + '</strong>' +
                        (state.size ? ' <span class="aw-size">' + formatBytes(state.size) + '</span>' : ''), 'ok');
                    emit();
                })
                .catch(function (err) {
                    if (mine !== reqId) return;
                    console.error('[artwork-upload] failed:', err);
                    input.value = '';
                    // Every failure lands in the same place: the quote is fine.
                    var msg = err.httpStatus === 415
                        ? 'We can\'t read that file type.'
                        : 'That upload didn\'t go through.';
                    reset(msg + ' No problem — email it to ' +
                          '<a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a> ' +
                          'and your quote request still goes through.', 'error');
                });
        }

        input.addEventListener('change', function () {
            if (this.files && this.files[0]) upload(this.files[0]);
        });

        // Drag/drop is additive. The <input> above already covers keyboard and
        // assistive tech, so nothing here is the only way to do anything.
        ['dragenter', 'dragover'].forEach(function (ev) {
            zone.addEventListener(ev, function (e) {
                e.preventDefault(); e.stopPropagation();
                zone.classList.add('is-over');
            });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            zone.addEventListener(ev, function (e) {
                e.preventDefault(); e.stopPropagation();
                zone.classList.remove('is-over');
            });
        });
        zone.addEventListener('drop', function (e) {
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) upload(f);
        });

        if (remove) {
            remove.addEventListener('click', function () {
                reqId++;                 // cancel any in-flight upload's effect
                input.value = '';
                reset('', '');
            });
        }

        return {
            get: function () { return Object.assign({}, state); },
            reset: function () { reqId++; input.value = ''; reset('', ''); }
        };
    }

    var ArtworkUpload = {
        MAX_BYTES: MAX_BYTES,
        ACCEPT_EXT: ACCEPT_EXT,
        ACCEPT_ATTR: ACCEPT_ATTR,
        extensionOf: extensionOf,
        formatBytes: formatBytes,
        validate: validate,
        init: init
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = ArtworkUpload;
    if (typeof global !== 'undefined') global.ArtworkUpload = ArtworkUpload;
})(typeof window !== 'undefined' ? window : globalThis);
