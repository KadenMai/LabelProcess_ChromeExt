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
        
        // Fill order info display in the second div with type="info"
        fillOrderInfoDisplay(orderData);
        
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
 * Fill order information display in the second div with type="info"
 * @param {Object} orderData - Order data to display
 */
function fillOrderInfoDisplay(orderData) {
    console.log('🔍 Looking for divs with type="info" on USPS page...');
    
    // Find all divs with type="info"
    const infoDivs = document.querySelectorAll('div[type="info"]');
    console.log(`🔍 Found ${infoDivs.length} divs with type="info"`);
    
    if (infoDivs.length < 2) {
        console.log('❌ Need at least 2 divs with type="info", found:', infoDivs.length);
        return;
    }
    
    // Select the second div (index 1)
    const targetDiv = infoDivs[1];
    console.log('✅ Selected second div with type="info":', targetDiv);
    
    // Extract information from order data
    const shippingAddress = orderData.shipping_addresses;
    
    if (!shippingAddress) {
        console.log('❌ No shipping address data available');
        return;
    }
    
    // Build the display content with proper line breaks and spacing
    let displayContent = '';
    
    // Name
    const fullName = `${shippingAddress.first_name || ''} ${shippingAddress.last_name || ''}`.trim();
    if (fullName) {
        displayContent += `<strong>Name: </strong> ${fullName}`;
    }
    
    // Address
    const address1 = shippingAddress.address1 || '';
    const address2 = shippingAddress.address2 || '';
    const city = shippingAddress.city || '';
    const state = shippingAddress.state || '';
    const zip = shippingAddress.zip || '';
    
    const addressParts = [];
    if (address1) addressParts.push(address1);
    if (address2) addressParts.push(address2);
    if (city) addressParts.push(city);
    if (state) addressParts.push(state);
    if (zip) addressParts.push(zip);
    
    if (addressParts.length > 0) {
        displayContent += ` | <strong> Address: </strong> ${addressParts.join(', ')}`;
    }
    
    // Veeqo Rate
    if (orderData.veeqo_shipping_rate) {
        displayContent += ` | <strong> Veeqo Rate: </strong> ${orderData.veeqo_shipping_rate}`;
    }
    
    // Set the content with proper styling
    targetDiv.innerHTML = displayContent;
    targetDiv.style.whiteSpace = 'pre-line'; // Allow line breaks
    targetDiv.style.lineHeight = '1.6'; // Better spacing
    targetDiv.style.fontSize = '14px'; // Ensure readable font size
    
    console.log('✅ Order information filled in second div with type="info" on USPS page');
    console.log('🔍 Content:', displayContent);
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
    // Fill number into referenceNumber field (Reference 1)
    const referenceNumberField = document.getElementById(USPS_FORM_FIELDS.referenceNumber);
    if (referenceNumberField) {
        referenceNumberField.value = orderData.number || '';
        triggerInputEvent(referenceNumberField);
        console.log('Filled Reference Number (Reference 1):', orderData.number || '');
    }
    
    // Fill reference_number into referenceNumber2 field (Reference 2)
    const referenceNumber2Field = document.getElementById(USPS_FORM_FIELDS.referenceNumber2);
    if (referenceNumber2Field) {
        referenceNumber2Field.value = orderData.reference_number || '';
        triggerInputEvent(referenceNumber2Field);
        console.log('Filled Reference Number 2 (Reference 2):', orderData.reference_number || '');
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
            'button[type="submit"]'
        ];
        
        for (const selector of alternativeSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                // Look for button with "Get Rates" or "Rates" text
                for (const btn of buttons) {
                    const text = btn.textContent?.trim() || btn.value || '';
                    if (text.toLowerCase().includes('rate') || text.toLowerCase().includes('get')) {
                        getRatesButton = btn;
                        console.log('✅ Found Get Rates button with selector:', selector, 'text:', text);
                        break;
                    }
                }
                if (getRatesButton) break;
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
            const disabled = btn.disabled;
            console.log(`🔍 Button ${index + 1}: id="${id}", text="${text}", class="${className}", disabled=${disabled}`);
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
        visible: getRatesButton.offsetParent !== null,
        display: window.getComputedStyle(getRatesButton).display
    });
    
    if (getRatesButton.disabled) {
        console.log('⚠️ Get Rates button is disabled, waiting and retrying...');
        // Wait a bit and check again
        setTimeout(() => {
            if (!getRatesButton.disabled) {
                console.log('✅ Button is now enabled');
            }
        }, 1000);
        return false;
    }
    
    if (getRatesButton.offsetParent === null) {
        console.log('⚠️ Get Rates button is not visible, trying to click anyway...');
    }
    
    try {
        console.log('🔍 Attempting to click Get Rates button...');
        
        // Try multiple click methods
        // Method 1: Direct click
        getRatesButton.click();
        console.log('✅ Direct click() called');
        
        // Method 2: MouseEvent
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });
        getRatesButton.dispatchEvent(clickEvent);
        console.log('✅ MouseEvent dispatched');
        
        // Method 3: Focus and Enter key
        if (getRatesButton.focus) {
            getRatesButton.focus();
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            });
            getRatesButton.dispatchEvent(enterEvent);
            console.log('✅ Enter key event dispatched');
        }
        
        console.log('✅ Get Rates button click attempts completed');
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
    
    // Use dynamic detection instead of fixed delays
    waitForUSPSPageReady();
    
    // Also try to add the Update USPS E-price button (with retry mechanism)
    // This will keep trying until the target element is found
    let buttonRetryCount = 0;
    const maxButtonRetries = 50; // Try for 5 seconds (50 * 100ms)
    
    const buttonRetryInterval = setInterval(() => {
        buttonRetryCount++;
        const targetElement = document.querySelector('.d-flex.justify-content-between.mb-5');
        
        if (targetElement) {
            clearInterval(buttonRetryInterval);
            addUpdateUSPSEpriceButton();
        } else if (buttonRetryCount >= maxButtonRetries) {
            clearInterval(buttonRetryInterval);
            console.log('⚠️ Could not find target element for Update USPS E-price button after max retries');
        }
    }, 100); // Check every 100ms
}

