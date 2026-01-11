# ArtRequests File Upload Guide

**Last Updated:** 2026-01-11 (corrected upload to multipart/form-data, verified end-to-end)

Upload art files to the Caspio `ArtRequests` table using the existing file upload API.

---

## CRITICAL: Store File Paths, Not ExternalKeys

**Existing ArtRequests records (3000+) store FILE PATHS like `/Artwork/logo.png`, not UUIDs.**

The CDN_Link formula fields auto-generate URLs from these paths. To maintain consistency:

```javascript
// CORRECT - Store file path
const filePath = `/Artwork/${result.fileName}`;
artRequestData.File_Upload_One = filePath;  // "/Artwork/logo.png"

// WRONG - Don't store ExternalKey
artRequestData.File_Upload_One = result.externalKey;  // Breaks CDN_Link formula!
```

---

## Overview

| Component | Details |
|-----------|---------|
| **Table** | `ArtRequests` |
| **Storage** | Caspio Files API v3 |
| **Max Size** | 20MB per file |
| **File Path Format** | `/Artwork/{filename}` |

### File Upload Fields (4 Total)

The ArtRequests table supports **up to 4 file uploads** per request:

| File Field | CDN Formula Field | Purpose |
|------------|-------------------|---------|
| `File_Upload_One` | `CDN_Link` | Primary artwork file |
| `File_Upload_Two` | `CDN_Link_Two` | Additional artwork/reference |
| `File_Upload_Three` | `CDN_Link_Three` | Additional artwork/reference |
| `File_Upload_Four` | `CDN_Link_Four` | Additional artwork/reference |

**Key Concepts:**
- Each File field stores a **file path** (e.g., `/Artwork/logo.png`), not the actual file data
- The file itself is stored in Caspio's file system
- **CDN_Link fields are formula fields** - They auto-generate URLs from the file paths

---

## CDN_Link Formula

The CDN_Link formula fields use this pattern:

```sql
CASE WHEN [@field:File_Upload_One] IS NULL THEN NULL
ELSE 'https://cdn.caspio.com/A0E15000' + REPLACE(CAST([@field:File_Upload_One] AS VARCHAR(MAX)), ' ', '%20')
END
```

**Example:**
| File_Upload_One | CDN_Link (auto-generated) |
|-----------------|---------------------------|
| `/Artwork/logo.png` | `https://cdn.caspio.com/A0E15000/Artwork/logo.png` |
| `/Artwork/My Logo (1).png` | `https://cdn.caspio.com/A0E15000/Artwork/My%20Logo%20(1).png` |
| `NULL` | `NULL` |

---

## How It Works

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Browser picks  │ --> │  POST /api/files/   │ --> │  Caspio Files   │
│  file (FormData)│     │  upload             │     │  API stores it  │
└─────────────────┘     └─────────────────────┘     └────────┬────────┘
                                                            │
                                                   Returns fileName
                                                            │
                                                            v
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  File viewable  │ <-- │  CDN_Link formula   │ <-- │  ArtRequest     │
│  via CDN URL    │     │  auto-generates URL │     │  stores path    │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
```

---

## Step-by-Step Upload Flow

### Step 1: Upload File to Caspio

**Endpoint:** `POST /api/files/upload`

**Format:** `multipart/form-data` (NOT JSON)

**Request:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);  // File from <input type="file">

const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload', {
  method: 'POST',
  body: formData  // No Content-Type header - browser sets it automatically with boundary
});

const result = await response.json();
// result = { success: true, externalKey: "a1b2c3d4-...", fileName: "customer-artwork.png" }
```

**Response:**
```json
{
  "success": true,
  "externalKey": "971fb592-e5a1-4aac-9e27-fa9194a5e663",
  "fileName": "customer-artwork.png",
  "originalName": "customer-artwork.png",
  "size": 12345,
  "mimeType": "image/png"
}
```

### Step 2: Construct File Path (CRITICAL)

```javascript
// Use fileName from response, NOT externalKey
const filePath = `/Artwork/${result.fileName}`;
// filePath = "/Artwork/customer-artwork.png"
```

### Step 3: Create ArtRequest with File Path

**Endpoint:** `POST /api/artrequests`

```javascript
const artRequest = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    CompanyName: 'Acme Corp',
    Status: 'New',
    CustomerServiceRep: 'John Smith',
    Priority: 'Normal',
    File_Upload_One: filePath  // <-- Store the FILE PATH, not externalKey!
  })
});
```

### Step 4: Access File via CDN

After saving, the CDN_Link formula automatically generates the URL:

