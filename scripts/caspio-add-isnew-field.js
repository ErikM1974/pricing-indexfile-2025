/**
 * Add IsNew Field to Caspio Table
 * Uses Caspio REST API v3 to add boolean field for new products
 *
 * Usage: node scripts/caspio-add-isnew-field.js
 */

const TABLE_NAME = 'Sanmar_Bulk_251816_Feb2024';
const CASPIO_ACCOUNT_ID = 'c3eku948';
const CASPIO_API_BASE = `https://${CASPIO_ACCOUNT_ID}.caspio.com/rest/v3`;

// Bearer token from user's curl example
const BEARER_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOiJjM2VrdTk0OCIsImRvbWFpbklkIjoiQTBFMTUwMDAiLCJpYXQiOjE3MzU5MTY2MzUsImV4cCI6MTczNTkyMDIzNSwiYXVkIjoiaHR0cHM6Ly9jM2VrdTk0OC5jYXNwaW8uY29tIn0.Zx2qfXuS8bJDXDp4Jiq8-tZGgqNVqKH-xBZbYJV9e0fVVPCpKB5DM5wfp8G7Qcd-Wgf44cq6JeR2D3M8_nxNFWS5_7YC9fRGJpULYY7PXZlmtL-W8oWFSKOSMPHqLs-fUO3P_5AovbE-eGwEIbfPnlPfGXDZD1dw-qmF_eA_nnb6Vhk7wWXkMD5tGy_VqaX3vXhR8d3TT_bAF7IcWzsIa-WDSYjsNtDvUc7PeZqQ1jM3w_Uq9n0F6qPJu6fRG8FRO2vf73X0d8A9mWRFfJE8CfUFcLFy_Oe7HYLqRLHzVuPnpUuHgNx5WLaLNF-FaBF8vF8K0aF5nkF7F0';

/**
 * Add IsNew field to Caspio table
 */
async function addIsNewField() {
    console.log('='.repeat(70));
    console.log('ADD IsNew FIELD TO CASPIO TABLE');
    console.log('='.repeat(70));
    console.log(`Table: ${TABLE_NAME}`);
    console.log('Field: IsNew (Boolean, default: false)');
    console.log('='.repeat(70));

    try {
        // Field definition following IsTopSeller pattern
        const fieldDefinition = {
            Name: 'IsNew',
            Type: 'Yes/No',  // Boolean type in Caspio
            Description: 'Flag for new products to display in showcase',
            DisplayOrder: 999,  // Add at end of field list
            UniqueConstraint: false,
            Required: false,
            DefaultValue: false
        };

        console.log('\n[1/3] Preparing field definition...');
        console.log(JSON.stringify(fieldDefinition, null, 2));

        console.log('\n[2/3] Sending POST request to Caspio API...');
        const url = `${CASPIO_API_BASE}/tables/${TABLE_NAME}/fields`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(fieldDefinition)
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (response.status === 201) {
            console.log('\n[3/3] Field created successfully!');
            const result = await response.json();
            console.log('Response:', JSON.stringify(result, null, 2));
            return { success: true, data: result };
        } else if (response.status === 400) {
            const error = await response.json();
            if (error.message && error.message.includes('already exists')) {
                console.log('\n[INFO] Field already exists - no action needed');
                return { success: true, alreadyExists: true };
            }
            throw new Error(`Field creation failed: ${JSON.stringify(error)}`);
        } else {
            const errorText = await response.text();
            throw new Error(`Unexpected response (${response.status}): ${errorText}`);
        }

    } catch (error) {
        console.error('\n[ERROR] Failed to add field:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Verify field was added successfully
 */
async function verifyField() {
    console.log('\n' + '='.repeat(70));
    console.log('VERIFY FIELD CREATION');
    console.log('='.repeat(70));

    try {
        const url = `${CASPIO_API_BASE}/tables/${TABLE_NAME}/fields/IsNew`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        if (response.status === 200) {
            const field = await response.json();
            console.log('\n✓ Field verified successfully:');
            console.log(JSON.stringify(field, null, 2));
            return { success: true, field };
        } else {
            console.log('\n✗ Field not found (may need a few seconds to propagate)');
            return { success: false };
        }

    } catch (error) {
        console.error('Verification error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\nStarting IsNew field creation process...\n');

    // Step 1: Add field
    const addResult = await addIsNewField();

    if (!addResult.success) {
        console.log('\n❌ Field creation failed. Please check error details above.');
        process.exit(1);
    }

    if (addResult.alreadyExists) {
        console.log('\n✓ Field already exists - ready for product updates');
        process.exit(0);
    }

    // Step 2: Wait a moment for propagation
    console.log('\nWaiting 3 seconds for field to propagate...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Verify
    const verifyResult = await verifyField();

    if (verifyResult.success) {
        console.log('\n✓ All checks passed! Field is ready for use.');
        console.log('\nNext step: Run caspio-update-new-products.js to update 15 products');
    } else {
        console.log('\n⚠ Field created but verification failed (may be timing issue)');
        console.log('Try running verification again in a few seconds');
    }

    console.log('\n' + '='.repeat(70));
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { addIsNewField, verifyField };
