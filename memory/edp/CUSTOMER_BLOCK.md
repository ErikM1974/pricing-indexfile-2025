# ShopWorks EDP - Customer Block Field Reference

**File Path:** `memory/edp/CUSTOMER_BLOCK.md`
**Purpose:** Complete Customer Block field specifications for ShopWorks OnSite 7 EDP integration
**Parent Guide:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)

---

## Overview

**Status:** NOT IMPLEMENTED - READY FOR IMPLEMENTATION

**OnSite Version:** OnSite 7 (upgraded from OnSite 6.1)

**Total Fields:** 44 fields organized into 6 SubBlocks

**Architecture:** Customer Block uses SubBlock organization in OnSite 7 (replaces flat structure from OnSite 6.1)

**Shared Across:** All quote builders (Screen Print, DTG, Embroidery, Cap)

---

## Customer Block Structure (44 Total Fields)

The Customer Block in ShopWorks OnSite 7 uses a SubBlock architecture to organize related fields.

**SubBlock Overview:**
1. **Details SubBlock** (6 fields) - Company identification and core info
2. **Address SubBlock** (8 fields) - Billing address information
3. **Sales Tax SubBlock** (10 fields) - Tax calculation and exemptions
4. **Price Calculator SubBlock** (3 fields) - Pricing and discount levels
5. **Profile SubBlock** (7 fields) - Customer classification and tracking
6. **Custom Fields SubBlock** (10 fields) - Flexible custom data storage

---

## SubBlock 1: Details SubBlock (6 fields)

**Purpose:** Core customer identification and business information

```javascript
// OnSite 7 Field Names
ExtCustomerID         // External customer ID
id_Customer           // ShopWorks customer ID (required)
Company               // Company name
id_CompanyLocation    // NEW in OnSite 7 - Company location/branch ID
Terms                 // NEW in OnSite 7 - Payment terms
WebsiteURL            // NEW in OnSite 7 - Customer website
EmailMain             // NEW in OnSite 7 - Primary business email
```

**OnSite 6.1 → OnSite 7 Field Mapping:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `ExtCustomerID` | ExtCustID | Standard field |
| `id_Customer` | # Customer | Required, numeric ID |
| `Company` | Company | Standard field |
| `id_CompanyLocation` | *(NEW)* | **New in OnSite 7** - Multi-location support |
| `Terms` | *(NEW)* | **New in OnSite 7** - Payment terms |
| `WebsiteURL` | *(NEW)* | **New in OnSite 7** - Customer website |
| `EmailMain` | *(NEW)* | **New in OnSite 7** - Primary business email |

**Use Cases:**
- `id_CompanyLocation` - Track multi-location customers (branches, divisions, warehouses)
- `Terms` - Payment terms: "Net 30", "Net 60", "COD", "Prepay", "Credit Card"
- `WebsiteURL` - Customer's website for reference/verification
- `EmailMain` - Primary business email (may differ from contact person email)

---

## SubBlock 2: Address SubBlock (8 fields)

**Purpose:** Customer billing address information

```javascript
// OnSite 7 Field Names
AddressDescription    // NEW in OnSite 7 - Address label/description
AddressCompany        // Company name for this address
Address1              // Street address line 1
Address2              // Street address line 2 (suite/unit)
AddressCity           // City
AddressState          // State abbreviation
AddressZip            // ZIP/postal code
AddressCountry        // NEW in OnSite 7 - Country
```

**OnSite 6.1 → OnSite 7 Field Mapping:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `AddressDescription` | *(NEW)* | **New in OnSite 7** - "Billing", "Main Office", etc. |
| `AddressCompany` | Bill Company | Standard field |
| `Address1` | Bill Address 1 | Standard field |
| `Address2` | Bill Address 2 | Standard field |
| `AddressCity` | Bill City | Standard field |
| `AddressState` | Bill State | Standard field |
| `AddressZip` | BillZip | Standard field |
| `AddressCountry` | *(NEW)* | **New in OnSite 7** - International customers |

**Use Cases:**
- `AddressDescription` - Label for address: "Billing", "Headquarters", "Main Office"
- `AddressCountry` - International customers (default "USA" for domestic)

---

## SubBlock 3: Sales Tax SubBlock (10 fields)

**Purpose:** Sales tax calculation, exemptions, and GL account mapping