```javascript
// CDN_Link will be: https://cdn.caspio.com/A0E15000/Artwork/customer-artwork.png

// Display in img tag
<img src={record.CDN_Link} alt="Uploaded artwork" />

// Or use the URL pattern directly
const cdnUrl = `https://cdn.caspio.com/A0E15000${filePath.replace(/ /g, '%20')}`;
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

        // Step 1: Upload the file using FormData
        let filePath = null;
        const fileInput = document.getElementById('artworkFile');

        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];

          // Validate file size (20MB max)
          if (file.size > 20 * 1024 * 1024) {
            throw new Error('File too large. Maximum size is 20MB.');
          }

          // Create FormData and append file
          const formData = new FormData();
          formData.append('file', file);

          // Upload to Caspio via proxy (multipart/form-data)
          const uploadResponse = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            body: formData  // No Content-Type header - browser sets it automatically
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'File upload failed');
          }

          // CRITICAL: Construct file path from fileName, NOT externalKey
          filePath = `/Artwork/${uploadResult.fileName}`;
          console.log('File uploaded, Path:', filePath);
        }

        // Step 2: Create the ArtRequest record
        statusDiv.textContent = 'Creating art request...';

        const artRequestData = {
          CompanyName: document.getElementById('companyName').value,
          Status: 'New',
          Priority: document.getElementById('priority').value
        };

        // Add file path if file was uploaded
        if (filePath) {
          artRequestData.File_Upload_One = filePath;
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
| **Content-Type** | `multipart/form-data` |
| **Body** | Form field: `file` (binary file data) |
| **Max Size** | 20MB |
| **Returns** | `{ success, externalKey, fileName, originalName, size, mimeType }` |

**Note:** Use `fileName` from response to construct file path. The `externalKey` is for alternative retrieval only.

### Create ArtRequest

| Property | Value |
|----------|-------|
| **URL** | `POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests` |
| **Content-Type** | `application/json` |
| **Body** | ArtRequest fields with `File_Upload_One: "/Artwork/filename.ext"` |

### Update ArtRequest (Add File to Existing)

| Property | Value |
|----------|-------|
| **URL** | `PUT https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests/{id}` |
| **Content-Type** | `application/json` |
| **Body** | `{ File_Upload_One: "/Artwork/filename.ext" }` |

### Retrieve File (Alternative Method)

| Property | Value |
|----------|-------|
| **URL** | `GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/{externalKey}` |
| **Returns** | File binary data with correct Content-Type |

**Note:** Primary access should use CDN_Link URL. ExternalKey retrieval is for edge cases.

---

## ArtRequests Table Fields

### File Fields (Store File Paths)

| Field | Type | CDN Formula | Example Value |
|-------|------|-------------|---------------|
| `File_Upload_One` | File | `CDN_Link` | `/Artwork/logo.png` |
| `File_Upload_Two` | File | `CDN_Link_Two` | `/Artwork/reference.pdf` |
| `File_Upload_Three` | File | `CDN_Link_Three` | `/Artwork/mockup.ai` |
| `File_Upload_Four` | File | `CDN_Link_Four` | `/Artwork/notes.pdf` |

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

### Error: "NO_FILE"
- No file was provided in the upload request
- Solution: Ensure FormData has `file` field with actual file data

### Error: "CASPIO_API_ERROR"
- Caspio API returned an error
- Check: Caspio account status, API limits, authentication

### File Not Displaying via CDN_Link
- Verify file path was saved correctly (should start with `/Artwork/`)
- Check for special characters in filename
- Test CDN URL directly in browser

### CDN_Link Shows Base URL Only
- File_Upload field is NULL or empty
- Verify file path was saved to the correct field

---

## Uploading Multiple Files

To upload multiple artwork files, upload each file separately and store each path:

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

  // Upload each file using FormData and store file path
  for (let i = 0; i < Math.min(files.length, 4); i++) {
    const formData = new FormData();
    formData.append('file', files[i]);

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData  // multipart/form-data
    });

    const result = await response.json();
    if (result.success) {
      // CRITICAL: Store file path, not externalKey
      const filePath = `/Artwork/${result.fileName}`;
      artRequestData[fileFields[i]] = filePath;
    }
  }

  // Create ArtRequest with all file paths
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
# 1. Upload a test file (multipart/form-data)
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload \
  -F "file=@/path/to/your/image.png"

# Response: {"success":true,"externalKey":"abc123...","fileName":"image.png","size":12345}

# 2. Create ArtRequest with file PATH (not externalKey!)
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/artrequests \
  -H "Content-Type: application/json" \
  -d '{
    "CompanyName": "Test Company",
    "Status": "New",
    "Priority": "Normal",
    "File_Upload_One": "/Artwork/image.png"
  }'

# 3. Access file via CDN (CDN_Link formula generates this automatically)
curl -I "https://cdn.caspio.com/A0E15000/Artwork/image.png"
# Should return 200 OK

# 4. Alternative: Create test PNG and upload
echo -n 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > /tmp/test.png
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload \
  -F "file=@/tmp/test.png;filename=test-artwork.png"
```

---

## Key Differences: File Path vs ExternalKey

| Aspect | File Path (CORRECT) | ExternalKey (WRONG) |
|--------|---------------------|---------------------|
| **Format** | `/Artwork/logo.png` | `a1b2c3d4-e5f6-...` |
| **CDN_Link Works** | Yes - formula auto-generates URL | No - formula produces invalid URL |
| **Matches Existing Data** | Yes - 3000+ records use this | No - inconsistent |
| **Access Method** | Direct CDN URL | Proxy API call required |
| **Staff-Friendly** | Yes - URLs work in browser | No - requires app to retrieve |

---

## Related Documentation

- [FILE_UPLOAD_API_REQUIREMENTS.md](./FILE_UPLOAD_API_REQUIREMENTS.md) - Full API specification
- [CASPIO_API_CORE.md](./CASPIO_API_CORE.md) - Caspio API overview
- Backend implementation: `caspio-pricing-proxy/src/routes/files-simple.js`
- ArtRequests API: `caspio-pricing-proxy/src/routes/art.js`
