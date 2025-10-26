# ShopWorks EDP - Order Block Field Reference

**File:** `memory/edp/ORDER_BLOCK.md`
**Last Updated:** 2025-10-26
**Part of:** [ShopWorks EDP Integration](../SHOPWORKS_EDP_INTEGRATION.md)

---

## Overview

The **Order Block** contains 44 fields organized into 6 SubBlocks that define order identification, details, dates, tax settings, shipping information, and department-specific notes.

**Status:** PARTIALLY IMPLEMENTED - READY FOR FULL IMPLEMENTATION

**🔄 IMPORTANT:** This Order Block structure is **SHARED across ALL quote builders**
- ✅ Screen Print Quote Builder
- ✅ DTG Quote Builder
- ✅ Embroidery Quote Builder
- ✅ Cap Embroidery Quote Builder
- ✅ All future quote builders

**What changes between quote builders:**
- `id_OrderType` value (13 for Screen Print, 15 for DTG, 17 for Embroidery, etc.)
- `ExtSource` identifier ("SP Quote", "DTG Quote", "EMB Quote", etc.)
- Notes content (art/production instructions are method-specific)

**What stays the same across ALL quote builders:**
- All field names and structure
- All address fields
- All date fields and formats
- Payment terms, sales tax, shipping fields

---

## Order Block Structure (44 Total Fields)

The Order Block in ShopWorks OnSite 7 uses a SubBlock architecture to organize order-related fields.

**SubBlock Overview:**
1. **ID SubBlock** (4 fields) - External identification and order type
2. **Details SubBlock** (8 fields) - Order details, terms, and settings
3. **Dates SubBlock** (3 fields) - Order dates and deadlines
4. **Sales Tax SubBlock** (10 fields) - Tax calculation and overrides
5. **Shipping SubBlock** (11 fields) - Shipping address and method
6. **Notes SubBlock** (7 fields) - Department-specific instructions

---

## SubBlock 1: ID SubBlock (4 fields)

**Purpose:** External order identification and order type classification

```javascript
// OnSite 7 Field Names
ExtOrderID              // External order/quote ID
ExtSource               // Source system identifier
date_External           // NEW in OnSite 7 - External system date
id_OrderType            // ShopWorks order type ID
```

### OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `ExtOrderID` | ExtOrderID | Quote ID from calculator |
| `ExtSource` | ExtSource | Source identifier |
| `date_External` | Date External | **NEW in OnSite 7** - External order date |
| `id_OrderType` | # Order Type 2 | Numeric order type ID |

### Use Cases

- `ExtOrderID` - Quote ID from calculator (e.g., "SP0127-1", "DTG0127-2", "EMB0127-3")
- `ExtSource` - Source identifier (e.g., "SP Quote", "DTG Quote", "EMB Quote", "CAP Quote")
- `date_External` - External system order date (NEW in OnSite 7)
- `id_OrderType` - ShopWorks order type ID:
  - 13 = Screen Print
  - 15 = DTG (Direct-to-Garment)
  - 17 = Embroidery
  - 18 = Cap Embroidery
  - *(Contact ShopWorks for complete list)*

**Currently Implemented:** ✅ All 4 fields

---

## SubBlock 2: Details SubBlock (8 fields)

**Purpose:** Order details, payment terms, customer service, and order status

```javascript
// OnSite 7 Field Names
CustomerPurchaseOrder   // Customer's PO number
TermsName               // Payment terms
CustomerServiceRep      // Assigned sales representative
CustomerType            // NEW in OnSite 7 - Customer classification
id_CompanyLocation      // NEW in OnSite 7 - Company location ID
id_SalesStatus          // NEW in OnSite 7 - Sales pipeline status
sts_CommishAllow        // NEW in OnSite 7 - Allow commission (Yes/No)
HoldOrderText           // NEW in OnSite 7 - Order hold reason/notes
```

### OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `CustomerPurchaseOrder` | # Purchase Order | Customer's PO number |
| `TermsName` | Terms | Payment terms |
| `CustomerServiceRep` | Salesperson | Sales rep (renamed in OnSite 7) |
| `CustomerType` | Customer Type | **NEW in OnSite 7** - Customer classification |
| `id_CompanyLocation` | Code To Location | **NEW in OnSite 7** - Location ID |
| `id_SalesStatus` | *(NEW)* | **NEW in OnSite 7** - Sales status |
| `sts_CommishAllow` | ? Commission Order | **NEW in OnSite 7** - Commission flag |
| `HoldOrderText` | *(NEW)* | **NEW in OnSite 7** - Hold reason |

### Use Cases

- `CustomerPurchaseOrder` - Customer's PO number for tracking (e.g., "Screenprint", "DTG Order", "Embroidery")
- `TermsName` - Payment terms: "Net 30", "Pay On Pickup", "COD", "Prepay"
- `CustomerServiceRep` - Assigned sales rep (e.g., "Ruth Nhong", "Nika Lao", "N/A")
- `CustomerType` - Customer classification (NEW in OnSite 7)
- `id_CompanyLocation` - Multi-location customers, branch/division tracking (NEW in OnSite 7)
- `id_SalesStatus` - Sales pipeline status ID (NEW in OnSite 7)
- `sts_CommishAllow` - Allow commission on this order: "Yes" or "No"
- `HoldOrderText` - Reason for order hold, special instructions (NEW in OnSite 7)

**Currently Implemented:** ✅ CustomerPurchaseOrder, TermsName, CustomerServiceRep (3 of 8 fields)

---

## SubBlock 3: Dates SubBlock (3 fields)

**Purpose:** Order dates, shipping dates, and deadlines

```javascript
// OnSite 7 Field Names
date_OrderPlaced          // Order placement date
date_OrderRequestedToShip // Requested ship date
date_OrderDropDead        // NEW in OnSite 7 - Absolute deadline date
```

### OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `date_OrderPlaced` | Date Order Placed | Order creation date |
| `date_OrderRequestedToShip` | Date To Ship | Customer requested ship date |
| `date_OrderDropDead` | Date Drop Dead | **NEW in OnSite 7** - Absolute deadline |

### Use Cases

- `date_OrderPlaced` - Today's date when quote is created (MM/DD/YYYY format, no time)
- `date_OrderRequestedToShip` - Customer requested delivery date (auto-calculated 2 weeks ahead, avoids weekends)
- `date_OrderDropDead` - Absolute deadline date, cannot ship after this (NEW in OnSite 7)

**Date Format:** MM/DD/YYYY (no time component, e.g., "01/27/2025")

**Currently Implemented:** ✅ date_OrderPlaced, date_OrderRequestedToShip (2 of 3 fields)

---

## SubBlock 4: Sales Tax SubBlock (10 fields)

**Purpose:** Sales tax calculation, exemptions, and GL account mapping

```javascript
// OnSite 7 Field Names (Tax Settings)
sts_Order_SalesTax_Override // NEW in OnSite 7 - Override customer tax settings
sts_ApplySalesTax01         // NEW in OnSite 7 - Apply tax jurisdiction 1
sts_ApplySalesTax02         // NEW in OnSite 7 - Apply tax jurisdiction 2
sts_ApplySalesTax03         // NEW in OnSite 7 - Apply tax jurisdiction 3
sts_ApplySalesTax04         // NEW in OnSite 7 - Apply tax jurisdiction 4

// GL Account Mapping
coa_AccountSalesTax01       // GL account for sales tax 1
coa_AccountSalesTax02       // GL account for sales tax 2
coa_AccountSalesTax03       // NEW in OnSite 7 - GL account for sales tax 3
coa_AccountSalesTax04       // NEW in OnSite 7 - GL account for sales tax 4

// Additional Tax Settings
sts_ShippingTaxable         // NEW in OnSite 7 - Charge tax on shipping (Yes/No)
```

### OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `sts_Order_SalesTax_Override` | *(NEW)* | **NEW in OnSite 7** - Override tax settings |
| `sts_ApplySalesTax01` | *(NEW)* | **NEW in OnSite 7** - Apply tax 1 |
| `sts_ApplySalesTax02` | *(NEW)* | **NEW in OnSite 7** - Apply tax 2 |
| `sts_ApplySalesTax03` | *(NEW)* | **NEW in OnSite 7** - Apply tax 3 |
| `sts_ApplySalesTax04` | *(NEW)* | **NEW in OnSite 7** - Apply tax 4 |
| `coa_AccountSalesTax01` | # Account Sales Tax 1 | GL account |
| `coa_AccountSalesTax02` | # Account Sales Tax 2 | GL account |
| `coa_AccountSalesTax03` | *(NEW)* | **NEW in OnSite 7** - GL account 3 |
| `coa_AccountSalesTax04` | *(NEW)* | **NEW in OnSite 7** - GL account 4 |
| `sts_ShippingTaxable` | *(NEW)* | **NEW in OnSite 7** - Tax shipping |

### Use Cases

- `sts_Order_SalesTax_Override` - Override customer's default tax settings for this order: "Yes" or "No"
- `sts_ApplySalesTax01-04` - Apply each tax jurisdiction (Yes/No) - supports up to 4 different taxes
- `coa_AccountSalesTax01-04` - GL account codes for each tax type for proper accounting
- `sts_ShippingTaxable` - Charge tax on shipping fees for this order: "Yes" or "No" (varies by state)

**Currently Implemented:** ❌ 0 of 10 fields (ready for implementation)

---

## SubBlock 5: Shipping SubBlock (11 fields)

**Purpose:** Shipping address, carrier method, and shipping charges

```javascript
// OnSite 7 Field Names (Shipping Address)
AddressDescription        // NEW in OnSite 7 - Address label/description
AddressCompany            // Company name for shipping
Address1                  // Street address line 1
Address2                  // Street address line 2
AddressCity               // City
AddressState              // State abbreviation
AddressZip                // ZIP/postal code
AddressCountry            // NEW in OnSite 7 - Country

// Shipping Method & Charges
ShipMethod                // Carrier/method
cur_Shipping              // Shipping charges amount

// Settings
sts_Order_ShipAddress_Add // NEW in OnSite 7 - Add address to customer (Yes/No)
```

### OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `AddressDescription` | *(NEW)* | **NEW in OnSite 7** - Address label |
| `AddressCompany` | Ship Company | Company name |
| `Address1` | Ship Address 1 | Street address |
| `Address2` | Ship Address 2 | Suite/unit |
| `AddressCity` | Ship City | City |
| `AddressState` | Ship State | State abbreviation |
| `AddressZip` | Ship Zip | ZIP code |
| `AddressCountry` | *(NEW)* | **NEW in OnSite 7** - Country |
| `ShipMethod` | Ship Via | Carrier method |
| `cur_Shipping` | $ Shipping | Shipping charges |
| `sts_Order_ShipAddress_Add` | *(NEW)* | **NEW in OnSite 7** - Add to address book |

### Use Cases

- `AddressDescription` - Label: "Shipping", "Delivery", "Will Call", "Main Office" (NEW in OnSite 7)
- Complete shipping address fields for delivery
- `AddressCountry` - International shipping support (default "USA") (NEW in OnSite 7)
- `ShipMethod` - Carrier/method: "UPS Ground", "FedEx", "USPS", "Will Call", "Customer Pickup"
- `cur_Shipping` - Shipping charges amount (decimal, e.g., "15.50")
- `sts_Order_ShipAddress_Add` - Add this address to customer's address book: "Yes" or "No"

**Currently Implemented:** ❌ 0 of 11 fields (ready for implementation)

---

## SubBlock 6: Notes SubBlock (7 fields)

**Purpose:** Department-specific instructions and notes

```javascript
// OnSite 7 Field Names
NotesToArt              // Art department instructions
NotesToProduction       // Production setup instructions
NotesToReceiving        // Receiving department notes
NotesToPurchasing       // Purchasing department notes
NotesToShipping         // Shipping instructions
NotesToAccounting       // Billing/accounting notes
NotesToPurchasingSub    // NEW in OnSite 7 - Subcontractor purchasing notes
```

### OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `NotesToArt` | Notes To Art | Art instructions |
| `NotesToProduction` | Notes To Production | Production instructions |
| `NotesToReceiving` | Notes To Receiving | Receiving notes |
| `NotesToPurchasing` | Notes to Purchasing | Purchasing notes |
| `NotesToShipping` | Notes to Shipping | Shipping instructions |
| `NotesToAccounting` | Notes To Accounts Receivable | Accounting notes |
| `NotesToPurchasingSub` | *(NEW)* | **NEW in OnSite 7** - Subcontractor notes |

### Use Cases

- `NotesToArt` - Art department instructions (colors, locations, special effects, artwork files)
- `NotesToProduction` - Production setup instructions (equipment, materials, special handling, setup details)
- `NotesToReceiving` - Receiving instructions (inspection requirements, storage)
- `NotesToPurchasing` - Purchasing department notes (special orders, vendor info)
- `NotesToShipping` - Shipping instructions (packaging, delivery notes, special handling)
- `NotesToAccounting` - Billing/accounting notes (payment terms, special billing)
- `NotesToPurchasingSub` - Subcontractor purchasing notes (NEW in OnSite 7)

**Currently Implemented:** ✅ NotesToArt, NotesToProduction (2 of 7 fields)

---

## Complete Implementation Example

**Full Order Block with All SubBlocks (Shared Across ALL Quote Builders):**

```javascript
// Order Block - Complete implementation
// This structure is IDENTICAL for Screen Print, DTG, Embroidery, Cap, etc.
edp += '---- Start Order ----\n';

// ===== SubBlock 1: ID =====
edp += `ExtOrderID>> ${quoteData.QuoteID}\n`;  // "SP0127-1", "DTG0127-2", etc.
edp += `ExtSource>> ${quoteData.QuoteSource}\n`;  // "SP Quote", "DTG Quote", etc.
edp += `date_External>> ${quoteData.ExternalDate || ''}\n`;
edp += `id_OrderType>> ${this.config.orderTypeId}\n`;  // 13, 15, 17, etc.

// ===== SubBlock 2: Details =====
edp += `CustomerPurchaseOrder>> ${quoteData.CustomerPO || quoteData.QuoteType}\n`;
edp += `TermsName>> ${quoteData.PaymentTerms || 'Pay On Pickup'}\n`;
edp += `CustomerServiceRep>> ${quoteData.SalesRep || 'N/A'}\n`;
edp += `CustomerType>> ${quoteData.CustomerType || ''}\n`;
edp += `id_CompanyLocation>> ${quoteData.CompanyLocation || ''}\n`;
edp += `id_SalesStatus>> ${quoteData.SalesStatus || ''}\n`;
edp += `sts_CommishAllow>> ${quoteData.CommissionAllowed ? 'Yes' : 'No'}\n`;
edp += `HoldOrderText>> ${quoteData.HoldReason || ''}\n`;

// ===== SubBlock 3: Dates =====
edp += `date_OrderPlaced>> ${this.formatDate(new Date())}\n`;
edp += `date_OrderRequestedToShip>> ${this.calculateShipDate()}\n`;
edp += `date_OrderDropDead>> ${quoteData.DropDeadDate || ''}\n`;

// ===== SubBlock 4: Sales Tax =====
edp += `sts_Order_SalesTax_Override>> ${quoteData.TaxOverride ? 'Yes' : 'No'}\n`;
edp += `sts_ApplySalesTax01>> ${quoteData.ApplySalesTax ? 'Yes' : 'No'}\n`;
edp += `sts_ApplySalesTax02>> No\n`;
edp += `sts_ApplySalesTax03>> No\n`;
edp += `sts_ApplySalesTax04>> No\n`;
edp += `coa_AccountSalesTax01>> ${quoteData.SalesTaxAccount || ''}\n`;
edp += `coa_AccountSalesTax02>> \n`;
edp += `coa_AccountSalesTax03>> \n`;
edp += `coa_AccountSalesTax04>> \n`;
edp += `sts_ShippingTaxable>> ${quoteData.ShippingTaxable ? 'Yes' : 'No'}\n`;

// ===== SubBlock 5: Shipping =====
edp += `AddressDescription>> ${quoteData.ShippingAddressDesc || 'Shipping'}\n`;
edp += `AddressCompany>> ${quoteData.ShippingCompany || quoteData.CompanyName}\n`;
edp += `Address1>> ${quoteData.ShippingAddress1 || ''}\n`;
edp += `Address2>> ${quoteData.ShippingAddress2 || ''}\n`;
edp += `AddressCity>> ${quoteData.ShippingCity || ''}\n`;
edp += `AddressState>> ${quoteData.ShippingState || ''}\n`;
edp += `AddressZip>> ${quoteData.ShippingZip || ''}\n`;
edp += `AddressCountry>> ${quoteData.ShippingCountry || 'USA'}\n`;
edp += `ShipMethod>> ${quoteData.ShipMethod || 'Will Call'}\n`;
edp += `cur_Shipping>> ${quoteData.ShippingCharges || '0.00'}\n`;
edp += `sts_Order_ShipAddress_Add>> ${quoteData.AddShipAddress ? 'Yes' : 'No'}\n`;

// ===== SubBlock 6: Notes =====
// THESE ARE METHOD-SPECIFIC - Content changes, field names stay the same
edp += `NotesToArt>> ${this.generateArtNotes(quoteData)}\n`;  // Different per method
edp += `NotesToProduction>> ${this.generateProductionNotes(quoteData)}\n`;  // Different per method
edp += `NotesToReceiving>> ${quoteData.ReceivingNotes || ''}\n`;
edp += `NotesToPurchasing>> ${quoteData.PurchasingNotes || ''}\n`;
edp += `NotesToShipping>> ${quoteData.ShippingNotes || ''}\n`;
edp += `NotesToAccounting>> ${quoteData.AccountingNotes || ''}\n`;
edp += `NotesToPurchasingSub>> ${quoteData.SubcontractorNotes || ''}\n`;

edp += '---- End Order ----\n\n';
```

