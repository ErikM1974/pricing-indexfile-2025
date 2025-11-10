# 3-Day Tees - Project Requirements Document

**Project Name:** 3-Day Tees Fast Turnaround Service
**Created:** 2025-11-08
**Last Updated:** 2025-11-08
**Version:** 2.0
**Status:** ✅ **Implementation Ready**
**Target Launch:** 4-Day Development (32 hours total)

---

## 📋 Executive Summary

Create a dedicated "3-Day Tees" page that allows customers to order PC54 direct-to-garment (DTG) printed t-shirts with a 72-hour turnaround time. The page will integrate with existing inventory systems, pricing services, and order management infrastructure while charging a 25% rush fee premium.

**Key Features:**
- **Product:** PC54 only (Port & Company Core Cotton Tee)
- **Colors:** 5 available (Black, Forest, Navy, White, Athletic Heather)
- **Inventory:** 7,364 total units across all colors
- **Pricing:** Standard DTG + 25% rush fee
- **Turnaround:** 72 hours from artwork approval
- **Payment:** Phase 1 (Manual), Phase 2 (Stripe)

---

## 🎯 Project Objectives

### Primary Goals
1. **Fast Turnaround**: Enable 72-hour (3 business day) DTG t-shirt orders
2. **Self-Service**: Allow customers to configure and order without sales rep assistance
3. **Inventory Integration**: Show real-time stock levels via ManageOrders API
4. **Automated Order Flow**: Orders automatically flow into ShopWorks for production
5. **Payment Processing**: Accept online payments via Stripe (Phase 2)

### Success Metrics
- Order placement without errors
- Accurate pricing calculation (regular DTG + 25%)
- Real-time inventory accuracy
- Orders successfully import into ShopWorks
- Payment processing (Phase 2)

---

## 🏗️ System Architecture

### High-Level Components

```
3-Day Tees Page → Pricing Engine (DTG + 25%) → Order Creation API
       ↓                    ↓                          ↓
 Inventory API      Rush Fee Calculator      ShopWorks OnSite
       ↓                    ↓                          ↓
 Stock Levels          Live Pricing            Production Queue
```

### Code Reuse Strategy

**75% of functionality already exists** in reusable components:
- DTG pricing service (90% reusable)
- Multi-SKU inventory system (100% reusable)
- Order creation API (95% reusable)
- Size breakdown UI (90% reusable)
- File upload system (100% reusable)

