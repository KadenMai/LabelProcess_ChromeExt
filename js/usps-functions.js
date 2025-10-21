/**
 * USPS Functions for Veeqo Chrome Extension
 * Handles USPS label manager functionality
 */

// USPS Label Manager URL
const USPS_LABEL_MANAGER_URL = 'https://cnsb.usps.com/label-manager/new-label/quick';

/**
 * Check if Chrome extension context is valid
 * @returns {boolean} True if context is valid
 */
function isExtensionContextValid() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        return false;
    }
}

/**
 * Opens USPS Label Manager in a new tab
 * This function is called when the USPS button is clicked
 * @param {Object} orderData - Optional order data for enhanced functionality
 */
function goToUSPS(orderData = null) {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.warn('Extension context invalidated, opening USPS page without auto-fill');
            // Store order data in session storage as fallback
            if (orderData) {
                sessionStorage.setItem('veeqoOrderData', JSON.stringify(orderData));
            }
            window.open(USPS_LABEL_MANAGER_URL, '_blank');
            return;
        }
        
        // Store order data in session storage for the USPS page to access
        if (orderData) {
            sessionStorage.setItem('veeqoOrderData', JSON.stringify(orderData));
            console.log('Order data stored for USPS auto-fill:', orderData);
        }
        
        // Send message to background script to open USPS tab
        chrome.runtime.sendMessage({
            action: 'openUSPSTab',
            url: USPS_LABEL_MANAGER_URL,
            orderData: orderData
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error communicating with background script:', chrome.runtime.lastError);
                // Fallback: try to open in current window
                window.open(USPS_LABEL_MANAGER_URL, '_blank');
            } else if (response && response.success) {
                console.log('USPS Label Manager opened in tab:', response.tabId);
                
                // If we have order data, inject auto-fill script into the new tab
                if (orderData && response.tabId) {
                    // Wait longer for the USPS page to fully load
                    setTimeout(() => {
                        injectUSPSAutoFillScript(response.tabId, orderData);
                    }, 5000); // Wait 5 seconds for page to load
                }
            } else {
                console.error('Failed to open USPS tab:', response?.error);
                // Fallback: try to open in current window
                window.open(USPS_LABEL_MANAGER_URL, '_blank');
            }
        });
    } catch (error) {
        console.error('Error in goToUSPS function:', error);
        // Fallback: try to open in current window
        window.open(USPS_LABEL_MANAGER_URL, '_blank');
    }
}

/**
 * Inject USPS auto-fill script into the USPS tab
 * @param {number} tabId - The tab ID of the USPS page
 * @param {Object} orderData - Order data to auto-fill
 */
function injectUSPSAutoFillScript(tabId, orderData) {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.warn('Extension context invalidated, cannot inject auto-fill script');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'injectUSPSAutoFill',
            tabId: tabId,
            orderData: orderData
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error injecting USPS auto-fill script:', chrome.runtime.lastError);
            } else if (response && response.success) {
                console.log('USPS auto-fill script injected successfully');
            } else {
                console.error('Failed to inject USPS auto-fill script:', response?.error);
            }
        });
    } catch (error) {
        console.error('Error in injectUSPSAutoFillScript:', error);
    }
}

/**
 * Creates a USPS button element
 * @param {Object} orderData - Optional order data to enhance button functionality
 * @returns {HTMLButtonElement} The created button element
 */
function createUSPSButton(orderData = null) {
    const button = document.createElement('button');
    button.textContent = 'USPS';
    button.className = 'usps-label-button';
    button.type = 'button';
    button.title = orderData ? `Open USPS Label Manager for Order ${orderData.reference_number}` : 'Open USPS Label Manager';
    
    // Store order data as a data attribute for potential future use
    if (orderData) {
        button.setAttribute('data-order-id', orderData.id);
        button.setAttribute('data-order-number', orderData.reference_number);
    }
    
    // Add click event listener
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        goToUSPS(orderData);
    });
    
    return button;
}

/**
 * Utility function to check if we're on the correct Veeqo page
 * @returns {boolean} True if on the correct page
 */
function isVeeqoAllocationsPage() {
    return window.location.hostname === 'app.veeqo.com' && 
           window.location.pathname.includes('/orders') &&
           document.getElementById('allocations-table') !== null;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        goToUSPS,
        createUSPSButton,
        isVeeqoAllocationsPage,
        injectUSPSAutoFillScript
    };
}
