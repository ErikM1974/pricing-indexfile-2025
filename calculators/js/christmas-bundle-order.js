'use strict';
// The server owns prices, invitation validation, records and confirmations.
// Keep one captured request across uncertain saves; never silently mint another.
class ChristmasBundleQuoteService {
    constructor(options = {}) {
        this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
        this.storage = options.storage;
        this.record = null;
        this.pending = null;
        try {
            this.storage ||= globalThis.sessionStorage;
            const saved = this.storage?.getItem('holiday-request-2026');
            if (saved) this.record = JSON.parse(saved);
        } catch {
            this.storageWarning =
                'This browser cannot retain a request after refresh. Keep this tab open until you have a confirmation reference.';
        }
    }
    remember() {
        try {
            this.storage?.setItem('holiday-request-2026', JSON.stringify(this.record));
        } catch {
            this.storageWarning =
                'Request recovery after refresh is unavailable. Keep this tab open.';
        }
    }
    reset() {
        this.record = null;
        try {
            this.storage?.removeItem('holiday-request-2026');
        } catch {
            /* Keep the current tab usable. */
        }
    }
    async upload(file) {
        const form = new FormData();
        const dot = file.name.lastIndexOf('.');
        const name =
            (dot < 0 ? file.name : file.name.slice(0, dot)) +
            '_' +
            Date.now() +
            (dot < 0 ? '' : file.name.slice(dot));
        form.append('file', new File([file], name, { type: file.type }));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const base = globalThis.APP_CONFIG?.API?.BASE_URL;
            if (!base) throw new Error('Upload service is unavailable.');
            const response = await this.fetch(base + '/api/files/upload', {
                method: 'POST',
                body: form,
                signal: controller.signal,
            });
            if (!response.ok) throw new Error('Logo upload failed (HTTP ' + response.status + ').');
            const data = await response.json();
            const key = data.ExternalKey || data.externalKey || data.id;
            if (!key) throw new Error('The upload did not return a logo reference.');
            return key;
        } finally {
            clearTimeout(timer);
        }
    }

    async submit(body, file, progress = () => {}) {
        if (this.pending) return this.pending;
        if (this.record?.attempted)
            throw new Error(
                'An earlier request is awaiting confirmation. Use Resume saved request below before starting another.'
            );
        const snapshot = JSON.parse(JSON.stringify(body));
        this.record ||= { requestKey: globalThis.crypto.randomUUID(), uploadedKey: '' };
        const logoIdentity = file ? [file.name, file.size, file.lastModified].join(':') : '';
        if (this.record.logoIdentity !== logoIdentity) {
            this.record.uploadedKey = '';
            this.record.logoIdentity = logoIdentity;
        }
        if (file && !this.record.uploadedKey) {
            progress('logo', 'Uploading your company logo…');
            this.record.uploadedKey = await this.upload(file);
        }
        snapshot.customer.imageUpload = this.record.uploadedKey;
        snapshot.requestKey = this.record.requestKey;
        this.record.body = snapshot;
        this.remember();
        progress('quote', 'Verifying your box and saving the request. Please keep this tab open…');
        return this.retry();
    }
    retry() {
        if (this.pending) return this.pending;
        if (!this.record?.body) return Promise.reject(new Error('No saved request is available.'));
        this.pending = this.send().finally(() => {
            this.pending = null;
        });
        return this.pending;
    }
    async send() {
        this.record.attempted = true;
        this.remember();
        for (let attempt = 0; attempt < 8; attempt++) {
            const response = await this.fetch('/api/christmas-gift-box/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.record.body),
                signal: AbortSignal.timeout(120000),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (result.canRevise) {
                    this.record.attempted = false;
                    this.remember();
                }
                throw Object.assign(
                    new Error(
                        result.error ||
                            'The request could not be confirmed. Resume it using the same saved details.'
                    ),
                    { canRevise: result.canRevise === true }
                );
            }
            if (result.pending === true) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                continue;
            }
            if (!result.saved || !result.quoteID || !result.quoteUrl || !result.pricing)
                throw new Error(
                    'A confirmation reference was not returned. Resume the saved request.'
                );
            this.record.result = result;
            this.remember();
            return result;
        }
        throw new Error(
            'The request is still processing. Resume the saved request shortly; it will use the same reference.'
        );
    }
}
if (typeof module !== 'undefined' && module.exports)
    module.exports = { ChristmasBundleQuoteService };
