/**
 * Content Script for Veeqo USPS Extension
 * Injects USPS button into the allocations table
 */

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
 * Get stored API key from Chrome storage
 * @returns {Promise<string|null>} The API key or null if not found
 */
async function getApiKey() {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.warn('Extension context invalidated, cannot access storage');
            return null;
        }
        
        const result = await chrome.storage.sync.get(['veeqoApiKey']);
        return result.veeqoApiKey || null;
    } catch (error) {
        console.error('Error getting API key:', error);
        return null;
    }
}

/**
 * Show a simple notification if the main notification system isn't available
 * @param {string} message - Message to display
 */
function showSimpleNotification(message) {
    // Remove any existing simple notifications
    const existingNotification = document.getElementById('simple-extension-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'simple-extension-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: #fff;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
        border: 2px solid #1e7e34;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 18px;">✅</span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; margin-left: 10px;">
                ×
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

/**
 * Create emergency notification when all other systems fail
 */
function createEmergencyNotification() {
    console.log('Creating emergency notification...');
    
    // Remove any existing emergency notifications
    const existingNotification = document.getElementById('emergency-extension-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'emergency-extension-notification';
    notification.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: #ffc107 !important;
        color: #000 !important;
        padding: 15px 20px !important;
        border-radius: 8px !important;
        z-index: 999999 !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        max-width: 400px !important;
        border: 2px solid #e0a800 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px;">⚠️</span>
            <span>Extension context invalidated. Please reload the page to restore full functionality.</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; margin-left: 10px;">
                ×
            </button>
        </div>
    `;
    
    // Try multiple methods to ensure the notification appears
    try {
        document.body.appendChild(notification);
        console.log('Emergency notification added to body');
    } catch (error) {
        console.error('Failed to add to body, trying document.documentElement:', error);
        try {
            document.documentElement.appendChild(notification);
            console.log('Emergency notification added to documentElement');
        } catch (error2) {
            console.error('Failed to add to documentElement:', error2);
        }
    }
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
            console.log('Emergency notification auto-removed');
        }
    }, 15000);
}

// Wait for DOM to be ready
function waitForDOM() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

// Wait for the allocations table to be present
function waitForAllocationsTable() {
    return new Promise((resolve) => {
        const checkTable = () => {
            const table = document.getElementById('allocations-table');
            if (table) {
                resolve(table);
            } else {
                setTimeout(checkTable, 100);
            }
        };
        checkTable();
    });
}

// Add USPS button to the 3rd column of each row in tbody
async function addUSPSButtonsToTable(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.log('No tbody found in allocations table');
        return;
    }

    const rows = tbody.querySelectorAll('tr');
    console.log(`Found ${rows.length} rows in allocations table`);

    let buttonsAdded = 0;
    let buttonsSkipped = 0;

    rows.forEach((row, index) => {
        // Get the 3rd column (index 2)
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
            const thirdCell = cells[2];
            
            // Check if USPS button already exists in this cell
            if (!thirdCell.querySelector('.usps-label-button')) {
                // Create a container for the button if needed
                let buttonContainer = thirdCell.querySelector('.usps-button-container');
                if (!buttonContainer) {
                    buttonContainer = document.createElement('div');
                    buttonContainer.className = 'usps-button-container';
                    buttonContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin: 5px 0;';
                    
                    // Add the button container to the cell
                    thirdCell.appendChild(buttonContainer);
                }
                
                // Extract order number from the row
                const orderNumber = extractOrderNumberFromRow(row);
                
                // Create and add the USPS button with order number as ID
                const uspsButton = createUSPSButtonWithOrderNumber(orderNumber);
                buttonContainer.appendChild(uspsButton);
                
                buttonsAdded++;
                console.log(`Added USPS button to row ${index + 1} with order number: ${orderNumber}`);
            } else {
                buttonsSkipped++;
            }
        }
    });
    
    console.log(`USPS buttons: ${buttonsAdded} added, ${buttonsSkipped} already existed`);
}

/**
 * Extract order number from a table row (Column 4 - Order column)
 * @param {HTMLElement} row - The table row element
 * @returns {string|null} The order number or null if not found
 */
function extractOrderNumberFromRow(row) {
    try {
        // Get all cells in the row
        const cells = row.querySelectorAll('td');
        
        // Check if we have at least 4 columns (Column 4 is index 3)
        if (cells.length >= 4) {
            const orderCell = cells[3]; // Column 4 (0-indexed)
            
            // Look for the order number in the span element
            // Path: /html/body/div[1]/div/div[1]/div[2]/div/div[2]/div/div[2]/div[2]/table/tbody/tr[1]/td[4]/div/div/div[2]/div/div/button/span
            const spanElement = orderCell.querySelector('span');
            if (spanElement) {
                const orderText = spanElement.textContent?.trim();
                if (orderText) {
                    console.log(`Found order text in span: "${orderText}"`);
                    return orderText;
                }
            }
            
            // Fallback: look for any text in the order cell
            const cellText = orderCell.textContent?.trim();
            if (cellText) {
                console.log(`Found order text in cell: "${cellText}"`);
                return cellText;
            }
        }
        
        console.log('No order number found in column 4');
        return null;
    } catch (error) {
        console.error('Error extracting order number from row:', error);
        return null;
    }
}

/**
 * Extract Veeqo Shipping Rate from a table row (Column 7)
 * @param {HTMLElement} row - The table row element
 * @returns {string|null} The shipping rate or null if not found
 */
function extractVeeqoShippingRateFromRow(row) {
    try {
        const cells = row.querySelectorAll('td');
        
        // Check if we have at least 7 columns (Column 7 is index 6)
        if (cells.length >= 7) {
            const shippingCell = cells[6]; // Column 7 (0-indexed)
            
            // Look for the shipping rate in the span element
            // Path: /html/body/div[1]/div/div[1]/div[2]/div/div[2]/div/div[2]/div[2]/table/tbody/tr[1]/td[7]/div/button/div[1]/div/div[2]/span
            const spanElement = shippingCell.querySelector('div button div:nth-child(1) div div:nth-child(2) span');
            if (spanElement) {
                const shippingRate = spanElement.textContent?.trim();
                if (shippingRate) {
                    console.log(`Found shipping rate: "${shippingRate}"`);
                    return shippingRate;
                }
            }
            
            // Fallback: try alternative selectors
            const fallbackSpan = shippingCell.querySelector('div button div div div span');
            if (fallbackSpan) {
                const shippingRate = fallbackSpan.textContent?.trim();
                if (shippingRate) {
                    console.log(`Found shipping rate (fallback): "${shippingRate}"`);
                    return shippingRate;
                }
            }
            
            // Final fallback: look for any text in the shipping cell
            const cellText = shippingCell.textContent?.trim();
            if (cellText) {
                console.log(`Found shipping rate in cell: "${cellText}"`);
                return cellText;
            }
        }
        
        console.log('No shipping rate found in column 7');
        return null;
    } catch (error) {
        console.error('Error extracting shipping rate from row:', error);
        return null;
    }
}

/**
 * Extract QuantityToShip from a table row (Column 11)
 * @param {HTMLElement} row - The table row element
 * @returns {string|null} The quantity to ship or null if not found
 */
function extractQuantityToShipFromRow(row) {
    try {
        const cells = row.querySelectorAll('td');
        
        // Check if we have at least 11 columns (Column 11 is index 10)
        if (cells.length >= 11) {
            const quantityCell = cells[10]; // Column 11 (0-indexed)
            
            // Look for the quantity in the specific path
            // Path: /html/body/div[1]/div/div[1]/div[2]/div/div[2]/div/div[2]/div[2]/table/tbody/tr[1]/td[11]/div/button/ul/li/div/div/div/div[2]
            const quantityElement = quantityCell.querySelector('div button ul li div div div div:nth-child(2)');
            if (quantityElement) {
                const quantity = quantityElement.textContent?.trim();
                if (quantity) {
                    console.log(`Found quantity to ship: "${quantity}"`);
                    return quantity;
                }
            }
            
            // Fallback: look for any text in the quantity cell
            const cellText = quantityCell.textContent?.trim();
            if (cellText) {
                console.log(`Found quantity in cell: "${cellText}"`);
                return cellText;
            }
        }
        
        console.log('No quantity to ship found in column 11');
        return null;
    } catch (error) {
        console.error('Error extracting quantity to ship from row:', error);
        return null;
    }
}

/**
 * Create USPS button with order number as ID
 * @param {string} orderNumber - The order number to use as button ID
 * @returns {HTMLElement} The USPS button element
 */
function createUSPSButtonWithOrderNumber(orderNumber) {
    const button = document.createElement('button');
    button.className = 'usps-label-button usps-button-hidden';
    button.textContent = 'USPS';
    button.id = orderNumber || 'unknown-order';
    button.title = orderNumber ? `Order: ${orderNumber}` : 'Order number not found';
    
    // Initially hide the button until data is loaded
    button.style.display = 'none';
    
    // Add click event listener
    button.addEventListener('click', function() {
        console.log(`USPS button clicked for order: ${orderNumber}`);
        goToUSPSWithOrderNumber(orderNumber);
    });
    
    return button;
}

/**
 * Go to USPS with order number (will fetch order data if available)
 * @param {string} orderNumber - The order number
 */
function goToUSPSWithOrderNumber(orderNumber) {
    console.log('🔍 goToUSPSWithOrderNumber - Called with order number:', orderNumber);
    
    // Check if we have stored order data for this order number
    const storedOrderData = getStoredOrderData(orderNumber);
    
    if (storedOrderData) {
        console.log(`✅ Using stored order data for ${orderNumber}:`, storedOrderData);
        goToUSPS(storedOrderData);
    } else {
        console.log(`❌ No stored order data for ${orderNumber}, opening USPS without auto-fill`);
        console.log('🔍 Make sure you have clicked "Fill Order Data" button first!');
        goToUSPS(null);
    }
}

/**
 * Get stored order data for a specific order number
 * @param {string} orderNumber - The order number
 * @returns {Object|null} The stored order data or null if not found
 */
function getStoredOrderData(orderNumber) {
    try {
        const storedData = localStorage.getItem('veeqoOrderData');
        console.log('🔍 getStoredOrderData - Looking for order:', orderNumber);
        console.log('🔍 getStoredOrderData - Raw stored data:', storedData);
        
        if (storedData) {
            const allOrderData = JSON.parse(storedData);
            console.log('🔍 getStoredOrderData - Parsed order data:', allOrderData);
            console.log('🔍 getStoredOrderData - Available order numbers:', Object.keys(allOrderData));
            console.log('🔍 getStoredOrderData - Looking for key:', orderNumber);
            
            const result = allOrderData[orderNumber] || null;
            console.log('🔍 getStoredOrderData - Result:', result);
            return result;
        } else {
            console.log('🔍 getStoredOrderData - No stored data found');
        }
    } catch (error) {
        console.error('Error retrieving stored order data:', error);
    }
    return null;
}

/**
 * Show all USPS buttons after order data is loaded
 */
function showAllUSPSButtons() {
    console.log('🔍 Showing all USPS buttons...');
    
    const uspsButtons = document.querySelectorAll('.usps-label-button');
    let buttonsShown = 0;
    
    uspsButtons.forEach(button => {
        if (button.style.display === 'none') {
            button.style.display = 'inline-block';
            button.classList.remove('usps-button-hidden');
            buttonsShown++;
        }
    });
    
    console.log(`✅ Made ${buttonsShown} USPS buttons visible`);
    
    // Show a notification to the user
    if (buttonsShown > 0) {
        showSimpleNotification(`✅ ${buttonsShown} USPS buttons are now ready! Click any USPS button to auto-fill shipping labels.`);
    }
}


/**
 * Add "Fill Order Data" button near the bulk actions button
 */
function addFillOrderDataButton() {
    try {
        // Look for the bulk actions button
        const bulkActionsButton = document.getElementById('bulk-actions-cta');
        
        if (!bulkActionsButton) {
            console.log('Bulk actions button not found, trying alternative selectors...');
            // Try alternative selectors
            const alternativeSelectors = [
                '[data-testid="bulk-actions-cta"]',
                '.bulk-actions-cta',
                'button[aria-label*="bulk"]',
                'button[aria-label*="action"]'
            ];
            
            for (const selector of alternativeSelectors) {
                const button = document.querySelector(selector);
                if (button) {
                    console.log(`Found bulk actions button with selector: ${selector}`);
                    addButtonNearElement(button);
                    return;
                }
            }
            
            console.log('Could not find bulk actions button, skipping Fill Order Data button');
            return;
        }
        
        addButtonNearElement(bulkActionsButton);
        
    } catch (error) {
        console.error('Error adding Fill Order Data button:', error);
    }
}

/**
 * Add the Fill Order Data button near a specific element
 * @param {HTMLElement} targetElement - The element to add the button near
 */
function addButtonNearElement(targetElement) {
    // Check if button already exists
    if (document.getElementById('fill-order-data-btn')) {
        console.log('Fill Order Data button already exists');
        return;
    }
    
    // Create the button
    const fillOrderDataButton = document.createElement('button');
    fillOrderDataButton.id = 'fill-order-data-btn';
    fillOrderDataButton.textContent = 'Fill Order Data';
    fillOrderDataButton.className = 'btn btn-secondary';
    fillOrderDataButton.style.cssText = `
        margin-left: 10px;
        background: #28a745;
        color: white;
        border: 1px solid #28a745;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    
    // Add hover effect
    fillOrderDataButton.addEventListener('mouseenter', () => {
        fillOrderDataButton.style.backgroundColor = '#218838';
    });
    
    fillOrderDataButton.addEventListener('mouseleave', () => {
        fillOrderDataButton.style.backgroundColor = '#28a745';
    });
    
    // Add click event listener
    fillOrderDataButton.addEventListener('click', handleFillOrderDataClick);
    
    // Insert the button after the target element
    if (targetElement.parentNode) {
        targetElement.parentNode.insertBefore(fillOrderDataButton, targetElement.nextSibling);
        console.log('Fill Order Data button added successfully');
    } else {
        console.error('Could not find parent node for bulk actions button');
    }
}

/**
 * Handle click on Fill Order Data button
 */
async function handleFillOrderDataClick() {
    try {
        console.log('Fill Order Data button clicked');
        
        // Disable button and show loading state
        const button = document.getElementById('fill-order-data-btn');
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
        button.style.backgroundColor = '#6c757d';
        
        // Add progress indicator
        let progressCounter = 0;
        const progressInterval = setInterval(() => {
            progressCounter++;
            button.textContent = `Loading${'.'.repeat(progressCounter % 4)}`;
        }, 500);
        
        // Get all order numbers from the current page
        const orderNumbers = getAllOrderNumbersFromPage();
        console.log(`Found ${orderNumbers.length} order numbers:`, orderNumbers);
        
        if (orderNumbers.length === 0) {
            alert('No order numbers found on this page');
            button.textContent = originalText;
            button.disabled = false;
            button.style.backgroundColor = '#28a745';
            return;
        }
        
        // Fetch order data for all orders
        const orderDataMap = await fetchAllOrderData(orderNumbers);
        console.log('Fetched order data:', orderDataMap);
        
        // Store the order data
        localStorage.setItem('veeqoOrderData', JSON.stringify(orderDataMap));
        console.log('Order data stored in localStorage');
        
        
        // Clear progress interval
        clearInterval(progressInterval);
        
        // Show all USPS buttons now that data is loaded
        showAllUSPSButtons();
        
        
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
        button.style.backgroundColor = '#28a745';
        
    } catch (error) {
        console.error('Error handling Fill Order Data click:', error);
        
        // Clear progress interval
        clearInterval(progressInterval);
        
        alert('Error fetching order data: ' + error.message);
        
        // Restore button state
        const button = document.getElementById('fill-order-data-btn');
        button.textContent = 'Fill Order Data';
        button.disabled = false;
        button.style.backgroundColor = '#28a745';
    }
}

/**
 * Get all order numbers from the current page
 * @returns {Array<string>} Array of order numbers
 */
function getAllOrderNumbersFromPage() {
    const orderNumbers = new Set();
    
    try {
        const table = document.getElementById('allocations-table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const orderNumber = extractOrderNumberFromRow(row);
                if (orderNumber) {
                    orderNumbers.add(orderNumber);
                }
            });
        }
    } catch (error) {
        console.error('Error getting order numbers from page:', error);
    }
    
    return Array.from(orderNumbers);
}

/**
 * Extract HTML table data for all orders
 * @param {Array<string>} orderNumbers - Array of order numbers to extract data for
 * @returns {Object} Object with order numbers as keys and table data as values
 */
function extractTableDataForOrders(orderNumbers) {
    const tableData = {};
    
    try {
        const table = document.getElementById('allocations-table');
        if (!table) {
            console.log('No allocations table found');
            return tableData;
        }
        
        const rows = table.querySelectorAll('tbody tr');
        console.log(`Extracting table data from ${rows.length} rows`);
        
        rows.forEach((row, index) => {
            try {
                // Extract order number from this row
                const orderNumber = extractOrderNumberFromRow(row);
                
                if (orderNumber && orderNumbers.includes(orderNumber)) {
                    // Extract shipping rate and quantity from this row
                    const veeqoShippingRate = extractVeeqoShippingRateFromRow(row);
                    const quantityToShip = extractQuantityToShipFromRow(row);
                    
                    tableData[orderNumber] = {
                        veeqo_shipping_rate: veeqoShippingRate,
                        quantity_to_ship: quantityToShip
                    };
                    
                    console.log(`📋 Row ${index + 1} - Order ${orderNumber}:`, tableData[orderNumber]);
                }
            } catch (error) {
                console.error(`Error extracting data from row ${index + 1}:`, error);
            }
        });
        
        console.log(`Extracted table data for ${Object.keys(tableData).length} orders`);
        
    } catch (error) {
        console.error('Error extracting table data for orders:', error);
    }
    
    return tableData;
}

/**
 * Fetch order data for all order numbers
 * @param {Array<string>} orderNumbers - Array of order numbers from the table
 * @returns {Promise<Object>} Object with order numbers as keys and order data as values
 */
async function fetchAllOrderData(orderNumbers) {
    const orderDataMap = {};
    
    try {
        // Check if extension context is valid
        if (!isExtensionContextValid()) {
            throw new Error('Extension context invalidated. Please reload the page.');
        }
        
        // Get API key
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('Veeqo API key not configured. Please set it in extension settings.');
        }
        
        console.log(`Fetching all orders from API...`);
        
        // Add timeout to the API call
        const apiCallPromise = chrome.runtime.sendMessage({
            action: 'fetchVeeqoOrders',
            apiKey: apiKey,
            params: {
                page_size: 100,
                status: 'awaiting_fulfillment'
            }
        });
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API call timed out after 30 seconds')), 30000);
        });
        
        // Race between API call and timeout
        const allOrdersResponse = await Promise.race([apiCallPromise, timeoutPromise]);
        
        // Log the complete API response for debugging
        console.log('🔍 Complete API Response:', allOrdersResponse);
        console.log('🔍 API Response Type:', typeof allOrdersResponse);
        console.log('🔍 API Response Success:', allOrdersResponse?.success);
        console.log('🔍 API Response Data:', allOrdersResponse?.data);
        console.log('🔍 API Response Error:', allOrdersResponse?.error);
        
        if (!allOrdersResponse || !allOrdersResponse.success) {
            console.error('❌ API Request Failed:', allOrdersResponse);
            throw new Error('Failed to fetch orders from API: ' + (allOrdersResponse?.error || 'Unknown error'));
        }
        
        // Log the exact structure of the API response data
        console.log('🔍 API Response Data Structure:');
        console.log('🔍 allOrdersResponse.data:', allOrdersResponse.data);
        console.log('🔍 allOrdersResponse.data type:', typeof allOrdersResponse.data);
        console.log('🔍 allOrdersResponse.data keys:', Object.keys(allOrdersResponse.data || {}));
        
        // Check different possible response structures
        let allOrders = [];
        
        if (Array.isArray(allOrdersResponse.data)) {
            // Veeqo API returns direct array structure: [...]
            allOrders = allOrdersResponse.data;
            console.log('✅ Found orders as direct array in data (Veeqo API format)');
        } else if (allOrdersResponse.data.orders) {
            // Standard structure: { orders: [...] }
            allOrders = allOrdersResponse.data.orders;
            console.log('✅ Found orders in data.orders');
        } else if (allOrdersResponse.data.results) {
            // Alternative structure: { results: [...] }
            allOrders = allOrdersResponse.data.results;
            console.log('✅ Found orders in data.results');
        } else if (allOrdersResponse.data.data) {
            // Nested structure: { data: { orders: [...] } }
            allOrders = allOrdersResponse.data.data.orders || allOrdersResponse.data.data;
            console.log('✅ Found orders in data.data');
        } else {
            // Try to find any array in the response
            const dataKeys = Object.keys(allOrdersResponse.data || {});
            for (const key of dataKeys) {
                if (Array.isArray(allOrdersResponse.data[key])) {
                    allOrders = allOrdersResponse.data[key];
                    console.log(`✅ Found orders in data.${key}`);
                    break;
                }
            }
        }
        
        console.log(`📊 Fetched ${allOrders.length} orders from API`);
        console.log('📊 Orders Array:', allOrders);
        
        // Log each order individually for detailed inspection
        allOrders.forEach((order, index) => {
            console.log(`📋 Order ${index + 1}:`, order);
            console.log(`📋 Order ${index + 1} - sales_record_number:`, order.sales_record_number);
            console.log(`📋 Order ${index + 1} - reference_number:`, order.reference_number);
            console.log(`📋 Order ${index + 1} - id:`, order.id);
        });
        
        // Create a mapping of sales_record_number to order data
        const apiOrderMap = {};
        allOrders.forEach(order => {
            if (order.sales_record_number) {
                apiOrderMap[order.sales_record_number] = order;
            }
        });
        
        console.log(`Created API order map with ${Object.keys(apiOrderMap).length} orders using sales_record_number`);
        
        // Get HTML table data for each order
        const tableData = extractTableDataForOrders(orderNumbers);
        console.log('📊 Extracted table data:', tableData);
        
        // Match table order numbers with API data
        for (const orderNumber of orderNumbers) {
            try {
                console.log(`Looking for order data for sales_record_number: ${orderNumber}`);
                
                // Find matching order in API data using sales_record_number
                const apiOrder = apiOrderMap[orderNumber];
                
                // Get HTML table data for this order
                const htmlData = tableData[orderNumber] || {};
                
                if (apiOrder) {
                    // Get SKU codes and quantity for reference_number formatting
                    const skuCodes = apiOrder.line_items?.map(item => item.sellable?.sku_code).filter(Boolean) || [];
                    const quantityToShip = htmlData.quantity_to_ship || '1';
                    
                    // Format reference_number as: {quantity_to_ship} x {sku_codes}
                    const formattedReferenceNumber = skuCodes.length > 0 
                        ? `${quantityToShip} x ${skuCodes.join(', ')}`
                        : quantityToShip;
                    
        // Debug: Log the API order structure to see what's available
        console.log('🔍 API Order structure for', orderNumber, ':', apiOrder);
        console.log('🔍 API Order keys:', Object.keys(apiOrder));
        console.log('🔍 Has allocations:', !!apiOrder.allocations);
        console.log('🔍 Allocations length:', apiOrder.allocations?.length || 0);
        
        // Extract allocation_package from allocations array
        let allocationPackage = null;
        if (apiOrder.allocations && apiOrder.allocations.length > 0) {
            allocationPackage = apiOrder.allocations[0].allocation_package;
            console.log('🔍 Found allocation_package in allocations[0]:', allocationPackage);
        } else {
            console.log('🔍 No allocations found or allocations array is empty');
        }
        
        // Extract the required data based on actual Veeqo API structure
        const extractedData = {
            deliver_to: apiOrder.delivery_method?.name || null,
            sku_codes: skuCodes,
            allocation_package: allocationPackage,
            line_items: apiOrder.line_items || [],
            shipping_addresses: apiOrder.deliver_to || null,
            customer: apiOrder.customer || null,
            sales_record_number: apiOrder.sales_record_number || orderNumber,
            reference_number: formattedReferenceNumber,
            id: apiOrder.id,
            // Additional useful fields from Veeqo API
            number: apiOrder.number || null,
            status: apiOrder.status || null,
            total_price: apiOrder.total_price || null,
            currency_code: apiOrder.currency_code || null,
            // HTML table data
            veeqo_shipping_rate: htmlData.veeqo_shipping_rate || null,
            quantity_to_ship: quantityToShip
        };
                    
                    orderDataMap[orderNumber] = extractedData;
                    console.log(`✅ Matched data for sales_record_number ${orderNumber}:`, extractedData);
                } else {
                    console.warn(`❌ No API data found for sales_record_number: ${orderNumber}`);
                    
                    // Even if no API data, store HTML table data
                    if (htmlData.veeqo_shipping_rate || htmlData.quantity_to_ship) {
                        orderDataMap[orderNumber] = {
                            sales_record_number: orderNumber,
                            veeqo_shipping_rate: htmlData.veeqo_shipping_rate || null,
                            quantity_to_ship: htmlData.quantity_to_ship || null,
                            reference_number: htmlData.quantity_to_ship || '1'
                        };
                        console.log(`✅ Stored HTML data for sales_record_number ${orderNumber}:`, orderDataMap[orderNumber]);
                    }
                }
                
            } catch (error) {
                console.error(`Error processing order ${orderNumber}:`, error);
            }
        }
        
        console.log(`Successfully matched ${Object.keys(orderDataMap).length} out of ${orderNumbers.length} orders`);
        
        
    } catch (error) {
        console.error('Error fetching order data:', error);
        throw error;
    }
    
    return orderDataMap;
}


