# ShopWorks EDP - Contact Block Field Reference

**File Path:** `memory/edp/CONTACT_BLOCK.md`
**Purpose:** Complete Contact Block field specifications for ShopWorks OnSite 7 EDP integration
**Parent Guide:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)

---

## Overview

**Status:** NOT IMPLEMENTED - READY FOR IMPLEMENTATION

**OnSite Version:** OnSite 7 (upgraded from OnSite 6.1)

**Total Fields:** 10 fields (no SubBlocks - simpler structure)

**Shared Across:** All quote builders (Screen Print, DTG, Embroidery, Cap)

**Use Case:** Track contact person information for each customer (purchasing, receiving, accounts payable, production coordination)

---

## Contact Block Structure (10 Total Fields)

The Contact Block in ShopWorks OnSite 7 does not use SubBlocks - it's a flat structure of 10 fields.

**Field Categories:**
1. **Customer Link** (1 field) - Links contact to customer record
2. **Contact Information** (7 fields) - Name, department, title, phone, fax, email
3. **Contact Preferences** (2 fields) - Email preferences and add contact flag

---

## OnSite 7 Contact Block Fields

```javascript
// Contact Information (OnSite 7 field names)
id_Customer          // Links to Customer block (required)
NameFirst            // Contact first name
NameLast             // Contact last name
Department           // NEW in OnSite 7 - Department/division
Title                // Job title
Phone                // Primary phone number
Fax                  // Fax number
Email                // Email address

// Contact Preferences (boolean fields)
sts_EnableBulkEmail  // "? Receive Email" - opt-in for bulk emails (Yes/No)
sts_Contact_Add      // "? Add Contact" - flag to add contact (Yes/No)
```

---

## OnSite 6.1 → OnSite 7 Field Mapping

| OnSite 7 Field Name | OnSite 6.1 Field Name | Notes |
|---------------------|----------------------|-------|
| `NameFirst` | Contact First Name | Standard field |
| `NameLast` | Contact Last Name | Standard field |
| `Department` | *(NEW - no equivalent)* | **New in OnSite 7** |
| `Title` | Contact Title | Standard field |
| `Phone` | Contact Phone | Standard field |
| *(deprecated)* | Secondary_Phone | **Removed in OnSite 7** |
| `Fax` | Contact Fax | Standard field |
| `Email` | Contact Email | Standard field |
| `sts_EnableBulkEmail` | ? Receive Email | Boolean/checkbox field |
| `sts_Contact_Add` | ? Add Contact | Boolean/checkbox field |

---

## Field Naming Notes

**OnSite 6.1 Conventions:**
- **`?` prefix**: Indicates checkbox/boolean fields (e.g., "? Receive Email")

**OnSite 7 Conventions:**
- **`sts_` prefix**: Standard prefix for status/boolean fields (replaces "?" prefix)

**Key Changes:**
- **Department**: New field in OnSite 7 for organizational structure tracking
- **Secondary_Phone**: Existed in OnSite 6.1 but deprecated in OnSite 7

---

## Use Cases

**Multiple Contacts Per Customer:**
Organizations typically have different contacts for different purposes:
- **Purchasing Contact:** Person who places orders
- **Receiving Contact:** Warehouse/dock personnel
- **Accounts Payable:** Billing and payment contact
- **Production Coordinator:** Technical specs and approval contact

**Department Field:**
The new `Department` field in OnSite 7 helps track which department or division the contact belongs to:
- "Purchasing"
- "Receiving"
- "Accounting"
- "Production"
- "Marketing"

---

## Complete Implementation Example

**Full Contact Block:**

```javascript
// Add Contact Block after Customer Block:
edp += '---- Start Contact ----\n';
edp += `id_Customer>> ${this.config.customerId}\n`;
edp += `NameFirst>> ${quoteData.ContactFirstName || ''}\n`;
edp += `NameLast>> ${quoteData.ContactLastName || ''}\n`;
edp += `Department>> ${quoteData.ContactDepartment || ''}\n`;  // NEW in OnSite 7
edp += `Title>> ${quoteData.ContactTitle || ''}\n`;
edp += `Phone>> ${quoteData.Phone || ''}\n`;
edp += `Fax>> ${quoteData.ContactFax || ''}\n`;
edp += `Email>> ${quoteData.CustomerEmail || ''}\n`;
edp += `sts_EnableBulkEmail>> ${quoteData.ReceiveEmail ? 'Yes' : 'No'}\n`;
edp += `sts_Contact_Add>> Yes\n`;  // Default to Yes for new contacts
edp += '---- End Contact ----\n\n';
```

---

## Quote Builder Integration Example

**Collect contact information in quote builder form:**

