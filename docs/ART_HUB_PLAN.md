# Art Hub System Plan - Northwest Custom Apparel

## Overview

The Art Hub is a centralized workflow management system for Adriyella (Art Coordinator) to manage the artwork approval process between Account Executives (AEs), Steve (Graphic Artist), and customers. It streamlines the currently manual email/Slack process into a database-driven system with customer approval portal and automatic notifications.

## Division of Work: Caspio vs Website

### What Will Be Done in Caspio (90%)

1. **Database Tables**
   - ArtRequests table (already exists)
   - DesignNotes table (already exists with fields: Note_ID, ID_Design, Note_Type, Note_Text, Note_By, Note_Date, Parent_Note_ID)

2. **DataPages to Create**
   - **art_hub_dashboard** - Main dashboard view (Adriyella)
   - **art_hub_steve_dashboard** - Artist work queue (Steve)
   - **art_request_details** - Detailed view of single request
   - **design_notes_list** - Display notes for a request
   - **design_notes_add** - Form to add new notes
   - **art_approval_public** - Customer approval portal
   - **steve_time_entry** - Steve's time/billing form (can be integrated into steve_dashboard)

3. **Authentication & Permissions**
   - Use existing Bridge Authentication from staff dashboard
   - Filter dashboard by CustomerServiceRep email for AEs
   - Show all requests for Adriyella and Steve
   - Special fields visible only to Steve (art@nwcustomapparel.com)

4. **Triggered Actions (Email Notifications)**
   - When DesignNote is added → Email all parties
   - When Status changes → Email notifications
   - When customer approves → Email team

5. **Business Logic**
   - Status management (Submitted, In Progress, Awaiting Approval, Completed, Cancelled)
   - Conditional formatting based on Due_Date
   - Art billing calculation ($50 first hour, $75/hour after)

### What Will Be Done on Website (10%)

1. **HTML Container Pages**
   - `art-hub-dashboard.html` - Created with Caspio embed placeholder ✅
   - `art-hub-detail.html` - Created with 3 Caspio embed placeholders ✅
   - `art-approval.html` - Created as public page for customer approval ✅
   - `art-hub-steve.html` - Steve's artist dashboard ✅ COMPLETED

2. **Navigation Update**
   - Added "Art Hub" link to staff-dashboard.html in Art & Invoices section ✅
   - Added "Artist Dashboard" link (for Steve) ✅ COMPLETED