```javascript
// OnSite 7 Field Names (Tax Application)
sts_ApplySalesTax01   // Apply sales tax jurisdiction 1 (Yes/No)
sts_ApplySalesTax02   // Apply sales tax jurisdiction 2 (Yes/No)
sts_ApplySalesTax03   // Apply sales tax jurisdiction 3 (Yes/No)
sts_ApplySalesTax04   // Apply sales tax jurisdiction 4 (Yes/No)

// GL Account Mapping
coa_AccountSalesTax01 // GL account for sales tax 1
coa_AccountSalesTax02 // GL account for sales tax 2
coa_AccountSalesTax03 // NEW in OnSite 7 - GL account for sales tax 3
coa_AccountSalesTax04 // NEW in OnSite 7 - GL account for sales tax 4

// Additional Tax Settings
sts_ShippingTaxable   // NEW in OnSite 7 - Charge tax on shipping (Yes/No)
TaxExemptNumber       // Tax exemption certificate number
```

**OnSite 6.1 → OnSite 7 Field Mapping:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `sts_ApplySalesTax01` | ? Pay Sales Tax | Boolean field |
| `sts_ApplySalesTax02` | ? Pay Sales Tax | Boolean field |
| `sts_ApplySalesTax03` | ? Pay Sales Tax | Boolean field |
| `sts_ApplySalesTax04` | ? Pay Sales Tax | Boolean field |
| `coa_AccountSalesTax01` | # Account Sales Tax 1 | GL account reference |
| `coa_AccountSalesTax02` | # Account Sales Tax 2 | GL account reference |
| `coa_AccountSalesTax03` | *(NEW)* | **New in OnSite 7** - Third tax jurisdiction |
| `coa_AccountSalesTax04` | *(NEW)* | **New in OnSite 7** - Fourth tax jurisdiction |
| `sts_ShippingTaxable` | *(NEW)* | **New in OnSite 7** - Tax shipping charges |
| `TaxExemptNumber` | Tax Exempt # | Standard field |

**Use Cases:**
- Support for up to **4 different tax jurisdictions** (city, county, state, special district)
- `sts_ShippingTaxable` - Whether to charge tax on shipping fees (varies by state)
- `TaxExemptNumber` - Store tax exemption certificate number for resellers/nonprofits
- `coa_AccountSalesTax##` - Map to specific GL accounts for proper accounting

---

## SubBlock 4: Price Calculator SubBlock (3 fields)

**Purpose:** Customer pricing tiers and default price calculators

```javascript
// OnSite 7 Field Names
id_DiscountLevel      // NEW in OnSite 7 - Discount level/pricing tier
id_DefaultCalculator1 // NEW in OnSite 7 - Primary default pricing calculator
id_DefaultCalculator2 // NEW in OnSite 7 - Secondary default pricing calculator
```

**OnSite 6.1 → OnSite 7 Field Mapping:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `id_DiscountLevel` | *(NEW)* | **New in OnSite 7** - Pricing tier assignment |
| `id_DefaultCalculator1` | *(NEW)* | **New in OnSite 7** - Default pricing method |
| `id_DefaultCalculator2` | *(NEW)* | **New in OnSite 7** - Alternate pricing method |

**Use Cases:**
- `id_DiscountLevel` - Customer's pricing tier: "Retail", "Wholesale", "VIP", "Contract"
- `id_DefaultCalculator1` - Primary pricing method for this customer
- `id_DefaultCalculator2` - Alternate/backup pricing method

---

## SubBlock 5: Profile SubBlock (7 fields)

**Purpose:** Customer classification, sales tracking, and business intelligence

```javascript
// OnSite 7 Field Names
CustomerServiceRep    // Assigned sales representative
CustomerType          // NEW in OnSite 7 - Customer classification
CustomerSource        // NEW in OnSite 7 - Lead source
ReferenceFrom         // NEW in OnSite 7 - Referral source
SICCode               // NEW in OnSite 7 - Standard Industrial Classification code
SICDescription        // NEW in OnSite 7 - SIC code description
n_EmployeeCount       // NEW in OnSite 7 - Company size (employee count)
```

**OnSite 6.1 → OnSite 7 Field Mapping:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `CustomerServiceRep` | Salesperson | **Renamed** in OnSite 7 |
| `CustomerType` | *(NEW)* | **New in OnSite 7** - Customer classification |
| `CustomerSource` | *(NEW)* | **New in OnSite 7** - Lead source tracking |
| `ReferenceFrom` | *(NEW)* | **New in OnSite 7** - Referral tracking |
| `SICCode` | *(NEW)* | **New in OnSite 7** - Industry classification |
| `SICDescription` | *(NEW)* | **New in OnSite 7** - Industry description |
| `n_EmployeeCount` | *(NEW)* | **New in OnSite 7** - Company size indicator |

**Use Cases:**
- `CustomerServiceRep` - Assigned sales rep for this account (replaces "Salesperson")
- `CustomerType` - "Retail", "Wholesale", "Corporate", "Government", "Nonprofit"
- `CustomerSource` - Lead source: "Referral", "Web", "Trade Show", "Cold Call"
- `ReferenceFrom` - Who referred this customer (tracking for commission/thank you)
- `SICCode` - Standard Industrial Classification for industry vertical tracking
- `n_EmployeeCount` - Company size for segmentation and targeting

