/**
 * USPS Form Auto-Fill Debug Version
 * Enhanced logging and debugging for USPS form auto-fill functionality
 */

// USPS form field IDs (extracted from the USPS page structure)
const USPS_FORM_FIELDS = {
    // Customer Information
    firstName: 'firstName',
    middleInitial: 'middleInitial', 
    lastName: 'lastName',
    company: 'company',
    
    // Shipping Address
    streetAddress1: 'streetAddress1',
    address2AptSuite: 'address2AptSuite',
    city: 'city',
    zipCode: 'zipCode',
    
    // Additional fields
    referenceNumber: 'referenceNumber',
    referenceNumber2: 'referenceNumber2'
};

// Debug logging function
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[USPS Auto-Fill Debug ${timestamp}] ${message}`;
    console.log(logMessage, data || '');
    
    // Also log to a visible debug panel if it exists
    const debugPanel = document.getElementById('usps-debug-panel');
    if (debugPanel) {
        const logEntry = document.createElement('div');
        logEntry.style.cssText = 'margin: 2px 0; padding: 2px 5px; background: #f0f0f0; border-radius: 3px; font-size: 12px;';
        logEntry.textContent = `${timestamp}: ${message}`;
        debugPanel.appendChild(logEntry);
        debugPanel.scrollTop = debugPanel.scrollHeight;
    }
}

// Create debug panel
function createDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'usps-debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 400px;
        height: 300px;
        background: white;
        border: 2px solid #007bff;
        border-radius: 5px;
        padding: 10px;
        z-index: 10001;
        font-family: monospace;
        font-size: 11px;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #007bff;';
    header.textContent = 'USPS Auto-Fill Debug Panel';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'float: right; background: none; border: none; font-size: 16px; cursor: pointer;';
    closeBtn.onclick = () => debugPanel.remove();
    
    header.appendChild(closeBtn);
    debugPanel.appendChild(header);
    
    document.body.appendChild(debugPanel);
    return debugPanel;
}

/**
 * Enhanced form field detection with detailed logging
 */
function detectFormFields() {
    debugLog('Starting form field detection...');
    
    const fieldStatus = {};
    let totalFields = 0;
    let availableFields = 0;
    
    Object.entries(USPS_FORM_FIELDS).forEach(([key, fieldId]) => {
        const field = document.getElementById(fieldId);
        const isAvailable = !!field;
        const isVisible = field && field.offsetParent !== null;
        const isEnabled = field && !field.disabled;
        
        fieldStatus[key] = {
            id: fieldId,
            available: isAvailable,
            visible: isVisible,
            enabled: isEnabled,
            element: field
        };
        
        totalFields++;
        if (isAvailable) availableFields++;
        
        debugLog(`Field ${key} (${fieldId}): Available=${isAvailable}, Visible=${isVisible}, Enabled=${isEnabled}`);
    });
    
    debugLog(`Form field summary: ${availableFields}/${totalFields} fields available`);
    
    return fieldStatus;
}

/**
 * Enhanced auto-fill with detailed logging
 */
function autoFillUSPSFormDebug(orderData) {
    debugLog('Starting auto-fill process...', orderData);
    
    if (!orderData) {
        debugLog('ERROR: No order data provided');
        return false;
    }
    
    // Detect form fields first
    const fieldStatus = detectFormFields();
    
    // Check if we have the minimum required fields
    const requiredFields = ['firstName', 'lastName', 'city'];
    const missingFields = requiredFields.filter(field => !fieldStatus[field]?.available);
    
    if (missingFields.length > 0) {
        debugLog(`ERROR: Missing required fields: ${missingFields.join(', ')}`);
        return false;
    }
    
    try {
        debugLog('Filling customer information...');
        fillCustomerInformationDebug(orderData, fieldStatus);
        
        debugLog('Filling shipping address...');
        fillShippingAddressDebug(orderData, fieldStatus);
        
        debugLog('Filling reference numbers...');
        fillReferenceNumbersDebug(orderData, fieldStatus);
        
        debugLog('Auto-fill completed successfully!');
        showAutoFillSuccess();
        return true;
        
    } catch (error) {
        debugLog(`ERROR during auto-fill: ${error.message}`, error);
        showAutoFillError(error.message);
        return false;
    }
}

/**
 * Enhanced customer information filling with logging
 */
function fillCustomerInformationDebug(orderData, fieldStatus) {
    const customer = orderData.customer || {};
    const customerName = customer.name || '';
    
    debugLog(`Customer name: "${customerName}"`);
    debugLog(`Customer company: "${customer.company || ''}"`);
    
    const nameParts = parseCustomerName(customerName);
    debugLog('Parsed name parts:', nameParts);
    
    // Fill First Name
    if (fieldStatus.firstName?.available) {
        const field = fieldStatus.firstName.element;
        field.value = nameParts.firstName;
        triggerInputEvent(field);
        debugLog(`Filled First Name: "${nameParts.firstName}"`);
    } else {
        debugLog('WARNING: First Name field not available');
    }
    
    // Fill Middle Initial
    if (fieldStatus.middleInitial?.available) {
        const field = fieldStatus.middleInitial.element;
        field.value = nameParts.middleInitial;
        triggerInputEvent(field);
        debugLog(`Filled Middle Initial: "${nameParts.middleInitial}"`);
    } else {
        debugLog('WARNING: Middle Initial field not available');
    }
    
    // Fill Last Name
    if (fieldStatus.lastName?.available) {
        const field = fieldStatus.lastName.element;
        field.value = nameParts.lastName || '.';
        triggerInputEvent(field);
        debugLog(`Filled Last Name: "${nameParts.lastName || '.'}"`);
    } else {
        debugLog('WARNING: Last Name field not available');
    }
    
    // Fill Company
    if (fieldStatus.company?.available) {
        const field = fieldStatus.company.element;
        field.value = customer.company || '';
        triggerInputEvent(field);
        debugLog(`Filled Company: "${customer.company || ''}"`);
    } else {
        debugLog('WARNING: Company field not available');
    }
}

/**
 * Enhanced shipping address filling with logging
 */
function fillShippingAddressDebug(orderData, fieldStatus) {
    const shippingAddress = orderData.shipping_address || orderData.delivery_address || {};
    debugLog('Shipping address data:', shippingAddress);
    
    // Fill City (first as requested)
    if (fieldStatus.city?.available) {
        const field = fieldStatus.city.element;
        field.value = shippingAddress.city || '';
        triggerInputEvent(field);
        debugLog(`Filled City: "${shippingAddress.city || ''}"`);
    } else {
        debugLog('WARNING: City field not available');
    }
    
    // Fill Street Address
    if (fieldStatus.streetAddress1?.available) {
        const field = fieldStatus.streetAddress1.element;
        const address = formatStreetAddress(shippingAddress);
        field.value = address;
        triggerInputEvent(field);
        debugLog(`Filled Street Address: "${address}"`);
    } else {
        debugLog('WARNING: Street Address field not available');
    }
    
    // Fill Apt/Suite if available
    if (fieldStatus.address2AptSuite?.available && shippingAddress.address2) {
        const field = fieldStatus.address2AptSuite.element;
        field.value = shippingAddress.address2;
        triggerInputEvent(field);
        debugLog(`Filled Apt/Suite: "${shippingAddress.address2}"`);
    }
    
    // Fill Zip Code (last as requested)
    if (fieldStatus.zipCode?.available) {
        const field = fieldStatus.zipCode.element;
        field.value = shippingAddress.postal_code || shippingAddress.zip_code || '';
        triggerInputEvent(field);
        debugLog(`Filled Zip Code: "${shippingAddress.postal_code || shippingAddress.zip_code || ''}"`);
    } else {
        debugLog('WARNING: Zip Code field not available');
    }
}

/**
 * Enhanced reference numbers filling with logging
 */
function fillReferenceNumbersDebug(orderData, fieldStatus) {
    // Fill first reference number with order number
    if (fieldStatus.referenceNumber?.available) {
        const field = fieldStatus.referenceNumber.element;
        field.value = orderData.reference_number || '';
        triggerInputEvent(field);
        debugLog(`Filled Reference Number: "${orderData.reference_number || ''}"`);
    } else {
        debugLog('WARNING: Reference Number field not available');
    }
    
    // Fill second reference number with order ID
    if (fieldStatus.referenceNumber2?.available) {
        const field = fieldStatus.referenceNumber2.element;
        field.value = orderData.id ? `VEEQO-${orderData.id}` : '';
        triggerInputEvent(field);
        debugLog(`Filled Reference Number 2: "${orderData.id ? `VEEQO-${orderData.id}` : ''}"`);
    } else {
        debugLog('WARNING: Reference Number 2 field not available');
    }
}

// Include all the utility functions from the main auto-fill script
function parseCustomerName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', middleInitial: '', lastName: '' };
    }
    
    const nameParts = fullName.trim().split(/\s+/);
    
    if (nameParts.length === 1) {
        return { firstName: nameParts[0], middleInitial: '', lastName: '' };
    } else if (nameParts.length === 2) {
        return { firstName: nameParts[0], middleInitial: '', lastName: nameParts[1] };
    } else if (nameParts.length === 3) {
        return { 
            firstName: nameParts[0], 
            middleInitial: nameParts[1].charAt(0).toUpperCase(), 
            lastName: nameParts[2] 
        };
    } else {
        return {
            firstName: nameParts[0],
            middleInitial: nameParts.slice(1, -1).map(part => part.charAt(0).toUpperCase()).join(''),
            lastName: nameParts[nameParts.length - 1]
        };
    }
}

function formatStreetAddress(address) {
    const parts = [];
    if (address.address1) parts.push(address.address1);
    if (address.address2) parts.push(address.address2);
    if (address.street) parts.push(address.street);
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    return parts.join(' ').trim();
}

function triggerInputEvent(element) {
    if (element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
}

function showAutoFillSuccess() {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    successDiv.textContent = '✅ Veeqo data auto-filled successfully!';
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

function showAutoFillError(errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    errorDiv.textContent = `❌ Auto-fill error: ${errorMessage}`;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Enhanced initialization with debug panel
 */
function initializeUSPSAutoFillDebug() {
    debugLog('Initializing USPS auto-fill debug mode...');
    
    // Create debug panel
    createDebugPanel();
    
    // Check if we have order data in session storage
    const orderData = sessionStorage.getItem('veeqoOrderData');
    
    if (orderData) {
        try {
            const parsedOrderData = JSON.parse(orderData);
            debugLog('Found order data in session storage:', parsedOrderData);
            
            // Start the enhanced detection process
            waitAndFillFormDebug(parsedOrderData);
            
        } catch (error) {
            debugLog(`ERROR parsing order data: ${error.message}`, error);
        }
    } else {
        debugLog('No order data found in session storage');
    }
}

/**
 * Enhanced form waiting with detailed logging
 */
function waitAndFillFormDebug(orderData, maxAttempts = 20, delay = 1500) {
    let attempts = 0;
    
    const checkAndFill = () => {
        attempts++;
        debugLog(`Form detection attempt ${attempts}/${maxAttempts}`);
        
        const fieldStatus = detectFormFields();
        const requiredFields = ['firstName', 'lastName', 'city'];
        const availableRequiredFields = requiredFields.filter(field => fieldStatus[field]?.available);
        
        if (availableRequiredFields.length === requiredFields.length) {
            debugLog('All required fields found, proceeding with auto-fill...');
            autoFillUSPSFormDebug(orderData);
            return;
        }
        
        if (attempts < maxAttempts) {
            debugLog(`Required fields not ready (${availableRequiredFields.length}/${requiredFields.length}), retrying in ${delay}ms...`);
            setTimeout(checkAndFill, delay);
        } else {
            debugLog('Maximum attempts reached, trying final detection...');
            setTimeout(() => {
                const finalFieldStatus = detectFormFields();
                const finalAvailableFields = requiredFields.filter(field => finalFieldStatus[field]?.available);
                if (finalAvailableFields.length === requiredFields.length) {
                    debugLog('Fields found on final attempt, auto-filling...');
                    autoFillUSPSFormDebug(orderData);
                } else {
                    debugLog('Form fields still not available after all attempts');
                }
            }, 3000);
        }
    };
    
    checkAndFill();
}

// Auto-initialize if we're on a USPS form page
if (window.location.hostname === 'cnsb.usps.com' && window.location.pathname.includes('/new-label/')) {
    debugLog('USPS form page detected, initializing debug mode...');
    
    if (document.readyState === 'complete') {
        initializeUSPSAutoFillDebug();
    } else {
        window.addEventListener('load', initializeUSPSAutoFillDebug);
    }
}
