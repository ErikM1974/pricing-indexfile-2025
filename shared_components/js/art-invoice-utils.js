/* Art Invoice System - Shared JavaScript Utilities
   =============================================
   This file contains all shared JavaScript functions for the Art Invoice system
   Extracted from art-invoice-creator.html and art-invoice-view.html
   Created: 2025-07-03
   ============================================= */

// ========================================
// Artwork Display System Functions
// ========================================

/**
 * Check if a CDN link contains valid artwork
 * @param {string} cdnLink - The CDN URL to check
 * @returns {boolean} True if the link contains artwork
 */
function hasArtwork(cdnLink) {
    return cdnLink && cdnLink.includes('/Artwork/') && cdnLink !== 'https://cdn.caspio.com/A0E15000';
}

/**
 * Get the first available artwork URL from an art request
 * @param {Object} artRequest - The art request object
 * @returns {string|null} The first artwork URL or null if none found
 */
function getFirstArtwork(artRequest) {
    const cdnFields = ['CDN_Link', 'CDN_Link_Two', 'CDN_Link_Three', 'CDN_Link_Four'];
    
    for (const field of cdnFields) {
        if (hasArtwork(artRequest[field])) {
            return artRequest[field];
        }
    }
    return null;
}

/**
 * Get all artwork URLs from an art request
 * @param {Object} artRequest - The art request object
 * @returns {Array} Array of artwork objects with url and label
 */
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

/**
 * Create an artwork thumbnail HTML element
 * @param {Object} artRequest - The art request object
 * @returns {string} HTML string for the thumbnail
 */
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

// ========================================
// Artwork Modal Gallery System
// ========================================

// Global variables for modal state
let currentArtworkIndex = 0;
let currentArtworks = [];
let currentDesignId = null;

/**
 * Show artwork modal for viewing images
 * @param {Object|string} artRequestOrUrl - Either art request object or direct image URL
 * @param {string} label - Optional label for direct image URL
 */
function showArtworkModal(artRequestOrUrl, label) {
    let modal = document.getElementById('artworkModal');
    if (!modal) {
        modal = createArtworkModal();
    }
    
    // Handle both art request objects and direct URLs
    if (typeof artRequestOrUrl === 'string') {
        // Direct URL mode
        currentArtworks = [{
            url: artRequestOrUrl,
            label: label || 'Artwork'
        }];
        currentDesignId = null;
        currentArtworkIndex = 0;
    } else {
        // Art request mode
        currentArtworks = getAllArtworks(artRequestOrUrl);
        currentDesignId = artRequestOrUrl.ID_Design;
        currentArtworkIndex = 0;
    }
    
    if (currentArtworks.length === 0) {
        return;
    }
    
    updateArtworkModalContent();
    modal.classList.add('active');
}

/**
 * Update the artwork modal content with current image
 */
function updateArtworkModalContent() {
    if (currentArtworks.length === 0 || currentArtworkIndex < 0 || currentArtworkIndex >= currentArtworks.length) {
        return;
    }
    
    const artwork = currentArtworks[currentArtworkIndex];
    const modal = document.getElementById('artworkModal');
    const modalContent = modal.querySelector('.artwork-modal-content');
    
    // Update image
    const img = modalContent.querySelector('.modal-artwork-image');
    img.src = artwork.url;
    img.alt = artwork.label;
    
    // Update title
    const title = modalContent.querySelector('.artwork-modal-title');
    if (title) {
        title.textContent = currentDesignId ? `Design #${currentDesignId} - ${artwork.label}` : artwork.label;
    }
    
    // Update navigation visibility
    const prevBtn = modalContent.querySelector('.artwork-modal-nav.prev');
    const nextBtn = modalContent.querySelector('.artwork-modal-nav.next');
    if (prevBtn) prevBtn.style.display = currentArtworkIndex > 0 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentArtworkIndex < currentArtworks.length - 1 ? 'flex' : 'none';
    
    // Update indicators
    updateArtworkIndicators();
}