---

## SubBlock 6: Custom Fields SubBlock (10 fields)

**Purpose:** Flexible custom data storage for customer-specific information

```javascript
// OnSite 7 Field Names (all NEW in OnSite 7)
CustomField01         // Custom field 1
CustomField02         // Custom field 2
CustomField03         // Custom field 3
CustomField04         // Custom field 4
CustomField05         // Custom field 5
CustomField06         // Custom field 6
CustomField07         // Custom field 7
CustomField08         // Custom field 8
CustomField09         // Custom field 9
CustomField10         // Custom field 10
```

**OnSite 6.1 → OnSite 7 Field Mapping:**

| OnSite 7 Field | OnSite 6.1 Field | Notes |
|----------------|------------------|-------|
| `CustomField01` - `CustomField10` | *(NEW)* | **All new in OnSite 7** - Flexible data storage |

**Use Cases:**
- Store customer-specific data that doesn't fit standard fields
- Examples: PO requirements, special instructions, account numbers, preferences
- Customizable labels in ShopWorks for each field
- Can be used for: Delivery instructions, special handling notes, internal notes

---

## Complete Implementation Example

**Full Customer Block with All SubBlocks:**

```javascript
// Customer Block - Complete implementation
edp += '---- Start Customer ----\n';

// ===== SubBlock 1: Details =====
edp += `ExtCustomerID>> ${quoteData.ExtCustomerID || ''}\n`;
edp += `id_Customer>> ${this.config.customerId}\n`;
edp += `Company>> ${quoteData.CompanyName || ''}\n`;
edp += `id_CompanyLocation>> ${quoteData.CompanyLocation || ''}\n`;
edp += `Terms>> ${quoteData.PaymentTerms || 'Net 30'}\n`;
edp += `WebsiteURL>> ${quoteData.WebsiteURL || ''}\n`;
edp += `EmailMain>> ${quoteData.CustomerEmail || ''}\n`;

// ===== SubBlock 2: Address =====
edp += `AddressDescription>> ${quoteData.AddressDescription || 'Billing'}\n`;
edp += `AddressCompany>> ${quoteData.CompanyName || ''}\n`;
edp += `Address1>> ${quoteData.BillingAddress1 || ''}\n`;
edp += `Address2>> ${quoteData.BillingAddress2 || ''}\n`;
edp += `AddressCity>> ${quoteData.BillingCity || ''}\n`;
edp += `AddressState>> ${quoteData.BillingState || ''}\n`;
edp += `AddressZip>> ${quoteData.BillingZip || ''}\n`;
edp += `AddressCountry>> ${quoteData.BillingCountry || 'USA'}\n`;

// ===== SubBlock 3: Sales Tax =====
edp += `sts_ApplySalesTax01>> ${quoteData.ApplySalesTax ? 'Yes' : 'No'}\n`;
edp += `sts_ApplySalesTax02>> No\n`;
edp += `sts_ApplySalesTax03>> No\n`;
edp += `sts_ApplySalesTax04>> No\n`;
edp += `coa_AccountSalesTax01>> ${quoteData.SalesTaxAccount || ''}\n`;
edp += `coa_AccountSalesTax02>> \n`;
edp += `coa_AccountSalesTax03>> \n`;
edp += `coa_AccountSalesTax04>> \n`;
edp += `sts_ShippingTaxable>> ${quoteData.ShippingTaxable ? 'Yes' : 'No'}\n`;
edp += `TaxExemptNumber>> ${quoteData.TaxExemptNumber || ''}\n`;

// ===== SubBlock 4: Price Calculator =====
edp += `id_DiscountLevel>> ${quoteData.DiscountLevel || ''}\n`;
edp += `id_DefaultCalculator1>> ${quoteData.DefaultCalculator || ''}\n`;
edp += `id_DefaultCalculator2>> \n`;

// ===== SubBlock 5: Profile =====
edp += `CustomerServiceRep>> ${quoteData.SalesRep || ''}\n`;
edp += `CustomerType>> ${quoteData.CustomerType || ''}\n`;
edp += `CustomerSource>> ${quoteData.CustomerSource || ''}\n`;
edp += `ReferenceFrom>> ${quoteData.ReferenceFrom || ''}\n`;
edp += `SICCode>> ${quoteData.SICCode || ''}\n`;
edp += `SICDescription>> ${quoteData.SICDescription || ''}\n`;
edp += `n_EmployeeCount>> ${quoteData.EmployeeCount || ''}\n`;

// ===== SubBlock 6: Custom Fields =====
edp += `CustomField01>> ${quoteData.CustomField01 || ''}\n`;
edp += `CustomField02>> ${quoteData.CustomField02 || ''}\n`;
edp += `CustomField03>> ${quoteData.CustomField03 || ''}\n`;
edp += `CustomField04>> ${quoteData.CustomField04 || ''}\n`;
edp += `CustomField05>> ${quoteData.CustomField05 || ''}\n`;
edp += `CustomField06>> ${quoteData.CustomField06 || ''}\n`;
edp += `CustomField07>> ${quoteData.CustomField07 || ''}\n`;
edp += `CustomField08>> ${quoteData.CustomField08 || ''}\n`;
edp += `CustomField09>> ${quoteData.CustomField09 || ''}\n`;
edp += `CustomField10>> ${quoteData.CustomField10 || ''}\n`;

edp += '---- End Customer ----\n\n';
```

