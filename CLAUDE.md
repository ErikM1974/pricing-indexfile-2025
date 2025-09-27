# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Northwest Custom Apparel (NWCA) Pricing System

## Project Overview

The NWCA Pricing System is a comprehensive web application providing dynamic pricing calculators for various decoration methods on apparel and promotional products. It features product catalog browsing, real-time pricing calculations, quote generation with database persistence, and staff management tools.

## Development Commands

```bash
# Development
npm start          # Start Node.js proxy server (port 3000)
npm run dev        # Run webpack dev server for frontend development
npm run build:dev  # Build for development

# Production
npm run build      # Build for production (minified, optimized)
npm analyze        # Analyze bundle size

# Utility
npm run clean      # Clean dist directory
```

## Project Structure

The codebase has been organized into logical directories for better maintainability:

```
/
├── calculators/          # Pricing calculators and bundles
├── dashboards/           # Staff and management dashboards
├── quote-builders/       # Quote generation tools
├── vendor-portals/       # Vendor management interfaces
├── art-tools/            # Art department tools
├── tools/                # Utility and helper tools
├── admin/                # Administrative interfaces
├── email-templates/      # Email template files
├── mockups/              # UI mockups and prototypes
├── tests/                # Test files and pages
├── shared_components/    # Shared JS and CSS components
│   ├── js/              # JavaScript modules and adapters
│   └── css/             # Stylesheets
├── images/              # Image assets
├── scripts/             # Standalone scripts
└── styles/              # Global stylesheets
```

### Core Files (Root Directory)
The following files remain in the root directory as they are core to the application:
- `index.html` - Main landing page
- `product.html` - Product display page
- `cart.html` - Shopping cart
- `server.js` - Node.js Express server
- `package.json` - Project dependencies
- Configuration files

## High-Level Architecture

### Master Bundle Pattern
The system uses a "Master Bundle" approach where Caspio sends comprehensive pricing data that's managed client-side:

1. **Caspio Backend** → Calculates ALL price permutations for a decoration type
2. **PostMessage Communication** → Sends master bundle to adapter via iframe
3. **Adapters** (e.g., `DTGAdapter.js`) → Store bundle and extract relevant pricing based on user selections
4. **Event System** → Adapters dispatch `pricingDataLoaded` events
5. **UI Components** → Listen for events and update pricing displays

### Key Architectural Components

1. **Adapters** (`/shared_components/js/*-adapter.js`)
   - Each decoration type has its own adapter
   - Handles master bundle storage and data extraction
   - Dispatches standardized events

2. **Quote System** 
   - Two-table database structure: `quote_sessions` + `quote_items`
   - Quote IDs follow pattern: `[PREFIX][MMDD]-[sequence]`
   - Database operations via Heroku proxy API

3. **Cart Management** (`shared_components/js/cart.js`)
   - Local and server-side session management
   - Enforces business rules (single embellishment type per cart)
   - Real-time price recalculation

4. **API Proxy** (`server.js` → Heroku)
   - Base URL: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
   - Handles all Caspio database operations
   - Modular route structure in `/src/routes/`

## API Documentation - Single Source of Truth with Inter-Claude Communication

### Caspio Pricing Proxy API
@memory/CASPIO_API_TEMPLATE.md
- **SHARED DOCUMENTATION** between this app and caspio-pricing-proxy server
- Complete documentation for all 53 active API endpoints
- **INTER-CLAUDE COMMUNICATION LOG** for coordination with API Provider
- Enhanced product search with faceted filtering
- Cart management (sessions, items, sizes)
- Pricing calculations for all decoration methods
- Order processing and dashboard metrics with CSR performance
- Art requests and invoicing with full CRUD
- Quote system (critical for calculators)
- Transfer pricing and inventory management
- Production schedules

