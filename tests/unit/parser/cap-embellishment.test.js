/**
 * Cap Embellishment Parser Tests — 3D-EMB and Laser Patch recognition
 *
 * Tests that the parser correctly classifies 3D-EMB and Laser Patch
 * part numbers as cap embellishment services (not products).
 */
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

// Minimal ShopWorks order text with 3D-EMB line item
const ORDER_WITH_3D_EMB = `
**************************************************************************
Order #:140001
Company:Northwest Custom Apparel
Salesperson:Taneisha Williams
Phone:
Fax:
Email:taneisha@nwcustomapparel.com
**************************************************************************
Your Company Information
Customer #:9001
Company:Test Customer LLC
**************************************************************************
Order Information
Date Order Placed:2/20/2026
Req. Ship Date:3/1/2026
Drop Dead Date:
Purchase Order #:PO-3D
Terms:Net 15
Ordered by:John Test
Phone:555-123-4567
Email:john@testcustomer.com
**************************************************************************
Shipping Information
Ship Method:UPS Ground
Ship Address:Test Customer LLC, 123 Main St, Seattle, WA 98101-0000, United States
**************************************************************************
Design Information
Design #:40001 - Test Design
**************************************************************************
Items Purchased
Item 1 of 3
Part Number:C112_OSFA
Description:Port Authority Trucker Snapback Cap, Black
Unit Price:22.00
Line Item Price:264.00
Item Quantity:12
Adult:Quantity
XXXL (Other):12
Item 2 of 3
Part Number:3D-EMB
Description:3D Puff Embroidery Upcharge
Unit Price:2.00
Line Item Price:24.00
Item Quantity:1
Adult:Quantity
Small:1
Item 3 of 3
Part Number:DD
Description:Di. Embroider Garment
Unit Price:100.00
Line Item Price:100.00
Item Quantity:1
Adult:Quantity
Small:1
**************************************************************************
Order Summary:
Sub Total:388.00
Sales Tax:36.49
Total:424.49
`;

// Minimal ShopWorks order text with Laser Patch line item
const ORDER_WITH_LASER_PATCH = `
**************************************************************************
Order #:140002
Company:Northwest Custom Apparel
Salesperson:Nika Lao
Phone:
Fax:
Email:nika@nwcustomapparel.com
**************************************************************************
Your Company Information
Customer #:9002
Company:Laser Corp
**************************************************************************
Order Information
Date Order Placed:2/20/2026
Req. Ship Date:3/5/2026
Drop Dead Date:
Purchase Order #:PO-LP
Terms:COD
Ordered by:Jane Laser
Phone:555-987-6543
Email:jane@lasercorp.com
**************************************************************************
Shipping Information
Ship Method:UPS Ground
Ship Address:Laser Corp, 456 Oak Ave, Tacoma, WA 98402-0000, United States
**************************************************************************
Design Information
Design #:40002 - Laser Design
**************************************************************************
Items Purchased
Item 1 of 4
Part Number:112_OSFA
Description:Richardson 112 Trucker Cap, Black/White
Unit Price:18.00
Line Item Price:432.00
Item Quantity:24
Adult:Quantity
XXXL (Other):24
Item 2 of 4
Part Number:Laser Patch
Description:Laser Leatherette Patch Upcharge
Unit Price:3.50
Line Item Price:84.00
Item Quantity:1
Adult:Quantity
Small:1
Item 3 of 4
Part Number:GRT-50
Description:Garment Patch Setup Fee
Unit Price:50.00
Line Item Price:50.00
Item Quantity:1
Adult:Quantity
Small:1
Item 4 of 4
Part Number:DD
Description:Di. Embroider Garment
Unit Price:100.00
Line Item Price:100.00
Item Quantity:1
Adult:Quantity
Small:1
**************************************************************************
Order Summary:
Sub Total:666.00
Sales Tax:62.68
Total:728.68
`;