/**
 * Wait for USPS page to be ready using dynamic detection
 */
function waitForUSPSPageReady() {
    console.log('🔍 Starting dynamic USPS page readiness detection...');
    
    // Check if page is ready right now
    if (isUSPSPageReady()) {
        console.log('✅ USPS page is already ready, initializing immediately');
        initializeUSPSAutoFill();
        addUpdateUSPSEpriceButton();
        return;
    }
    
    // Set up dynamic monitoring
    let checkCount = 0;
    const maxChecks = 100; // Maximum checks (about 10 seconds)
    
    const checkInterval = setInterval(() => {
        checkCount++;
        console.log(`🔍 Checking USPS page readiness (${checkCount}/${maxChecks})...`);
        
        if (isUSPSPageReady()) {
            console.log('✅ USPS page is now ready, initializing auto-fill');
            clearInterval(checkInterval);
            initializeUSPSAutoFill();
            addUpdateUSPSEpriceButton();
        } else if (checkCount >= maxChecks) {
            console.log('❌ Max checks reached, USPS page may not be ready');
            clearInterval(checkInterval);
            // Still try to add the button even if page readiness check fails
            addUpdateUSPSEpriceButton();
        }
    }, 100); // Check every 100ms
}

/**
 * Check if USPS page is ready for auto-fill
 * @returns {boolean} True if page is ready
 */
function isUSPSPageReady() {
    // Check for essential USPS form elements
    const requiredElements = [
        'firstName',
        'lastName', 
        'city',
        'streetAddress1',
        'quick-flow-state',
        'zipCode'
    ];
    
    const foundElements = requiredElements.map(id => {
        const element = document.getElementById(id);
        return { id, found: !!element, visible: element && element.offsetParent !== null };
    });
    
    const allFound = foundElements.every(el => el.found);
    const allVisible = foundElements.every(el => el.visible);
    
    // Also check if page has finished loading
    const pageLoaded = document.readyState === 'complete';
    
    // Check for USPS-specific indicators
    const hasUSPSContent = document.querySelector('[data-testid*="form"]') || 
                          document.querySelector('.form-control') ||
                          document.querySelector('input[type="text"]');
    
    const isReady = allFound && allVisible && pageLoaded && hasUSPSContent;
    
    if (!isReady) {
        console.log('🔍 Page readiness check:', {
            allFound,
            allVisible, 
            pageLoaded,
            hasUSPSContent,
            elements: foundElements
        });
    }
    
    return isReady;
}

/**
 * Add "Update USPS E-price" button to the page
 */
