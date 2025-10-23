/**
 * USPS Form Auto-Fill Functionality
 * Automatically fills customer information and shipping addresses in USPS label forms
 */

// Prevent duplicate script execution
if (window.veeqoUSPSAutoFillLoaded) {
    console.log('USPS auto-fill script already loaded, skipping...');
} else {
    window.veeqoUSPSAutoFillLoaded = true;
    
    // Flag to prevent multiple auto-fill executions
    let autoFillInProgress = false;
    
    // Flag to prevent any auto-fill after one has completed successfully
    let autoFillCompleted = false;

// USPS form field IDs (extracted from the USPS page structure)
const USPS_FORM_FIELDS = {
    // Customer Information
    firstName: 'firstName',
    lastName: 'lastName',
    company: 'company',
    
    // Shipping Address
    streetAddress1: 'streetAddress1',
    city: 'city',
    state: 'quick-flow-state',
    zipCode: 'zipCode',
    
    // Reference fields
    referenceNumber: 'referenceNumber',
    referenceNumber2: 'referenceNumber2',
    
    // Package information
    packageTypeDropdown: 'packageTypeDropdown',
    weightLbs: 'weightLbs',
    length: 'length',
    width: 'width',
    height: 'height',
    getRatesButton: 'getRatesButton'
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
    
    // Prevent auto-fill if one has already completed successfully
    if (autoFillCompleted) {
        console.log('🔍 Auto-fill already completed successfully, skipping...');
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
        
        // Debug: Check if package data exists
        console.log('🔍 Checking package data availability...');
        console.log('🔍 Order data keys:', Object.keys(orderData));
        console.log('🔍 Has allocation_package:', !!orderData.allocation_package);
        if (orderData.allocation_package) {
            console.log('🔍 Package data:', orderData.allocation_package);
        }
        
        // Try package type selection first, then fill package information
        console.log('🔍 Attempting package type selection...');
        selectPackageType().then((success) => {
            console.log('🔍 Package type selection result:', success);
            
            // Wait a moment for package type selection to take effect, then fill package info
            setTimeout(() => {
                console.log('🔍 Attempting direct package information filling...');
                console.log('🔍 Function exists:', typeof fillPackageInformationDirectly);
                console.log('🔍 About to call fillPackageInformationDirectly...');
                try {
                    fillPackageInformationDirectly(orderData);
                    console.log('🔍 fillPackageInformationDirectly completed');
                    
                    // Click Get Rates button after package information is filled
                    setTimeout(() => {
                        console.log('🔍 Clicking Get Rates button after package info filled...');
                        clickGetRatesButton();
                    }, 1000);
                } catch (error) {
                    console.log('❌ Error in fillPackageInformationDirectly:', error);
                }
            }, 500);
        }).catch((error) => {
            console.log('❌ Package type selection error:', error);
            // Still try to fill package information even if package type selection fails
            console.log('🔍 Attempting direct package information filling anyway...');
            try {
                fillPackageInformationDirectly(orderData);
                console.log('🔍 fillPackageInformationDirectly completed');
                
                // Click Get Rates button after package information is filled
                setTimeout(() => {
                    console.log('🔍 Clicking Get Rates button after package info filled (fallback)...');
                    clickGetRatesButton();
                }, 1000);
            } catch (error) {
                console.log('❌ Error in fillPackageInformationDirectly:', error);
            }
        });
        
        console.log('USPS form auto-fill completed successfully');
        
        // Mark auto-fill as completed to prevent future executions
        autoFillCompleted = true;
        
        // Reset the auto-fill flag
        autoFillInProgress = false;
        
        // Show a visual indicator that auto-fill was successful
        showAutoFillSuccess();
        
    } catch (error) {
        console.error('Error auto-filling USPS form:', error);
        
        // Reset the auto-fill flag
        autoFillInProgress = false;
        
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
    const shippingAddress = orderData.shipping_addresses || {};
    
    // Fill First Name from shipping_addresses.first_name
    const firstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
    if (firstNameField) {
        const firstName = shippingAddress.first_name || '';
        firstNameField.value = firstName;
        triggerInputEvent(firstNameField);
        console.log('Filled First Name:', firstName);
    }
    
    // Fill Last Name from shipping_addresses.last_name (use "." if empty as requested)
    const lastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
    if (lastNameField) {
        const lastName = shippingAddress.last_name || '.';
        lastNameField.value = lastName;
        triggerInputEvent(lastNameField);
        console.log('Filled Last Name:', lastName);
    }
    
    // Fill Company from shipping_addresses.company
    const companyField = document.getElementById(USPS_FORM_FIELDS.company);
    if (companyField) {
        const company = shippingAddress.company || '';
        companyField.value = company;
        triggerInputEvent(companyField);
        console.log('Filled Company:', company);
    }
}

/**
 * Fill shipping address fields
 * @param {Object} orderData - Order data containing shipping address
 */
function fillShippingAddress(orderData) {
    const shippingAddress = orderData.shipping_addresses || orderData.deliver_to || {};
    
    // Parse the address to separate main address from apt/suite
    const addressComponents = formatStreetAddress(shippingAddress);
    
    // Fill Street Address 1 (main address)
    const streetAddressField = document.getElementById(USPS_FORM_FIELDS.streetAddress1);
    if (streetAddressField) {
        streetAddressField.value = addressComponents.mainAddress;
        triggerInputEvent(streetAddressField);
        console.log('Filled Street Address 1:', addressComponents.mainAddress);
        
        // Wait a moment for USPS to potentially show address suggestions
        console.log('Waiting for USPS address suggestions to appear...');
        setTimeout(() => {
            handleAddressSuggestions(shippingAddress);
        }, 2000);
    }
    
    // Fill Address 2 (apartment/suite/floor) if available
    if (addressComponents.aptSuite) {
        const address2Field = document.getElementById('address2AptSuite');
        if (address2Field) {
            address2Field.value = addressComponents.aptSuite;
            triggerInputEvent(address2Field);
            console.log('Filled Address 2 (Apt/Suite):', addressComponents.aptSuite);
        } else {
            console.log('Address 2 field not found with ID: address2AptSuite');
        }
    } else {
        console.log('No apartment/suite information found in address');
    }
}

/**
 * Handle USPS address suggestions dropdown
 * @param {Object} shippingAddress - Shipping address data
 */
function handleAddressSuggestions(shippingAddress) {
    console.log('🔍 Checking for address suggestions...');
    
    // Look for all elements with id="streetAddress1" (there should be 2: input and dropdown)
    const allStreetAddressElements = document.querySelectorAll('#streetAddress1');
    console.log('🔍 Found', allStreetAddressElements.length, 'elements with id="streetAddress1"');
    
    // Find the dropdown menu (second element, with class "rbt-menu")
    let suggestionsDiv = null;
    allStreetAddressElements.forEach((element, index) => {
        console.log(`🔍 Element ${index + 1}:`, element.tagName, element.className);
        if (element.classList.contains('rbt-menu') || element.classList.contains('dropdown-menu')) {
            suggestionsDiv = element;
            console.log('✅ Found dropdown menu at index:', index + 1);
        }
    });
    
    if (suggestionsDiv) {
        console.log('🔍 Suggestions div classes:', suggestionsDiv.className);
        console.log('🔍 Suggestions div has "show" class:', suggestionsDiv.classList.contains('show'));
        console.log('🔍 Suggestions div style display:', suggestionsDiv.style.display);
        console.log('🔍 Suggestions div innerHTML:', suggestionsDiv.innerHTML.substring(0, 200) + '...');
    }
    
    if (suggestionsDiv && suggestionsDiv.classList.contains('show')) {
        console.log('✅ Found address suggestions dropdown');
        
        // Look for dropdown items (anchor tags with class="dropdown-item")
        const suggestionLinks = suggestionsDiv.querySelectorAll('a.dropdown-item');
        const targetZipCode = (shippingAddress.zip || '').substring(0, 5);
        
        console.log('🔍 Looking for suggestions with zip code:', targetZipCode);
        console.log('🔍 Found', suggestionLinks.length, 'suggestion links');
        
        // Find the suggestion that contains our zip code
        let matchingSuggestion = null;
        suggestionLinks.forEach((link, index) => {
            const linkText = link.textContent || '';
            console.log(`🔍 Suggestion ${index + 1}:`, linkText);
            
            // Check if the suggestion ends with our zip code
            if (linkText.trim().endsWith(targetZipCode)) {
                matchingSuggestion = link;
                console.log('✅ Found matching suggestion:', linkText);
            }
        });
        
        if (matchingSuggestion) {
            console.log('🎯 Clicking matching address suggestion');
            matchingSuggestion.click();
            return; // Exit early since USPS will auto-fill state and zip
        } else {
            console.log('❌ No matching suggestion found, proceeding with manual fill');
        }
    } else {
        console.log('❌ No address suggestions dropdown found, proceeding with manual fill');
        
        // Log all elements with similar IDs for debugging
        const alternativeDropdowns = document.querySelectorAll('[id*="streetAddress1"]');
        console.log('🔍 Alternative dropdowns found:', alternativeDropdowns.length);
        alternativeDropdowns.forEach((dropdown, index) => {
            console.log(`🔍 Alternative dropdown ${index + 1}:`, dropdown.id, dropdown.className);
        });
    }
    
    // If no suggestions or no match found, fill manually
    console.log('🔍 Proceeding with manual state and zip fill...');
    fillStateAndZipManually(shippingAddress);
}

/**
 * Fill state and zip code manually when no suggestions are available
 * @param {Object} shippingAddress - Shipping address data
 */
function fillStateAndZipManually(shippingAddress) {
    // Fill City
    const cityField = document.getElementById(USPS_FORM_FIELDS.city);
    if (cityField) {
        cityField.value = shippingAddress.city || '';
        triggerInputEvent(cityField);
        console.log('Filled City:', shippingAddress.city || '');
    }
    
    // Fill State (convert to 2-letter code and select from dropdown)
    const stateField = document.getElementById(USPS_FORM_FIELDS.state);
    console.log('🔍 State field found:', !!stateField);
    console.log('🔍 State field ID:', USPS_FORM_FIELDS.state);
    console.log('🔍 State field element:', stateField);
    
    if (stateField) {
        const originalState = shippingAddress.state || shippingAddress.province || '';
        const stateCode = convertStateToCode(originalState);
        console.log('🔍 Original state:', originalState);
        console.log('🔍 Converted state code:', stateCode);
        
        if (stateCode) {
            // Find and select the option with the matching value
            const option = stateField.querySelector(`option[value="${stateCode}"]`);
            console.log('🔍 State option found:', !!option);
            console.log('🔍 State option element:', option);
            
            if (option) {
                stateField.value = stateCode;
                triggerInputEvent(stateField);
                console.log('✅ Filled State:', stateCode);
            } else {
                console.log('❌ State option not found for code:', stateCode);
                // Log all available options for debugging
                const allOptions = stateField.querySelectorAll('option');
                console.log('🔍 Available state options:', allOptions.length);
                allOptions.forEach((opt, index) => {
                    console.log(`🔍 Option ${index + 1}:`, opt.value, opt.textContent);
                });
            }
        } else {
            console.log('❌ No state code generated from:', originalState);
        }
    } else {
        console.log('❌ State field not found with ID:', USPS_FORM_FIELDS.state);
    }
    
    // Fill Zip Code (first 5 digits)
    const zipCodeField = document.getElementById(USPS_FORM_FIELDS.zipCode);
    if (zipCodeField) {
        const zipCode = (shippingAddress.zip || '').substring(0, 5);
        zipCodeField.value = zipCode;
        triggerInputEvent(zipCodeField);
        console.log('Filled Zip Code (first 5 digits):', zipCode);
    }
}

/**
 * Fill reference numbers with order information
 * @param {Object} orderData - Order data
 */
function fillReferenceNumbers(orderData) {
    // Fill reference_number into referenceNumber field
    const referenceNumberField = document.getElementById(USPS_FORM_FIELDS.referenceNumber);
    if (referenceNumberField) {
        referenceNumberField.value = orderData.reference_number || '';
        triggerInputEvent(referenceNumberField);
        console.log('Filled Reference Number:', orderData.reference_number || '');
    }
    
    // Fill number into referenceNumber2 field
    const referenceNumber2Field = document.getElementById(USPS_FORM_FIELDS.referenceNumber2);
    if (referenceNumber2Field) {
        referenceNumber2Field.value = orderData.number || '';
        triggerInputEvent(referenceNumber2Field);
        console.log('Filled Reference Number 2:', orderData.number || '');
    }
}

/**
 * Select package type from dropdown
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
// Flag to prevent multiple package type selections
let packageTypeSelectionInProgress = false;

function selectPackageType() {
    return new Promise((resolve) => {
        // Prevent multiple simultaneous executions
        if (packageTypeSelectionInProgress) {
            console.log('🔍 Package type selection already in progress, skipping...');
            resolve(false);
            return;
        }
        
        packageTypeSelectionInProgress = true;
        console.log('🔍 Looking for package type dropdown...');
        
        const packageTypeDropdown = document.getElementById(USPS_FORM_FIELDS.packageTypeDropdown);
        if (!packageTypeDropdown) {
            console.log('❌ Package type dropdown not found');
            packageTypeSelectionInProgress = false;
            resolve(false);
            return;
        }
        
        console.log('✅ Found package type dropdown');
        
        // Click the dropdown to open it
        const dropdownButton = packageTypeDropdown.querySelector('button');
        if (dropdownButton) {
            console.log('🔍 Clicking dropdown button to open menu...');
            dropdownButton.click();
            
            // Wait for dropdown to open, then select the second option
            setTimeout(() => {
                console.log('🔍 Looking for dropdown menu options...');
                
                // Find all dropdown items (anchor tags)
                const dropdownItems = packageTypeDropdown.querySelectorAll('a.dropdown-item');
                console.log('🔍 Found', dropdownItems.length, 'dropdown items');
                
                if (dropdownItems.length >= 2) {
                    // Select the second option (index 1): "I am shipping with my own package"
                    const secondOption = dropdownItems[1];
                    console.log('🔍 Selecting second option:', secondOption.textContent?.trim());
                    secondOption.click();
                    console.log('✅ Package type selected successfully');
                    packageTypeSelectionInProgress = false;
                    resolve(true);
                } else {
                    console.log('❌ Not enough dropdown options found');
                    packageTypeSelectionInProgress = false;
                    resolve(false);
                }
            }, 500); // Wait 500ms for dropdown to open
        } else {
            console.log('❌ Dropdown button not found');
            packageTypeSelectionInProgress = false;
            resolve(false);
        }
    });
}

/**
 * Fill package information directly (simplified approach)
 * @param {Object} orderData - Order data containing allocation_package
 */
function fillPackageInformationDirectly(orderData) {
    console.log('🔍 Starting direct package information filling...');
    console.log('🔍 Order data:', orderData);
    
    const allocationPackage = orderData.allocation_package;
    
    if (!allocationPackage) {
        console.log('❌ No allocation_package data found');
        console.log('🔍 Available order data keys:', Object.keys(orderData));
        return;
    }
    
    console.log('✅ Package data found:', allocationPackage);
    console.log('🔍 Package data keys:', Object.keys(allocationPackage));
    console.log('🔍 Weight value:', allocationPackage.weight);
    console.log('🔍 Length value:', allocationPackage.length);
    console.log('🔍 Width value:', allocationPackage.width);
    console.log('🔍 Height value:', allocationPackage.height);
    console.log('🔍 Depth value:', allocationPackage.depth);
    
    // Debug: List all input fields on the page to help identify correct IDs
    console.log('🔍 All input fields on page:');
    const allInputs = document.querySelectorAll('input, select, textarea');
    allInputs.forEach((input, index) => {
        if (input.id && (input.id.includes('length') || input.id.includes('width') || input.id.includes('height') || input.id.includes('weight') || input.id.includes('package'))) {
            console.log(`🔍 Input ${index + 1}: id="${input.id}", type="${input.type}", tag="${input.tagName}"`);
        }
    });
    
    // Try multiple field ID variations for weight
    const weightFieldIds = ['weightLbs', 'weight', 'packageWeight', 'weight-lbs'];
    let weightField = null;
    
    for (const fieldId of weightFieldIds) {
        weightField = document.getElementById(fieldId);
        if (weightField) {
            console.log('✅ Found weight field with ID:', fieldId);
            break;
        }
    }
    
    if (weightField && allocationPackage.weight) {
        // Convert weight from oz to lbs (divide by 16)
        const weightOz = parseFloat(allocationPackage.weight) || 0;
        const weightLbs = Math.floor(weightOz / 16);
        weightField.value = weightLbs.toString();
        triggerInputEvent(weightField);
        console.log('✅ Filled Weight (lbs):', weightLbs, '(converted from', weightOz, 'oz)');
    } else {
        console.log('❌ Weight field not found or no weight data available');
        console.log('🔍 Tried field IDs:', weightFieldIds);
    }
    
    // Try multiple field ID variations for dimensions
    const dimensionFields = [
        { key: 'depth', ids: ['length', 'packageLength', 'length-in', 'lengthIn', 'package_length', 'packageLengthIn', 'lengthInches'] }, // Use depth as length
        { key: 'width', ids: ['width', 'packageWidth', 'width-in', 'widthIn', 'package_width', 'packageWidthIn', 'widthInches'] },
        { key: 'height', ids: ['height', 'packageHeight', 'height-in', 'heightIn', 'package_height', 'packageHeightIn', 'heightInches'] }
    ];
    
    dimensionFields.forEach(({ key, ids }) => {
        let field = null;
        
        for (const fieldId of ids) {
            field = document.getElementById(fieldId);
            if (field) {
                console.log(`✅ Found ${key} field with ID:`, fieldId);
                break;
            }
        }
        
        if (field && allocationPackage[key]) {
            const value = parseFloat(allocationPackage[key]) || 0;
            field.value = value.toString();
            triggerInputEvent(field);
            if (key === 'depth') {
                console.log(`✅ Filled length (using depth):`, value);
            } else {
                console.log(`✅ Filled ${key}:`, value);
            }
        } else {
            if (key === 'depth') {
                console.log(`❌ length field not found or no depth data available`);
            } else {
                console.log(`❌ ${key} field not found or no ${key} data available`);
            }
            console.log(`🔍 Tried field IDs:`, ids);
        }
    });
}

/**
 * Fill package information (weight and dimensions)
 * @param {Object} orderData - Order data containing allocation_package
 */
function fillPackageInformation(orderData) {
    console.log('🔍 Starting fillPackageInformation...');
    console.log('🔍 Order data:', orderData);
    
    const allocationPackage = orderData.allocation_package;
    
    if (!allocationPackage) {
        console.log('❌ No allocation_package data found');
        console.log('🔍 Available order data keys:', Object.keys(orderData));
        return;
    }
    
    console.log('✅ Package data found:', allocationPackage);
    console.log('🔍 Package data keys:', Object.keys(allocationPackage));
    
    // Fill Weight (lbs)
    const weightField = document.getElementById(USPS_FORM_FIELDS.weightLbs);
    console.log('🔍 Weight field found:', !!weightField);
    console.log('🔍 Weight field ID:', USPS_FORM_FIELDS.weightLbs);
    console.log('🔍 Weight field element:', weightField);
    console.log('🔍 Weight data available:', !!allocationPackage.weight);
    console.log('🔍 Weight value:', allocationPackage.weight);
    
    if (weightField && allocationPackage.weight) {
        // Convert weight from oz to lbs (divide by 16)
        const weightOz = parseFloat(allocationPackage.weight) || 0;
        const weightLbs = Math.floor(weightOz / 16);
        weightField.value = weightLbs.toString();
        triggerInputEvent(weightField);
        console.log('✅ Filled Weight (lbs):', weightLbs, '(converted from', weightOz, 'oz)');
    } else {
        console.log('❌ Weight field not found or no weight data available');
        if (!weightField) {
            console.log('❌ Weight field element not found');
        }
        if (!allocationPackage.weight) {
            console.log('❌ No weight data in allocation_package');
        }
    }
    
    // Fill Length
    const lengthField = document.getElementById(USPS_FORM_FIELDS.length);
    if (lengthField && allocationPackage.length) {
        const length = parseFloat(allocationPackage.length) || 0;
        lengthField.value = length.toString();
        triggerInputEvent(lengthField);
        console.log('Filled Length:', length);
    } else {
        console.log('Length field not found or no length data available');
    }
    
    // Fill Width
    const widthField = document.getElementById(USPS_FORM_FIELDS.width);
    if (widthField && allocationPackage.width) {
        const width = parseFloat(allocationPackage.width) || 0;
        widthField.value = width.toString();
        triggerInputEvent(widthField);
        console.log('Filled Width:', width);
    } else {
        console.log('Width field not found or no width data available');
    }
    
    // Fill Height
    const heightField = document.getElementById(USPS_FORM_FIELDS.height);
    if (heightField && allocationPackage.height) {
        const height = parseFloat(allocationPackage.height) || 0;
        heightField.value = height.toString();
        triggerInputEvent(heightField);
        console.log('Filled Height:', height);
    } else {
        console.log('Height field not found or no height data available');
    }
}

/**
 * Click the "Get Rates" button after filling all package information
 */
function clickGetRatesButton() {
    console.log('🔍 Looking for Get Rates button...');
    console.log('🔍 Searching for ID:', USPS_FORM_FIELDS.getRatesButton);
    
    // Try multiple ways to find the button
    let getRatesButton = document.getElementById(USPS_FORM_FIELDS.getRatesButton);
    
    if (!getRatesButton) {
        console.log('🔍 Button not found with exact ID, trying alternative selectors...');
        
        // Try alternative selectors
        const alternativeSelectors = [
            'button[id*="getRates"]',
            'button[id*="rates"]',
            'button[class*="get-rates"]',
            'button[class*="rates"]',
            'input[type="submit"][id*="rates"]',
            'button:contains("Get Rates")',
            'button:contains("Get rates")',
            'button:contains("Rates")'
        ];
        
        for (const selector of alternativeSelectors) {
            try {
                getRatesButton = document.querySelector(selector);
                if (getRatesButton) {
                    console.log('✅ Found Get Rates button with selector:', selector);
                    break;
                }
            } catch (error) {
                console.log('🔍 Selector failed:', selector, error.message);
            }
        }
    }
    
    if (!getRatesButton) {
        // List all buttons on the page to help debug
        console.log('🔍 Listing all buttons on the page:');
        const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
        allButtons.forEach((btn, index) => {
            const id = btn.id || 'no-id';
            const text = btn.textContent?.trim() || btn.value || 'no-text';
            const className = btn.className || 'no-class';
            console.log(`🔍 Button ${index + 1}: id="${id}", text="${text}", class="${className}"`);
        });
        
        console.log('❌ Get Rates button not found with any method');
        return false;
    }
    
    console.log('✅ Found Get Rates button:', getRatesButton);
    console.log('🔍 Button details:', {
        id: getRatesButton.id,
        text: getRatesButton.textContent?.trim(),
        className: getRatesButton.className,
        disabled: getRatesButton.disabled,
        visible: getRatesButton.offsetParent !== null
    });
    
    if (getRatesButton.disabled) {
        console.log('⚠️ Get Rates button is disabled, cannot click');
        return false;
    }
    
    if (getRatesButton.offsetParent === null) {
        console.log('⚠️ Get Rates button is not visible, trying to click anyway...');
    }
    
    try {
        console.log('🔍 Clicking Get Rates button...');
        getRatesButton.click();
        console.log('✅ Get Rates button clicked successfully');
        
        // Also try dispatching a click event as backup
        setTimeout(() => {
            console.log('🔍 Dispatching additional click event...');
            getRatesButton.dispatchEvent(new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            }));
        }, 100);
        
        return true;
    } catch (error) {
        console.log('❌ Error clicking Get Rates button:', error);
        return false;
    }
}