// Order with BOTH 3D-EMB and Laser Patch
const ORDER_WITH_BOTH = `
**************************************************************************
Order #:140003
Company:Northwest Custom Apparel
Salesperson:Taneisha Williams
Phone:
Fax:
Email:taneisha@nwcustomapparel.com
**************************************************************************
Your Company Information
Customer #:9003
Company:Both Types Inc
**************************************************************************
Order Information
Date Order Placed:2/20/2026
Req. Ship Date:3/10/2026
Drop Dead Date:
Purchase Order #:PO-BOTH
Terms:Net 30
Ordered by:Bob Both
Phone:555-000-0000
Email:bob@bothtypes.com
**************************************************************************
Shipping Information
Ship Method:Customer Pickup
Ship Address:Both Types Inc, 789 Pine Rd, Kent, WA 98032-0000, United States
**************************************************************************
Design Information
Design #:40003 - Combo Design
**************************************************************************
Items Purchased
Item 1 of 3
Part Number:C112_OSFA
Description:Port Authority Trucker Snapback Cap, Black
Unit Price:20.00
Line Item Price:960.00
Item Quantity:48
Adult:Quantity
XXXL (Other):48
Item 2 of 3
Part Number:3D-EMB
Description:3D Puff Embroidery Upcharge
Unit Price:2.00
Line Item Price:96.00
Item Quantity:1
Adult:Quantity
Small:1
Item 3 of 3
Part Number:Laser Patch
Description:Laser Leatherette Patch Upcharge
Unit Price:3.50
Line Item Price:168.00
Item Quantity:1
Adult:Quantity
Small:1
**************************************************************************
Order Summary:
Sub Total:1224.00
Sales Tax:115.18
Total:1339.18
`;

describe('Cap Embellishment: 3D-EMB Recognition', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(ORDER_WITH_3D_EMB);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('140001');
    });

    test('classifies 3D-EMB as cap embellishment (not a product)', () => {
        // C112_OSFA is the only real product; 3D-EMB and DD are services
        const productPNs = result.products.map(p => p.partNumber);
        expect(productPNs).toContain('C112');
        expect(productPNs).not.toContain('3D-EMB');
    });

    test('stores 3D-EMB in services.capEmbellishments', () => {
        expect(result.services.capEmbellishments).toBeDefined();
        expect(result.services.capEmbellishments.length).toBe(1);
    });

    test('3D-EMB has correct part number and type', () => {
        const ce = result.services.capEmbellishments[0];
        expect(ce.partNumber).toBe('3D-EMB');
        expect(ce.type).toBe('3d-puff');
    });

    test('3D-EMB has correct pricing data', () => {
        const ce = result.services.capEmbellishments[0];
        expect(ce.unitPrice).toBe(2.00);
    });

    test('digitizing (DD) still recognized', () => {
        expect(result.services.digitizing).toBe(true);
    });

    test('summary includes cap embellishment', () => {
        const summary = new ShopWorksImportParser().getSummary(result);
        expect(summary.services).toContain('Cap Embellishment: 3D-EMB');
    });
});

describe('Cap Embellishment: Laser Patch Recognition', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(ORDER_WITH_LASER_PATCH);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('140002');
    });

    test('classifies Laser Patch as cap embellishment (not a product)', () => {
        const productPNs = result.products.map(p => p.partNumber);
        expect(productPNs).not.toContain('Laser Patch');
    });

    test('stores Laser Patch in services.capEmbellishments', () => {
        expect(result.services.capEmbellishments.length).toBe(1);
    });

    test('Laser Patch has correct part number and type', () => {
        const ce = result.services.capEmbellishments[0];
        expect(ce.partNumber).toBe('Laser Patch');
        expect(ce.type).toBe('laser-patch');
    });

    test('Laser Patch has correct pricing data', () => {
        const ce = result.services.capEmbellishments[0];
        expect(ce.unitPrice).toBe(3.50);
    });

    test('GRT-50 patch setup still recognized', () => {
        expect(result.services.patchSetup).toBe(true);
    });

    test('digitizing (DD) still recognized', () => {
        expect(result.services.digitizing).toBe(true);
    });

    test('summary includes cap embellishment', () => {
        const summary = new ShopWorksImportParser().getSummary(result);
        expect(summary.services).toContain('Cap Embellishment: Laser Patch');
    });
});

describe('Cap Embellishment: Both 3D-EMB and Laser Patch', () => {
    let result;
    beforeAll(() => {
        result = new ShopWorksImportParser().parse(ORDER_WITH_BOTH);
    });

    test('parses order ID', () => {
        expect(result.orderId).toBe('140003');
    });

    test('classifies both as cap embellishments', () => {
        expect(result.services.capEmbellishments.length).toBe(2);
    });

    test('first is 3D-EMB', () => {
        expect(result.services.capEmbellishments[0].partNumber).toBe('3D-EMB');
        expect(result.services.capEmbellishments[0].type).toBe('3d-puff');
    });

    test('second is Laser Patch', () => {
        expect(result.services.capEmbellishments[1].partNumber).toBe('Laser Patch');
        expect(result.services.capEmbellishments[1].type).toBe('laser-patch');
    });

    test('only product is C112 (no embellishments as products)', () => {
        const productPNs = result.products.map(p => p.partNumber);
        expect(productPNs).toEqual(['C112']);
    });

    test('summary lists both cap embellishments', () => {
        const summary = new ShopWorksImportParser().getSummary(result);
        expect(summary.services).toContain('Cap Embellishment: 3D-EMB, Laser Patch');
    });
});
