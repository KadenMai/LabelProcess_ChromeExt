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
            console.log('Extension context invalidated, cannot access storage');
            return null;
        }
        
        const result = await chrome.storage.sync.get(['veeqoApiKey']);
        return result.veeqoApiKey || null;
    } catch (error) {
        console.log('Error getting API key from storage:', error.message);
        return null;
    }
}

/**
 * Get stored USPS button column setting from Chrome storage
 * @returns {Promise<number>} The column number (default: 3)
 */
async function getUSPSButtonColumn() {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.log('Extension context invalidated, using default column 3');
            return 3;
        }
        
        const result = await chrome.storage.sync.get(['uspsButtonColumn']);
        return result.uspsButtonColumn || 3;
    } catch (error) {
        console.log('Error getting USPS button column setting, using default column 3:', error.message);
        return 3;
    }
}

/**
 * Get stored Print Note column setting from Chrome storage
 * @returns {Promise<number>} The column number (default: 6)
 */
async function getPrintNoteColumn() {
    try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            console.log('Extension context invalidated, using default column 6');
            return 6;
        }
        
        const result = await chrome.storage.sync.get(['printNoteColumn']);
        return result.printNoteColumn || 6;
    } catch (error) {
        console.log('Error getting Print Note column setting, using default column 6:', error.message);
        return 6;
    }
}
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

