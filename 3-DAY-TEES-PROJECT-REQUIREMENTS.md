# 3-Day Tees - Project Requirements Document

**Project Name:** 3-Day Tees Fast Turnaround Service
**Created:** 2025-11-08
**Version:** 1.0
**Status:** Planning Phase
**Target Launch:** TBD

---

## 📋 Executive Summary

Create a dedicated "3-Day Tees" page that allows customers to order PC54 direct-to-garment (DTG) printed t-shirts with a 72-hour turnaround time. The page will integrate with existing inventory systems, pricing services, and order management infrastructure while charging a 25% rush fee premium.

---

## 🎯 Project Objectives

### Primary Goals
1. **Fast Turnaround**: Enable 72-hour (3 business day) DTG t-shirt orders
2. **Self-Service**: Allow customers to configure, customize, and order without sales rep assistance
3. **Inventory Integration**: Show real-time stock levels from warehouse via ManageOrders API
4. **Automated Order Flow**: Orders automatically flow into ShopWorks for production
5. **Payment Processing**: Accept online payments via Stripe (Phase 2)

### Success Metrics
- Order placement without errors
- Accurate pricing calculation (regular DTG + 25%)
- Real-time inventory accuracy
- Orders successfully import into ShopWorks
- Payment processing (when implemented)

---

## 🏗️ Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    3-Day Tees Page                          │
│  /pages/3-day-tees.html (NEW)                              │
│                                                             │
│  User Journey:                                             │
│  1. View product (PC54)                                    │
│  2. Select color (inventory-based)                         │
│  3. Choose print location                                  │
│  4. Configure size breakdown                               │
│  5. Upload artwork file                                    │
│  6. Review pricing (DTG + 25%)                            │
│  7. Complete checkout                                      │
└────────────────────┬────────────────────────────────────────┘
                     ↓
        ┌────────────┴────────────────┐
        ↓                             ↓
┌───────────────────┐         ┌──────────────────┐
│  Pricing Engine   │         │  Inventory API   │
│  (Existing)       │         │  (Existing)      │
│                   │         │                  │
│  DTG Service      │         │  ManageOrders    │
│  + 25% Rush Fee   │         │  PULL API        │
└─────────┬─────────┘         └────────┬─────────┘
          ↓                            ↓
    ┌─────┴──────────────────────────┴─────┐
    ↓                                      ↓
┌──────────────────┐            ┌──────────────────┐
│  Order Creation  │            │  Payment (Phase 2)│
│  (Existing)      │            │  (Future)        │
│                  │            │                  │
│  ManageOrders    │            │  Stripe API      │
│  PUSH API        │            │                  │
└────────┬─────────┘            └──────────────────┘
         ↓
