# Artwork Display System Guide

## Overview

The artwork display system in the NWCA Art Invoice system provides comprehensive viewing and management of artwork files stored in Caspio CDN. The system supports multiple images per art request with thumbnail previews, modal galleries, and download functionality.

**Last Updated**: 2025-01-02

## Architecture

### Data Structure

Artwork is stored in Caspio's ArtRequests table using four CDN link fields:
- `CDN_Link` - Primary artwork field
- `CDN_Link_Two` - Secondary artwork field  
- `CDN_Link_Three` - Third artwork field
- `CDN_Link_Four` - Fourth artwork field

Each field contains a direct URL to artwork stored in Caspio's CDN system.

### URL Pattern Recognition

Artwork URLs are identified by the presence of `/Artwork/` in the URL path:
```
https://cdn.caspio.com/A0E15000/Artwork/filename.jpg
```

**Important**: The base CDN URL `https://cdn.caspio.com/A0E15000` without `/Artwork/` is not considered valid artwork.

## Core Functions

### 1. Artwork Detection

```javascript
function hasArtwork(cdnLink) {
    return cdnLink && cdnLink.includes('/Artwork/') && cdnLink !== 'https://cdn.caspio.com/A0E15000';
}
```

**Purpose**: Determines if a CDN_Link field contains valid artwork
**Returns**: Boolean - true if valid artwork URL, false otherwise

### 2. Get First Artwork

```javascript
function getFirstArtwork(artRequest) {
    const cdnFields = ['CDN_Link', 'CDN_Link_Two', 'CDN_Link_Three', 'CDN_Link_Four'];
    
    for (const field of cdnFields) {
        if (hasArtwork(artRequest[field])) {
            return artRequest[field];
        }
    }
    return null;
}
```

**Purpose**: Returns the first valid artwork URL found
**Parameters**: `artRequest` - Complete art request object from Caspio
**Returns**: String URL or null if no artwork found

### 3. Get All Artworks

```javascript
function getAllArtworks(artRequest) {
    const cdnFields = ['CDN_Link', 'CDN_Link_Two', 'CDN_Link_Three', 'CDN_Link_Four'];
    const artworks = [];
    
    cdnFields.forEach((field, index) => {
        if (hasArtwork(artRequest[field])) {
            artworks.push({
                url: artRequest[field],
                label: `Artwork ${index + 1}`
            });
        }
    });
    
    return artworks;
}
```

**Purpose**: Returns all valid artwork URLs with labels
**Returns**: Array of objects with `url` and `label` properties

## Thumbnail Display System

### 4. Create Artwork Thumbnail

```javascript
function createArtworkThumbnail(artRequest) {
    const artworkUrl = getFirstArtwork(artRequest);
    
    if (!artworkUrl) {
        return `
            <div class="card-thumbnail no-image">
                <i class="fas fa-image"></i>
                <span>No artwork</span>
            </div>
        `;
    }
    
    // Count total artwork files
    const artworkCount = getAllArtworks(artRequest).length;
    const countBadge = artworkCount > 1 ? `<span class="artwork-count-badge">+${artworkCount - 1}</span>` : '';
    
    return `
        <div class="card-thumbnail artwork-thumbnail" onclick='showArtworkModal(${JSON.stringify(artRequest).replace(/'/g, "&#39;")})' style="position: relative; cursor: pointer;">
            <img src="${artworkUrl}" 
                 alt="Artwork ${artRequest.ID_Design}" 
                 onload="this.classList.add('loaded')"
                 onerror="this.parentElement.innerHTML='<div class=\\'card-thumbnail no-image\\'><i class=\\'fas fa-exclamation-triangle\\'></i><span>Failed to load</span></div>'"
                 loading="lazy">
            <i class="fas fa-search-plus"></i>
            ${countBadge}
        </div>
    `;
}
```

**Features**:
- Shows first available artwork as thumbnail
- Displays count badge for multiple images (+1, +2, etc.)
- Clickable to open modal gallery
- Error handling for failed image loads
- Lazy loading for performance

## Modal Gallery System

### Key Variables

```javascript
let currentArtworkIndex = 0;    // Current image index in modal
let currentArtworks = [];       // Array of artwork objects for current request
let currentDesignId = null;     // Design ID for current modal session
```

### 5. Show Artwork Modal

```javascript
function showArtworkModal(artRequest) {
    let modal = document.getElementById('artworkModal');
    if (!modal) {
        modal = createArtworkModal();
    }
    
    // Get all artworks for this request
    currentArtworks = getAllArtworks(artRequest);
    currentDesignId = artRequest.ID_Design;
    currentArtworkIndex = 0;
    
    if (currentArtworks.length === 0) {
        return;
    }
    
    // Update modal for gallery view
    updateArtworkModalContent();
    modal.classList.add('active');
}
```

**Purpose**: Opens modal gallery for viewing all artwork
**Parameters**: `artRequest` - Complete art request object

### 6. Navigation Functions

```javascript
function navigateArtwork(direction) {
    if (direction === 'prev' && currentArtworkIndex > 0) {
        currentArtworkIndex--;
    } else if (direction === 'next' && currentArtworkIndex < currentArtworks.length - 1) {
        currentArtworkIndex++;
    }
    updateArtworkModalContent();
}

function setArtworkIndex(index) {
    if (index >= 0 && index < currentArtworks.length) {
        currentArtworkIndex = index;
        updateArtworkModalContent();
    }
}
```

