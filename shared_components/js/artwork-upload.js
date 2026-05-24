/**
 * Artwork Upload — shared component for quote builders
 *
 * Provides drag-drop + multi-file artwork upload for reps. Files post to
 * Caspio's Artwork folder via the existing /api/files/upload endpoint.
 *
 * Used by EMB / DTF / SCP quote builders to attach reference artwork to a
 * quote. The uploaded file refs ({externalKey, hostedUrl, fileName, size})
 * are stored as `referenceArtwork` inside the quote_sessions.Notes JSON
 * (no schema change needed).
 *
 * DTG has its own inline implementation at dtg-inline-form.js:2727-2989
 * with extra features (design name, placements, links into the ShopWorks
 * Designs[] payload to auto-create a design record). This shared module
 * is intentionally simpler — "reference art the rep saw" for the quote,
 * no SW design auto-creation. EMB/DTF/SCP already use GarmentDesignNumber
 * for the SW design link.
 *
 * Usage:
 *   <div id="my-builder-artwork-mount"></div>
 *
 *   const widget = ArtworkUpload.attach({
 *     mountSelector: '#my-builder-artwork-mount',
 *     onChange: (files) => { console.log('files changed', files); },
 *   });
 *
 *   // Read uploaded files when saving:
 *   const files = widget.getFiles();  // [{externalKey, hostedUrl, fileName, size, mimeType}]
 *
 *   // Reset (e.g. after save success):
 *   widget.clear();
 *
 *   // Pre-populate (e.g. editing existing quote):
 *   widget.setFiles(existingArtworkArray);
 *
 * Created 2026-05-23 — Phase 9 (DTG feature parity for EMB/DTF/SCP).
 */

