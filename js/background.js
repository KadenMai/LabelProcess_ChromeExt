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
            
        case 'updateVeeqoOrder':
            handleUpdateVeeqoOrder(request, sender, sendResponse);
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
        
        // Use direct API call (same as Fill Order Data)
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
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        
        // Check if it's a CORS error
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            sendResponse({
                success: false,
                error: 'CORS error: Failed to fetch. Please ensure you are on a Veeqo page for the API proxy to work.'
            });
        } else {
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
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
        
        console.log('🔍 Background: API proxy failed or returned error:', proxyResult);
        console.log('🔍 Background: Trying direct API call...');
        
        // Fallback to direct API call
        const defaultParams = {
            page_size: 100,
            status: 'awaiting_fulfillment'
        };
        
        const queryParams = new URLSearchParams({
            ...defaultParams,
            ...params
        });
        
        const apiUrl = `https://api.veeqo.com/orders?${queryParams}`;
        console.log('🔍 Background: API URL:', apiUrl);
        console.log('🔍 Background: Query params:', queryParams.toString());
        
        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            console.log('🔍 Background: Response status:', response.status);
            console.log('🔍 Background: Response ok:', response.ok);
            console.log('🔍 Background: Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Background: API response successful');
                console.log('🔍 Background: Response data type:', typeof data);
                console.log('🔍 Background: Response data:', data);
                console.log('🔍 Background: Response data keys:', Object.keys(data || {}));
                console.log('🔍 Background: Orders array:', data.orders);
                console.log('🔍 Background: Orders count:', data.orders ? data.orders.length : 0);
                
                // Log the exact structure to help debug
                if (Array.isArray(data)) {
                    console.log('✅ Background: Data is direct array (Veeqo API format)');
                } else if (data.orders) {
                    console.log('✅ Background: Found orders in data.orders');
                } else if (data.results) {
                    console.log('✅ Background: Found orders in data.results');
                } else {
                    console.log('❌ Background: No orders found in expected locations');
                    console.log('🔍 Background: Available keys:', Object.keys(data || {}));
                }
                
                sendResponse({ 
                    success: true, 
                    data: data 
                });
            } else {
                const errorText = await response.text();
                console.error('❌ Background: API request failed');
                console.error('❌ Background: Status:', response.status);
                console.error('❌ Background: Error text:', errorText);

                sendResponse({
                    success: false,
                    error: `API request failed with status: ${response.status} - ${errorText}`
                });
            }
        } catch (fetchError) {
            console.error('❌ Background: Fetch error:', fetchError);
            console.error('❌ Background: Fetch error type:', fetchError.name);
            console.error('❌ Background: Fetch error message:', fetchError.message);
            
            // Check if it's a CORS error
            if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
                sendResponse({
                    success: false,
                    error: 'CORS error: Failed to fetch. Please ensure you are on a Veeqo page for the API proxy to work.'
                });
            } else {
                sendResponse({
                    success: false,
                    error: `Network error: ${fetchError.message}`
                });
            }
        }
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
        
        // Fallback to direct API call
        const url = `https://api.veeqo.com/orders/${orderId}`;
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
        
        if (response.ok) {
            const data = await response.json();
            console.log('Order fetch successful:', data);
            sendResponse({ success: true, data: data });
        } else {
            const errorText = await response.text();
            sendResponse({ 
                success: false, 
                error: `Order fetch failed with status: ${response.status} - ${errorText}` 
            });
        }
        
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Handle updating Veeqo order
 */
async function handleUpdateVeeqoOrder(request, sender, sendResponse) {
    try {
        const { apiKey, orderId, customerNote } = request;
        console.log('Updating Veeqo order:', orderId, 'with customer note:', customerNote);
        
        if (!apiKey) {
            sendResponse({ success: false, error: 'API key is required' });
            return;
        }
        
        if (!orderId) {
            sendResponse({ success: false, error: 'Order ID is required' });
            return;
        }
        
        if (!customerNote) {
            sendResponse({ success: false, error: 'Customer note is required' });
            return;
        }
        
        // Try API proxy first
        const proxyResult = await tryApiProxy('updateVeeqoOrder', apiKey, { 
            orderId, 
            customerNote 
        });
        
        if (proxyResult && proxyResult.success) {
            console.log('Order updated successfully via API proxy');
            sendResponse(proxyResult);
            return;
        }
        
        console.log('API proxy failed or returned error:', proxyResult);
        console.log('Trying direct API call...');
        
        // Fallback to direct API call
        const response = await fetch(`https://api.veeqo.com/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order: {
                    customer_note_attributes: {
                        text: customerNote
                    }
                }
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Order updated successfully via direct API call');
            sendResponse({ success: true, data: data });
        } else {
            const errorText = await response.text();
            console.error('Failed to update order:', response.status, errorText);
            sendResponse({ 
                success: false, 
                error: `API request failed: ${response.status} ${errorText}` 
            });
        }
        
    } catch (error) {
        console.error('Error updating Veeqo order:', error);
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
        
        if (response && response.result) {
            return response.result;
        } else {
            console.log('🔍 Background: API proxy returned no result or error:', response);
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
