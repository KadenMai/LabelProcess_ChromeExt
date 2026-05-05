/**
 * “Print Note” / delivery instructions: build a 4x6 print view from Veeqo order data.
 * HTML: content/veeqo/print/delivery-instructions.html · CSS inlined from css/veeqo/delivery-instructions-print.css
 */

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtmlForPrint(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {Object} orderData
 * @returns {{ orderId: string, recipient: string, buyerPhone: string, quantity: string, sku: string, deliveryInstructions: string }}
 */
function buildDeliveryInstructionsData(orderData) {
    return {
        orderId: String(orderData.sales_record_number != null ? orderData.sales_record_number : 'N/A'),
        recipient: `${orderData.shipping_addresses?.first_name || 'N/A'} ${orderData.shipping_addresses?.last_name || ''}`.trim(),
        buyerPhone: orderData.shipping_addresses?.phone != null ? String(orderData.shipping_addresses.phone) : 'N/A',
        quantity: orderData.quantity_to_ship != null ? String(orderData.quantity_to_ship) : 'N/A',
        sku: Array.isArray(orderData.sku_codes) ? orderData.sku_codes.join(', ') : 'N/A',
        deliveryInstructions: orderData.customer_note != null && orderData.customer_note !== ''
            ? String(orderData.customer_note)
            : 'No special instructions',
    };
}

/**
 * @param {string} template
 * @param {Record<string, string>} data
 * @param {string} printCssText
 * @returns {string}
 */
function fillDeliveryInstructionsTemplate(template, data, printCssText) {
    let html = template;
    const css = printCssText == null ? '' : String(printCssText);
    html = html.replace(/\{\{PRINT_CSS\}\}/g, css);
    const keys = ['orderId', 'recipient', 'buyerPhone', 'quantity', 'sku', 'deliveryInstructions'];
    for (const key of keys) {
        const val = data[key] != null ? escapeHtmlForPrint(data[key]) : '';
        const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        html = html.replace(re, val);
    }
    return html;
}

/**
 * Print delivery instructions in 4x6 format (async: loads template from extension package)
 * @param {Object} orderData
 * @returns {Promise<void>}
 */
async function printDeliveryInstructions(orderData) {
    console.log('[GBV Extension] Printing delivery instructions for order:', orderData.sales_record_number);

    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) {
        console.error('Failed to open print window');
        showSimpleNotification('❌ Failed to open print window. Please check popup blocker settings.');
        return;
    }

    // Load template via background: page CSP on app.veeqo.com often blocks
    // fetch() to chrome-extension:// from the content script.
    let html;
    let printCss;
    try {
        const msg = await chrome.runtime.sendMessage({ action: 'getDeliveryInstructionsTemplate' });
        if (!msg || !msg.success || typeof msg.html !== 'string' || typeof msg.css !== 'string') {
            throw new Error((msg && msg.error) || 'No template');
        }
        html = msg.html;
        printCss = msg.css;
    } catch (e) {
        console.error('Failed to load delivery-instructions.html:', e);
        showSimpleNotification('❌ Could not load print template.');
        printWindow.close();
        return;
    }

    const data = buildDeliveryInstructionsData(orderData);
    html = fillDeliveryInstructionsTemplate(html, data, printCss);

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.print();
    }, 500);

    showSimpleNotification(`✅ Delivery instructions for order ${orderData.sales_record_number} opened for printing`);
}