function addUpdateUSPSEpriceButton() {
    // Check if button already exists
    if (document.getElementById('update-usps-eprice-btn')) {
        console.log('Update USPS E-price button already exists');
        return;
    }

    // Find the target element with class "d-flex justify-content-between mb-5"
    const targetElement = document.querySelector('.d-flex.justify-content-between.mb-5');
    
    if (!targetElement) {
        console.log('Target element not found, retrying in 1 second...');
        // Retry after 1 second in case the element hasn't loaded yet
        setTimeout(addUpdateUSPSEpriceButton, 1000);
        return;
    }

    console.log('✅ Found target element, adding Update USPS E-price button');

    // Create the button
    const button = document.createElement('button');
    button.id = 'update-usps-eprice-btn';
    button.textContent = 'Update USPS E-price';
    button.className = 'btn btn-primary';
    button.style.cssText = `
        background: #007bff;
        color: white;
        border: 1px solid #007bff;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
        margin-left: 10px;
    `;

    // Add hover effect
    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#0056b3';
    });

    button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#007bff';
    });

    // Add click event listener
    button.addEventListener('click', handleUpdateUSPSEpriceClick);

    // Append the button to the target element
    targetElement.appendChild(button);
    console.log('✅ Update USPS E-price button added successfully');
}

/**
 * Handle click event for Update USPS E-price button
 */
