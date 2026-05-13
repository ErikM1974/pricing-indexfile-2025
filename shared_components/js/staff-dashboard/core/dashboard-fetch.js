/* =====================================================
   STAFF DASHBOARD v3 — UNIFORM FETCH WRAPPER
   - Always throws on error (Rule #4 — no silent fallbacks)
   - Request dedup for GETs (fixes /manageorders/orders 3x problem)
   - 30s default timeout via AbortController
   - 429 retry with jittered backoff
   - Typed DashboardApiError for status-aware error handling
   ===================================================== */

const inflight = new Map(); // url -> Promise

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class DashboardApiError extends Error {
    constructor(message, status, url) {
        super(message);
        this.name = 'DashboardApiError';
        this.status = status;
        this.url = url;
    }
}

/**
 * Uniform fetch wrapper for the dashboard.
 *
 * @param {string} url - full URL to fetch
 * @param {object} [opts] - options
 * @param {number} [opts.timeout=30000] - abort after N ms
 * @param {boolean} [opts.retryOn429=true] - retry rate-limit errors
 * @param {number} [opts.maxRetries=3] - max 429 retries
 * @param {string} [opts.method='GET'] - HTTP method
 * @param {function} [opts.onError] - optional UI hook called BEFORE throw
 * @param {*} [opts.body] - request body (already serialized)
 * @param {object} [opts.headers] - additional headers
 * @returns {Promise<Response>} the Response on success; throws on error
 */
export async function dashboardFetch(url, opts = {}) {
    const {
        timeout = 30_000,
        retryOn429 = true,
        maxRetries = 3,
        method = 'GET',
        onError,
        body,
        headers = {},
    } = opts;

    // Dedup GETs only — POST/PUT/DELETE always re-issue
    if (method === 'GET' && inflight.has(url)) {
        return inflight.get(url);
    }

    const promise = (async () => {
        let attempt = 0;
        while (true) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeout);
            try {
                const res = await fetch(url, {
                    method,
                    body,
                    headers: { 'Content-Type': 'application/json', ...headers },
                    signal: ctrl.signal,
                });
                clearTimeout(timer);

                if (res.status === 429 && retryOn429 && attempt < maxRetries) {
                    const wait = (attempt + 1) * 2000 + Math.random() * 1000; // 2-3s, 4-5s, 6-7s
                    attempt++;
                    console.warn(`[dashboardFetch] 429 on ${url}, retrying in ${Math.round(wait)}ms (attempt ${attempt}/${maxRetries})`);
                    await sleep(wait);
                    continue;
                }

                if (!res.ok) {
                    throw new DashboardApiError(
                        `${res.status} ${res.statusText}`,
                        res.status,
                        url
                    );
                }

                return res;
            } catch (err) {
                clearTimeout(timer);
                if (err.name === 'AbortError') {
                    const timeoutErr = new DashboardApiError(
                        `Request timed out after ${timeout / 1000}s`,
                        408,
                        url
                    );
                    if (onError) onError(timeoutErr);
                    throw timeoutErr;
                }
                if (onError) onError(err);
                throw err; // ALWAYS rethrow — Rule #4
            }
        }
    })();

    if (method === 'GET') {
        inflight.set(url, promise);
        promise.finally(() => inflight.delete(url));
    }
    return promise;
}

/**
 * Convenience: fetch JSON. Throws DashboardApiError on bad JSON parse.
 */
export async function dashboardFetchJson(url, opts = {}) {
    const res = await dashboardFetch(url, opts);
    try {
        return await res.json();
    } catch (err) {
        throw new DashboardApiError(`Invalid JSON in response: ${err.message}`, res.status, url);
    }
}
