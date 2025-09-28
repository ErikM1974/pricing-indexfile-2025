# Caspio Pricing Proxy API - Core Documentation

## 🔄 SHARED DOCUMENTATION - SINGLE SOURCE OF TRUTH

> **IMPORTANT**: This documentation is the **single source of truth** shared between:
> - **Pricing Index File 2025** (API Consumer) - Northwest Custom Apparel's pricing calculator application
> - **caspio-pricing-proxy** (API Provider) - The Node.js server that creates and manages these endpoints
>
> Both applications' Claude instances use this file. Any updates here are visible to both sides.
> - **API Provider**: Update this when adding/modifying endpoints
> - **API Consumer**: Update this when discovering usage patterns or requirements
> - **Both**: Add notes in the Inter-Application Communication section below

## 🎯 Overview
**API Name**: Caspio Pricing Proxy API
**Version**: 2.0
**Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
**Authentication**: None (Public API)
**Total Active Endpoints**: 56

## 📋 Quick Reference Table
| Module | Documentation | Primary Resources | Status |
|--------|--------------|-------------------|--------|
| Products | [products-api.md](api/products-api.md) | products, inventory, colors | ✅ Active |
| Cart & Pricing | [cart-pricing-api.md](api/cart-pricing-api.md) | cart, pricing, tiers | ✅ Active |
| Orders & Quotes | [orders-quotes-api.md](api/orders-quotes-api.md) | orders, quotes, sessions | ✅ Active |
| Utilities | [utility-api.md](api/utility-api.md) | transfers, production, health | ✅ Active |

## 🔧 Common Patterns

### Date Formatting
All dates must be ISO format without milliseconds:
```javascript
const formattedDate = new Date().toISOString().replace(/\.\d{3}Z$/, '');
// Result: "2025-01-30T10:30:00"
```

### Pagination
Standard pagination pattern:
```
GET /api/resource?page=1&limit=25
```
Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6
  }
}
```

### Error Handling
All errors follow this structure:
```json
{
  "error": "Human-readable message",
  "errorId": "err_12345",
  "details": {
    "field": "Specific error details"
  }
}
```

### Caspio Query Parameters
For Caspio table queries:
- `q.where` - SQL-like filter (e.g., `Status='Active' AND CustomerID=123`)
- `q.orderBy` - Sort order (e.g., `CreatedDate DESC`)
- `q.limit` - Max results (default: 100, max: 1000)
- `q.select` - Specific fields to return

### Array Parameters
For filters that accept multiple values:
```
GET /api/products/search?category[]=Polos&category[]=T-Shirts&brand[]=Nike
```

## 🚨 Error Codes Reference

| Code | Status | Description | Common Causes |
|------|--------|-------------|---------------|
| 200 | OK | Success | Request completed successfully |
| 201 | Created | Resource created | POST request successful |
| 400 | Bad Request | Invalid input | Missing required fields, wrong types |
| 404 | Not Found | Resource not found | Invalid ID, deleted resource |
| 409 | Conflict | Duplicate resource | Duplicate ID or unique constraint |
| 422 | Unprocessable | Business rule violation | Invalid status transition |
| 500 | Server Error | Internal error | Database issue, server bug |
| 503 | Service Unavailable | API temporarily down | Maintenance, overload |

## 🧪 Testing

### Test Environment
Use the production URL for all testing (no separate test environment).

### Test Prefixes
Safe prefixes for testing:
- Quote IDs: `TEST-*`
- Session IDs: `test_sess_*`
- Customer emails: `*@test.example.com`

### Example Test Requests

```bash
# Health check
curl https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health

# Product search
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search?q=polo&limit=5"

# Create cart session
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/cart-sessions \
  -H "Content-Type: application/json" \
  -d '{"SessionID":"test_sess_123","IsActive":true}'

# Get order dashboard
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/order-dashboard?days=7"
```

## ✅ Implementation Checklist

When implementing against this API:

- [ ] Use correct base URL: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`
- [ ] Handle pagination for list endpoints
- [ ] Format dates without milliseconds
- [ ] Use array syntax for multi-value filters
- [ ] Store numeric IDs for update/delete operations
- [ ] Implement proper error handling
- [ ] Use test prefixes during development
- [ ] Cache reference data (categories, brands)
- [ ] Handle 60-second cache on dashboard endpoint

## 📝 Notes

- All endpoints are public (no authentication required)
- Caspio backend handles data persistence
- Dashboard endpoint has 60-second cache
- Maximum 100 results per page for list endpoints
- Use numeric PK_ID for updates/deletes, not string IDs

## 💬 Inter-Application Communication