/**
 * Update the indicator dots for multiple images
 */
function updateArtworkIndicators() {
    const indicatorsContainer = document.querySelector('.artwork-indicators');
    if (!indicatorsContainer || currentArtworks.length <= 1) {
        if (indicatorsContainer) indicatorsContainer.style.display = 'none';
        return;
    }
    
    indicatorsContainer.style.display = 'flex';
    indicatorsContainer.innerHTML = '';
    
    currentArtworks.forEach((_, index) => {
        const indicator = document.createElement('button');
        indicator.className = `artwork-indicator ${index === currentArtworkIndex ? 'active' : ''}`;
        indicator.onclick = () => setArtworkIndex(index);
        indicatorsContainer.appendChild(indicator);
    });
}

/**
 * Navigate to previous/next artwork
 * @param {string} direction - 'prev' or 'next'
 */
function navigateArtwork(direction) {
    if (direction === 'prev' && currentArtworkIndex > 0) {
        currentArtworkIndex--;
    } else if (direction === 'next' && currentArtworkIndex < currentArtworks.length - 1) {
        currentArtworkIndex++;
    }
    updateArtworkModalContent();
}

/**
 * Set artwork index directly
 * @param {number} index - The index to set
 */
function setArtworkIndex(index) {
    if (index >= 0 && index < currentArtworks.length) {
        currentArtworkIndex = index;
        updateArtworkModalContent();
    }
}

/**
 * Create the artwork modal element
 * @returns {HTMLElement} The modal element
 */
function createArtworkModal() {
    const modal = document.createElement('div');
    modal.id = 'artworkModal';
    modal.className = 'artwork-modal';
    modal.innerHTML = `
        <div class="artwork-modal-content" onclick="event.stopPropagation()">
            <button class="artwork-modal-close" onclick="closeArtworkModal()">
                <i class="fas fa-times"></i>
            </button>
            <div class="artwork-modal-header">
                <h3 class="artwork-modal-title">Artwork</h3>
            </div>
            <div class="artwork-modal-body">
                <button class="artwork-modal-nav prev" onclick="navigateArtwork('prev')">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <img class="modal-artwork-image" src="" alt="Artwork">
                <button class="artwork-modal-nav next" onclick="navigateArtwork('next')">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="artwork-indicators"></div>
            <button class="artwork-modal-download" onclick="downloadCurrentArtwork()">
                <i class="fas fa-download"></i> Download
            </button>
        </div>
    `;
    
    // Close on background click
    modal.onclick = closeArtworkModal;
    
    document.body.appendChild(modal);
    return modal;
}

/**
 * Close the artwork modal
 */
function closeArtworkModal() {
    const modal = document.getElementById('artworkModal');
    if (modal) {
        modal.classList.remove('active');
        // Reset state
        currentArtworks = [];
        currentArtworkIndex = 0;
        currentDesignId = null;
    }
}

/**
 * Download the current artwork
 */
