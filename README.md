# Pricing Index File 2025

This repository contains the Northwest Custom Apparel Pricing Index File application for 2025. The application provides a user-friendly interface for searching and viewing product information, pricing, and inventory levels from SanMar's catalog.

## Features

- Product search by style number
- Color swatch selection with real-time image updates
- Detailed product information display
- Inventory levels by warehouse and size
- Pricing information for different quantity tiers and size ranges
- Support for various decoration methods (Embroidery, Cap Embroidery, DTG, Screen Print, DTF)

## Recent Updates

### Color Swatch Image Fix (April 2025)
- Fixed an issue where product images weren't updating when selecting different color swatches
- Implemented client-side changes to pass both COLOR_NAME and CATALOG_COLOR parameters to the API
- Enhanced server-side API to prioritize color-specific images and improve fallback mechanisms

## Technical Details

The application uses:
- HTML, CSS, and JavaScript for the frontend
- API integration with SanMar's product catalog
- Integration with Caspio for data storage and retrieval

## Usage

1. Enter a style number in the search box (e.g., PC61)
2. Select a color swatch to view product details and inventory for that color
3. Navigate between tabs to view different decoration methods and pricing

## Contact

For questions or support, contact Northwest Custom Apparel.