---

## Quote Builder Integration Example

**Collect comprehensive customer data in quote builder forms:**

```javascript
// Build complete customer data object
const quoteData = {
    // SubBlock 1: Details
    ExtCustomerID: document.getElementById('ext-customer-id')?.value || '',
    CompanyName: document.getElementById('company-name')?.value || '',
    CompanyLocation: document.getElementById('company-location')?.value || '',
    PaymentTerms: document.getElementById('payment-terms')?.value || 'Net 30',
    WebsiteURL: document.getElementById('website-url')?.value || '',
    CustomerEmail: document.getElementById('customer-email')?.value || '',

    // SubBlock 2: Address
    AddressDescription: document.getElementById('address-description')?.value || 'Billing',
    BillingAddress1: document.getElementById('billing-address-1')?.value || '',
    BillingAddress2: document.getElementById('billing-address-2')?.value || '',
    BillingCity: document.getElementById('billing-city')?.value || '',
    BillingState: document.getElementById('billing-state')?.value || '',
    BillingZip: document.getElementById('billing-zip')?.value || '',
    BillingCountry: document.getElementById('billing-country')?.value || 'USA',

    // SubBlock 3: Sales Tax
    ApplySalesTax: document.getElementById('apply-sales-tax')?.checked || false,
    ShippingTaxable: document.getElementById('shipping-taxable')?.checked || false,
    TaxExemptNumber: document.getElementById('tax-exempt-number')?.value || '',
    SalesTaxAccount: document.getElementById('sales-tax-account')?.value || '',

    // SubBlock 4: Price Calculator
    DiscountLevel: document.getElementById('discount-level')?.value || '',
    DefaultCalculator: document.getElementById('default-calculator')?.value || '',

    // SubBlock 5: Profile
    SalesRep: document.getElementById('sales-rep')?.value || '',
    CustomerType: document.getElementById('customer-type')?.value || '',
    CustomerSource: document.getElementById('customer-source')?.value || '',
    ReferenceFrom: document.getElementById('reference-from')?.value || '',
    SICCode: document.getElementById('sic-code')?.value || '',
    SICDescription: document.getElementById('sic-description')?.value || '',
    EmployeeCount: document.getElementById('employee-count')?.value || '',

    // SubBlock 6: Custom Fields
    CustomField01: document.getElementById('custom-field-01')?.value || '',
    CustomField02: document.getElementById('custom-field-02')?.value || ''
    // ... additional custom fields as needed
};
```

---

## Recommended Implementation Phases

**Phase 1: Essential Fields (Immediate)**
- Details SubBlock: `Company`, `Terms`, `EmailMain`
- Address SubBlock: All 8 fields
- Profile SubBlock: `CustomerServiceRep`

**Phase 2: Enhanced Features (Week 1-2)**
- Sales Tax SubBlock: `sts_ApplySalesTax01`, `TaxExemptNumber`, `sts_ShippingTaxable`
- Profile SubBlock: `CustomerType`, `CustomerSource`
- Details SubBlock: `WebsiteURL`

**Phase 3: Advanced Features (Future)**
- Price Calculator SubBlock: All 3 fields
- Sales Tax SubBlock: Multiple tax jurisdictions (02-04)
- Profile SubBlock: `SICCode`, `SICDescription`, `n_EmployeeCount`
- Custom Fields SubBlock: As needed for specific use cases

---

## Related Files

- **Overview & Navigation:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)
- **Order Block:** [ORDER_BLOCK.md](ORDER_BLOCK.md)
- **Contact Block:** [CONTACT_BLOCK.md](CONTACT_BLOCK.md)
- **Design Block:** [DESIGN_BLOCK.md](DESIGN_BLOCK.md)
- **Product Block:** [PRODUCT_BLOCK.md](PRODUCT_BLOCK.md) - CRITICAL for CATALOG_COLOR
- **Payment Block:** [PAYMENT_BLOCK.md](PAYMENT_BLOCK.md)

---

**Last Updated:** 2025-10-26
**Version:** OnSite 7
**Status:** Ready for implementation
