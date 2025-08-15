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

## Claude Development Guidelines

1. First understand the existing patterns by reading relevant files
2. Create a plan in tasks/todo.md before making changes
3. Make minimal, focused changes that impact as little code as possible
4. Follow established patterns (adapters, quote system, event communication)
5. Always verify security - no sensitive data in frontend, validate all inputs
6. Test changes incrementally using browser console

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

## Pricing Calculations

### Minimum Fee Calculation
- Less than minimum fee is calculated as a flat $50.00 when the total order value falls below the established minimum order threshold
- This ensures a baseline revenue for small orders that do not meet the standard minimum pricing requirements

## Git Workflow Documentation

### Complete Workflow Guide
@memory/GIT_WORKFLOW_GUIDE.md
- Full step-by-step workflow from feature branch to production
- Prerequisites and setup instructions
- Troubleshooting common issues

### Quick Reference
@memory/GIT_WORKFLOW_QUICK_REFERENCE.md
- Essential commands at a glance
- One-line deployment scripts
- Branch naming conventions

## Development Guides

### Calculator Implementation Guide
@memory/CALCULATOR_GUIDE.md
- Comprehensive guide for building new calculators
- Combines best practices from all successful implementations
- Required patterns, EmailJS setup, database integration
- Active calculator registry and common pitfalls

### EmailJS Integration
@memory/EMAILJS_GUIDE.md
- Complete EmailJS setup and configuration
- Anti-corruption strategies and variable management
- Template best practices and error handling
- Testing procedures and debugging

### Quote Workflow Guide
@memory/QUOTE_WORKFLOW_GUIDE.md
- Complete quote lifecycle from generation to delivery
- Database integration patterns
- Success modal and print functionality
- Error handling best practices
- Status management

### Database Patterns
@memory/DATABASE_PATTERNS.md
- Two-table structure (quote_sessions + quote_items)
- CRUD operations with complete examples
- Field requirements and data types

### API Documentation
@memory/API_DOCUMENTATION.md
- Compact Caspio Pricing Proxy API reference
- All endpoints organized by module (cart, pricing, products, orders, quotes)
- Standard CRUD patterns and critical schemas
- Base URL: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api

### Troubleshooting
@memory/TROUBLESHOOTING.md

### Quick Reference
@memory/QUICK_REFERENCE.md

### Staff Directory
@memory/STAFF_DIRECTORY.md
- Complete staff contact information
- Authoritative source for all email addresses and names
- JavaScript implementation examples

### CRUD Test Results
@memory/CRUD_TEST_RESULTS_QUOTES.md
- Complete test results for all CRUD operations on quotes
- Verified endpoints for CREATE, READ, UPDATE, DELETE
- Key findings about API behavior and best practices
- Test commands and examples for reference

## Key Takeaways

1. **Follow Established Patterns**: All calculators use the same architecture - HTML page, quote service, EmailJS integration
2. **Database Integration**: Always use the two-table structure (quote_sessions + quote_items)
3. **EmailJS Variables**: Provide ALL template variables with defaults to avoid corruption
4. **Quote IDs**: Use unique prefixes and daily sequence reset
5. **Error Handling**: Log details but don't stop email send on database failure
6. **Testing**: Always show quote ID in success message for user reference

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