┌────────────────────┐
│  ShopWorks OnSite  │
│  (Production)      │
└────────────────────┘
```

---

## 📦 Existing Infrastructure (Reusable Components)

### ✅ Available Components

| Component | File Path | Purpose | Status |
|-----------|-----------|---------|--------|
| **DTG Pricing Service** | `/shared_components/js/dtg-pricing-service.js` | Calculate DTG pricing by location/quantity | ✅ Ready |
| **DTG Pricing Page** | `/calculators/dtg-pricing.html` | Location toggle UI, pricing display | ✅ Ready |
| **ManageOrders Inventory** | `/shared_components/js/sample-inventory-service.js` | Check real-time stock levels | ✅ Ready |
| **Sample Order Service** | `/shared_components/js/sample-order-service.js` | Create orders in ShopWorks | ✅ Ready |
| **File Upload System** | Implemented in `sample-order-service.js` | Upload artwork (20+ types, 20MB max) | ✅ Ready |
| **Product Images** | Caspio CDN | PC54 product images all colors | ✅ Available |
| **Size Breakdown UI** | `/pages/top-sellers-product.html` | Size selector grid | ✅ Ready |
| **Cart Drawer** | `/shared_components/js/cart-drawer.js` | Shopping cart UI | ✅ Ready |

### 📊 Available APIs

| API Endpoint | Purpose | Documentation |
|--------------|---------|---------------|
| `GET /api/pricing-bundle?method=DTG&styleNumber=PC54` | Get DTG pricing for PC54 | ✅ Active |
| `GET /api/sizes-by-style-color?styleNumber=PC54&color={color}` | Get available sizes by color | ✅ Active |
| `GET /api/manageorders/inventorylevels?PartNumber=PC54` | Get warehouse inventory | ✅ Active |
| `POST /api/manageorders/orders/create` | Create order in ShopWorks | ✅ Active |
| `POST /api/files/upload` | Upload artwork files | ✅ Active |

---

## 🎨 Feature Requirements

### Phase 1: Core Functionality (MVP)

#### 1.1 Product Display
- **Product**: PC54 only (Port & Company Core Cotton Tee)
- **Colors**: Display only colors with warehouse inventory > 0
- **Images**:
  - Product images from existing Caspio CDN
  - Color swatches for selection
  - Front/back/side views
- **Inventory Badge**: Real-time stock indicator per color
  - ✅ "In Stock" (green) - 50+ units available
  - ⚠️ "Low Stock" (yellow) - 10-49 units available
  - ❌ "Out of Stock" (red) - Less than 10 units

#### 1.2 Print Location Selection
**Reuse existing DTG location toggles:**
- Left Chest (LC)
- Full Front (FF)
- Full Back (FB)
- Jumbo Front (JF)
- Jumbo Back (JB)
- Combo locations (LC_FB, FF_FB, JF_JB, LC_JB)

**Display**: Modern toggle switches (from `/calculators/dtg-pricing.html`)

#### 1.3 Pricing Calculation
**Base Pricing**: Use DTG pricing service
**Rush Fee**: Add 25% to all prices
**Formula**:
```javascript
// Get base DTG price
const basePrice = dtgService.calculatePrice(quantity, location, size);

// Apply 25% rush fee
const rushFee = basePrice * 0.25;
const finalPrice = basePrice + rushFee;

// Round to nearest half dollar (ceiling)
return Math.ceil(finalPrice * 2) / 2;
```

**Price Display Components**:
- Unit price per size (with rush fee included)
- Subtotal by size
- Grand total
- Rush fee breakdown (show customer the 25% premium)

#### 1.4 Size Breakdown
**Reuse size selector from `top-sellers-product.html`:**
- Size grid: S, M, L, XL, 2XL, 3XL, 4XL
- Quantity input per size
- Real-time total quantity
- Real-time pricing update per size

**Size Upcharges** (from DTG pricing API):
- Standard sizes (S-XL): Base price
- 2XL: +$2.00
- 3XL: +$3.00
- 4XL: +$4.00

#### 1.5 Artwork Upload
**Reuse file upload from `sample-order-service.js`:**
- Accepted formats: AI, EPS, PDF, PNG, JPG, SVG (20+ types)
- Max file size: 20MB per file
- Multiple file upload: Yes (unlimited files)
- Automatic routing:
  - Artwork files → Designs block + Attachments block
  - Other files → Attachments block only

**Upload UI**:
- Drag-and-drop area
- File browser button
- Upload progress bar
- File preview thumbnails
- File type/size validation

#### 1.6 Order Form
**Customer Information** (required):
- First Name
- Last Name
- Email
- Phone
- Company Name

**Shipping Address** (required):
- Address Line 1
- Address Line 2 (optional)
- City
- State (dropdown)
- ZIP Code
- Country (default: USA)

**Order Notes** (optional):
- Special instructions
- Preferred delivery date

**Sales Rep Assignment**:
- Auto-assign based on customer autocomplete (if existing customer)
- Default: `sales@nwcustomapparel.com` (General Sales)

#### 1.7 Order Summary
**Display before submission**:
- Product: PC54 + color
- Print locations
- Size breakdown with quantities
- Unit price per size (with rush fee)
- Subtotal per size
- Grand total
- Estimated completion date (3 business days from order)
- Artwork file names

#### 1.8 Order Submission
**Process**:
1. Validate form fields
2. Upload artwork to Caspio
3. Create order via ManageOrders PUSH API
4. Display confirmation with order number
5. Send email confirmation to customer
6. Send notification to sales team

**Order Number Format**: `3DAY-{MMDD}-{sequence}`
- Example: `3DAY-1108-1` (First order on November 8)

**Email Notifications**:
- **To Customer**: Order confirmation, estimated completion, artwork received
- **To Sales Team**: New order alert with details
- **BCC**: erik@nwcustomapparel.com

---

### Phase 2: Payment Integration (Future)

#### 2.1 Stripe Integration
**Stripe Elements**:
- Credit card input
- Security validation
- 3D Secure support

**Payment Flow**:
1. Customer completes order form
2. Review pricing
3. Enter payment details (Stripe Elements)
4. Submit payment
5. On success → Create order in ShopWorks
6. On failure → Show error, allow retry

**Stripe Configuration**:
- Account: Northwest Custom Apparel Stripe account
- Payment types: Credit/Debit cards
- Currency: USD
- Capture: Immediate (not auth-only)

**Manual Processing Fallback** (Phase 1):
- Order created in ShopWorks
- Sales rep manually charges credit card via Square/phone
- Update order with payment confirmation

---

## 🎯 User Journey Flow

### Happy Path (Complete Order)

```
1. Landing → Click "3-Day Tees" button on homepage
   ↓
