# File Upload API Requirements for Caspio Pricing Proxy

## Overview
This document specifies the file upload endpoints needed in the Heroku Caspio Pricing Proxy to support logo uploads in the Christmas Bundle application. These endpoints will handle conversion between browser-friendly base64 format and Caspio's multipart/form-data Files API.

## Background
- **Caspio Files API**: Uses `/v3/files` endpoints with multipart/form-data format
- **Browser Limitation**: HTML file inputs provide base64 data URLs
- **Database Field**: `Image_Upload` field in `quote_items` table stores ExternalKey references
- **Use Case**: Customers upload logos for Christmas bundle customization

## Required Endpoints

### 1. POST /api/files/upload
Upload a file to Caspio from base64 data

**Request Body:**
```json
{
  "fileName": "customer-logo.png",
  "fileData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "description": "Customer logo for Quote XMAS0130-1" // Optional
}
```

**Implementation Steps:**
1. Extract MIME type from data URL (e.g., `image/png` from `data:image/png;base64,`)
2. Extract base64 string after the comma
3. Convert base64 to Buffer: `Buffer.from(base64String, 'base64')`
4. Create FormData with the file buffer
5. POST to Caspio: `POST https://c1abd578.caspio.com/rest/v3/files`
6. Include Authorization header: `Bearer ${accessToken}`
7. Return the ExternalKey from Caspio's response

**Response:**
```json
{
  "success": true,
  "externalKey": "ABC123DEF456",
  "fileName": "customer-logo.png",
  "fileSize": 12345,
  "uploadedAt": "2025-01-30T12:00:00Z"
}
```

**Error Handling:**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 20MB",
  "code": "FILE_TOO_LARGE"
}
```

### 2. GET /api/files/:externalKey
Retrieve a file's download URL from Caspio

**Parameters:**
- `externalKey`: The Caspio file identifier

**Implementation:**
1. GET from Caspio: `GET https://c1abd578.caspio.com/rest/v3/files/${externalKey}`
2. Include Authorization header
3. Return the download URL or file data

**Response:**
```json
{
  "success": true,
  "externalKey": "ABC123DEF456",
  "fileName": "customer-logo.png",
  "downloadUrl": "https://c1abd578.caspio.com/rest/v3/files/ABC123DEF456/download",
  "contentType": "image/png",
  "size": 12345
}
```

### 3. GET /api/files/:externalKey/info
Get file metadata without downloading

**Parameters:**
- `externalKey`: The Caspio file identifier

**Implementation:**
1. HEAD request to Caspio: `HEAD https://c1abd578.caspio.com/rest/v3/files/${externalKey}`
2. Parse headers for metadata
3. Return file information

**Response:**
```json
{
  "success": true,
  "externalKey": "ABC123DEF456",
  "fileName": "customer-logo.png",
  "contentType": "image/png",
  "size": 12345,
  "lastModified": "2025-01-30T12:00:00Z"
}
```

### 4. POST /api/quote-items-with-file
Create a quote item with file upload in a single operation

**Request Body:**
```json
{
  "QuoteID": "XMAS0130-1",
  "LineNumber": 1,
  "ProductName": "Christmas Gift Bundle",
  "StyleNumber": "BUNDLE-2025",
  "Quantity": 100,
  "BaseUnitPrice": 75.00,
  "FinalUnitPrice": 75.00,
  "LineTotal": 7500.00,
  "ImageUpload": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "Notes": "Customer uploaded logo for customization"
}
```

**Implementation Steps:**
1. Extract the `ImageUpload` field if present
2. If ImageUpload contains base64 data:
   - Upload file using the `/api/files/upload` logic
   - Get the ExternalKey from response
   - Replace `ImageUpload` field value with ExternalKey
3. Create quote item with modified data:
   - POST to existing `/api/quote_items` endpoint
   - Include ExternalKey in `Image_Upload` field
4. Return complete quote item with file reference

**Response:**
```json
{
  "success": true,
  "data": {
    "PK_ID": 12345,
    "QuoteID": "XMAS0130-1",
    "Image_Upload": "ABC123DEF456",
    "ImageURL": "https://c1abd578.caspio.com/rest/v3/files/ABC123DEF456/download",
    "ProductName": "Christmas Gift Bundle",
    // ... rest of quote item fields
  }
}
```

### 5. DELETE /api/files/:externalKey
Delete a file from Caspio

**Parameters:**
- `externalKey`: The Caspio file identifier

