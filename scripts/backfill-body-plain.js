#!/usr/bin/env node
/**
 * One-shot: backfill Body_Plain on every Policies record that has Body_HTML
 * but an empty Body_Plain (the 9 legacy migrations + any others).
 *
 * The route's PUT handler re-derives Body_Plain server-side from Body_HTML
 * on every save — but those 9 rows were inserted directly into Caspio
 * bypassing that route, so they have empty Body_Plain and don't match
 * body-text search.
 *
 * Strategy: fetch all records with Is_Active=1 that have empty Body_Plain,
 * compute the plain-text strip locally, and PUT each one back (which
 * triggers the server's own strip + Updated_At bump).
 *
 * Reads Caspio credentials from caspio-pricing-proxy/.env (same as
 * seed-policies-direct.js). Bypasses the proxy entirely — direct REST.
 *
 * Usage: node scripts/backfill-body-plain.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const env = (() => {
    const out = {};
    const t = fs.readFileSync(path.resolve(__dirname, '..', '..', 'caspio-pricing-proxy', '.env'), 'utf8');
    for (const line of t.split(/\r?\n/)) {
        const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line);
        if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return out;
})();

const DOMAIN = env.CASPIO_ACCOUNT_DOMAIN;
const CLIENT_ID = env.CASPIO_CLIENT_ID;
const CLIENT_SECRET = env.CASPIO_CLIENT_SECRET;

const TABLE = 'Policies';
const TIMESTAMP = new Date().toISOString().replace(/\.\d{3}Z$/, '');

function httpsReq(opts, body) {
    return new Promise((resolve, reject) => {
        const r = https.request(opts, res => {
            let c = '';
            res.on('data', d => c += d);
            res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(c) }); } catch { resolve({ status: res.statusCode, data: c }); } });
        });
        r.on('error', reject);
        if (body) r.write(body);
        r.end();
    });
}

function htmlToPlainText(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

async function getToken() {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`;
    const { status, data } = await httpsReq({
        hostname: DOMAIN, path: '/oauth/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, body);
    if (status !== 200 || !data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
    return data.access_token;
}

async function listPolicies(token) {
    const path = `/rest/v2/tables/${TABLE}/records?q.select=${encodeURIComponent('PK_ID,Policy_ID,Title,Body_HTML,Body_Plain')}&q.where=${encodeURIComponent('Is_Active=1')}&q.limit=1000`;
    const { status, data } = await httpsReq({
        hostname: DOMAIN, path, method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (status !== 200) throw new Error(`List failed: ${JSON.stringify(data)}`);
    return data.Result || [];
}

async function updateBodyPlain(token, policyId, bodyPlain) {
    const body = JSON.stringify({ Body_Plain: bodyPlain, Updated_At: TIMESTAMP });
    const path = `/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(`Policy_ID='${policyId.replace(/'/g, "''")}'`)}`;
    return httpsReq({
        hostname: DOMAIN, path, method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    }, body);
}

async function run() {
    console.log('Authenticating with Caspio…');
    const token = await getToken();
    console.log('✓ Got token.\n');

    console.log('Fetching all active policies…');
    const policies = await listPolicies(token);
    console.log(`Found ${policies.length} active policies.\n`);

    const needsBackfill = policies.filter(p => {
        const html = p.Body_HTML || '';
        const plain = p.Body_Plain || '';
        return html.length > 0 && plain.length === 0;
    });

    if (needsBackfill.length === 0) {
        console.log('No policies need backfill. Body_Plain is populated for everyone.');
        return;
    }

    console.log(`${needsBackfill.length} policies need Body_Plain backfill:\n`);

    let ok = 0, failed = 0;
    for (const p of needsBackfill) {
        const plain = htmlToPlainText(p.Body_HTML);
        const display = p.Policy_ID.padEnd(40);
        try {
            const { status, data } = await updateBodyPlain(token, p.Policy_ID, plain);
            if (status === 200 || status === 204) {
                console.log(`  ${display} ✓ wrote ${plain.length} chars`);
                ok++;
            } else {
                console.log(`  ${display} ✗ status ${status}: ${JSON.stringify(data).slice(0, 150)}`);
                failed++;
            }
        } catch (e) {
            console.log(`  ${display} ✗ ${e.message}`);
            failed++;
        }
    }

    console.log(`\nDone. ${ok} backfilled, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
