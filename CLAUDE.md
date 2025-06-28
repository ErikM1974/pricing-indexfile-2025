# Claude Assistant Guide for NWCA Pricing System

## Project Overview

This is the Northwest Custom Apparel (NWCA) pricing system, a web application that provides pricing calculators for various decoration methods (embroidery, DTG, laser engraving, etc.) on apparel and promotional products.

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

```

## Development Guides

### Calculator Implementation
@memory/CALCULATOR_IMPLEMENTATION.md

### EmailJS Integration
@memory/EMAILJS_GUIDE.md

### Database Patterns
@memory/DATABASE_PATTERNS.md

### Troubleshooting
@memory/TROUBLESHOOTING.md

### Quick Reference
@memory/QUICK_REFERENCE.md

## Git Workflow Documentation

### Complete Workflow Guide
@memory/GIT_WORKFLOW_GUIDE.md
- Full step-by-step workflow from feature branch to production
- Prerequisites and setup instructions
- Troubleshooting common issues

### Authentication Details
@memory/GIT_AUTHENTICATION_UPDATE.md
- How Git/GitHub and Heroku authentication actually works
- Credentials are NOT in .env file
- Managed by Windows Credential Manager and Heroku CLI

### Quick Reference
@memory/GIT_WORKFLOW_QUICK_REFERENCE.md
- Essential commands at a glance
- One-line deployment scripts
- Branch naming conventions

### Visual Guide
@memory/GIT_WORKFLOW_VISUAL_GUIDE.md
- Workflow diagrams and flowcharts
- Branch timeline visualizations
- Decision trees for different scenarios

### Automation Scripts
@memory/GIT_WORKFLOW_AUTOMATION.md
- PowerShell deployment script
- Batch file for Command Prompt
- Bash script for Git Bash/WSL
- Complete automation with error handling

### Summary
@memory/GIT_WORKFLOW_SUMMARY.md
- Key points about authentication
- 7-step workflow summary
- Pre-flight checklist

### Index
@memory/GIT_WORKFLOW_INDEX.md
- Central hub linking all Git workflow docs
- Quick start instructions
- Common tasks and solutions

## Key Takeaways

1. **Follow Established Patterns**: All calculators use the same architecture - HTML page, quote service, EmailJS integration
2. **Database Integration**: Always use the two-table structure (quote_sessions + quote_items)
3. **EmailJS Variables**: Provide ALL template variables with defaults to avoid corruption
4. **Quote IDs**: Use unique prefixes and daily sequence reset
5. **Error Handling**: Log details but don't stop email send on database failure
6. **Testing**: Always show quote ID in success message for user reference

Remember: The existing calculators (DTG, Richardson, Embroidery, Laser Tumbler) serve as working examples. When in doubt, reference their implementation patterns.







