'use strict';

// Staff-session relays for transfer purchasing and Supacolor jobs. Deploy this
// app and its browser callers before enabling the matching proxy secret gates.
module.exports = function register(app, ctx) {
    const { CRM_API_BASE, CRM_API_SECRET, fetch, requireStaff } = ctx;
    const transferQuery = ['status', 'companyName', 'designNumber', 'supacolorOrderNumber', 'salesRep', 'method', 'isRush', 'mockupId', 'designId', 'dateFrom', 'dateTo', 'orderBy', 'pageNumber', 'pageSize', 'limit', 'includeLineCount', 'refresh'];
    const jobQuery = ['status', 'activeOnly', 'search', 'dateFrom', 'dateTo', 'orderBy', 'pageNumber', 'pageSize', 'limit', 'refresh'];

    function parameter(req, name, numeric = false) {
        const value = String(req.params[name] || '');
        const valid = numeric ? /^\d{1,12}$/.test(value) : /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
        if (!valid) throw new Error('Invalid ' + name);
        return encodeURIComponent(value);
    }
    const transfer = req => 'transfer-orders/' + parameter(req, 'id');
    const job = req => 'supacolor-jobs/' + parameter(req, 'id', true);

    function forward(buildPath, allowedQuery = [], binary = false) {
        return async (req, res) => {
            res.set('Cache-Control', 'no-store');
            if (!CRM_API_SECRET) return res.status(503).json({ error: 'Transfer service is not configured' });
            let suffix;
            try { suffix = typeof buildPath === 'function' ? buildPath(req) : buildPath; }
            catch (err) { return res.status(400).json({ error: err.message }); }
            const query = new URLSearchParams();
            for (const key of allowedQuery) {
                if (typeof req.query[key] === 'string') query.set(key, req.query[key]);
            }
            const target = `${CRM_API_BASE}/api/${suffix}${query.size ? '?' + query : ''}`;
            const headers = { 'X-CRM-API-Secret': CRM_API_SECRET };
            const options = { method: req.method, headers, redirect: 'error', signal: AbortSignal.timeout(28000) };
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body !== undefined) {
                headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(req.body);
            }
            try {
                const upstream = await fetch(target, options);
                res.status(upstream.status);
                const type = upstream.headers.get('content-type');
                if (type) res.set('Content-Type', type);
                if (!binary) return res.send(await upstream.text());
                const disposition = upstream.headers.get('content-disposition');
                if (disposition) res.set('Content-Disposition', disposition);
                // node-fetch can decompress the body. Forwarding compressed
                // content-length/content-encoding would corrupt the download.
                if (!upstream.body) return res.end();
                upstream.body.once('error', err => {
                    console.error('[transfer-forward] image stream failed:', err.message);
                    res.destroy(err);
                });
                res.once('close', () => upstream.body.destroy());
                upstream.body.pipe(res);
            } catch (err) {
                console.error('[transfer-forward] request failed:', err.message);
                if (!res.headersSent) res.status(502).json({ error: 'Transfer service request failed' });
            }
        };
    }

    app.get('/api/transfer-orders/stats', requireStaff, forward('transfer-orders/stats', ['method', 'refresh']));
    app.post('/api/transfer-orders/analyze-link', requireStaff, forward('transfer-orders/analyze-link'));
    app.get('/api/transfer-orders', requireStaff, forward('transfer-orders', transferQuery));
    app.post('/api/transfer-orders', requireStaff, forward('transfer-orders'));
    app.get('/api/transfer-orders/:id/notes', requireStaff, forward(req => transfer(req) + '/notes'));
    app.get('/api/transfer-orders/:id', requireStaff, forward(transfer));
    app.put('/api/transfer-orders/:id', requireStaff, forward(transfer));
    app.delete('/api/transfer-orders/:id', requireStaff, forward(transfer, ['hard']));
    app.put('/api/transfer-orders/:id/status', requireStaff, forward(req => transfer(req) + '/status'));
    app.put('/api/transfer-orders/:id/rush', requireStaff, forward(req => transfer(req) + '/rush'));
    app.put('/api/transfer-orders/:id/lines', requireStaff, forward(req => transfer(req) + '/lines'));
    app.put('/api/transfer-orders/:id/files', requireStaff, forward(req => transfer(req) + '/files'));
    app.post('/api/transfer-order-notes', requireStaff, forward('transfer-order-notes'));

    app.get('/api/supacolor-jobs/stats', requireStaff, forward('supacolor-jobs/stats', ['refresh']));
    app.get('/api/supacolor-jobs/by-number/:jobNumber', requireStaff, forward(req => 'supacolor-jobs/by-number/' + parameter(req, 'jobNumber', true)));
    app.get('/api/supacolor-jobs/proxy-image', requireStaff, forward('supacolor-jobs/proxy-image', ['url', 'name'], true));
    app.get('/api/supacolor-jobs', requireStaff, forward('supacolor-jobs', jobQuery));
    app.post('/api/supacolor-jobs/upsert', requireStaff, forward('supacolor-jobs/upsert', ['force']));
    app.post('/api/supacolor-jobs/bulk-upsert', requireStaff, forward('supacolor-jobs/bulk-upsert', ['force']));
    app.post('/api/supacolor-jobs/sync/:jobNumber', requireStaff, forward(req => 'supacolor-jobs/sync/' + parameter(req, 'jobNumber', true), ['force']));
    app.get('/api/supacolor-jobs/:id', requireStaff, forward(job));
    app.put('/api/supacolor-jobs/:id', requireStaff, forward(job));
    app.delete('/api/supacolor-jobs/:id', requireStaff, forward(job));
    app.post('/api/supacolor-jobs/:id/joblines', requireStaff, forward(req => job(req) + '/joblines'));
    app.post('/api/supacolor-jobs/:id/history/replace', requireStaff, forward(req => job(req) + '/history/replace'));

    app.post('/api/vision/extract-supacolor', requireStaff, forward('vision/extract-supacolor'));
    app.post('/api/vision/extract-supacolor-jobs-list', requireStaff, forward('vision/extract-supacolor-jobs-list'));
    app.post('/api/vision/extract-supacolor-job-detail', requireStaff, forward('vision/extract-supacolor-job-detail'));
};
