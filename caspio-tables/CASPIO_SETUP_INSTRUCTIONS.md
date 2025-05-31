# Caspio Table Setup Instructions for NWCA Quote System

## Overview
This document provides detailed instructions for creating the quote system tables in Caspio for Northwest Custom Apparel's DTG pricing page.

## Table 1: NWCA_Quote_Sessions

### Purpose
Main table for tracking customer quote sessions.

### Field Specifications

| Field Name | Caspio Data Type | Display Type | Required | Unique | Default | Notes |
|------------|------------------|--------------|----------|---------|---------|-------|
| QuoteID | Text (255) | Text Field | Yes | Yes | Use Formula: CONCATENATE('Q_', TEXT([@cbTimestamp], 'YYYYMMDD_HHMMSS')) | Primary Key |
| SessionID | Text (255) | Text Field | Yes | No | - | Browser session ID |
| CustomerEmail | Text (255) | Email | No | No | - | For quote follow-up |
| CustomerName | Text (255) | Text Field | No | No | - | - |
| CompanyName | Text (255) | Text Field | No | No | - | - |
| Phone | Text (64) | Phone | No | No | - | - |
| TotalQuantity | Number | Number | Yes | No | 0 | Integer only |
| SubtotalAmount | Number | Currency | Yes | No | 0.00 | 2 decimal places |
| LTMFeeTotal | Number | Currency | Yes | No | 0.00 | 2 decimal places |
| TotalAmount | Number | Currency | Yes | No | 0.00 | 2 decimal places |
| Status | Text (64) | Dropdown | Yes | No | 'active' | Options: active, saved, expired, converted |
| CreatedAt | Timestamp | - | Yes | No | Timestamp | Auto-generated |
| UpdatedAt | Timestamp | - | Yes | No | Timestamp | Auto-update on edit |
| ExpiresAt | Timestamp | - | Yes | No | Use Formula: DATEADD(day, 30, [@cbTimestamp]) | 30-day expiration |
| Notes | Text (64000) | Text Area | No | No | - | Customer notes |

### Indexes
- Primary Key: QuoteID
- Index on: SessionID, Status, CreatedAt

## Table 2: NWCA_Quote_Items

### Purpose
Individual line items within each quote.

### Field Specifications

| Field Name | Caspio Data Type | Display Type | Required | Unique | Default | Notes |
|------------|------------------|--------------|----------|---------|---------|-------|
| ItemID | Autonumber | - | Yes | Yes | Auto | Primary Key |
| QuoteID | Text (255) | Text Field | Yes | No | - | Foreign Key to Quote_Sessions |
| LineNumber | Number | Number | Yes | No | - | Order of items |
| StyleNumber | Text (64) | Text Field | Yes | No | - | Product style |
| ProductName | Text (255) | Text Field | Yes | No | - | Product description |
| Color | Text (255) | Text Field | Yes | No | - | Color name |
| ColorCode | Text (64) | Text Field | Yes | No | - | For inventory lookup |
| EmbellishmentType | Text (64) | Dropdown | Yes | No | - | Options: dtg, dtf, embroidery, screen-print |
| PrintLocation | Text (64) | Dropdown | Yes | No | - | Location codes |
| PrintLocationName | Text (255) | Text Field | Yes | No | - | Human-readable |
| Quantity | Number | Number | Yes | No | - | Total quantity |
| HasLTM | Yes/No | Checkbox | Yes | No | No | LTM fee applies |
| BaseUnitPrice | Number | Currency | Yes | No | 0.00 | Before LTM |
| LTMPerUnit | Number | Currency | Yes | No | 0.00 | LTM fee per unit |
| FinalUnitPrice | Number | Currency | Yes | No | 0.00 | Final price |
| LineTotal | Number | Currency | Yes | No | 0.00 | Total for line |
| SizeBreakdown | Text (64000) | Text Area | Yes | No | '{}' | JSON format |
| PricingTier | Text (64) | Text Field | Yes | No | - | Which tier used |
| ImageURL | Text (500) | URL | No | No | - | Product image |
| AddedAt | Timestamp | - | Yes | No | Timestamp | When added |

### Indexes
- Primary Key: ItemID
- Foreign Key: QuoteID → NWCA_Quote_Sessions.QuoteID
- Index on: QuoteID, LineNumber

## Table 3: NWCA_Quote_Analytics

### Purpose
Track user behavior and quote funnel analytics.

### Field Specifications