(function (global) {
    'use strict';

    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
    const ACCEPT_REGEX = /\.(ai|eps|pdf|png|jpe?g|tiff?|psd|svg|webp)$/i;
    const ACCEPT_ATTR = '.ai,.eps,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.psd,.svg,.webp';

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    function getApiBase() {
        if (typeof window !== 'undefined' && window.APP_CONFIG?.API?.BASE_URL) {
            return window.APP_CONFIG.API.BASE_URL;
        }
        return 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    function validateFile(file) {
        if (!file) return 'No file selected';
        if (file.size > MAX_BYTES) {
            return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB · max 20 MB)`;
        }
        if (!ACCEPT_REGEX.test(file.name)) {
            const ext = file.name.split('.').pop();
            return `File type .${ext} not allowed. Use AI / EPS / PSD / PDF / PNG / JPG / TIFF / SVG / WebP.`;
        }
        return null;
    }

    // Single-file upload to Caspio via the proxy. Returns
    // {externalKey, hostedUrl, fileName, originalName, size, mimeType}
    // Rejects with Error on failure.
    function uploadOne(file, onProgress) {
        const apiBase = getApiBase();
        const formData = new FormData();
        formData.append('file', file);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        if (!result.externalKey) {
                            reject(new Error('Upload response missing externalKey'));
                            return;
                        }
                        resolve({
                            externalKey: result.externalKey,
                            hostedUrl: `${apiBase}/api/files/${result.externalKey}`,
                            fileName: result.fileName || file.name,
                            originalName: result.originalName || file.name,
                            size: result.size || file.size,
                            mimeType: result.mimeType || file.type,
                            uploadedAt: new Date().toISOString(),
                        });
                    } catch (e) {
                        reject(new Error(`Upload OK but parse failed: ${e.message}`));
                    }
                } else {
                    let detail = '';
                    try {
                        const errBody = JSON.parse(xhr.responseText);
                        detail = errBody.error || errBody.details || xhr.responseText.substring(0, 200);
                    } catch {
                        detail = xhr.responseText.substring(0, 200);
                    }
                    reject(new Error(`Upload failed (HTTP ${xhr.status}): ${detail}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

            xhr.open('POST', `${apiBase}/api/files/upload`);
            xhr.send(formData);
        });
    }

    function fileIconHtml(fileName, hostedUrl) {
        const ext = (fileName || '').split('.').pop().toLowerCase();
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
        if (isImage && hostedUrl) {
            return `<img class="artwork-thumb-img" src="${escapeHtml(hostedUrl)}" alt="${escapeHtml(fileName)}" loading="lazy">`;
        }
        const iconMap = {
            ai: 'fa-bezier-curve', eps: 'fa-bezier-curve', pdf: 'fa-file-pdf',
            psd: 'fa-layer-group', tiff: 'fa-image', tif: 'fa-image',
        };
        const icon = iconMap[ext] || 'fa-file';
        return `<div class="artwork-thumb-icon"><i class="fas ${icon}"></i><div class="artwork-thumb-ext">${escapeHtml(ext.toUpperCase())}</div></div>`;
    }

    function attach(opts) {
        const opts2 = Object.assign({
            mountSelector: null,
            title: 'Reference Artwork',
            subtitle: 'Optional — attach customer-supplied artwork to this quote (AI/EPS/PSD/PDF/PNG/JPG/TIFF · 20 MB max each)',
            onChange: null,
        }, opts || {});

        const mount = typeof opts2.mountSelector === 'string'
            ? document.querySelector(opts2.mountSelector)
            : opts2.mountSelector;

        if (!mount) {
            console.warn('[ArtworkUpload] Mount element not found:', opts2.mountSelector);
            return null;
        }

        // Generate unique IDs (allow multiple widgets per page in theory)
        const uid = `artwork-upload-${Math.random().toString(36).slice(2, 8)}`;
        const dropzoneId = `${uid}-dropzone`;
        const inputId = `${uid}-input`;
        const listId = `${uid}-list`;
        const statusId = `${uid}-status`;

        // Render the widget HTML
        mount.innerHTML = `
            <div class="artwork-upload-widget">
                <div class="artwork-upload-head">
                    <i class="fas fa-paint-brush"></i>
                    <span class="artwork-upload-title">${escapeHtml(opts2.title)}</span>
                </div>
                <div class="artwork-upload-sub">${escapeHtml(opts2.subtitle)}</div>
                <div class="artwork-dropzone" id="${dropzoneId}" tabindex="0" role="button" aria-label="Upload artwork file">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <div class="artwork-dropzone-msg">
                        <strong>Drop files here</strong> or <span class="artwork-dropzone-browse">click to browse</span>
                    </div>
                    <div class="artwork-dropzone-sub">AI / EPS / PSD / PDF / PNG / JPG / TIFF · 20 MB max each</div>
                </div>
                <input type="file" id="${inputId}" class="artwork-file-input" accept="${ACCEPT_ATTR}" multiple hidden>
                <div class="artwork-list" id="${listId}"></div>
                <div class="artwork-status" id="${statusId}" aria-live="polite"></div>
            </div>
        `;

        const dropzone = document.getElementById(dropzoneId);
        const input = document.getElementById(inputId);
        const listEl = document.getElementById(listId);
        const statusEl = document.getElementById(statusId);

        // State — owned by this widget instance
        const state = {
            files: [],     // [{externalKey, hostedUrl, fileName, ...}]
            uploading: 0,  // count of in-flight uploads
        };

        function fireChange() {
            if (typeof opts2.onChange === 'function') {
                try {
                    opts2.onChange(state.files.slice());
                } catch (e) {
                    console.error('[ArtworkUpload] onChange handler threw:', e);
                }
            }
        }

        function renderList() {
            if (state.files.length === 0) {
                listEl.innerHTML = '';
                return;
            }
            listEl.innerHTML = state.files.map((f, idx) => `
                <div class="artwork-file" data-idx="${idx}">
                    <div class="artwork-file-thumb">${fileIconHtml(f.fileName, f.hostedUrl)}</div>
                    <div class="artwork-file-meta">
                        <a href="${escapeHtml(f.hostedUrl)}" target="_blank" rel="noopener" class="artwork-file-name" title="Open in new tab">
                            ${escapeHtml(f.fileName)}
                        </a>
                        <div class="artwork-file-size">${(f.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" class="artwork-file-remove" data-idx="${idx}" title="Remove" aria-label="Remove ${escapeHtml(f.fileName)}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

            // Wire remove buttons
            listEl.querySelectorAll('.artwork-file-remove').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const idx = parseInt(btn.dataset.idx, 10);
                    if (!isNaN(idx)) {
                        state.files.splice(idx, 1);
                        renderList();
                        fireChange();
                    }
                });
            });
        }

        async function handleFiles(fileList) {
            const files = Array.from(fileList || []);
            if (files.length === 0) return;

            for (const file of files) {
                const err = validateFile(file);
                if (err) {
                    statusEl.textContent = `${file.name}: ${err}`;
                    statusEl.className = 'artwork-status artwork-status-error';
                    continue;
                }
                state.uploading += 1;
                statusEl.textContent = `Uploading ${file.name} …`;
                statusEl.className = 'artwork-status artwork-status-info';
                try {
                    const result = await uploadOne(file, (pct) => {
                        statusEl.textContent = `Uploading ${file.name} … ${pct}%`;
                    });
                    state.files.push(result);
                    renderList();
                    fireChange();
                    statusEl.textContent = `Uploaded ${file.name} ✓`;
                    statusEl.className = 'artwork-status artwork-status-success';
                } catch (e) {
                    console.error('[ArtworkUpload] Upload failed:', e);
                    statusEl.textContent = `Failed: ${e.message}`;
                    statusEl.className = 'artwork-status artwork-status-error';
                } finally {
                    state.uploading -= 1;
                }
            }
        }

        // Wire dropzone events
        dropzone.addEventListener('click', () => input.click());
        dropzone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('artwork-dropzone-active');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('artwork-dropzone-active');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('artwork-dropzone-active');
            handleFiles(e.dataTransfer.files);
        });

        input.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            // Reset input so the same file can be re-uploaded if removed + re-added
            input.value = '';
        });

        // Public API
        return {
            getFiles: () => state.files.slice(),
            setFiles: (arr) => {
                state.files = Array.isArray(arr) ? arr.slice() : [];
                renderList();
                fireChange();
            },
            clear: () => {
                state.files = [];
                renderList();
                statusEl.textContent = '';
                statusEl.className = 'artwork-status';
                fireChange();
            },
            isUploading: () => state.uploading > 0,
            count: () => state.files.length,
        };
    }

    const ArtworkUpload = { attach, validateFile, uploadOne };

    // Expose
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ArtworkUpload;
    }
    global.ArtworkUpload = ArtworkUpload;
})(typeof window !== 'undefined' ? window : globalThis);
