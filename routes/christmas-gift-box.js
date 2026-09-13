'use strict';
const createHolidayService = require('../lib/christmas-gift-box');

module.exports = function register(app, ctx) {
    // Use a dedicated bounded transport; never retry a write whose acknowledgement was lost.
    const makeApiRequest = async (endpoint, method = 'GET', body) => {
        const response = await ctx.fetch(ctx.API_BASE_URL + endpoint, {
            method,
            signal: AbortSignal.timeout(12000),
            headers: ctx.withProxySecret({ 'Content-Type': 'application/json' }),
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) throw new Error('Holiday upstream request failed: ' + response.status);
        return response.status === 204 ? null : response.json();
    };
    const service = createHolidayService({ ...ctx, makeApiRequest });
    const reads = ctx.rateLimit({
        windowMs: 60000,
        limit: 160,
        standardHeaders: true,
        legacyHeaders: false,
    });
    const codes = ctx.rateLimit({
        windowMs: 15 * 60000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many code attempts. Please try again in 15 minutes.' },
    });
    const writes = ctx.rateLimit({
        windowMs: 60 * 60000,
        limit: 80,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Contact our team for help or try again later.' },
    });
    const handle = (action) => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            res.json(await action(req));
        } catch (error) {
            const status =
                Number.isInteger(error.status) && error.status >= 400 && error.status <= 503
                    ? error.status
                    : 503;
            res.status(status).json({
                error: error.status
                    ? error.message
                    : 'We could not verify this request. Your selections are retained; please retry.',
                canRevise: error.canRevise === true,
            });
        }
    };
    const smallBody = (req, res, next) => {
        if (
            !req.is('application/json') ||
            !req.body ||
            Buffer.byteLength(JSON.stringify(req.body)) > 24000
        ) {
            return res
                .status(400)
                .json({ error: 'This request is invalid. Refresh the page and try again.' });
        }
        if (req.get('Sec-Fetch-Site') === 'cross-site')
            return res.status(403).json({ error: 'Open the gift-box page to send this request.' });
        next();
    };
    app.get(
        '/api/christmas-gift-box/campaign',
        reads,
        handle(() => service.readCampaign())
    );
    app.get(
        '/api/christmas-gift-box/products/:style',
        reads,
        handle((req) => service.product(req.params.style))
    );
    app.post(
        '/api/christmas-gift-box/gift-code',
        codes,
        smallBody,
        handle((req) => service.validateCode(req.body.code))
    );
    app.post(
        '/api/christmas-gift-box/estimate',
        reads,
        smallBody,
        handle((req) => service.estimate(req.body))
    );
    app.post(
        '/api/christmas-gift-box/requests',
        writes,
        smallBody,
        handle(async (req) => {
            // Heroku has a 30-second request window. The same captured key rejoins an
            // in-flight save, or resumes confirmed database stages after a restart.
            let timer;
            try {
                return await Promise.race([
                    service.submit(req.body),
                    new Promise((resolve) => {
                        timer = setTimeout(() => resolve({ pending: true }), 15000);
                    }),
                ]);
            } finally {
                clearTimeout(timer);
            }
        })
    );
};
