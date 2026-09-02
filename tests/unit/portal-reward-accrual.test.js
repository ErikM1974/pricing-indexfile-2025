/**
 * portal-reward-accrual.test.js — the reward-dollar accrual rules (Erik, 2026-09-01).
 *
 * WHY THIS EXISTS
 * Reward dollars are money-like credit a customer can redeem against an order. The
 * accrual lives inside server.js (computeRewardAccrual + helpers) and is driven by
 * Caspio Service_Codes rows Erik edits by hand. Three rules must never drift:
 *   1. "Paid" is ONLY sts_Paid=1, or a KNOWN zero balance on a non-zero invoice. An
 *      unknown balance is not paid, and a $0 invoice never earns.
 *   2. Cost bands parse the human-typed TierLabel shapes ("0-39.99", "40+", "< 40").
 *   3. No configured program → nothing earns (never a silent default rate).
 *
 * The helpers are not exported (server.js starts listening on require), so this test
 * lifts them straight out of the source text — the same drift-lock approach as
 * portal-proof-image.test.js — and evaluates them with the few dependencies stubbed.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8').replace(/\r\n/g, '\n');

function liftFunction(name, kind) {
    const re = new RegExp('^' + (kind || 'function') + ' ' + name + '\\([^)]*\\) \\{[\\s\\S]*?^\\}', 'm');
    const m = src.match(re);
    if (!m) throw new Error('could not lift ' + name + ' from server.js');
    return m[0];
}

const lifted = [
    liftFunction('parseRewardBand'),
    liftFunction('rewardTierForCost'),
    liftFunction('rewardTierForUnknownCost'),
    liftFunction('rewardGarmentCost'),
    liftFunction('moOrderPaid'),
].join('\n');

// rewardGarmentCost depends on portalMatchColor — lift that too.
const helpers = liftFunction('portalMatchColor');

const api = new Function(helpers + '\n' + lifted + '\nreturn { parseRewardBand, rewardTierForCost, rewardTierForUnknownCost, rewardGarmentCost, moOrderPaid };')();

describe('reward accrual — band parsing (Service_Codes TierLabel)', () => {
    test('"40+" is an open-ended premium band', () => {
        expect(api.parseRewardBand('40+')).toEqual({ min: 40, max: Infinity });
    });
    test('"0-39.99" is a closed band with decimals', () => {
        expect(api.parseRewardBand('0-39.99')).toEqual({ min: 0, max: 39.99 });
    });
    test('tolerates a dollar sign and spaces as a human would type them', () => {
        expect(api.parseRewardBand('$40 +')).toEqual({ min: 40, max: Infinity });
        expect(api.parseRewardBand('$0 - $39.99')).toEqual({ min: 0, max: 39.99 });
    });
    test('"< 40" reads as "under 40"', () => {
        const b = api.parseRewardBand('< 40');
        expect(b.min).toBe(0);
        expect(b.max).toBeLessThan(40);
    });
    test('an unparseable label is null, never a band', () => {
        expect(api.parseRewardBand('premium')).toBeNull();
        expect(api.parseRewardBand('')).toBeNull();
        expect(api.parseRewardBand(null)).toBeNull();
    });
});

describe('reward accrual — tier selection', () => {
    const program = {
        configured: true,
        months: 12,
        tiers: [
            Object.assign({ label: '0-39.99', ratePct: 1 }, api.parseRewardBand('0-39.99')),
            Object.assign({ label: '40+', ratePct: 3 }, api.parseRewardBand('40+')),
        ],
    };
    test('a $4 tee earns the base rate; a $53 Carhartt earns premium', () => {
        expect(api.rewardTierForCost(program, 4).ratePct).toBe(1);
        expect(api.rewardTierForCost(program, 53.44).ratePct).toBe(3);
        expect(api.rewardTierForCost(program, 40).ratePct).toBe(3);   // boundary belongs to premium
    });
    test('unknown cost → no band by cost, but the engine falls back to the LOWEST band (non-SanMar garments still earn)', () => {
        expect(api.rewardTierForCost(program, null)).toBeNull();
        expect(api.rewardTierForUnknownCost(program).ratePct).toBe(1);
        expect(api.rewardTierForUnknownCost({ configured: false, tiers: [] })).toBeNull();
        expect(src).toMatch(/cost == null \? rewardTierForUnknownCost\(program\)/);
    });
    test('NO CONFIGURED PROGRAM → nothing earns (never a silent default rate)', () => {
        expect(api.rewardTierForCost({ configured: false, tiers: [] }, 50)).toBeNull();
        expect(api.rewardTierForCost(null, 50)).toBeNull();
    });
    test('a gap between bands earns nothing rather than guessing', () => {
        const gappy = { configured: true, tiers: [Object.assign({ ratePct: 1 }, api.parseRewardBand('0-20')), Object.assign({ ratePct: 3 }, api.parseRewardBand('40+'))] };
        expect(api.rewardTierForCost(gappy, 30)).toBeNull();
    });
});

describe('reward accrual — "paid" means paid', () => {
    test('ShopWorks sts_Paid = "1" on a real invoice is paid', () => {
        expect(api.moOrderPaid({ cur_TotalInvoice: 671.61, sts_Paid: '1', cur_Balance: 0 })).toBe(true);
    });
    test('a known $0 balance on a real invoice is paid even without the flag', () => {
        expect(api.moOrderPaid({ cur_TotalInvoice: 100, sts_Paid: null, cur_Balance: 0 })).toBe(true);
    });
    test('an open balance is NOT paid, whatever the flag says', () => {
        expect(api.moOrderPaid({ cur_TotalInvoice: 100, sts_Paid: '0', cur_Balance: 25 })).toBe(false);
    });
    test('an UNKNOWN balance is not paid (never assume)', () => {
        expect(api.moOrderPaid({ cur_TotalInvoice: 100, sts_Paid: null, cur_Balance: null })).toBe(false);
        expect(api.moOrderPaid({ cur_TotalInvoice: 100, sts_Paid: undefined, cur_Balance: '' })).toBe(false);
    });
    test('a $0 invoice never earns (ShopWorks marks these sts_Paid = "8")', () => {
        expect(api.moOrderPaid({ cur_TotalInvoice: 0, sts_Paid: '8', cur_Balance: 0 })).toBe(false);
    });
});

describe('reward accrual — garment cost lookup', () => {
    const rows = [
        { COLOR_NAME: 'Jet Black', CATALOG_COLOR: 'JetBlack', PIECE_PRICE: 4.45 },
        { COLOR_NAME: 'Jet Black', CATALOG_COLOR: 'JetBlack', PIECE_PRICE: 6.21 },   // 2XL row
        { COLOR_NAME: 'White', CATALOG_COLOR: 'White', PIECE_PRICE: 3.9 },
    ];
    test('uses the LOWEST piece price of the ordered color (base size), matching on catalog color', () => {
        expect(api.rewardGarmentCost(rows, 'JetBlack')).toBe(4.45);
    });
    test('falls back to the cheapest row of the style when the color is unknown', () => {
        expect(api.rewardGarmentCost(rows, 'Neon Coral')).toBe(3.9);
    });
    test('no catalog rows → null (line flagged, not rewarded)', () => {
        expect(api.rewardGarmentCost([], 'Black')).toBeNull();
        expect(api.rewardGarmentCost(null, 'Black')).toBeNull();
    });
});

describe('reward accrual — posting stays staff-only and idempotent (source lock)', () => {
    test('the customer portal never posts grants; only the admin route does, keyed by Order_Ref', () => {
        expect(src).toMatch(/app\.post\('\/api\/portal-admin\/rewards\/accrual\/:id\/post', requireCrmRole\(PORTAL_ADMIN_ROLES\)/);
        expect(src).toMatch(/order_ref: String\(o\.orderNumber\)/);
        // No customer-session route may write a reward entry.
        const customerWrites = src.match(/app\.post\('\/api\/portal\/rewards[^']*'/g) || [];
        expect(customerWrites).toEqual(["app.post('/api/portal/rewards/redeem-request'"]);
    });
    test('the customer projection exposes rates only — never the cost thresholds', () => {
        const proj = liftFunction('projectPortalRewards');
        expect(proj).not.toMatch(/\.min\b|\.max\b|label/);
        expect(proj).toMatch(/baseRatePct/);
        expect(proj).toMatch(/premiumRatePct/);
    });
});

describe('reward accrual — scope and Heroku-safe pacing (source lock)', () => {
    const reMatch = src.match(/const REWARD_WEBSTORE_TYPES = (\/.+?\/i);/);
    const RE = reMatch ? new Function('return ' + reMatch[1])() : null;
    test('web-store order types are excluded by default (622 Inksoft orders on one GOLD account)', () => {
        expect(RE).toBeTruthy();
        expect(RE.test('Inksoft')).toBe(true);
        expect(RE.test('Shopify')).toBe(true);
        expect(RE.test('Custom Embroidery')).toBe(false);
        expect(RE.test('Digital Printing')).toBe(false);
        expect(RE.test('Transfers')).toBe(false);
        // …and only an explicit RWD-WEBSTORE row turns them on
        expect(src).toMatch(/RWD-WEBSTORE/);
    });
    test('order types come from ORDER_ODBC and a failed lookup refuses rather than including everything', () => {
        expect(src).toMatch(/throw new Error\('order types unavailable'\)/);
    });
    test('one calculation fetches a bounded number of uncached orders and reports partial progress', () => {
        expect(src).toMatch(/const MO_MAX_FETCHES = \d+;/);
        const cap = Number(src.match(/const MO_MAX_FETCHES = (\d+);/)[1]);
        expect(cap).toBeLessThanOrEqual(10);   // ~2.2 s apart under the 30/min limiter, inside Heroku's 30 s
        expect(src).toMatch(/partial: unavailable\.length > 0/);
    });
    test('grants are never posted from a partial calculation', () => {
        expect(src).toMatch(/if \(acc\.partial\) return res\.status\(409\)/);
    });
});

describe('reward accrual — Caspio ManageOrders_LineItems mirror (Erik ruling 5, 2026-09-02)', () => {
    test('the mirror is looked up by the order ids the engine already holds (the archive has no customer column)', () => {
        expect(src).toMatch(/portalMirroredLineItems\(eligible\.map\(\(o\) => o\.id_Order\)\)/);
        expect(src).toMatch(/\/api\/order-lines\?orders=/);
    });
    test('mirror rows are seeded into the line cache BEFORE the paced ManageOrders crawl', () => {
        const seed = src.indexOf('mirroredEarly.forEach((j, id) => { if (!_moLineCache.has(id)) _moLineCache.set(id');
        const crawl = src.indexOf('portalPacedLineItems(eligible.map((o) => o.id_Order), hdrs)');
        expect(seed).toBeGreaterThan(0);
        expect(crawl).toBeGreaterThan(seed);
    });
    test('an unavailable mirror is an empty map, never a throw (MO fallback)', () => {
        const fn = liftFunction('portalMirroredLineItems', 'async function');
        expect(fn).toMatch(/catch \(_\) \{ \/\* mirror unavailable/);
        expect(fn).toMatch(/return map;/);
    });
    test('a mirrored SanMar piece cost is used, and only uncosted styles hit the catalog', () => {
        expect(src).toMatch(/li\._pieceCost != null && li\._pieceCost > 0\) \? li\._pieceCost : rewardGarmentCost/);
        expect(src).toMatch(/if \(n && !\(li\._pieceCost != null && li\._pieceCost > 0\)\) styles\.add/);
    });
    test('paid status never comes from the mirror (its sts_Paid is a stale snapshot)', () => {
        const fn = liftFunction('portalMirroredLineItems', 'async function');
        expect(fn).not.toMatch(/sts_Paid|cur_Balance/);
    });
});

describe('reward accrual — 2026 Rewards program year (Erik 2026-09-02)', () => {
    const parseRewardWindow = new Function(liftFunction('parseRewardWindow') + '\nreturn parseRewardWindow;')();
    test('RWD-WINDOW / RWD-SPEND / RWD-BOOST labels parse as date ranges', () => {
        expect(parseRewardWindow('2026-01-01..2026-08-31')).toEqual({ from: '2026-01-01', to: '2026-08-31' });
        expect(parseRewardWindow('2026-10-01 to 2026-12-31')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
        expect(parseRewardWindow('12')).toBeNull();
    });
    test('the earning window is the configured date range (both ends) when RWD-WINDOW carries one', () => {
        expect(src).toMatch(/inv >= windowStart && inv <= windowEnd/);
        expect(src).toMatch(/program\.earn \? new Date\(program\.earn\.from/);
    });
    test('a redemption is the WHOLE balance, inside the spend window', () => {
        expect(src).toMatch(/Math\.abs\(amt - bal\) > 0\.01\) return res\.status\(400\)/);
        expect(src).toMatch(/day > prog\.spend\.to\) return res\.status\(400\)/);
    });
    test('expiry is staff-only, refuses before the spend window closes, and never touches order refs', () => {
        expect(src).toMatch(/app\.post\('\/api\/portal-admin\/rewards\/expire\/:id', requireCrmRole\(PORTAL_ADMIN_ROLES\)/);
        expect(src).toMatch(/if \(day <= prog\.spend\.to\) return res\.status\(409\)/);
    });
});
