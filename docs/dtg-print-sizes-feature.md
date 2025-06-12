# DTG Print Sizes Feature

## Overview
Added print size information display to help users understand the dimensions of each DTG print location.

## Features

### 1. Info Box Shows Print Size
When a location is selected, the info box displays the print dimensions:
- Single locations: "Left Chest printing (4" x 4")"
- Combo locations: "Left Chest + Jumbo Back printing (LC: 4" x 4", JB: 16" x 20")"

### 2. Print Size Guide
A collapsible reference guide below the location dropdown shows all print sizes:
- Click "View Print Size Guide" to expand
- Shows all 9 location options with their dimensions
- Combo locations highlighted with different background

## Print Sizes Reference

| Location | Size |
|----------|------|
| Left Chest | 4" x 4" |
| Full Front | 12" x 16" |
| Full Back | 12" x 16" |
| Jumbo Front | 16" x 20" |
| Jumbo Back | 16" x 20" |
| Left Chest + Full Back | LC: 4" x 4", FB: 12" x 16" |
| Left Chest + Jumbo Back | LC: 4" x 4", JB: 16" x 20" |
| Full Front + Full Back | FF: 12" x 16", FB: 12" x 16" |
| Jumbo Front + Jumbo Back | JF: 16" x 20", JB: 16" x 20" |

## Implementation Details

### 1. DTG Config Updated
Added `printSizes` object to `dtg-config.js`:
```javascript
printSizes: {
    'LC': '4" x 4"',
    'FF': '12" x 16"',
    // ... etc
}
```

### 2. DTG Integration Enhanced
Modified location info retrieval to include size:
```javascript
// Get size from config if not provided by Caspio
maxSize: caspioLocation.maxSize || this.config.printSizes[locationCode]
```

### 3. Quick Quote Calculator
Added print size guide HTML:
```html
<div class="print-size-guide">
    <button class="size-guide-toggle">View Print Size Guide</button>
    <div class="size-guide-content">
        <!-- Size grid -->
    </div>
</div>
```

### 4. CSS Styling
Added collapsible guide styles to `dtg-specific.css`:
- Smooth expand/collapse animation
- Grid layout for size display
- Mobile responsive design

## Benefits

1. **Clear Communication** - Users know exact print dimensions
2. **Always Available** - Reference guide accessible anytime
3. **Works with Dynamic Locations** - Supports Caspio-added locations
4. **Mobile Friendly** - Responsive design for all devices

## Testing
Use `test-dtg-print-sizes.html` to see the feature in action.