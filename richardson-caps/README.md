# Richardson 112 Cap Image URLs

## Project Overview

This project contains a collection of high-resolution image URLs for Richardson 112 trucker caps in various color combinations. The URLs can be used to display or download images of the caps for e-commerce, product catalogs, or other applications.

## Directory Structure

- **`docs/`**: Documentation and catalogs
  - `richardson-caps-catalog-updated.md`: Comprehensive catalog of all cap colors
  - `richardson-combination-caps.md`: Specific catalog for combination caps

- **`data/`**: Raw data files
  - `richardson-combination-caps.json`: JSON data for combination caps

- **`scripts/`**: Code for generating the data
  - `richardson-combination-caps-manual.js`: Script to generate combination cap URLs

- **`view-combination-caps.html`**: Interactive viewer for combination caps

## Key Features

1. **High-Resolution Images**: All URLs use the full-size format with width=1600&height=950 parameters
2. **Comprehensive Color Coverage**:
   - 19 Solid colors
   - 52 Split (two-tone) colors
   - 25 Tri-color combinations
   - 18 Combination colors
3. **Well-Documented URL Patterns**:
   - Solid colors: Same color repeated 7 times
   - Split colors: Color1,Color2,Color1,Color1,Color1,Color2,Color2
   - Tri-colors: Color1,Color2,Color3,Color3,Color1,Color2,Color2
   - Combination colors: Base color with contrasting bill

## Usage

1. **Interactive Viewer**: Open `view-combination-caps.html` in a web browser to see all combination caps
2. **Direct Viewing**: Paste any URL directly into a web browser to view the cap
3. **Downloading Images**: Right-click on the image in your browser and select "Save Image As..."
4. **E-commerce Integration**: Use the URLs in product listings for accurate color representation
5. **Programmatic Usage**: Use the JSON data for integration with web applications

## Example URL

```
https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,White.jpg,White.jpg,Black.jpg,Black.jpg,Black.jpg
```

This URL displays a Black/Black/White combination cap.

## Project Organization

See `richardson-caps-project-organization.md` for details on the file organization and structure.