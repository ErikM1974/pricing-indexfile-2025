# SanMar Web Services API Reference

**Source:** SanMar Web Services Integration Guide v22.8 (November 2024, 139 pages)
**Created:** 2026-02-22
**Purpose:** Documents how ShopWorks communicates with SanMar for purchasing, inventory, and pricing

---

## Overview

SanMar provides a **SOAP XML API** (free for customers) covering product info, inventory, pricing, order status, invoicing, and packing slips. PO submission requires separate EDEV testing and approval (not covered in this doc).

## Authentication

| Type | Fields |
|------|--------|
| **Standard** | SanMarCustomerNumber + SanMar.com username + password |
| **PromoStandards** | id (username) + password |

---

## Production Endpoints

| Service | URL |
|---------|-----|
| Product Info | `ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl` |
| Inventory | `ws.sanmar.com:8080/SanMarWebService/SanMarWebServicePort?wsdl` |
| Pricing | `ws.sanmar.com:8080/SanMarWebService/SanMarPricingServicePort?wsdl` |
| PromoStandards Inventory V2 | `ws.sanmar.com:8080/promostandards/InventoryServiceBindingV2final?WSDL` |
| PromoStandards Pricing | `ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding?WSDL` |
| Order Status V2 | `ws.sanmar.com:8080/promostandards/OrderStatusServiceBindingV2?wsdl` |
| Invoicing | `ws.sanmar.com:8080/SanMarWebService/InvoicePort?wsdl` |
| LPN/Packing Slips | `ws.sanmar.com:8080/SanMarWebService/webservices/PackingSlipService?wsdl` |

---

## SanMar↔ShopWorks Data Bridge

### Size Format Translation

SanMar API uses **human-readable sizes**. ShopWorks uses **SKU suffixes**.

| SanMar Size | ShopWorks Suffix | Size Field | Notes |
|-------------|-----------------|------------|-------|
| S, M, L, XL | _(none)_ | Size01-04 | Base product |
| 2XL | `_2X` | Size05 | **Short form** only |
| XXL | `_XXL` | Size05 | Ladies/Womens ONLY (distinct from 2XL) |
| 3XL | `_3XL` | Size06 | Full form |
| 4XL | `_4XL` | Size06 | Full form |
| XS, 5XL, 6XL, 7XL | `_XS`, `_5XL`, etc. | Size06 | Full form |
| OSFA | `_OSFA` | Size06 | Caps, bags, towels |

**Key rule:** Only 2XL uses the short form (`_2X`). All others use full form.

### sizeIndex Mapping

SanMar's internal sort integer per size:

| sizeIndex | Size |
|-----------|------|
| 0 | XS |
| 100 | S |
| 200 | M |
| 300 | L |
| 400 | XL |
| 500 | 2XL |
| 600+ | 3XL, 4XL, etc. |

Conceptually maps to ShopWorks Size01-Size06 groupings.

### Color System

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| `catalogColor` | Mainframe Color (API key) | "BrillOrng" | Inventory queries, SanMar API calls |
| `COLOR_NAME` | Display name | "Brilliant Orange" | UI, customer-facing |

**ALWAYS use `catalogColor` for SanMar API calls**, never `COLOR_NAME`.

### Unique Identifiers

- **`uniqueKey`** / **`partId`**: SanMar's unique identifier per style+color+size SKU combination
- Used in order status, inventory, and invoice responses

---

## Pricing Tiers

SanMar returns multiple price levels per product:

| Tier | Description |
|------|-------------|
| `piecePrice` | Per-unit cost |
| `dozenPrice` | Per-dozen cost |
| `casePrice` | Per-case cost (best volume price) |
| `salePrice` | Current sale price (if active) |
| `myPrice` | Customer-specific negotiated price |
| `incentivePrice` | Special incentive pricing |

**Price variance by color:** Same style + size can have different prices for different colors (e.g., White is cheaper than colored). ShopWorks CSV uses a single price per size suffix.

---

## Warehouse Locations

| ID | Location |
|----|----------|
| 1 | Seattle, WA |
| 2 | Cincinnati, OH |
| 3 | Dallas, TX |
| 4 | Reno, NV |
| 5 | Robbinsville, NJ |
| 6 | Jacksonville, FL |
| 7 | Minneapolis, MN |
| 12 | Phoenix, AZ |
| 31 | Richmond, VA |

---

## Brand Restrictions

These brands **cannot be sold without embellishment** on third-party websites:
Nike, Carhartt, Eddie Bauer, New Era, The North Face, OGIO, Tommy Bahama, TravisMathew, Cotopaxi, Brooks Brothers

## MAP Pricing Rules

| Rule | Brands |
|------|--------|
| 10% off MSRP | Most brands (default) |
| 20% off MSRP | Port & Company, Sport-Tek, District, Port Authority (budget lines) |
| MSRP only | OGIO bags |

---

## PO Submission

**Not covered in this document.** PO Integration requires:
1. Separate EDEV testing environment
2. SanMar approval process
3. Different API endpoints

This doc covers **read-only services** only (product info, inventory, pricing, order status, invoicing, packing slips).

---

## Key API Response Examples

### getPricing Response
```xml
<style>lpc61</style>
<color>lime</color>
<size>m</size>
<casePrice>2.59</casePrice>
<myPrice>1.76</myPrice>
<sizeIndex>3</sizeIndex>
```

### Invoice Line Item
```xml
<StyleNo>PC55P</StyleNo>
<StyleColor>Safety Green</StyleColor>
<StyleSize>S</StyleSize>
```

---

## Related Documentation

- [SHOPWORKS_SIZE_MAPPING.md](./SHOPWORKS_SIZE_MAPPING.md) — ShopWorks Import CSV analysis (15,152 rows)
- [SANMAR_TO_SHOPWORKS_GUIDE.md](./SANMAR_TO_SHOPWORKS_GUIDE.md) — Transform SanMar products to ShopWorks format
- [SHOPWORKS_EXTENDED_SKU_PATTERNS.md](./SHOPWORKS_EXTENDED_SKU_PATTERNS.md) — Extended SKU suffix patterns
