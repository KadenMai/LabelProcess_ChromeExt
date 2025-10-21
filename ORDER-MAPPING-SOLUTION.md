# 🎯 Order Mapping & Customer Data Integration

## 📋 **Problem Solved**

**Original Issue**: USPS buttons needed access to order details, but we only had order numbers (reference numbers) from the allocations table, not the internal Veeqo order IDs required for API calls.

**Solution**: Created a comprehensive order mapping system that:
1. **Maps order numbers to order IDs** using the Veeqo API
2. **Fetches complete order details** including customer information
3. **Enhances USPS buttons** with order data and customer details
4. **Stores order information** for each button click

## 🔧 **Technical Implementation**

### **1. Order Mapping System**

#### **API Functions Added** (`js/veeqo-api.js`):
```javascript
// Create mapping of order numbers to order IDs and details
async function createOrderMapping() {
    const ordersResponse = await fetchOrders({
        page_size: 100,
        status: 'awaiting_fulfillment'
    });
    
    const orderMap = {};
    ordersResponse.orders.forEach(order => {
        if (order.reference_number) {
            orderMap[order.reference_number] = {
                id: order.id,                    // Internal Veeqo ID
                reference_number: order.reference_number,
                customer_id: order.customer?.id,
                customer_name: order.customer?.name,
                customer_email: order.customer?.email,
                line_items: order.line_items,
                delivery_method: order.delivery_method,
                created_at: order.created_at,
                updated_at: order.updated_at
            };
        }
    });
    
    return orderMap;
}

// Get order details by order number
async function getOrderDetailsByNumber(orderNumber) {
    const orderMap = await createOrderMapping();
    return orderMap[orderNumber] || null;
}

// Get order details by order ID
async function getOrderDetailsById(orderId) {
    const response = await chrome.runtime.sendMessage({
        action: 'fetchOrderById',
        apiKey: apiKey,
        orderId: orderId
    });
    
    return response?.success ? response.data : null;
}
```

### **2. Enhanced Background Script** (`js/background.js`):

