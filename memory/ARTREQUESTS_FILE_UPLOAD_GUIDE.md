# ArtRequests File Upload Guide

**Last Updated:** 2026-01-11 (expanded with all 4 file fields)

Upload art files to the Caspio `ArtRequests` table using the existing file upload API.

---

## Overview

| Component | Details |
|-----------|---------|
| **Table** | `ArtRequests` |
| **Storage** | Caspio Files API v3 |
| **Max Size** | 20MB per file |

### File Upload Fields (4 Total)

The ArtRequests table supports **up to 4 file uploads** per request:

| File Field | CDN Formula Field | Purpose |
|------------|-------------------|---------|
| `File_Upload_One` | `CDN_Link` | Primary artwork file |
| `File_Upload_Two` | `CDN_Link_Two` | Additional artwork/reference |
| `File_Upload_Three` | `CDN_Link_Three` | Additional artwork/reference |
| `File_Upload_Four` | `CDN_Link_Four` | Additional artwork/reference |

**Key Concepts:**
- Each File field stores an **ExternalKey** (UUID string), not the actual file data
- The file itself is stored in Caspio's file system
- **CDN_Link fields are auto-generated** - Caspio creates these Formula fields to provide direct URLs to the uploaded files

---

## How It Works

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Browser picks  │ --> │  POST /api/files/   │ --> │  Caspio Files   │
│  file (base64)  │     │  upload             │     │  API stores it  │
└─────────────────┘     └─────────────────────┘     └────────┬────────┘
                                                             │
                                                    Returns ExternalKey
                                                             │
                                                             v
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  File viewable  │ <-- │  GET /api/files/    │ <-- │  ArtRequest     │
│  in dashboard   │     │  {externalKey}      │     │  stores key     │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
```

---

## Step-by-Step Upload Flow

### Step 1: Upload File to Caspio

**Endpoint:** `POST /api/files/upload`

**Request:**
```javascript
const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'customer-artwork.png',
    fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    description: 'Artwork for design #12345'  // Optional
  })
});

const result = await response.json();
// result = { success: true, externalKey: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", fileName: "customer-artwork.png" }
```

**Response:**
```json
{
  "success": true,
  "externalKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "fileName": "customer-artwork.png",
  "size": 12345,
  "mimeType": "image/png"
}
```

### Step 2: Create ArtRequest with File Reference

**Endpoint:** `POST /api/artrequests`

**Request:**
```javascript
const artRequest = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    CompanyName: 'Acme Corp',
    Status: 'New',
    CustomerServiceRep: 'John Smith',
    Priority: 'Normal',
    File_Upload_One: result.externalKey  // <-- Store the ExternalKey here
  })
});
```

### Step 3: Retrieve File Later

**Endpoint:** `GET /api/files/{externalKey}`

```javascript
// Get file as download
const fileUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/${externalKey}`;

// Display in img tag
<img src={fileUrl} alt="Uploaded artwork" />

// Or trigger download
window.open(fileUrl, '_blank');
```

---

