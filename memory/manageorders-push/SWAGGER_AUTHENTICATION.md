# ManageOrders PUSH API - Authentication Schema

**Last Updated:** 2025-11-14
**Purpose:** Complete SignIn schema documentation for JWT authentication
**Status:** Production-ready

---

## 📋 Navigation

**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

**Related Schemas:**
- [Request Envelope (Orders)](SWAGGER_REQUEST_ENVELOPE.md) - How to wrap authenticated requests
- [Responses](SWAGGER_RESPONSES.md) - Success and error response schemas

---

## 🔐 SignIn Schema

### Schema Structure

```typescript
SignIn {
  username: string   // Required
  password: string   // Required
}
```

### Example Request

```javascript
POST /api/signin
Content-Type: application/json

{
  "username": "api-user",
  "password": "secure-password"
}
```

### Example Response

```javascript
200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

---

## 🔄 Authentication Flow

1. **Send credentials** to `/api/signin` using SignIn schema
2. **Receive JWT token** in response
3. **Include token** in Authorization header for all subsequent requests
4. **Token expires** after 1 hour (automatically refreshed by proxy)

### Flow Diagram

```
┌──────────────────────────────────────────────────┐
│ Client Application                               │
│                                                  │
│ 1. POST /api/signin                              │
│    { username: "...", password: "..." }          │
└────────────────┬─────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────┐
│ caspio-pricing-proxy Server                      │
│                                                  │
│ 2. Authenticate with ManageOrders API            │
│ 3. Cache JWT token (1-hour TTL)                  │
│ 4. Return token to client                        │
└────────────────┬─────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────┐
│ Client stores token                              │
│                                                  │
│ 5. Use in Authorization header:                  │
│    Authorization: Bearer <token>                 │
└──────────────────────────────────────────────────┘
```

---

## ⚙️ Important Notes

- **Field names are exact:** `username` and `password` (lowercase, singular)
- **Credentials stored server-side:** Never exposed to browser
- **Proxy caches token:** 1-hour TTL, automatic refresh
- **No manual refresh needed:** Proxy handles token lifecycle

### Security Architecture

```
Browser                 Proxy Server            ManageOrders API
   │                         │                        │
   │  Request order create   │                        │
   ├────────────────────────>│                        │
   │                         │  Check cached token    │
   │                         │  (1-hour TTL)          │
   │                         │                        │
   │                         │  Token valid?          │
   │                         │  ┌─────────────┐       │
   │                         │  │ YES → Use   │       │
   │                         │  │ NO → Refresh│       │
   │                         │  └─────────────┘       │
   │                         │                        │
   │                         │   POST /api/orders     │
   │                         ├───────────────────────>│
   │                         │   Auth: Bearer token   │
   │                         │                        │
   │                         │ <──────────────────────┤
   │                         │   Order created        │
   │ <───────────────────────┤                        │
   │  Order response         │                        │
```

**Key Security Features:**
- Credentials never sent to browser
- Token cached server-side only
- Automatic token refresh
- Rate limiting (30 requests/minute)

---

## 💻 Error Handling

### Authentication Error Handling Pattern

```javascript
try {
  const response = await fetch('/api/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'api-user',
      password: 'secure-password'
    })
  });

  if (!response.ok) {
    throw new Error('Authentication failed');
  }

  const { token } = await response.json();
  // Store token for subsequent requests

} catch (error) {
  console.error('Auth error:', error);
  // Handle authentication failure
}
```

### Common Authentication Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **401 Unauthorized** | Invalid credentials | Check username/password |
| **401 Unauthorized** | Expired token | Token auto-refreshes, retry request |
| **403 Forbidden** | Insufficient permissions | Contact ShopWorks admin |
| **500 Server Error** | ManageOrders API down | Check API status, retry later |
| **Network Error** | Proxy unreachable | Check internet connection |

### Error Response Examples

#### 401 - Invalid Credentials
```javascript
401 Unauthorized
Content-Type: application/json

{
  "result": "Authentication failed: Invalid credentials"
}
```

#### 500 - Server Error
```javascript
500 Internal Server Error
Content-Type: application/json

{
  "result": "Authentication service temporarily unavailable"
}
```

---

## 🔧 Implementation Examples

### Basic Authentication

```javascript
// Simple authentication function
async function authenticate() {
  const response = await fetch(
    'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/auth/signin',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'api-user',
        password: 'secure-password'
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const { token } = await response.json();
  return token;
}
```

### Authentication with Retry Logic

```javascript
// Authentication with automatic retry
async function authenticateWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await authenticate();
    } catch (error) {
      console.warn(`Auth attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error('Authentication failed after 3 attempts');
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### Using Authentication Token

```javascript
// Use token in subsequent requests
async function createOrder(orderData, token) {
  const response = await fetch(
    'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/create',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    }
  );

  return response.json();
}
```

---

## 🎯 Best Practices

### 1. Token Management

**✅ DO:**
- Let proxy handle token caching and refresh
- Include token in Authorization header
- Handle 401 errors gracefully

**❌ DON'T:**
- Store credentials in browser
- Manually manage token expiration
- Include credentials in query parameters

### 2. Error Handling

**✅ DO:**
- Catch network errors
- Provide user-friendly error messages
- Log detailed errors for debugging
- Implement retry logic for transient failures

**❌ DON'T:**
- Expose credentials in error messages
- Ignore authentication failures
- Retry indefinitely without backoff

### 3. Security

**✅ DO:**
- Use HTTPS for all API calls
- Keep credentials server-side
- Implement rate limiting
- Monitor failed authentication attempts

**❌ DON'T:**
- Send credentials to browser
- Store passwords in code
- Bypass authentication in production

---

## 📚 Related Documentation

- **Request Structure:** [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) - How to use authentication token
- **Error Schemas:** [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#error-responses) - Complete error response documentation
- **Complete Examples:** [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md#step-1-authentication) - Working authentication examples
- **Main Guide:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md) - Complete schema documentation hub

---

## 🔍 Quick Reference

### API Endpoint
```
POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/auth/signin
```

### Request Body
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

### Success Response (200)
```json
{
  "token": "JWT token string",
  "expiresIn": 3600
}
```

### Error Responses
- **401:** Invalid credentials
- **403:** Insufficient permissions
- **500:** Server error

### Token Usage
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

**Documentation Type:** Swagger Authentication Schema
**Parent:** [SWAGGER_OVERVIEW.md](SWAGGER_OVERVIEW.md)
**Status:** Production-ready
