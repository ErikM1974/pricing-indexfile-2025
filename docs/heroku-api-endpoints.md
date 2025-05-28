# Heroku Server API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Base Configuration](#base-configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
   - [Status/Health Check](#statushealth-check)
   - [Pricing Configuration](#pricing-configuration)
   - [Product Information](#product-information)
   - [Search and Filtering](#search-and-filtering)
   - [Cart Management](#cart-management)
   - [Customer Management](#customer-management)
   - [Order Management](#order-management)
   - [Pricing Matrix](#pricing-matrix)
   - [Utility Endpoints](#utility-endpoints)
5. [Error Handling](#error-handling)
6. [Environment Variables](#environment-variables)

## Overview

This API server provides endpoints for managing Northwest Custom Apparel's pricing index system, including product information, cart management, customer data, orders, and pricing matrices. The server is built with Express.js and deployed on Heroku.

### Key Features
- RESTful API design
- JSON request/response format
- Proxy to Caspio backend API
- HTTPS enforcement in production
- Response compression
- Static file serving with caching

## Base Configuration

### Base URL
```
Production: https://your-heroku-app.herokuapp.com
Development: http://localhost:3000
```

### API Base Path
All API endpoints are prefixed with `/api`

### Request Headers
```
Content-Type: application/json
```

### Response Format
All responses are in JSON format unless otherwise specified.

## Authentication

The server acts as a proxy to the Caspio API backend. Authentication is handled internally through environment variables. Client applications do not need to provide authentication credentials.

## API Endpoints

### Status/Health Check

#### Root Endpoint
- **Method**: `GET`
- **Path**: `/`
- **Description**: Serves the main index.html page
- **Response**: HTML page

### Pricing Configuration

#### Pricing Pages
Various pricing calculator pages are served as static HTML:

- **Embroidery Pricing**
  - **Method**: `GET`
  - **Path**: `/pricing/embroidery`
  - **Response**: HTML page

- **Cap Embroidery Pricing**
  - **Method**: `GET`
  - **Path**: `/pricing/cap-embroidery`
  - **Response**: HTML page

- **DTG Pricing**
  - **Method**: `GET`
  - **Path**: `/pricing/dtg`
  - **Response**: HTML page

- **Screen Print Pricing**
  - **Method**: `GET`
  - **Path**: `/pricing/screen-print`
  - **Response**: HTML page

- **DTF Pricing**
  - **Method**: `GET`
  - **Path**: `/pricing/dtf`
  - **Response**: HTML page

### Product Information

#### Product Details Page
- **Method**: `GET`
- **Path**: `/product`
- **Description**: Serves the product details page
- **Response**: HTML page

#### Get Inventory
- **Method**: `GET`
- **Path**: `/api/inventory`
- **Description**: Fetch inventory levels for a specific product
- **Required Parameters**:
  - `styleNumber` (query) - Product style number
  - `color` (query) - Product color
- **Example Request**:
  ```
  GET /api/inventory?styleNumber=PC54&color=Black
  ```
- **Example Response**:
  ```json
  [
    {
      "catalog_no": "PC54",
      "catalog_color": "Black",
      "size": "S",
      "quantity": 150
    }
  ]
  ```

### Search and Filtering

The API supports filtering through query parameters on most endpoints using the `filter` parameter.

### Cart Management

#### Cart Sessions

##### Get All Cart Sessions
- **Method**: `GET`
- **Path**: `/api/cart-sessions`
- **Description**: Retrieve all cart sessions
- **Example Response**:
  ```json
  [
    {
      "SessionID": "abc123",
      "CreatedDate": "2025-01-27T10:00:00Z",
      "LastModified": "2025-01-27T11:00:00Z"
    }
  ]
  ```

##### Get Cart Session by ID
- **Method**: `GET`
- **Path**: `/api/cart-sessions/:id`
- **Description**: Retrieve a specific cart session
- **Parameters**:
  - `id` (path) - Session ID
- **Example Response**:
  ```json
  {
    "SessionID": "abc123",
    "CreatedDate": "2025-01-27T10:00:00Z",
    "LastModified": "2025-01-27T11:00:00Z"
  }
  ```

##### Create Cart Session
- **Method**: `POST`
- **Path**: `/api/cart-sessions`
- **Description**: Create a new cart session
- **Request Body**:
  ```json
  {
    "CustomerID": "12345"
  }
  ```
- **Response**: 201 Created with session details

##### Update Cart Session
- **Method**: `PUT`
- **Path**: `/api/cart-sessions/:id`
- **Description**: Update an existing cart session
- **Parameters**:
  - `id` (path) - Session ID
- **Request Body**: Session fields to update

##### Delete Cart Session
- **Method**: `DELETE`
- **Path**: `/api/cart-sessions/:id`
- **Description**: Delete a cart session
- **Parameters**:
  - `id` (path) - Session ID
- **Response**:
  ```json
  {
    "success": true
  }
  ```

#### Cart Items

##### Get All Cart Items
- **Method**: `GET`
- **Path**: `/api/cart-items`
- **Description**: Retrieve all cart items
- **Example Response**:
  ```json
  [
    {
      "CartItemID": 1,
      "SessionID": "abc123",
      "StyleNumber": "PC54",
      "Color": "Black",
      "Quantity": 24,
      "UnitPrice": 15.99
    }
  ]
  ```

##### Get Cart Items by Session
- **Method**: `GET`
- **Path**: `/api/cart-items/session/:sessionId`
- **Description**: Retrieve all cart items for a specific session with their sizes
- **Parameters**:
  - `sessionId` (path) - Session ID
- **Example Response**:
  ```json
  [
    {
      "CartItemID": 1,
      "SessionID": "abc123",
      "StyleNumber": "PC54",
      "Color": "Black",
      "PRODUCT_TITLE": "Port & Company PC54 - Black",
      "Quantity": 24,
      "UnitPrice": 15.99,
      "sizes": [
        {
          "SizeID": 1,
          "CartItemID": 1,
          "Size": "S",
          "Quantity": 6
        }
      ]
    }
  ]
  ```
- **Special Notes**: 
  - Automatically fetches associated sizes for each cart item
  - Reconstructs PRODUCT_TITLE from various fields if missing
  - Handles errors gracefully for individual size fetches

##### Create Cart Item
- **Method**: `POST`
- **Path**: `/api/cart-items`
- **Description**: Add a new item to cart
- **Request Body**:
  ```json
  {
    "SessionID": "abc123",
    "StyleNumber": "PC54",
    "Color": "Black",
    "PRODUCT_TITLE": "Port & Company PC54 - Black",
    "Quantity": 24,
    "UnitPrice": 15.99,
    "EmbellishmentOptions": {
      "type": "embroidery",
      "locations": ["front"]
    }
  }
  ```
- **Response**: 201 Created with cart item details
- **Special Notes**: 
  - PRODUCT_TITLE is stored in Description, Notes, and EmbellishmentOptions fields
  - EmbellishmentOptions can be a JSON string or object

##### Update Cart Item
- **Method**: `PUT`
- **Path**: `/api/cart-items/:id`
- **Description**: Update an existing cart item
- **Parameters**:
  - `id` (path) - Cart item ID
- **Request Body**: Cart item fields to update
- **Special Notes**: Same PRODUCT_TITLE handling as create

##### Delete Cart Item
- **Method**: `DELETE`
- **Path**: `/api/cart-items/:id`
- **Description**: Remove an item from cart
- **Parameters**:
  - `id` (path) - Cart item ID

#### Cart Item Sizes

##### Get All Cart Item Sizes
- **Method**: `GET`
- **Path**: `/api/cart-item-sizes`
- **Description**: Retrieve all cart item sizes

##### Get Sizes by Cart Item
- **Method**: `GET`
- **Path**: `/api/cart-item-sizes/cart-item/:cartItemId`
- **Description**: Get all sizes for a specific cart item
- **Parameters**:
  - `cartItemId` (path) - Cart item ID
- **Example Response**:
  ```json
  [
    {
      "SizeID": 1,
      "CartItemID": 1,
      "Size": "S",
      "Quantity": 6
    },
    {
      "SizeID": 2,
      "CartItemID": 1,
      "Size": "M",
      "Quantity": 12
    }
  ]
  ```

##### Create Cart Item Size
- **Method**: `POST`
- **Path**: `/api/cart-item-sizes`
- **Description**: Add a size entry for a cart item
- **Request Body**:
  ```json
  {
    "CartItemID": 1,
    "Size": "S",
    "Quantity": 6
  }
  ```

##### Update Cart Item Size
- **Method**: `PUT`
- **Path**: `/api/cart-item-sizes/:id`
- **Description**: Update a size entry
- **Parameters**:
  - `id` (path) - Size entry ID

##### Delete Cart Item Size
- **Method**: `DELETE`
- **Path**: `/api/cart-item-sizes/:id`
- **Description**: Remove a size entry
- **Parameters**:
  - `id` (path) - Size entry ID

### Customer Management

#### Get All Customers
- **Method**: `GET`
- **Path**: `/api/customers`
- **Description**: Retrieve all customers

#### Get Customer by Email
- **Method**: `GET`
- **Path**: `/api/customers/email/:email`
- **Description**: Find customer by email address
- **Parameters**:
  - `email` (path) - Customer email
- **Example Response**:
  ```json
  [
    {
      "CustomerID": "12345",
      "Email": "customer@example.com",
      "FirstName": "John",
      "LastName": "Doe"
    }
  ]
  ```

#### Create Customer
- **Method**: `POST`
- **Path**: `/api/customers`
- **Description**: Create a new customer
- **Request Body**:
  ```json
  {
    "Email": "customer@example.com",
    "FirstName": "John",
    "LastName": "Doe",
    "Phone": "555-1234"
  }
  ```

#### Update Customer
- **Method**: `PUT`
- **Path**: `/api/customers/:id`
- **Description**: Update customer information
- **Parameters**:
  - `id` (path) - Customer ID

### Order Management

#### Get All Orders
- **Method**: `GET`
- **Path**: `/api/orders`
- **Description**: Retrieve all orders

#### Get Order by ID
- **Method**: `GET`
- **Path**: `/api/orders/:id`
- **Description**: Retrieve a specific order
- **Parameters**:
  - `id` (path) - Order ID

#### Create Order
- **Method**: `POST`
- **Path**: `/api/orders`
- **Description**: Create a new order
- **Request Body**:
  ```json
  {
    "CustomerID": "12345",
    "SessionID": "abc123",
    "TotalAmount": 383.76,
    "Status": "pending"
  }
  ```

#### Update Order
- **Method**: `PUT`
- **Path**: `/api/orders/:id`
- **Description**: Update order information
- **Parameters**:
  - `id` (path) - Order ID

### Pricing Matrix

#### Get Pricing Matrix Data
- **Method**: `GET`
- **Path**: `/api/pricing-matrix`
- **Description**: Retrieve pricing matrix entries
- **Required Parameters**:
  - `styleNumber` (query) - Product style number
  - `color` (query) - Product color
  - `embType` (query) - Embellishment type
- **Example Request**:
  ```
  GET /api/pricing-matrix?styleNumber=PC54&color=Black&embType=embroidery
  ```

#### Lookup Pricing Matrix
- **Method**: `GET`
- **Path**: `/api/pricing-matrix/lookup`
- **Description**: Find the most recent pricing matrix entry for a product
- **Required Parameters**:
  - `styleNumber` (query) - Product style number
  - `color` (query) - Product color
  - `embellishmentType` (query) - Embellishment type
- **Optional Parameters**:
  - `sessionID` (query) - Session ID for session-specific pricing
- **Example Request**:
  ```
  GET /api/pricing-matrix/lookup?styleNumber=PC54&color=Black&embellishmentType=embroidery
  ```
- **Example Response**:
  ```json
  {
    "pricingMatrixId": 123,
    "message": "Exact pricing matrix found"
  }
  ```
- **Error Response** (404):
  ```json
  {
    "error": "Pricing matrix not found",
    "message": "No pricing matrix found for styleNumber=PC54, color=Black, embellishmentType=embroidery"
  }
  ```
- **Special Notes**:
  - Returns the most recent entry based on CaptureDate
  - Performs exact matching on all parameters
  - Logs detailed information for debugging

#### Get Pricing Matrix by ID
- **Method**: `GET`
- **Path**: `/api/pricing-matrix/:id`
- **Description**: Retrieve a specific pricing matrix entry
- **Parameters**:
  - `id` (path) - Pricing matrix ID

#### Create Pricing Matrix Entry
- **Method**: `POST`
- **Path**: `/api/pricing-matrix`
- **Description**: Create a new pricing matrix entry
- **Request Body**:
  ```json
  {
    "StyleNumber": "PC54",
    "Color": "Black",
    "EmbellishmentType": "embroidery",
    "PricingData": {},
    "SessionID": "abc123"
  }
  ```

#### Update Pricing Matrix Entry
- **Method**: `PUT`
- **Path**: `/api/pricing-matrix/:id`
- **Description**: Update a pricing matrix entry
- **Parameters**:
  - `id` (path) - Pricing matrix ID

### Utility Endpoints

#### Image Proxy
- **Method**: `GET`
- **Path**: `/api/image-proxy`
- **Description**: Proxy external images to avoid CORS issues
- **Required Parameters**:
  - `url` (query) - Full URL of the image to proxy
- **Example Request**:
  ```
  GET /api/image-proxy?url=https://example.com/image.jpg
  ```
- **Response**: Binary image data with appropriate Content-Type header
- **Security Notes**:
  - Only accepts HTTP/HTTPS URLs
  - Validates URL protocol before fetching
  - Forwards original Content-Type header

#### Cart Integration Script
- **Method**: `GET`
- **Path**: `/api/cart-integration.js`
- **Description**: Serves the cart integration JavaScript file for Caspio DataPages
- **Response Headers**:
  - `Content-Type: application/javascript`
  - `Access-Control-Allow-Origin: *`
- **Usage**: Can be included in Caspio DataPages to enable cart functionality

#### Cart Page
- **Method**: `GET`
- **Path**: `/cart`
- **Description**: Serves the shopping cart HTML page
- **Response**: HTML page

## Error Handling

All API endpoints follow a consistent error response format:

### Error Response Format
```json
{
  "error": "Brief error description",
  "message": "Detailed error message (optional)"
}
```

### Common HTTP Status Codes
- `200 OK` - Successful request
- `201 Created` - Resource successfully created
- `400 Bad Request` - Missing or invalid parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error or API failure

### Example Error Responses

#### Missing Required Parameters (400)
```json
{
  "error": "styleNumber and color parameters are required"
}
```

#### Resource Not Found (404)
```json
{
  "error": "Pricing matrix not found",
  "message": "No pricing matrix found for styleNumber=PC54, color=Black, embellishmentType=embroidery"
}
```

#### Server Error (500)
```json
{
  "error": "Failed to fetch cart items"
}
```

## Environment Variables

The following environment variables are required for the server to function properly:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port number | 3000 | No |
| `NODE_ENV` | Environment (production/development) | development | No |
| `API_BASE_URL` | Base URL for Caspio API proxy | https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api | No |

### Production Considerations

1. **HTTPS Enforcement**: The server automatically redirects HTTP requests to HTTPS in production (when `NODE_ENV=production`)

2. **Compression**: All responses are compressed using gzip to reduce bandwidth

3. **Caching**: 
   - Static assets are cached for 1 day
   - HTML files are not cached (`Cache-Control: no-cache`)

4. **CORS**: The cart integration script allows cross-origin access for embedding in Caspio DataPages

### Development Setup

1. Create a `.env` file in the project root:
   ```
   PORT=3000
   API_BASE_URL=https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

### Deployment to Heroku

The server includes a `Procfile` for Heroku deployment. The server will:
- Use the PORT environment variable provided by Heroku
- Enforce HTTPS in production
- Serve static files with appropriate caching headers

## Endpoint Usage Analysis

### Overview

This analysis was conducted on January 27, 2025, to identify which API endpoints are actively used by the pricing pages and related functionality.

### Endpoint Usage by Component

| Component | File | Endpoints Used | Purpose |
|-----------|------|----------------|---------|
| **Cart System** | `cart.js`, `shared_components/js/cart.js` | `/api/cart-sessions` (all CRUD operations)<br>`/api/cart-items` (all CRUD operations)<br>`/api/cart-item-sizes` (all CRUD operations)<br>`/api/inventory` | Core cart functionality including session management, item management, size management, and inventory checking |
| **Cart Integration** | `cart-integration.js` | `/api/cart-sessions`<br>`/api/cart-items`<br>`/api/cart-item-sizes`<br>`/api/inventory` | Caspio DataPage integration for cart operations |
| **Pricing Pages** | `pricing-pages.js`, `shared_components/js/pricing-pages.js` | `/api/product-colors` | Fetches product color information and images for display |
| **Pricing Matrix** | `pricing-matrix-api.js`, `shared_components/js/pricing-matrix-api.js` | `/api/pricing-matrix/{id}` | Retrieves specific pricing matrix data by ID |
| **Pricing Matrix Capture** | `pricing-matrix-capture.js`, `shared_components/js/pricing-matrix-capture.js` | `/api/pricing-matrix` (POST) | Captures and stores pricing matrix data |
| **Cart Price Recalculator** | `cart-price-recalculator.js`, `shared_components/js/cart-price-recalculator.js` | `/api/pricing-matrix/lookup`<br>`/api/cart-item-sizes/{id}` (PUT) | Looks up pricing matrices and updates cart item sizes with recalculated prices |
| **C112 BOGO Promo** | `c112-bogo-promo.js` | `/api/customers` (POST) | Creates customer records for promotional orders |
| **Server** | `server.js` | All endpoints (proxy implementation) | Express server that proxies all API requests to Caspio backend |

### Endpoints by Pricing Page Type

| Pricing Page | Primary Endpoints | Secondary Endpoints |
|--------------|-------------------|---------------------|
| **Embroidery Pricing** | `/api/product-colors`<br>`/api/inventory` | `/api/cart-sessions`<br>`/api/cart-items`<br>`/api/cart-item-sizes` |
| **Cap Embroidery Pricing** | `/api/product-colors`<br>`/api/inventory` | `/api/cart-sessions`<br>`/api/cart-items`<br>`/api/cart-item-sizes` |
| **DTG Pricing** | `/api/product-colors`<br>`/api/inventory` | `/api/cart-sessions`<br>`/api/cart-items`<br>`/api/cart-item-sizes` |
| **DTF Pricing** | `/api/product-colors`<br>`/api/inventory` | `/api/cart-sessions`<br>`/api/cart-items`<br>`/api/cart-item-sizes` |
| **Screen Print Pricing** | `/api/product-colors`<br>`/api/inventory` | `/api/cart-sessions`<br>`/api/cart-items`<br>`/api/cart-item-sizes` |

### Actively Used Endpoints

The following endpoints are actively used across the pricing pages and cart functionality:

1. **Cart Management**
   - `/api/cart-sessions` - All CRUD operations
   - `/api/cart-sessions/{id}` - Get, Update, Delete specific sessions
   - `/api/cart-items` - All CRUD operations
   - `/api/cart-items/{id}` - Update, Delete specific items
   - `/api/cart-items/session/{sessionId}` - Get items by session
   - `/api/cart-item-sizes` - All CRUD operations
   - `/api/cart-item-sizes/{id}` - Update, Delete specific sizes
   - `/api/cart-item-sizes/cart-item/{cartItemId}` - Get sizes by cart item

2. **Product Information**
   - `/api/inventory` - Get inventory levels
   - `/api/product-colors` - Get product color information (custom endpoint, not in original docs)

3. **Pricing**
   - `/api/pricing-matrix` - Create new pricing matrix entries
   - `/api/pricing-matrix/{id}` - Get specific pricing matrix
   - `/api/pricing-matrix/lookup` - Find pricing matrix by criteria

4. **Customer Management**
   - `/api/customers` - Create customers (used by promo pages)

5. **Utility**
   - `/api/image-proxy` - Proxy external images
   - `/api/cart-integration.js` - Serve cart integration script

### Potentially Redundant or Unused Endpoints

Based on the code analysis, the following endpoints appear to be unused by the pricing pages:

1. **Customer Management**
   - `/api/customers` (GET all) - Not used
   - `/api/customers/email/{email}` - Not used
   - `/api/customers/{id}` - Update customer - Not used

2. **Order Management** - None of these are used by pricing pages
   - `/api/orders` - All operations
   - `/api/orders/{id}` - All operations

3. **Pricing Matrix**
   - `/api/pricing-matrix` (GET with query params) - Not used directly
   - `/api/pricing-matrix/{id}` (PUT) - Update not used

### Recommendations for Endpoint Optimization

1. **Consolidate Product Endpoints**
   - The `/api/product-colors` endpoint is not documented but is actively used
   - Consider consolidating product information endpoints into a single `/api/products/{styleNumber}` endpoint that returns all product data including colors, inventory, and basic info

2. **Optimize Cart Item Operations**
   - Consider adding a bulk update endpoint for cart items to reduce API calls when updating multiple sizes
   - Add a `/api/cart-items/bulk` endpoint for batch operations

3. **Pricing Matrix Improvements**
   - The current lookup endpoint could be enhanced to support batch lookups
   - Consider caching frequently accessed pricing matrices

4. **Remove Unused Endpoints**
   - The order management endpoints are not used by pricing pages and could be moved to a separate order management API
   - Some customer endpoints are unused and could be removed or consolidated

5. **Add Missing Documentation**
   - Document the `/api/product-colors` endpoint that is actively used
   - Add response examples for all endpoints
   - Include rate limiting information

6. **Performance Optimizations**
   - Implement response compression for large data sets
   - Add ETags for caching unchanged resources
   - Consider GraphQL for more efficient data fetching (request only needed fields)

### Notes

- All pricing pages use the same core set of endpoints
- The cart system is the most API-intensive component
- Most API calls originate from the cart management and product display functionality
- The server.js file acts as a proxy, forwarding all requests to the Caspio backend

### Image and Swatch Loading Analysis

This analysis examines how product images and color swatches are loaded and displayed across the pricing pages.

#### Image Loading Mechanisms

1. **Direct External URL Loading**
   - **Primary Method**: Images are loaded directly from external CDNs, primarily `cdnm.sanmar.com`
   - **Implementation**: The `src` attribute of `<img>` elements is set directly to the external URL
   - **Example URLs**:
     ```
     https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/PC54_black_model_front_082010.jpg
     https://www.sanmar.com/cs/images/products/large/PC54_BLACK_lrg.jpg
     ```

2. **Image Proxy Endpoint**
   - **Endpoint**: `/api/image-proxy?url={encodedUrl}`
   - **Purpose**: Bypass CORS restrictions when loading external images
   - **Usage**: Primarily used in `order-form-pdf.js` for PDF generation
   - **Not widely used**: The pricing pages themselves do NOT use this proxy for displaying images

3. **Image URL Sources**
   - Images URLs come from API responses, specifically:
     - `MAIN_IMAGE_URL` - Primary product image
     - `FRONT_MODEL` - Front model view
     - `FRONT_FLAT` - Front flat view
     - `BACK_MODEL` - Back model view
     - `BACK_FLAT` - Back flat view
     - `SIDE_MODEL` - Side model view
     - `COLOR_SQUARE_IMAGE` - Color swatch square image
     - `COLOR_SWATCH_IMAGE_URL` - Alternative swatch image

#### Color Swatch Loading

1. **API Endpoints for Swatches**
   - **Primary**: `/api/product-colors?styleNumber={styleNumber}`
     - Returns comprehensive color data including all image URLs
     - Used by `pricing-pages.js` and `shared_components/js/pricing-pages.js`
   
   - **Fallback**: `/api/color-swatches?styleNumber={styleNumber}`
     - Legacy endpoint still used by `dp5-helper.js`
     - Returns basic color swatch information

2. **Swatch Display Methods**
   - **Background Images**: Swatches use `background-image` CSS property
     ```javascript
     swatch.style.backgroundImage = `url('${color.COLOR_SQUARE_IMAGE}')`;
     ```
   - **Fallback Colors**: If no swatch image is available, uses:
     - `HEX_CODE` from API response
     - Normalized color name as background color

3. **Swatch Image Sources**
   - `COLOR_SQUARE_IMAGE` - Primary swatch image (preferred)
   - `COLOR_SWATCH_IMAGE_URL` - Alternative swatch image
   - Direct URLs from SanMar CDN

#### API Response Structure

The `/api/product-colors` endpoint returns data structured like:
```json
{
  "productTitle": "Port & Company PC54",
  "colors": [
    {
      "COLOR_NAME": "Black",
      "CATALOG_COLOR": "Black",
      "HEX_CODE": "#000000",
      "COLOR_SQUARE_IMAGE": "https://cdnm.sanmar.com/catalog/images/imglib/colors/square/black.jpg",
      "COLOR_SWATCH_IMAGE_URL": "https://cdnm.sanmar.com/catalog/images/imglib/colors/swatch/black.jpg",
      "MAIN_IMAGE_URL": "https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/PC54_black_model_front_082010.jpg",
      "FRONT_MODEL": "https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/PC54_black_model_front_082010.jpg",
      "FRONT_FLAT": "https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/PC54_black_flat_front_082010.jpg",
      "BACK_MODEL": "https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/PC54_black_model_back_082010.jpg",
      "BACK_FLAT": "https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/PC54_black_flat_back_082010.jpg"
    }
  ]
}
```

#### Image Gallery Implementation

The newer pricing pages (DTF, Cap Embroidery) implement an image gallery with:
- **Main Image Display**: `#product-image-main` element
- **Thumbnail Navigation**: `#image-thumbnails` container
- **Multiple Views**: Automatically creates thumbnails for all available image types
- **Click to Switch**: Clicking thumbnails updates the main image

#### Key Findings

1. **No API Processing of Images**
   - Images are NOT served through the application's API
   - All image URLs point directly to external CDNs
   - The `/api/image-proxy` endpoint exists but is rarely used

2. **CDN Direct Access**
   - Primary CDN: `cdnm.sanmar.com`
   - Secondary: `www.sanmar.com`
   - Images load directly in the browser without server intervention

3. **Performance Implications**
   - Direct CDN loading is faster (no proxy overhead)
   - Relies on CDN availability and CORS headers
   - Browser caches images directly from CDN

4. **Fallback Mechanisms**
   - Multiple image URL fields provide fallbacks
   - Color swatches fall back to hex codes or color names
   - Error handling displays placeholder messages

#### Implementation Patterns

1. **Product Image Updates** (from `pricing-pages.js`):
   ```javascript
   function updateMainProductImage(imageUrl) {
       const imageEl = document.getElementById('product-image-context');
       if (imageUrl) {
           imageEl.src = imageUrl;  // Direct URL assignment
       }
   }
   ```

2. **Swatch Creation** (from `dp5-helper.js`):
   ```javascript
   const swatchImage = color.COLOR_SQUARE_IMAGE || color.COLOR_SWATCH_IMAGE_URL;
   if (swatchImage) {
       swatch.style.backgroundImage = `url('${swatchImage}')`;
   } else if (color.HEX_CODE) {
       swatch.style.backgroundColor = color.HEX_CODE;
   }
   ```

3. **Cart Image Storage**:
   - Product images are stored with cart items
   - The `imageUrl` field contains the direct CDN URL
   - Used for order forms and cart display

#### Recommendations

1. **Consider Image Optimization**
   - Implement lazy loading for thumbnail galleries
   - Add image preloading for better performance
   - Consider WebP format support with fallbacks

2. **Enhance Error Handling**
   - Add retry logic for failed image loads
   - Implement better placeholder images
   - Log image loading failures for monitoring

3. **Caching Strategy**
   - Leverage browser caching with proper headers
   - Consider service worker for offline image access
   - Implement progressive image loading

4. **API Consolidation**
   - The `/api/image-proxy` endpoint could be removed if not needed
   - Consider consolidating `/api/product-colors` and `/api/color-swatches`