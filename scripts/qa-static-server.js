// QA-only static server: serves the repo like the python static server but rewrites
// HTML asset URLs through dist/asset-manifest.json (same as server.js does), so the
// esbuild-bundled quote builders load without the SAML gate. Never for production.
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(process.argv[2]);
const PORT = Number(process.argv[3] || 8098);
const { rewriteHtmlAssets } = require(path.join(ROOT, 'lib', 'asset-manifest.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'asset-manifest.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (ext === '.html') return res.end(rewriteHtmlAssets(fs.readFileSync(file, 'utf8'), manifest));
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('static-dist on', PORT));