```javascript
// Collect contact information in quote builder form:
const quoteData = {
    // ... other fields from Order and Customer blocks

    // Contact Block fields
    ContactFirstName: document.getElementById('contact-first-name')?.value || '',
    ContactLastName: document.getElementById('contact-last-name')?.value || '',
    ContactDepartment: document.getElementById('contact-department')?.value || '',
    ContactTitle: document.getElementById('contact-title')?.value || '',
    Phone: document.getElementById('customer-phone')?.value || '',
    ContactFax: document.getElementById('contact-fax')?.value || '',
    CustomerEmail: document.getElementById('customer-email')?.value || '',
    ReceiveEmail: document.getElementById('receive-email')?.checked || false
};
```

---

## HTML Form Example

**Contact information form section:**

```html
<!-- Contact Information Section -->
<div class="contact-info-section">
    <h3>Contact Information</h3>

    <div class="form-row">
        <div class="form-group">
            <label for="contact-first-name">First Name</label>
            <input type="text" id="contact-first-name" required>
        </div>
        <div class="form-group">
            <label for="contact-last-name">Last Name</label>
            <input type="text" id="contact-last-name" required>
        </div>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="contact-department">Department (OnSite 7 Only)</label>
            <input type="text" id="contact-department"
                   placeholder="e.g., Purchasing, Receiving">
        </div>
        <div class="form-group">
            <label for="contact-title">Job Title</label>
            <input type="text" id="contact-title">
        </div>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="customer-phone">Phone</label>
            <input type="tel" id="customer-phone" required>
        </div>
        <div class="form-group">
            <label for="contact-fax">Fax</label>
            <input type="tel" id="contact-fax">
        </div>
    </div>

    <div class="form-group">
        <label for="customer-email">Email</label>
        <input type="email" id="customer-email" required>
    </div>

    <div class="form-group">
        <label>
            <input type="checkbox" id="receive-email" checked>
            Allow bulk email communications
        </label>
    </div>
</div>
```

---

## Field Validation

**Required Fields:**
- `id_Customer` - Always required (links contact to customer)
- `NameFirst` - Contact's first name (recommended)
- `NameLast` - Contact's last name (recommended)
- `Email` - Contact's email address (recommended for communications)

**Optional Fields:**
- `Department` - NEW in OnSite 7, useful for larger organizations
- `Title` - Job title/position
- `Phone` - Phone number
- `Fax` - Fax number (less common now)

**Boolean Fields:**
- `sts_EnableBulkEmail` - Defaults to "No" if not specified
- `sts_Contact_Add` - Should default to "Yes" for new contacts

---

## Recommended Implementation Phases

**Phase 1: Essential Fields (Immediate)**
- `id_Customer` - Link to customer record
- `NameFirst` - Contact first name
- `NameLast` - Contact last name
- `Email` - Contact email
- `Phone` - Contact phone
- `sts_Contact_Add` - Default to "Yes"

**Phase 2: Enhanced Features (Week 1-2)**
- `Department` - NEW OnSite 7 field for organizational structure
- `Title` - Job title/position
- `sts_EnableBulkEmail` - Email preference opt-in

**Phase 3: Advanced Features (Future)**
- `Fax` - Fax number (if needed by customer)
- Multiple contacts per customer (separate EDP exports)

---

## Multiple Contacts Pattern

**For customers with multiple contacts, create separate Contact blocks:**

```javascript
// Primary contact (purchasing)
edp += '---- Start Contact ----\n';
edp += `id_Customer>> ${this.config.customerId}\n`;
edp += `NameFirst>> John\n`;
edp += `NameLast>> Smith\n`;
edp += `Department>> Purchasing\n`;
edp += `Email>> john.smith@customer.com\n`;
edp += `sts_Contact_Add>> Yes\n`;
edp += '---- End Contact ----\n\n';

// Secondary contact (receiving)
edp += '---- Start Contact ----\n';
edp += `id_Customer>> ${this.config.customerId}\n`;
edp += `NameFirst>> Jane\n`;
edp += `NameLast>> Doe\n`;
edp += `Department>> Receiving\n`;
edp += `Email>> jane.doe@customer.com\n`;
edp += `sts_Contact_Add>> Yes\n`;
edp += '---- End Contact ----\n\n';
```

**Note:** For Phase 1 implementation, focus on single primary contact. Multiple contacts can be added in future phases.

---

## Related Files

- **Overview & Navigation:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)
- **Order Block:** [ORDER_BLOCK.md](ORDER_BLOCK.md)
- **Customer Block:** [CUSTOMER_BLOCK.md](CUSTOMER_BLOCK.md)
- **Design Block:** [DESIGN_BLOCK.md](DESIGN_BLOCK.md)
- **Product Block:** [PRODUCT_BLOCK.md](PRODUCT_BLOCK.md) - CRITICAL for CATALOG_COLOR
- **Payment Block:** [PAYMENT_BLOCK.md](PAYMENT_BLOCK.md)

---

**Last Updated:** 2025-10-26
**Version:** OnSite 7
**Status:** Ready for implementation
