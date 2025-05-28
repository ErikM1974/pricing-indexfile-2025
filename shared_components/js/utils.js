// utils.js - Shared utility functions for NWCA frontend

/**
 * @namespace NWCAUtils
 */
window.NWCAUtils = (function() {
    'use strict';

    function debugUtil(level, message, data = null) {
        console.log(`[NWCAUtils-${level}] ${message}`, data);
    }

    /**
     * Formats a numerical amount into a USD currency string.
     * @param {number|string} amount - The amount to format.
     * @returns {string} - Formatted currency string (e.g., "$10.50").
     */
    function formatCurrency(amount) {
        const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g,"")) : Number(amount);
        if (isNaN(numericAmount)) {
            debugUtil("WARN", "formatCurrency received non-numeric value:", amount);
            return '$?.??'; 
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numericAmount);
    }

    /**
     * Formats an embellishment type string for display.
     * @param {string} type - The raw embellishment type.
     * @returns {string} - The formatted embellishment type.
     */
    function formatEmbellishmentType(type) {
        if (!type) return 'Unknown';
        const typeLower = String(type).toLowerCase();
        switch (typeLower) {
            case 'embroidery': return 'Embroidery';
            case 'cap-embroidery': return 'Cap Embroidery';
            case 'dtg': return 'DTG Print';
            case 'dtf': return 'DTF Transfer';
            case 'screen-print': case 'screenprint': return 'Screen Print';
            case 'vinyl': return 'Vinyl/Heat Transfer';
            default:
                return String(type).charAt(0).toUpperCase() + String(type).slice(1);
        }
    }

    /**
     * Gets a display color associated with an embellishment type.
     * @param {string} type - The embellishment type.
     * @returns {string} - A hex color code.
     */
    function getEmbellishmentColor(type) {
        if (!type) return '#6c757d'; // Default Gray
        const typeLower = String(type).toLowerCase();
        switch (typeLower) {
            case 'embroidery': return '#28a745'; // Green
            case 'cap-embroidery': return '#20c997'; // Teal
            case 'dtg': return '#007bff'; // Blue
            case 'dtf': return '#6f42c1'; // Purple
            case 'screen-print': case 'screenprint': return '#fd7e14'; // Orange
            case 'vinyl': return '#dc3545'; // Red
            default: return '#6c757d'; // Gray
        }
    }

    /**
     * Formats an option name (e.g., camelCase or snake_case) into a display-friendly title case.
     * @param {string} name - The option name.
     * @returns {string} - The formatted option name.
     */
    function formatOptionName(name) {
        if (!name) return '';
        return String(name)
           .replace(/([A-Z])/g, ' $1')
           .replace(/_/g, ' ')
           .replace(/^./, str => str.toUpperCase())
           .trim();
    }

    /**
     * Formats an option value for display.
     * @param {string} key - The option key (can be used for context-specific formatting).
     * @param {any} value - The option value.
     * @returns {string} - The formatted option value.
     */
    function formatOptionValue(key, value) {
        if (value === null || typeof value === 'undefined') {
            return 'N/A';
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        const keyLower = String(key).toLowerCase();
        if (keyLower.includes('stitchcount') || keyLower.includes('stitches')) {
            return `${Number(value).toLocaleString()} stitches`;
        }
        if (keyLower.includes('colorcount') || keyLower.includes('colors')) {
            const count = Number(value);
            return `${count} color${count !== 1 ? 's' : ''}`;
        }
        return String(value);
    }

    /**
     * Creates a product page URL based on item data.
     * @param {object} item - Cart item data (must have styleNumber, optionally color, embellishmentType, sourceUrl).
     * @returns {string} - URL to the product page.
     */
    function createProductUrl(item) {
        if (item.sourceUrl) {
            return item.sourceUrl;
        }
        let pagePath = 'embroidery-pricing.html'; // Default
        if (item.embellishmentType) {
            const embType = String(item.embellishmentType).toLowerCase();
            if (embType === 'dtg') pagePath = 'dtg-pricing.html';
            else if (embType === 'screen-print' || embType === 'screenprint') pagePath = 'screen-print-pricing.html';
            else if (embType === 'cap-embroidery') pagePath = 'cap-embroidery-pricing.html';
            else if (embType === 'dtf') pagePath = 'dtf-pricing.html';
        }
        let url = `${pagePath}?StyleNumber=${encodeURIComponent(item.styleNumber || '')}`;
        if (item.color) {
            url += `&COLOR=${encodeURIComponent(item.color)}`;
        }
        return url;
    }

    /**
     * Sorts an array of size objects based on a predefined group order.
     * Sizes not in the group order are typically sorted alphabetically at the end.
     * @param {Array<object>} sizesToSort - Array of size objects (e.g., [{size: 'M', ...}, {size: 'S', ...}]).
     * @param {Array<string>} groupOrder - Ordered array of size names (e.g., ['S', 'M', 'L', 'XL']).
     * @returns {Array<object>} The sorted array of size objects.
     */
    function sortSizesByGroupOrder(sizesToSort, groupOrder) {
        if (!Array.isArray(sizesToSort)) return [];
        if (!Array.isArray(groupOrder) || groupOrder.length === 0) {
            debugUtil("SORT-WARN", "No valid groupOrder for sortSizesByGroupOrder, returning original or alphabetical.");
            return [...sizesToSort].sort((a, b) => String(a.size).localeCompare(String(b.size)));
        }
        const orderMap = new Map(groupOrder.map((size, index) => [String(size).toUpperCase(), index]));
        return [...sizesToSort].sort((a, b) => {
            const sizeA = String(a.size).toUpperCase();
            const sizeB = String(b.size).toUpperCase();
            const indexA = orderMap.get(sizeA);
            const indexB = orderMap.get(sizeB);
            if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
            if (indexA !== undefined) return -1;
            if (indexB !== undefined) return 1;
            return sizeA.localeCompare(sizeB);
        });
    }

    /**
     * Normalizes a color name for consistent comparison or use as a CSS class/ID.
     * Converts to lowercase, removes spaces and common punctuation, and standardizes common terms.
     * @param {string} name - The color name to normalize.
     * @returns {string} The normalized color name.
     */
    function normalizeColorName(name) {
        if (!name || typeof name !== 'string') return '';
        return name.toLowerCase()
            .replace(/\s+/g, '')        // Remove all spaces
            .replace(/[./&()']/g, '')   // Remove . / & ( ) '
            .replace(/safetygreen/g, 'sgreen')     // Standardize common variations
            .replace(/safetyorange/g, 'sorange')
            .replace(/safetyyellow/g, 'syellow')
            .replace(/stonewashed/g, 'stonewash');
    }

/**
     * Retrieves a URL parameter by its name.
     * @param {string} name - The name of the URL parameter.
     * @returns {string|null} The value of the parameter, or null if not found.
     */
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    /**
     * Defines a standard order for apparel sizes.
     * OSFA (One Size Fits All) is treated as a unique case.
     */
    const STANDARD_SIZE_ORDER = [
        'XS', 'S', 'M', 'L', 'XL',
        '2XL', 'XXL',
        '3XL', 'XXXL',
        '4XL', 'XXXXL',
        '5XL', 'XXXXXL',
        '6XL', 'XXXXXXL',
        'OSFA' // One Size Fits All
    ];

    /**
     * Gets the numerical index of a size based on the standard order.
     * @param {string} size - The size string (e.g., "M", "2XL").
     * @returns {number} The index of the size, or -1 if not found.
     */
    function getSizeOrderIndex(size) {
        if (!size || typeof size !== 'string') return -1;
        const upperSize = size.toUpperCase().trim();
        const index = STANDARD_SIZE_ORDER.indexOf(upperSize);
        // Handle common variations like XXL for 2XL
        if (index === -1) {
            if (upperSize === 'XXL') return STANDARD_SIZE_ORDER.indexOf('2XL');
            if (upperSize === 'XXXL') return STANDARD_SIZE_ORDER.indexOf('3XL');
            // Add more variations if needed
        }
        return index;
    }

    /**
     * Checks if a given size falls within a specified size range (e.g., "S-XL").
     * @param {string} sizeToCheck - The size to check (e.g., "M").
     * @param {string} rangeStartSize - The start of the range (e.g., "S").
     * @param {string} rangeEndSize - The end of the range (e.g., "XL").
     * @returns {boolean} True if the size is within the range (inclusive), false otherwise.
     */
    function isSizeInRange(sizeToCheck, rangeStartSize, rangeEndSize) {
        const checkIndex = getSizeOrderIndex(sizeToCheck);
        const startIndex = getSizeOrderIndex(rangeStartSize);
        const endIndex = getSizeOrderIndex(rangeEndSize);

        if (checkIndex === -1 || startIndex === -1 || endIndex === -1) {
            // If any size is not recognized, cannot reliably determine range.
            // Fallback to simple string comparison if it's an exact match for start or end.
            // This is a basic fallback, more complex non-standard sizes might not work.
            const upperCheck = String(sizeToCheck).toUpperCase().trim();
            if (upperCheck === String(rangeStartSize).toUpperCase().trim()) return true;
            if (upperCheck === String(rangeEndSize).toUpperCase().trim()) return true;
            debugUtil("WARN", `isSizeInRange: Unrecognized size(s) for range check. Check: ${sizeToCheck}, Start: ${rangeStartSize}, End: ${rangeEndSize}`);
            return false;
        }
        return checkIndex >= startIndex && checkIndex <= endIndex;
    }

    // Public API
    return {
        formatCurrency,
        formatEmbellishmentType,
        getEmbellishmentColor,
        formatOptionName,
        formatOptionValue,
        createProductUrl,
        sortSizesByGroupOrder,
        normalizeColorName, // Expose normalizeColorName
        getUrlParameter,
        isSizeInRange, // Expose the new function
        getSizeOrderIndex, // Expose helper if needed elsewhere
        debugUtil
    };
})();