**API Base URL**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api`

### 🔔 Session Start Protocol
**IMPORTANT: At the start of each session, you MUST:**
1. Read @memory/CASPIO_API_TEMPLATE.md
2. Check the "Active Conversations" section for pending messages from Provider Claude
3. Review "Recent Updates Requiring Acknowledgment" and check off completed items
4. Update your "Last Checked by Consumer" timestamp
5. Respond to any questions or acknowledge updates

### 💬 Communicating with API Provider Claude

**When you need to communicate with the API Provider:**
1. Add messages to the Communication Log in CASPIO_API_TEMPLATE.md
2. Use appropriate message prefixes:
   - ❓ **QUESTION** when you need information about the API
   - 🐛 **BUG** when you find an API issue
   - 💡 **SUGGESTION** for improvement ideas
   - 🤝 **ACKNOWLEDGED** when you've implemented a change
   - ✅ **ANSWER** when responding to Provider's questions

**Example message format:**
```
**2025-01-30 16:30** - ❓ **QUESTION** from API Consumer:
The /api/products/search endpoint returns duplicates when filtering by multiple colors.
Is this intentional or should results be unique by style?
```

### 📝 Your Responsibilities as API Consumer
- Report bugs and unexpected behavior
- Document integration patterns you discover
- Request missing functionality
- Provide UI/UX feedback on API responses
- Update "Implementation Notes from Consumer" section with important findings
- Acknowledge breaking changes and update your code accordingly

### 🚨 When Provider Reports Breaking Changes
1. Check the 🚨 **BREAKING** messages immediately
2. Review migration guide if provided
3. Update affected code in the application
4. Test thoroughly
5. Acknowledge the change with 🤝 **ACKNOWLEDGED** message
6. Report any issues encountered during migration

**Important**: This shared documentation enables asynchronous communication between you and the API Provider Claude, ensuring both applications stay synchronized without human intervention.

## Claude Development Guidelines

1. First understand the existing patterns by reading relevant files
2. Create a plan in tasks/todo.md before making changes
3. Make minimal, focused changes that impact as little code as possible
4. Follow established patterns (adapters, quote system, event communication)
5. Always verify security - no sensitive data in frontend, validate all inputs
6. Test changes incrementally using browser console

## ⚠️ IMPORTANT: Routing Requirements for New Pages

**REMINDER: When Claude creates a new page, the following MUST be done to avoid white screen/page not loading errors:**

1. **Add the new page to the route configuration** - The page must be registered in the routing system or it will not load
2. **Ask Erik to restart the local server (port 3000)** - After adding a new page, Erik must restart the server using Roocode for the changes to take effect

**Failure to do these steps will result in:**
- White screen when trying to access the new page
- Page not loading error
- Routes not being recognized

**Always remember:** New page → Add to routes → Restart server with Erik's help

## 🚫 API Error Handling Policy - NO Silent Failures

**ERIK'S REQUIREMENT: Never use fallback/cached data when API connections fail!**

**Why this matters:**
- Using incorrect pricing data is WORSE than showing an error
- Silent failures hide problems that need to be fixed
- Customers could receive wrong quotes if fallback data is outdated

**Implementation Requirements:**

1. **When API calls fail, you MUST:**
   - Display a visible warning/error message on the page
   - Prevent the calculator/tool from proceeding with potentially wrong data
   - Log the error details to the console for debugging

2. **Never do this:**
   ```javascript
   // ❌ WRONG - Silent fallback
   try {
     const data = await fetchAPI();
   } catch (error) {
     const data = getCachedData(); // NO! Don't silently use fallback
   }
   ```

3. **Always do this:**
   ```javascript
   // ✅ CORRECT - Visible failure
   try {
     const data = await fetchAPI();
   } catch (error) {
     showErrorBanner('Unable to load current pricing. Please refresh or contact support.');
     console.error('API failed:', error);
     throw error; // Stop execution
   }
   ```

**Remember:** It's better to show "Service temporarily unavailable" than to quietly use wrong pricing data!

## Adding New Documentation

**IMPORTANT**: Claude does NOT automatically scan the memory/ directory. You MUST update this file when adding new documentation.

### When Adding a New Memory File:

1. **Create your file** in the `memory/` directory (e.g., `memory/NEW_FEATURE_GUIDE.md`)

2. **Update this CLAUDE.md file** by adding a reference in the appropriate section:
   ```markdown
   ### New Feature Guide
   @memory/NEW_FEATURE_GUIDE.md
   - Brief description of what the guide covers
   - Key topics included
   ```

3. **Choose the right section**:
   - Git Workflow Documentation - for Git/deployment guides
   - Development Guides - for implementation/technical guides
   - Active Calculators - for calculator-specific documentation

### Why This Matters

- Claude only knows about files explicitly referenced in CLAUDE.md
- The @memory/ notation tells Claude where to find detailed information
- Without updating CLAUDE.md, your new documentation won't be used

### Example Addition

If you create `memory/SHOPWORKS_INTEGRATION.md`, add to Development Guides:
```markdown
### ShopWorks Integration
@memory/SHOPWORKS_INTEGRATION.md
- How to integrate with ShopWorks system
- API endpoints and data mapping
- Common issues and solutions
```

## Critical Resources

### API & URLs
```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
Company Logo: https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1
Company Phone: 253-922-5793
```

### EmailJS Credentials
```
Public Key: 4qSbDO-SQs19TbP80
Service ID: service_1c4k67j
```

### Quick Reference - Essential Information
```
Phone Number: 253-922-5793 (consistent across all templates)
Company Year: 1977
Quote ID Pattern: [PREFIX][MMDD]-[sequence] (e.g., DTG0130-1)
Database Endpoints: /api/quote_sessions and /api/quote_items
```

### Active Quote Prefixes
```
DTG     // DTG Contract
RICH    // Richardson Caps  
EMB     // Embroidery Contract
EMBC    // Customer Supplied Embroidery
LT      // Laser Tumblers
PATCH   // Embroidered Emblems
SPC     // Customer Screen Print
SSC     // Safety Stripe Creator
WEB     // Webstore Setup
```

## Pricing Calculations

### Minimum Fee Calculation
- Less than minimum fee is calculated as a flat $50.00 when the total order value falls below the established minimum order threshold
- This ensures a baseline revenue for small orders that do not meet the standard minimum pricing requirements

## Development Guides & References

### Core Implementation Guide
@memory/CALCULATOR_GUIDE.md
- Complete calculator implementation patterns
- Database integration (quote_sessions + quote_items structure)
- EmailJS setup and anti-corruption strategies
- Quote workflow from generation to delivery
- Active calculator registry and troubleshooting

### Staff Directory & Quick Reference
@memory/STAFF_DIRECTORY.md
- Complete staff contact information (authoritative source)
- Essential URLs, credentials, and quote ID patterns
- Console debug commands and common fixes
- Git workflow and testing checklist

### Database & API Integration
@memory/DATABASE_PATTERNS.md
- Two-table structure with CRUD operations
- Field requirements and validation patterns
- Service vs product quote patterns

### Advanced Features
@memory/EMBROIDERY_QUOTE_BUILDER.md
- Multi-style embroidery quote builder
- Professional sales tool with API integration

## Key Takeaways & Common Issues

### Implementation Standards
1. **Follow Established Patterns**: All calculators use same architecture - HTML page, quote service, EmailJS integration
2. **Database Integration**: Always use two-table structure (quote_sessions + quote_items)
3. **EmailJS Variables**: Provide ALL template variables with defaults to avoid corruption
4. **Quote IDs**: Use unique prefixes and daily sequence reset
5. **Error Handling**: Log details but don't stop email send on database failure
6. **Testing**: Always show quote ID in success message for user reference

### Common Fixes
- **EmailJS "Corrupted variables"**: Add missing variables with defaults (`|| ''`)
- **Database not saving**: Check endpoint `/api/quote_sessions` and field names  
- **Quote ID not showing**: Add display element in success message
- **Wrong template**: Use template ID, not name
- **Script parsing error**: Escape closing tags: `<\/script>`
- **CSS not updating**: Add cache-busting parameter to stylesheet link

### Console Debug Commands
```javascript
// Check calculator initialization
console.log(window.[name]Calculator);