/**
 * Convert state name to 2-letter state code
 * @param {string} stateName - Full state name
 * @returns {string} 2-letter state code
 */
function convertStateToCode(stateName) {
    if (!stateName || typeof stateName !== 'string') {
        return '';
    }
    
    const stateMap = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
        'District of Columbia': 'DC'
    };
    
    // Check if it's already a 2-letter code
    if (stateName.length === 2) {
        const upperState = stateName.toUpperCase();
        // Check if the 2-letter code exists in the state map values
        if (Object.values(stateMap).includes(upperState)) {
            return upperState;
        }
    }
    
    // Convert full state name to code
    const normalizedState = stateName.trim();
    return stateMap[normalizedState] || '';
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
/**
 * Parse and separate main address from apartment/suite/floor information
 * @param {string} fullAddress - The complete address string
 * @returns {Object} Object with mainAddress and aptSuite properties
 */
function parseAddressComponents(fullAddress) {
    if (!fullAddress || typeof fullAddress !== 'string') {
        return { mainAddress: '', aptSuite: '' };
    }
    
    const address = fullAddress.trim();
    
    // Common patterns for apartment/suite/floor indicators
    const aptSuitePatterns = [
        // Apartment patterns
        /\b(apt|apartment|apt\.|apt\s+[a-z0-9]+)\b/i,
        /\b(unit|unit\s+[a-z0-9]+)\b/i,
        /\b(suite|ste|ste\.|suite\s+[a-z0-9]+)\b/i,
        /\b(floor|fl|fl\.|floor\s+[a-z0-9]+)\b/i,
        /\b(room|rm|rm\.|room\s+[a-z0-9]+)\b/i,
        /\b(office|ofc|ofc\.|office\s+[a-z0-9]+)\b/i,
        /\b(building|bldg|bldg\.|building\s+[a-z0-9]+)\b/i,
        // Number patterns (common for apartments)
        /\b#\s*[a-z0-9]+\b/i,
        /\b[a-z0-9]+\s*#\b/i,
        // Common separators
        /\s*,\s*(apt|apartment|suite|ste|unit|floor|fl|room|rm|office|ofc|building|bldg|#)\s*[a-z0-9]*/i,
        /\s*-\s*(apt|apartment|suite|ste|unit|floor|fl|room|rm|office|ofc|building|bldg|#)\s*[a-z0-9]*/i
    ];
    
    // Find the first match
    let match = null;
    let matchIndex = -1;
    
    for (const pattern of aptSuitePatterns) {
        const found = address.match(pattern);
        if (found && (matchIndex === -1 || found.index < matchIndex)) {
            match = found;
            matchIndex = found.index;
        }
    }
    
    if (match && matchIndex >= 0) {
        const mainAddress = address.substring(0, matchIndex).trim();
        const aptSuite = address.substring(matchIndex).trim();
        
        // Clean up the apt/suite part (remove leading comma, dash, etc.)
        const cleanedAptSuite = aptSuite.replace(/^[,\-\s]+/, '').trim();
        
        return {
            mainAddress: mainAddress,
            aptSuite: cleanedAptSuite
        };
    }
    
    // No apartment/suite found, return the full address as main
    return {
        mainAddress: address,
        aptSuite: ''
    };
}

function formatStreetAddress(address) {
    const parts = [];
    
    if (address.address1) parts.push(address.address1);
    if (address.address2) parts.push(address.address2);
    if (address.street) parts.push(address.street);
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    
    const fullAddress = parts.join(' ').trim();
    
    // Parse the address to separate main address from apt/suite
    return parseAddressComponents(fullAddress);
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
function waitAndFillForm(orderData, maxAttempts = 30, delay = 2000) {
    // Prevent multiple simultaneous executions
    if (autoFillInProgress) {
        console.log('🔍 Auto-fill already in progress, skipping...');
        return;
    }
    
    // Prevent auto-fill if one has already completed successfully
    if (autoFillCompleted) {
        console.log('🔍 Auto-fill already completed successfully, skipping waitAndFillForm...');
        return;
    }
    
    autoFillInProgress = true;
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
            // Add a longer delay to ensure form is fully interactive
            setTimeout(() => autoFillUSPSForm(orderData), 1500);
            return;
        }
        
        if (attempts < maxAttempts) {
            console.log(`Form fields not ready, attempt ${attempts}/${maxAttempts}, retrying in ${delay}ms...`);
            console.log('Form status:', {
                firstName: !!firstNameField,
                lastName: !!lastNameField,
                city: !!cityField,
                formContainer: !!formContainer,
                firstNameVisible: firstNameField ? firstNameField.offsetParent !== null : false,
                pageTitle: document.title,
                url: window.location.href
            });
            setTimeout(checkAndFill, delay);
        } else {
            console.log('Form fields not found after maximum attempts');
            console.log('Available form elements on page:', {
                allInputs: document.querySelectorAll('input').length,
                allSelects: document.querySelectorAll('select').length,
                allForms: document.querySelectorAll('form').length,
                pageHTML: document.body.innerHTML.substring(0, 500) + '...'
            });
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
                    console.log('Available IDs on page:', Array.from(document.querySelectorAll('[id]')).map(el => el.id).slice(0, 20));
                    
                    // Reset the auto-fill flag
                    autoFillInProgress = false;
                }
            }, 5000);
        }
    };
    
    checkAndFill();
}

