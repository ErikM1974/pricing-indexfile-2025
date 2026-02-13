/**
 * Jest test setup — provides browser globals for modules that reference window/document/fetch
 */

// Provide minimal browser-like globals so modules can load in Node.js
if (typeof window === 'undefined') {
    global.window = undefined; // Keep undefined so dual-export guards work
}

// Stub fetch so constructor's initializeConfig() doesn't crash
if (typeof fetch === 'undefined') {
    global.fetch = () => Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Test Environment',
        json: () => Promise.resolve(null)
    });
}

// Suppress console.log noise from modules during tests
const originalLog = console.log;
global.console.log = (...args) => {
    if (typeof args[0] === 'string') {
        // Suppress module loading, parser debug, and shipping parse messages
        if (args[0].includes('Module loaded')) return;
        if (args[0].includes('utilities loaded')) return;
        if (args[0].includes('[ShopWorksImportParser]')) return;
    }
    originalLog.apply(console, args);
};
