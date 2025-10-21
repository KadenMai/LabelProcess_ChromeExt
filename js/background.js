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

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'openUSPSTab':
            handleOpenUSPSTab(request, sender, sendResponse);
            return true; // Keep message channel open for async response
            
        case 'testVeeqoApi':
            handleTestVeeqoApi(request, sender, sendResponse);
            return true; // Keep message channel open for async response
            
        case 'fetchVeeqoOrders':
            handleFetchVeeqoOrders(request, sender, sendResponse);
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

/**
 * Handle testing Veeqo API connection
 */
async function handleTestVeeqoApi(request, sender, sendResponse) {
    try {
        const { apiKey } = request;
        
        console.log('Testing Veeqo API with key:', apiKey ? apiKey.substring(0, 10) + '...' : 'none');
        
        if (!apiKey) {
            sendResponse({ 
                success: false, 
                error: 'No API key provided' 
            });
            return;
        }
        
        // Try to use API proxy first (if on Veeqo page)
        const proxyResult = await tryApiProxy('testApi', apiKey);
        if (proxyResult) {
            console.log('API test via proxy:', proxyResult);
            sendResponse(proxyResult);
            return;
        }
        
        // Fallback to direct API call
        const url = 'https://api.veeqo.com/orders?page_size=1';
        console.log('Making direct request to:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const data = await response.json();
            console.log('API test successful, got data:', data);
            sendResponse({ 
                success: true, 
                message: 'API connection successful' 
            });
        } else if (response.status === 401) {
            console.log('API test failed: 401 Unauthorized');
            sendResponse({ 
                success: false, 
                error: 'Invalid API key' 
            });
        } else if (response.status === 403) {
            console.log('API test failed: 403 Forbidden');
            sendResponse({ 
                success: false, 
                error: 'API key does not have required permissions' 
            });
        } else {
            const errorText = await response.text();
            console.log('API test failed:', response.status, errorText);
            sendResponse({ 
                success: false, 
                error: `API request failed with status: ${response.status} - ${errorText}` 
            });
        }
    } catch (error) {
        console.error('Error testing Veeqo API:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

/**
 * Handle fetching Veeqo orders
 */
async function handleFetchVeeqoOrders(request, sender, sendResponse) {
    try {
        const { apiKey, params = {} } = request;
        
        if (!apiKey) {
            sendResponse({ 
                success: false, 
                error: 'No API key provided' 
            });
            return;
        }
        
        // Try to use API proxy first (if on Veeqo page)
        const proxyResult = await tryApiProxy('fetchOrders', apiKey, params);
        if (proxyResult) {
            console.log('Fetch orders via proxy:', proxyResult);
            sendResponse(proxyResult);
            return;
        }
        
        // Fallback to direct API call
        const defaultParams = {
            page_size: 100,
            status: 'awaiting_fulfillment'
        };
        
        const queryParams = new URLSearchParams({
            ...defaultParams,
            ...params
        });
        
        const response = await fetch(`https://api.veeqo.com/orders?${queryParams}`, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            sendResponse({ 
                success: true, 
                data: data 
            });
        } else {
            sendResponse({ 
                success: false, 
                error: `API request failed with status: ${response.status}` 
            });
        }
    } catch (error) {
        console.error('Error fetching Veeqo orders:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

/**
 * Try to use API proxy (content script on Veeqo page)
 */
async function tryApiProxy(action, apiKey, params = {}) {
    try {
        // Find Veeqo tab
        const tabs = await chrome.tabs.query({ url: '*://app.veeqo.com/*' });
        if (tabs.length === 0) {
            console.log('No Veeqo tabs found for API proxy');
            return null;
        }
        
        const tab = tabs[0];
        console.log('Using API proxy on tab:', tab.id);
        
        // Send message to content script and wait for response
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'VEEQO_API_REQUEST',
            action: action,
            apiKey: apiKey,
            params: params
        });
        
        console.log('API proxy response:', response);
        return response?.result || null;
        
    } catch (error) {
        console.log('API proxy error:', error);
        return null;
    }
}

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Veeqo USPS Extension started');
});