async function handleUpdateUSPSEpriceClick() {
    console.log('🔄 Update USPS E-price button clicked - Processing ALL orders');
    
    try {
        // Disable button and show loading state
        const button = document.getElementById('update-usps-eprice-btn');
        const originalText = button.textContent;
        button.textContent = 'Processing...';
        button.disabled = true;
        button.style.backgroundColor = '#6c757d';

        // Step 1: Get API key
        const apiKey = await new Promise((resolve, reject) => {
            chrome.storage.sync.get(['veeqoApiKey'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (result.veeqoApiKey) {
                    resolve(result.veeqoApiKey);
                } else {
                    reject(new Error('Veeqo API key not configured. Please set it in extension settings.'));
                }
            });
        });

        console.log('✅ Retrieved API key');

        // Step 2: Fetch ALL orders from Veeqo API with pagination (all pages)
        console.log('🔍 Fetching ALL orders from Veeqo API with pagination (will fetch all pages)...');
        const allOrders = await fetchAllOrdersWithPagination(apiKey, {
            page_size: 100,
            status: 'awaiting_fulfillment'
        });
        
        console.log(`✅ Fetched ${allOrders.length} total orders from all pages`);

        if (allOrders.length === 0) {
            throw new Error('No orders found to process');
        }

        // Step 3: Filter orders that have empty/null employee_notes
        const ordersToProcess = [];
        for (const order of allOrders) {
            const employeeNotes = order.employee_notes || [];
            const hasNotes = employeeNotes.some(note => note && note.text && note.text.trim() !== '');
            
            if (!hasNotes) {
                ordersToProcess.push(order);
            }
        }

        console.log(`📊 Found ${ordersToProcess.length} orders without employee notes out of ${allOrders.length} total orders`);

        if (ordersToProcess.length === 0) {
            alert('✅ All orders already have employee notes. No orders to process.');
            button.textContent = originalText;
            button.disabled = false;
            button.style.backgroundColor = '#007bff';
            return;
        }

        // Step 4: Process each order
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < ordersToProcess.length; i++) {
            const order = ordersToProcess[i];
            const orderNumber = order.number || order.sales_record_number || order.id;
            
            console.log(`\n🔄 Processing order ${i + 1}/${ordersToProcess.length}: ${orderNumber} (ID: ${order.id})`);
            button.textContent = `Processing ${i + 1}/${ordersToProcess.length}...`;

            try {
                // Process order data to match the structure expected by form filling functions
                console.log('🔍 Processing order data to match expected structure...');
                const processedOrderData = processOrderDataForUSPS(order);
                console.log('✅ Processed order data:', processedOrderData);
                
                // Fill form with processed order data
                console.log('🔍 Filling form with order data...');
                await fillFormWithOrderData(processedOrderData);

                // Wait a moment for form to be fully processed
                console.log('🔍 Waiting for form to be fully processed...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Click Get Rates button
                console.log('🔍 Attempting to click Get Rates button...');
                let ratesClicked = false;
                let attempts = 0;
                const maxAttempts = 5;
                
                while (!ratesClicked && attempts < maxAttempts) {
                    attempts++;
                    console.log(`🔍 Get Rates button attempt ${attempts}/${maxAttempts}...`);
                    ratesClicked = clickGetRatesButton();
                    
                    if (!ratesClicked) {
                        console.log(`⚠️ Get Rates button click failed, waiting 500ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.log('✅ Get Rates button clicked successfully');
                    }
                }
                
                if (!ratesClicked) {
                    throw new Error('Failed to click Get Rates button after multiple attempts');
                }

                // Wait for rates to load (longer wait for rates to appear)
                console.log('🔍 Waiting for rates to load...');
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Extract price from first available shipping option
                console.log('🔍 Waiting for rates to load...');
                const price = await waitForFirstAvailablePrice();

                if (!price) {
                    throw new Error('Could not find any shipping option price');
                }

                console.log(`✅ Extracted price for order ${orderNumber}: $${price}`);

                // Update order with internal note
                const internalNote = `"E-Price":${price}`;
                console.log('🔍 Updating order with internal note:', internalNote);

                const updateResponse = await chrome.runtime.sendMessage({
                    action: 'updateVeeqoOrder_InternalNote',
                    apiKey: apiKey,
                    orderId: order.id,
                    internalNote: internalNote
                });

                if (!updateResponse || !updateResponse.success) {
                    throw new Error('Failed to update order: ' + (updateResponse?.error || 'Unknown error'));
                }

                console.log(`✅ Order ${orderNumber} updated successfully with E-price: $${price}`);
                successCount++;

                // Wait a bit before processing next order
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`❌ Error processing order ${orderNumber}:`, error);
                errorCount++;
                errors.push(`${orderNumber}: ${error.message}`);
            }
        }

        // Show summary
        const summary = `✅ Processing Complete!\n\n` +
                       `Total Orders: ${allOrders.length}\n` +
                       `Processed: ${successCount}\n` +
                       `Errors: ${errorCount}\n` +
                       (errors.length > 0 ? `\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}` : '');

        alert(summary);
        console.log('📊 Final Summary:', { total: allOrders.length, success: successCount, errors: errorCount });

        // Restore button state
        button.textContent = originalText;
        button.disabled = false;
        button.style.backgroundColor = '#007bff';

    } catch (error) {
        console.error('❌ Error updating USPS E-price:', error);
        alert('❌ Error: ' + error.message);

        // Restore button state
        const button = document.getElementById('update-usps-eprice-btn');
        if (button) {
            button.textContent = 'Update USPS E-price';
            button.disabled = false;
            button.style.backgroundColor = '#007bff';
        }
    }
}

/**
 * Process order data from API to match the structure expected by form filling functions
 * @param {Object} apiOrder - Raw order data from Veeqo API
 * @returns {Object} Processed order data with correct structure
 */
function processOrderDataForUSPS(apiOrder) {
    // Extract allocation_package from allocations array
    let allocationPackage = null;
    if (apiOrder.allocations && apiOrder.allocations.length > 0) {
        allocationPackage = apiOrder.allocations[0].allocation_package;
    }
    
    // Get SKU codes for reference_number formatting
    const skuCodes = apiOrder.line_items?.map(item => item.sellable?.sku_code).filter(Boolean) || [];
    const quantityToShip = '1'; // Default, can be extracted from HTML if needed
    
    // Format reference_number as: {quantity_to_ship} x {sku_codes}
    const formattedReferenceNumber = skuCodes.length > 0 
        ? `${quantityToShip} x ${skuCodes.join(', ')}`
        : quantityToShip;
    
    // Extract customer note if available
    let customerNote = null;
    if (apiOrder.customer_note && apiOrder.customer_note.text) {
        customerNote = apiOrder.customer_note.text;
    }
    
    // Create the processed data structure matching what processOrderData creates
    return {
        deliver_to: apiOrder.delivery_method?.name || null,
        sku_codes: skuCodes,
        allocation_package: allocationPackage,
        line_items: apiOrder.line_items || [],
        shipping_addresses: apiOrder.deliver_to || null, // This is the key - deliver_to becomes shipping_addresses
        customer: apiOrder.customer || null,
        customer_note: customerNote,
        sales_record_number: apiOrder.sales_record_number || apiOrder.number,
        reference_number: formattedReferenceNumber,
        id: apiOrder.id,
        number: apiOrder.number || null,
        status: apiOrder.status || null,
        total_price: apiOrder.total_price || null,
        currency_code: apiOrder.currency_code || null,
        veeqo_shipping_rate: null,
        quantity_to_ship: quantityToShip
    };
}

/**
 * Fill form with order data (clears and fills fresh) - Direct synchronous approach
 * @param {Object} orderData - Order data to fill
 */
async function fillFormWithOrderData(orderData) {
    // Reset auto-fill flags to allow filling again
    autoFillCompleted = false;
    autoFillInProgress = false;
    
    console.log('🔄 Reset auto-fill flags, ready to fill form for new order');

    // Clear existing form data first
    const fieldsToClear = [
        USPS_FORM_FIELDS.firstName,
        USPS_FORM_FIELDS.lastName,
        USPS_FORM_FIELDS.company,
        USPS_FORM_FIELDS.streetAddress1,
        'address2AptSuite',
        USPS_FORM_FIELDS.city,
        USPS_FORM_FIELDS.state,
        USPS_FORM_FIELDS.zipCode,
        USPS_FORM_FIELDS.referenceNumber,
        USPS_FORM_FIELDS.referenceNumber2
    ];

    fieldsToClear.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = '';
            triggerInputEvent(field);
        }
    });

    // Also clear package fields if they exist
    const packageFields = ['weightLbs', 'weight', 'length', 'width', 'height', 'packageTypeDropdown'];
    packageFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
            triggerInputEvent(field);
        }
    });

    // Wait a moment for fields to clear
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fill form fields directly and synchronously
    console.log('🔍 Filling form fields directly...');
    
    // Fill customer information
    fillCustomerInformation(orderData);
    
    // Fill shipping address
    fillShippingAddress(orderData);
    
    // Fill reference numbers
    fillReferenceNumbers(orderData);
    
    // Fill package information directly (synchronously)
    const allocationPackage = orderData.allocation_package;
    if (allocationPackage) {
        console.log('🔍 Filling package information...');
        
        // Fill weight
        const weightFieldIds = ['weightLbs', 'weight', 'packageWeight', 'weight-lbs'];
        for (const fieldId of weightFieldIds) {
            const weightField = document.getElementById(fieldId);
            if (weightField && allocationPackage.weight) {
                const weightOz = parseFloat(allocationPackage.weight) || 0;
                const weightLbs = Math.floor(weightOz / 16);
                weightField.value = weightLbs.toString();
                triggerInputEvent(weightField);
                console.log('✅ Filled Weight:', weightLbs, 'lbs');
                break;
            }
        }
        
        // Fill dimensions
        const dimensionFields = [
            { key: 'depth', ids: ['length', 'packageLength', 'length-in', 'lengthIn'] },
            { key: 'width', ids: ['width', 'packageWidth', 'width-in', 'widthIn'] },
            { key: 'height', ids: ['height', 'packageHeight', 'height-in', 'heightIn'] }
        ];
        
        dimensionFields.forEach(({ key, ids }) => {
            for (const fieldId of ids) {
                const field = document.getElementById(fieldId);
                if (field && allocationPackage[key]) {
                    const value = parseFloat(allocationPackage[key]) || 0;
                    field.value = value.toString();
                    triggerInputEvent(field);
                    if (key === 'depth') {
                        console.log('✅ Filled Length:', value);
                    } else {
                        console.log(`✅ Filled ${key}:`, value);
                    }
                    break;
                }
            }
        });
    } else {
        console.log('⚠️ No allocation_package data found in order');
    }
    
    // Select package type (if needed)
    try {
        await selectPackageType();
        await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
        console.log('⚠️ Package type selection failed, continuing anyway:', error);
    }

    // Wait a moment for all fields to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify form is filled
    const firstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
    const lastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
    
    if (!firstNameField || !firstNameField.value) {
        throw new Error('First name field is not filled');
    }
    
    if (!lastNameField || !lastNameField.value) {
        throw new Error('Last name field is not filled');
    }
    
    console.log('✅ Form filled successfully');
    console.log('✅ First Name:', firstNameField.value);
    console.log('✅ Last Name:', lastNameField.value);
}

/**
 * Fetch all orders from Veeqo API with pagination
 * @param {string} apiKey - Veeqo API key
 * @param {Object} baseParams - Base parameters for the API request
 * @returns {Promise<Array>} Array of all orders from all pages
 */
async function fetchAllOrdersWithPagination(apiKey, baseParams = {}) {
    const allOrders = [];
    let page = 1;
    let hasMorePages = true;
    
    console.log('🔍 Starting paginated order fetch...');
    
    while (hasMorePages) {
        try {
            console.log(`🔍 Fetching page ${page}...`);
            
            const response = await chrome.runtime.sendMessage({
                action: 'fetchVeeqoOrders',
                apiKey: apiKey,
                params: {
                    ...baseParams,
                    page: page,
                    page_size: 100
                }
            });
            
            if (!response || !response.success) {
                console.error(`❌ Failed to fetch page ${page}:`, response?.error);
                break;
            }
            
            // Parse response data
            let pageOrders = [];
            if (Array.isArray(response.data)) {
                pageOrders = response.data;
            } else if (response.data?.orders) {
                pageOrders = response.data.orders;
            } else if (response.data?.results) {
                pageOrders = response.data.results;
            } else if (response.data?.data) {
                pageOrders = Array.isArray(response.data.data) ? response.data.data : response.data.data.orders || [];
            }
            
            console.log(`✅ Page ${page}: Fetched ${pageOrders.length} orders`);
            
            if (pageOrders.length === 0) {
                // No more orders, stop pagination
                hasMorePages = false;
                console.log(`✅ Reached end of orders at page ${page}`);
            } else {
                // Add orders from this page to the total
                allOrders.push(...pageOrders);
                page++;
            }
            
        } catch (error) {
            console.error(`❌ Error fetching page ${page}:`, error);
            break;
        }
    }
    
    console.log(`✅ Pagination complete: Fetched ${allOrders.length} total orders from ${page - 1} page(s)`);
    return allOrders;
}

/**
 * Fetch order data from form fields and Veeqo API
 * @returns {Promise<Object|null>} Order data or null if not found
 */
async function fetchOrderDataFromForm() {
    try {
        // Get order number from referenceNumber field
        const referenceNumberField = document.getElementById(USPS_FORM_FIELDS.referenceNumber);
        if (!referenceNumberField || !referenceNumberField.value) {
            console.log('❌ Reference number field is empty');
            return null;
        }

        const orderNumber = referenceNumberField.value.trim();
        console.log('🔍 Found order number in form:', orderNumber);

        if (!orderNumber) {
            return null;
        }

        // Get API key
        const apiKey = await new Promise((resolve, reject) => {
            chrome.storage.sync.get(['veeqoApiKey'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (result.veeqoApiKey) {
                    resolve(result.veeqoApiKey);
                } else {
                    reject(new Error('Veeqo API key not configured'));
                }
            });
        });

        // Fetch orders from Veeqo API to find the order (with pagination)
        console.log('🔍 Fetching orders from Veeqo API to find order:', orderNumber);
        const orders = await fetchAllOrdersWithPagination(apiKey, {
            page_size: 100,
            status: 'awaiting_fulfillment'
        });
        
        console.log(`🔍 Fetched ${orders.length} orders from API`);

        // Find the order by number or sales_record_number
        const order = orders.find(o => 
            o.number === orderNumber || 
            o.sales_record_number === orderNumber ||
            String(o.id) === orderNumber
        );

        if (!order) {
            console.log('❌ Order not found in fetched orders');
            // Try fetching by ID if orderNumber is numeric
            if (/^\d+$/.test(orderNumber)) {
                console.log('🔍 Trying to fetch order by ID:', orderNumber);
                const orderByIdResponse = await chrome.runtime.sendMessage({
                    action: 'fetchOrderById',
                    apiKey: apiKey,
                    orderId: parseInt(orderNumber)
                });

                if (orderByIdResponse && orderByIdResponse.success) {
                    console.log('✅ Found order by ID');
                    return orderByIdResponse.data;
                }
            }
            return null;
        }

        console.log('✅ Found order in API response:', order.id);
        return order;

    } catch (error) {
        console.error('❌ Error fetching order data from form:', error);
        return null;
    }
}

/**
 * Ensure form is filled with order data
 * @param {Object} orderData - Order data to fill
 */
async function ensureFormFilled(orderData) {
    // Check if form fields are already filled
    const firstNameField = document.getElementById(USPS_FORM_FIELDS.firstName);
    const lastNameField = document.getElementById(USPS_FORM_FIELDS.lastName);
    
    if (firstNameField && firstNameField.value && lastNameField && lastNameField.value) {
        console.log('✅ Form already filled');
        return;
    }

    // Form not filled, trigger auto-fill
    console.log('🔍 Form not filled, triggering auto-fill...');
    autoFillUSPSForm(orderData);
    
    // Wait for form to be filled (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (firstNameField && firstNameField.value && lastNameField && lastNameField.value) {
            console.log('✅ Form filled successfully');
            return;
        }
        
        attempts++;
    }
    
    throw new Error('Form could not be filled within timeout');
}

/**
 * Wait for rate card to appear and extract price
 * @param {string} rateId - The ID of the rate card element
 * @returns {Promise<string|null>} The extracted price or null if not found
 */
async function waitForRateAndExtractPrice(rateId) {
    const maxAttempts = 50; // Wait up to 10 seconds (50 * 200ms)
    let attempts = 0;

    while (attempts < maxAttempts) {
        // Look for the rate card element
        const rateCard = document.getElementById(rateId);
        
        if (rateCard) {
            console.log('✅ Found rate card:', rateId);
            
            // Extract price from the card
            const price = extractPriceFromCard(rateCard);
            if (price) {
                return price;
            }
            
            console.log('⚠️ Rate card found but could not extract price');
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
    }
    
    console.log('❌ Rate card not found after max attempts');
    return null;
}

/**
 * Extract price from a shipping option card
 * @param {HTMLElement} card - The shipping option card element
 * @returns {string|null} The extracted price or null if not found
 */
function extractPriceFromCard(card) {
    // Try multiple selectors to find the price element
    const priceSelectors = [
        '.text-end p.fs-12.fw-bold.text-primary',
        '.text-end p.text-primary',
        '.text-end p.fw-bold',
        '.col-md-4 p.fs-12.fw-bold.text-primary',
        '.col-md-4 p.fs-12.fw-bold',
        '.col-md-4 p'
    ];
    
    let priceElement = null;
    for (const selector of priceSelectors) {
        priceElement = card.querySelector(selector);
        if (priceElement) {
            console.log('✅ Found price element with selector:', selector);
            break;
        }
    }
    
    if (priceElement) {
        const priceText = priceElement.textContent.trim();
        console.log('🔍 Found price text:', priceText);
        
        // Extract numeric value (remove $ and any whitespace)
        const priceMatch = priceText.match(/\$?\s*([\d.]+)/);
        if (priceMatch && priceMatch[1]) {
            const price = priceMatch[1];
            console.log('✅ Extracted price:', price);
            return price;
        }
    }
    
    // Alternative: search for any price text in the card (look for $X.XX pattern)
    const allText = card.textContent;
    const priceMatch = allText.match(/\$\s*([\d.]+)/);
    if (priceMatch && priceMatch[1]) {
        const price = priceMatch[1];
        console.log('✅ Extracted price (alternative method):', price);
        return price;
    }
    
    return null;
}

/**
 * Wait for shipping options section and extract price from first available option
 * @returns {Promise<string|null>} The extracted price or null if not found
 */
async function waitForFirstAvailablePrice() {
    const maxAttempts = 50; // Wait up to 10 seconds (50 * 200ms)
    let attempts = 0;

    while (attempts < maxAttempts) {
        // Look for the shipping options section
        const shippingSection = document.querySelector('section[aria-label="shipping-options"]');
        
        if (shippingSection) {
            console.log('✅ Found shipping options section');
            
            // Find all shipping option cards (divs with class containing "card")
            const rateCards = shippingSection.querySelectorAll('div.card, div[class*="card"]');
            console.log(`🔍 Found ${rateCards.length} shipping option cards`);
            
            // Get the first card in the list
            if (rateCards.length > 0) {
                const firstCard = rateCards[0];
                console.log(`🔍 Using first card (${firstCard.id || 'no-id'}):`, firstCard);
                
                const price = extractPriceFromCard(firstCard);
                if (price) {
                    console.log(`✅ Extracted price from first card:`, price);
                    return price;
                } else {
                    console.log('⚠️ First card found but could not extract price');
                }
            } else {
                console.log('⚠️ No shipping option cards found');
            }
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
    }
    
    console.log('❌ Shipping options section not found after max attempts');
    return null;
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
