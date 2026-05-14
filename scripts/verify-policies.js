#!/usr/bin/env node
// Quick read-back of the Policies table to confirm the 9 rows landed.
const fs = require('fs'), path = require('path'), https = require('https');

const env = (() => {
    const out = {};
    const t = fs.readFileSync(path.resolve(__dirname, '..', '..', 'caspio-pricing-proxy', '.env'), 'utf8');
    for (const line of t.split(/\r?\n/)) {
        const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line);
        if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return out;
})();

function req(opts, body) {
    return new Promise((resolve, reject) => {
        const r = https.request(opts, res => {
            let c = '';
            res.on('data', d => c += d);
            res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(c) }); } catch { resolve({ s: res.statusCode, d: c }); } });
        });
        r.on('error', reject);
        if (body) r.write(body);
        r.end();
    });
}

(async () => {
    const tokBody = `grant_type=client_credentials&client_id=${encodeURIComponent(env.CASPIO_CLIENT_ID)}&client_secret=${encodeURIComponent(env.CASPIO_CLIENT_SECRET)}`;
    const tok = await req({
        hostname: env.CASPIO_ACCOUNT_DOMAIN, path: '/oauth/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokBody) }
    }, tokBody);
    const token = tok.d.access_token;

    const list = await req({
        hostname: env.CASPIO_ACCOUNT_DOMAIN,
        path: `/rest/v2/tables/Policies/records?q.select=${encodeURIComponent('Policy_ID,Title,Category,Status,Owner_Name,Sort_Order,Updated_At')}&q.orderBy=${encodeURIComponent('Sort_Order ASC')}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });

    const rows = list.d.Result || [];
    console.log(`\nFound ${rows.length} policies in Caspio:\n`);
    rows.forEach(r => {
        console.log(`  [${(r.Sort_Order + '').padStart(3)}] ${r.Category.padEnd(12)} ${r.Status.padEnd(10)} ${r.Policy_ID.padEnd(40)} ${r.Title}`);
    });
})().catch(e => { console.error(e); process.exit(1); });
