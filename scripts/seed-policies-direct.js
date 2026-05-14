#!/usr/bin/env node
/**
 * Direct seed: insert the 9 legacy policies into Caspio Policies table.
 *
 * Bypasses the caspio-pricing-proxy entirely and uses Caspio's REST API
 * directly with the OAuth credentials from the proxy's .env file. This lets
 * us seed before the proxy is deployed.
 *
 * Reads:  scripts/legacy-policies.json (run scripts/extract-legacy-policies.js first)
 * Writes: rows into Caspio table `Policies`
 *
 * Usage: node scripts/seed-policies-direct.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load Caspio credentials from the sibling proxy repo's .env
const PROXY_ENV_PATH = path.resolve(__dirname, '..', '..', 'caspio-pricing-proxy', '.env');

function loadEnv() {
    const env = {};
    const text = fs.readFileSync(PROXY_ENV_PATH, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line);
        if (!m) continue;
        let value = m[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[m[1]] = value;
    }
    return env;
}

const env = loadEnv();
const DOMAIN = env.CASPIO_ACCOUNT_DOMAIN;
const CLIENT_ID = env.CASPIO_CLIENT_ID;
const CLIENT_SECRET = env.CASPIO_CLIENT_SECRET;

if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('FATAL: missing CASPIO_ACCOUNT_DOMAIN, CASPIO_CLIENT_ID, or CASPIO_CLIENT_SECRET in proxy .env');
    process.exit(1);
}

const TABLE_NAME = 'Policies';
const TIMESTAMP = new Date().toISOString().replace(/\.\d{3}Z$/, '');

// -------------------- HTTPS helpers --------------------
function httpsRequest({ host, path: reqPath, method, headers, body }) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: host,
            path: reqPath,
            method,
            headers
        }, res => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                let data = chunks;
                try { data = JSON.parse(chunks); } catch (e) { /* leave as string */ }
                resolve({ status: res.statusCode, data, raw: chunks });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getCaspioToken() {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`;
    const { status, data } = await httpsRequest({
        host: DOMAIN,
        path: '/oauth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body)
        },
        body
    });
    if (status !== 200 || !data.access_token) {
        throw new Error(`Caspio OAuth failed (${status}): ${JSON.stringify(data)}`);
    }
    return data.access_token;
}

async function postRecord(token, record) {
    const body = JSON.stringify(record);
    return httpsRequest({
        host: DOMAIN,
        path: `/rest/v2/tables/${TABLE_NAME}/records`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        },
        body
    });
}

async function findExisting(token, policyId) {
    const query = `q.where=${encodeURIComponent(`Policy_ID='${policyId.replace(/'/g, "''")}'`)}&q.select=${encodeURIComponent('Policy_ID')}&q.limit=1`;
    const { status, data } = await httpsRequest({
        host: DOMAIN,
        path: `/rest/v2/tables/${TABLE_NAME}/records?${query}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    if (status !== 200) return null;
    return (data.Result && data.Result.length > 0) ? data.Result[0] : null;
}

// -------------------- main --------------------
async function run() {
    const seedPath = path.resolve(__dirname, 'legacy-policies.json');
    if (!fs.existsSync(seedPath)) {
        console.error(`FATAL: ${seedPath} not found. Run extract-legacy-policies.js first.`);
        process.exit(1);
    }
    const records = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    console.log(`Loaded ${records.length} extracted policies.`);

    console.log('Authenticating with Caspio…');
    const token = await getCaspioToken();
    console.log('✓ Got access token.\n');

    let ok = 0, skipped = 0, failed = 0;

    for (const r of records) {
        const display = r.Policy_ID.padEnd(40);
        // Strip helper flags before POST
        delete r._oversized;
        delete r._bodyHtmlLength;

        // Stamp timestamps
        r.Created_At = TIMESTAMP;
        r.Updated_At = TIMESTAMP;
        // Caspio Yes/No field — server-side coerces 1/0
        r.Is_Active = 1;
        // Strip nulls (Caspio accepts null for nullable fields, but cleaner to omit)
        if (r.Parent_Policy_ID === null) delete r.Parent_Policy_ID;
        if (r.External_URL === null) delete r.External_URL;

        try {
            const existing = await findExisting(token, r.Policy_ID);
            if (existing) {
                console.log(`  ${display} · already exists, skipping`);
                skipped++;
                continue;
            }

            const { status, data, raw } = await postRecord(token, r);
            if (status === 201 || status === 200) {
                console.log(`  ${display} ✓ created (Body_HTML: ${r.Body_HTML.length} chars)`);
                ok++;
            } else {
                console.log(`  ${display} ✗ status ${status}: ${typeof data === 'object' ? JSON.stringify(data) : raw.slice(0, 200)}`);
                failed++;
            }
        } catch (e) {
            console.log(`  ${display} ✗ ${e.message}`);
            failed++;
        }
    }

    console.log(`\nDone. ${ok} created, ${skipped} skipped, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