**Complete component inventory:** See [OVERVIEW.md](memory/3-day-tees/OVERVIEW.md#existing-infrastructure)

---

## 💰 Business Rules & Pricing

### Pricing Formula
**7-Step DTG Pricing + 25% Rush Fee:**
1. Base garment cost (from API)
2. Apply margin denominator
3. Add print cost by location/tier
4. Round to half-dollar (ceiling)
5. **Apply 25% rush fee** ← Key differentiator
6. Final rounding
7. Add size upcharges

**Complete pricing formula:** See [PRICING-FORMULA.md](memory/3-day-tees/PRICING-FORMULA.md)

### Fees & Charges
- **Less Than Minimum (LTM):** $75.00 for orders < 12 pieces
- **Sales Tax:** 10.1% (City of Milton, WA)
- **Shipping:** $30.00 flat rate (UPS Ground)
- **Size Upcharges:** 2XL (+$2.00), 3XL (+$3.00)

**Complete business logic:** See [BUSINESS-LOGIC.md](memory/3-day-tees/BUSINESS-LOGIC.md)

### Example Pricing (24 pieces, Left Chest)

```
Size Breakdown:
- S (4 pieces)  × $16.00 = $64.00
- M (8 pieces)  × $16.00 = $128.00
- L (8 pieces)  × $16.00 = $128.00
- XL (2 pieces) × $16.00 = $32.00
- 2XL (2 pieces) × $18.00 = $36.00  ← +$2 upcharge

Subtotal: $388.00
LTM Fee: $0.00 (24 pieces ≥ 12)
Sales Tax (10.1%): $39.19
Shipping: $30.00
───────────────────
Grand Total: $457.19
```

---

## 📦 Product & Inventory

### Fixed Product: PC54 Only

**Style:** Port & Company Core Cotton Tee
**Why PC54:** Reliable inventory, consistent DTG quality, industry-standard sizing

### Available Colors (Current Inventory)

| Color | Total Stock | Status |
|-------|------------|--------|
| **White** | 140 units | ✅ Good |
| **Jet Black** | 104 units | ⚠️ Low |
| **Ath Heather** | 32 units | ⚠️ Low |
| **Dk Hthr Grey** | 32 units | ⚠️ Low |
| **Navy** | 28 units | ⚠️ Low - Monitor |

**Total:** 336 units across all colors

### Multi-SKU Inventory Pattern

PC54 inventory is split across **3 separate SKUs** in ShopWorks:
- **PC54** → S, M, L, XL (standard sizes)
- **PC54_2X** → 2XL (upcharge size)
- **PC54_3X** → 3XL (upcharge size)

**Critical Implementation Detail:** Always use base part number "PC54" in orders. ShopWorks routes to correct SKU based on size field.

**Complete inventory integration guide:** See [INVENTORY-INTEGRATION.md](memory/3-day-tees/INVENTORY-INTEGRATION.md)

---

## 🔌 API Integration

### Required Endpoints (4 Total)

1. **DTG Pricing API**
   - `GET /api/pricing-bundle?method=DTG&styleNumber=PC54`
   - Returns: Tiers, costs, sizes, upcharges

2. **Inventory API**
   - `GET /api/sizes-by-style-color?styleNumber=PC54&color={color}`
   - Returns: Real-time stock levels by size

3. **Order Creation API**
   - `POST /api/manageorders/orders/create`
   - Creates order in ShopWorks OnSite

4. **File Upload API**
   - `POST /api/files/upload`
   - Uploads artwork (20+ types, 20MB max)

**Complete API specifications:** See [API-PATTERNS.md](memory/3-day-tees/API-PATTERNS.md)

---

## 🚀 Implementation Timeline

### 4-Day Development Plan (32 Hours)

**Day 1: Page Foundation** (8 hours)
- Create page structure
- Implement multi-SKU inventory
- Set up color selector with stock badges

**Day 2: Pricing Engine** (8 hours)
- Integrate DTG pricing service
- Implement 7-step formula + 25% rush fee
- Add size breakdown with live pricing

**Day 3: Checkout Flow** (8 hours)
- Build order form (customer info, shipping)
- Implement file upload
- Add order summary

**Day 4: Order Submission** (8 hours)
- Integrate ManageOrders PUSH API
- Add email notifications
- Testing and QA

**Complete timeline with checkpoints:** See [IMPLEMENTATION-TIMELINE.md](memory/3-day-tees/IMPLEMENTATION-TIMELINE.md)

---

## 📧 Order Management

### Order Number Format
**Pattern:** `3DT{MMDD}-{sequence}`
**Example:** `3DT1108-1` (First order on November 8)

### Email Notifications (via EmailJS)

**To Customer:**
- Order confirmation with quote ID
- Estimated completion date (3 business days)
- Artwork upload instructions
- Contact information

**To Sales Team:**
- New order alert (`sales@nwcustomapparel.com`)
- Complete order details
- Customer information
- Payment status (Phase 1: Pending, Phase 2: Paid)

**Admin BCC:** `erik@nwcustomapparel.com`

### Error Handling

If ManageOrders API fails:
1. Save order to quote database (fallback)
2. Display user-friendly error message
3. Email admin with error details
4. Sales rep manually enters order into ShopWorks

---

## 💳 Payment Processing

### Phase 1: Manual Payment (Launch)
- Customer completes order on website
- Sales rep calls customer to collect payment
- Payment processed via phone (credit card, check, wire)
- Production begins after payment confirmed

### Phase 2: Stripe Integration (Future)
- Customer enters credit card at checkout
- Payment processed immediately via Stripe
- Order created after successful payment
- Automatic confirmation and production start

**Complete payment workflow:** See [BUSINESS-LOGIC.md](memory/3-day-tees/BUSINESS-LOGIC.md#payment-terms)

---

## 📜 Terms & Conditions (Summary)

**Production & Shipping Timeline:**
- Ship within 3 business days from artwork approval
- Artwork must be approved by 12:00 PM PST to count toward same day
- Transit time NOT included in 3-day guarantee

**Shipping Details:**
- UPS Ground: $30.00 flat rate
- Transit time: 3-7 business days (not guaranteed)
- Expedited options available via phone (253-922-5793)

**Cancellation Policy:**
- Orders cannot be cancelled once production starts
- Rush orders prioritized and cannot be stopped

**Returns & Exchanges:**
- All sales final (custom printed merchandise)
- Production errors resolved within 5 business days

**Complete terms & conditions:** See [BUSINESS-LOGIC.md](memory/3-day-tees/BUSINESS-LOGIC.md#terms-conditions)

---

## 🧪 Testing Requirements

### Launch Readiness Checklist

**Functionality:**
- [ ] All 5 colors display with real-time inventory
- [ ] Pricing calculates accurately (7-step formula + 25%)
- [ ] All print locations work (LC, FF, FB, combos)
- [ ] Size breakdown totals correctly
- [ ] File upload accepts all required types
- [ ] Orders create in ShopWorks successfully
- [ ] Emails send to customer + sales team

**Performance:**
- [ ] Page loads in < 3 seconds
- [ ] Inventory checks in < 1 second
- [ ] No JavaScript errors
- [ ] Mobile responsive (375px minimum)

**Business:**
- [ ] Orders appear in ShopWorks within 5 minutes
- [ ] Pricing accurate to within $0.20
- [ ] 72-hour turnaround feasible
- [ ] Quote database fallback tested

**Complete testing procedures:** See [IMPLEMENTATION-TIMELINE.md](memory/3-day-tees/IMPLEMENTATION-TIMELINE.md#testing-procedures)

---

## 📊 Key Business Decisions

### Confirmed Parameters
- **LTM Fee:** $75.00 (orders < 12 pieces)
- **Sales Tax:** 10.1% (City of Milton, WA)
- **Shipping:** $30.00 flat rate
- **Order Format:** `3DT{MMDD}-{sequence}`
- **Support Phone:** 253-922-5793
- **Email Service:** EmailJS (existing)
- **Inventory Refresh:** 5-minute cache
- **Payment Phase 1:** Manual (via phone)
- **Payment Phase 2:** Stripe (online)

### Future Enhancements (Phase 3)
- Tax API integration (Avalara/TaxJar)
- Shipping API integration (UPS)
- Additional products (PC61, PC78, etc.)

**Complete business logic:** See [BUSINESS-LOGIC.md](memory/3-day-tees/BUSINESS-LOGIC.md)

---

## 📚 Complete Documentation

### Modular Documentation Files

All detailed specifications have been organized into focused, implementation-ready documents:

1. **[OVERVIEW.md](memory/3-day-tees/OVERVIEW.md)** - Architecture, 25 reusable components, multi-SKU patterns
2. **[PRICING-FORMULA.md](memory/3-day-tees/PRICING-FORMULA.md)** - Complete 7-step pricing + 25% rush fee
3. **[INVENTORY-INTEGRATION.md](memory/3-day-tees/INVENTORY-INTEGRATION.md)** - Multi-SKU architecture (PC54/PC54_2X/PC54_3X)
4. **[API-PATTERNS.md](memory/3-day-tees/API-PATTERNS.md)** - All 4 API endpoints with request/response examples
5. **[IMPLEMENTATION-TIMELINE.md](memory/3-day-tees/IMPLEMENTATION-TIMELINE.md)** - 4-day development plan with testing
6. **[BUSINESS-LOGIC.md](memory/3-day-tees/BUSINESS-LOGIC.md)** - Complete business rules, fees, terms

### Quick Navigation
- **Getting Started?** → [OVERVIEW.md](memory/3-day-tees/OVERVIEW.md)
- **Need Pricing Details?** → [PRICING-FORMULA.md](memory/3-day-tees/PRICING-FORMULA.md)
- **Setting Up Inventory?** → [INVENTORY-INTEGRATION.md](memory/3-day-tees/INVENTORY-INTEGRATION.md)
- **Integrating APIs?** → [API-PATTERNS.md](memory/3-day-tees/API-PATTERNS.md)
- **Ready to Build?** → [IMPLEMENTATION-TIMELINE.md](memory/3-day-tees/IMPLEMENTATION-TIMELINE.md)
- **Need Business Rules?** → [BUSINESS-LOGIC.md](memory/3-day-tees/BUSINESS-LOGIC.md)

---

## 🚀 Implementation Status

### ✅ Questions Resolved (14/14)
All critical business questions answered and documented.

### ✅ Technical Architecture Verified
- Multi-SKU inventory pattern verified from code
- Base part number pattern verified from sample-order-service.js
- Pricing calculation verified with 7-step formula
- 25 reusable components identified and mapped

### ✅ Code Reuse Analysis Complete
- **75% of code can be reused** from existing components
- **4-day development timeline** (32 hours total) vs. 5 weeks from scratch

### ✅ Business Logic Finalized
All fees, taxes, shipping, terms, and policies confirmed.

### 🚀 Ready to Begin Implementation

**First Command to Run:**
```bash
git checkout -b feature/3-day-tees
git commit -m "Add 3-Day Tees project requirements v2.0 (Implementation Ready)"
```

**Development Team:** Ready to start Day 1 (8 hours)
**Estimated Completion:** 4 business days
**Production Launch:** After final approval

---

**Document Status:** ✅ **Implementation Ready**
**Next Action:** Create Git branch and begin Day 1 development
**Target Completion:** 4 days (32 total hours)