// Observer to watch for dynamic content changes
function setupTableObserver(table) {
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Check if rows were added or removed
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'TR' || node.querySelector('tr')) {
                            shouldUpdate = true;
                        }
                    }
                });
                
                // Check if rows were removed (this happens when table is refreshed)
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'TR' || node.querySelector('tr')) {
                            shouldUpdate = true;
                        }
                    }
                });
            }
            
            // Also watch for attribute changes that might indicate table refresh
            if (mutation.type === 'attributes') {
                if (mutation.attributeName === 'aria-busy' || 
                    mutation.attributeName === 'class' ||
                    mutation.attributeName === 'style') {
                    shouldUpdate = true;
                }
            }
        });
        
        if (shouldUpdate) {
            console.log('Table content changed, updating USPS buttons');
            // Use a longer delay to ensure the table is fully updated
            setTimeout(() => addUSPSButtonsToTable(table), 500);
            // Also check again after a longer delay in case the table is still updating
            setTimeout(() => addUSPSButtonsToTable(table), 1500);
        }
    });
    
    // Start observing the tbody for changes
    const tbody = table.querySelector('tbody');
    if (tbody) {
        observer.observe(tbody, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-busy', 'class', 'style']
        });
        console.log('Table observer set up for dynamic content');
    }
    
    // Also observe the table itself for major changes
    const tableObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Check if tbody was replaced
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'TBODY') {
                        shouldUpdate = true;
                        // Set up observer on the new tbody
                        setTimeout(() => setupTableObserver(table), 100);
                    }
                });
            }
        });
        
        if (shouldUpdate) {
            console.log('Table structure changed, updating USPS buttons');
            setTimeout(() => addUSPSButtonsToTable(table), 500);
        }
    });
    
    tableObserver.observe(table, {
        childList: true,
        subtree: false
    });
}