2. Product Page → View PC54 details, available colors
   ↓
3. Color Selection → Choose color with inventory available
   ↓
4. Size Selection → Configure size breakdown (S:2, M:5, L:3...)
   ↓
5. Print Location → Toggle locations (Left Chest, Full Back)
   ↓
6. Review Pricing → See real-time pricing with 25% rush fee
   ↓
7. Upload Artwork → Drag/drop or browse files
   ↓
8. Customer Info → Fill out contact/shipping details
   ↓
9. Order Review → Confirm all details, pricing, dates
   ↓
10. Submit Order → Create order in ShopWorks
    ↓
11. Confirmation → Order number, estimated completion date
    ↓
12. Email → Confirmation sent to customer + sales team
```

### Error Scenarios

| Error | Handling |
|-------|----------|
| **Out of stock** | Disable color option, show "Out of Stock" badge |
| **No artwork uploaded** | Block order submission, show error message |
| **Invalid file type** | Show validation error, list accepted types |
| **File too large** | Show file size limit, suggest compression |
| **API failure** | Show user-friendly error, log to console, retry option |
| **Payment failure** (Phase 2) | Show Stripe error, allow retry |
| **Network timeout** | Show loading state, retry with exponential backoff |

---

## 📁 File Structure

### New Files to Create

```
/pages/
  3-day-tees.html                    # Main page (NEW)
  3-day-tees.css                     # Page-specific styles (NEW)

/shared_components/js/
  3-day-tees-service.js              # Business logic (NEW)
  3-day-tees-pricing.js              # Pricing with 25% rush fee (NEW)

/shared_components/css/
  3-day-tees-components.css          # Reusable components (NEW)
