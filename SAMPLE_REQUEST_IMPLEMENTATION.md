# Sample Request System Implementation

## Overview
Implementing a sample request system for the top sellers showcase page that allows customers to request up to 3 physical samples. Uses existing quote API infrastructure and size-pricing endpoint for eligibility.

### Sample Types:
- **FREE Samples**: Products under $10 minimum price (from Sanmar)
- **PAID Samples**: Products $10+ at cost + 40% margin (rounded up)
- **No Samples**: Non-Sanmar products (Richardson, etc.)

## Progress Status

### ✅ Completed
1. **Sample Cart System** 
   - Eligibility checking via size-pricing API
   - Three-tier pricing: FREE (<$10), PAID ($10+), NO SAMPLES (non-Sanmar)
   - Max 3 samples limit enforcement
   - Session storage persistence
   - Floating cart widget UI
   - Color/size selection for each sample

2. **Database Integration**
   - Uses existing quote_sessions and quote_items tables
   - Sample Request prefix "SR" (e.g., SR0829-1)
   - Simplified Notes field to avoid Caspio errors
   - Detailed order info stored in SizeBreakdown JSON field
   - Duplicate request prevention (30-day check)

3. **Order Processing Features**
   - Delivery method selection (Pickup FREE vs Ship $10)
   - Conditional shipping address fields
   - 10.1% Milton sales tax calculation
   - Complete order total with tax breakdown
   - All details captured for manual Shopworks entry

4. **User Interface**
   - Sample request buttons on eligible products
   - Floating sample cart widget
   - Complete order form with project details
   - Success messages with order breakdown
   - Mobile responsive design

### 📋 To Do
5. **Create sample-requests-dashboard.html**
   - Staff view for managing requests
   - Fulfillment tracking
   - Export functionality

6. **Update staff-dashboard.html**
   - Add link to sample requests

## Key Implementation Details

### Eligibility Rules
- Products with MINIMUM price < $10 = FREE samples
- Products with MINIMUM price ≥ $10 = PAID samples at Math.ceil(minPrice / 0.60)
- Non-Sanmar products (no API data) = NO samples available
- Using endpoint: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/size-pricing?styleNumber=XXX`
- Results cached to minimize API calls

### Database Structure
**quote_sessions table:**
- QuoteID: "SR[MMDD]-[sequence]" format
- Status: "Sample Request"
- Notes: Simplified format (e.g., "Sample request - Ship to Seattle, WA - 3 samples - Total: $33.03")
- SubtotalAmount: Sample costs
- LTMFeeTotal: Shipping + Tax combined
- TotalAmount: Final total including tax

**quote_items table:**
- Each sample as separate line item
- FinalUnitPrice: Sample price (0 for free, actual price for paid)
- SizeBreakdown field contains:
  - Sample's selected size and color
  - First item also includes complete order details JSON:
    ```json
    {
      "size": "L",
      "color": "Black",
      "orderInfo": {
        "delivery": "ship",
        "shipping": {
          "address": "123 Main St",
          "city": "Seattle",
          "state": "WA",
          "zip": "98101"
        },
        "totals": {
          "samples": 20.00,
          "shipping": 10.00,
          "tax": 3.03,
          "total": 33.03
        },
        "projectType": "Screen Printing",
        "estimatedQuantity": "100-249",
        "timeline": "Within 2 weeks"
      }
    }
    ```

### Sample Cart Features
- Maximum 3 samples per request
- Session storage for persistence
- Floating widget shows count
- Duplicate prevention
- Real-time eligibility checking

### API Integration
```javascript
// Check eligibility
GET /api/size-pricing?styleNumber=PC54

// Save sample request
POST /api/quote_sessions
{
  QuoteID: "SR1230-1",
  Status: "Sample Request",
  TotalAmount: 0,
  // ... other fields
}

POST /api/quote_items
{
  QuoteID: "SR1230-1",
  StyleNumber: "PC54",
  FinalUnitPrice: 0,
  // ... other fields
}
```

## Files Structure

```
/shared_components/js/
├── sample-cart.js          ✅ Created
└── sample-request-service.js   🚧 In Progress

/top-sellers-showcase.html     📋 To Modify
/sample-requests-dashboard.html 📋 To Create
/staff-dashboard.html          📋 To Update
```

## Sample Request Flow

1. **Customer browses products**
   - System checks eligibility via API
   - Shows "Request Sample" button for eligible items

2. **Customer adds samples**
   - Max 3 items
   - Stored in session storage
   - Floating cart shows count

3. **Customer submits request**
   - Opens modal with form
   - One-time contact info collection
   - Creates SR quote in database

4. **Staff fulfillment**
   - View in dashboard
   - Mark as fulfilled
   - Auto follow-up after 7 days

## Next Steps

1. Complete sample-request-service.js with database integration
2. Add UI components to showcase page
3. Create staff dashboard
4. Set up EmailJS templates
5. Test end-to-end flow

## Testing Checklist

- [ ] Eligibility detection working
- [ ] Cart management (add/remove/clear)
- [ ] Max 3 samples enforced
- [ ] Form submission saves to database
- [ ] Email notifications sent
- [ ] Staff dashboard displays requests
- [ ] Duplicate prevention working
- [ ] Mobile responsive

## Notes

- Free samples from Sanmar (no cost to NWCA)
- 30-day cooldown between requests per email
- Track conversion rate (sample to sale)
- Consider size selection for apparel items