// Add USPS button to the configured column of each row in tbody
async function addUSPSButtonsToTable(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.log('No tbody found in allocations table');
        return;
    }

    // Get the configured column number
    const uspsButtonColumn = await getUSPSButtonColumn();
    const columnIndex = uspsButtonColumn - 1; // Convert to 0-based index
    
    console.log(`Using USPS button column: ${uspsButtonColumn} (index: ${columnIndex})`);

    const rows = tbody.querySelectorAll('tr');
    console.log(`Found ${rows.length} rows in allocations table`);

    let buttonsAdded = 0;
    let buttonsSkipped = 0;

    rows.forEach(async (row, index) => {
        // Skip rows that are actual headers (contain <th> elements with role="columnheader")
        const headerCells = row.querySelectorAll('th[role="columnheader"]');
        if (headerCells.length > 0) {
            return; // Skip this row - it's a header row
        }
        
        // Get the configured column
        const cells = row.querySelectorAll('td');
        if (cells.length >= uspsButtonColumn) {
            const targetCell = cells[columnIndex];
            
            // Check if USPS button already exists in this cell
            if (!targetCell.querySelector('.usps-label-button')) {
                // Create a container for the button if needed
                let buttonContainer = targetCell.querySelector('.usps-button-container');
                if (!buttonContainer) {
                    buttonContainer = document.createElement('div');
                    buttonContainer.className = 'usps-button-container';
                    buttonContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin: 5px 0;';
                    
                    // Add the button container to the cell
                    targetCell.appendChild(buttonContainer);
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
        
        // Print Note buttons will be created after Fill Order Data action
        // No need to check for customer notes during initial button creation
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
        let orderNumber = null;
        
        // Get all cells in the row
        const cells = row.querySelectorAll('td');
        
        // Check if we have at least 4 columns (Column 4 is index 3)
        if (cells.length >= 4) {
            const orderCell = cells[3]; // Column 4 (0-indexed)
            
            // Look for the button with class containing "act-react-listing-row-item-name"
            const orderButton = orderCell.querySelector('button[class*="act-react-listing-row-item-name"]');
            if (orderButton) {
                // Get the span element inside this button (there should be only one)
                const spanElement = orderButton.querySelector('span');
                if (spanElement) {
                    const orderText = spanElement.textContent?.trim();
                    if (orderText) {
                        console.log(`Found order text in span: "${orderText}"`);
                        orderNumber = orderText;
                    }
                }
            }
            
            // Fallback: look for any text in the order cell
            if (!orderNumber) {
                const cellText = orderCell.textContent?.trim();
                if (cellText) {
                    console.log(`Found order text in cell: "${cellText}"`);
                    orderNumber = cellText;
                }
            }
        }
        
        if (!orderNumber) {
            console.log('No order number found in column 4');
        }
        
        return orderNumber;
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
    
    // Logging removed - only call getStoredOrderData when actually needed
    
    // Initially hide the button until data is loaded
    button.style.display = 'none';
    
    console.log(`🔍 Created USPS button for Order ${orderNumber} (initially hidden)`);
    
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

// Cache for order data logging to prevent repeated messages
const loggedOrderDataCache = new Set();

/**
 * Get stored order data for a specific order number from localStorage
 * @param {string} orderNumber - The order number
 * @returns {Object|null} The stored order data or null if not found
 */
function getStoredOrderData(orderNumber) {
    try {
        const storedData = localStorage.getItem('veeqoOrderData');
        
        if (storedData) {
            const orderDataMap = JSON.parse(storedData);
            
            if (orderDataMap && orderDataMap[orderNumber]) {
                // Only log once per order number
                if (!loggedOrderDataCache.has(orderNumber)) {
                    console.log(`🔍 Found cached data for order: ${orderNumber}`);
                    loggedOrderDataCache.add(orderNumber);
                }
                return orderDataMap[orderNumber];
            } else {
                // Only log once per order number
                if (!loggedOrderDataCache.has(orderNumber)) {
                    console.log(`🔍 No cached data for order: ${orderNumber}`);
                    console.log(`🔍 Click "Fill Order Data" button first to fetch order data`);
                    loggedOrderDataCache.add(orderNumber);
                }
                return null;
            }
        } else {
            console.log(`🔍 No stored order data found in localStorage`);
            console.log(`🔍 Click "Fill Order Data" button first to fetch order data`);
            return null;
        }
    } catch (error) {
        console.error('Error getting stored order data:', error);
        return null;
    }
}

function goToUSPSWithOrderNumber(orderNumber) {
    console.log(`🔍 Opening USPS Label Manager for order: ${orderNumber}`);
    
    try {
        // Get cached order data from localStorage (synchronous - faster!)
        const orderData = getStoredOrderData(orderNumber);
        
        if (orderData) {
            console.log(`✅ Using cached order data for USPS auto-fill:`, orderData);
            goToUSPS(orderData);
        } else {
            console.log(`❌ No cached data for ${orderNumber}, opening USPS page without auto-fill`);
            console.log(`🔍 Click "Fill Order Data" button first to fetch order data`);
            goToUSPS();
        }
    } catch (error) {
        console.error('❌ Error getting cached order data:', error);
        console.log('🔍 Opening USPS page without auto-fill due to error');
        goToUSPS();
    }
}

// Using localStorage for fast synchronous caching



/**
 * Show all USPS buttons after order data is loaded
 */
async function showAllUSPSButtons() {
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
    
    // Create Print Note buttons for orders with customer notes
    await createPrintNoteButtons();
    
    // Show a notification to the user
    if (buttonsShown > 0) {
        const message = `✅ ${buttonsShown} USPS buttons are now ready! Click any button to use the features.`;
        showSimpleNotification(message);
    }
}


/**
 * Create Print Note buttons for orders with customer notes
 */
async function createPrintNoteButtons() {
    console.log('🔍 createPrintNoteButtons() called');
    
    const table = document.getElementById('allocations-table');
    if (!table) {
        console.log('❌ No allocations table found');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.log('❌ No tbody found');
        return;
    }
    
    const rows = tbody.querySelectorAll('tr');
    console.log(`🔍 Found ${rows.length} rows in table`);
    
    const printNoteColumn = await getPrintNoteColumn();
    console.log(`🔍 Print Note column configured as: ${printNoteColumn}`);
    const printNoteColumnIndex = printNoteColumn - 1;
    
    let printNoteButtonsCreated = 0;
    let ordersWithNotes = 0;
    let ordersWithoutNotes = 0;
    
    rows.forEach((row, index) => {
        // Skip rows that don't have enough columns (likely headers/filters)
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) {
            return; // Skip this row
        }
        
        // Skip rows that are actual headers (contain <th> elements with role="columnheader")
        const headerCells = row.querySelectorAll('th[role="columnheader"]');
        if (headerCells.length > 0) {
            return; // Skip this row - it's a header row
        }
        
        const orderNumber = extractOrderNumberFromRow(row);
        if (orderNumber) {
            console.log(`🔍 Checking row ${index + 1} - Order: ${orderNumber}`);
            
            const orderData = getStoredOrderData(orderNumber);
            if (orderData) {
                console.log(`🔍 Order data found for ${orderNumber}:`, orderData);
                
                if (orderData.customer_note) {
                    ordersWithNotes++;
                    console.log(`✅ Order ${orderNumber} has customer note: "${orderData.customer_note}"`);
                    
                    const cells = row.querySelectorAll('td');
                    
                    if (cells.length >= printNoteColumn) {
                        const printNoteCell = cells[printNoteColumnIndex];
                        
                        // Check if Print Note button already exists
                        if (!printNoteCell.querySelector('.print-note-button')) {
                            const printNoteButton = document.createElement('button');
                            printNoteButton.className = 'print-note-button';
                            printNoteButton.textContent = 'Print Note';
                            printNoteButton.id = `print-note-${orderNumber}`;
                            printNoteButton.title = `Print customer note for order: ${orderNumber}`;
                            
                            // Style the button
                            printNoteButton.style.cssText = `
                                background: #17a2b8;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                margin: 2px;
                                transition: background-color 0.3s ease;
                            `;
                            
                            // Add hover effect
                            printNoteButton.addEventListener('mouseenter', function() {
                                this.style.backgroundColor = '#138496';
                            });
                            
                            printNoteButton.addEventListener('mouseleave', function() {
                                this.style.backgroundColor = '#17a2b8';
                            });
                            
                            // Add click event listener
                            printNoteButton.addEventListener('click', function() {
                                console.log(`Print Note button clicked for order: ${orderNumber}`);
                                printDeliveryInstructions(orderData);
                            });
                            
                            printNoteCell.appendChild(printNoteButton);
                            printNoteButtonsCreated++;
                            console.log(`✅ Added Print Note button to column ${printNoteColumn} for order: ${orderNumber}`);
                        }
                    }
                } else {
                    ordersWithoutNotes++;
                    console.log(`🔍 Order ${orderNumber} has no customer note`);
                }
            } else {
                console.log(`❌ No order data found for ${orderNumber}`);
            }
        }
        // Note: Removed "No order number found" log since we now skip non-data rows
    });
    
    console.log(`📊 Summary: ${ordersWithNotes} orders with notes, ${ordersWithoutNotes} orders without notes`);
    console.log(`📊 Created ${printNoteButtonsCreated} Print Note buttons`);
    
    if (printNoteButtonsCreated > 0) {
        console.log(`✅ Created ${printNoteButtonsCreated} Print Note buttons`);
        showSimpleNotification(`✅ ${printNoteButtonsCreated} Print Note buttons are also available!`);
    } else {
        console.log(`ℹ️ No Print Note buttons created. Check if orders have customer notes.`);
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
function addButtonNearElement(targetElement) {
    // Check if buttons already exist
    if (document.getElementById('fill-order-data-btn')) {
        console.log('Fill Order Data button already exists');
        return;
    }
    
    // Create a container for both buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'gbv-button-container';
    buttonContainer.style.cssText = 'display: inline-flex; gap: 10px; margin-left: 10px;';
    
    // Create the Fill Order Data button
    const fillOrderDataButton = document.createElement('button');
    fillOrderDataButton.id = 'fill-order-data-btn';
    fillOrderDataButton.textContent = 'Fill Order Data';
    fillOrderDataButton.className = 'btn btn-secondary';
    fillOrderDataButton.style.cssText = `
        background: #28a745;
        color: white;
        border: 1px solid #28a745;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    
    // Create the Load AMZ Note button
    const loadAmzNoteButton = document.createElement('button');
    loadAmzNoteButton.id = 'load-amz-note-btn';
    loadAmzNoteButton.textContent = 'Load AMZ Note';
    loadAmzNoteButton.className = 'btn btn-info';
    loadAmzNoteButton.style.cssText = `
        background: #17a2b8;
        color: white;
        border: 1px solid #17a2b8;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    
    // Add hover effects for Fill Order Data button
    fillOrderDataButton.addEventListener('mouseenter', () => {
        fillOrderDataButton.style.backgroundColor = '#218838';
    });
    
    fillOrderDataButton.addEventListener('mouseleave', () => {
        fillOrderDataButton.style.backgroundColor = '#28a745';
    });
    
    // Add hover effects for Load AMZ Note button
    loadAmzNoteButton.addEventListener('mouseenter', () => {
        loadAmzNoteButton.style.backgroundColor = '#138496';
    });
    
    loadAmzNoteButton.addEventListener('mouseleave', () => {
        loadAmzNoteButton.style.backgroundColor = '#17a2b8';
    });
    
    // Add click event listeners
    fillOrderDataButton.addEventListener('click', handleFillOrderDataClick);
    loadAmzNoteButton.addEventListener('click', handleLoadAmzNoteClick);
    
    // Add buttons to container
    buttonContainer.appendChild(fillOrderDataButton);
    buttonContainer.appendChild(loadAmzNoteButton);
    
    // Insert the button container after the target element
    if (targetElement.parentNode) {
        targetElement.parentNode.insertBefore(buttonContainer, targetElement.nextSibling);
        console.log('Fill Order Data and Load AMZ Note buttons added successfully');
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
        
        // Store the order data in localStorage (faster synchronous access)
        localStorage.setItem('veeqoOrderData', JSON.stringify(orderDataMap));
        console.log('Order data stored in localStorage');
        
        // Data is immediately available since localStorage is synchronous
        // No cache clearing needed - fresh data is now ready for USPS buttons
        console.log('Fresh order data is now available for USPS buttons');
        
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
 * Handle click on Load AMZ Note button
 */
async function handleLoadAmzNoteClick() {
    try {
        console.log('Load AMZ Note button clicked');
        
        // Disable button and show loading state
        const button = document.getElementById('load-amz-note-btn');
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
        button.style.backgroundColor = '#6c757d';
        
        // Load and process Amazon order notes
        await loadAmazonOrderNote();
        
        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
        button.style.backgroundColor = '#17a2b8';
        
    } catch (error) {
        console.error('Error handling Load AMZ Note click:', error);
        alert('Error loading Amazon order notes: ' + error.message);
        
        // Restore button state
        const button = document.getElementById('load-amz-note-btn');
        button.textContent = 'Load AMZ Note';
        button.disabled = false;
        button.style.backgroundColor = '#17a2b8';
    }
}

/**
 * Load Amazon order notes from text file and update Veeqo orders
 */
async function loadAmazonOrderNote() {
    try {
        console.log('🔄 Starting Amazon order note loading process...');
        
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt';
        fileInput.style.display = 'none';
        
        // Add to DOM temporarily
        document.body.appendChild(fileInput);
        
        // Create promise to handle file selection
        const filePromise = new Promise((resolve, reject) => {
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    resolve(file);
                } else {
                    reject(new Error('No file selected'));
                }
            });
            
            fileInput.addEventListener('cancel', () => {
                reject(new Error('File selection cancelled'));
            });
        });
        
        // Trigger file selection
        fileInput.click();
        
        // Wait for file selection
        const file = await filePromise;
        
        // Remove file input from DOM
        document.body.removeChild(fileInput);
        
        console.log(`📁 Selected file: ${file.name}`);
        
        // Read file content
        const fileContent = await readFileContent(file);
        console.log('📄 File content loaded, length:', fileContent.length);
        
        // Parse Amazon orders
        const amazonOrders = parseAmazonOrders(fileContent);
        console.log(`📊 Parsed ${amazonOrders.length} Amazon orders`);
        
        // Check if there are any orders with delivery instructions
        const ordersWithInstructions = amazonOrders.filter(order => 
            order.deliveryInstructions && order.deliveryInstructions.trim() !== ''
        );
        console.log(`📝 Found ${ordersWithInstructions.length} orders with delivery instructions`);
        
        if (ordersWithInstructions.length === 0) {
            alert('No orders with delivery instructions found in the file.');
            return;
        }
        
        // Get API key
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('Veeqo API key not configured. Please set it in extension settings.');
        }
        
        // Get all Veeqo orders to map Amazon order IDs
        console.log('🔄 Fetching Veeqo orders for mapping...');
        const allOrdersResponse = await chrome.runtime.sendMessage({
            action: 'fetchVeeqoOrders',
            apiKey: apiKey,
            params: {
                page_size: 100,
                status: 'awaiting_fulfillment'
            }
        });
        
        if (!allOrdersResponse || !allOrdersResponse.success) {
            throw new Error('Failed to fetch Veeqo orders: ' + (allOrdersResponse?.error || 'Unknown error'));
        }
        
        const veeqoOrders = allOrdersResponse.data || [];
        console.log(`📋 Fetched ${veeqoOrders.length} Veeqo orders`);
        
        // Create mapping from Amazon order ID to Veeqo order
        const orderMapping = createOrderMapping(amazonOrders, veeqoOrders);
        console.log(`🔗 Created mapping for ${Object.keys(orderMapping).length} orders`);
        
        // Update Veeqo orders with customer notes
        let successCount = 0;
        let errorCount = 0;
        
        for (const amazonOrderId of Object.keys(orderMapping)) {
            try {
                const veeqoOrder = orderMapping[amazonOrderId];
                const amazonOrder = amazonOrders.find(order => order.orderId === amazonOrderId);
                
                if (veeqoOrder && amazonOrder && amazonOrder.deliveryInstructions) {
                    console.log(`🔄 Updating order ${veeqoOrder.id} with delivery instructions: "${amazonOrder.deliveryInstructions}"`);
                    
                    const updateResponse = await chrome.runtime.sendMessage({
                        action: 'updateVeeqoOrder',
                        apiKey: apiKey,
                        orderId: veeqoOrder.id,
                        customerNote: amazonOrder.deliveryInstructions
                    });
                    
                    if (updateResponse && updateResponse.success) {
                        console.log(`✅ Successfully updated order ${veeqoOrder.id}`);
                        successCount++;
                    } else {
                        console.error(`❌ Failed to update order ${veeqoOrder.id}:`, updateResponse?.error);
                        errorCount++;
                    }
                }
            } catch (error) {
                console.error(`❌ Error updating order ${amazonOrderId}:`, error);
                errorCount++;
            }
        }
        
        console.log(`📊 Update summary: ${successCount} successful, ${errorCount} errors`);
        
        // Show completion message
        alert(`Amazon order notes loaded successfully!\n\nUpdated: ${successCount} orders\nErrors: ${errorCount} orders`);
        
        // Reload the page data by calling Fill Order Data
        console.log('🔄 Reloading page data...');
        await handleFillOrderDataClick();
        
    } catch (error) {
        console.error('❌ Error loading Amazon order notes:', error);
        throw error;
    }
}

/**
 * Read file content as text
 * @param {File} file - The file to read
 * @returns {Promise<string>} File content as string
 */
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Parse Amazon orders from file content
 * @param {string} content - File content
 * @returns {Array<Object>} Array of parsed Amazon orders
 */
function parseAmazonOrders(content) {
    const lines = content.split('\n');
    if (lines.length < 2) {
        throw new Error('Invalid file format: No header or data rows found');
    }
    
    // Parse header to get column indices
    const header = lines[0].split('\t');
    const orderIdIndex = header.indexOf('order-id');
    const deliveryInstructionsIndex = header.indexOf('delivery-Instructions');
    
    if (orderIdIndex === -1) {
        throw new Error('Invalid file format: order-id column not found');
    }
    
    if (deliveryInstructionsIndex === -1) {
        throw new Error('Invalid file format: delivery-Instructions column not found');
    }
    
    console.log(`📋 Header columns: order-id=${orderIdIndex}, delivery-Instructions=${deliveryInstructionsIndex}`);
    
    // Parse data rows
    const orders = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
        const columns = line.split('\t');
        if (columns.length > orderIdIndex) {
            const orderId = columns[orderIdIndex]?.trim();
            const deliveryInstructions = columns[deliveryInstructionsIndex]?.trim();
            
            if (orderId) {
                orders.push({
                    orderId: orderId,
                    deliveryInstructions: deliveryInstructions || ''
                });
            }
        }
    }
    
    return orders;
}

/**
 * Create mapping from Amazon order IDs to Veeqo orders (only for orders with delivery instructions)
 * @param {Array<Object>} amazonOrders - Amazon orders
 * @param {Array<Object>} veeqoOrders - Veeqo orders
 * @returns {Object} Mapping object
 */
function createOrderMapping(amazonOrders, veeqoOrders) {
    const mapping = {};
    
    // Create a map of Veeqo orders by their number (which should match Amazon order ID)
    const veeqoOrderMap = {};
    veeqoOrders.forEach(order => {
        if (order.number) {
            veeqoOrderMap[order.number] = order;
        }
    });
    
    // Only map Amazon orders that have delivery instructions
    const ordersWithInstructions = amazonOrders.filter(order => 
        order.deliveryInstructions && order.deliveryInstructions.trim() !== ''
    );
    
    console.log(`📝 Processing ${ordersWithInstructions.length} orders with delivery instructions out of ${amazonOrders.length} total orders`);
    
    // Map only orders with delivery instructions to Veeqo orders
    ordersWithInstructions.forEach(amazonOrder => {
        const veeqoOrder = veeqoOrderMap[amazonOrder.orderId];
        if (veeqoOrder) {
            mapping[amazonOrder.orderId] = veeqoOrder;
            console.log(`🔗 Mapped Amazon order ${amazonOrder.orderId} to Veeqo order ${veeqoOrder.id} (Instructions: "${amazonOrder.deliveryInstructions}")`);
        } else {
            console.log(`⚠️ No Veeqo order found for Amazon order ${amazonOrder.orderId} with instructions: "${amazonOrder.deliveryInstructions}"`);
        }
    });
    
    console.log(`✅ Created mapping for ${Object.keys(mapping).length} orders with delivery instructions`);
    return mapping;
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
        
        // Create a mapping of number to order data
        const apiOrderMap = {};
        allOrders.forEach(order => {
            if (order.number) {
                apiOrderMap[order.number] = order;
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
                    
                    // Extract customer note if available
                    let customerNote = null;
                    if (apiOrder.customer_note && apiOrder.customer_note.text) {
                        customerNote = apiOrder.customer_note.text;
                        console.log('🔍 Found customer note:', customerNote);
                    }
                    
                    // Extract the required data based on actual Veeqo API structure
                    const extractedData = {
                        deliver_to: apiOrder.delivery_method?.name || null,
                        sku_codes: skuCodes,
                        allocation_package: allocationPackage,
                        line_items: apiOrder.line_items || [],
                        shipping_addresses: apiOrder.deliver_to || null,
                        customer: apiOrder.customer || null,
                        customer_note: customerNote,
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

// Periodic check removed - user should click "Fill Order Data" when page changes
// This gives user control over when to fetch fresh data and prevents infinite loops

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

// Monitor fetch requests
window.fetch = function(...args) {
    const result = originalFetch.apply(this, args);
    if (args[0] && args[0].includes && args[0].includes('veeqo.com')) {
        console.log('Detected Veeqo API call, will check for buttons after response');
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
