# ManageOrders PUSH API - Response Schemas

**Last Updated:** 2025-11-14
**Purpose:** Complete response schema documentation for success and error responses
**Status:** Production-ready

---

## 📋 Navigation

**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

**Related Schemas:**
- [Authentication (SignIn)](SWAGGER_AUTHENTICATION.md) - How to get JWT token
- [Request Envelope (Orders)](SWAGGER_REQUEST_ENVELOPE.md) - How to wrap requests
- [Order Payload (ExternalOrderJson)](SWAGGER_ORDER_PAYLOAD.md) - What goes in requests
- [Examples & Validation](SWAGGER_EXAMPLES_VALIDATION.md) - Working examples and debugging

---

## ✅ Success Response (OrderPushResult Schema)

### Schema Structure

```typescript
OrderPushResult {
  result: {
    orderNumber: string      // ShopWorks order number (NWCA-12345)
    status: string           // "Created" or other status
    message: string          // Success message (optional)
    extOrderID: string       // Your original order ID (optional)
  }
}
```

### Example Response

```javascript
200 OK
Content-Type: application/json

{
  "result": {
    "orderNumber": "NWCA-12345",
    "status": "Created",
    "message": "Order created successfully",
    "extOrderID": "NWCA-3DT1108-1"
  }
}
```

### Parsing Success Response

```javascript
const response = await fetch('/api/orders/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderRequest)
});

if (response.ok) {
  const data = await response.json();

  // Extract order number from result object
  const orderNumber = data.result.orderNumber;
  const status = data.result.status;

  console.log(`✓ Order created: ${orderNumber} (${status})`);

  // Use order number for tracking, confirmation, etc.
  showConfirmation(orderNumber);
}
```

### Key Points

- **Success = 200 status code**
- **Order number in `result.orderNumber`** (not top-level)
- **Order number format:** `NWCA-12345` (NWCA prefix + sequence)
- **Your order ID preserved** in `result.extOrderID`

---

## ❌ Error Responses (Error Schemas)

### Schema Structures

```typescript
// Authentication Error (401)
AuthorizationError {
  result: string   // Error message
}

// Forbidden Error (403)
ForbiddenError {
  result: string   // Error message
}

// Internal Server Error (500)
InternalServerError {
  result: string   // Error message
}
```

### Example Error Responses

#### 401 Authorization Error

```javascript
401 Unauthorized
Content-Type: application/json

{
  "result": "Authentication failed: Invalid token"
}
```

#### 403 Forbidden Error

```javascript
403 Forbidden
Content-Type: application/json

{
  "result": "Access denied: Insufficient permissions"
}
```

#### 500 Internal Server Error

```javascript
500 Internal Server Error
Content-Type: application/json

{
  "result": "Order creation failed: Database connection error"
}
```

### Complete Error Handling Pattern

```javascript
try {
  const response = await fetch('/api/orders/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderRequest)
  });

  const data = await response.json();

  // Handle responses by status code
  switch (response.status) {
    case 200:
      // OrderPushResult schema
      console.log('✓ Order created:', data.result.orderNumber);
      return { success: true, orderNumber: data.result.orderNumber };

    case 401:
      // AuthorizationError schema
      console.error('Auth failed:', data.result);
      // Trigger re-authentication
      await reauthenticate();
      return { success: false, error: 'Authentication failed' };

    case 403:
      // ForbiddenError schema
      console.error('Access denied:', data.result);
      return { success: false, error: 'Insufficient permissions' };

    case 500:
      // InternalServerError schema
      console.error('Server error:', data.result);
      // Log for support
      logErrorForSupport({
        message: data.result,
        request: orderRequest,
        timestamp: new Date().toISOString()
      });
      return { success: false, error: 'Server error, please try again' };

    default:
      console.error('Unexpected response:', response.status, data);
      return { success: false, error: 'Unexpected error' };
  }

} catch (error) {
  console.error('Request failed:', error);
  return { success: false, error: 'Network error' };
}
```

### Error Message Patterns

**All error schemas use same structure:**
- Single `result` field containing error message string
- Error message is human-readable
- May include technical details for debugging

**Common error messages:**
- `"Authentication failed: Invalid token"` - Token expired or invalid
- `"Authentication failed: Invalid credentials"` - Wrong username/password
- `"Access denied: Insufficient permissions"` - User lacks required permissions
- `"Order creation failed: [specific error]"` - Business logic error
- `"Database connection error"` - Infrastructure issue

---

## 🔧 Response Handling Best Practices

### 1. Always Check Status Code First

```javascript
if (response.ok) {
  // Status 200-299: Parse as success
  const data = await response.json();
  return processSuccess(data.result);
} else {
  // Status 400-599: Parse as error
  const data = await response.json();
  return processError(response.status, data.result);
}
```

### 2. Extract Values from Nested Structure

```javascript
// ✅ CORRECT - Access result object
const orderNumber = data.result.orderNumber;
const errorMessage = data.result;  // For errors, result is string

// ❌ WRONG - Looking at wrong level
const orderNumber = data.orderNumber;  // undefined!
```

### 3. Handle Network Errors Separately

```javascript
try {
  const response = await fetch(url, options);
  // ... handle response
} catch (error) {
  // This catches network errors (no response received)
  console.error('Network error:', error);
  showUserMessage('Unable to connect. Please check your connection.');
}
```

### 4. Implement Retry Logic for 500 Errors

```javascript
async function createOrderWithRetry(orderData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(orderData)
      });

      const data = await response.json();

      if (response.status === 500) {
        // Server error - retry
        console.warn(`Attempt ${attempt} failed, retrying...`);
        await sleep(1000 * attempt);  // Exponential backoff
        continue;
      }

      // Success or client error (don't retry)
      return { success: response.ok, data };

    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt);
    }
  }
}
```

### 5. Log Errors for Support

```javascript
function logErrorForSupport(errorInfo) {
  // Include context for debugging
  const logEntry = {
    timestamp: new Date().toISOString(),
    errorMessage: errorInfo.message,
    statusCode: errorInfo.status,
    request: {
      orderID: errorInfo.request.ExtOrderID,
      customerID: errorInfo.request.id_Customer,
      lineItemCount: errorInfo.request.LinesOE.length
    },
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  // Send to error tracking service
  console.error('Error log:', JSON.stringify(logEntry, null, 2));
}
```

---

## 📊 Response Status Code Reference

| Status Code | Schema | Meaning | Action |
|-------------|--------|---------|--------|
| **200** | OrderPushResult | Order created successfully | Extract orderNumber, show confirmation |
| **401** | AuthorizationError | Authentication failed | Re-authenticate, retry request |
| **403** | ForbiddenError | Access denied | Check user permissions |
| **500** | InternalServerError | Server error | Retry with backoff, log for support |

---

## 🎯 Quick Reference

### Success Response (200)

```json
{
  "result": {
    "orderNumber": "NWCA-12345",
    "status": "Created",
    "message": "Order created successfully",
    "extOrderID": "NWCA-3DT1108-1"
  }
}
```

**Extract order number:**
```javascript
const orderNumber = data.result.orderNumber;
```

### Error Response (401/403/500)

```json
{
  "result": "Error message here"
}
```

**Extract error message:**
```javascript
const errorMessage = data.result;
```

---

## 📚 Related Documentation

- **Request Structure:** [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) - How to structure requests
- **Order Payload:** [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) - What to send in requests
- **Authentication:** [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md) - How to get JWT tokens
- **Complete Examples:** [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md) - Working request/response examples
- **Main Guide:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

---

**Documentation Type:** Swagger Response Schemas
**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md)
**Status:** Production-ready
