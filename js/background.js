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
            
        case 'fetchOrderById':
            handleFetchOrderById(request, sender, sendResponse);
            return true; // Keep message channel open for async response
            
        case 'injectUSPSAutoFill':
            handleInjectUSPSAutoFill(request, sender, sendResponse);
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
    const { orderData } = request;
    
    console.log('🔍 Background: Opening USPS tab with order data:', orderData);
    
    // Store order data in chrome.storage.local with a unique key
    if (orderData) {
        const dataKey = `veeqoOrderData_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        chrome.storage.local.set({ [dataKey]: orderData }, () => {
            console.log('🔍 Background: Order data stored with key:', dataKey);
            
            // Create URL with the data key as parameter
            const uspsUrl = `https://cnsb.usps.com/label-manager/new-label/quick?veeqoKey=${dataKey}`;
            console.log('🔍 Background: USPS URL with data key:', uspsUrl);
            
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
        });
    } else {
        // No order data, open tab normally
        chrome.tabs.create({
            url: 'https://cnsb.usps.com/label-manager/new-label/quick',
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
        
        // If no Veeqo tab is open, provide helpful error message
        const tabs = await chrome.tabs.query({ url: '*://app.veeqo.com/*' });
        if (tabs.length === 0) {
            sendResponse({ 
                success: false, 
                error: 'Please open a Veeqo page (app.veeqo.com) in another tab to test the API connection. The extension needs to make API calls from the Veeqo domain to bypass CORS restrictions.' 
            });
            return;
        }
        
        // If we reach here, the API proxy should have worked
        // If it didn't, there might be an issue with the API proxy
        console.log('API proxy failed, but Veeqo tab exists. This might be a proxy communication issue.');
        sendResponse({ 
            success: false, 
            error: 'API proxy failed. Please ensure the Veeqo page is fully loaded and try again.' 
        });
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
        
        console.log('🔍 Background: handleFetchVeeqoOrders called');
        console.log('🔍 Background: API Key provided:', !!apiKey);
        console.log('🔍 Background: API Key length:', apiKey ? apiKey.length : 0);
        console.log('🔍 Background: Params:', params);
        
        if (!apiKey) {
            console.error('❌ Background: No API key provided');
            sendResponse({ 
                success: false, 
                error: 'No API key provided' 
            });
            return;
        }
        
        // Try to use API proxy first (if on Veeqo page)
        console.log('🔍 Background: Trying API proxy first...');
        const proxyResult = await tryApiProxy('fetchOrders', apiKey, params);
        if (proxyResult && proxyResult.success) {
            console.log('✅ Background: Fetch orders via proxy successful:', proxyResult);
            sendResponse(proxyResult);
            return;
        }
        
        // If no Veeqo tab is open, provide helpful error message
        const tabs = await chrome.tabs.query({ url: '*://app.veeqo.com/*' });
        if (tabs.length === 0) {
            sendResponse({ 
                success: false, 
                error: 'Please open a Veeqo page (app.veeqo.com) in another tab to fetch order data. The extension needs to make API calls from the Veeqo domain to bypass CORS restrictions.' 
            });
            return;
        }
        
        // If we reach here, the API proxy should have worked
        // If it didn't, there might be an issue with the API proxy
        console.log('🔍 Background: API proxy failed, but Veeqo tab exists. This might be a proxy communication issue.');
        sendResponse({ 
            success: false, 
            error: 'API proxy failed. Please ensure the Veeqo page is fully loaded and try again.' 
        });
    } catch (error) {
        console.error('❌ Background: Error in handleFetchVeeqoOrders:', error);
        console.error('❌ Background: Error stack:', error.stack);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

/**
 * Handle fetching individual order by ID
 */
async function handleFetchOrderById(request, sender, sendResponse) {
    try {
        const { apiKey, orderId } = request;
        console.log('Fetching order by ID:', orderId);
        
        if (!apiKey) {
            sendResponse({ success: false, error: 'No API key provided' });
            return;
        }
        
        if (!orderId) {
            sendResponse({ success: false, error: 'No order ID provided' });
            return;
        }
        
        // Try API proxy first
        const proxyResult = await tryApiProxy('fetchOrderById', apiKey, { orderId });
        if (proxyResult) {
            console.log('Order fetch via proxy:', proxyResult);
            sendResponse(proxyResult);
            return;
        }
        
        // If no Veeqo tab is open, provide helpful error message
        const tabs = await chrome.tabs.query({ url: '*://app.veeqo.com/*' });
        if (tabs.length === 0) {
            sendResponse({ 
                success: false, 
                error: 'Please open a Veeqo page (app.veeqo.com) in another tab to fetch order data. The extension needs to make API calls from the Veeqo domain to bypass CORS restrictions.' 
            });
            return;
        }
        
        // If we reach here, the API proxy should have worked
        // If it didn't, there might be an issue with the API proxy
        console.log('API proxy failed, but Veeqo tab exists. This might be a proxy communication issue.');
        sendResponse({ 
            success: false, 
            error: 'API proxy failed. Please ensure the Veeqo page is fully loaded and try again.' 
        });
        
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Handle injecting USPS auto-fill script
 */
async function handleInjectUSPSAutoFill(request, sender, sendResponse) {
    try {
        const { tabId, orderData } = request;
        console.log('Injecting USPS auto-fill script into tab:', tabId);
        
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }
        
        // Store order data in session storage for the USPS page
        if (orderData) {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (data) => {
                    sessionStorage.setItem('veeqoOrderData', JSON.stringify(data));
                    console.log('Order data stored in USPS page session storage:', data);
                },
                args: [orderData]
            });
        }
        
        // Inject the USPS auto-fill script
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['js/usps-autofill.js']
        });
        
        console.log('USPS auto-fill script injected successfully');
        sendResponse({ success: true, message: 'USPS auto-fill script injected' });
        
    } catch (error) {
        console.error('Error injecting USPS auto-fill script:', error);
        sendResponse({ success: false, error: error.message });
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
            console.log('🔍 Background: No Veeqo tabs found for API proxy');
            return null;
        }
        
        const tab = tabs[0];
        console.log('🔍 Background: Using API proxy on tab:', tab.id);
        
        // Send message to content script and wait for response
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'VEEQO_API_REQUEST',
            action: action,
            apiKey: apiKey,
            params: params
        });
        
        console.log('🔍 Background: API proxy response:', response);
        
        // Check if the response has the expected structure
        if (response && response.type === 'VEEQO_API_RESPONSE' && response.result) {
            console.log('🔍 Background: API proxy result:', response.result);
            return response.result;
        } else if (response && response.success !== undefined) {
            // Direct response format
            console.log('🔍 Background: Direct API proxy response:', response);
            return response;
        } else {
            console.log('🔍 Background: Unexpected API proxy response format:', response);
            return null;
        }
        
    } catch (error) {
        console.log('🔍 Background: API proxy error:', error);
        console.log('🔍 Background: API proxy error type:', error.name);
        console.log('🔍 Background: API proxy error message:', error.message);
        return null;
    }
}

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Veeqo USPS Extension started');
});
