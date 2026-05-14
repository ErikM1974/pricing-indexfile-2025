#!/usr/bin/env node
/**
 * Policies Hub — one-time seed script.
 *
 * Inserts:
 *   - 2 "stub" records (External_URL) for the policy HTML pages that already exist
 *   - 7 "draft skeleton" records for the cards in policies-hub.html whose HTML
 *     files don't exist anymore — these become Phase 1 content for Erik to fill
 *     in via the TipTap editor.
 *
 * Usage:
 *   CRM_API_SECRET=... node scripts/seed-policies.js
 *
 * Requires the new /api/policies route deployed on caspio-pricing-proxy and the
 * Caspio `Policies` table to already exist. Re-running is safe (POST returns
 * a 409 on duplicate Policy_ID and the script will skip).
 */

const https = require('https');

const PROXY_HOST = 'caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const API_SECRET = process.env.CRM_API_SECRET;

if (!API_SECRET) {
    console.error('FATAL: CRM_API_SECRET env var not set.');
    process.exit(1);
}

// ----------------------------------------------------------------------------
// Seed data — match the cards currently in pages/policies-hub.html
// ----------------------------------------------------------------------------
const SEED = [
    // Two working stubs — file exists, link out via External_URL
    {
        Policy_ID: 'dtg-artwork-checklist',
        Category: 'Operations',
        Title: 'DTG Artwork Information Checklist',
        Summary: 'Complete guide for customer intake and artwork preparation for Direct-to-Garment printing. Includes 5-phase playbook.',
        Body_HTML: '',
        External_URL: '/pages/policies/dtg-artwork-checklist.html',
        Owner_Name: 'Art Department',
        Owner_Email: 'art@nwcustomapparel.com',
        Status: 'Published',
        Sort_Order: 100
    },
    {
        Policy_ID: 'pricing-negotiation-policy',
        Category: 'Financial',
        Title: 'Pricing Negotiation Strategy & Policy',
        Summary: 'Critical strategies for defending pricing and maintaining profitability with scripts.',
        Body_HTML: '',
        External_URL: '/pages/pricing-negotiation-policy.html',
        Owner_Name: 'Erik M.',
        Owner_Email: 'erik@nwcustomapparel.com',
        Status: 'Published',
        Sort_Order: 110
    },

    // Seven draft skeletons — files don't exist; Erik authors via TipTap.
    // Body_HTML carries a starter outline so the editor opens with structure.
    {
        Policy_ID: 'sales-office-procedures',
        Category: 'Operations',
        Title: 'Sales & Office Procedures',
        Summary: 'Comprehensive office standards including punctuality, customer service protocols, and phone policies.',
        Body_HTML: starterTemplate('Sales & Office Procedures', [
            'Punctuality (Lombardi Time)',
            'Customer service protocols',
            'Phone policies (3-ring rule)',
            'Digital communications',
            'Opening / closing procedures'
        ]),
        Owner_Name: 'Erik M.',
        Owner_Email: 'erik@nwcustomapparel.com',
        Status: 'Draft',
        Sort_Order: 120
    },
    {
        Policy_ID: 'retail-vs-wholesale-pricing-policy',
        Category: 'Financial',
        Title: 'Retail vs. Wholesale Pricing Policy',
        Summary: 'Essential understanding of our two business models and different pricing strategies.',
        Body_HTML: starterTemplate('Retail vs. Wholesale Pricing Policy', [
            'The two business models',
            'Why we maintain different pricing',
            'The Condo Care decision',
            'Protecting 40% jacket margins'
        ]),
        Owner_Name: 'Erik M.',
        Owner_Email: 'erik@nwcustomapparel.com',
        Status: 'Draft',
        Sort_Order: 130
    },
    {
        Policy_ID: 'bundle-kitting-xmas-2025',
        Category: 'Operations',
        Title: 'Christmas Bundle Kitting Process 2025',
        Summary: 'Step-by-step workflow for producing and assembling customer gift bundles.',
        Body_HTML: starterTemplate('Christmas Bundle Kitting Process 2025', [
            'Order intake',
            'Department coordination',
            'Quality control',
            'Final kitting with photography'
        ]),
        Owner_Name: 'Ruth N.',
        Owner_Email: 'ruth@nwcustomapparel.com',
        Status: 'Draft',
        Sort_Order: 140
    },
    {
        Policy_ID: 'payment-terms',
        Category: 'Financial',
        Title: 'Payment Terms Guide',
        Summary: 'Comprehensive guide to all payment terms including Net terms and special cases.',
        Body_HTML: starterTemplate('Payment Terms Guide', [
            'Pay on Pickup',
            'Prepaid orders',
            'Net terms (Net 15 / Net 30)',
            'Special cases & exceptions'
        ]),
        Owner_Name: 'Erik M.',
        Owner_Email: 'erik@nwcustomapparel.com',
        Status: 'Draft',
        Sort_Order: 150
    },
    {
        Policy_ID: 'ltm-fee-policy',
        Category: 'Financial',
        Title: 'Less Than Minimum (LTM) Fee Policy',
        Summary: 'Essential guide for applying the $50 LTM fee on orders under minimums.',
        Body_HTML: starterTemplate('Less Than Minimum (LTM) Fee Policy', [
            'When the $50 fee applies',
            'Method-specific minimums (Embroidery / DTG / DTF / Screen Print)',
            'Waiver eligibility',
            'Customer communication scripts'
        ]),
        Owner_Name: 'Erik M.',
        Owner_Email: 'erik@nwcustomapparel.com',
        Status: 'Draft',
        Sort_Order: 160
    },
    {
        Policy_ID: 'ltm-order-decision-algorithm',
        Category: 'Operations',
        Title: 'LTM Order Decision Algorithm',
        Summary: 'Comprehensive framework for AEs to handle Less-Than-Minimum order inquiries.',
        Body_HTML: starterTemplate('LTM Order Decision Algorithm', [
            'Decision tree: existing vs. new customers',
            'Upselling scripts',
            'Strategic filtering',
            'Referral procedures'
        ]),
        Owner_Name: 'Erik M.',
        Owner_Email: 'erik@nwcustomapparel.com',
        Status: 'Draft',
        Sort_Order: 170
    },
    {
        Policy_ID: 'customer-notification-sop',
        Category: 'Operations',
        Title: 'Customer Notification for Order Pickup',
        Summary: 'Standard operating procedure for notifying customers when orders are ready.',
        Body_HTML: starterTemplate('Customer Notification for Order Pickup', [
            'Call scripts',
            'ShopWorks logging instructions',
            'Follow-up protocols'
        ]),
        Owner_Name: 'Office Admin',
        Owner_Email: '',
        Status: 'Draft',
        Sort_Order: 180
    }
];