```

### Updated Files

```
/index.html                          # Add "3-Day Tees" button
/server.js                           # Add route for new page
/ACTIVE_FILES.md                     # Document new files
```

---

## 🎨 UI/UX Design Requirements

### Design System
- **Colors**:
  - Primary: #4cb354 (green)
  - Secondary: #409a47 (dark green)
  - Accent: #fbbf24 (yellow for rush fee highlight)
  - Background: #f5f7fa (light gray)
  - Card: #ffffff (white)

- **Typography**:
  - Headers: Poppins, Bold
  - Body: Inter, Regular
  - Monospace: Courier New (order numbers)

- **Spacing**: 8px grid system

### Layout Approach
**Desktop** (> 768px):
```
┌─────────────────────────────────────────┐
│           Header + Navigation           │
├─────────────────┬───────────────────────┤
│                 │                       │
│  Product Images │  Configuration Panel  │
│  (60%)          │  (40%)               │
│                 │                       │
│  - Main image   │  - Color selector    │
│  - Thumbnails   │  - Size breakdown    │
│  - 360° view    │  - Print locations   │
│                 │  - Live pricing      │
│                 │                       │
├─────────────────┴───────────────────────┤
│         Order Form (Full Width)         │
├─────────────────────────────────────────┤
│         Footer                          │
└─────────────────────────────────────────┘
```

**Mobile** (< 768px):
```
┌─────────────────┐
│     Header      │
├─────────────────┤
│ Product Images  │
├─────────────────┤
│ Color Selector  │
├─────────────────┤
│ Size Breakdown  │
├─────────────────┤
│ Print Locations │
├─────────────────┤
│ Live Pricing    │
├─────────────────┤
│ Order Form      │
├─────────────────┤
│ Footer          │
└─────────────────┘
```

### Key UI Components

#### Rush Fee Indicator
```html
<div class="rush-fee-badge">
  <i class="fas fa-bolt"></i>
  72-Hour Rush Service
  <span class="rush-percentage">+25%</span>
</div>
```

#### Inventory Badge
```html
<div class="inventory-badge in-stock">
  <i class="fas fa-check-circle"></i>
  In Stock (127 units)
</div>
```

#### Price Breakdown
```html
<div class="price-breakdown">
  <div class="price-row">
    <span>Base DTG Price:</span>
    <span>$12.00</span>
  </div>
  <div class="price-row rush-fee">
    <span>72-Hour Rush Fee (25%):</span>
    <span>+$3.00</span>
  </div>
  <div class="price-row total">
    <span>Your Price:</span>
    <span>$15.00</span>
  </div>
</div>
```

---

## 🔌 API Integration Specifications

### 1. DTG Pricing API

**Endpoint**: `GET /api/pricing-bundle?method=DTG&styleNumber=PC54`

**Response Structure**:
```json
{
  "styleNumber": "PC54",
  "tiers": [
    {
      "TierLabel": "24-47",
      "MinQuantity": 24,
      "MaxQuantity": 47,
      "MarginDenominator": 0.6
    }
  ],
  "costs": [
    {
      "PrintLocationCode": "LC",
      "TierLabel": "24-47",
      "PrintCost": 5.00
    }
  ],
  "sizes": [
    { "size": "S", "price": 4.50 },
    { "size": "M", "price": 4.50 },
    { "size": "2XL", "price": 6.50 }
  ],
  "upcharges": {
    "2XL": 2.00,
    "3XL": 3.00
  }
}
```

**Usage**:
```javascript
const pricingService = new DTGPricingService();
const data = await pricingService.fetchBundledData('PC54');

// Calculate base price
const basePrice = calculateDTGPrice(data, quantity, location, size);

// Apply 25% rush fee
const rushPrice = basePrice * 1.25;
```

### 2. Inventory API

**Endpoint**: `GET /api/sizes-by-style-color?styleNumber=PC54&color={catalogColor}`

**Response Structure**:
```json
{
  "style": "PC54",
  "color": "Forest",
  "sizes": ["S", "M", "L", "XL", "2XL", "3XL"],
  "warehouses": [
    {
      "name": "Seattle, WA",
      "inventory": [50, 100, 150, 200, 75, 30],
      "total": 605
    }
  ],
  "sizeTotals": [50, 100, 150, 200, 75, 30],
  "grandTotal": 605
}
```

**Usage**:
```javascript
const inventoryService = new SampleInventoryService();
const inventory = await inventoryService.fetchInventoryLevels('PC54', 'Forest');

// Check if color is in stock
const inStock = inventory.grandTotal > 10;