/**
 * Initialize USPS auto-fill functionality
 * This function should be called when the USPS page loads
 */
// Flag to prevent multiple initializations
let initializationInProgress = false;

function initializeUSPSAutoFill() {
    // Prevent multiple initializations
    if (initializationInProgress) {
        console.log('🔍 USPS auto-fill initialization already in progress, skipping...');
        return;
    }
    
    initializationInProgress = true;
    console.log('Initializing USPS auto-fill functionality');
    
    // Check if we have a data key in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const veeqoKey = urlParams.get('veeqoKey');
    
    if (veeqoKey) {
        console.log('Found data key in URL parameters:', veeqoKey);
        
        // Clean up the URL by removing the parameter
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        console.log('Cleaned URL:', cleanUrl);
        
        // Fetch order data from chrome.storage.local
        chrome.storage.local.get([veeqoKey], (result) => {
            if (result[veeqoKey]) {
                console.log('Retrieved order data from chrome.storage.local:', result[veeqoKey]);
                processOrderData(JSON.stringify(result[veeqoKey]));
                
                // Clean up the stored data after use
                chrome.storage.local.remove([veeqoKey], () => {
                    console.log('Cleaned up order data from storage');
                });
            } else {
                console.log('No order data found in chrome.storage.local for key:', veeqoKey);
            }
        });
        initializationInProgress = false;
        return;
    }
    
    // Fallback: Check session storage (for backward compatibility)
    const sessionData = sessionStorage.getItem('veeqoOrderData');
    if (sessionData) {
        console.log('Found order data in session storage (fallback)');
        processOrderData(sessionData);
        initializationInProgress = false;
        return;
    }
    
    console.log('No order data found in URL key or session storage');
    initializationInProgress = false;
}

/**
 * Process the order data and start auto-fill
 * @param {string} orderData - JSON string of order data
 */
function processOrderData(orderData) {
    try {
        const parsedOrderData = JSON.parse(orderData);
        console.log('Found order data in session storage:', parsedOrderData);
            
            // Wait for page to be fully loaded
            if (document.readyState === 'complete') {
                // Page is already loaded, wait 3 seconds before starting form detection
                console.log('Document already loaded, waiting 3 seconds before starting form detection...');
                setTimeout(() => waitAndFillForm(parsedOrderData), 3000);
            } else {
                // Wait for page to finish loading
                window.addEventListener('load', () => {
                    console.log('Page load event fired, waiting 3 seconds before starting form detection...');
                    setTimeout(() => waitAndFillForm(parsedOrderData), 3000);
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
                    // Check if auto-fill is already in progress or completed
                    if (!autoFillInProgress && !autoFillCompleted) {
                        setTimeout(() => autoFillUSPSForm(orderData), 1000);
                    } else {
                        console.log('🔍 Auto-fill already in progress or completed, skipping DOM observer trigger...');
                    }
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
        // Add a small delay to ensure the page is fully loaded
        setTimeout(initializeUSPSAutoFill, 100);
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

} // End of duplicate prevention check
