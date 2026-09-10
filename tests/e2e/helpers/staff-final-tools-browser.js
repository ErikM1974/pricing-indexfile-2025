const { expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const source = require('../../fixtures/staff-final-tools-original-content.json');
const root = path.resolve(__dirname, '../../..');
const providerPaths = ['/dp/a0e15000da6b6fa1d16145b4ab86/emb', '/dp/a0e15000848e0baf43604a908d78/emb'];
const reactPaths = ['/react@18.3.1/umd/react.production.min.js', '/react-dom@18.3.1/umd/react-dom.production.min.js', '/@babel/standalone@7.29.0/babel.min.js'];

async function open(page, name, state = {}) {
    const events = { errors: [], writes: [], unknown: [], missing: [], providers: [] };
    page.on('pageerror', e => events.errors.push(e.message));
    page.context().on('page', child => child.on('pageerror', e => events.errors.push(e.message)));
    await page.clock.setFixedTime(new Date('2026-09-10T18:00:00Z'));
    await page.context().addInitScript(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
    await page.context().route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (!['GET', 'HEAD'].includes(req.method()) || p.startsWith('/api/quote-sequence/') || u.searchParams.get('autoAdd') === 'true') {
            events.writes.push({ path: p, method: req.method(), body: req.postData() });
            const syntheticWrite = state.respondWrite && await state.respondWrite(req, u);
            if (syntheticWrite) return route.fulfill(syntheticWrite);
            return route.fulfill({ status: 503, json: { error: 'Synthetic write denied' } });
        }
        if (state.block && state.block(u)) return route.abort();
        const syntheticRead = state.respond && await state.respond(req, u);
        if (syntheticRead) return route.fulfill(syntheticRead);
        if (u.hostname === 'c3eku948.caspio.com' && providerPaths.includes(p)) {
            events.providers.push(p);
            const title = p === providerPaths[0] ? 'Synthetic label records' : 'Synthetic bundle records';
            const html = '<html lang="en"><title>' + title + '</title><main><h1>' + title + '</h1><p>External provider boundary: synthetic data only.</p><table><caption>Sample approved employee</caption><tr><th>Name</th><th>Size</th><th>Status</th></tr><tr><td>Cedar Example</td><td>XL</td><td>Approved</td></tr></table></main></html>';
            return route.fulfill({ contentType: 'application/javascript', body: '(function(){const f=document.createElement("iframe");f.title=' + JSON.stringify(title) + ';f.width="100%";f.height="360";f.srcdoc=' + JSON.stringify(html) + ';document.currentScript.parentElement.appendChild(f);})();' });
        }
        if ((u.hostname === 'fonts.googleapis.com' && p === '/css2') || (u.hostname === 'cdnjs.cloudflare.com' && ['/ajax/libs/font-awesome/6.4.0/css/all.min.css','/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'].includes(p))) return route.continue();
        if (u.hostname === 'unpkg.com' && reactPaths.includes(p)) return route.continue();
        if ((u.hostname === 'cdnjs.cloudflare.com' && p === '/ajax/libs/Sortable/1.15.0/Sortable.min.js') || (u.hostname === 'cdn.jsdelivr.net' && p === '/npm/qrcode-generator@1.4.4/qrcode.min.js')) return route.continue();
        const capturedScript = ['localhost', '127.0.0.1'].includes(u.hostname) && /\.(?:js|jsx)$/.test(p) && source.hashes[p.slice(1)];
        if (p.startsWith('/api/') || (['fetch', 'xhr'].includes(req.resourceType()) && !capturedScript)) { events.unknown.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic API' } }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + p), retired = state.original && (source.retiredStyles || []).find(r => '/' + r.file === p);
            if (retired) return route.fulfill({ contentType: 'text/css', body: retired.css });
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missing.push(p); return route.fulfill({ status: 404 }); }
            let body = fs.readFileSync(file);
            if (state.original && source.hashes[p.slice(1)]) {
                const html = source.pages.find(r => r.file === p.slice(1));
                let original = html ? html.html : body.toString('utf8').replace(/\r\n/g, '\n');
                if (!html) for (const change of source.changes.filter(c => c.file === p.slice(1)).reverse()) { expect(original.split(change.after).length - 1).toBe(change.count); original = original.split(change.after).join(change.before); }
                expect(crypto.createHash('sha256').update(original).digest('hex')).toBe(source.hashes[p.slice(1)]); body = Buffer.from(original);
            }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.jsx': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf' }[path.extname(file)] || 'application/octet-stream', body });
        }
        if (['font', 'image'].includes(req.resourceType())) return route.continue();
        events.unknown.push(req.url()); return route.abort();
    });
    await page.goto('/' + name); await page.evaluate(() => document.fonts.ready);
    return events;
}

module.exports = { open, providerPaths };
