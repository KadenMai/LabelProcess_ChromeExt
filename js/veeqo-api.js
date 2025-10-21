/**
 * Veeqo API Functions
 * Handles communication with Veeqo API to fetch order data
 */

// Veeqo API base URL
const VEEQO_API_BASE = 'https://api.veeqo.com';

/**
 * Get stored API key from Chrome storage
 * @returns {Promise<string|null>} The API key or null if not found
 */
async function getApiKey() {
    try {
        const result = await chrome.storage.sync.get(['veeqoApiKey']);
        return result.veeqoApiKey || null;
    } catch (error) {
        console.error('Error getting API key:', error);
        return null;
    }
}

/**
 * Make authenticated request to Veeqo API using background script
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @returns {Promise<Object>} API response
 */
async function makeVeeqoApiRequest(endpoint, options = {}) {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
        throw new Error('Veeqo API key not configured. Please set it in extension settings.');
    }
    
    try {
        // Use background script to make the API request
        const response = await chrome.runtime.sendMessage({
            action: 'fetchVeeqoOrders',
            apiKey: apiKey,
            params: options.params || {}
        });
        
        if (response && response.success) {
            return response.data;
        } else {
            throw new Error(response?.error || 'API request failed');
        }
    } catch (error) {
        console.error('Veeqo API request failed:', error);
        throw error;
    }
}

/**
 * Fetch orders from Veeqo API
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Orders data
 */
async function fetchOrders(params = {}) {
    const defaultParams = {
        page_size: 100,
        status: 'awaiting_fulfillment'
    };
    
    const queryParams = new URLSearchParams({
        ...defaultParams,
        ...params
    });
    
    return await makeVeeqoApiRequest(`/orders?${queryParams}`);
}

/**
 * Fetch specific order by ID
 * @param {number} orderId - Order ID
 * @returns {Promise<Object>} Order data
 */
async function fetchOrderById(orderId) {
    return await makeVeeqoApiRequest(`/orders/${orderId}`);
}

/**
 * Fetch order allocations
 * @param {number} orderId - Order ID
 * @returns {Promise<Object>} Allocations data
 */
async function fetchOrderAllocations(orderId) {
    return await makeVeeqoApiRequest(`/orders/${orderId}/allocations`);
}

/**
 * Get order details for the current page
 * This function tries to match orders with the current allocations table
 * @returns {Promise<Array>} Array of order details
 */
async function getCurrentPageOrderDetails() {
    try {
        // Get all orders with awaiting_fulfillment status
        const ordersResponse = await fetchOrders({
            page_size: 100,
            status: 'awaiting_fulfillment'
        });
        
        if (!ordersResponse.orders || !Array.isArray(ordersResponse.orders)) {
            console.log('No orders found in API response');
            return [];
        }
        
        console.log(`Found ${ordersResponse.orders.length} orders from API`);
        
        // Try to match orders with current page data
        const currentPageOrders = [];
        
        // Get order numbers from the current page
        const orderNumbers = getOrderNumbersFromPage();
        
        ordersResponse.orders.forEach(order => {
            if (orderNumbers.includes(order.reference_number)) {
                currentPageOrders.push({
                    id: order.id,
                    reference_number: order.reference_number,
                    customer: order.customer,
                    line_items: order.line_items,
                    delivery_method: order.delivery_method,
                    created_at: order.created_at,
                    updated_at: order.updated_at
                });
            }
        });
        
        console.log(`Matched ${currentPageOrders.length} orders with current page`);
        return currentPageOrders;
        
    } catch (error) {
        console.error('Error fetching order details:', error);
        return [];
    }
}

/**
 * Extract order numbers from the current page
 * @returns {Array<string>} Array of order numbers
 */
function getOrderNumbersFromPage() {
    const orderNumbers = [];
    
    // Look for order numbers in the allocations table
    const table = document.getElementById('allocations-table');
    if (table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // Try to find order number in various columns
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                const text = cell.textContent.trim();
                // Look for patterns like #12345 or order numbers
                if (text.match(/^#?\d+$/) && text.length > 3) {
                    const orderNumber = text.replace('#', '');
                    if (!orderNumbers.includes(orderNumber)) {
                        orderNumbers.push(orderNumber);
                    }
                }
            });
        });
    }
    
    return orderNumbers;
}

/**
 * Test API connection
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testApiConnection() {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            return false;
        }
        
        const response = await chrome.runtime.sendMessage({
            action: 'testVeeqoApi',
            apiKey: apiKey
        });
        
        return response && response.success;
    } catch (error) {
        console.error('API connection test failed:', error);
        return false;
    }
}

/**
 * Get API key status
 * @returns {Promise<Object>} API key status information
 */
async function getApiKeyStatus() {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
        return {
            hasKey: false,
            isValid: false,
            message: 'No API key configured'
        };
    }
    
    try {
        const isValid = await testApiConnection();
        return {
            hasKey: true,
            isValid: isValid,
            message: isValid ? 'API key is valid' : 'API key is invalid'
        };
    } catch (error) {
        return {
            hasKey: true,
            isValid: false,
            message: 'API connection failed: ' + error.message
        };
    }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getApiKey,
        makeVeeqoApiRequest,
        fetchOrders,
        fetchOrderById,
        fetchOrderAllocations,
        getCurrentPageOrderDetails,
        testApiConnection,
        getApiKeyStatus
    };
}
