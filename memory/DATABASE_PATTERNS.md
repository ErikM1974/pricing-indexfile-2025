# Caspio Database Integration Guide for NWCA

## Overview

All quotes are saved to a standardized two-table structure in Caspio:
- **quote_sessions** - Master quote information
- **quote_items** - Individual line items for each quote

## Database Schema

### quote_sessions Table

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| QuoteID | STRING | Primary Key, Format: [PREFIX][MMDD]-[sequence] | "DTG0127-1" |
| SessionID | STRING | Unique session identifier | "dtg_sess_1706372145_x9k2m" |
| CustomerEmail | STRING | Customer's email address | "john@company.com" |
| CustomerName | STRING | Customer's full name | "John Smith" |
| CompanyName | STRING | Company name (optional) | "ABC Company" |
| Phone | STRING | Phone number (optional) | "253-555-1234" |
| TotalQuantity | NUMBER | Sum of all line items | 48 |
| SubtotalAmount | NUMBER | Subtotal before fees | 500.00 |
| LTMFeeTotal | NUMBER | Less Than Minimum fee total | 50.00 |
| TotalAmount | NUMBER | Grand total including all fees | 550.00 |
| Status | STRING | Quote status | "Open" or "Closed" |
| ExpiresAt | DATETIME | Expiration date (30 days) | "2025-02-26T12:00:00" |
| Notes | TEXT | Customer notes/instructions | "Rush order needed" |
| CreatedAt | DATETIME | Auto-populated by Caspio | "2025-01-27T10:30:00" |

### quote_items Table

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| QuoteID | STRING | Foreign Key to quote_sessions | "DTG0127-1" |
| LineNumber | NUMBER | Sequential line number | 1 |
| StyleNumber | STRING | Product style code | "PC54" or "CUSTOMER-SUPPLIED" |
| ProductName | STRING | Product description | "Cotton T-Shirt" |
| Color | STRING | Color name(s) | "Black" |
| ColorCode | STRING | Color code(s) | "BLK" |
| EmbellishmentType | STRING | Decoration method | "dtg", "embroidery", "laser", "screenprint" |
| PrintLocation | STRING | Location identifier | "Full Front" |
| PrintLocationName | STRING | Location display name | "Full Front - 12x16" |
| Quantity | NUMBER | Item quantity | 48 |
| HasLTM | STRING | Less than minimum flag | "Yes" or "No" |
| BaseUnitPrice | NUMBER | Base price per unit | 10.50 |
| LTMPerUnit | NUMBER | LTM fee per unit | 1.04 |
| FinalUnitPrice | NUMBER | Final price per unit | 11.54 |
| LineTotal | NUMBER | Quantity × FinalUnitPrice | 554.00 |
| SizeBreakdown | STRING | JSON with size/color details | '{"S":12,"M":12,"L":12,"XL":12}' |
| PricingTier | STRING | Quantity tier | "48-71" |
| ImageURL | STRING | Product image URL (optional) | "" |
| AddedAt | DATETIME | Timestamp | "2025-01-27T10:30:00" |

## Implementation Pattern

### Step 1: Create Quote Service Class

