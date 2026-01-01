# ManageOrders PUSH API - Swagger Schema Overview

**Last Updated:** 2025-11-14
**Purpose:** Navigation hub for complete Swagger schema documentation
**Status:** Production-ready reference for all integrations

---

## 📋 Complete Schema Documentation

The ManageOrders PUSH API schema is organized into specialized documentation files for optimal readability and performance:

| Schema | Documentation | Purpose | When to Use |
|--------|--------------|---------|-------------|
| **Authentication** | [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md) | SignIn schema for JWT tokens | Login flow, token management |
| **Request Envelope** | [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) | Orders schema wrapper | Understanding order_json structure |
| **Order Payload** | [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) | ExternalOrderJson (165 fields) | Building complete order data |
| **Success Response** | [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#success-response) | OrderPushResult schema | Parsing successful order creation |
| **Error Responses** | [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#error-responses) | 401/403/500 error schemas | Handling API errors |
| **Examples & Validation** | [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md) | Working examples, validation | Implementation & debugging |

---

## 🎯 What This Documentation Covers

This documentation provides the **complete Swagger schema specification** for the ManageOrders PUSH API, showing the exact structure expected by ShopWorks OnSite 7's ManageOrders API.

**Two Schema Sets:**
1. **Payload Structure** (ExternalOrderJson) - What goes in the order
2. **API Interaction** (SignIn, Orders, Responses) - How to authenticate and wrap requests

### Complete API Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Authenticate                                        │
│ POST /api/signin                                            │
│ Body: SignIn schema → Response: JWT token                  │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Create Order                                        │
│ POST /api/orders/create                                     │
│ Headers: Authorization Bearer token                         │
│ Body: Orders schema (wraps ExternalOrderJson)              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
         ┌───────────┴────────────┐
         ↓                        ↓
┌─────────────────┐    ┌──────────────────────┐
│ Success (200)   │    │ Error (401/403/500)  │
│ OrderPushResult │    │ Error schemas        │
│ schema          │    │                      │
└─────────────────┘    └──────────────────────┘
```

### Schema Quick Reference

| Schema | Purpose | When Used | Documentation |
|--------|---------|-----------|---------------|
| **SignIn** | Authentication credentials | Login flow | [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md) |
| **Orders** | Request envelope | Wraps ExternalOrderJson | [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) |
| **ExternalOrderJson** | Order payload | Complete order data | [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) |
| **OrderPushResult** | Success response | Order created successfully | [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#success-response) |
| **AuthorizationError** | 401 response | Authentication failed | [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#authentication-error-401) |
| **ForbiddenError** | 403 response | Access denied | [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#forbidden-error-403) |
| **InternalServerError** | 500 response | Server error | [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#internal-server-error-500) |

---

## 🚀 Quick Start Guide

### Step 1: Understand Authentication
Read [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md) to understand:
- SignIn schema structure
- JWT token handling
- Token lifecycle and caching

### Step 2: Understand Request Structure
Read [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) to understand:
- Orders schema wrapper pattern
- How to wrap ExternalOrderJson correctly
- Why the `order_json` envelope is critical

### Step 3: Build Your Order Payload
Read [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) to understand:
- Complete ExternalOrderJson schema (165 fields)
- Required vs optional fields
- Field naming conventions
- Nested structures (Customer, Designs, LinesOE, etc.)

### Step 4: Handle Responses
Read [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md) to understand:
- Success response structure (OrderPushResult)
- Error response schemas (401/403/500)
- How to parse and handle each response type

### Step 5: Validate & Debug
Read [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md) to:
- See complete working examples (3-Day Tees)
- Understand data transformation patterns
- Use validation strategies
- Debug common issues

---

## 📖 When to Use Each Schema

### For Initial Implementation
1. **Start with:** [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md) - Get authentication working first
2. **Then read:** [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md) - Understand wrapper pattern
3. **Then build:** [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md) - Create your order structure
4. **Reference:** [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md) - Copy working patterns

### For Debugging
1. **Validation errors?** → [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md#validation--debugging)
2. **Auth failures?** → [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md#error-handling)
3. **Wrong response format?** → [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md)
4. **Field name issues?** → [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md#field-naming-conventions)

### For Specific Features
- **Multi-SKU products (3-Day Tees)?** → [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md#complete-3-day-tees-example)
- **Design/artwork upload?** → [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md#designs-block-array)
- **Shipping addresses?** → [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md#shipping-addresses-array)
- **Payment processing?** → [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md#payments-array)
- **Custom fields?** → [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md#customer-block-nested-object)

---

## 🎯 Quick Reference Summary

### Authentication
```javascript
POST /api/signin
Body: { username: "...", password: "..." }
Response: { token: "..." }
```
**See:** [SWAGGER_AUTHENTICATION.md](SWAGGER_AUTHENTICATION.md)

### Order Creation
```javascript
POST /api/orders/create
Headers: { Authorization: "Bearer ..." }
Body: { order_json: { ExternalOrderJson: { ... } } }
```
**See:** [SWAGGER_REQUEST_ENVELOPE.md](SWAGGER_REQUEST_ENVELOPE.md), [SWAGGER_ORDER_PAYLOAD.md](SWAGGER_ORDER_PAYLOAD.md)

### Success Response
```javascript
{ result: { orderNumber: "NWCA-12345", status: "Created" } }
```
**See:** [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#success-response)

### Error Response
```javascript
{ result: "Error message string" }
```
**See:** [SWAGGER_RESPONSES.md](SWAGGER_RESPONSES.md#error-responses)

### Critical Patterns for 3-Day Tees
- ✅ Use BASE part number ("PC54") for all sizes
- ✅ Use CATALOG_COLOR format ("Forest" not "Forest Green")
- ✅ Separate line items for standard vs oversize
- ✅ Quantity = sum of Size01-06 fields
- ✅ Wrap payload in order_json.ExternalOrderJson

**See complete examples:** [SWAGGER_EXAMPLES_VALIDATION.md](SWAGGER_EXAMPLES_VALIDATION.md#complete-3-day-tees-example)

---

## 📚 Related Documentation

- **Field Reference Core:** [FIELD_REFERENCE_CORE.md](FIELD_REFERENCE_CORE.md) - Master navigation for all 165 fields
- **Order Fields:** [ORDER_FIELDS.md](ORDER_FIELDS.md) - Order-level & customer fields (54 fields)
- **Product Fields:** [PRODUCT_FIELDS.md](PRODUCT_FIELDS.md) - Line items & design fields (47 fields)
- **Payment/Shipping:** [PAYMENT_SHIPPING_FIELDS.md](PAYMENT_SHIPPING_FIELDS.md) - Auxiliary blocks (34 fields)
- **Troubleshooting:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues & solutions
- **3-Day Tees API Patterns:** [../3-day-tees/API-PATTERNS.md](../3-day-tees/API-PATTERNS.md) - Complete API integration guide

---

## 🔄 Documentation Architecture

This modular schema documentation follows the same pattern as the field reference documentation:

```
manageorders-push/
├── SWAGGER_OVERVIEW.md (this file)         # Navigation hub
├── SWAGGER_AUTHENTICATION.md               # SignIn schema (~6k)
├── SWAGGER_REQUEST_ENVELOPE.md             # Orders schema (~8k)
├── SWAGGER_ORDER_PAYLOAD.md                # ExternalOrderJson (~20k)
├── SWAGGER_RESPONSES.md                    # Success/error responses (~10k)
└── SWAGGER_EXAMPLES_VALIDATION.md          # Examples & validation (~15k)
```

**Benefits of modular structure:**
- ✅ **Performance:** Each file under 40k characters for optimal Claude processing
- ✅ **Focused reading:** Load only what you need for current task
- ✅ **Better navigation:** Clear separation of concerns
- ✅ **Easier maintenance:** Update one schema without touching others

---

**Documentation Type:** Swagger Schema Navigation Hub
**Related:** All SWAGGER_*.md files in this directory
**Status:** Production-ready, complete API specification