---

## Method-Specific Variations

**What Changes Between Quote Builders:**

```javascript
// ========================================
// Configuration per quote builder type
// ========================================

// Screen Print Quote Builder
const screenPrintConfig = {
    orderTypeId: 13,
    quoteSource: 'SP Quote',
    quotePrefix: 'SP',
    generateArtNotes: generateScreenPrintArtNotes,
    generateProductionNotes: generateScreenPrintProductionNotes
};

// DTG Quote Builder
const dtgConfig = {
    orderTypeId: 15,
    quoteSource: 'DTG Quote',
    quotePrefix: 'DTG',
    generateArtNotes: generateDTGArtNotes,
    generateProductionNotes: generateDTGProductionNotes
};

// Embroidery Quote Builder
const embroideryConfig = {
    orderTypeId: 17,
    quoteSource: 'EMB Quote',
    quotePrefix: 'EMB',
    generateArtNotes: generateEmbroideryArtNotes,
    generateProductionNotes: generateEmbroideryProductionNotes
};

// Cap Embroidery Quote Builder
const capConfig = {
    orderTypeId: 18,
    quoteSource: 'CAP Quote',
    quotePrefix: 'CAP',
    generateArtNotes: generateCapEmbroideryArtNotes,
    generateProductionNotes: generateCapEmbroideryProductionNotes
};

// ========================================
// What's SHARED across ALL quote builders
// ========================================
// ✅ All 44 Order Block field names
// ✅ All SubBlock structures
// ✅ Date formats (MM/DD/YYYY)
// ✅ Boolean formats (Yes/No)
// ✅ Address fields
// ✅ Payment terms
// ✅ Sales tax fields
// ✅ Shipping fields

// ========================================
// What's DIFFERENT per quote builder
// ========================================
// ❌ id_OrderType value (13, 15, 17, 18, etc.)
// ❌ ExtSource identifier ("SP Quote", "DTG Quote", etc.)
// ❌ NotesToArt content (method-specific instructions)
// ❌ NotesToProduction content (method-specific setup)
```

