/**
 * jsdom project setup (roadmap 1.14) — the stubs builder modules expect at
 * import time. jsdom provides window/document; this fills the app-specific
 * globals so module-init code (builder state.js files read
 * window.APP_CONFIG at import) never crashes in tests.
 */

// App config spine (0.3): modules read APP_CONFIG.API.BASE_URL at import time.
window.APP_CONFIG = window.APP_CONFIG || {
    API: { BASE_URL: 'http://test.invalid/api-base' },
    EMAILJS: { PUBLIC_KEY: 'test', SERVICE_ID: 'test' },
};

// Never let a test hit the network: fail loudly-but-safely like the offline path.
window.fetch = global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Test Environment',
        json: () => Promise.resolve(null),
        text: () => Promise.resolve(''),
    })
);

// jsdom lacks these; some builder code calls them defensively.
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.scrollTo = window.scrollTo || (() => {});

// Quiet the module-load console chatter (mirrors tests/setup.js).
const originalLog = console.log;
console.log = (...args) => {
    if (typeof args[0] === 'string') {
        if (args[0].includes('Module loaded') || args[0].includes('utilities loaded') || args[0].includes('[ShopWorksImportParser]')) return;
    }
    originalLog.apply(console, args);
};