### 🔄 Version Control & Tracking
- **Current Version**: 2.3.0
- **Last Updated By**: API Provider Claude at 2025-09-04T11:30:00
- **Last Checked by Consumer**: 2025-09-04T11:30:00
- **Last Checked by Provider**: 2025-08-30T17:00:00

### 📨 Communication Log

#### Message Categories
Use these prefixes for clear communication:
- 🚨 **BREAKING**: API breaking changes requiring immediate attention
- 📝 **UPDATE**: New endpoints, modifications, or documentation updates
- ❓ **QUESTION**: Need information from the other Claude
- ✅ **ANSWER**: Response to a question
- 🐛 **BUG**: Found an issue that needs fixing
- 💡 **SUGGESTION**: Improvement idea for consideration
- 🤝 **ACKNOWLEDGED**: Message received and understood

#### Active Conversations
*[Messages requiring response or acknowledgment - move to History when resolved]*

**2025-09-04 11:30** - ✅ **IMPLEMENTED** from API Provider:
Added two new endpoints for Additional Logo pricing:
- `GET /api/pricing-bundle?method=EMB-AL` - Embroidery additional logo pricing (ItemType='AL')
- `GET /api/pricing-bundle?method=CAP-AL` - Cap additional logo pricing (ItemType='AL-CAP')

Both endpoints are deployed to production and tested on Heroku. Postman collection has been updated.

### 🤝 Recent Updates Requiring Acknowledgment
*[Check off when acknowledged/implemented]*

- [x] Provider: DTG Product Bundle endpoint (v1.1.1) DEPLOYED & TESTED - Ready for DTG page integration ✅ 2025-08-30
- [x] Provider: EMB-AL and CAP-AL endpoints for additional logo pricing - PRODUCTION READY ✅ 2025-09-04

### 📋 Structured Communication Sections

#### Active Issues
*[Issues needing immediate attention]*
- None currently

#### Upcoming Changes
*[Planned modifications to the API]*
- None currently planned

#### Implementation Notes from Consumer (Pricing Index)
- **Date Formatting Critical**: All dates MUST have milliseconds removed with `.replace(/\.\d{3}Z$/, '')` or Caspio rejects them
- **Quote ID Pattern**: Must follow `PREFIX+MMDD-sequence` format exactly (e.g., DTG0830-1)
- **Update/Delete Operations**: Always use numeric PK_ID, not string IDs
- **EmailJS Integration**: Quote system relies on successful database saves, but email should still send even if DB fails
- **SizeBreakdown Field**: Must be JSON string, not object - use `JSON.stringify()` before sending
- **Order Dashboard Caching**: The 60-second cache is working well for performance
- **Product Search Enhancement**: The faceted filtering is excellent for UI implementation
- **Session Storage Pattern**: Using sessionStorage for daily quote sequence reset works perfectly

#### Implementation Notes from Provider (caspio-pricing-proxy)
- **Pagination**: All list endpoints use `fetchAllCaspioPages` to ensure complete data retrieval
- **Postman Sync**: Postman collection must be updated when any endpoint changes
- **Route Structure**: New endpoints should be added to route files in `/routes/` folder
- **Error Handling**: All endpoints return consistent error structure with errorId

#### Known Integration Patterns
1. **Quote Generation Flow**: Consumer generates QuoteID client-side → saves to DB → sends email → shows success
2. **Product Search**: Enhanced `/products/search` endpoint groups by style to prevent duplicates
3. **Dashboard Caching**: Order dashboard has 60-second cache - consider this for real-time requirements
4. **Test Prefixes**: Use `TEST-*` for QuoteIDs, `test_sess_*` for sessions during development

### ⚠️ Conflict Resolution Protocol
If both Claudes update simultaneously:
1. Check the "Last Updated By" timestamp
2. Manually merge changes (both sets of changes are likely valid)
3. Increment version number appropriately (x.x.1 for minor, x.1.0 for features, 3.0.0 for breaking)
4. Leave detailed note in Message History about the merge
5. Both Claudes should acknowledge the merge in their next session

### 🔔 Session Start Protocol for Both Claudes
1. Check "Active Conversations" section for pending messages
2. Review "Recent Updates Requiring Acknowledgment"
3. Check if other Claude updated since your last session
4. Acknowledge any messages directed to you
5. Update your "Last Checked" timestamp

---

**Module-specific documentation has been split into separate files for better performance:**
- [Product APIs](api/products-api.md) - Product search, details, colors, inventory
- [Cart & Pricing APIs](api/cart-pricing-api.md) - Cart management, pricing calculations
- [Order & Quote APIs](api/orders-quotes-api.md) - Order processing, quote management
- [Utility APIs](api/utility-api.md) - Transfers, production, utilities, health checks

**Last Updated**: September 28, 2025
**Documentation Type**: Core API Reference with Module Links