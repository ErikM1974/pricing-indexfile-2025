# Claude Assistant Guide for NWCA Pricing System

## Project Overview

This is the Northwest Custom Apparel (NWCA) pricing system, a web application that provides pricing calculators for various decoration methods (embroidery, DTG, laser engraving, etc.) on apparel and promotional products.

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

### Calculator Implementation
@memory/CALCULATOR_IMPLEMENTATION.md
- Step-by-step guide for building new calculators
- Updated with Customer Supplied Embroidery best practices
- Success modal and print functionality patterns

### Calculator Blueprint
@memory/CALCULATOR_BLUEPRINT.md
- Complete template based on Customer Supplied Embroidery success
- Full HTML template with success modal
- JavaScript calculator class template
- Quote service implementation
- Print functionality and EmailJS integration

### Calculator Templates
@memory/CALCULATOR_TEMPLATES.md
- Ready-to-use code templates for new calculators
- Complete HTML, JavaScript, and service templates
- Common customization patterns
- Quick setup checklist

### EmailJS Integration
@memory/EMAILJS_GUIDE.md
- Complete EmailJS setup and configuration
- Anti-corruption strategies and variable management
- Success modal implementation
- Print functionality pattern

### EmailJS Complete Guide
@memory/EMAILJS_COMPLETE_GUIDE.md
- Master reference for EmailJS implementation
- Variable validation and error handling
- HTML email templates and responsive design
- Testing procedures and common patterns

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
- Comprehensive Caspio Pricing Proxy API reference
- All endpoints for Cart, Pricing, Products, Orders, Quotes
- Includes curl examples for every endpoint
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