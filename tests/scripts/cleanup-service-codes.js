/**
 * Cleanup Service Codes in Caspio — One-Time Migration Script
 *
 * Operations:
 *   DELETE 13 records: DGT-001, DGT-002, DGT-003, Name (lowercase dup), NAME,
 *                      CAP-DISCOUNT, emblem, Transfer, Shipping, ART, WEIGHT,
 *                      CDP 5x5, CDP 5x5-10
 *   UPDATE 2 records:  SPRESET ($25→$30), SPSU ($50→$30)
 *   RENAME 1 record:   HEAVYWEIGHT-SURCHARGE → HW-SURCHG (delete old + insert new)
 *   INSERT if missing: HW-SURCHG, Name/Number, SPSU
 *
 * Usage:
 *   node tests/scripts/cleanup-service-codes.js          # dry-run (default)
 *   node tests/scripts/cleanup-service-codes.js --live    # actually write to Caspio
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

const CODES_TO_DELETE = [
    'DGT-001', 'DGT-002', 'DGT-003',
    'CAP-DISCOUNT', 'emblem', 'Transfer', 'Shipping', 'WEIGHT',
    'NAME',          // Replaced by Name/Number ($15)
    'CDP 5x5',       // Consolidated into CDP
    'CDP 5x5-10'     // Consolidated into CDP
];

// Name (lowercase) and ART (uppercase $0) are duplicates — delete by matching
// ART ($0 passthrough) must be distinguished from Art ($75/hr) by SellPrice
const DUPLICATE_DELETES = [
    // 'Name' (PK=19, cost=$6.25) is the lowercase duplicate — both 'Name' and 'NAME' replaced by Name/Number
    { code: 'Name', matchFn: (rec) => rec.ServiceCode === 'Name' },
    { code: 'ART', matchFn: (rec) => rec.ServiceCode === 'ART' && (rec.SellPrice === 0 || rec.SellPrice === null) }
];

const CODES_TO_UPDATE = {
    'SPRESET': { SellPrice: 30.00, UnitCost: 15.00, DisplayName: 'Screen Reset Charge' },
    'SPSU': { SellPrice: 30.00, UnitCost: 15.00, DisplayName: 'Screen Print Set Up' }
};

const RENAME_OLD = 'HEAVYWEIGHT-SURCHARGE';
const RENAME_NEW = {
    ServiceCode: 'HW-SURCHG',
    ServiceType: 'FEE',
    DisplayName: 'Heavyweight Garment Surcharge',
    Category: 'Fee',
    PricingMethod: 'FIXED',
    TierLabel: '',
    UnitCost: 5.00,
    SellPrice: 10.00,
    PerUnit: 'each',
    Notes: 'Heavyweight garment surcharge. SW cost $5, 2026 sell $10.'
};

const CODES_TO_INSERT_IF_MISSING = [
    {
        ServiceCode: 'Name/Number',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Name & Number Combo',
        Category: 'Service',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 7.50,
        SellPrice: 15.00,
        PerUnit: 'each',
        Notes: 'Name + number combo embroidery. SW cost $7.50, 2026 sell $15.'
    },
    {
        ServiceCode: 'HW-SURCHG',
        ServiceType: 'FEE',
        DisplayName: 'Heavyweight Garment Surcharge',
        Category: 'Fee',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 5.00,
        SellPrice: 10.00,
        PerUnit: 'each',
        Notes: 'Heavyweight garment surcharge. SW cost $5, 2026 sell $10.'
    },
    {
        ServiceCode: 'SPSU',
        ServiceType: 'FEE',
        DisplayName: 'Screen Print Set Up',
        Category: 'Fee',
        PricingMethod: 'FIXED',
        TierLabel: '',
        UnitCost: 15.00,
        SellPrice: 30.00,
        PerUnit: 'each',
        Notes: 'Screen print set up charge. SW cost $15, 2026 sell $30.'
    }
];

// ── Helpers ──

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchExisting() {
    const resp = await fetch(`${API_BASE_URL}/api/service-codes?refresh=true`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.success) throw new Error('API returned success=false');
    return data.data;
}

async function deleteRecord(pkId) {
    const resp = await fetch(`${API_BASE_URL}/api/service-codes/${pkId}`, { method: 'DELETE' });
    return { status: resp.status, data: await resp.json() };
}

async function updateRecord(pkId, fields) {
    const resp = await fetch(`${API_BASE_URL}/api/service-codes/${pkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
    });
    return { status: resp.status, data: await resp.json() };
}

async function insertRecord(record) {
    const resp = await fetch(`${API_BASE_URL}/api/service-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });
    return { status: resp.status, data: await resp.json() };
}

// ── Main ──

async function main() {
    const isLive = process.argv.includes('--live');

    console.log('='.repeat(60));
    console.log('CLEANUP SERVICE CODES — ONE-TIME MIGRATION');
    console.log(`Mode: ${isLive ? '*** LIVE (writing to Caspio) ***' : 'DRY-RUN (read-only)'}`);
    console.log('='.repeat(60));
    console.log('');

    const results = { deleted: 0, updated: 0, inserted: 0, skipped: 0, failed: 0 };

    console.log('Fetching existing service codes...');
    let existing;
    try {
        existing = await fetchExisting();
        console.log(`  Found ${existing.length} records`);
    } catch (err) {
        console.error(`  FATAL: ${err.message}`);
        process.exit(1);
    }

    // Build lookup
    const byCode = {};
    for (const rec of existing) {
        const key = rec.ServiceCode;
        if (!byCode[key]) byCode[key] = [];
        byCode[key].push(rec);
    }

    console.log('');

    // ── Phase 1: DELETE exact-match codes ──
    console.log('--- PHASE 1: DELETE codes ---');
    for (const code of CODES_TO_DELETE) {
        const recs = byCode[code];
        if (!recs || recs.length === 0) {
            console.log(`  [skip] ${code} — not found in Caspio`);
            results.skipped++;
            continue;
        }
        for (const rec of recs) {
            if (isLive) {
                try {
                    const { status } = await deleteRecord(rec.PK_ID);
                    if (status === 200 || status === 204) {
                        console.log(`  [DEL]  ${code} (PK_ID=${rec.PK_ID}) — DELETED`);
                        results.deleted++;
                    } else {
                        console.log(`  [FAIL] ${code} (PK_ID=${rec.PK_ID}) — HTTP ${status}`);
                        results.failed++;
                    }
                    await sleep(500);
                } catch (err) {
                    console.log(`  [ERR]  ${code} — ${err.message}`);
                    results.failed++;
                }
            } else {
                console.log(`  [DEL]  ${code} (PK_ID=${rec.PK_ID}, sell=$${rec.SellPrice}) — WOULD DELETE`);
                results.deleted++;
            }
        }
    }

    // ── Phase 1b: DELETE duplicates by custom matcher ──
    for (const dup of DUPLICATE_DELETES) {
        const matches = existing.filter(dup.matchFn);
        if (matches.length === 0) {
            console.log(`  [skip] ${dup.code} (duplicate) — no matching record found`);
            results.skipped++;
            continue;
        }
        for (const rec of matches) {
            if (isLive) {
                try {
                    const { status } = await deleteRecord(rec.PK_ID);
                    if (status === 200 || status === 204) {
                        console.log(`  [DEL]  ${rec.ServiceCode} (PK_ID=${rec.PK_ID}, sell=$${rec.SellPrice}) — DELETED (duplicate)`);
                        results.deleted++;
                    } else {
                        console.log(`  [FAIL] ${rec.ServiceCode} (PK_ID=${rec.PK_ID}) — HTTP ${status}`);
                        results.failed++;
                    }
                    await sleep(500);
                } catch (err) {
                    console.log(`  [ERR]  ${rec.ServiceCode} — ${err.message}`);
                    results.failed++;
                }
            } else {
                console.log(`  [DEL]  ${rec.ServiceCode} (PK_ID=${rec.PK_ID}, sell=$${rec.SellPrice}) — WOULD DELETE (duplicate)`);
                results.deleted++;
            }
        }
    }

    console.log('');

    // ── Phase 2: UPDATE pricing ──
    console.log('--- PHASE 2: UPDATE pricing ---');
    for (const [code, newFields] of Object.entries(CODES_TO_UPDATE)) {
        const recs = byCode[code];
        if (!recs || recs.length === 0) {
            console.log(`  [skip] ${code} — not found (will be inserted in phase 4)`);
            results.skipped++;
            continue;
        }
        // Update the base record (no TierLabel)
        const baseRec = recs.find(r => !r.TierLabel) || recs[0];
        if (baseRec.SellPrice === newFields.SellPrice && baseRec.UnitCost === newFields.UnitCost) {
            console.log(`  [ok]   ${code} — already at sell=$${newFields.SellPrice}, cost=$${newFields.UnitCost}`);
            results.skipped++;
            continue;
        }
        if (isLive) {
            try {
                const { status } = await updateRecord(baseRec.PK_ID, newFields);
                if (status === 200) {
                    console.log(`  [UPD]  ${code} — sell: $${baseRec.SellPrice}→$${newFields.SellPrice}, cost: $${baseRec.UnitCost}→$${newFields.UnitCost}`);
                    results.updated++;
                } else {
                    console.log(`  [FAIL] ${code} — HTTP ${status}`);
                    results.failed++;
                }
                await sleep(500);
            } catch (err) {
                console.log(`  [ERR]  ${code} — ${err.message}`);
                results.failed++;
            }
        } else {
            console.log(`  [UPD]  ${code} — sell: $${baseRec.SellPrice}→$${newFields.SellPrice}, cost: $${baseRec.UnitCost}→$${newFields.UnitCost} — WOULD UPDATE`);
            results.updated++;
        }
    }

    console.log('');

    // ── Phase 3: RENAME (delete old + insert new) ──
    console.log('--- PHASE 3: RENAME ---');
    const oldRecs = byCode[RENAME_OLD];
    if (oldRecs && oldRecs.length > 0) {
        for (const rec of oldRecs) {
            if (isLive) {
                try {
                    const { status } = await deleteRecord(rec.PK_ID);
                    if (status === 200 || status === 204) {
                        console.log(`  [DEL]  ${RENAME_OLD} (PK_ID=${rec.PK_ID}) — DELETED for rename`);
                        results.deleted++;
                    } else {
                        console.log(`  [FAIL] ${RENAME_OLD} delete — HTTP ${status}`);
                        results.failed++;
                    }
                    await sleep(500);
                } catch (err) {
                    console.log(`  [ERR]  ${RENAME_OLD} — ${err.message}`);
                    results.failed++;
                }
            } else {
                console.log(`  [DEL]  ${RENAME_OLD} (PK_ID=${rec.PK_ID}) — WOULD DELETE for rename`);
                results.deleted++;
            }
        }
    } else {
        console.log(`  [skip] ${RENAME_OLD} — not found (new code may already exist)`);
    }

    console.log('');

    // ── Phase 4: INSERT if missing ──
    console.log('--- PHASE 4: INSERT if missing ---');
    // Re-fetch after deletes/updates to avoid stale data in live mode
    let currentCodes;
    if (isLive) {
        await sleep(1000);
        currentCodes = await fetchExisting();
    } else {
        currentCodes = existing;
    }

    const currentByCode = {};
    for (const rec of currentCodes) {
        if (!currentByCode[rec.ServiceCode]) currentByCode[rec.ServiceCode] = [];
        currentByCode[rec.ServiceCode].push(rec);
    }

    for (const newRec of CODES_TO_INSERT_IF_MISSING) {
        const existingRecs = currentByCode[newRec.ServiceCode];
        if (existingRecs && existingRecs.length > 0) {
            console.log(`  [skip] ${newRec.ServiceCode} — already exists (sell=$${existingRecs[0].SellPrice})`);
            results.skipped++;
            continue;
        }
        if (isLive) {
            try {
                const { status, data } = await insertRecord(newRec);
                if (status === 201) {
                    console.log(`  [INS]  ${newRec.ServiceCode} — INSERTED (sell=$${newRec.SellPrice})`);
                    results.inserted++;
                } else {
                    console.log(`  [FAIL] ${newRec.ServiceCode} — HTTP ${status}: ${data.error || JSON.stringify(data)}`);
                    results.failed++;
                }
                await sleep(500);
            } catch (err) {
                console.log(`  [ERR]  ${newRec.ServiceCode} — ${err.message}`);
                results.failed++;
            }
        } else {
            console.log(`  [INS]  ${newRec.ServiceCode} — WOULD INSERT (sell=$${newRec.SellPrice}, cost=$${newRec.UnitCost})`);
            results.inserted++;
        }
    }

    // ── Summary ──
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log(`  Deleted:  ${results.deleted}`);
    console.log(`  Updated:  ${results.updated}`);
    console.log(`  Inserted: ${results.inserted}`);
    console.log(`  Skipped:  ${results.skipped}`);
    console.log(`  Failed:   ${results.failed}`);
    console.log('='.repeat(60));

    if (!isLive && (results.deleted > 0 || results.updated > 0 || results.inserted > 0)) {
        console.log('');
        console.log('Run with --live to apply changes:');
        console.log('  node tests/scripts/cleanup-service-codes.js --live');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
