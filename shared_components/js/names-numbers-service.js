/**
 * Names & Numbers Service
 * API layer for roster CRUD, Excel parsing, and OCR
 */
class NamesNumbersService {
    constructor() {
        this.API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    // Fetch with a single 500ms-delayed retry for transient failures
    // (Heroku cold start, brief network blip, rare Caspio token flip that slips past backend retry).
    // 404 is treated as final — don't retry "not found".
    async _fetchWithRetry(url, init) {
        let lastErr;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const resp = await fetch(url, init);
                if (resp.status === 404) {
                    const body = await resp.json().catch(() => ({}));
                    const msg = body.error || 'Not found';
                    const err = new Error(msg);
                    err.status = 404;
                    throw err;
                }
                if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
                return resp.json();
            } catch (err) {
                lastErr = err;
                if (err.status === 404 || attempt === 1) break;
                await new Promise(r => setTimeout(r, 500));
            }
        }
        throw lastErr;
    }

    // =====================
    // CRUD Operations
    // =====================

    async listRosters(filters = {}) {
        const params = new URLSearchParams();
        if (filters.companyName) params.set('companyName', filters.companyName);
        if (filters.rosterName) params.set('rosterName', filters.rosterName);
        if (filters.status) params.set('status', filters.status);
        if (filters.salesRep) params.set('salesRep', filters.salesRep);
        if (filters.orderNumber) params.set('orderNumber', filters.orderNumber);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);

        const qs = params.toString();
        const url = `${this.API_BASE}/api/rosters${qs ? '?' + qs : ''}`;
        return this._fetchWithRetry(url);
    }

    async getRoster(id) {
        return this._fetchWithRetry(`${this.API_BASE}/api/rosters/${id}`);
    }

    async createRoster(data) {
        const resp = await fetch(`${this.API_BASE}/api/rosters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`Failed to create roster: ${resp.status}`);
        return resp.json();
    }

    async updateRoster(id, data) {
        const resp = await fetch(`${this.API_BASE}/api/rosters/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`Failed to update roster: ${resp.status}`);
        return resp.json();
    }

    async deleteRoster(id) {
        const resp = await fetch(`${this.API_BASE}/api/rosters/${id}`, {
            method: 'DELETE'
        });
        if (!resp.ok) throw new Error(`Failed to delete roster: ${resp.status}`);
        return resp.json();
    }

    // =====================
    // Excel Upload
    // =====================

    async parseExcel(file) {
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch(`${this.API_BASE}/api/rosters/parse-excel`, {
            method: 'POST',
            body: formData
        });
        if (!resp.ok) throw new Error(`Failed to parse Excel: ${resp.status}`);
        return resp.json();
    }

    // =====================
    // OCR — Claude Vision
    // =====================

    async ocrImage(file) {
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch(`${this.API_BASE}/api/rosters/ocr`, {
            method: 'POST',
            body: formData
        });
        if (!resp.ok) throw new Error(`Failed to process OCR: ${resp.status}`);
        return resp.json();
    }

    // =====================
    // Helpers
    // =====================

    getCurrentDate() {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    getCurrentTimestamp() {
        return new Date().toISOString();
    }
}
