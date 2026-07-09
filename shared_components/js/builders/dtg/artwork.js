/**
 * DTG inline form — artwork module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global FormData, XMLHttpRequest,
   */
import { updateSubmitEnabled } from './form-core.js';
import { scheduleStateSave } from './persistence.js';
import { API_BASE, LOCATION_LABELS, NEW_ARTWORK_ACCEPT, NEW_ARTWORK_MAX_BYTES, NEW_ARTWORK_PLACEMENTS, state } from './state.js';
import { escapeHtml, markDirty } from './utils.js';

export function validateArtworkFile(file) {
    if (!file) return 'No file';
    if (file.size > NEW_ARTWORK_MAX_BYTES) {
        return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB · max 20 MB)`;
    }
    if (!NEW_ARTWORK_ACCEPT.test(file.name)) {
        return `File type not allowed (${file.name.split('.').pop()}). Use AI / EPS / PSD / PDF / PNG / JPG / TIFF / SVG / WebP.`;
    }
    return null;
}

// Upload a single file to Caspio via /api/files/upload — XHR-based for
// progress events. Returns { externalKey, hostedUrl, fileName, ... } on
// success, throws on failure.
export function uploadArtworkFileToCaspio(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (!e.lengthComputable || !onProgress) return;
            onProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    const hostedUrl = `${API_BASE}/api/files/${result.externalKey}`;
                    resolve({
                        externalKey: result.externalKey,
                        hostedUrl,
                        fileName: result.fileName || file.name,
                        originalName: result.originalName || file.name,
                        size: result.size || file.size,
                        mimeType: result.mimeType || file.type,
                    });
                } catch (e) {
                    reject(new Error(`Upload OK but parse failed: ${e.message}`));
                }
            } else {
                reject(new Error(`Upload failed (HTTP ${xhr.status}): ${xhr.responseText.substring(0, 200)}`));
            }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        xhr.open('POST', `${API_BASE}/api/files/upload`);
        xhr.send(formData);
    });
}

// Pick an icon for the uploaded file based on extension. Real images
// (PNG/JPG/WebP/SVG/GIF) get the proxy thumbnail; design files (AI/EPS/
// PSD/PDF) get a Font Awesome icon since browsers can't preview them.
export function artworkFileThumbHtml(file) {
    const ext = (file.fileName || '').split('.').pop().toLowerCase();
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
    if (isImage && file.hostedUrl) {
        return `<img class="dcp-newart-thumb-img" src="${escapeHtml(file.hostedUrl)}" alt="${escapeHtml(file.fileName)}">`;
    }
    // Design file — icon by type
    const iconMap = {
        ai: 'fa-bezier-curve', eps: 'fa-bezier-curve', pdf: 'fa-file-pdf',
        psd: 'fa-layer-group', tiff: 'fa-image', tif: 'fa-image',
    };
    const icon = iconMap[ext] || 'fa-file';
    return `<div class="dcp-newart-thumb-icon"><i class="fas ${icon}"></i><div class="dcp-newart-thumb-ext">${escapeHtml(ext.toUpperCase())}</div></div>`;
}

export function renderNewArtworkList() {
    const list = document.getElementById('dtgNewArtworkList');
    if (!list) return;
    const files = state.newArtwork.files || [];
    if (files.length === 0) {
        list.innerHTML = '';
        return;
    }
    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    list.innerHTML = files.map((f, idx) => `
        <div class="dcp-newart-card" data-file-idx="${idx}">
            <div class="dcp-newart-thumb">${artworkFileThumbHtml(f)}</div>
            <div class="dcp-newart-card-body">
                <div class="dcp-newart-card-name" title="${escapeHtml(f.fileName)}">${escapeHtml(f.fileName)}</div>
                <div class="dcp-newart-card-meta">${(f.fileSize / 1024).toFixed(0)} KB · ${escapeHtml(f.fileType || 'unknown')}</div>
                <div class="dcp-newart-card-placement">
                    <label>Placement:
                        <select class="dcp-newart-placement-select" data-file-idx="${idx}">
                            ${NEW_ARTWORK_PLACEMENTS.map(p => `<option value="${escapeHtml(p.code)}"${f.placement === p.code ? ' selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
                        </select>
                    </label>
                </div>
            </div>
            <button type="button" class="dcp-newart-remove" data-file-idx="${idx}" aria-label="Remove ${escapeHtml(f.fileName)}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Wire per-card handlers (event delegation would also work)
    list.querySelectorAll('.dcp-newart-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.fileIdx);
            state.newArtwork.files.splice(idx, 1);
            renderNewArtworkList();
            updateNewArtworkVisibility();
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        });
    });
    list.querySelectorAll('.dcp-newart-placement-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const idx = Number(sel.dataset.fileIdx);
            if (state.newArtwork.files[idx]) {
                state.newArtwork.files[idx].placement = sel.value;
                markDirty();
                scheduleStateSave();
            }
        });
    });
}

export function setNewArtworkStatus(text, cls) {
    const el = document.getElementById('dtgNewArtworkStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'dcp-newart-status' + (cls ? ' dcp-newart-status--' + cls : '');
}

export async function handleArtworkFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const filesToUpload = Array.from(fileList);
    for (const file of filesToUpload) {
        const err = validateArtworkFile(file);
        if (err) {
            setNewArtworkStatus(`✗ ${file.name}: ${err}`, 'error');
            continue;
        }
        setNewArtworkStatus(`Uploading ${file.name}…`, 'loading');
        try {
            const result = await uploadArtworkFileToCaspio(file, (pct) => {
                setNewArtworkStatus(`Uploading ${file.name}… ${pct}%`, 'loading');
            });
            state.newArtwork.files.push({
                fileName: result.fileName,
                uniqueFileName: result.originalName,
                hostedUrl: result.hostedUrl,
                externalKey: result.externalKey,
                fileSize: result.size,
                fileType: result.mimeType,
                // Default placement to the form's currently-selected front
                // location label (Left Chest / Full Front / Jumbo Front)
                placement: (LOCATION_LABELS[state.front] || 'Left Chest'),
            });
            setNewArtworkStatus(`✓ Uploaded ${file.name}`, 'success');
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        } catch (e) {
            setNewArtworkStatus(`✗ ${file.name}: ${e.message}`, 'error');
        }
    }
    renderNewArtworkList();
    updateNewArtworkVisibility();
    // Clear the "loading" status after a beat so success/error stays briefly
    setTimeout(() => {
        const el = document.getElementById('dtgNewArtworkStatus');
        if (el && el.classList.contains('dcp-newart-status--success')) {
            el.textContent = '';
            el.className = 'dcp-newart-status';
        }
    }, 2500);
}

// Show/hide the new-artwork block based on whether an existing Design # is
// picked. When rep has an existing design, hide the upload UI to enforce
// the "one or the other" rule (also enforced as a blocker in the readiness panel).
export function updateNewArtworkVisibility() {
    const block = document.getElementById('dtgNewArtworkBlock');
    if (!block) return;
    const hasExistingDesign = !!(state.customer.designNumber && String(state.customer.designNumber).trim());
    const hasUploads = (state.newArtwork.files || []).length > 0;
    // Visible by default. Becomes "hidden" only when existing design is set
    // AND no uploads exist (avoids stranding rep with uploaded files they
    // can't see). When BOTH exist, show the block + the readiness panel
    // will warn about the conflict.
    if (hasExistingDesign && !hasUploads) {
        block.classList.add('dcp-newart-collapsed');
    } else {
        block.classList.remove('dcp-newart-collapsed');
    }
}

export function attachNewArtworkUpload() {
    const dropzone = document.getElementById('dtgNewArtworkDropzone');
    const input = document.getElementById('dtgNewArtworkInput');
    const nameInput = document.getElementById('dtgNewArtworkName');
    if (!dropzone || !input || !nameInput) return;

    // Design name input — bind to state
    nameInput.addEventListener('input', () => {
        state.newArtwork.designName = nameInput.value;
        markDirty();
        scheduleStateSave();
        updateSubmitEnabled();
    });

    // Click-to-browse
    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.click();
        }
    });

    // File input change
    input.addEventListener('change', (e) => {
        handleArtworkFiles(e.target.files);
        input.value = ''; // Reset so same file can be re-uploaded after removal
    });

    // Drag-drop
    ['dragover', 'dragenter'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dcp-newart-dropzone--over');
        });
    });
    ['dragleave', 'dragend'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dcp-newart-dropzone--over');
        });
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dcp-newart-dropzone--over');
        handleArtworkFiles(e.dataTransfer.files);
    });

    renderNewArtworkList();
    updateNewArtworkVisibility();
}

// ---- Customer History Pill (Phase 1: info-only) -----------------------
// Fetches aggregated 90-day order profile from /api/customer-history/:id
// and renders a compact pill near the customer panel. Phase 1 is READ-ONLY
// — no auto-fills. Rep clicks "Use this" buttons to apply suggestions
// explicitly (e.g. fill a missing ship-to address from past orders).
// After 2 weeks of real usage we'll add surgical auto-fills for fields
// where signal is high and reps want it.
// ----------------------------------------------------------------------
