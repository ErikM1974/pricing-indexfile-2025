#!/usr/bin/env node
/**
 * One-shot: re-parent specific policies to demo the 3-level hierarchy
 * (Category → Policy → Sub-procedure).
 *
 * Currently: re-parents `ltm-order-decision-algorithm` under `ltm-fee-policy`.
 * Add more pairs to RE_PARENT_PAIRS as needed.
 *
 * Usage: node scripts/reparent-policy.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const RE_PARENT_PAIRS = [
    { child: 'ltm-order-decision-algorithm', parent: 'ltm-fee-policy' }
];

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

async function getToken() {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`;
    const { status, data } = await httpsReq({
        hostname: DOMAIN, path: '/oauth/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, body);
    if (status !== 200 || !data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
    return data.access_token;
}

async function setParent(token, childId, parentId) {
    const body = JSON.stringify({ Parent_Policy_ID: parentId, Updated_At: TIMESTAMP });
    const path = `/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(`Policy_ID='${childId.replace(/'/g, "''")}'`)}`;
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
    const token = await getToken();
    console.log(`Re-parenting ${RE_PARENT_PAIRS.length} policy/policies…\n`);

    for (const { child, parent } of RE_PARENT_PAIRS) {
        const { status, data } = await setParent(token, child, parent);
        const display = `${child.padEnd(40)} → parent=${parent}`;
        if (status === 200 || status === 204) {
            console.log(`  ✓ ${display}`);
        } else {
            console.log(`  ✗ ${display}  (status ${status}: ${JSON.stringify(data).slice(0, 150)})`);
        }
    }

    console.log('\nDone.');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