---

## Quote Builder Integration Examples

**Screen Print Quote Builder:**
```javascript
const quoteData = {
    QuoteID: 'SP0127-1',
    QuoteSource: 'SP Quote',
    QuoteType: 'Screenprint',
    SalesRep: 'Ruth Nhong',
    PaymentTerms: 'Pay On Pickup',

    // Shipping (same fields for all builders)
    ShippingAddress1: '123 Main St',
    ShippingCity: 'Seattle',
    ShippingState: 'WA',
    ShippingZip: '98101',
    ShipMethod: 'Will Call',

    // Notes (content is method-specific)
    // Generated by: generateScreenPrintArtNotes()
    // Generated by: generateScreenPrintProductionNotes()
};
```

**DTG Quote Builder (SAME STRUCTURE):**
```javascript
const quoteData = {
    QuoteID: 'DTG0127-1',  // Different prefix
    QuoteSource: 'DTG Quote',  // Different source
    QuoteType: 'Direct to Garment',
    SalesRep: 'Ruth Nhong',  // Same field
    PaymentTerms: 'Pay On Pickup',  // Same field

    // Shipping (IDENTICAL FIELDS)
    ShippingAddress1: '123 Main St',
    ShippingCity: 'Seattle',
    ShippingState: 'WA',
    ShippingZip: '98101',
    ShipMethod: 'Will Call',

    // Notes (different content, same field names)
    // Generated by: generateDTGArtNotes()
    // Generated by: generateDTGProductionNotes()
};
```

**Embroidery Quote Builder (SAME STRUCTURE):**
```javascript
const quoteData = {
    QuoteID: 'EMB0127-1',  // Different prefix
    QuoteSource: 'EMB Quote',  // Different source
    QuoteType: 'Embroidery',
    SalesRep: 'Ruth Nhong',  // Same field
    PaymentTerms: 'Pay On Pickup',  // Same field

    // ... ALL OTHER FIELDS IDENTICAL STRUCTURE
};
```

---

## Recommended Implementation Phases

**Phase 1: Essential Fields (All Quote Builders) - Immediate**
- ID SubBlock: All 4 fields ✅ (already implemented)
- Details SubBlock: CustomerPurchaseOrder, TermsName, CustomerServiceRep ✅ (already implemented)
- Dates SubBlock: date_OrderPlaced, date_OrderRequestedToShip ✅ (already implemented)
- Shipping SubBlock: Address fields (8 fields)
- Notes SubBlock: NotesToArt, NotesToProduction ✅ (already implemented)

**Phase 2: Enhanced Features (Week 1-2)**
- Details SubBlock: CustomerType, id_CompanyLocation
- Dates SubBlock: date_OrderDropDead
- Shipping SubBlock: ShipMethod, cur_Shipping, AddressDescription, AddressCountry
- Sales Tax SubBlock: sts_ApplySalesTax01, sts_ShippingTaxable
- Notes SubBlock: NotesToShipping

**Phase 3: Advanced Features (Future)**
- Details SubBlock: id_SalesStatus, sts_CommishAllow, HoldOrderText
- Sales Tax SubBlock: All tax override and multi-jurisdiction fields (10 fields)
- Shipping SubBlock: sts_Order_ShipAddress_Add
- Notes SubBlock: NotesToReceiving, NotesToPurchasing, NotesToAccounting, NotesToPurchasingSub

---

**For complete EDP integration documentation, see [ShopWorks EDP Integration Guide](../SHOPWORKS_EDP_INTEGRATION.md)**

**Related Blocks:**
- [Customer Block](CUSTOMER_BLOCK.md) - Customer information fields
- [Product Block](PRODUCT_BLOCK.md) - Product details and sizing
- [Design Block](DESIGN_BLOCK.md) - Design specifications
