/**
 * USPS Form Auto-Fill Functionality
 * Automatically fills customer information and shipping addresses in USPS label forms
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

/**
 * Auto-fill USPS form with order data
 * @param {Object} orderData - Order data from Veeqo API
 */
function autoFillUSPSForm(orderData) {
    console.log('Auto-filling USPS form with order data:', orderData);
    
    if (!orderData) {
        console.log('No order data provided for auto-fill');
        return;
    }
    
    try {
        // Check if form fields are actually available before attempting to fill
        const firstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
        const lastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
        
        if (!firstNameField || !lastNameField) {
            console.log('Form fields not yet available, skipping auto-fill');
            return;
        }
        
        console.log('Form fields confirmed available, proceeding with auto-fill...');
        
        // Fill customer information
        fillCustomerInformation(orderData);
        
        // Fill shipping address
        fillShippingAddress(orderData);
        
        // Fill reference numbers
        fillReferenceNumbers(orderData);
        
        console.log('USPS form auto-fill completed successfully');
        
        // Show a visual indicator that auto-fill was successful
        showAutoFillSuccess();
        
    } catch (error) {
        console.error('Error auto-filling USPS form:', error);
        showAutoFillError(error.message);
    }
}

/**
 * Show a success indicator for auto-fill
 */
function showAutoFillSuccess() {
    // Create a temporary success message
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

/**
 * Show an error indicator for auto-fill
 * @param {string} errorMessage - Error message to display
 */
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
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Fill customer information fields
 * @param {Object} orderData - Order data containing customer information
 */
function fillCustomerInformation(orderData) {
    const customer = orderData.customer || {};
    const customerName = customer.name || '';
    
    // Parse customer name
    const nameParts = parseCustomerName(customerName);
    
    // Fill First Name
    const firstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
    if (firstNameField) {
        firstNameField.value = nameParts.firstName;
        triggerInputEvent(firstNameField);
        console.log('Filled First Name:', nameParts.firstName);
    }
    
    // Fill Middle Initial
    const middleInitialField = document.getElementById(USPS_FORM_FIELDS.middleInitial);
    if (middleInitialField) {
        middleInitialField.value = nameParts.middleInitial;
        triggerInputEvent(middleInitialField);
        console.log('Filled Middle Initial:', nameParts.middleInitial);
    }
    
    // Fill Last Name (use "." if empty as requested)
    const lastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
    if (lastNameField) {
        lastNameField.value = nameParts.lastName || '.';
        triggerInputEvent(lastNameField);
        console.log('Filled Last Name:', nameParts.lastName || '.');
    }
    
    // Fill Company
    const companyField = document.getElementById(USPS_FORM_FIELDS.company);
    if (companyField) {
        companyField.value = customer.company || '';
        triggerInputEvent(companyField);
        console.log('Filled Company:', customer.company || '');
    }
}

/**
 * Fill shipping address fields
 * @param {Object} orderData - Order data containing shipping address
 */
function fillShippingAddress(orderData) {
    const shippingAddress = orderData.shipping_address || orderData.delivery_address || {};
    
    // Fill City (first as requested)
    const cityField = document.getElementById(USPS_FORM_FIELDS.city);
    if (cityField) {
        cityField.value = shippingAddress.city || '';
        triggerInputEvent(cityField);
        console.log('Filled City:', shippingAddress.city || '');
    }
    
    // Fill Street Address
    const streetAddressField = document.getElementById(USPS_FORM_FIELDS.streetAddress1);
    if (streetAddressField) {
        const address = formatStreetAddress(shippingAddress);
        streetAddressField.value = address;
        triggerInputEvent(streetAddressField);
        console.log('Filled Street Address:', address);
    }
    
    // Fill Apt/Suite if available
    const aptSuiteField = document.getElementById(USPS_FORM_FIELDS.address2AptSuite);
    if (aptSuiteField && shippingAddress.address2) {
        aptSuiteField.value = shippingAddress.address2;
        triggerInputEvent(aptSuiteField);
        console.log('Filled Apt/Suite:', shippingAddress.address2);
    }
    
    // Fill Zip Code (last as requested)
    const zipCodeField = document.getElementById(USPS_FORM_FIELDS.zipCode);
    if (zipCodeField) {
        zipCodeField.value = shippingAddress.postal_code || shippingAddress.zip_code || '';
        triggerInputEvent(zipCodeField);
        console.log('Filled Zip Code:', shippingAddress.postal_code || shippingAddress.zip_code || '');
    }
}

/**
 * Fill reference numbers with order information
 * @param {Object} orderData - Order data
 */
function fillReferenceNumbers(orderData) {
    // Fill first reference number with order number
    const referenceNumberField = document.getElementById(USPS_FORM_FIELDS.referenceNumber);
    if (referenceNumberField) {
        referenceNumberField.value = orderData.reference_number || '';
        triggerInputEvent(referenceNumberField);
        console.log('Filled Reference Number:', orderData.reference_number || '');
    }
    
    // Fill second reference number with order ID
    const referenceNumber2Field = document.getElementById(USPS_FORM_FIELDS.referenceNumber2);
    if (referenceNumber2Field) {
        referenceNumber2Field.value = orderData.id ? `VEEQO-${orderData.id}` : '';
        triggerInputEvent(referenceNumber2Field);
        console.log('Filled Reference Number 2:', orderData.id ? `VEEQO-${orderData.id}` : '');
    }
}

/**
 * Parse customer name into components
 * @param {string} fullName - Full customer name
 * @returns {Object} Parsed name components
 */
function parseCustomerName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return {
            firstName: '',
            middleInitial: '',
            lastName: ''
        };
    }
    
    const nameParts = fullName.trim().split(/\s+/);
    
    if (nameParts.length === 1) {
        return {
            firstName: nameParts[0],
            middleInitial: '',
            lastName: ''
        };
    } else if (nameParts.length === 2) {
        return {
            firstName: nameParts[0],
            middleInitial: '',
            lastName: nameParts[1]
        };
    } else if (nameParts.length === 3) {
        return {
            firstName: nameParts[0],
            middleInitial: nameParts[1].charAt(0).toUpperCase(),
            lastName: nameParts[2]
        };
    } else {
        // More than 3 parts - assume first is first name, last is last name, middle are initials
        return {
            firstName: nameParts[0],
            middleInitial: nameParts.slice(1, -1).map(part => part.charAt(0).toUpperCase()).join(''),
            lastName: nameParts[nameParts.length - 1]
        };
    }
}

