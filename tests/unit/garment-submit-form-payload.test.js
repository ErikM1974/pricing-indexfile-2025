/**
 * garment-submit-form-payload.test.js
 *
 * Locks the ArtRequests POST payload contract produced by GarmentSubmitForm
 * (shared_components/js/garment-submit-form.js). Every downstream surface —
 * the art-request detail page, Steve's gallery + kanban, the AE galleries —
 * renders these exact column names, so a regression here silently breaks all
 * of them. Runs in the node jest env with a minimal document/window stub
 * (no jsdom dependency) via the module's _buildPayloadForTest hook.
 */

// The IIFE references `window` at load time for APP_CONFIG — stub before require.
global.window = {};

function makeDoc(fields, checkedDecorations) {
    return {
        getElementById: function (id) {
            if (!(id in fields)) return null;
            var v = fields[id];
            // Objects (e.g. { checked: true }) are returned as-is so callers can
            // read .checked; primitives are wrapped as { value }.
            if (v !== null && typeof v === 'object') return v;
            return { value: v };
        },
        querySelectorAll: function (sel) {
            if (sel === '.gsf-decoration:checked') {
                return (checkedDecorations || []).map(function (d) { return { value: d }; });
            }
            return [];
        }
    };
}

var GarmentSubmitForm = require('../../shared_components/js/garment-submit-form.js');