**Implementation:**
1. DELETE to Caspio: `DELETE https://c1abd578.caspio.com/rest/v3/files/${externalKey}`
2. Include Authorization header
3. Handle orphaned file cleanup

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully",
  "externalKey": "ABC123DEF456"
}
```

## Implementation Requirements

### Authentication
All Caspio API calls require Bearer token authentication:
```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'multipart/form-data' // for uploads
}
```

### File Validation
```javascript
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/svg+xml',
  'application/pdf'
];

function validateFile(base64Data, fileName) {
  // Extract MIME type
  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  if (!mimeMatch) throw new Error('Invalid base64 format');

  const mimeType = mimeMatch[1];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error(`File type ${mimeType} not allowed`);
  }

  // Check size (approximate from base64 length)
  const sizeApprox = (base64Data.length - mimeMatch[0].length) * 0.75;
  if (sizeApprox > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is 20MB`);
  }

  return { mimeType, sizeApprox };
}
```

### FormData Creation for Caspio
```javascript
const FormData = require('form-data');

function createFormDataFromBase64(base64Data, fileName) {
  // Remove data URL prefix
  const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');

  // Convert to Buffer
  const buffer = Buffer.from(base64String, 'base64');

  // Create FormData
  const formData = new FormData();
  formData.append('file', buffer, {
    filename: fileName,
    contentType: extractMimeType(base64Data)
  });

  return formData;
}
```

### Error Response Standards
All endpoints should return consistent error formats:
```javascript
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional information
}
```

Error codes:
- `FILE_TOO_LARGE` - File exceeds 20MB limit
- `INVALID_FILE_TYPE` - File type not supported
- `INVALID_BASE64` - Malformed base64 data
- `CASPIO_API_ERROR` - Caspio API returned an error
- `FILE_NOT_FOUND` - ExternalKey doesn't exist
- `AUTHENTICATION_FAILED` - Caspio authentication failed

## Testing Endpoints

### Test Upload
```bash
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-logo.png",
    "fileData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    "description": "Test upload"
  }'
```

### Test Quote Item with File
```bash
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote-items-with-file \
  -H "Content-Type: application/json" \
  -d '{
    "QuoteID": "TEST-001",
    "ProductName": "Test Product",
    "ImageUpload": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
  }'
```

## Frontend Integration Example

```javascript
// Christmas Bundle Application Usage
async function uploadCustomerLogo(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  // Convert to base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;

    try {
      // Upload file
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64Data,
          description: `Logo for ${customerName}`
        })
      });

      const result = await response.json();
      if (result.success) {
        // Store ExternalKey for quote submission
        window.uploadedLogoKey = result.externalKey;
        showSuccessMessage('Logo uploaded successfully!');
      } else {
        showErrorMessage(result.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorMessage('Failed to upload logo');
    }
  };

  reader.readAsDataURL(file);
}

// When submitting quote
async function submitQuoteWithLogo(quoteData) {
  if (window.uploadedLogoKey) {
    quoteData.Image_Upload = window.uploadedLogoKey;
  }

  // Submit quote with ExternalKey reference
  return await fetch('/api/quote_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteData)
  });
}
```

## Database Schema Notes

The `quote_items` table has an `Image_Upload` field that should store the ExternalKey:
- Field Name: `Image_Upload`
- Type: Text(255) or VARCHAR(255)
- Purpose: Stores Caspio File ExternalKey reference
- Format: Alphanumeric string like "ABC123DEF456"

## CORS Configuration
Ensure the Heroku proxy allows CORS for file uploads:
```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

## Implementation Priority
1. **High Priority**: `/api/files/upload` and `/api/quote-items-with-file` (needed for basic functionality)
2. **Medium Priority**: `/api/files/:externalKey` (for viewing uploaded files)
3. **Low Priority**: `/api/files/:externalKey/info` and `DELETE` endpoints (nice to have)

## Notes for API Provider Claude
- The Christmas Bundle app will send base64 data URLs from file inputs
- Caspio expects multipart/form-data with actual file buffers
- The proxy must handle this conversion transparently
- Store only the ExternalKey in the database, not the base64 data
- Ensure proper error messages for debugging during development
- Consider implementing request logging for troubleshooting

## Success Criteria
- Customer can upload a logo in the Christmas bundle form
- Logo gets uploaded to Caspio Files API
- ExternalKey is stored in quote_items.Image_Upload field
- Staff dashboard can retrieve and display the uploaded logo
- Quote emails reference the uploaded file