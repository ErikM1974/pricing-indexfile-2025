#!/usr/bin/env node
/**
 * normalize-shopworks-designs.js
 *
 * Reads two CSVs:
 *   1. Designs_Shopworks.csv — 50K rows, ~35K unique designs from ShopWorks
 *   2. Digitized_Designs_Master_2026_*.csv — 11K+ rows, ~10K unique designs with stitch data
 *
 * Merges them: for designs found in the master table, copies stitch count/tier/surcharge.
 * Outputs a single normalized CSV (~35K rows) for import into Caspio `ShopWorks_Designs` table.
 *
 * Usage:
 *   node tests/scripts/normalize-shopworks-designs.js                    # Dry-run (stats only)
 *   node tests/scripts/normalize-shopworks-designs.js --output           # Write CSV to ~/Downloads/
 *   node tests/scripts/normalize-shopworks-designs.js --output --path X  # Write CSV to custom path
 */

const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const DOWNLOADS = path.join(require('os').homedir(), 'Downloads');
const SW_CSV = path.join(DOWNLOADS, 'Designs_Shopworks.csv');
const MASTER_CSV_GLOB = 'Digitized_Designs_Master_2026';
const DEFAULT_OUTPUT = path.join(DOWNLOADS, 'shopworks-designs-normalized.csv');

// ─── CSV Parser (handles multiline quoted fields, latin-1 encoding) ─────────
function parseCSV(filePath, encoding = 'utf-8') {
    const raw = fs.readFileSync(filePath, encoding);
    const rows = [];
    let headers = null;
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < raw.length) {
        const ch = raw[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < raw.length && raw[i + 1] === '"') {
                    // Escaped quote
                    currentField += '"';
                    i += 2;
                    continue;
                }
                // End of quoted field
                inQuotes = false;
                i++;
                continue;
            }
            currentField += ch;
            i++;
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
                i++;
            } else if (ch === '\n' || ch === '\r') {
                // End of row
                currentRow.push(currentField.trim());
                currentField = '';

                if (!headers) {
                    headers = currentRow;
                } else if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
                    rows.push(currentRow);
                }
                currentRow = [];

                // Skip \r\n combo
                if (ch === '\r' && i + 1 < raw.length && raw[i + 1] === '\n') {
                    i += 2;
                } else {
                    i++;
                }
            } else {
                currentField += ch;
                i++;
            }
        }
    }

    // Handle last row if file doesn't end with newline
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (headers && (currentRow.length > 1 || currentRow[0] !== '')) {
            rows.push(currentRow);
        }
    }

    return { headers, rows };
}