// Get available sizes
const availableSizes = inventory.sizes;
```

### 3. Order Creation API

**Endpoint**: `POST /api/manageorders/orders/create`

**Request Structure**:
```json
{
  "orderNumber": "3DAY-1108-1",
  "orderDate": "2025-11-08",
  "dateNeeded": "2025-11-13",
  "salesRep": "erik@nwcustomapparel.com",
  "terms": "Net 30",
  "customer": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "253-555-1234",
    "company": "ABC Company"
  },
  "shipping": {
    "company": "ABC Company",
    "address1": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA",
    "method": "UPS Ground"
  },
  "lineItems": [
    {
      "partNumber": "PC54",
      "description": "Port & Company Core Cotton Tee",
      "color": "Forest",
      "size": "M",
      "quantity": 5,
      "price": 15.00
    }
  ],
  "designs": [
    {
      "name": "Logo - Left Chest",
      "externalKey": "upload_abc123.ai",
      "instructions": "Print on left chest, 3x3 inches"
    }
  ],
  "notes": [
    {
      "type": "Notes On Order",
      "text": "3-DAY RUSH - 72 Hour Turnaround Required"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "orderNumber": "NWCA-12345",
  "message": "Order created successfully"
}
```

### 4. File Upload API

**Endpoint**: `POST /api/files/upload`

**Request**: FormData with file
```javascript
const formData = new FormData();
formData.append('file', artworkFile);
formData.append('orderNumber', '3DAY-1108-1');

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData
});

