# Sample Request System Implementation

## Overview
Implementing a free sample request system for the top sellers showcase page that allows customers to request 2-3 physical samples without calling. Uses existing quote API infrastructure and size-pricing endpoint for eligibility.

## Progress Status

### ✅ Completed
1. **sample-cart.js** - Sample cart management system
   - Eligibility checking via size-pricing API
   - Max 3 samples limit enforcement
   - Session storage persistence
   - Floating cart widget UI
   - Toast notifications
   - Cache for API calls

2. **sample-request-service.js** - Database integration service
   - Uses existing quote API infrastructure
   - Sample Request prefix "SR"
   - Duplicate request prevention (30-day check)
   - EmailJS integration ready
   - CRUD operations for sample requests

3. **Modified top-sellers-showcase.html**
   - Added sample request buttons to product cards
   - Integrated floating sample cart widget
   - Added sample request modal with form
   - Integrated all JavaScript functions
   - CSS styling for all sample components

### 📋 To Do
4. **Create sample-requests-dashboard.html**
   - Staff view for managing requests
   - Fulfillment tracking
   - Export functionality

5. **Update staff-dashboard.html**
   - Add link to sample requests

## Key Implementation Details

### Eligibility Rules
- Products with average price < $10 are eligible for free samples
- Using endpoint: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/size-pricing?styleNumber=XXX`
- Caching results to minimize API calls

### Database Structure
- Using existing quote_sessions and quote_items tables
- Sample requests use prefix "SR" (e.g., SR1230-1)
- Status field set to "Sample Request"
- Price fields set to 0.00 (free samples)

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