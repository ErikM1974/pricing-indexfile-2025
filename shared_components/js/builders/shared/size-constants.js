/**
 * builders/shared/size-constants.js — THE size↔ShopWorks-slot constants for the
 * quote builders (Batch 7.5, 2026-07-09; graduated from identical emb/state.js +
 * scp/state.js copies that size-constants-drift.test.js used to lock in sync —
 * that test now locks that the copies STAY re-exports of this file).
 *
 * ShopWorks Pattern 3: Size01-04 = S/M/L/XL, Size05 = 2XL (and ladies XXL,
 * own SKU suffix _XXL never _2X), Size06 = everything else. Mis-mapping
 * silently breaks SW line items.
 */

// Extended sizes that get their own line items
// (2XL goes to Size05 — dedicated; all others go to Size06 "Other")
export const EXTENDED_SIZES = ['XS', '2XL', '3XL', '4XL', '5XL', '6XL'];

// ShopWorks size slot mapping — Size01-04 standard, Size05 = 2XL ONLY,
// Size06 = everything else (mis-mapping silently breaks SW line items).
export const SIZE_TO_SLOT = {
    S: 'Size01', M: 'Size02', L: 'Size03', XL: 'Size04',
    '2XL': 'Size05',
    XS: 'Size06', '3XL': 'Size06', '4XL': 'Size06',
    '5XL': 'Size06', '6XL': 'Size06', OSFA: 'Size06',
};

// All sizes that go in the Size06 "Other/Catch-All" column
// (actual availability is fetched per product via the API; based on
// Python Inksoft/Inksoft_Size_Translation_Import.csv)
// NOT here by design: '2XL' and 'XXL' — both live in the DEDICATED Size05 column
// (ShopWorks Pattern 3). XXL is the ladies 2XL with its OWN SKU suffix (_XXL, never
// _2X), so it renders in the Size05 cell but keeps its name (Batch 2.0, 2026-07-09).
export const SIZE06_EXTENDED_SIZES = [
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
    'OSFA', 'OSFM',
    'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
    'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
    'YXS', 'YS', 'YM', 'YL', 'YXL',
    '2T', '3T', '4T', '5T', '5/6T', '6T',
    'LB', 'XLB', '2XLB',
    'XXS', '2XS',
];
