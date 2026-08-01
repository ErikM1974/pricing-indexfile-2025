#!/usr/bin/env node
/**
 * art-request-source-audit.js — which submission path did each ArtRequest come from?
 *
 * WHY THIS EXISTS (2026-07-31): Steve got no email and no Slack ping for Ruth's art
 * requests, though they landed in his queue normally. Root cause: she submits through a
 * legacy Caspio DataPage that writes straight into the ArtRequests table and never calls
 * POST /api/artrequests — and BOTH notifications hang off that POST (browser EmailJS in
 * garment-submit-form.js sendNotificationEmails, plus the server-side Slack post in the
 * proxy's art.js notifyArtRequestSubmission). No code was broken; the requests simply
 * never touched the code.
 *
 * THE FINGERPRINT: the AE dashboard form writes Item_Type, Sales_Rep and Status
 * UNCONDITIONALLY on every submit. A row missing them did not come from that form.
 * Garment_Placement is the confirming tell — the AE form's dropdown offers a fixed 16
 * options, so a placement outside that list (e.g. 'Full Front Center chest (8-11" wide...)')
 * proves a different form produced it.
 *
 * Re-run this to check whether anyone is still submitting off-path.
 *
 * Read-only. ~1 billed Caspio call — safe to run ad hoc, but it is a live table read,
 * so don't loop it (see memory/CASPIO_SYNC_CLUSTER_COST.md on audit-driven quota burn).
 *
 * Usage:
 *   node scripts/art-request-source-audit.js            # newest 200 requests
 *   node scripts/art-request-source-audit.js --limit 500
 *
 * Credentials: read from the sibling caspio-pricing-proxy/.env (same approach as
 * scripts/verify-policies.js). Nothing is written and no secret is printed.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// The AE dashboard form's placement dropdown — keep in sync with PLACEMENTS in
// shared_components/js/garment-submit-form.js. A value outside this list means the
// row came from some other form.
const AE_FORM_PLACEMENTS = new Set([
    'Left Chest', 'Right Chest', 'Full Front', 'Full Back',
    'Left Sleeve', 'Right Sleeve', 'Cap Front', 'Cap Back',
    'Cap Side (Left)', 'Cap Side (Right)', 'Pocket', 'Yoke / Upper Back',
    'Nape of Neck', 'Pant Leg', 'Tote / Bag', 'Other (describe in notes)'
]);

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Math.min(parseInt(process.argv[limitArg + 1], 10) || 200, 1000) : 200;

const env = (() => {
    const out = {};
    const envPath = path.resolve(__dirname, '..', '..', 'caspio-pricing-proxy', '.env');
    if (!fs.existsSync(envPath)) {
        console.error(`Cannot read Caspio credentials — expected ${envPath}`);
        process.exit(1);
    }
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line);
        if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return out;
})();

function req(opts, body) {
    return new Promise((resolve, reject) => {
        const r = https.request(opts, (res) => {
            let c = '';
            res.on('data', (d) => { c += d; });
            res.on('end', () => {
                try { resolve({ s: res.statusCode, d: JSON.parse(c) }); }
                catch { resolve({ s: res.statusCode, d: c }); }
            });
        });
        r.on('error', reject);
        if (body) r.write(body);
        r.end();
    });
}

(async () => {
    const tokBody = 'grant_type=client_credentials'
        + `&client_id=${encodeURIComponent(env.CASPIO_CLIENT_ID)}`
        + `&client_secret=${encodeURIComponent(env.CASPIO_CLIENT_SECRET)}`;
    const tok = await req({
        hostname: env.CASPIO_ACCOUNT_DOMAIN, path: '/oauth/token', method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(tokBody)
        }
    }, tokBody);
    const token = tok.d && tok.d.access_token;
    if (!token) {
        console.error('Caspio token request failed:', tok.s, tok.d);
        process.exit(1);
    }

    const select = 'ID_Design,Date_Created,User_Email,Sales_Rep,Status,Item_Type,'
        + 'CompanyName,Garment_Placement';
    const list = await req({
        hostname: env.CASPIO_ACCOUNT_DOMAIN,
        path: `/rest/v2/tables/ArtRequests/records?q.select=${encodeURIComponent(select)}`
            + `&q.orderBy=${encodeURIComponent('Date_Created DESC')}&q.limit=${LIMIT}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    if (list.s !== 200) {
        console.error('Caspio read failed:', list.s, list.d);
        process.exit(1);
    }

    const rows = (list.d && list.d.Result) || [];
    if (!rows.length) {
        console.log('No ArtRequests rows returned.');
        return;
    }

    // A row is "off-path" when the AE form's unconditional writes are absent.
    const viaAeForm = (r) => Boolean(r.Item_Type) && Boolean(r.Sales_Rep);

    // Rows predating the AE form are off-path for a boring reason — the form did not
    // exist yet — and counting them drowns the signal. Treat the OLDEST AE-form row in
    // the window as the go-live mark and judge only what came after it.
    const aeFormRows = rows.filter(viaAeForm);
    if (!aeFormRows.length) {
        console.log('No AE-form rows in this window — widen --limit before drawing conclusions.');
        return;
    }
    const goLive = aeFormRows.map((r) => r.Date_Created).sort()[0];
    const since = rows.filter((r) => r.Date_Created >= goLive);

    const bySubmitter = new Map();
    for (const r of since) {
        const who = r.User_Email || '(blank)';
        if (!bySubmitter.has(who)) {
            bySubmitter.set(who, { total: 0, aeForm: 0, lastOffPath: null, lastAeForm: null });
        }
        const e = bySubmitter.get(who);
        e.total += 1;
        // `since` is newest-first, so the first one seen is the most recent.
        if (viaAeForm(r)) {
            e.aeForm += 1;
            if (!e.lastAeForm) e.lastAeForm = r.Date_Created;
        } else if (!e.lastOffPath) {
            e.lastOffPath = r.Date_Created;
        }
    }

    const span = `${rows[rows.length - 1].Date_Created} → ${rows[0].Date_Created}`;
    console.log(`\nArtRequests submission-path audit — newest ${rows.length} rows`);
    console.log(`Window: ${span}`);
    console.log(`AE form appears live from: ${goLive}  (${since.length} rows since)\n`);
    console.log('  via AE form   submitter                        last off-path   last AE form');
    console.log('  ' + '-'.repeat(82));
    [...bySubmitter.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([who, e]) => {
            const off = e.lastOffPath ? String(e.lastOffPath).slice(0, 10) : '   —      ';
            const ae = e.lastAeForm ? String(e.lastAeForm).slice(0, 10) : '   —';
            console.log(`  ${String(e.aeForm).padStart(4)}/${String(e.total).padEnd(4)}    `
                + `${who.padEnd(32)} ${off}      ${ae}`);
        });

    // The actionable signal: someone whose most recent off-path submission is NEWER than
    // their most recent AE-form one (or who has no AE-form rows at all) is still off-path
    // TODAY. Everyone else's off-path rows are just rollout-era history.
    const stillOffPath = [...bySubmitter.entries()].filter(([, e]) =>
        e.lastOffPath && (!e.lastAeForm || e.lastOffPath > e.lastAeForm));
    console.log('\n' + '='.repeat(84));
    if (stillOffPath.length) {
        console.log('STILL SUBMITTING OFF-PATH (their newest request bypassed the AE form):');
        stillOffPath.forEach(([who, e]) => {
            console.log(`  ${who} — last off-path ${String(e.lastOffPath).slice(0, 10)}`
                + (e.lastAeForm ? `, last AE form ${String(e.lastAeForm).slice(0, 10)}` : ', never used the AE form'));
        });
        console.log('\nThese people get NO email to Steve and NO Slack ping on submit.');
    } else {
        console.log('CLEAR — everyone\'s most recent art request came through the AE form.');
    }
    console.log('='.repeat(84));

    const offPath = since.filter((r) => !viaAeForm(r));
    const historical = rows.length - since.length;
    console.log(`\nOff-path SINCE go-live (no Item_Type / Sales_Rep): ${offPath.length} of ${since.length}`);
    console.log('These produced NO email to Steve and NO #art-notifications Slack post.');
    if (historical) {
        console.log(`(${historical} older rows in the window predate the form and are excluded.)`);
    }
    console.log('');
    offPath.slice(0, 20).forEach((r) => {
        console.log(`  #${r.ID_Design}  ${String(r.Date_Created).slice(0, 10)}  `
            + `${String(r.User_Email || '(blank)').padEnd(30)} ${r.CompanyName || ''}`);
    });
    if (offPath.length > 20) console.log(`  ... and ${offPath.length - 20} more`);

    const oddPlacements = [...new Set(
        rows.map((r) => r.Garment_Placement).filter((p) => p && !AE_FORM_PLACEMENTS.has(p))
    )];
    if (oddPlacements.length) {
        console.log('\nPlacement values the AE form cannot produce (confirms a second form):');
        oddPlacements.slice(0, 15).forEach((p) => console.log(`  "${p}"`));
    }
    console.log('');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
