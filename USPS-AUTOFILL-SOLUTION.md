# 📮 USPS Form Auto-Fill Solution

## 🎯 **Problem Solved**

**User Request**: Automatically fill USPS label forms with customer information and shipping addresses from Veeqo orders.

**Specific Requirements**:
- Fill customer information: **First Name**, **MI**, **Last Name** (use "." if empty), **Company**
- Fill shipping address: **City** first, then **Street Address**, then **ZipCode**
- Use order data from Veeqo API integration

## 🔧 **Technical Implementation**

### **1. USPS Form Field Analysis**

From the USPS page structure (`samples/USPS.com-New Label.mhtml`), identified these form field IDs:

```javascript
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
    
    // Reference Numbers
    referenceNumber: 'referenceNumber',
    referenceNumber2: 'referenceNumber2'
};
```

### **2. Auto-Fill Script** (`js/usps-autofill.js`)

#### **Core Auto-Fill Function**:
```javascript
function autoFillUSPSForm(orderData) {
    // Fill customer information
    fillCustomerInformation(orderData);
    
    // Fill shipping address (City first, then Street Address, then ZipCode)
    fillShippingAddress(orderData);
    
    // Fill reference numbers
    fillReferenceNumbers(orderData);
}
```

#### **Customer Information Filling**:
```javascript
function fillCustomerInformation(orderData) {
    const customer = orderData.customer || {};
    const customerName = customer.name || '';
    
    // Parse customer name into components
    const nameParts = parseCustomerName(customerName);
    
    // Fill First Name
    document.getElementById('firstName').value = nameParts.firstName;
    
    // Fill Middle Initial
    document.getElementById('middleInitial').value = nameParts.middleInitial;
    
    // Fill Last Name (use "." if empty as requested)
    document.getElementById('lastName').value = nameParts.lastName || '.';
    
    // Fill Company
    document.getElementById('company').value = customer.company || '';
}
```

#### **Shipping Address Filling** (in requested order):
```javascript
function fillShippingAddress(orderData) {
    const shippingAddress = orderData.shipping_address || orderData.delivery_address || {};
    
    // 1. Fill City FIRST (as requested)
    document.getElementById('city').value = shippingAddress.city || '';
    
    // 2. Fill Street Address SECOND
    const address = formatStreetAddress(shippingAddress);
    document.getElementById('streetAddress1').value = address;
    
    // 3. Fill Zip Code LAST (as requested)
    document.getElementById('zipCode').value = shippingAddress.postal_code || shippingAddress.zip_code || '';
}
```

### **3. Enhanced USPS Functions** (`js/usps-functions.js`)

#### **Order Data Storage and Transfer**:
```javascript
function goToUSPS(orderData = null) {
    // Store order data in session storage for USPS page access
    if (orderData) {
        sessionStorage.setItem('veeqoOrderData', JSON.stringify(orderData));
    }
    
    // Open USPS tab with order data
    chrome.runtime.sendMessage({
        action: 'openUSPSTab',
        url: USPS_LABEL_MANAGER_URL,
        orderData: orderData
    }, (response) => {
        // Inject auto-fill script into new tab
        if (orderData && response.tabId) {
            setTimeout(() => {
                injectUSPSAutoFillScript(response.tabId, orderData);
            }, 2000);
        }
    });
}
```

### **4. Background Script Integration** (`js/background.js`)

#### **USPS Auto-Fill Injection Handler**:
```javascript
async function handleInjectUSPSAutoFill(request, sender, sendResponse) {
    const { tabId, orderData } = request;
    
    // Store order data in USPS page session storage
    if (orderData) {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (data) => {
                sessionStorage.setItem('veeqoOrderData', JSON.stringify(data));
            },
            args: [orderData]
        });
    }
    
    // Inject the USPS auto-fill script
    await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['js/usps-autofill.js']
    });
}
```

### **5. Manifest Configuration** (`manifest.json`)

#### **Content Script for USPS Pages**:
```json
{
  "content_scripts": [
    {
      "matches": ["*://cnsb.usps.com/*"],
      "js": ["js/usps-autofill.js"],
      "run_at": "document_end"
    }
  ]
}
```

## 🎯 **How It Works**

### **Complete Workflow**:

1. **User clicks USPS button** on Veeqo allocations table
2. **Order data is stored** in session storage
3. **USPS page opens** in new tab
4. **Auto-fill script is injected** into USPS page
5. **Form fields are automatically filled** with customer and shipping data
6. **User can immediately create label** with pre-filled information

### **Data Flow**:

```
Veeqo Page → USPS Button Click → Order Data Storage → USPS Page → Auto-Fill Script → Form Fields Filled
```

## 📊 **Form Field Mapping**

| **USPS Field** | **Veeqo Data Source** | **Special Handling** |
|----------------|----------------------|---------------------|
| **First Name** | `customer.name` (parsed) | First part of full name |
| **MI** | `customer.name` (parsed) | Middle initial(s) |
| **Last Name** | `customer.name` (parsed) | Last part, or "." if empty |
| **Company** | `customer.company` | Direct mapping |
| **City** | `shipping_address.city` | Filled FIRST |
| **Street Address** | `shipping_address.address1` | Filled SECOND |
| **Zip Code** | `shipping_address.postal_code` | Filled LAST |
| **Reference #1** | `order.reference_number` | Order number |
| **Reference #2** | `order.id` | VEEQO-{order_id} |

## 🔍 **Name Parsing Logic**

```javascript
function parseCustomerName(fullName) {
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
        // Multiple middle names - combine initials
        return {
            firstName: nameParts[0],
            middleInitial: nameParts.slice(1, -1).map(part => part.charAt(0).toUpperCase()).join(''),
            lastName: nameParts[nameParts.length - 1]
        };
    }
}
```

## 🚀 **Features**

### **✅ Automatic Form Filling**:
- **Customer Information**: First Name, MI, Last Name, Company
- **Shipping Address**: City, Street Address, Zip Code
- **Reference Numbers**: Order number and Veeqo ID
- **Smart Name Parsing**: Handles various name formats
- **Fallback Values**: Uses "." for empty last names

### **✅ Intelligent Field Detection**:
- **Waits for form fields** to be available
- **Retries mechanism** if fields not ready
- **Event triggering** to notify form of changes
- **Error handling** with graceful fallbacks

### **✅ Cross-Page Data Transfer**:
- **Session storage** for data persistence
- **Script injection** into USPS pages
- **Order data preservation** across page loads
- **Automatic cleanup** after use

## 🧪 **Testing**

### **Test Page**: `test-usps-autofill.html`
- **Form Preview**: Visual representation of USPS form
- **Auto-Fill Test**: Test with sample data
- **Real Data Test**: Test with actual Veeqo orders
- **Simulation**: Complete workflow simulation

### **Test Commands**:
```javascript
// Test auto-fill with sample data
autoFillUSPSForm(sampleOrderData);

// Test with real order data
const realOrderData = await fetchVeeqoOrders();
autoFillUSPSForm(realOrderData);

// Simulate complete workflow
simulateUSPSButton();
```

## 📁 **Files Created/Modified**

### **New Files**:
- ✅ `js/usps-autofill.js` - Core auto-fill functionality
- ✅ `test-usps-autofill.html` - Testing page
- ✅ `USPS-AUTOFILL-SOLUTION.md` - Documentation

### **Modified Files**:
- ✅ `js/usps-functions.js` - Enhanced with order data passing
- ✅ `js/background.js` - Added USPS auto-fill injection handler
- ✅ `manifest.json` - Added USPS content script

## 🎉 **Result**

**Before**: Manual form filling on USPS page
**After**: Automatic form filling with customer and shipping data

### **User Experience**:
1. **Click USPS button** on Veeqo allocations table
2. **USPS page opens** with form already filled
3. **Review and submit** label creation
4. **No manual data entry** required

### **Data Accuracy**:
- ✅ **Customer names** properly parsed and formatted
- ✅ **Shipping addresses** correctly mapped
- ✅ **Order references** automatically included
- ✅ **Fallback values** for missing data

## 🔧 **Configuration**

### **Field Order** (as requested):
1. **City** - Filled first
2. **Street Address** - Filled second  
3. **Zip Code** - Filled last

### **Name Handling** (as requested):
- **First Name**: First part of customer name
- **MI**: Middle initial(s)
- **Last Name**: Last part, or "." if empty
- **Company**: Customer company name

The USPS form auto-fill functionality is now fully integrated and ready to use! 🚀
