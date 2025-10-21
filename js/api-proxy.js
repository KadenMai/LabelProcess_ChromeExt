/**
 * API Proxy for Veeqo API
 * This script runs in the content script context on Veeqo pages
 * to bypass CORS restrictions by making API calls from the same domain
 */

// Check if we're on a Veeqo page
if (window.location.hostname === 'app.veeqo.com') {
    console.log('Veeqo API Proxy: Running on Veeqo domain');
    
    // Listen for API requests from the extension
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'VEEQO_API_REQUEST') {
            const { requestId, action, apiKey, params } = event.data;
            
            try {
                let result;
                
                switch (action) {
                    case 'testApi':
                        result = await testVeeqoApi(apiKey);
                        break;
                    case 'fetchOrders':
                        result = await fetchVeeqoOrders(apiKey, params);
                        break;
                    case 'fetchOrderById':
                        result = await fetchOrderById(apiKey, params.orderId);
                        break;
                    default:
                        result = { success: false, error: 'Unknown action' };
                }
                
                // Send result back
                window.postMessage({
                    type: 'VEEQO_API_RESPONSE',
                    requestId: requestId,
                    result: result
                }, '*');
                
            } catch (error) {
                window.postMessage({
                    type: 'VEEQO_API_RESPONSE',
                    requestId: requestId,
                    result: { success: false, error: error.message }
                }, '*');
            }
        }
    });
    
    // Also listen for chrome runtime messages (from background script)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'VEEQO_API_REQUEST') {
            const { requestId, action, apiKey, params } = message;
            
            (async () => {
                try {
                    let result;
                    
                    switch (action) {
                        case 'testApi':
                            result = await testVeeqoApi(apiKey);
                            break;
                        case 'fetchOrders':
                            result = await fetchVeeqoOrders(apiKey, params);
                            break;
                        default:
                            result = { success: false, error: 'Unknown action' };
                    }
                    
                    sendResponse({
                        type: 'VEEQO_API_RESPONSE',
                        requestId: requestId,
                        result: result
                    });
                    
                } catch (error) {
                    sendResponse({
                        type: 'VEEQO_API_RESPONSE',
                        requestId: requestId,
                        result: { success: false, error: error.message }
                    });
                }
            })();
            
            return true; // Keep message channel open for async response
        }
    });
    
    // Test Veeqo API
    async function testVeeqoApi(apiKey) {
        try {
            console.log('API Proxy: Testing Veeqo API with key:', apiKey ? apiKey.substring(0, 10) + '...' : 'none');
            
            const response = await fetch('https://api.veeqo.com/orders?page_size=1', {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('API Proxy: Response status:', response.status);
            console.log('API Proxy: Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
                const data = await response.json();
                console.log('API Proxy: Success, got data:', data);
                return { success: true, data: data };
            } else {
                const errorText = await response.text();
                console.log('API Proxy: Error response:', errorText);
                return { 
                    success: false, 
                    error: `API request failed with status: ${response.status} - ${errorText}` 
                };
            }
        } catch (error) {
            console.log('API Proxy: Exception:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Fetch Veeqo orders
    async function fetchVeeqoOrders(apiKey, params = {}) {
        try {
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
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                return { 
                    success: false, 
                    error: `API request failed with status: ${response.status}` 
                };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async function fetchOrderById(apiKey, orderId) {
        try {
            if (!orderId) {
                return { success: false, error: 'No order ID provided' };
            }
            
            const response = await fetch(`https://api.veeqo.com/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                const errorText = await response.text();
                return { success: false, error: `Order fetch failed with status: ${response.status} - ${errorText}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    console.log('Veeqo API Proxy: Ready to handle API requests');
}