// ─── Find master CSV (partial name match — picks newest by mtime) ────────────
function findMasterCSV() {
    const files = fs.readdirSync(DOWNLOADS);
    const matches = files
        .filter(f => f.includes(MASTER_CSV_GLOB) && f.endsWith('.csv'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(DOWNLOADS, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime); // newest first
    if (matches.length === 0) {
        console.error(`ERROR: Cannot find master CSV matching "${MASTER_CSV_GLOB}*.csv" in ${DOWNLOADS}`);
        process.exit(1);
    }
    if (matches.length > 1) {
        console.log(`  Found ${matches.length} master CSVs, using newest: ${matches[0].name}`);
    }
    return path.join(DOWNLOADS, matches[0].name);
}

// ─── Parse date string to Date object ───────────────────────────────────────
function parseDate(str) {
    if (!str) return null;
    // MM/DD/YYYY format
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
    // ISO format
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
    if (!d) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const doOutput = args.includes('--output');
    const pathIdx = args.indexOf('--path');
    const outputPath = pathIdx >= 0 && args[pathIdx + 1] ? args[pathIdx + 1] : DEFAULT_OUTPUT;

    console.log('=== ShopWorks Designs Normalize Script ===\n');

    // 1. Find and read master CSV
    const masterPath = findMasterCSV();
    console.log(`Master CSV: ${path.basename(masterPath)}`);
    const master = parseCSV(masterPath, 'utf-8');
    console.log(`  Parsed ${master.rows.length} rows, ${master.headers.length} columns`);

    // Build master lookup: Design_Number → { maxStitchCount, stitchTier, asSurcharge }
    const colIdx = {};
    master.headers.forEach((h, i) => { colIdx[h] = i; });

    const masterLookup = new Map(); // designNumber (int) → { stitchCount, stitchTier, asSurcharge }
    for (const row of master.rows) {
        const dnRaw = row[colIdx['Design_Number']];
        if (!dnRaw) continue;
        const dn = parseInt(parseFloat(dnRaw));
        if (isNaN(dn)) continue;

        const stitchCount = parseInt(row[colIdx['Stitch_Count']]) || 0;
        const stitchTier = (row[colIdx['Stitch_Tier']] || '').trim();
        const asSurcharge = parseFloat(row[colIdx['AS_Surcharge']]) || 0;

        const existing = masterLookup.get(dn);
        if (!existing || stitchCount > existing.stitchCount) {
            masterLookup.set(dn, { stitchCount, stitchTier, asSurcharge });
        }
    }
    console.log(`  Unique designs in master: ${masterLookup.size}`);

    // 2. Read ShopWorks CSV (latin-1 encoding — has non-UTF8 chars)
    console.log(`\nShopWorks CSV: ${path.basename(SW_CSV)}`);
    if (!fs.existsSync(SW_CSV)) {
        console.error(`ERROR: ShopWorks CSV not found at ${SW_CSV}`);
        process.exit(1);
    }
    const sw = parseCSV(SW_CSV, 'latin1');
    console.log(`  Parsed ${sw.rows.length} rows, ${sw.headers.length} columns`);

    // Build column index for ShopWorks
    const swCol = {};
    sw.headers.forEach((h, i) => { swCol[h] = i; });

    // Key columns
    const COL = {
        idDesign: swCol['ID_Design'],
        designName: swCol['DesignName'],
        companyName: swCol['Des_Cust::CompanyName'],
        designCode: swCol['Des_DesLoc::DesignCode'],
        color: swCol['Des_DesLoc_LocDetails::Color'],
        locDetailNum: swCol['Des_DesLoc_LocDetails::cn_LocDetailNumber'],
        designTypeId: swCol['Des_DesTyp_x_gn_id_DesignType::gn_ID_DesignType'],
        orderPlaced: swCol['Des_OrderDes_ALL::cd_OrderPlaced'],
        orderId: swCol['Des_OrderDes_ALL::id_Order'],
    };

    // Validate required columns exist
    for (const [name, idx] of Object.entries(COL)) {
        if (idx === undefined) {
            console.error(`ERROR: Missing column for ${name}`);
            process.exit(1);
        }
    }

    // 3. Group ShopWorks rows by base design number
    const designs = new Map(); // designNumber (int) → { name, company, code, colors[], orderDates[], orderIds, designTypeId }

    for (const row of sw.rows) {
        const idRaw = (row[COL.idDesign] || '').trim();
        if (!idRaw) continue;

        let idFloat;
        try {
            idFloat = parseFloat(idRaw);
        } catch {
            continue;
        }
        if (isNaN(idFloat)) continue;

        const baseNum = Math.floor(idFloat);
        const isParent = idRaw.includes('.00') || (idFloat === baseNum);
        // Decimal part: e.g., 103.01 → ".01" child row for thread colors
        const decimal = idRaw.includes('.') ? idRaw.split('.')[1].replace(/\s/g, '') : '00';

        if (!designs.has(baseNum)) {
            designs.set(baseNum, {
                name: '',
                company: '',
                code: '',
                colors: new Set(),
                orderDates: [],
                orderIds: new Set(),
                designTypeId: 0
            });
        }

        const d = designs.get(baseNum);

        // Parent rows (.00) have name/company/code
        if (decimal === '00') {
            const name = (row[COL.designName] || '').trim();
            const company = (row[COL.companyName] || '').trim();
            const code = (row[COL.designCode] || '').trim();
            const typeId = parseInt(row[COL.designTypeId]) || 0;

            if (name && !d.name) d.name = name;
            if (company && !d.company) d.company = company;
            if (code && !d.code) d.code = code;
            if (typeId && !d.designTypeId) d.designTypeId = typeId;
        }

        // Child rows (.01+) have thread colors
        const color = (row[COL.color] || '').trim();
        if (color) d.colors.add(color);

        // Order data (can be on any row — each row may represent a different order)
        const orderDate = (row[COL.orderPlaced] || '').trim();
        const orderId = (row[COL.orderId] || '').trim();

        if (orderDate) {
            const dt = parseDate(orderDate);
            if (dt) d.orderDates.push(dt);
        }
        if (orderId) d.orderIds.add(orderId);
    }

    console.log(`  Unique designs grouped: ${designs.size}`);

    // 4. Merge with master table stitch data
    let enrichedCount = 0;
    let shopworksOnlyCount = 0;

    const outputRows = [];

    for (const [designNum, d] of designs) {
        const masterInfo = masterLookup.get(designNum);
        const hasStitchData = !!masterInfo;

        if (hasStitchData) enrichedCount++;
        else shopworksOnlyCount++;

        // Compute derived fields
        const threadColors = [...d.colors].join(', ');
        const colorCount = d.colors.size;
        const lastOrderDate = d.orderDates.length > 0
            ? formatDate(new Date(Math.max(...d.orderDates.map(dt => dt.getTime()))))
            : '';
        const orderCount = d.orderIds.size;

        outputRows.push({
            Design_Number: designNum,
            Design_Name: d.name,
            Company_Name: d.company,
            Design_Code: d.code,
            Thread_Colors: threadColors,
            Color_Count: colorCount,
            Last_Order_Date: lastOrderDate,
            Order_Count: orderCount,
            Design_Type_ID: d.designTypeId,
            Stitch_Count: hasStitchData ? masterInfo.stitchCount : 0,
            Stitch_Tier: hasStitchData ? masterInfo.stitchTier : '',
            AS_Surcharge: hasStitchData ? masterInfo.asSurcharge : 0,
            Has_Stitch_Data: hasStitchData ? 'Yes' : 'No'
        });
    }

    // Sort by design number
    outputRows.sort((a, b) => a.Design_Number - b.Design_Number);

    // 5. Stats
    const masterOnly = [...masterLookup.keys()].filter(dn => !designs.has(dn));

    console.log('\n=== Results ===');
    console.log(`Total designs:          ${outputRows.length}`);
    console.log(`With stitch data:       ${enrichedCount} (enriched from master)`);
    console.log(`Without stitch data:    ${shopworksOnlyCount} (ShopWorks only)`);
    console.log(`Master-only (not in SW): ${masterOnly.length}`);
    console.log(`Coverage:               ${(enrichedCount / outputRows.length * 100).toFixed(1)}%`);

    // Date range stats
    const allDates = [];
    for (const d of designs.values()) {
        allDates.push(...d.orderDates);
    }
    if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        console.log(`Order date range:       ${formatDate(minDate)} — ${formatDate(maxDate)}`);
    }

    // Sample rows
    console.log('\n=== Sample (first 5 enriched) ===');
    const enrichedSamples = outputRows.filter(r => r.Has_Stitch_Data === 'Yes').slice(0, 5);
    for (const r of enrichedSamples) {
        console.log(`  #${r.Design_Number} "${r.Design_Name}" — ${r.Company_Name} | ${r.Stitch_Count} stitches (${r.Stitch_Tier}) +$${r.AS_Surcharge}/pc | ${r.Color_Count} colors | ${r.Order_Count} orders`);
    }

    console.log('\n=== Sample (first 5 without stitch data) ===');
    const noStitchSamples = outputRows.filter(r => r.Has_Stitch_Data === 'No').slice(0, 5);
    for (const r of noStitchSamples) {
        console.log(`  #${r.Design_Number} "${r.Design_Name}" — ${r.Company_Name} | ${r.Color_Count} colors | ${r.Order_Count} orders`);
    }

    if (masterOnly.length > 0) {
        console.log(`\n=== Master-only designs (first 10 of ${masterOnly.length}) ===`);
        masterOnly.sort((a, b) => a - b).slice(0, 10).forEach(dn => {
            const mi = masterLookup.get(dn);
            console.log(`  #${dn} — ${mi.stitchCount} stitches (${mi.stitchTier})`);
        });
    }

    // 6. Write output CSV
    if (doOutput) {
        const CSV_HEADERS = [
            'Design_Number', 'Design_Name', 'Company_Name', 'Design_Code',
            'Thread_Colors', 'Color_Count', 'Last_Order_Date', 'Order_Count',
            'Design_Type_ID', 'Stitch_Count', 'Stitch_Tier', 'AS_Surcharge', 'Has_Stitch_Data'
        ];

        const lines = [CSV_HEADERS.join(',')];
        for (const row of outputRows) {
            const values = CSV_HEADERS.map(h => {
                const val = String(row[h] ?? '');
                // Quote if contains comma, quote, or newline
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            lines.push(values.join(','));
        }

        fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
        console.log(`\n✓ Wrote ${outputRows.length} rows to ${outputPath}`);
    } else {
        console.log('\n(Dry-run mode — use --output to write CSV file)');
    }
}

main();