// Build a TipTap-compatible HTML starter for draft policies
function starterTemplate(title, sections) {
    const lis = sections.map(s => `<li>${escape(s)}</li>`).join('');
    return [
        `<p><em>This policy was migrated from the legacy hub. Replace this placeholder with the full text.</em></p>`,
        `<h2>${escape(title)}</h2>`,
        `<h3>What this policy covers</h3>`,
        `<ul>${lis}</ul>`,
        `<h3>Details</h3>`,
        `<p>Add the policy body here. Headings (H2, H3) auto-generate the right-side outline.</p>`
    ].join('');
}

function escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ----------------------------------------------------------------------------
// HTTPS POST helper
// ----------------------------------------------------------------------------
function postPolicy(record) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(record);
        const req = https.request({
            hostname: PROXY_HOST,
            path: '/api/policies/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-CRM-API-Secret': API_SECRET
            }
        }, res => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                let data = {};
                try { data = JSON.parse(chunks); } catch (e) { /* non-JSON */ }
                resolve({ status: res.statusCode, data });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function run() {
    console.log(`Seeding ${SEED.length} policies via ${PROXY_HOST}…\n`);

    let ok = 0, skipped = 0, failed = 0;

    for (const record of SEED) {
        process.stdout.write(`  ${record.Policy_ID.padEnd(40)} `);
        try {
            const { status, data } = await postPolicy(record);
            if (status === 201) {
                console.log('✓ created');
                ok++;
            } else if (status === 409) {
                console.log('· already exists, skipping');
                skipped++;
            } else {
                console.log(`✗ ${status} — ${(data && data.error) || 'unknown error'}`);
                failed++;
            }
        } catch (e) {
            console.log(`✗ network — ${e.message}`);
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