| Field Name | Caspio Data Type | Display Type | Required | Unique | Default | Notes |
|------------|------------------|--------------|----------|---------|---------|-------|
| AnalyticsID | Autonumber | - | Yes | Yes | Auto | Primary Key |
| SessionID | Text (255) | Text Field | Yes | No | - | Browser session |
| QuoteID | Text (255) | Text Field | No | No | - | If quote created |
| EventType | Text (64) | Dropdown | Yes | No | - | Event types below |
| StyleNumber | Text (64) | Text Field | No | No | - | Product viewed |
| Color | Text (255) | Text Field | No | No | - | Color selected |
| PrintLocation | Text (64) | Text Field | No | No | - | Location selected |
| Quantity | Number | Number | No | No | - | Quantity entered |
| HasLTM | Yes/No | Checkbox | No | No | No | LTM shown |
| PriceShown | Number | Currency | No | No | - | Price displayed |
| UserAgent | Text (500) | Text Area | Yes | No | - | Browser info |
| IPAddress | Text (64) | Text Field | No | No | - | User IP |
| Timestamp | Timestamp | - | Yes | No | Timestamp | Event time |

### Event Types
- `page_view` - User viewed pricing page
- `quantity_entered` - User entered quantity
- `size_selected` - User distributed sizes
- `location_changed` - User changed print location
- `item_added` - Item added to quote
- `item_removed` - Item removed from quote
- `quote_saved` - Quote saved/emailed
- `quote_exported` - PDF downloaded

### Indexes
- Primary Key: AnalyticsID
- Index on: SessionID, QuoteID, EventType, Timestamp

## API Setup in Caspio

### 1. Enable REST API
1. Go to your Caspio account settings
2. Enable REST API access
3. Generate API credentials

### 2. Create Web Services
For each table, create the following web services:

#### Quote Sessions
- `POST /quote-sessions` - Create new quote
- `GET /quote-sessions/{QuoteID}` - Get quote by ID
- `PUT /quote-sessions/{QuoteID}` - Update quote
- `GET /quote-sessions?SessionID={id}` - Get quotes by session

#### Quote Items
- `POST /quote-items` - Add item to quote
- `GET /quote-items?QuoteID={id}` - Get items for quote
- `PUT /quote-items/{ItemID}` - Update item
- `DELETE /quote-items/{ItemID}` - Remove item

#### Analytics
- `POST /quote-analytics` - Log event
- `GET /quote-analytics?SessionID={id}` - Get events by session

### 3. Authentication
Use token-based authentication:
```javascript
const headers = {
  'Authorization': 'Bearer YOUR_CASPIO_TOKEN',
  'Content-Type': 'application/json'
};
```

## Import Instructions

1. **Create Tables**
   - Log into Caspio
   - Go to Tables section
   - Click "Import" for each CSV file
   - Map fields according to specifications above

2. **Set Up Relationships**
   - Create relationship: Quote_Items.QuoteID → Quote_Sessions.QuoteID
   - Set cascade delete on Quote_Sessions to remove items

3. **Create DataPages**
   - Quote Entry Form
   - Quote Summary Report
   - Analytics Dashboard

4. **Configure API**
   - Enable REST API for each table
   - Set up authentication
   - Test endpoints

## Sample API Calls

### Create New Quote
```javascript
POST /api/quote-sessions
{
  "SessionID": "sess_abc123",
  "CustomerEmail": "customer@example.com",
  "TotalQuantity": 48,
  "Status": "active"
}
```

### Add Item to Quote
```javascript
POST /api/quote-items
{
  "QuoteID": "Q_20250529_123456",
  "LineNumber": 1,
  "StyleNumber": "PC61",
  "Color": "Black",
  "Quantity": 48,
  "FinalUnitPrice": 15.99
}
```

### Log Analytics Event
```javascript
POST /api/quote-analytics
{
  "SessionID": "sess_abc123",
  "EventType": "item_added",
  "StyleNumber": "PC61",
  "Quantity": 48
}
```

## Notes for Mr. Erik

1. **QuoteID Format**: Uses timestamp-based IDs like `Q_20250529_123456`
2. **LTM Calculation**: Handled in JavaScript, stored in database
3. **Size Breakdown**: Stored as JSON string in SizeBreakdown field
4. **Analytics**: Tracks full customer journey for optimization
5. **API Security**: Use environment variables for tokens

This system provides a professional quoting experience without the complexity of a full shopping cart!