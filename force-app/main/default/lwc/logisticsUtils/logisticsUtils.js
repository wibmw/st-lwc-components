/**
 * @description Shared utilities and constants for MNT Logistics components
 * @author Refactoring - Antigravity
 * @date 2026-01-20
 */

import FORM_FACTOR from '@salesforce/client/formFactor';

// ==================== STATUS DEFINITIONS ====================

/**
 * Status definitions indexed by key
 * Used for status management in Demande and Envoi components
 */
export const STATUS_DEFINITIONS_BY_KEY = {
    'Disponible': {
        key: 'Disponible',
        apiValue: 'Disponible',
        displayValue: '🟢 Disponible',
        label: '🟢Disponible'
    },
    'Non Disponible': {
        key: 'Non Disponible',
        apiValue: 'Non Disponible',
        displayValue: '🔴 Non Disponible',
        label: '🔴Non Disponible'
    }
};

/**
 * Status definitions indexed by API value
 * Used for reverse lookup when receiving data from Apex
 */
export const STATUS_DEFINITIONS_BY_APIVALUE = {
    'Disponible': STATUS_DEFINITIONS_BY_KEY['Disponible'],
    'Non Disponible': STATUS_DEFINITIONS_BY_KEY['Non Disponible']
};

// ==================== MOBILE DETECTION ====================

/**
 * @description Robust mobile detection combining multiple signals
 * @returns {Boolean} True if device is desktop, false if mobile
 */
export function isDesktopDevice() {
    // User Agent Detection
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
    const isSalesforceMobile = /SalesforceMobileSDK/i.test(userAgent);
    
    // Screen Size Detection
    const isSmallScreen = window.innerWidth < 700;

    // If any mobile indicator is true, return false (Mobile Mode)
    if (isMobileDevice || isSalesforceMobile || isSmallScreen) {
        return false;
    }

    // Fallback to Salesforce Form Factor
    return FORM_FACTOR === 'Large';
}

// ==================== ERROR HANDLING ====================

/**
 * @description Reduces one or more errors into an array of error messages
 * @param {Array|Object|String} errors - Error(s) from Apex or LWC
 * @returns {Array<String>} Array of error messages
 */
export function reduceErrors(errors) {
    if (!errors) {
        return [];
    }

    if (!Array.isArray(errors)) {
        errors = [errors];
    }

    return errors
        .filter(error => !!error)
        .map(error => {
            // LWC errors
            if (Array.isArray(error.body)) {
                return error.body.map(e => e.message);
            }
            // Apex errors
            else if (error.body && typeof error.body.message === 'string') {
                return error.body.message;
            }
            // UI errors
            else if (error.body && error.body.pageErrors && error.body.pageErrors.length > 0) {
                return error.body.pageErrors.map(e => e.message);
            }
            // Field errors
            else if (error.body && error.body.fieldErrors) {
                const fieldErrors = [];
                Object.values(error.body.fieldErrors).forEach(errorArray => {
                    fieldErrors.push(...errorArray.map(e => e.message));
                });
                return fieldErrors;
            }
            // Simple string error
            else if (typeof error.message === 'string') {
                return error.message;
            }
            // Unknown error
            return 'Unknown error';
        })
        .reduce((prev, curr) => prev.concat(curr), [])
        .filter((message, index, arr) => arr.indexOf(message) === index); // Remove duplicates
}

// ==================== DEBOUNCING ====================

/**
 * @description Debounce function for search inputs
 * @param {Function} func - Function to debounce
 * @param {Number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
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

// ==================== VALIDATION ====================

/**
 * @description Validates if a string is a valid Salesforce ID
 * @param {String} id - ID to validate
 * @returns {Boolean} True if valid Salesforce ID
 */
export function isValidSalesforceId(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }
    // 15 or 18 character Salesforce ID
    return /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(id);
}

/**
 * @description Normalizes a status string for comparison (removes accents, lowercase)
 * @param {String} status - Status string to normalize
 * @returns {String} Normalized status
 */
export function normalizeStatus(status) {
    if (!status) return '';
    return status
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

// ==================== FORMATTING ====================

/**
 * @description Formats a date for French locale display
 * @param {Date|String} dateValue - Date to format
 * @returns {String} Formatted date string
 */
export function formatDateFr(dateValue) {
    if (!dateValue) return '';
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(dateValue));
    } catch (e) {
        return dateValue;
    }
}