```javascript
class [Name]QuoteService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }
    
    generateQuoteID() {
        const now = new Date();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateKey = `${month}${day}`;
        
        // Daily sequence reset using sessionStorage
        const storageKey = `[prefix]_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());
        
        // Clean up old sequences
        this.cleanupOldSequences(dateKey);
        
        return `[PREFIX]${dateKey}-${sequence}`;
    }
    
    generateSessionID() {
        return `[prefix]_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
```

### Step 2: Save Quote Session

```javascript
async saveQuote(quoteData) {
    try {
        const quoteID = this.generateQuoteID();
        const sessionID = this.generateSessionID();
        
        // Format dates for Caspio (remove milliseconds)
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .replace(/\.\d{3}Z$/, '');
        
        const sessionData = {
            QuoteID: quoteID,
            SessionID: sessionID,
            CustomerEmail: quoteData.customerEmail,
            CustomerName: quoteData.customerName || 'Guest',
            CompanyName: quoteData.companyName || 'Not Provided',
            Phone: quoteData.customerPhone || '',
            TotalQuantity: quoteData.totalQuantity,
            SubtotalAmount: parseFloat(quoteData.subtotal.toFixed(2)),
            LTMFeeTotal: quoteData.ltmFeeTotal || 0,
            TotalAmount: parseFloat(quoteData.total.toFixed(2)),
            Status: 'Open',
            ExpiresAt: expiresAt,
            Notes: quoteData.notes || ''
        };
        
        const response = await fetch(`${this.baseURL}/api/quote_sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        // Always get response text first for debugging
        const responseText = await response.text();
        console.log('[QuoteService] Session response:', response.status, responseText);
        
        if (!response.ok) {
            throw new Error(`Session creation failed: ${responseText}`);
        }
```

### Step 3: Save Quote Items

```javascript
        // Add items to quote
        const itemPromises = quoteData.items.map(async (item, index) => {
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');
            
            const itemData = {
                QuoteID: quoteID,
                LineNumber: index + 1,
                StyleNumber: item.styleNumber || 'CUSTOM',
                ProductName: item.productName,
                Color: item.color || '',
                ColorCode: item.colorCode || '',
                EmbellishmentType: quoteData.embellishmentType,
                PrintLocation: item.location || '',
                PrintLocationName: item.locationDisplay || '',
                Quantity: parseInt(item.quantity),
                HasLTM: quoteData.totalQuantity < 24 ? 'Yes' : 'No',
                BaseUnitPrice: parseFloat(item.basePrice || 0),
                LTMPerUnit: parseFloat(item.ltmPerUnit || 0),
                FinalUnitPrice: parseFloat(item.finalPrice),
                LineTotal: parseFloat(item.lineTotal),
                SizeBreakdown: JSON.stringify(item.sizes || {}),
                PricingTier: this.getPricingTier(quoteData.totalQuantity),
                ImageURL: item.imageUrl || '',
                AddedAt: addedAt
            };
            
            const itemResponse = await fetch(`${this.baseURL}/api/quote_items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
            
            if (!itemResponse.ok) {
                const errorText = await itemResponse.text();
                console.error('Item save failed:', errorText);
                // Don't throw - allow partial success
            }
            
            return itemResponse.ok;
        });
        
        await Promise.all(itemPromises);
        
        return {
            success: true,
            quoteID: quoteID
        };
        
    } catch (error) {
        console.error('[QuoteService] Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

## Important Implementation Notes

1. **Date Formatting**: Always use `.replace(/\.\d{3}Z$/, '')` to remove milliseconds from ISO dates
2. **Number Fields**: Always use `parseFloat()` and `.toFixed(2)` for currency amounts
3. **Quote ID Pattern**: Must follow `[PREFIX][MMDD]-[sequence]` format
4. **Error Handling**: Log detailed responses but don't stop email send on database failure
5. **SizeBreakdown Field**: Can store any JSON data - use for size distributions, color breakdowns, or custom details

## Common Patterns by Calculator Type

- **DTG Contract**: Single item with combined print locations
- **Richardson Caps**: Multiple items (different styles) in one quote
- **Embroidery**: Items with stitch count stored in SizeBreakdown
- **Laser Tumbler**: Color/case breakdown in SizeBreakdown

## Quote ID Patterns

All quote IDs follow this format:
```
[PREFIX][MMDD]-[sequence]
```

Examples:
- DTG0127-1 (First DTG quote on January 27)
- RICH0127-2 (Second Richardson quote on January 27)
- EMB0127-3 (Third Embroidery quote on January 27)

Active Prefixes:
```
DTG     // DTG Contract
RICH    // Richardson Caps
EMB     // Embroidery Contract
LT      // Laser Tumblers
PATCH   // Embroidered Emblems
```

## Database Save Pattern

```javascript
// Step 1: Create session
await fetch(`${apiUrl}/api/quote_sessions`, {
    method: 'POST',
    body: JSON.stringify(sessionData)
});

// Step 2: Create items
await fetch(`${apiUrl}/api/quote_items`, {
    method: 'POST',
    body: JSON.stringify(itemData)
});
```

## API Configuration

```javascript
const API_CONFIG = {
    baseURL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com',
    endpoints: {
        sessions: '/api/quote_sessions',
        items: '/api/quote_items'
    }
};
```

## Error Handling Best Practices

```javascript
try {
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    // Always log for debugging
    console.log(`[Service] Response:`, response.status, responseText);
    
    if (!response.ok) {
        throw new Error(`Request failed: ${responseText}`);
    }
    
    // Parse JSON if successful
    const data = responseText ? JSON.parse(responseText) : {};
    return { success: true, data };
    
} catch (error) {
    console.error(`[Service] Error:`, error);
    // Don't let database errors stop email send
    return { success: false, error: error.message };
}
```

## Field Validation Patterns

```javascript
// Ensure required fields have values
const validateSessionData = (data) => {
    const required = ['QuoteID', 'CustomerEmail', 'TotalAmount'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // Validate number fields
    ['TotalQuantity', 'SubtotalAmount', 'TotalAmount'].forEach(field => {
        if (data[field] && isNaN(parseFloat(data[field]))) {
            throw new Error(`${field} must be a number`);
        }
    });
    
    return true;
};
```

## SizeBreakdown Field Usage Examples

The SizeBreakdown field is flexible JSON storage for any additional data:

```javascript
// Size distribution (apparel)
{
    "S": 12,
    "M": 24,
    "L": 24,
    "XL": 12
}

// Color breakdown (tumblers)
{
    "Black": {
        "model": "16OZBLK",
        "quantity": 24,
        "hex": "#000000"
    },
    "White": {
        "model": "16OZWHT",
        "quantity": 48,
        "hex": "#FFFFFF"
    }
}

// Embroidery details
{
    "stitchCount": 8000,
    "extraColors": 2,
    "locations": ["Left Chest", "Back"]
}
```

## Testing Database Integration

```javascript
// Console commands for testing
console.log(window.[name]Calculator.quoteService);
console.log(window.[name]Calculator.quoteService.generateQuoteID());

// After save attempt
console.log('[Service] Quote saved successfully:', quoteId);
```

## Common Database Errors and Solutions

### "Session creation failed"
- **Cause**: Missing required fields or wrong data types
- **Solution**: Check all required fields are provided with correct types

### "Cannot read property 'text' of undefined"
- **Cause**: Network error or API down
- **Solution**: Check network connection and API status

### "JSON Parse Error"
- **Cause**: Response is not valid JSON
- **Solution**: Log responseText before parsing

### Date Format Errors
- **Cause**: Milliseconds in ISO date string
- **Solution**: Always use `.replace(/\.\d{3}Z$/, '')`

Remember: Database saves should never prevent email sending. Always handle errors gracefully and continue with the email send even if database save fails.

## Complete CRUD Operations

This section covers the full Create, Read, Update, and Delete operations for the quote system. For detailed endpoint documentation, see @memory/API_DOCUMENTATION.md.

### Reading Quotes (GET Operations)

#### Retrieve Quote Sessions

```javascript
// Get all quote sessions with filters
async getQuoteSessions(filters = {}) {
    try {
        // Build query string from filters
        const queryParams = new URLSearchParams();
        if (filters.quoteID) queryParams.append('quoteID', filters.quoteID);
        if (filters.customerEmail) queryParams.append('customerEmail', filters.customerEmail);
        if (filters.status) queryParams.append('status', filters.status);
        if (filters.sessionID) queryParams.append('sessionID', filters.sessionID);
        
        const response = await fetch(`${this.baseURL}/api/quote_sessions?${queryParams}`);
        const data = await response.json();
        
        return data;
    } catch (error) {
        console.error('[QuoteService] Error fetching sessions:', error);
        return [];
    }
}

// Get specific quote session by ID
async getQuoteSession(quoteID) {
    try {
        const response = await fetch(`${this.baseURL}/api/quote_sessions/${quoteID}`);
        if (!response.ok) {
            throw new Error(`Quote not found: ${quoteID}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[QuoteService] Error fetching session:', error);
        return null;
    }
}
```

#### Retrieve Quote Items

```javascript
// Get all items for a specific quote
async getQuoteItems(quoteID) {
    try {
        const response = await fetch(`${this.baseURL}/api/quote_items?quoteID=${quoteID}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[QuoteService] Error fetching items:', error);
        return [];
    }
}

// Get specific item by ID
async getQuoteItem(itemID) {
    try {
        const response = await fetch(`${this.baseURL}/api/quote_items/${itemID}`);
        if (!response.ok) {
            throw new Error(`Item not found: ${itemID}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[QuoteService] Error fetching item:', error);
        return null;
    }
}
```

### Updating Quotes (PUT Operations)

#### Update Quote Session

```javascript
// Update quote session (e.g., change status, update totals)
async updateQuoteSession(quoteID, updates) {
    try {
        const response = await fetch(`${this.baseURL}/api/quote_sessions/${quoteID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Update failed: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('[QuoteService] Session updated:', quoteID);
        return { success: true, data: result };
        
    } catch (error) {
        console.error('[QuoteService] Error updating session:', error);
        return { success: false, error: error.message };
    }
}

// Common update scenarios
async markQuoteAsSent(quoteID) {
    return this.updateQuoteSession(quoteID, {
        Status: 'Sent',
        SentAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
    });
}

async markQuoteAsConverted(quoteID, orderID) {
    return this.updateQuoteSession(quoteID, {
        Status: 'Converted',
        OrderID: orderID,
        ConvertedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '')
    });
}

async extendQuoteExpiration(quoteID, days = 30) {
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.updateQuoteSession(quoteID, {
        ExpiresAt: newExpiry.toISOString().replace(/\.\d{3}Z$/, '')
    });
}
```

#### Update Quote Items

```javascript
// Update quote item (e.g., change quantity, price)
async updateQuoteItem(itemID, updates) {
    try {
        const response = await fetch(`${this.baseURL}/api/quote_items/${itemID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Update failed: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('[QuoteService] Item updated:', itemID);
        return { success: true, data: result };
        
    } catch (error) {
        console.error('[QuoteService] Error updating item:', error);
        return { success: false, error: error.message };
    }
}

// Update item quantity and recalculate
async updateItemQuantity(itemID, newQuantity, unitPrice) {
    return this.updateQuoteItem(itemID, {
        Quantity: parseInt(newQuantity),
        LineTotal: parseFloat((newQuantity * unitPrice).toFixed(2))
    });
}
```

### Deleting Quotes (DELETE Operations)

#### Delete Quote Session

```javascript
// Delete entire quote (cascade deletes items)
async deleteQuoteSession(quoteID) {
    try {
        // First, get all items for this quote
        const items = await this.getQuoteItems(quoteID);
        
        // Delete all items first
        for (const item of items) {
            await this.deleteQuoteItem(item.ID);
        }
        
        // Then delete the session
        const response = await fetch(`${this.baseURL}/api/quote_sessions/${quoteID}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Delete failed: ${errorText}`);
        }
        
        console.log('[QuoteService] Quote deleted:', quoteID);
        return { success: true };
        
    } catch (error) {
        console.error('[QuoteService] Error deleting quote:', error);
        return { success: false, error: error.message };
    }
}

// Delete single item from quote
async deleteQuoteItem(itemID) {
    try {
        const response = await fetch(`${this.baseURL}/api/quote_items/${itemID}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Delete failed: ${errorText}`);
        }
        
        console.log('[QuoteService] Item deleted:', itemID);
        return { success: true };
        
    } catch (error) {
        console.error('[QuoteService] Error deleting item:', error);
        return { success: false, error: error.message };
    }
}
```

### Real-World Use Cases

#### 1. Customer Quote History

```javascript
// Get all quotes for a customer
async getCustomerQuoteHistory(customerEmail) {
    const sessions = await this.getQuoteSessions({ 
        customerEmail: customerEmail 
    });
    
    // Sort by date, newest first
    return sessions.sort((a, b) => 
        new Date(b.CreatedAt) - new Date(a.CreatedAt)
    );
}
```

#### 2. Quote Duplication

```javascript
// Duplicate an existing quote
async duplicateQuote(originalQuoteID) {
    try {
        // Get original quote
        const original = await this.getQuoteSession(originalQuoteID);
        const items = await this.getQuoteItems(originalQuoteID);
        
        if (!original) {
            throw new Error('Original quote not found');
        }
        
        // Create new quote with same data
        const newQuoteData = {
            ...original,
            QuoteID: this.generateQuoteID(),
            SessionID: this.generateSessionID(),
            Status: 'Draft',
            CreatedAt: undefined, // Let database set this
            ExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString().replace(/\.\d{3}Z$/, '')
        };
        
        // Save new quote
        const result = await this.saveQuote({
            ...newQuoteData,
            items: items
        });
        
        return result;
        
    } catch (error) {
        console.error('[QuoteService] Error duplicating quote:', error);
        return { success: false, error: error.message };
    }
}
```

#### 3. Expired Quote Cleanup

```javascript
// Find and clean up expired quotes
async cleanupExpiredQuotes() {
    try {
        // Get all open quotes
        const openQuotes = await this.getQuoteSessions({ status: 'Open' });
        
        const now = new Date();
        const expiredQuotes = openQuotes.filter(quote => 
            new Date(quote.ExpiresAt) < now
        );
        
        // Update status to expired
        for (const quote of expiredQuotes) {
            await this.updateQuoteSession(quote.QuoteID, {
                Status: 'Expired'
            });
        }
        
        console.log(`[QuoteService] Marked ${expiredQuotes.length} quotes as expired`);
        return { success: true, count: expiredQuotes.length };
        
    } catch (error) {
        console.error('[QuoteService] Error cleaning up quotes:', error);
        return { success: false, error: error.message };
    }
}
```

#### 4. Quote Search

```javascript
// Search quotes by multiple criteria
async searchQuotes(searchCriteria) {
    try {
        const { 
            customerName, 
            dateFrom, 
            dateTo, 
            minAmount, 
            maxAmount,
            status 
        } = searchCriteria;
        
        // Get all quotes matching basic criteria
        let quotes = await this.getQuoteSessions({ status });
        
        // Filter by customer name (partial match)
        if (customerName) {
            quotes = quotes.filter(q => 
                q.CustomerName.toLowerCase().includes(customerName.toLowerCase())
            );
        }
        
        // Filter by date range
        if (dateFrom || dateTo) {
            quotes = quotes.filter(q => {
                const quoteDate = new Date(q.CreatedAt);
                if (dateFrom && quoteDate < new Date(dateFrom)) return false;
                if (dateTo && quoteDate > new Date(dateTo)) return false;
                return true;
            });
        }
        
        // Filter by amount range
        if (minAmount || maxAmount) {
            quotes = quotes.filter(q => {
                if (minAmount && q.TotalAmount < minAmount) return false;
                if (maxAmount && q.TotalAmount > maxAmount) return false;
                return true;
            });
        }
        
        return quotes;
        
    } catch (error) {
        console.error('[QuoteService] Error searching quotes:', error);
        return [];
    }
}
```

### Error Handling Best Practices

```javascript
// Comprehensive error handling for all CRUD operations
class QuoteServiceWithErrorHandling {
    async executeWithRetry(operation, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`[QuoteService] Attempt ${attempt} failed:`, error.message);
                
                // Don't retry on client errors (4xx)
                if (error.status && error.status >= 400 && error.status < 500) {
                    break;
                }
                
                // Wait before retry with exponential backoff
                if (attempt < maxRetries) {
                    await new Promise(resolve => 
                        setTimeout(resolve, Math.pow(2, attempt) * 1000)
                    );
                }
            }
        }
        
        throw lastError;
    }
    
    // Example usage
    async getQuoteWithRetry(quoteID) {
        return this.executeWithRetry(() => this.getQuoteSession(quoteID));
    }
}
```

### Batch Operations

```javascript
// Update multiple quotes at once
async batchUpdateQuotes(quoteIDs, updates) {
    const results = {
        success: [],
        failed: []
    };
    
    for (const quoteID of quoteIDs) {
        const result = await this.updateQuoteSession(quoteID, updates);
        if (result.success) {
            results.success.push(quoteID);
        } else {
            results.failed.push({ quoteID, error: result.error });
        }
    }
    
    return results;
}

// Delete multiple expired quotes
async batchDeleteExpiredQuotes(daysOld = 90) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const expiredQuotes = await this.searchQuotes({
        status: 'Expired',
        dateTo: cutoffDate.toISOString()
    });
    
    const results = {
        success: 0,
        failed: 0
    };
    
    for (const quote of expiredQuotes) {
        const result = await this.deleteQuoteSession(quote.QuoteID);
        if (result.success) {
            results.success++;
        } else {
            results.failed++;
        }
    }
    
    return results;
}
```

### Complete Quote Service Class Example

For a complete implementation example that includes all CRUD operations, see the implementation in existing calculators or create a new service extending the base patterns shown above.

**Important**: Always test CRUD operations in a development environment before deploying to production.