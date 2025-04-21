# Catalog Instructions Implementation Plan

## Overview

This document outlines the plan for adding user instructions to the NW Custom Apparel Online Catalog website. The instructions will be placed between the hero image section and the product search gallery to help users understand how to use the site effectively.

## Implementation Details

### 1. Location in HTML

The instructions section will be placed between the hero image section (ending at line 356) and the gallery container (starting at line 358) in the `index.html` file.

```html
<!-- Hero Image Section ends at line 356 -->
</section>

<!-- New Instructions Section to be added here -->
<section id="catalog-instructions-section">
    <!-- Instructions content will go here -->
</section>

<!-- Gallery Container starts at line 358 -->
<div id="gallery-container">
```

### 2. CSS Styling

We'll add the following CSS to the `<head>` section of the `index.html` file, using the site's existing CSS variables for consistent styling:

```css
/* Catalog Instructions Styling */
.catalog-instructions {
    background-color: var(--background-light);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--spacing-md);
    margin: 0 auto var(--spacing-md) auto;
    max-width: 1200px;
    font-family: var(--font-family);
    line-height: 1.6;
    color: var(--text-color);
}

.catalog-instructions h3 {
    color: var(--primary-color);
    margin-top: 0;
    padding-bottom: var(--spacing-xs);
    border-bottom: 2px solid var(--primary-light);
}

.catalog-instructions h4 {
    color: var(--primary-color);
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-xs);
}

.catalog-instructions strong {
    color: var(--text-color);
    font-weight: 600;
}

.catalog-instructions ul {
    list-style-type: disc;
    margin-left: 20px;
    margin-bottom: var(--spacing-sm);
}

.catalog-instructions a {
    color: var(--primary-color);
    text-decoration: none;
    transition: color var(--transition-fast);
}

.catalog-instructions a:hover {
    text-decoration: underline;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .catalog-instructions {
        padding: var(--spacing-sm);
    }
}
```

### 3. Refined HTML Content

The following is the refined HTML content for the instructions section:

```html
<section id="catalog-instructions-section">
    <div class="catalog-instructions">
        <h3>Your Custom Look Starts Here: Find Apparel & See Decorated Pricing</h3>
        
        <p>Welcome! Browse thousands of apparel items ready for your custom logo or design. Finding your gear and seeing decoration pricing is easy:</p>
        
        <h4>1. Find Your Perfect Product:</h4>
        <ul>
            <li>Use the <strong>Search Filters Below</strong> - Enter a specific <strong>STYLE#</strong> or use the <strong>CATEGORY</strong>, <strong>SUBCATEGORY</strong>, and <strong>BRAND</strong> dropdowns to explore options.</li>
            <li>Hit the <strong>Search</strong> button to see results.</li>
        </ul>
        
        <h4>2. See Your Price – Decoration Included:</h4>
        <ul>
            <li><strong>Click any item</strong> from the search results.</li>
            <li>On the item's page, select from the <strong>decoration tabs</strong> (Embroidery, Screen Print, DTG, DTF).</li>
            <li>The price grid will show the <strong>price per item</strong>, including standard decoration, based on quantity.</li>
        </ul>
        
        <h4>3. Ready to Order or Have Questions?</h4>
        <p><strong>Note:</strong> Full online ordering is coming soon! Until then, we're here to help you place your order personally.</p>
        <p>Once you've found your items (note the Style #, color, quantity, and decoration method), contact us:</p>
        <ul>
            <li><strong>Email:</strong> <a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a></li>
            <li><strong>Contact Your Account Executive:</strong>
                <ul>
                    <li><strong>Taylar:</strong> <a href="mailto:taylar@nwcustomapparel.com">taylar@nwcustomapparel.com</a></li>
                    <li><strong>Nika:</strong> <a href="mailto:nika@nwcustomapparel.com">nika@nwcustomapparel.com</a></li>
                </ul>
            </li>
            <li><strong>Call:</strong> 253-922-5793 (Monday - Friday, 9:00 AM - 5:00 PM Pacific)</li>
            <li><strong>Visit Our Showroom</strong> in Milton, WA to see and feel the quality firsthand.</li>
        </ul>
        
        <p><strong>We look forward to working with you to create your custom apparel!</strong></p>
    </div>
</section>
```

### 4. Content Refinements

The content has been refined in the following ways:

1. **More Concise Headings and Text**:
   - Shortened the main heading while preserving the key message
   - Streamlined bullet points to be more direct
   - Removed redundant phrases while keeping all important information

2. **Improved Formatting**:
   - Consistent use of strong tags for emphasis
   - Clear hierarchy with h3 for main heading and h4 for section headings
   - Proper nesting of lists for contact information

3. **Preserved All Key Information**:
   - Three-step process for using the site
   - All contact methods and details
   - Note about online ordering coming soon
   - Mention of the showroom

## Implementation Steps

1. Switch to Code mode to implement these changes
2. Add the CSS to the head section of index.html
3. Insert the HTML content between the hero section and gallery container
4. Test the responsiveness on different screen sizes

## Next Steps

After implementation, we should:

1. Verify that the instructions display correctly on all device sizes
2. Ensure the styling is consistent with the rest of the site
3. Check that all links in the contact information work correctly