function downloadCurrentArtwork() {
    if (currentArtworks.length === 0 || currentArtworkIndex < 0) return;
    
    const artwork = currentArtworks[currentArtworkIndex];
    const link = document.createElement('a');
    link.href = artwork.url;
    link.download = currentDesignId ? 
        `Design_${currentDesignId}_${artwork.label.replace(' ', '_')}.png` : 
        `${artwork.label.replace(' ', '_')}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Download artwork with specific URL and label
 * @param {string} imageUrl - The image URL to download
 * @param {string} label - The label for the file
 */
function downloadArtwork(imageUrl, label) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = label || 'artwork.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ========================================
// Date Formatting Functions
// ========================================

/**
 * Format a date string to MM/DD/YYYY
 * @param {string} dateString - The date string to format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    if (isNaN(date)) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Format a date to ISO string for input fields
 * @param {Date|string} date - The date to format
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0];
}

/**
 * Add days to a date
 * @param {Date|string} date - The starting date
 * @param {number} days - Number of days to add
 * @returns {Date} The new date
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// ========================================
// Status Badge Functions
// ========================================

/**
 * Get the appropriate icon for a status
 * @param {string} status - The status value
 * @returns {string} Font Awesome icon class
 */
function getStatusIcon(status) {
    const statusIcons = {
        'draft': 'fa-file-alt',
        'sent': 'fa-paper-plane',
        'paid': 'fa-check-circle',
        'partial': 'fa-adjust',
        'overdue': 'fa-exclamation-circle',
        'void': 'fa-ban',
        'cancelled': 'fa-times-circle'
    };
    return statusIcons[status.toLowerCase()] || 'fa-circle';
}

/**
 * Create a status badge HTML element
 * @param {string} status - The status value
 * @param {string} customClass - Optional custom CSS class
 * @returns {string} HTML string for the status badge
 */
function createStatusBadge(status, customClass = '') {
    const icon = getStatusIcon(status);
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    return `
        <span class="status-badge ${statusClass} ${customClass}">
            <i class="fas ${icon}"></i>
            ${status}
        </span>
    `;
}

// ========================================
// Alert/Notification Functions
// ========================================

/**
 * Show an alert message
 * @param {string} message - The message to display
 * @param {string} type - Alert type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (0 = permanent)
 */
function showAlert(message, type = 'info', duration = 5000) {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    
    alert.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    alertContainer.appendChild(alert);
    
    if (duration > 0) {
        setTimeout(() => {
            alert.remove();
        }, duration);
    }
}

/**
 * Show an error message
 * @param {string} message - The error message to display
 */
function showError(message) {
    showAlert(message, 'error', 0); // Permanent until dismissed
}

/**
 * Show a success message
 * @param {string} message - The success message to display
 */
function showSuccess(message) {
    showAlert(message, 'success', 5000);
}

/**
 * Create alert container if it doesn't exist
 * @returns {HTMLElement} The alert container element
 */
function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    document.body.appendChild(container);
    return container;
}

// ========================================
// Sales Rep Directory Functions
// ========================================

// Sales rep directory data
const SALES_REP_DIRECTORY = {
    'sales@nwcustomapparel.com': { name: 'General Sales', firstName: 'Sales' },
    'ruth@nwcustomapparel.com': { name: 'Ruth Nhong', firstName: 'Ruth' },
    'taylar@nwcustomapparel.com': { name: 'Taylar Hanson', firstName: 'Taylar' },
    'nika@nwcustomapparel.com': { name: 'Nika Lao', firstName: 'Nika' },
    'erik@nwcustomapparel.com': { name: 'Erik Mickelson', firstName: 'Erik' },
    'adriyella@nwcustomapparel.com': { name: 'Adriyella', firstName: 'Adriyella' },
    'bradley@nwcustomapparel.com': { name: 'Bradley Wright', firstName: 'Bradley' },
    'jim@nwcustomapparel.com': { name: 'Jim Mickelson', firstName: 'Jim' },
    'art@nwcustomapparel.com': { name: 'Steve Deland', firstName: 'Steve' }
};

/**
 * Get sales rep name from email
 * @param {string} email - The sales rep email
 * @returns {string} The sales rep's full name
 */
function getSalesRepName(email) {
    const rep = SALES_REP_DIRECTORY[email];
    return rep ? rep.name : email;
}

/**
 * Get sales rep first name from email
 * @param {string} email - The sales rep email
 * @returns {string} The sales rep's first name
 */
function getSalesRepFirstName(email) {
    const rep = SALES_REP_DIRECTORY[email];
    return rep ? rep.firstName : email.split('@')[0];
}

/**
 * Get sales rep email from name
 * @param {string} name - The sales rep name
 * @returns {string} The sales rep's email
 */
function getSalesRepEmail(name) {
    // Search through directory for matching name
    for (const [email, rep] of Object.entries(SALES_REP_DIRECTORY)) {
        if (rep.name === name || rep.firstName === name) {
            return email;
        }
    }
    // Default to general sales if not found
    return ART_INVOICE_CONFIG.COMPANY.EMAIL;
}

// ========================================
// Service Code Functions
// ========================================

/**
 * Parse service items from notes text
 * @param {string} notes - The notes text containing service codes
 * @returns {Array} Array of service item objects
 */
function parseServiceItemsFromNotes(notes) {
    if (!notes) return [];
    
    const serviceItems = [];
    const lines = notes.split('\n');
    
    const serviceCodePattern = /\b(GRT-\d+|GRTA-\d+|VRT-\d+|VRTA-\d+|SRT-\d+|SRTA-\d+|MSRT-\d+|UST-\d+|USTA-\d+)\b/gi;
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            const matches = trimmedLine.match(serviceCodePattern);
            if (matches) {
                matches.forEach(code => {
                    const upperCode = code.toUpperCase();
                    const match = upperCode.match(/(GRT|GRTA|VRT|VRTA|SRT|SRTA|MSRT|UST|USTA)-(\d+)/);
                    if (match) {
                        const [, prefix, timeValue] = match;
                        const time = parseInt(timeValue);
                        
                        let description = '';
                        if (prefix === 'GRT') description = `General Art - ${time} minutes`;
                        else if (prefix === 'GRTA') description = `General Art Additional - ${time} minutes`;
                        else if (prefix === 'VRT') description = `Vector Art - ${time} minutes`;
                        else if (prefix === 'VRTA') description = `Vector Art Additional - ${time} minutes`;
                        else if (prefix === 'SRT') description = `Spec Art - ${time} minutes`;
                        else if (prefix === 'SRTA') description = `Spec Art Additional - ${time} minutes`;
                        else if (prefix === 'MSRT') description = `Mock Spec Art - ${time} minutes`;
                        else if (prefix === 'UST') description = `Urgent Art - ${time} minutes`;
                        else if (prefix === 'USTA') description = `Urgent Art Additional - ${time} minutes`;
                        
                        serviceItems.push({
                            code: upperCode,
                            time: time,
                            description: description,
                            quantity: 1
                        });
                    }
                });
            }
        }
    });
    
    return serviceItems;
}

/**
 * Infer service codes from art request data
 * @param {Object} request - The art request object
 * @returns {Array} Array of inferred service codes
 */
function inferServiceCodes(request) {
    const codes = [];
    
    // Check for art minutes
    if (request.Art_Minutes) {
        const minutes = parseInt(request.Art_Minutes);
        if (minutes > 0) {
            if (request.Mock === 'Yes' || request.Mockup === 'Yes') {
                codes.push(`MSRT-${minutes}`);
            } else if (request.Priority === 'Urgent' || request.Priority === 'Rush') {
                codes.push(`UST-${minutes}`);
            } else {
                codes.push(`GRT-${minutes}`);
            }
        }
    }
    
    // Check notes for service codes
    if (request.NOTES) {
        const noteCodes = parseServiceItemsFromNotes(request.NOTES);
        codes.push(...noteCodes.map(item => item.code));
    }
    
    return [...new Set(codes)]; // Remove duplicates
}

/**
 * Clean project name by removing service codes and extra whitespace
 * @param {string} rawText - The raw project name text
 * @returns {string} Cleaned project name
 */
function cleanProjectName(rawText) {
    if (!rawText) return '';
    
    let cleaned = rawText;
    
    // Remove service codes
    const serviceCodePattern = /\b(GRT-\d+|GRTA-\d+|VRT-\d+|VRTA-\d+|SRT-\d+|SRTA-\d+|MSRT-\d+|UST-\d+|USTA-\d+)\b/gi;
    cleaned = cleaned.replace(serviceCodePattern, '');
    
    // Remove extra whitespace and clean up
    cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/,+/g, ',')
        .replace(/^[\s,]+|[\s,]+$/g, '')
        .trim();
    
    return cleaned;
}

// ========================================
// DOM Helper Functions
// ========================================

/**
 * Safely get element value with default
 * @param {string} id - The element ID
 * @param {*} defaultValue - Default value if element not found
 * @returns {*} The element value or default
 */
function safeGetElementValue(id, defaultValue = '') {
    const element = document.getElementById(id);
    return element ? element.value : defaultValue;
}

/**
 * Safely get checkbox value with default
 * @param {string} id - The checkbox element ID
 * @param {boolean} defaultValue - Default value if element not found
 * @returns {boolean} The checkbox checked state or default
 */
function safeGetCheckboxValue(id, defaultValue = false) {
    const element = document.getElementById(id);
    return element ? element.checked : defaultValue;
}

/**
 * Safely set element value
 * @param {string} id - The element ID
 * @param {*} value - The value to set
 * @returns {boolean} True if successful
 */
function safeSetElementValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
        return true;
    }
    return false;
}

/**
 * Safely set element text content
 * @param {string} id - The element ID
 * @param {string} text - The text to set
 * @returns {boolean} True if successful
 */
function safeSetElementText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Get order type from art request
 * @param {Object} request - The art request object
 * @returns {string} The order type
 */
function getOrderType(request) {
    if (!request.OrderType) return 'Standard';
    
    const orderType = request.OrderType.toLowerCase();
    
    if (orderType.includes('program')) return 'Program Account';
    if (orderType.includes('addon') || orderType.includes('add-on')) return 'Add-on Order';
    if (orderType.includes('rush') || orderType.includes('urgent')) return 'Rush Order';
    if (orderType.includes('sample')) return 'Sample';
    if (orderType.includes('reorder')) return 'Reorder';
    
    return request.OrderType;
}

/**
 * Get request status from art request
 * @param {Object} request - The art request object
 * @returns {string} The request status
 */
function getRequestStatus(request) {
    if (!request.Status) return 'Unknown';
    
    const status = request.Status.toLowerCase();
    
    if (status.includes('complete')) return 'Completed';
    if (status.includes('progress')) return 'In Progress';
    if (status.includes('pending')) return 'Pending';
    if (status.includes('cancel')) return 'Cancelled';
    if (status.includes('hold')) return 'On Hold';
    
    return request.Status;
}

/**
 * Format currency value
 * @param {number} value - The numeric value
 * @returns {string} Formatted currency string
 */
function formatCurrency(value) {
    if (isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Parse currency string to number
 * @param {string} currencyString - The currency string
 * @returns {number} The numeric value
 */
function parseCurrency(currencyString) {
    if (!currencyString) return 0;
    return parseFloat(currencyString.replace(/[$,]/g, '')) || 0;
}

/**
 * Debounce function for performance
 * @param {Function} func - The function to debounce
 * @param {number} wait - The wait time in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========================================
// Export Functions (if using modules)
// ========================================

// If this file is loaded as a module, export the functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Artwork functions
        hasArtwork,
        getFirstArtwork,
        getAllArtworks,
        createArtworkThumbnail,
        showArtworkModal,
        updateArtworkModalContent,
        navigateArtwork,
        setArtworkIndex,
        createArtworkModal,
        closeArtworkModal,
        downloadCurrentArtwork,
        downloadArtwork,
        
        // Date functions
        formatDate,
        formatDateForInput,
        addDays,
        
        // Status functions
        getStatusIcon,
        createStatusBadge,
        
        // Alert functions
        showAlert,
        showError,
        showSuccess,
        
        // Sales rep functions
        getSalesRepName,
        getSalesRepFirstName,
        getSalesRepEmail,
        
        // Service code functions
        parseServiceItemsFromNotes,
        inferServiceCodes,
        cleanProjectName,
        
        // DOM helper functions
        safeGetElementValue,
        safeGetCheckboxValue,
        safeSetElementValue,
        safeSetElementText,
        
        // Utility functions
        getOrderType,
        getRequestStatus,
        formatCurrency,
        parseCurrency,
        debounce
    };
}