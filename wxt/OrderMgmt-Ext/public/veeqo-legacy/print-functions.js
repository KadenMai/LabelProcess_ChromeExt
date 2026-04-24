/**
 * Print Delivery Instructions Functions
 * Handles printing customer notes in 4x6 format
 */

/**
 * Print delivery instructions in 4x6 format
 * @param {Object} orderData - Order data containing customer note and other details
 */
function printDeliveryInstructions(orderData) {
    console.log('[GBV Extension] Printing delivery instructions for order:', orderData.sales_record_number);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    
    if (!printWindow) {
        console.error('Failed to open print window');
        showSimpleNotification('❌ Failed to open print window. Please check popup blocker settings.');
        return;
    }
    
    // Prepare data for template
    const templateData = {
        orderId: orderData.sales_record_number || 'N/A',
        recipient: `${orderData.shipping_addresses?.first_name || 'N/A'} ${orderData.shipping_addresses?.last_name || ''}`.trim(),
        buyerPhone: orderData.shipping_addresses?.phone || 'N/A',
        quantity: orderData.quantity_to_ship || 'N/A',
        sku: orderData.sku_codes?.join(', ') || 'N/A',
        deliveryInstructions: orderData.customer_note || 'No special instructions'
    };
    
    // Create print content using template
    const printContent = createPrintContent(templateData);
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Auto-print after a short delay
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    // Show success notification
    showSimpleNotification(`✅ Delivery instructions for order ${orderData.sales_record_number} opened for printing`);
}

/**
 * Create print content from template data
 * @param {Object} data - Template data object
 * @returns {string} HTML content for printing
 */
function createPrintContent(data) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Delivery Instructions - Order ${data.orderId}</title>
            <style>
                @page {
                    size: 4in 6in;
                    margin: 0.25in;
                }
                body {
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    line-height: 1.4;
                    margin: 0;
                    padding: 10px;
                }
                .header {
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 10px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 5px;
                }
                .field {
                    margin-bottom: 8px;
                }
                .label {
                    font-weight: bold;
                    display: inline-block;
                    width: 120px;
                }
                .value {
                    display: inline-block;
                }
                .instructions {
                    margin-top: 15px;
                    padding: 10px;
                    border: 1px solid #000;
                    background-color: #f9f9f9;
                    font-weight: bold;
                }
                .footer {
                    position: fixed;
                    bottom: 0;
                    width: 100%;
                    border-top: 2px solid #000;
                    padding-top: 5px;
                    text-align: center;
                }
                @media print {
                    body { margin: 0; padding: 5px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>      
            <div class="header">DELIVERY INSTRUCTIONS</div>
            
            <div class="field">
                <span class="label">Order Number:</span>
                <span class="value">${data.orderId}</span>
            </div>
            
            <div class="field">
                <span class="label">Customer Name:</span>
                <span class="value">${data.recipient}</span>
            </div>

            <div class="field">
                <span class="label">Customer Phone:</span>
                <span class="value">${data.buyerPhone}</span>
            </div>
            
            <div class="field">
                <span class="label">Item Info:</span>
                <span class="value">${data.quantity} x ${data.sku}</span>
            </div>
            
            <div class="instructions">
                <div class="label">Delivery Instructions:</div>
                <div class="value" style="font-size: large;">${data.deliveryInstructions}</div>
            </div>
            
            <div class="no-print" style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Print 4x6 Label</button>
                <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>

            <div class="footer">
                <div class="value">Thanks for shopping with GocBepViet</div><br>
                <div class="value">https://gocbepviet.com/</div>
            </div>
        </body>
        </html>
    `;
}
