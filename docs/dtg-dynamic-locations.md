# DTG Dynamic Locations Implementation

## Overview
The DTG location dropdown now populates dynamically from Caspio data instead of using hardcoded values.

## What Changed

### 1. Added Dynamic Dropdown Update Function
In `dtg-adapter.js`, added `updateLocationDropdownFromBundle()`:
```javascript
function updateLocationDropdownFromBundle(masterBundle) {
    const dropdown = document.getElementById('dtg-location-select');
    if (!dropdown || !masterBundle.printLocationMeta) return;
    
    // Clear and repopulate dropdown with Caspio locations
    dropdown.innerHTML = '<option value="">-- Choose Print Location --</option>';
    
    masterBundle.printLocationMeta.forEach(location => {
        const option = document.createElement('option');
        option.value = location.code;
        option.textContent = location.name || location.code;
        dropdown.appendChild(option);
    });
}
```

### 2. Called Function in Master Bundle Processing
In `processMasterBundle()`:
```javascript
// Update the location dropdown with data from Caspio
updateLocationDropdownFromBundle(masterBundle);
```

### 3. Updated Location Info Retrieval
In `dtg-integration.js`, modified to check Caspio data first:
```javascript
// Try to get location info from Caspio data first
if (window.dtgMasterPriceBundle && window.dtgMasterPriceBundle.printLocationMeta) {
    const caspioLocation = window.dtgMasterPriceBundle.printLocationMeta.find(
        loc => loc.code === locationCode
    );
    // Use Caspio data if found
}
// Fall back to config if not found
```

## Benefits

1. **No Code Updates Required** - Add/remove locations in Caspio only
2. **Automatic Synchronization** - Changes appear immediately
3. **Single Source of Truth** - Caspio manages all location data
4. **Backwards Compatible** - Falls back to config if needed

## How It Works

1. User loads DTG page
2. Caspio sends master bundle with `printLocationMeta` array
3. DTG adapter populates dropdown from this data
4. Any location in Caspio appears in dropdown

## Adding New Locations

To add "Left Chest + Jumbo Back":
1. Add it in Caspio with code `LC_JB`
2. It automatically appears in the dropdown
3. No JavaScript changes needed!

## Testing
Use `test-dynamic-locations.html` to see the dynamic dropdown in action.