// Main initialization function
async function initializeExtension() {
    try {
        console.log('Veeqo USPS Extension: Initializing...');
        
        // Mark that the extension has been initialized
        window.veeqoUSPSExtensionInitialized = true;
        
        // Wait for DOM to be ready
        await waitForDOM();
        
        // Check if we're on the correct page
        if (!isVeeqoAllocationsPage()) {
            console.log('Not on Veeqo allocations page, skipping initialization');
            return;
        }
        
        // Wait for the allocations table
        const table = await waitForAllocationsTable();
        console.log('Allocations table found');
        
        // Add USPS buttons to existing rows
        addUSPSButtonsToTable(table);
        
        // Add "Fill Order Data" button near bulk actions
        addFillOrderDataButton();
        
        // Set up observer for dynamic content
        setupTableObserver(table);
        
        console.log('Veeqo USPS Extension: Initialization complete');
        
    } catch (error) {
        console.error('Error initializing Veeqo USPS Extension:', error);
    }
}

// Start the extension
initializeExtension();

// Also run when the page becomes visible (in case of tab switching)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(initializeExtension, 500);
    }
});

// Periodic check to ensure buttons are always present
let periodicCheckInterval = null;

function startPeriodicCheck() {
    // Clear any existing interval
    if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
    }
    
    // Check every 2 seconds for missing buttons
    periodicCheckInterval = setInterval(() => {
        const table = document.getElementById('allocations-table');
        if (table && isVeeqoAllocationsPage()) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                let missingButtons = 0;
                
                rows.forEach((row) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        const thirdCell = cells[2];
                        if (!thirdCell.querySelector('.usps-label-button')) {
                            missingButtons++;
                        }
                    }
                });
                
                if (missingButtons > 0) {
                    console.log(`Found ${missingButtons} rows missing USPS buttons, adding them...`);
                    addUSPSButtonsToTable(table);
                }
            }
        }
    }, 2000);
    
    console.log('Started periodic check for USPS buttons');
}

