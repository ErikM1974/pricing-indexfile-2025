# DTG Quote System Implementation Guide

## Overview
This document outlines the implementation of a quote-based system for Northwest Custom Apparel's DTG pricing page, replacing the complex shopping cart with a simpler, more transparent quote builder.

## Files Created

### 1. Caspio Database Files
- **`caspio-tables/NWCA_Quote_Sessions.csv`** - Main quote tracking table
- **`caspio-tables/NWCA_Quote_Items.csv`** - Individual line items
- **`caspio-tables/NWCA_Quote_Analytics.csv`** - User behavior tracking
- **`caspio-tables/CASPIO_SETUP_INSTRUCTIONS.md`** - Detailed setup guide

### 2. JavaScript Implementation
- **`shared_components/js/dtg-quote-system.js`** - Complete quote system logic

### 3. Documentation Updates
- **`dtg-pricing-optimization-report.md`** - Added comprehensive quote system section

## Key Features

### 1. Quantity-First Pricing
Users enter total quantity first to see their pricing tier immediately:
- Shows LTM fee breakdown for orders under 24 pieces
- Clear explanation of how the $50 fee is distributed
- Transparent pricing at every step

### 2. Simple Quote Builder
Three-step process:
1. Enter total quantity
2. Distribute across sizes
3. Add to quote

### 3. Quote Management
- Save quotes for later
- Export to PDF
- Email quotes to customers
- Track analytics for optimization

### 4. LTM Fee Handling
For orders under 24 pieces:
```
Base price: $15.99 (24-piece pricing)
LTM fee: $4.17 ($50 ÷ 12 pieces)
Your price: $20.16 per piece
```

## Implementation Steps

### Step 1: Create Caspio Tables
1. Log into Caspio
2. Import the three CSV files
3. Set up the fields according to CASPIO_SETUP_INSTRUCTIONS.md
4. Create REST API endpoints

### Step 2: Update DTG Page
Replace cart integration with quote system:
```html
<!-- Remove this -->
<script src="/shared_components/js/cart-integration.js"></script>

<!-- Add this -->
<script src="/shared_components/js/dtg-quote-system.js"></script>
```

### Step 3: Configure API Endpoints
Once Caspio tables are created, update the API configuration:
```javascript
const config = {
    apiBaseUrl: 'YOUR_CASPIO_API_URL',
    apiToken: 'YOUR_CASPIO_TOKEN'
};
```

### Step 4: Test the System
1. Enter various quantities (above and below 24)
2. Verify LTM calculations
3. Test quote saving and PDF export
4. Check analytics tracking

## API Endpoints

### Quote Sessions
```
POST   /api/quote-sessions      - Create new quote
GET    /api/quote-sessions/{id} - Get quote details
PUT    /api/quote-sessions/{id} - Update quote
```

### Quote Items
```
POST   /api/quote-items         - Add item to quote
GET    /api/quote-items?quoteId={id} - Get items
DELETE /api/quote-items/{id}    - Remove item
```

### Analytics
```
POST   /api/quote-analytics     - Log event
GET    /api/quote-analytics     - Get analytics data
```

## Benefits Over Shopping Cart

1. **Simplicity**: No complex cart state management
2. **Transparency**: LTM fees shown upfront
3. **Professional**: B2B-friendly quote system
4. **Analytics**: Track customer behavior
5. **Flexibility**: Easy to add multiple items
6. **Future-Ready**: Can upgrade to cart later

## User Experience Flow

1. **Customer visits DTG pricing page**
   - Sees product details and colors
   - Selects print location

2. **Enters desired quantity**
   - Immediately sees pricing tier
   - LTM fee explained if applicable

3. **Distributes sizes**
   - Must equal total quantity
   - Real-time validation

4. **Adds to quote**
   - Item appears in quote panel
   - Can add more items

5. **Finalizes quote**
   - Save for later
   - Export PDF
   - Email to self/team

## Analytics Tracking

The system tracks:
- Page views
- Quantity entries
- Items added/removed
- Quotes saved/exported
- LTM fee encounters

This data helps optimize:
- Pricing strategies
- User experience
- Conversion rates
- Product popularity

## Maintenance

### Weekly Tasks
- Review quote conversion rates
- Check for abandoned quotes
- Monitor LTM fee impact

### Monthly Tasks
- Analyze popular products
- Review pricing tiers
- Optimize based on data

## Future Enhancements

1. **Email Integration**
   - Automated quote emails
   - Follow-up reminders
   - Quote expiration notices

2. **Customer Portal**
   - View saved quotes
   - Reorder from quotes
   - Quote history

3. **Advanced Features**
   - Multi-location pricing
   - Bulk upload
   - Quote templates

## Conclusion

This quote system provides a professional, transparent pricing experience perfect for B2B customers while eliminating the complexity of a full shopping cart. The LTM fee handling is clear and fair, and the analytics provide valuable business insights.

For questions or support, contact the development team.