**Navigation Methods**:
- Previous/Next buttons
- Clickable indicators
- Keyboard support (can be added)

### 7. Download Functionality

```javascript
function downloadCurrentArtwork() {
    if (currentArtworks.length === 0 || currentArtworkIndex < 0) return;
    
    const artwork = currentArtworks[currentArtworkIndex];
    const link = document.createElement('a');
    link.href = artwork.url;
    link.download = `Design_${currentDesignId}_${artwork.label.replace(' ', '_')}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
```

**Features**:
- Downloads current image in modal
- Automatic filename: `Design_12345_Artwork_1.png`
- Opens in new tab as fallback

## CSS Classes and Styling

### Thumbnail Styles

```css
.card-thumbnail {
    width: 120px;
    height: 120px;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
    flex-shrink: 0;
    position: relative;
    border: 1px solid var(--border-color);
}

.artwork-thumbnail {
    position: relative;
    cursor: pointer;
}

.artwork-count-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    z-index: 3;
}
```

### Modal Styles

```css
.artwork-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    align-items: center;
    justify-content: center;
}

.artwork-modal.active {
    display: flex;
}

.artwork-modal-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    background: white;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
}
```

## Implementation Examples

### Basic Thumbnail Display

```javascript
// In a loop rendering art requests
requests.forEach(request => {
    const thumbnailHTML = createArtworkThumbnail(request);
    // Add thumbnailHTML to your card or list item
});
```

### Checking for Artwork

```javascript
// Before showing a thumbnail
if (getFirstArtwork(artRequest)) {
    // Show thumbnail
    const thumbnail = createArtworkThumbnail(artRequest);
} else {
    // Show "no artwork" placeholder
    const placeholder = '<div class="no-artwork">No artwork available</div>';
}
```

### Custom Thumbnail Implementation

```javascript
// For custom layouts
function customArtworkDisplay(artRequest) {
    const artworks = getAllArtworks(artRequest);
    
    if (artworks.length === 0) {
        return '<span class="no-artwork">No artwork</span>';
    }
    
    return `
        <div class="custom-artwork" onclick='showArtworkModal(${JSON.stringify(artRequest)})'>
            <img src="${artworks[0].url}" alt="Artwork">
            ${artworks.length > 1 ? `<span class="count">+${artworks.length - 1}</span>` : ''}
        </div>
    `;
}
```

## Mobile Responsiveness

The system includes mobile-optimized styles:

```css
@media (max-width: 768px) {
    .artwork-modal-content {
        max-width: 95vw;
        max-height: 95vh;
        padding: 0.5rem;
    }

    .modal-artwork-image {
        max-width: 90vw;
        max-height: 75vh;
    }
}
```

## Error Handling

### Image Load Failures

```javascript
// Automatic error handling in thumbnail
onerror="this.parentElement.innerHTML='<div class=\\'card-thumbnail no-image\\'><i class=\\'fas fa-exclamation-triangle\\'></i><span>Failed to load</span></div>'"
```

### Common Issues and Solutions

1. **Images not loading**: Check CDN_Link fields contain `/Artwork/` in URL
2. **Modal not opening**: Ensure `createArtworkModal()` is called and CSS is included
3. **Navigation not working**: Verify `currentArtworks` array is populated
4. **Download failing**: Check CORS settings and file permissions

## Integration Checklist

When adding artwork display to a new page:

### Required Functions
- [ ] `hasArtwork()`
- [ ] `getFirstArtwork()`
- [ ] `getAllArtworks()`
- [ ] `createArtworkThumbnail()`

### Modal System
- [ ] `showArtworkModal()`
- [ ] `updateArtworkModalContent()`
- [ ] `navigateArtwork()`
- [ ] `setArtworkIndex()`
- [ ] `createArtworkModal()`
- [ ] `closeArtworkModal()`
- [ ] `downloadCurrentArtwork()`

### CSS Requirements
- [ ] Thumbnail styles (`.card-thumbnail`, `.artwork-thumbnail`)
- [ ] Modal styles (`.artwork-modal`, `.artwork-modal-content`)
- [ ] Navigation styles (`.artwork-modal-nav`)
- [ ] Indicator styles (`.artwork-indicator`)
- [ ] Badge styles (`.artwork-count-badge`)

### Testing
- [ ] Single image display
- [ ] Multiple image navigation
- [ ] No artwork placeholder
- [ ] Download functionality
- [ ] Mobile responsiveness
- [ ] Error handling

## Best Practices

1. **Always use the helper functions** - Don't directly access CDN_Link fields
2. **Handle missing artwork gracefully** - Show appropriate placeholders
3. **Escape JSON data** - Use `.replace(/'/g, "&#39;")` when embedding in HTML
4. **Include error handling** - Use `onerror` attributes on images
5. **Test with various data** - Include records with 0, 1, and multiple images
6. **Optimize for performance** - Use lazy loading and appropriate image sizes

## Files Using This System

### Currently Implemented
- `art-invoice-unified-dashboard.html` - Main dashboard with working implementation
- `calculators/art-invoice-creator.html` - Invoice creator with full modal system

### Implementation Notes
- Both files use identical artwork helper functions
- Modal system provides consistent user experience
- CSS is included in each file for self-contained operation

This guide provides everything needed to implement or maintain the artwork display system across the NWCA Art Invoice platform.