## Complete Frontend Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Art Request Submission</title>
</head>
<body>
  <form id="artRequestForm">
    <div>
      <label>Company Name:</label>
      <input type="text" id="companyName" required>
    </div>
    <div>
      <label>Upload Artwork:</label>
      <input type="file" id="artworkFile" accept="image/*,.pdf,.ai,.eps,.psd">
    </div>
    <div>
      <label>Priority:</label>
      <select id="priority">
        <option value="Normal">Normal</option>
        <option value="Rush">Rush</option>
        <option value="Low">Low</option>
      </select>
    </div>
    <button type="submit">Submit Art Request</button>
  </form>

  <div id="status"></div>

  <script>
    const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

    document.getElementById('artRequestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusDiv = document.getElementById('status');

      try {
        statusDiv.textContent = 'Uploading artwork...';

        // Step 1: Upload the file
        let externalKey = null;
        const fileInput = document.getElementById('artworkFile');

        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];

          // Validate file size (20MB max)
          if (file.size > 20 * 1024 * 1024) {
            throw new Error('File too large. Maximum size is 20MB.');
          }

          // Convert file to base64
          const base64Data = await fileToBase64(file);

          // Upload to Caspio via proxy
          const uploadResponse = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: base64Data,
              description: `Art request from ${document.getElementById('companyName').value}`
            })
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'File upload failed');
          }

          externalKey = uploadResult.externalKey;
          console.log('File uploaded, ExternalKey:', externalKey);
        }

        // Step 2: Create the ArtRequest record
        statusDiv.textContent = 'Creating art request...';

        const artRequestData = {
          CompanyName: document.getElementById('companyName').value,
          Status: 'New',
          Priority: document.getElementById('priority').value,
          Date_Created: new Date().toISOString()
        };

        // Add file reference if file was uploaded
        if (externalKey) {
          artRequestData.File_Upload_One = externalKey;
        }

        const artResponse = await fetch(`${API_BASE}/artrequests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(artRequestData)
        });

        const artResult = await artResponse.json();

        if (artResult.error) {
          throw new Error(artResult.error);
        }

        statusDiv.innerHTML = `<span style="color: green;">Success! Art request created.</span>`;

        // Clear form
        document.getElementById('artRequestForm').reset();

      } catch (error) {
        console.error('Error:', error);
        statusDiv.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
      }
    });

    // Helper function to convert File to base64 data URL
    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  </script>
</body>
</html>
```

---

## API Reference

### Upload File

| Property | Value |
|----------|-------|
| **URL** | `POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload` |
| **Content-Type** | `application/json` |
| **Body** | `{ fileName, fileData, description }` |
| **Returns** | `{ success, externalKey, fileName, size, mimeType }` |

### Create ArtRequest

| Property | Value |
|----------|-------|
| **URL** | `POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests` |
| **Content-Type** | `application/json` |
| **Body** | ArtRequest fields including `File_Upload_One` |

### Update ArtRequest (Add File to Existing)

| Property | Value |
|----------|-------|
| **URL** | `PUT https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests/{id}` |
| **Content-Type** | `application/json` |
| **Body** | `{ File_Upload_One: "externalKey" }` |

### Retrieve File

| Property | Value |
|----------|-------|
| **URL** | `GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/{externalKey}` |
| **Returns** | File binary data with correct Content-Type |

### Get File Metadata

| Property | Value |
|----------|-------|
| **URL** | `GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/{externalKey}/info` |
| **Returns** | `{ externalKey, fileName, contentType, size }` |

---

## ArtRequests Table Fields

### File Fields (Store ExternalKeys)

| Field | Type | CDN Formula |
|-------|------|-------------|
| `File_Upload_One` | File | `CDN_Link` |
| `File_Upload_Two` | File | `CDN_Link_Two` |
| `File_Upload_Three` | File | `CDN_Link_Three` |
| `File_Upload_Four` | File | `CDN_Link_Four` |

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `ID_Design` | Autonumber | **Primary Key** |
| `Status` | Text (255) | Request status |
| `CompanyName` | Text (255) | Customer company name |
| `Due_Date` | Date/Time | Due date for completion |
| `Priority` | Text (255) | Low, Med, High |
| `CustomerServiceRep` | Text (255) | Assigned CSR |
| `Sales_Rep` | Text (255) | Sales representative |
| `Order_Type` | List-String | Type of order |
| `Date_Created` | Timestamp | Auto-generated creation date |

### Notes Fields

| Field | Type | Description |
|-------|------|-------------|
| `NOTES` | Text (64000) | Notes to Steve |
| `Note_Mockup` | Text (64000) | Notes to Artist |
| `Mockup` | Yes/No | Mockup requested |
| `Revision_Count` | Integer | Number of revisions |

### Customer Reference Fields

| Field | Type | Description |
|-------|------|-------------|
| `id_customer` | Number | FK to New Customer Table |
| `id_contact` | Number | FK to Contact in New Customer Table |
| `Shopwork_customer_number` | Number | ShopWorks Customer Number |
| `Company_ID` | Text (255) | Customer # |
| `First_name` | Text (255) | Customer first name |
| `Last_name` | Text (255) | Customer last name |
| `Full_Name_Contact` | Text (255) | Contact full name |
| `Email_Contact` | Text (255) | Contact email |
| `Phone` | Text (255) | Phone number |

### Garment Fields

| Field | Type | Description |
|-------|------|-------------|
| `GarmentStyle` | Text (255) | Primary garment style |
| `GarmentColor` | Text (255) | Primary garment color |
| `Garment_Placement` | Text (255) | Print/embroidery placement |
| `Garm_Style_2/3/4` | Text (255) | Additional garment styles |
| `Garm_Color_2/3/4` | Text (255) | Additional garment colors |
| `Swatch_1/2/3/4` | Text (255) | Color swatches |
| `MAIN_IMAGE_URL_1/2/3/4` | Text (255) | Main image URLs |

### Billing Fields

| Field | Type | Description |
|-------|------|-------------|
| `Prelim_Charges` | Currency | Art estimate from AE |
| `Additional_Services` | Currency | Additional service charges |
| `Art_Minutes` | Number | Art time in minutes |
| `Amount_Art_Billed` | Formula | Calculated billing amount |
| `Invoiced` | Yes/No | Invoice status |
| `Date Steve Invoiced Art` | Date/Time | Invoice date |

---

## Supported File Types

| Category | Extensions |
|----------|------------|
| **Images** | PNG, JPEG, JPG, GIF, SVG, WebP |
| **Documents** | PDF |
| **Design Files** | AI, PSD, EPS, INDD, CDR |
| **Archives** | ZIP, RAR |
| **Office** | DOCX, XLSX, DOC, XLS |

**Maximum File Size:** 20MB per file

---

## Troubleshooting

### Error: "File too large"
- File exceeds 20MB limit
- Solution: Compress or resize the file

### Error: "Invalid file type"
- File extension not in allowed list
- Solution: Convert to supported format (e.g., convert BMP to PNG)

### Error: "Invalid base64"
- Malformed base64 data URL
- Solution: Ensure FileReader.readAsDataURL() completed successfully

### Error: "CASPIO_API_ERROR"
- Caspio API returned an error
- Check: Caspio account status, API limits, authentication

### File Not Displaying
- Verify ExternalKey was saved correctly
- Test: `curl https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/{externalKey}`

---

## Uploading Multiple Files

To upload multiple artwork files, upload each file separately and store each ExternalKey in the corresponding field:

```javascript
// Upload multiple files to different fields
async function uploadMultipleArtFiles(files) {
  const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
  const fileFields = ['File_Upload_One', 'File_Upload_Two', 'File_Upload_Three', 'File_Upload_Four'];
  const artRequestData = {
    CompanyName: 'Acme Corp',
    Status: 'New',
    Priority: 'Normal'
  };

  // Upload each file and store ExternalKey
  for (let i = 0; i < Math.min(files.length, 4); i++) {
    const base64Data = await fileToBase64(files[i]);

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: files[i].name,
        fileData: base64Data
      })
    });

    const result = await response.json();
    if (result.success) {
      artRequestData[fileFields[i]] = result.externalKey;
    }
  }

  // Create ArtRequest with all file references
  const artResponse = await fetch(`${API_BASE}/artrequests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(artRequestData)
  });

  return artResponse.json();
}
```

---

## Testing with cURL

```bash
# 1. Upload a test file (1x1 transparent PNG)
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-artwork.png",
    "fileData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
  }'

# Response: {"success":true,"externalKey":"abc123...","fileName":"test-artwork.png"}

# 2. Create ArtRequest with multiple file references
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests \
  -H "Content-Type: application/json" \
  -d '{
    "CompanyName": "Test Company",
    "Status": "New",
    "Priority": "Normal",
    "File_Upload_One": "abc123...",
    "File_Upload_Two": "def456...",
    "File_Upload_Three": "ghi789..."
  }'

# 3. Verify file retrieval
curl -I https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/abc123...
# Should return 200 OK with Content-Type header
```

---

## Related Documentation

- [FILE_UPLOAD_API_REQUIREMENTS.md](./FILE_UPLOAD_API_REQUIREMENTS.md) - Full API specification
- [CASPIO_API_CORE.md](./CASPIO_API_CORE.md) - Caspio API overview
- Backend implementation: `caspio-pricing-proxy/src/routes/files-simple.js`
- ArtRequests API: `caspio-pricing-proxy/src/routes/art.js`