describe('GarmentSubmitForm payload contract', () => {
    // Don't leak the window/document stubs into other suites in this worker.
    afterAll(() => { delete global.document; delete global.window; });

    test('New artwork: full structured payload maps to the right ArtRequests columns', () => {
        global.document = makeDoc({
            'gsf-company': 'Torco Construction',
            'gsf-cust-num': '12345',
            'gsf-customer-id': '12345',
            'gsf-contact-name': 'Jane Smith',
            'gsf-contact-email': 'jane@torco.com',
            'gsf-due-date': '2026-06-25',
            'gsf-design-num': '52990',
            'gsf-order-num': '88001',
            'gsf-prelim': '50',
            'gsf-artwork-status': 'New artwork from scratch',
            'gsf-approval-status': 'Not approved — Steve to create proof',
            'gsf-color-mode': 'Use exact PMS colors',
            'gsf-underbase': 'Yes',
            'gsf-pms': 'PMS 282 Navy',
            'gsf-thread': '',
            'gsf-exact-text': 'TORCO CONSTRUCTION',
            'gsf-no-text': { checked: false },
            'gsf-prev-order': '',
            'gsf-prev-design': '',
            'gsf-keep-same': '',
            'gsf-change': '',
            'gsf-file-type': 'Customer vector file (AI, EPS, PDF, SVG)',
            'gsf-notes': 'Rush if possible'
        }, ['Screen Print', 'Embroidery']);

        var payload = GarmentSubmitForm._buildPayloadForTest({
            companyName: 'Torco Construction',
            aeName: 'Erik',
            aeEmail: 'erik@nwcustomapparel.com',
            salesRep: 'Erik',
            isRush: true,
            garmentRows: [
                { style: 'PC54', colorName: 'Navy', catalogColor: 'Navy', swatch: 'http://x/swatch.png', image: 'http://x/model.png' },
                { style: 'PC90H', colorName: 'Black', catalogColor: 'Black', swatch: '', image: '' }
            ],
            artworkLocations: [
                { placement: 'Left Chest', width: '3.5', height: '2', notes: 'centered' },
                { placement: 'Full Back', width: '11', height: '9', notes: '2.5" below collar' }
            ],
            uploaded: [{ fileName: 'logo.ai' }]
        });

        // Core identity
        expect(payload.Item_Type).toBe('Garment');
        expect(payload.Status).toBe('Submitted');
        expect(payload.Mockup).toBe('Yes');
        expect(payload.Revision_Count).toBe(0);
        expect(payload.Request_Type).toBe('New Artwork');

        // Decoration → Order_Type_Source (Order_Type is REST-unwriteable)
        expect(payload.Order_Type_Source).toBe('Screen Print, Embroidery');
        expect(payload.Order_Type).toBeUndefined();

        // New structured fields
        expect(payload.Artwork_Status).toBe('New artwork from scratch');
        expect(payload.Approval_Status).toBe('Not approved — Steve to create proof');
        expect(payload.Color_Mode).toBe('Use exact PMS colors');
        expect(payload.PMS_Colors).toBe('PMS 282 Navy');
        expect(payload.Underbase_Required).toBe('Yes');
        expect(payload.Exact_Text).toBe('TORCO CONSTRUCTION');
        expect(payload.Uploaded_File_Type).toBe('Customer vector file (AI, EPS, PDF, SVG)');
        expect(payload.AE_Checklist_Confirmed).toBe(true);
        expect(payload.AE_Checklist_Confirmed_By).toBe('Erik');

        // Artwork_Locations is a JSON string that round-trips to the array
        var locs = JSON.parse(payload.Artwork_Locations);
        expect(Array.isArray(locs)).toBe(true);
        expect(locs).toHaveLength(2);
        expect(locs[0]).toMatchObject({ placement: 'Left Chest', width: '3.5', height: '2' });

        // Primary placement back-compat with the single Garment_Placement field
        expect(payload.Garment_Placement).toBe('Left Chest');

        // Garment rows → slot columns
        expect(payload.GarmentStyle).toBe('PC54');
        expect(payload.GarmentColor).toBe('Navy');
        expect(payload.Swatch_1).toBe('http://x/swatch.png');
        expect(payload.MAIN_IMAGE_URL_1).toBe('http://x/model.png');
        expect(payload.Garm_Style_2).toBe('PC90H');
        expect(payload.Garm_Color_2).toBe('Black');

        // ShopWorks refs + customer
        expect(payload.Design_Num_SW).toBe('52990');
        expect(payload.Order_Num_SW).toBe('88001');
        expect(payload.id_Customer).toBe(12345);
        expect(payload.Shopwork_customer_number).toBe('12345');
        expect(payload.Prelim_Charges).toBe('50');

        // Contact split
        expect(payload.First_name).toBe('Jane');
        expect(payload.Last_name).toBe('Smith');
        expect(payload.Full_Name_Contact).toBe('Jane Smith');

        // Rush
        expect(payload.Is_Rush).toBe(true);

        // File slot
        expect(payload.File_Upload_One).toBe('/Artwork/logo.ai');
    });

    test('Mockup only + no-text: Request_Type flips and Exact_Text uses the no-text marker', () => {
        global.document = makeDoc({
            'gsf-company': 'Acme',
            'gsf-customer-id': '',
            'gsf-contact-name': 'Bob',
            'gsf-contact-email': '',
            'gsf-due-date': '2026-07-01',
            'gsf-design-num': '40445',
            'gsf-order-num': '90001',
            'gsf-prelim': '',
            'gsf-artwork-status': 'Mockup only',
            'gsf-approval-status': 'Customer reviewing proof',
            'gsf-color-mode': 'Match previous order',
            'gsf-underbase': 'Steve',
            'gsf-pms': '',
            'gsf-thread': '',
            'gsf-exact-text': 'should be ignored',
            'gsf-no-text': { checked: true },
            'gsf-prev-order': '',
            'gsf-prev-design': '',
            'gsf-keep-same': '',
            'gsf-change': '',
            'gsf-file-type': 'Logo from a previous order',
            'gsf-notes': ''
        }, ['DTG']);

        var payload = GarmentSubmitForm._buildPayloadForTest({
            companyName: 'Acme',
            aeName: 'Erik',
            aeEmail: 'erik@nwcustomapparel.com',
            salesRep: 'Erik',
            isRush: false,
            garmentRows: [{ style: 'PC61', colorName: 'White', catalogColor: 'White', swatch: '', image: '' }],
            artworkLocations: [{ placement: 'Full Front', width: '10', height: '', notes: '' }],
            uploaded: []
        });

        expect(payload.Request_Type).toBe('Mockup');
        expect(payload.Artwork_Status).toBe('Mockup only');
        expect(payload.Exact_Text).toBe('— No text in this design —');
        expect(payload.Underbase_Required).toBe('Steve');
        // No customer id → those fields omitted
        expect(payload.id_Customer).toBeUndefined();
        expect(payload.Shopwork_customer_number).toBeUndefined();
        // No uploads → no file slots
        expect(payload.File_Upload_One).toBeUndefined();
        // Single location only
        expect(JSON.parse(payload.Artwork_Locations)).toHaveLength(1);
    });

    test('Laser leatherette patch: specs ride in Artwork_Locations + NOTES, no new columns', () => {
        global.document = makeDoc({
            'gsf-company': 'Cascade Roofing', 'gsf-cust-num': '777', 'gsf-customer-id': '777',
            'gsf-contact-name': 'Pat Lee', 'gsf-contact-email': 'pat@cascade.com',
            'gsf-due-date': '2026-06-30', 'gsf-design-num': '53001', 'gsf-order-num': '91002',
            'gsf-prelim': '', 'gsf-artwork-status': 'New artwork from scratch',
            'gsf-approval-status': 'Not approved — Steve to create proof',
            'gsf-color-mode': 'Black only', 'gsf-underbase': '', 'gsf-pms': '', 'gsf-thread': '',
            'gsf-exact-text': 'CASCADE ROOFING', 'gsf-no-text': { checked: false },
            'gsf-prev-order': '', 'gsf-prev-design': '', 'gsf-keep-same': '', 'gsf-change': '',
            'gsf-file-type': 'Customer vector file (AI, EPS, PDF, SVG)', 'gsf-notes': 'Hat order',
            // Patch panel fields
            'gsf-patch-material': 'Black / Silver engrave',
            'gsf-patch-material-other': '',
            'gsf-patch-shape': 'Rounded Rectangle',
            'gsf-patch-width': '3', 'gsf-patch-height': '2.25',
            'gsf-patch-edge': 'Stitched (merrowed) border',
            'gsf-patch-attach': 'Heat press + tack stitch'
        }, ['Laser Leatherette Patch']);

        var payload = GarmentSubmitForm._buildPayloadForTest({
            companyName: 'Cascade Roofing', aeName: 'Erik', aeEmail: 'erik@nwcustomapparel.com',
            salesRep: 'Erik', isRush: false,
            garmentRows: [{ style: '112', colorName: 'Black/White', catalogColor: '', swatch: '', image: '' }],
            // Cap Front placement, size left blank → patch size must back-fill it.
            artworkLocations: [{ placement: 'Cap Front', width: '', height: '', notes: 'centered' }],
            uploaded: []
        });

        // Method flows through the existing decoration column → badge everywhere.
        expect(payload.Order_Type_Source).toBe('Laser Leatherette Patch');

        // Patch object rides inside the existing Artwork_Locations JSON column.
        var locs = JSON.parse(payload.Artwork_Locations);
        expect(locs).toHaveLength(1);
        expect(locs[0].placement).toBe('Cap Front');
        // Patch size back-fills the empty placement size.
        expect(locs[0].width).toBe('3');
        expect(locs[0].height).toBe('2.25');
        expect(locs[0].patch).toMatchObject({
            material: 'Black / Silver engrave',
            shape: 'Rounded Rectangle',
            width: '3', height: '2.25',
            edge: 'Stitched (merrowed) border',
            attach: 'Heat press + tack stitch'
        });

        // Readable block prepended to NOTES for non-JSON surfaces (galleries/email).
        expect(payload.NOTES).toContain('LASER LEATHERETTE PATCH');
        expect(payload.NOTES).toContain('Material: Black / Silver engrave');
        expect(payload.NOTES).toContain('Attachment: Heat press + tack stitch');
        expect(payload.NOTES).toContain('Hat order'); // original note preserved

        // No new top-level columns were introduced (ship-now, no Caspio change).
        expect(payload.Patch_Material).toBeUndefined();
        expect(payload.Patch_Specs).toBeUndefined();
    });

    test('Patch material "Other" uses the typed stock name', () => {
        global.document = makeDoc({
            'gsf-company': 'X', 'gsf-customer-id': '', 'gsf-contact-name': '', 'gsf-contact-email': '',
            'gsf-due-date': '', 'gsf-design-num': '', 'gsf-order-num': '', 'gsf-prelim': '',
            'gsf-artwork-status': 'New artwork from scratch', 'gsf-approval-status': '',
            'gsf-color-mode': '', 'gsf-underbase': '', 'gsf-pms': '', 'gsf-thread': '',
            'gsf-exact-text': '', 'gsf-no-text': { checked: false },
            'gsf-prev-order': '', 'gsf-prev-design': '', 'gsf-keep-same': '', 'gsf-change': '',
            'gsf-file-type': '', 'gsf-notes': '',
            'gsf-patch-material': 'Other — specify exact stock',
            'gsf-patch-material-other': 'JDS Rawhide laserable leatherette',
            'gsf-patch-shape': 'Shield / Crest', 'gsf-patch-width': '2.5', 'gsf-patch-height': '',
            'gsf-patch-edge': '', 'gsf-patch-attach': 'Sewn / stitched'
        }, ['Laser Leatherette Patch']);

        var payload = GarmentSubmitForm._buildPayloadForTest({
            companyName: 'X', aeName: 'Erik', aeEmail: 'e@e.com', salesRep: 'Erik', isRush: false,
            garmentRows: [{ style: '', colorName: '', swatch: '', image: '' }],
            artworkLocations: [{ placement: 'Cap Front', width: '2.5', height: '', notes: '' }],
            uploaded: []
        });

        var locs = JSON.parse(payload.Artwork_Locations);
        expect(locs[0].patch.material).toBe('JDS Rawhide laserable leatherette');
        // Empty patch fields are dropped, not stored as blanks.
        expect(locs[0].patch.edge).toBeUndefined();
        expect(locs[0].patch.height).toBeUndefined();
        expect(payload.NOTES).toContain('Material: JDS Rawhide laserable leatherette');
    });

    test('Empty/partial locations are filtered out of Artwork_Locations', () => {
        global.document = makeDoc({
            'gsf-company': 'X', 'gsf-customer-id': '', 'gsf-contact-name': '',
            'gsf-contact-email': '', 'gsf-due-date': '', 'gsf-design-num': '', 'gsf-order-num': '',
            'gsf-prelim': '', 'gsf-artwork-status': 'New artwork from scratch',
            'gsf-approval-status': '', 'gsf-color-mode': '', 'gsf-underbase': '',
            'gsf-pms': '', 'gsf-thread': '', 'gsf-exact-text': '', 'gsf-no-text': { checked: false },
            'gsf-prev-order': '', 'gsf-prev-design': '', 'gsf-keep-same': '', 'gsf-change': '',
            'gsf-file-type': '', 'gsf-notes': ''
        }, []);

        var payload = GarmentSubmitForm._buildPayloadForTest({
            companyName: 'X', aeName: 'Erik', aeEmail: 'e@e.com', salesRep: 'Erik', isRush: false,
            garmentRows: [{ style: '', colorName: '', swatch: '', image: '' }],
            artworkLocations: [
                { placement: 'Left Chest', width: '3', height: '', notes: '' },
                { placement: '', width: '', height: '', notes: '' } // empty → dropped
            ],
            uploaded: []
        });

        expect(JSON.parse(payload.Artwork_Locations)).toHaveLength(1);
        // Empty garment row → no style column written
        expect(payload.GarmentStyle).toBeUndefined();
        expect(payload.Order_Type_Source).toBe('');
    });
});