#### **New Handler for Individual Orders**:
```javascript
async function handleFetchOrderById(request, sender, sendResponse) {
    const { apiKey, orderId } = request;
    
    // Try API proxy first (same-origin requests)
    const proxyResult = await tryApiProxy('fetchOrderById', apiKey, { orderId });
    if (proxyResult) {
        sendResponse(proxyResult);
        return;
    }
    
    // Fallback to direct API call
    const url = `https://api.veeqo.com/orders/${orderId}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        mode: 'cors'
    });
    
    if (response.ok) {
        const data = await response.json();
        sendResponse({ success: true, data: data });
    } else {
        sendResponse({ success: false, error: `Order fetch failed with status: ${response.status}` });
    }
}
```

### **3. Enhanced API Proxy** (`js/api-proxy.js`):

#### **Individual Order Fetching**:
```javascript
async function fetchOrderById(apiKey, orderId) {
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
        return { success: false, error: `Order fetch failed with status: ${response.status}` };
    }
}
```

### **4. Enhanced Content Script** (`js/content-script.js`):

#### **Order Number Extraction**:
```javascript
function extractOrderNumberFromRow(row) {
    const cells = row.querySelectorAll('td');
    
    // Check first few cells for order number patterns
    for (let i = 0; i < Math.min(cells.length, 3); i++) {
        const cellText = cells[i].textContent?.trim();
        if (cellText) {
            // Look for common order number patterns
            const orderMatch = cellText.match(/\b[A-Z0-9]{6,}\b/);
            if (orderMatch) {
                return orderMatch[0];
            }
        }
    }
    
    return null;
}
```

#### **Enhanced Button Creation**:
```javascript
async function addUSPSButtonsToTable(table) {
    // Get order mapping to fetch order details
    let orderMapping = {};
    try {
        orderMapping = await createOrderMapping();
        console.log('Order mapping created with', Object.keys(orderMapping).length, 'orders');
    } catch (error) {
        console.error('Error creating order mapping:', error);
    }

    rows.forEach((row, index) => {
        // Try to get order details for this row
        let orderData = null;
        const orderNumber = extractOrderNumberFromRow(row);
        if (orderNumber && orderMapping[orderNumber]) {
            orderData = orderMapping[orderNumber];
            console.log(`Found order data for ${orderNumber}:`, orderData);
        }
        
        // Create and add the USPS button with order data
        const uspsButton = createUSPSButton(orderData);
        buttonContainer.appendChild(uspsButton);
    });
}
```

### **5. Enhanced USPS Functions** (`js/usps-functions.js`):

#### **Button with Order Data**:
```javascript
function createUSPSButton(orderData = null) {
    const button = document.createElement('button');
    button.textContent = 'USPS';
    button.className = 'usps-label-button';
    button.type = 'button';
    
    // Enhanced title with order information
    button.title = orderData ? 
        `Open USPS Label Manager for Order ${orderData.reference_number}` : 
        'Open USPS Label Manager';
    
    // Store order data as attributes
    if (orderData) {
        button.setAttribute('data-order-id', orderData.id);
        button.setAttribute('data-order-number', orderData.reference_number);
        button.setAttribute('data-customer-id', orderData.customer_id);
        button.setAttribute('data-customer-name', orderData.customer_name);
        button.setAttribute('data-customer-email', orderData.customer_email);
        button.setAttribute('data-item-count', orderData.line_items?.length || 0);
    }
    
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        goToUSPS(orderData);
    });
    
    return button;
}
```

## 🎯 **How It Works**

### **Step 1: Order Mapping Creation**
1. Extension fetches all orders with `awaiting_fulfillment` status
2. Creates a mapping: `order_number → order_details`
3. Stores customer information, order IDs, and other details

### **Step 2: Row Analysis**
1. For each table row, extracts the order number
2. Looks up order details in the mapping
3. Associates order data with the USPS button

### **Step 3: Enhanced Button Creation**
1. Creates USPS button with order data
2. Stores customer information as data attributes
3. Provides rich tooltips and enhanced functionality

### **Step 4: USPS Navigation**
1. Button click passes order data to `goToUSPS()`
2. Order information is available for USPS label creation
3. Customer details can be used for shipping information

## 📊 **Data Available in Each USPS Button**

```javascript
{
    orderId: "12345",                    // Internal Veeqo order ID
    orderNumber: "ORD-2024-001",         // Reference number
    customerId: "67890",                 // Customer ID
    customerName: "John Doe",            // Customer name
    customerEmail: "john@example.com",   // Customer email
    itemCount: 3,                        // Number of line items
    lineItems: [...],                    // Full line items array
    deliveryMethod: {...},               // Delivery method details
    createdAt: "2024-01-15T10:30:00Z",  // Order creation date
    updatedAt: "2024-01-15T11:45:00Z"   // Last update date
}
```

## 🚀 **Benefits**

### **1. Complete Order Context**
- ✅ **Order ID**: Internal Veeqo ID for API calls
- ✅ **Customer Information**: Name, email, ID
- ✅ **Item Details**: Line items and quantities
- ✅ **Shipping Info**: Delivery method and addresses

### **2. Enhanced User Experience**
- ✅ **Rich Tooltips**: Order numbers in button titles
- ✅ **Data Attributes**: All order info stored on button
- ✅ **Smart Matching**: Automatic order number detection
- ✅ **Error Handling**: Graceful fallbacks if data unavailable

### **3. USPS Integration Ready**
- ✅ **Pre-filled Data**: Order details available for USPS forms
- ✅ **Customer Info**: Shipping addresses and contact details
- ✅ **Item Count**: Number of packages to create
- ✅ **Order Tracking**: Link back to Veeqo order

## 🧪 **Testing**

### **Test Page**: `test-order-mapping.html`
- **Order Mapping Test**: Verify order number → order ID mapping
- **Individual Order Test**: Test fetching specific orders by ID
- **Customer Data Test**: View customer information for orders
- **USPS Button Simulation**: Test enhanced button functionality

### **Test Commands**:
```javascript
// Test order mapping
await createOrderMapping();

// Test individual order fetch
await getOrderDetailsById(12345);

// Test order by number
await getOrderDetailsByNumber("ORD-2024-001");
```

## 🔄 **Workflow**

1. **User opens Veeqo allocations page**
2. **Extension loads and creates order mapping**
3. **For each table row:**
   - Extracts order number from row
   - Looks up order details in mapping
   - Creates enhanced USPS button with order data
4. **User clicks USPS button:**
   - Order data is passed to USPS function
   - Customer information is available
   - USPS label manager opens with context

## 🎉 **Result**

**Before**: USPS buttons with no order context
**After**: USPS buttons with complete order and customer information

The extension now provides a seamless workflow from Veeqo order management to USPS label creation with full order context and customer details! 🚀
