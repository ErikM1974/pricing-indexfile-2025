/**
 * ApiService - Centralized API communication with retry logic
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Comprehensive error handling
 * - Request/response logging
 * - Support for all HTTP methods
 *
 * Usage:
 *   const api = new ApiService();
 *   const data = await api.get('/api/endpoint');
 */

class ApiService {
    constructor(config = {}) {
        this.baseURL = config.baseURL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 second base delay
        this.timeout = config.timeout || 30000; // 30 seconds
        this.logRequests = config.logRequests !== false; // Default true
    }

    /**
     * Main fetch wrapper with retry logic
     * @param {string} url - API endpoint (full URL or relative path)
     * @param {Object} options - Fetch options
     * @returns {Promise<any>} - Parsed JSON response
     */
    async fetch(url, options = {}) {
        const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                if (this.logRequests) {
                    console.log(`[ApiService] ${options.method || 'GET'} ${fullURL} (attempt ${attempt}/${this.retryAttempts})`);
                }

                // Add timeout to request
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(fullURL, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Handle HTTP errors
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (this.logRequests) {
                    console.log(`[ApiService] ✓ Success: ${fullURL}`);
                }

                return data;

            } catch (error) {
                // Don't retry on client errors (4xx) - they won't succeed
                if (error.message.includes('HTTP 4')) {
                    console.error(`[ApiService] ✗ Client error (no retry): ${error.message}`);
                    throw error;
                }

                // Log retry attempts
                console.warn(`[ApiService] ⚠ Attempt ${attempt} failed: ${error.message}`);

                // If this was the last attempt, throw the error
                if (attempt === this.retryAttempts) {
                    console.error(`[ApiService] ✗ All ${this.retryAttempts} attempts failed for ${fullURL}`);
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(`[ApiService] ⏳ Waiting ${delay}ms before retry...`);
                await this.delay(delay);
            }
        }
    }

    /**
     * GET request
     * @param {string} url - API endpoint
     * @param {Object} options - Additional fetch options
     * @returns {Promise<any>}
     */
    async get(url, options = {}) {
        return this.fetch(url, {
            ...options,
            method: 'GET'
        });
    }

    /**
     * POST request
     * @param {string} url - API endpoint
     * @param {Object} data - Request body data
     * @param {Object} options - Additional fetch options
     * @returns {Promise<any>}
     */
    async post(url, data, options = {}) {
        return this.fetch(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     * @param {string} url - API endpoint
     * @param {Object} data - Request body data
     * @param {Object} options - Additional fetch options
     * @returns {Promise<any>}
     */
    async put(url, data, options = {}) {
        return this.fetch(url, {
            ...options,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     * @param {string} url - API endpoint
     * @param {Object} options - Additional fetch options
     * @returns {Promise<any>}
     */
    async delete(url, options = {}) {
        return this.fetch(url, {
            ...options,
            method: 'DELETE'
        });
    }

    /**
     * Delay helper for retry logic
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get service status
     * @returns {Object} Service configuration
     */
    getStatus() {
        return {
            baseURL: this.baseURL,
            retryAttempts: this.retryAttempts,
            retryDelay: this.retryDelay,
            timeout: this.timeout,
            logRequests: this.logRequests
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
}