/**
 * Format street address from address components
 * @param {Object} address - Address object
 * @returns {string} Formatted street address
 */
function formatStreetAddress(address) {
    const parts = [];
    
    if (address.address1) parts.push(address.address1);
    if (address.address2) parts.push(address.address2);
    if (address.street) parts.push(address.street);
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    
    return parts.join(' ').trim();
}

/**
 * Trigger input event to notify form of changes
 * @param {HTMLElement} element - Input element
 */
function triggerInputEvent(element) {
    if (element) {
        // Trigger various events that forms might listen to
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
}

/**
 * Check if we're on a USPS form page
 * @returns {boolean} True if on USPS form page
 */
function isUSPSFormPage() {
    return window.location.hostname === 'cnsb.usps.com' && 
           window.location.pathname.includes('/new-label/');
}

/**
 * Wait for form fields to be available and then auto-fill
 * @param {Object} orderData - Order data to fill
 * @param {number} maxAttempts - Maximum attempts to find form fields
 * @param {number} delay - Delay between attempts in milliseconds
 */
function waitAndFillForm(orderData, maxAttempts = 20, delay = 1500) {
    let attempts = 0;
    
    const checkAndFill = () => {
        attempts++;
        
        // Check if form fields are available and visible
        const firstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
        const lastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
        const cityField = document.getElementById(USPS_FORM_FIELDS.city);
        
        // Also check if the form container is visible (not hidden by loading states)
        const formContainer = document.querySelector('[data-testid="recipient-form"]') || 
                             document.querySelector('.form-container') ||
                             document.querySelector('form');
        
        const isFormReady = firstNameField && lastNameField && cityField && 
                           firstNameField.offsetParent !== null && // Check if visible
                           lastNameField.offsetParent !== null &&
                           cityField.offsetParent !== null;
        
        if (isFormReady) {
            console.log('USPS form fields found and visible, auto-filling...');
            // Add a small delay to ensure form is fully interactive
            setTimeout(() => autoFillUSPSForm(orderData), 500);
            return;
        }
        
        if (attempts < maxAttempts) {
            console.log(`Form fields not ready, attempt ${attempts}/${maxAttempts}, retrying in ${delay}ms...`);
            console.log('Form status:', {
                firstName: !!firstNameField,
                lastName: !!lastNameField,
                city: !!cityField,
                formContainer: !!formContainer,
                firstNameVisible: firstNameField ? firstNameField.offsetParent !== null : false
            });
            setTimeout(checkAndFill, delay);
        } else {
            console.log('Form fields not found after maximum attempts');
            // Try one more time with a longer delay in case the page is still loading
            setTimeout(() => {
                console.log('Final attempt to find form fields...');
                const finalFirstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
                const finalLastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
                if (finalFirstNameField && finalLastNameField) {
                    console.log('Form fields found on final attempt, auto-filling...');
                    autoFillUSPSForm(orderData);
                } else {
                    console.log('Form fields still not found. Page may not be fully loaded or form structure may have changed.');
                }
            }, 3000);
        }
    };
    
    checkAndFill();
}

/**
 * Initialize USPS auto-fill functionality
 * This function should be called when the USPS page loads
 */
function initializeUSPSAutoFill() {
    console.log('Initializing USPS auto-fill functionality');
    
    // Check if we have order data in session storage
    const orderData = sessionStorage.getItem('veeqoOrderData');
    
    if (orderData) {
        try {
            const parsedOrderData = JSON.parse(orderData);
            console.log('Found order data in session storage:', parsedOrderData);
            
            // Wait for page to be fully loaded
            if (document.readyState === 'complete') {
                // Page is already loaded, start checking for form fields
                waitAndFillForm(parsedOrderData);
            } else {
                // Wait for page to finish loading
                window.addEventListener('load', () => {
                    console.log('Page load event fired, starting form detection...');
                    waitAndFillForm(parsedOrderData);
                });
            }
            
            // Also listen for DOM changes in case the form loads dynamically
            observeFormChanges(parsedOrderData);
            
            // Clear the session storage after use
            setTimeout(() => {
                sessionStorage.removeItem('veeqoOrderData');
            }, 30000); // Clear after 30 seconds
            
        } catch (error) {
            console.error('Error parsing order data from session storage:', error);
        }
    } else {
        console.log('No order data found in session storage');
    }
}

/**
 * Observe DOM changes to detect when form fields are added
 * @param {Object} orderData - Order data to fill
 */
function observeFormChanges(orderData) {
    console.log('Setting up DOM observer for form changes...');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Check if any of the form fields were added
                const addedNodes = Array.from(mutation.addedNodes);
                const hasFormFields = addedNodes.some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return node.querySelector && (
                            node.querySelector(`#${USPS_FORM_FIELDS.firstName}`) ||
                            node.querySelector(`#${USPS_FORM_FIELDS.lastName}`) ||
                            node.querySelector(`#${USPS_FORM_FIELDS.city}`)
                        );
                    }
                    return false;
                });
                
                if (hasFormFields) {
                    console.log('Form fields detected via DOM observer, attempting auto-fill...');
                    setTimeout(() => autoFillUSPSForm(orderData), 1000);
                    observer.disconnect(); // Stop observing once we've filled the form
                }
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Stop observing after 30 seconds to prevent memory leaks
    setTimeout(() => {
        observer.disconnect();
        console.log('DOM observer disconnected after timeout');
    }, 30000);
}

// Auto-initialize if we're on a USPS form page
if (isUSPSFormPage()) {
    console.log('USPS form page detected, initializing auto-fill...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUSPSAutoFill);
    } else {
        initializeUSPSAutoFill();
    }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        autoFillUSPSForm,
        parseCustomerName,
        formatStreetAddress,
        waitAndFillForm,
        initializeUSPSAutoFill,
        isUSPSFormPage
    };
}
