# 🔍 File Monitoring System Setup Guide

## Overview

The File Monitoring System is an **optional development tool** designed to help with safe file cleanup and dependency tracking. It should **NOT be used in production** as it adds overhead and requires additional dependencies.

## Quick Start

### 1. Enable Monitoring (Development Only)

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and set:
ENABLE_MONITORING=true

# Install development dependencies (includes puppeteer ~300MB)
npm install --save-dev

# Start the server with monitoring
npm start
```

### 2. Verify Monitoring is Active

You should see this in the console when starting:
```
🔍 Monitoring system enabled
Server is running on port 3000
```

### 3. Access Monitoring Endpoints

- **Stats:** http://localhost:3000/api/monitor/stats
- **Report:** http://localhost:3000/api/monitor/report

## What's Included

### 7 Safety Tools

1. **safe-delete.js** - Quarantine files instead of deleting
2. **file-access-monitor.js** - Track which files are actually used
3. **dependency-mapper.js** - Map all file relationships
4. **validate-critical-paths.js** - Test critical application flows
5. **error-monitor.js** - Client-side error detection
6. **auto-recovery.js** - Automatically restore quarantined files
7. **comprehensive-test-suite.js** - Test all HTML pages

## Usage Guide

### Monitor File Access (Passive)

With monitoring enabled, the system automatically tracks:
- Every file requested by the browser
- Access patterns and frequency
- Missing file errors

Check the data:
```bash
# View current stats
curl http://localhost:3000/api/monitor/stats

# Generate detailed report after 2 weeks
curl http://localhost:3000/api/monitor/report > access-report.json
```

### Map Dependencies

```bash
# Generate dependency map and visual graph
node scripts/safety-tools/dependency-mapper.js

# Output files:
# - dependency-map.json (data)
# - dependency-graph.html (interactive visualization)
```

### Safe File Cleanup

```bash
# NEVER delete directly! Always quarantine:
node scripts/safety-tools/safe-delete.js quarantine old-file.js "Reason"

# If something breaks, recover instantly:
node scripts/safety-tools/safe-delete.js recover old-file.js

# List quarantined files:
node scripts/safety-tools/safe-delete.js list
```

### Test Everything

```bash
# Quick health check (no browser)
node scripts/safety-tools/comprehensive-test-suite.js quick

# Full test of all HTML pages (requires puppeteer)
node scripts/safety-tools/comprehensive-test-suite.js test

# Test critical paths only
node scripts/safety-tools/validate-critical-paths.js
```

## Environment Configurations

### Development with Monitoring
```bash
ENABLE_MONITORING=true npm start
```
- Full monitoring active
- All endpoints available
- Error tracking enabled

### Development without Monitoring (Default)
```bash
npm start
```
- No monitoring overhead
- Safety tools not loaded
- Normal development mode

### Production
```bash
NODE_ENV=production npm start
```
- Monitoring always disabled
- No safety tool dependencies needed
- Optimized for performance

## Troubleshooting

### "Monitoring system files not found"

You need to install dev dependencies:
```bash
npm install --save-dev
```

### Monitoring endpoints return 404

Check that `ENABLE_MONITORING=true` is set in your `.env` file.

### Puppeteer won't install

```bash
# Skip Chromium download if problematic
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer
```

### Want to disable monitoring

Simply set in `.env`:
```bash
ENABLE_MONITORING=false
```
Or remove the line entirely (defaults to false).

## Important Notes

⚠️ **For Development Only** - This system is designed for cleanup and debugging during development.

⚠️ **Performance Impact** - Monitoring adds overhead to every request. Don't use in production.

⚠️ **Large Dependencies** - Puppeteer alone is 300MB+. Only installed with `--save-dev`.

✅ **Safe by Default** - System is completely optional and disabled by default.

✅ **No Production Impact** - When merged to main branch, monitoring won't affect production.

## Recommended Workflow

1. **Week 1-2:** Enable monitoring, let it collect data
2. **Week 3:** Review reports, identify unused files
3. **Week 4:** Quarantine unused files (never delete!)
4. **Week 5+:** Monitor for issues, recover if needed
5. **After cleanup:** Disable monitoring

## Command Reference

```bash
# Monitoring control
ENABLE_MONITORING=true npm start    # Enable
ENABLE_MONITORING=false npm start   # Disable

# File operations
node scripts/safety-tools/safe-delete.js quarantine [file] [reason]
node scripts/safety-tools/safe-delete.js recover [file]
node scripts/safety-tools/safe-delete.js list

# Analysis
node scripts/safety-tools/dependency-mapper.js
curl http://localhost:3000/api/monitor/report

# Testing
node scripts/safety-tools/comprehensive-test-suite.js test
node scripts/safety-tools/validate-critical-paths.js
```

## Questions?

This monitoring system was created to ensure safe file cleanup without breaking the application. It follows industry best practices:

- Never delete, always quarantine
- Monitor before making changes
- Test everything
- Recover automatically when issues occur

When in doubt, keep monitoring disabled and the application runs normally.