/**
 * Background Script for Veeqo USPS Extension
 * Handles tab management and extension lifecycle
 */

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Veeqo USPS Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        // First time installation
        console.log('First time installation - setting up extension');
    } else if (details.reason === 'update') {
        // Extension updated
        console.log('Extension updated to version:', chrome.runtime.getManifest().version);
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'openUSPSTab':
            handleOpenUSPSTab(request, sender, sendResponse);
            return true; // Keep message channel open for async response
            
        case 'logMessage':
            console.log('Content script log:', request.message);
            break;
            
        default:
            console.log('Unknown message action:', request.action);
    }
});

/**
 * Handle opening USPS tab
 */
function handleOpenUSPSTab(request, sender, sendResponse) {
    const uspsUrl = 'https://cnsb.usps.com/label-manager/new-label/quick';
    
    chrome.tabs.create({
        url: uspsUrl,
        active: true
    }, (tab) => {
        if (chrome.runtime.lastError) {
            console.error('Error opening USPS tab:', chrome.runtime.lastError);
            sendResponse({ 
                success: false, 
                error: chrome.runtime.lastError.message 
            });
        } else {
            console.log('USPS tab opened successfully:', tab.id);
            sendResponse({ 
                success: true, 
                tabId: tab.id 
            });
        }
    });
}

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Veeqo USPS Extension started');
});
