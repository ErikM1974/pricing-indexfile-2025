'use strict';

const { createArchiveStore } = require('../lib/december-finish-line');
const { createLiveService } = require('../lib/december-finish-line-live');

module.exports = function register(app, ctx) {
    const { SERVER_DIR, path, requireCrmRole, CRM_API_BASE, CRM_API_SECRET, fetch } = ctx;
    const live = createLiveService({ baseUrl: CRM_API_BASE, secret: CRM_API_SECRET, fetch });
    const store = createArchiveStore({
        archivePath: path.join(SERVER_DIR, 'private', 'december-finish-line.enc'),
        key: process.env.FINISH_LINE_ARCHIVE_KEY,
    });
    const adminOnly = requireCrmRole(['admin']);
    function privateHeaders(req, res, next) {
        res.set({
            'Cache-Control': 'private, no-store, max-age=0',
            'Pragma': 'no-cache',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Vary': 'Cookie',
        });
        next();
    }
    function unavailable(res) {
        return res.status(503).type('text/plain').send('December Finish Line is temporarily unavailable. Return to the Finish Line page and try again, or contact Erik.');
    }

    // Both mounts precede all public static mounts. An Access Admin table row
    // cannot widen this explicitly admin-only financial area to other staff.
    app.use('/dashboards', (req, res, next) => {
        let target;
        try { target = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')).toLowerCase(); }
        catch { return next(); }
        if (target !== '/december-finish-line.html') return next();
        return privateHeaders(req, res, () => adminOnly(req, res, () => {
            if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
            return res.sendFile(path.join(SERVER_DIR, 'dashboards', 'december-finish-line.html'));
        }));
    });
    app.use('/admin/december-finish-line', privateHeaders, adminOnly);
    app.get('/admin/december-finish-line/catalog', (req, res) => {
        try { return res.json(store.catalog()); }
        catch { return unavailable(res); }
    });
    app.get('/admin/december-finish-line/live', async (req, res) => {
        let baseline = null;
        try { baseline = store.catalog().baseline || null; } catch { /* Live reads do not require the saved document package. */ }
        try { return res.json(await live.get({ force: req.query.refresh === 'true', baseline })); }
        catch { return unavailable(res); }
    });
    app.get('/admin/december-finish-line/files/*', (req, res) => {
        try {
            const file = store.file(req.params[0]);
            if (!file) return res.status(404).type('text/plain').send('This document is not part of the Finish Line report.');
            if (file.canonical !== req.params[0]) return res.redirect('/admin/december-finish-line/files/' + file.canonical.split('/').map(encodeURIComponent).join('/'));
            res.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'");
            if (file.download) res.attachment(path.basename(req.params[0]));
            return res.type(file.type).send(file.body);
        } catch { return unavailable(res); }
    });
    // Never fall through to /admin's HTML-only static gate, regardless of URL,
    // extension or HTTP method. Unknown files cannot reach a filesystem path.
    app.use('/admin/december-finish-line', (req, res) => {
        res.status(404).type('text/plain').send('Finish Line page not found.');
    });
};