// Test quote ID generation  
console.log(new [Name]QuoteService().generateQuoteID());

// Debug email data
console.log('Email data:', emailData);
```

## Active Calculators

The following calculators are currently active in the system:
- **DTG Contract** (DTG) - Contract pricing for direct-to-garment printing
- **Richardson Caps** (RICH) - Richardson vendor cap pricing
- **Embroidery Contract** (EMB) - Contract embroidery pricing
- **Customer Supplied Embroidery** (EMBC) - Embroidery on customer-supplied garments
- **Laser Tumblers** (LT) - Polar Camel laser engraved tumblers
- **Embroidered Emblems** (PATCH) - Custom patches and badges

Remember: These existing calculators serve as working examples. When in doubt, reference their implementation patterns.

## Art Invoice System

### Overview
The Art Invoice System provides comprehensive invoice management for design services with quote ID format: ART-{ID_Design}.

### Recent Improvements (2025-06-30)
- **Enhanced dashboard layout** with separate Email Actions and Payment Actions columns
- **Improved undo payment functionality** with better date parsing and same-day restriction
- **Email tracking display** showing when invoices were sent and to whom
- **Resend capability** for all sent invoices with proper tracking
- **Status enhancement** with detailed email and payment tracking information
- **Professional UI redesign** with better organization and mobile responsiveness

### Key Features
- **Dynamic field handling**: API automatically handles any fields in Caspio tables
- **Service code billing**: GRT-25, GRT-50, GRT-75, etc. with automatic suggestions
- **Professional invoice theme**: Blue/gray professional appearance
- **Void functionality**: Proper audit trail with 24-hour payment undo restriction
- **Email integration**: EmailJS with template system for sending invoices
- **Database integration**: Full CRUD operations via Heroku proxy API

### Files
- `/art-invoices-dashboard.html` - Main dashboard with enhanced layout
- `/art-invoice-view.html` - Individual invoice viewing and editing
- `/calculators/art-invoice-creator.html` - Invoice creation page
- `/calculators/art-invoice-service-v2.js` - Backend service with full API integration

### Dashboard Functionality
- **Email Actions Column**: View, Send, Resend, Remind
- **Payment Actions Column**: Mark Paid, Undo Payment, Add Payment
- **Enhanced Status Display**: Shows email sent dates and payment tracking
- **Improved Filtering**: By status, date range, customer, and project
- **Bulk Operations**: Mark multiple invoices as paid
- **Mobile Responsive**: Optimized layout for all devices

## Art Hub System

### Overview
The Art Hub provides a centralized dashboard for managing art requests and notes across different user roles (AEs and Artists).

### Key Features
- **Role-based dashboards**: Separate views for Account Executives and Artists
- **Modal-based note system**: Add and view notes without leaving the dashboard
- **Smart page refresh**: Only refreshes when notes are actually submitted
- **Royal Blue theme**: Consistent visual design (#4169E1)

### Files
- `/art-hub-dashboard.html` - Main AE dashboard (green theme)
- `/art-hub-steve.html` - Artist dashboard (royal blue theme)

### Recent Updates
- **Conditional refresh logic**: Pages only refresh when notes are submitted via tracking `noteWasSubmitted` flag
- **Improved user experience**: Prevents unnecessary page refreshes when modals are closed without action