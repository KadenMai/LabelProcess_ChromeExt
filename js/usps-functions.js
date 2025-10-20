/**
 * USPS Functions for Veeqo Chrome Extension
 * Handles USPS label manager functionality
 */

// USPS Label Manager URL
const USPS_LABEL_MANAGER_URL = 'https://cnsb.usps.com/label-manager/new-label/quick';

/**
 * Opens USPS Label Manager in a new tab
 * This function is called when the USPS button is clicked
 */
function goToUSPS() {
    try {
        // Send message to background script to open USPS tab
        chrome.runtime.sendMessage({
            action: 'openUSPSTab',
            url: USPS_LABEL_MANAGER_URL
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error communicating with background script:', chrome.runtime.lastError);
                // Fallback: try to open in current window
                window.open(USPS_LABEL_MANAGER_URL, '_blank');
            } else if (response && response.success) {
                console.log('USPS Label Manager opened in tab:', response.tabId);
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
 * Creates a USPS button element
 * @returns {HTMLButtonElement} The created button element
 */
function createUSPSButton() {
    const button = document.createElement('button');
    button.textContent = 'USPS';
    button.className = 'usps-label-button';
    button.type = 'button';
    button.title = 'Open USPS Label Manager';
    
    // Add click event listener
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        goToUSPS();
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
        isVeeqoAllocationsPage
    };
}