// Start periodic check after a delay
setTimeout(startPeriodicCheck, 3000);

// Also watch for Veeqo-specific loading indicators
function watchForVeeqoLoading() {
    // Watch for loading spinners or busy indicators
    const loadingObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
                const target = mutation.target;
                if (target.getAttribute('aria-busy') === 'false') {
                    // Table finished loading, check for buttons
                    console.log('Table finished loading (aria-busy=false), checking for USPS buttons');
                    setTimeout(() => {
                        const table = document.getElementById('allocations-table');
                        if (table) {
                            addUSPSButtonsToTable(table);
                        }
                    }, 500);
                }
            }
        });
    });
    
    // Observe the table for aria-busy changes
    const table = document.getElementById('allocations-table');
    if (table) {
        loadingObserver.observe(table, {
            attributes: true,
            attributeFilter: ['aria-busy']
        });
        console.log('Started watching for Veeqo loading indicators');
    }
}

// Start watching for loading indicators
setTimeout(watchForVeeqoLoading, 1000);

// Also listen for network activity that might indicate data loading
let networkActivityTimeout = null;
const originalFetch = window.fetch;
const originalXHROpen = XMLHttpRequest.prototype.open;

// Monitor fetch requests (but don't interfere with API proxy calls)
window.fetch = function(...args) {
    // Check if this is a call from our API proxy
    const stack = new Error().stack;
    const isFromApiProxy = stack && stack.includes('api-proxy.js');
    
    if (isFromApiProxy) {
        // This is from our API proxy, don't interfere - just call original fetch
        return originalFetch.apply(this, args);
    }
    
    const result = originalFetch.apply(this, args);
    
    // Only monitor calls that are NOT from our API proxy
    if (args[0] && args[0].includes && args[0].includes('veeqo.com')) {
        console.log('Detected Veeqo API call (not from API proxy), will check for buttons after response');
        clearTimeout(networkActivityTimeout);
        networkActivityTimeout = setTimeout(() => {
            const table = document.getElementById('allocations-table');
            if (table) {
                console.log('Network activity detected, checking for USPS buttons');
                addUSPSButtonsToTable(table);
            }
        }, 1000);
    }
    return result;
};

// Monitor XMLHttpRequest
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (url && url.includes && url.includes('veeqo.com')) {
        console.log('Detected Veeqo XHR request, will check for buttons after response');
        clearTimeout(networkActivityTimeout);
        networkActivityTimeout = setTimeout(() => {
            const table = document.getElementById('allocations-table');
            if (table) {
                console.log('XHR activity detected, checking for USPS buttons');
                addUSPSButtonsToTable(table);
            }
        }, 1000);
    }
    return originalXHROpen.apply(this, [method, url, ...args]);
};

// Add debugging for API proxy messages
console.log('🔍 Content Script: Listening for API proxy messages...');
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔍 Content Script: Received message:', message);
    if (message.type === 'VEEQO_API_REQUEST') {
        console.log('🔍 Content Script: API request received:', message);
    }
    return false; // Let other listeners handle it
});