3. **Minimal Styling** ✅
   - Using existing crimson header (#981e32)
   - Back navigation links implemented
   - No custom JavaScript needed

## Integration with Existing Systems

The Art Hub acts as the workflow management layer between existing systems:

### 1. **AE Art System (Remains Unchanged)**
   - **ae-submit-art.html** - AEs continue to submit requests here
   - **ae-art-report.html** - AEs view their submitted requests
   - **ae-art-dashboard.html** - Redirects to ae-submit-art.html
   - **Purpose**: Initial art request submission by AEs

### 2. **Art Hub System (New Workflow Layer)**
   - **art-hub-dashboard.html** - Adriyella's central management view
   - **art-hub-steve.html** - Steve's artist work queue and time tracking
   - **art-hub-detail.html** - Team communication via DesignNotes
   - **art-approval.html** - Direct customer approval portal
   - **Purpose**: Manages workflow between submission and invoicing

### 3. **Art Invoicing System (Remains Unchanged)**
   - **art-invoice-creator.html** - Create invoices after approval
   - **art-invoices-dashboard.html** - View/manage invoices
   - **art-invoice-unified-dashboard.html** - Unified invoice view
   - **Purpose**: Billing for completed artwork

### Workflow Connection Points
1. AE submits in **ae-submit-art.html** → Appears in **art-hub-dashboard.html**
2. Team communicates in **art-hub-detail.html** → Updates visible in **ae-art-report.html**
3. Customer approves in **art-approval.html** → Ready for **art-invoice-creator.html**
4. Invoice created → Updates Invoiced field visible in all views

## Current State Analysis

### Existing Components

1. **AE Art Submission System**
   - `ae-submit-art.html` - Form for AEs to submit art requests
   - `ae-art-report.html` - Tabular report for viewing submitted requests
   - Caspio Datapage IDs:
     - Submit Form: `a0e150009f0e9f9d4ff3457dae47`
     - Report: `a0e1500056c95cb6e408495e8c4d`

2. **Art Invoicing System**
   - `art-invoices-dashboard.html` - Comprehensive invoicing dashboard
   - `art-invoice-creator.html` - Invoice creation tool
   - Features: Artwork display, payment tracking, email notifications

3. **Database Tables**
   - `ArtRequests` - Main table for art request data
   - `DesignNotes` - Communication tracking table
   - `Art_Invoices` - Invoice management

### ArtRequests Table Key Fields
- **ID_Design** - Primary key (AutoNumber)
- **Status** - Current status
- **CompanyName** - Customer company
- **Due_Date** - When artwork is needed
- **CustomerServiceRep** - AE handling the request
- **File_Upload_One/Two/Three/Four** - Artwork files (up to 4)
- **CDN_Link/Two/Three/Four** - CDN URLs for artwork
- **NOTES** - Notes to Steve
- **Art_Minutes** - Time spent on artwork
- **Amount_Art_Billed** - Calculated billing amount
- **Invoiced** - Whether invoiced (Yes/No)
- **Mockup** - Whether this is a mockup request
- **Order_Type** - Type of decoration (DTG, Screen Print, Embroidery, etc.)
- **Email_Contact** - Customer email
- **Phone** - Customer phone
- **User_Email** - AE's email who submitted

### DesignNotes Table Structure

```
DesignNotes
├── Note_ID (Autonumber, Primary Key)
├── ID_Design (Integer - Foreign Key to ArtRequests)
├── Note_Type (Text 255)
├── Note_Text (Text 64000)
├── Note_By (Text 255) - [@authfield:Email]
├── Note_Date (Timestamp)
└── Parent_Note_ID (Integer - for threaded replies)
```

### Design Pattern
- Minimal header with WSU Cougar crimson theme (#981e32)
- Simple Caspio embed structure
- Back navigation to staff dashboard

## Proposed Art Hub Architecture

### 1. Art Hub Dashboard (`art-hub-dashboard.html`)

**Website Component (Minimal HTML)**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Art Hub Dashboard - Northwest Custom Apparel</title>
    <link rel="icon" href="https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1" type="image/png">
    <style>
        /* Minimal styling matching ae-submit-art.html */
        body { margin: 0; font-family: Arial, sans-serif; }
        .minimal-header {
            background: #981e32;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .logo { height: 40px; filter: brightness(0) invert(1); }
        .back-link {
            color: white;
            text-decoration: none;
            font-size: 14px;
            padding: 8px 16px;
            border: 1px solid white;
            border-radius: 4px;
            transition: all 0.3s;
        }
        .back-link:hover { background: white; color: #981e32; }
    </style>
</head>
<body>
    <div class="minimal-header">
        <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
             alt="Northwest Custom Apparel" class="logo">
        <a href="/staff-dashboard.html" class="back-link">← Back to Staff Dashboard</a>
    </div>
    <!-- Caspio DataPage Embed -->
    <script type="text/javascript" src="https://c3eku948.caspio.com/dp/a0e15000[YOUR_DATAPAGE_KEY]/emb"></script>
</body>
</html>
```

**Caspio Component (art_hub_dashboard DataPage)**:
- Type: Tabular Report
- Source: ArtRequests table
- Authentication: Bridge Authentication (same as staff dashboard)
- Features:
  - Status count cards at top (using HTML blocks and aggregations)
  - Filtered view based on logged-in user:
    - If User_Email = [@authfield:Email] → Show only their requests
    - If [@authfield:Email] = "art@nwcustomapparel.com" → Show all
    - Else → Show all (for Adriyella and managers)
  - Display fields: ID_Design, CompanyName, Status, Due_Date, Order_Type
  - Inline editing for Status field
  - Conditional formatting on Due_Date (red if overdue)
  - Link to detail view: `art-hub-detail.html?ID_Design=[@field:ID_Design]`

### 2. Art Hub Detail View (`art-hub-detail.html`)

**Website Component (Minimal HTML)**:
Similar minimal structure, but with 3 Caspio embeds

**Caspio Components**:

**A. art_request_details DataPage**:
- Type: Details Page
- Source: ArtRequests table
- Parameter: ID_Design from URL
- Sections:
  - Request Info (all fields organized)
  - Artwork Gallery (4 image fields)
  - Steve-only section (visible if [@authfield:Email] = "art@nwcustomapparel.com"):
    - Art_Minutes input
    - Amount_Art_Billed display
    - Save button

**B. design_notes_list DataPage**:
- Type: List Report
- Source: DesignNotes table
- Filter: ID_Design = parameter
- Sort: Note_Date DESC
- Display format: Chat-style with Note_By, Note_Date, Note_Type, Note_Text

**C. design_notes_add DataPage**:
- Type: Submission Form
- Fields:
  - ID_Design (hidden, from URL parameter)
  - Note_Type (dropdown: Status Update, Design Update, Customer Feedback, Internal Note, Time Entry)
  - Note_Text (text area)
  - Note_By (hidden, auto-populate with [@authfield:Email])
  - Note_Date (hidden, auto-timestamp)

### 3. Customer Approval Portal (`art-approval.html`)

**Website Component**: Public page, no authentication

**Caspio Component (art_approval_public DataPage)**:
- Type: Single Record Update
- Source: ArtRequests table
- Authentication: None (public access)
- Parameter: ID_Design from URL
- Display only:
  - CompanyName
  - Latest artwork (CDN_Link fields)
  - Project details
- Update only:
  - Status field (buttons: "Approve" → "Completed", "Request Changes" → "In Progress")
  - Auto-add DesignNote with customer action

### 4. Steve's Artist Dashboard (`art-hub-steve.html`)

**Website Component (Minimal HTML)**:
Similar minimal structure to other Art Hub pages

**Caspio Component (art_hub_steve_dashboard DataPage)**:
- Type: Tabular Report with custom sections
- Source: ArtRequests table
- Authentication: Bridge Authentication (filtered for Steve)
- Key Features:
  - **Work Queue Section**:
    - Filter: Status = "In Progress" 
    - Sort: Due_Date ASC (urgent first)
    - Fields: ID_Design, CompanyName, Project Details, Due_Date, NOTES
    - Quick action buttons: Upload Art, Add Note, Mark Complete
    - Link to detail view for full editing
  - **Time & Billing Section**:
    - Prominent display of rates: "$50 first hour, $75/hour after"
    - Quick time entry field
    - Real-time calculation of Amount_Art_Billed
    - Running total of today's billable time
  - **Dashboard Cards**:
    - Active Jobs (count)
    - Today's Completed (count)
    - Week's Billable Hours (sum)
    - Pending Customer Approval (count)
  - **Recent Activity**:
    - Last 5 DesignNotes across all projects
    - Quick view of customer feedback

## Workflow Integration

### Standard Workflow Path

1. **AE Submits Request** (existing)
   - Uses `ae-submit-art.html`
   - Creates record in ArtRequests table
   - Status: "Submitted"
   - User_Email captures AE's email

2. **Adriyella Reviews** (new)
   - Sees new requests in Art Hub Dashboard
   - Reviews NOTES field
   - Updates Status to "In Progress"
   - Caspio triggered action sends email to Steve

3. **Design Creation** (new)
   - Steve uses art-hub-steve.html dashboard
   - Sees only "In Progress" requests in work queue
   - Uploads artwork to File_Upload fields
   - Tracks time in Art_Minutes with billing preview
   - Adds DesignNote with progress updates
   - Caspio calculates Amount_Art_Billed automatically

4. **Customer Approval** (new)
   - Adriyella updates Status to "Awaiting Approval"
   - Sends customer link: `art-approval.html?ID_Design=12345`
   - Customer clicks Approve/Request Changes
   - Caspio triggered action notifies team

5. **Invoicing** (existing)
   - Links to art-invoice-creator.html
   - Pre-populates from ArtRequests data
   - Updates Invoiced field to "Yes"
   - Sets Invoiced_Date

6. **Completion**
   - Status updated to "Completed"
   - All parties notified

## Status Values for Workflow

Status dropdown values with color coding (configured in Caspio):
1. **Submitted** (Gray - ○) - Default for new requests
   - Background: #f3f4f6
2. **In Progress** (Blue - ◐) - Art department working
   - Background: #dbeafe
3. **Awaiting Approval** (Amber - ⏸) - Sent to customer
   - Background: #fef3c7
4. **Completed** (Green - ✓) - Approved and done
   - Background: #d1fae5
5. **Cancelled** (Red - ✕) - Request cancelled
   - Background: #fee2e2

## Note Type Values

Dropdown values for Note_Type field:
- **Status Update** - Automatic when status changes
- **Design Update** - Steve's progress notes
- **Customer Feedback** - Approval/revision requests
- **Internal Note** - Team communication
- **Time Entry** - When Steve logs hours

## Implementation Status

### Website Implementation ✅ COMPLETED (January 2025)
All HTML pages have been created and are ready for Caspio datapages:
1. ✅ Created art-hub-dashboard.html with placeholder for dashboard datapage
2. ✅ Created art-hub-detail.html with placeholders for 3 datapages
3. ✅ Created art-approval.html for public customer approval
4. ✅ Created art-hub-steve.html for Steve's artist dashboard
5. ✅ Added "Art Hub" link to staff-dashboard.html navigation
6. ✅ Added "Artist Dashboard" link to staff-dashboard.html navigation

### Caspio Implementation Phases (To Be Done)

#### Phase 1: Core Art Hub Dashboard
**Configure art_hub_dashboard DataPage**:
- Create tabular report from ArtRequests table
- Add Bridge Authentication (same as staff dashboard)
- Set up user filtering rules (AEs see own, others see all)
- Add status count cards using HTML blocks
- Configure conditional formatting for due dates
- Replace `[YOUR_DATAPAGE_KEY]` in art-hub-dashboard.html

#### Phase 2: Detail View & Communication
**Configure 3 DataPages**:
1. **art_request_details** - Details page with Steve's special fields
   - Replace `[ART_REQUEST_DETAILS_KEY]` in art-hub-detail.html
2. **design_notes_list** - Chat-style notes display
   - Replace `[DESIGN_NOTES_LIST_KEY]` in art-hub-detail.html
3. **design_notes_add** - Note submission form
   - Replace `[DESIGN_NOTES_ADD_KEY]` in art-hub-detail.html
4. Set up email triggered actions for note notifications

#### Phase 3: Customer Portal
**Configure art_approval_public DataPage**:
- Create public update form (no authentication)
- Display artwork and approve/reject buttons
- Configure automatic status updates
- Replace `[ART_APPROVAL_PUBLIC_KEY]` in art-approval.html

#### Phase 4: Integration & Training
- Test complete workflow from submission to invoice
- Configure remaining triggered actions
- Train Adriyella and team on new system
- Document any custom configurations

## Technical Requirements

### Caspio DataPages Summary

| DataPage Name | Type | Authentication | Purpose |
|--------------|------|----------------|---------|
| art_hub_dashboard | Tabular Report | Bridge Auth | Adriyella's main dashboard |
| art_hub_steve_dashboard | Tabular Report | Bridge Auth | Steve's work queue |
| art_request_details | Details Page | Bridge Auth | View single request |
| design_notes_list | List Report | Bridge Auth | Show notes |
| design_notes_add | Submission Form | Bridge Auth | Add notes |
| art_approval_public | Update Form | None (Public) | Customer approval |
| steve_time_entry | Update Form | Bridge Auth | Time tracking (or integrated) |

### Email Notifications (Caspio Triggered Actions)

1. **New Note Added**
   - Trigger: Insert on DesignNotes
   - Action: Email to CustomerServiceRep, Steve, Adriyella
   - Condition: Always

2. **Status Changed**
   - Trigger: Update on ArtRequests when Status changes
   - Action: Email based on new status
   - Recipients vary by status

3. **Customer Approval**
   - Trigger: Update on ArtRequests when Status = "Completed"
   - Action: Email to team with approval confirmation

## Security Considerations

1. **Internal Pages**
   - Use same Caspio Bridge Authentication
   - Filter data based on user role/email

2. **Customer Portal**
   - No authentication required
   - Access only via unique ID parameter
   - Limited to view/approve functions only

3. **Data Visibility**
   - AEs see only their requests by default
   - Option to view others if needed
   - Steve sees all with special fields

## Success Metrics

1. **Efficiency**
   - Reduce email back-and-forth by 90%
   - Track all communications in database

2. **Visibility**
   - Real-time status for all requests
   - Clear ownership and accountability

3. **Speed**
   - Faster approvals via direct portal
   - Immediate notifications

## Benefits of This Approach

1. **Minimal Website Development**: Only 3 simple HTML pages needed
2. **Maximum Caspio Usage**: Leverages Caspio's built-in features
3. **Easy Maintenance**: Changes made in Caspio, not code
4. **Scalable**: Can add features without touching website
5. **Integrated**: Works with existing authentication
6. **Professional**: Clean, consistent interface

## Next Steps

Since all website implementation is complete, the remaining work is in Caspio:

1. **Create the 7 Caspio DataPages** following the specifications above
2. **Replace placeholder keys** in the HTML files with actual datapage keys:
   - In art-hub-dashboard.html: Replace `[YOUR_DATAPAGE_KEY]`
   - In art-hub-steve.html: Replace `[STEVE_DASHBOARD_KEY]`
   - In art-hub-detail.html: Replace `[ART_REQUEST_DETAILS_KEY]`, `[DESIGN_NOTES_LIST_KEY]`, `[DESIGN_NOTES_ADD_KEY]`
   - In art-approval.html: Replace `[ART_APPROVAL_PUBLIC_KEY]`
3. **Configure triggered email actions** for notifications
4. **Test complete workflow** from submission through approval to invoicing
5. **Train users**:
   - Adriyella on Art Hub dashboard and workflow management
   - Steve on time entry and note system
   - AEs on how their submissions flow through the new system

## Dashboard Mockups & Visual Layouts

### 1. Adriyella's Art Hub Dashboard (`art-hub-dashboard.html`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [crimson header with NWCA logo]                          ← Back to Staff Dashboard│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐
│  │ SUBMITTED   │  │IN PROGRESS  │  │  AWAITING   │  │ COMPLETED   │  │CANCELLED│
│  │     12      │  │      8      │  │  APPROVAL   │  │     45      │  │    2    │
│  │      ○      │  │      ◐      │  │      5      │  │      ✓      │  │    ✕    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘
│                                                                                 │
│  Filter: [All Requests ▼] [All AEs ▼] [Date Range] 🔍 Search: [___________]    │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ ID  │ Company        │ AE        │ Status      │ Due Date │ Type   │ Act │  │
│  ├─────┼────────────────┼───────────┼─────────────┼──────────┼────────┼─────┤  │
│  │ 125 │ ABC Corp       │ Taylar    │ ○ Submitted │ TODAY    │ Embr   │[👁️] │  │
│  │ 124 │ XYZ Company    │ Ruth      │ ◐ Progress  │ 01/30    │ DTG    │[👁️] │  │
│  │ 123 │ Metal Works    │ Nika      │ ⏸ Approval  │ 01/31    │ Screen │[👁️] │  │
│  │ 122 │ Tech Start     │ Erik      │ ✓ Complete  │ 01/28    │ Laser  │[👁️] │  │
│  │ 121 │ Coffee Shop    │ Taylar    │ ○ Submitted │ OVERDUE  │ Embr   │[👁️] │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  Legend: [👁️] = View Details | Red highlight = Overdue | Click Status to edit   │
└─────────────────────────────────────────────────────────────────────────────────┘

**Caspio Configuration**:
- DataPage Type: Tabular Report
- Authentication: Bridge (Caspio login)
- HTML Blocks for status cards with COUNT aggregations
- Inline editing enabled for Status field
- Conditional formatting rules:
  - Due_Date < Today() = Red background
  - Status = "Submitted" = Gray badge
  - Status = "In Progress" = Blue badge
  - Status = "Awaiting Approval" = Amber badge
  - Status = "Completed" = Green badge
  - Status = "Cancelled" = Red badge
- Link to details: art-hub-detail.html?ID_Design=[@field:ID_Design]
```

### 2. Steve's Artist Dashboard (`art-hub-steve.html`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [crimson header with NWCA logo]                          ← Back to Staff Dashboard│
├─────────────────────────────────────────────────────────────────────────────────┤
│                         STEVE'S ARTIST DASHBOARD                                │
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ ACTIVE JOBS │  │TODAY'S DONE │  │ WEEK HOURS  │  │   PENDING   │          │
│  │      5      │  │      3      │  │    32.5     │  │  APPROVAL   │          │
│  │   🎨 📊     │  │   ✅ 💰     │  │   ⏱️ 💵     │  │      2      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                                 │
│  MY WORK QUEUE (Status = "In Progress")                           Sort: Due ↑   │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ URGENT! Due Today                                                        │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ #125 | ABC Corp | "Rush job - 2 color logo on black shirts"            │  │
│  │ Time: [45] min | [$50.00] | [Upload Art] [Add Note] [Mark Complete]    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ #123 | Metal Works | "Update existing logo with new tagline"           │  │
│  │ Time: [___] min | [$0.00] | [Upload Art] [Add Note] [Mark Complete]    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  TIME & BILLING CALCULATOR                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ 💰 Rates: $50 first hour, $75/hour after                               │  │
│  │                                                                         │  │
│  │ Today's Total: 3.5 hours = $212.50                                     │  │
│  │ This Week: 32.5 hours = $2,437.50                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  RECENT ACTIVITY (Last 5 Notes)                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ • "Customer approved!" - ABC Corp (10 min ago)                         │  │
│  │ • "Please make logo 20% bigger" - XYZ Company (1 hour ago)            │  │
│  │ • "Rush this one please" - Adriyella (2 hours ago)                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘

**Caspio Configuration**:
- DataPage Type: Tabular Report with HTML blocks
- Authentication: Bridge (filtered for art@nwcustomapparel.com)
- Multiple sections using HTML blocks:
  1. Dashboard cards with aggregations
  2. Work queue filtered by Status = "In Progress"
  3. Inline time entry with calculated fields
  4. Recent notes using separate view
- Calculated fields:
  - If Art_Minutes <= 60: $50
  - If Art_Minutes > 60: $50 + ((Art_Minutes-60)/60 * $75)
- Quick actions using JavaScript or update forms
```

### 3. Art Hub Detail View (`art-hub-detail.html`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [crimson header with NWCA logo]                          ← Back to Art Hub       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────┐  ┌───────────────────────────────────┐│
│  │ ART REQUEST DETAILS                  │  │ ARTWORK FILES                     ││
│  │                                      │  │                                   ││
│  │ ID: #125                            │  │ [🖼️ Current Design v3]            ││
│  │ Company: ABC Corp                   │  │ [🖼️ Previous v2]                  ││
│  │ Contact: John Smith                 │  │ [🖼️ Previous v1]                  ││
│  │ Email: john@abccorp.com            │  │ [🖼️ Original Request]             ││
│  │ Phone: 555-1234                    │  │                                   ││
│  │ AE: Taylar                         │  │ [Upload New Version]              ││
│  │                                      │  └───────────────────────────────────┘│
│  │ Status: [In Progress ▼]             │                                       │
│  │ Due Date: 01/29/2025               │  ┌───────────────────────────────────┐│
│  │ Order Type: Embroidery             │  │ STEVE'S SECTION (if logged in)    ││
│  │ Mockup: No                         │  │                                   ││
│  │                                      │  │ Time Spent: [45] minutes         ││
│  │ Project: Company Uniforms 2025      │  │ Amount: $50.00                   ││
│  │                                      │  │ [Calculate] [Save Time]          ││
│  │ Notes to Steve:                     │  └───────────────────────────────────┘│
│  │ ┌──────────────────────────────┐   │                                       │
│  │ │ 2 color logo on left chest.   │   │                                       │
│  │ │ Make sure it's 3.5" wide max. │   │                                       │
│  │ └──────────────────────────────┘   │                                       │
│  └─────────────────────────────────────┘                                       │
│                                                                                 │
│  DESIGN NOTES & COMMUNICATION                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ Taylar (AE) - 01/28 2:15 PM                                               ││
│  │ ┌───────────────────────────────────────────────────────────────────────┐ ││
│  │ │ Customer wants their logo embroidered on new uniforms. 2 colors max.   │ ││
│  │ └───────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                           ││
│  │ Steve (Artist) - 01/28 3:45 PM                                            ││
│  │ ┌───────────────────────────────────────────────────────────────────────┐ ││
│  │ │ Working on this now. Should have first proof in 30 minutes.           │ ││
│  │ └───────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                           ││
│  │ Steve (Artist) - 01/28 4:20 PM                                            ││
│  │ ┌───────────────────────────────────────────────────────────────────────┐ ││
│  │ │ First proof uploaded. Simplified to 2 colors as requested.            │ ││
│  │ └───────────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  ADD NEW NOTE                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ Type: [Design Update ▼]                                                    ││
│  │ ┌───────────────────────────────────────────────────────────────────────┐ ││
│  │ │                                                                         │ ││
│  │ │ Type your note here...                                                 │ ││
│  │ │                                                                         │ ││
│  │ └───────────────────────────────────────────────────────────────────────┘ ││
│  │                                                     [Cancel] [Add Note]   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

**Caspio Configuration**:
- 3 DataPages embedded:
  1. **art_request_details**: Details page showing all fields
     - Conditional section for Steve (art@nwcustomapparel.com)
     - File display with CDN_Link fields
  2. **design_notes_list**: List report styled as chat
     - Sort by Note_Date DESC
     - Show Note_By, Note_Date, Note_Type, Note_Text
  3. **design_notes_add**: Submission form
     - Hidden fields: ID_Design (from URL), Note_By ([@authfield:Email])
     - Dropdown for Note_Type
     - Text area for Note_Text
```

### 4. Customer Approval Portal (`art-approval.html`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NORTHWEST CUSTOM APPAREL                                 │
│                         Artwork Approval Portal                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Hello! Your artwork is ready for review.                                      │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                          YOUR ARTWORK PROOF                                 ││
│  │                                                                             ││
│  │                         [                                ]                  ││
│  │                         [                                ]                  ││
│  │                         [     🖼️ ARTWORK IMAGE          ]                  ││
│  │                         [                                ]                  ││
│  │                         [                                ]                  ││
│  │                                                                             ││
│  │  Company: ABC Corp                                                          ││
│  │  Project: Company Uniforms 2025                                             ││
│  │  Type: Embroidery - 2 colors on left chest                                 ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  Please review your artwork carefully. Once approved, production will begin.    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                             ││
│  │     [✅ APPROVE ARTWORK]              [🔄 REQUEST CHANGES]                 ││
│  │                                                                             ││
│  │  If you need changes, please describe what you'd like adjusted:            ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐   ││
│  │  │                                                                     │   ││
│  │  │                                                                     │   ││
│  │  └─────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  Questions? Contact your sales representative or call 253-922-5793              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

**Caspio Configuration**:
- DataPage Type: Single Record Update Form
- Authentication: NONE (Public access)
- Parameter: ID_Design from URL
- Display only fields:
  - CompanyName
  - Latest CDN_Link (artwork)
  - Project details
- Update fields:
  - Status (using custom buttons)
  - Auto-insert DesignNote on action
- JavaScript for button actions:
  - Approve: Set Status = "Completed"
  - Request Changes: Set Status = "In Progress" + capture feedback
```

## Visual Datapage Specifications

### Status Card HTML Block Example (for Adriyella's Dashboard)
```html
<div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
  <div style="flex: 1; padding: 1.5rem; background: #f3f4f6; border-radius: 8px; text-align: center;">
    <div style="font-size: 2rem; font-weight: bold;">[@calcfield:1]</div>
    <div style="color: #6b7280;">SUBMITTED</div>
    <div style="font-size: 1.5rem;">○</div>
  </div>
  <div style="flex: 1; padding: 1.5rem; background: #dbeafe; border-radius: 8px; text-align: center;">
    <div style="font-size: 2rem; font-weight: bold;">[@calcfield:2]</div>
    <div style="color: #1e40af;">IN PROGRESS</div>
    <div style="font-size: 1.5rem;">◐</div>
  </div>
  <!-- Additional cards... -->
</div>
```

### Billing Calculation Formula (for Steve's Dashboard)
```sql
CASE 
  WHEN Art_Minutes <= 60 THEN 50
  ELSE 50 + ((Art_Minutes - 60) * 1.25)
END
```

### Conditional Formatting Rules
1. **Due Date Highlighting**:
   - Condition: Due_Date < SysDate()
   - Action: Background color = #fee2e2 (light red)

2. **Status Badges**:
   - Use HTML formatting in calculated field
   - Example: `'<span style="background: #dbeafe; padding: 4px 8px; border-radius: 4px;">In Progress</span>'`

3. **Steve-Only Sections**:
   - Rule: [@authfield:Email] = 'art@nwcustomapparel.com'
   - Action: Show section

## Summary

This plan successfully bridges the gap between the existing AE submission system and the invoicing system by adding a workflow management layer. All website work is complete, and the system is ready for Caspio datapage configuration. The approach maximizes Caspio's capabilities while keeping custom development minimal, making it easy to maintain and modify as needs evolve.