const { externalKey, filename } = await response.json();
```

**Response**:
```json
{
  "success": true,
  "externalKey": "upload_abc123.ai",
  "filename": "customer-logo.ai",
  "size": 1536000,
  "type": "application/postscript"
}
```

---

## 🧪 Testing Requirements

### Unit Testing
- [ ] Pricing calculation with 25% rush fee
- [ ] Size upcharge application
- [ ] Inventory filtering (only show available colors)
- [ ] Order number generation (unique sequence)
- [ ] File upload validation (type, size)

### Integration Testing
- [ ] DTG pricing API response handling
- [ ] Inventory API response handling
- [ ] Order creation API success/failure
- [ ] File upload API success/failure
- [ ] Email notification delivery

### User Acceptance Testing
- [ ] Place complete order (all fields)
- [ ] Upload multiple artwork files
- [ ] Select color with low stock
- [ ] Select color out of stock (should be disabled)
- [ ] Calculate pricing for different quantities
- [ ] Calculate pricing for different locations
- [ ] Submit order without artwork (should fail)
- [ ] Submit order with invalid email (should fail)
- [ ] Verify order appears in ShopWorks
- [ ] Receive confirmation email

### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] Inventory check < 1 second
- [ ] Pricing calculation < 500ms
- [ ] File upload progress indicator
- [ ] Order submission < 5 seconds

### Browser/Device Testing
- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (iOS)
- [ ] Samsung Internet (Android)

---

## 📊 Data Models

### Order Data Structure
```javascript
const order3DayTees = {
  // Order identification
  orderNumber: '3DAY-1108-1',
  orderType: 'DTG',
  rushService: true,
  rushFeePercent: 25,

  // Product configuration
  product: {
    styleNumber: 'PC54',
    productName: 'Port & Company Core Cotton Tee',
    color: 'Forest',
    catalogColor: 'Forest', // For ShopWorks matching
    imageUrl: 'https://cdn.caspio.com/...'
  },

  // Print specifications
  printing: {
    method: 'DTG',
    locations: ['LC', 'FB'], // Left Chest + Full Back
    artworkFiles: [
      {
        filename: 'logo.ai',
        externalKey: 'upload_abc123',
        size: 1536000,
        type: 'application/postscript'
      }
    ]
  },

  // Size breakdown
  sizeBreakdown: {
    'S': { quantity: 2, unitPrice: 15.00, total: 30.00 },
    'M': { quantity: 5, unitPrice: 15.00, total: 75.00 },
    'L': { quantity: 3, unitPrice: 15.00, total: 45.00 },
    '2XL': { quantity: 1, unitPrice: 17.00, total: 17.00 }
  },

  // Pricing
  pricing: {
    baseDTGPrice: 12.00,
    rushFee: 3.00,
    unitPrice: 15.00,
    subtotal: 167.00,
    tax: 0, // If applicable
    grandTotal: 167.00
  },

  // Customer
  customer: {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@example.com',
    phone: '253-555-1234',
    company: 'ABC Company'
  },

  // Shipping
  shipping: {
    company: 'ABC Company',
    address1: '123 Main St',
    address2: '',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    country: 'USA',
    method: 'UPS Ground'
  },

  // Dates
  dates: {
    orderDate: '2025-11-08',
    dateNeeded: '2025-11-13', // 3 business days
    estimatedShip: '2025-11-13'
  },

  // Sales
  salesRep: 'erik@nwcustomapparel.com',
  terms: 'Net 30',

  // Notes
  notes: '3-DAY RUSH - 72 Hour Turnaround Required. Artwork: logo.ai'
};
```

---

## 🚀 Implementation Plan

### Sprint 1: Foundation (Week 1)
**Goal**: Basic page structure and product display

- [ ] Create `/pages/3-day-tees.html` with basic layout
- [ ] Create `/pages/3-day-tees.css` with design system
- [ ] Implement product display for PC54
- [ ] Add color selector UI
- [ ] Integrate inventory API to filter available colors
- [ ] Add "3-Day Tees" button to homepage
- [ ] Create route in server.js

**Deliverable**: Page loads, shows PC54, displays available colors

### Sprint 2: Pricing & Configuration (Week 2)
**Goal**: Interactive product configuration

- [ ] Create `/shared_components/js/3-day-tees-pricing.js`
- [ ] Integrate DTG pricing service
- [ ] Implement 25% rush fee calculation
- [ ] Add print location toggles
- [ ] Add size breakdown selector
- [ ] Implement real-time pricing updates
- [ ] Display rush fee breakdown

**Deliverable**: Users can configure product and see live pricing

### Sprint 3: Order Form & Upload (Week 3)
**Goal**: Complete order form with file upload

- [ ] Create `/shared_components/js/3-day-tees-service.js`
- [ ] Build customer information form
- [ ] Build shipping address form
- [ ] Implement artwork file upload
- [ ] Add file type/size validation
- [ ] Create order summary section
- [ ] Add form validation

**Deliverable**: Users can complete order form and upload files

### Sprint 4: Order Submission (Week 4)
**Goal**: Integration with ShopWorks

- [ ] Integrate ManageOrders PUSH API
- [ ] Implement order number generation
- [ ] Create order confirmation page
- [ ] Set up email notifications (customer + sales)
- [ ] Add error handling and retry logic
- [ ] Implement loading states

**Deliverable**: Orders successfully create in ShopWorks

### Sprint 5: Testing & Polish (Week 5)
**Goal**: Production-ready release

- [ ] Complete all unit tests
- [ ] Complete all integration tests
- [ ] User acceptance testing
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Mobile responsiveness
- [ ] Documentation updates

**Deliverable**: Page ready for production launch

### Sprint 6: Payment Integration (Future - Phase 2)
**Goal**: Stripe payment processing

- [ ] Set up Stripe account integration
- [ ] Implement Stripe Elements
- [ ] Add payment flow
- [ ] Handle success/failure scenarios
- [ ] Update order flow (payment before ShopWorks)
- [ ] Add payment receipt emails

**Deliverable**: Customers can pay online with credit card

---

## 🎯 Success Criteria

### Launch Readiness Checklist

**Functionality**:
- [ ] All colors with inventory display correctly
- [ ] Pricing calculates accurately (base + 25%)
- [ ] All print locations work
- [ ] Size breakdown totals correctly
- [ ] File upload accepts all required types
- [ ] Orders create in ShopWorks successfully
- [ ] Confirmation emails send to customer + sales

**Performance**:
- [ ] Page loads in < 3 seconds
- [ ] Inventory checks in < 1 second
- [ ] No JavaScript errors in console
- [ ] No network request failures

**User Experience**:
- [ ] Mobile-responsive on all devices
- [ ] Clear error messages
- [ ] Loading states for all async operations
- [ ] Success confirmation visible
- [ ] Intuitive workflow (no confusion)

**Business**:
- [ ] Orders appear in ShopWorks
- [ ] Pricing accurate (audited by Erik)
- [ ] Artwork files accessible in ShopWorks
- [ ] Sales team notified of new orders
- [ ] 72-hour turnaround feasible (production verification)

---

## 📝 Open Questions

1. **Inventory Threshold**: What's the minimum inventory to show "In Stock"?
   - Proposed: 10+ units = In Stock, 1-9 = Low Stock, 0 = Out of Stock

2. **Color Availability**: Which PC54 colors should we stock?
   - Proposed: Start with 5-10 top-selling colors, expand based on demand

3. **Minimum Order**: What's the minimum quantity for 3-Day Tees?
   - DTG typical minimum: 12 pieces (avoid LTM fee)
   - Proposed: 12 pieces minimum

4. **Pricing Tiers**: Do quantity tiers apply with rush fee?
   - Proposed: Yes, apply DTG tier pricing, then add 25%

5. **Payment Terms**: Net 30 or immediate payment?
   - Phase 1: Net 30 (manual CC processing)
   - Phase 2: Stripe (immediate payment)

6. **Artwork Requirements**: What file specifications?
   - Proposed: Same as regular DTG (vector preferred, 300 DPI minimum)

7. **Rush Fee Display**: How prominently should we show the 25% fee?
   - Proposed: Visible but not alarming, emphasize speed benefit

8. **Business Days**: Is 72 hours = 3 business days or 3 calendar days?
   - Proposed: 3 business days (M-F, excluding weekends/holidays)

9. **Order Cancellation**: Can customers cancel rush orders?
   - Proposed: No cancellations after artwork approval

10. **Stripe Account**: Which Stripe account to use?
    - Pending: Erik to provide Stripe credentials

---

## 📞 Stakeholders

- **Erik Mickelson** (Operations Manager): Project owner, final approval
- **Sales Team**: Input on customer needs, pricing
- **Production Team**: Verify 72-hour turnaround feasibility
- **Development Team** (Claude): Implementation

---

## 📚 References

### Existing Documentation
- [DTG Pricing Calculator Guide](/memory/PRICING_CALCULATOR_GUIDE.md)
- [ManageOrders PUSH API Guide](/memory/MANAGEORDERS_PUSH_WEBSTORE.md)
- [Sample Inventory Integration Guide](/memory/SAMPLE_INVENTORY_INTEGRATION_GUIDE.md)
- [Form Development Guide](/memory/manageorders-push/FORM_DEVELOPMENT_GUIDE.md)

### Existing Implementation Examples
- `/calculators/dtg-pricing.html` - DTG pricing calculator
- `/pages/top-sellers-product.html` - Product page with inventory
- `/pages/sample-cart.html` - Cart and checkout flow
- `/shared_components/js/sample-order-service.js` - Order creation

### API Documentation
- `/memory/api/cart-pricing-api.md` - Pricing bundle API
- `/memory/manageorders/API_REFERENCE.md` - ManageOrders API
- `/memory/CASPIO_API_CORE.md` - Caspio API core

---

## 📋 Next Steps

### Immediate Actions
1. **Review this document** with Erik for approval
2. **Answer open questions** to finalize scope
3. **Verify inventory** - which PC54 colors are stocked
4. **Confirm production capacity** - can we guarantee 72 hours?
5. **Set up Stripe account** (for Phase 2)

### After Approval
1. **Create Git branch**: `feature/3-day-tees`
2. **Start Sprint 1**: Page foundation and product display
3. **Daily standups**: Track progress and blockers
4. **Weekly demos**: Show progress to stakeholders

---

**Document Status**: ✅ Ready for Review
**Next Review**: After Erik approval
**Target Launch**: TBD based on sprint completion
