# Cap Embroidery Pricing Migration Plan

## Current Status
- **New Page**: `/cap-embroidery-pricing-integrated.html` - Working with Universal components
- **Old Page**: `/pricing/cap-embroidery` - Has quote system features

## Features to Migrate

### 1. Quote API Integration
- [ ] Add `quote-api-client.js`
- [ ] Add `base-quote-system.js`
- [ ] Add `cap-embroidery-quote-adapter.js`
- [ ] Add auto-save functionality

### 2. Quote UI Components
- [ ] Add quote dropdown to header
- [ ] Replace CTAs with functional "Add to Quote" button
- [ ] Add quote builder section
- [ ] Add print/share quote buttons

### 3. Advanced Features
- [ ] Multi-color matrix support
- [ ] Cumulative pricing calculations
- [ ] PDF generation capability

## Migration Steps

### Phase 1: Archive Old Page (Immediate)
1. Rename `/pricing/cap-embroidery` to `/pricing/cap-embroidery-legacy`
2. Update product page button to use new integrated page
3. Add redirect from old URL to new page

### Phase 2: Add Quote System (Next Sprint)
1. Copy quote system scripts to new page
2. Integrate with Universal Pricing Grid
3. Test quote functionality

### Phase 3: Complete Migration
1. Add remaining features (multi-color, PDF)
2. Full testing
3. Remove legacy page

## Product Page Button Update

Change the "Get Bulk Pricing" button to point to:
```javascript
// From:
window.location.href = `/pricing/cap-embroidery?StyleNumber=${styleNumber}&COLOR=${encodeURIComponent(color)}`;

// To:
window.location.href = `/cap-embroidery-pricing-integrated.html?StyleNumber=${styleNumber}&COLOR=${encodeURIComponent(color)}`;
```

## Benefits of Migration
1. Maintains all quote functionality
2. Uses modern Universal components
3. Better performance (no infinite loops)
4. Consistent UI/UX across pricing pages
5. Easier maintenance