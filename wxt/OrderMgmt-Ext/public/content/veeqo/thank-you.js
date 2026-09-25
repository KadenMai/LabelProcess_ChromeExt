/**
 * "Thank You" card: build a cute 4x6 printable thank-you note (with QR code) from Veeqo order data.
 * HTML: content/veeqo/print/thank-you.html · CSS inlined from css/veeqo/thank-you-print.css
 *
 * The QR code is rendered HERE, in the content script's own (extension-privileged) context, via
 * window.QRCode from content/veeqo/print/qrcode.min.js (loaded as an ordinary content script — see
 * wxt.config.ts). The resulting <svg> markup is baked into the static HTML before it's written to
 * the print window. Do NOT move QR generation into a <script> tag inside that popup document: it's
 * opened via window.open() from this content script, so its about:blank document inherits Veeqo's
 * page CSP — which blocks inline scripts. That's also why printWindow.print() below is called from
 * here rather than from an inline script in the popup (same reason getDeliveryInstructionsTemplate's
 * print window never runs script inside itself either).
 */

const THANK_YOU_LINK = 'https://gocbepviet.com/';

/** Matches the storage key used by the popup's Settings tab (SKU -> Item Name -> Link records). */
const SKU_RECORDS_STORAGE_KEY = 'thankYouSkuRecords';

/**
 * @returns {Promise<Array<{ sku: string, itemName: string, link: string }>>}
 */
async function getThankYouSkuRecords() {
    try {
        if (!isExtensionContextValid()) {
            return [];
        }
        const result = await chrome.storage.local.get([SKU_RECORDS_STORAGE_KEY]);
        return Array.isArray(result[SKU_RECORDS_STORAGE_KEY]) ? result[SKU_RECORDS_STORAGE_KEY] : [];
    } catch (error) {
        console.log('Error getting Thank You SKU records:', error.message);
        return [];
    }
}

/**
 * @param {string} sku
 * @returns {string}
 */
function normalizeSkuKey(sku) {
    return String(sku || '').trim().toLowerCase();
}

/**
 * Match the order's SKU(s) against the user-configured SKU -> Item Name -> Link records.
 * @param {Object} orderData
 * @param {Array<{ sku: string, itemName: string, link: string }>} skuRecords
 * @returns {{ sku: string, itemName: string, link: string }|null}
 */
function findSkuRecordForOrder(orderData, skuRecords) {
    if (!Array.isArray(skuRecords) || skuRecords.length === 0) {
        return null;
    }
    const recordMap = new Map();
    for (const record of skuRecords) {
        const key = normalizeSkuKey(record.sku);
        if (key) {
            recordMap.set(key, record);
        }
    }

    const orderSkus = [];
    if (Array.isArray(orderData.line_items)) {
        for (const item of orderData.line_items) {
            if (item?.sellable?.sku_code) {
                orderSkus.push(item.sellable.sku_code);
            }
        }
    }
    if (Array.isArray(orderData.sku_codes)) {
        orderSkus.push(...orderData.sku_codes);
    }

    for (const sku of orderSkus) {
        const match = recordMap.get(normalizeSkuKey(sku));
        if (match) {
            return match;
        }
    }
    return null;
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtmlForThankYou(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {Object} orderData
 * @returns {string}
 */
function extractItemNameFromOrderData(orderData) {
    const lineItems = Array.isArray(orderData.line_items) ? orderData.line_items : [];
    const names = lineItems
        .map((item) => item.sellable?.product_title || item.sellable?.title || item.title || item.sellable?.name)
        .filter((name) => name != null && String(name).trim() !== '');
    if (names.length > 0) {
        return names.join(', ');
    }
    if (Array.isArray(orderData.sku_codes) && orderData.sku_codes.length > 0) {
        return orderData.sku_codes.join(', ');
    }
    return 'item';
}

/** Item name prints on its own line under "We hope you love your" — keep it to one short line. */
const MAX_ITEM_NAME_LENGTH = 30;

/**
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength) {
    return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Personalization uses first name only — friendlier and faster to recognize than a full name
 * ("Thank You, Michael!" vs. "Dear Michael Cozart,").
 * @param {Object} orderData
 * @returns {Promise<{ orderId: string, firstName: string, itemName: string, link: string }>}
 */
async function buildThankYouData(orderData) {
    const skuRecords = await getThankYouSkuRecords();
    const matchedRecord = findSkuRecordForOrder(orderData, skuRecords);

    const firstName = orderData.shipping_addresses?.first_name || orderData.customer?.first_name || '';
    const itemName = (matchedRecord?.itemName && matchedRecord.itemName.trim()) || extractItemNameFromOrderData(orderData);

    return {
        orderId: String(orderData.sales_record_number != null ? orderData.sales_record_number : 'N/A'),
        firstName: firstName.trim() || 'Customer',
        itemName: truncate(itemName, MAX_ITEM_NAME_LENGTH),
        link: (matchedRecord?.link && matchedRecord.link.trim()) || THANK_YOU_LINK,
    };
}

/**
 * Render a QR code as an <svg>...</svg> string, entirely in this content script's own context
 * (window.QRCode comes from content/veeqo/print/qrcode.min.js, loaded as a plain content script —
 * see the file header for why this can't run as a <script> inside the print popup instead).
 * @param {string} link
 * @returns {Promise<string>}
 */
function generateQrSvg(link) {
    return new Promise((resolve) => {
        try {
            window.QRCode.toString(
                link,
                { type: 'svg', margin: 1, width: 108, color: { dark: '#000000', light: '#ffffff' } },
                (err, svg) => {
                    if (err) {
                        console.error('QR generation failed:', err);
                        resolve('QR code unavailable');
                    } else {
                        resolve(svg);
                    }
                }
            );
        } catch (e) {
            console.error('QR generation error:', e);
            resolve('QR code unavailable');
        }
    });
}

/**
 * @param {string} template
 * @param {{ orderId: string, firstName: string, itemName: string, link: string }} data
 * @param {string} printCssText
 * @param {string} qrSvg pre-rendered <svg>...</svg> markup (or a plain-text fallback message)
 * @returns {string}
 */
function fillThankYouTemplate(template, data, printCssText, qrSvg) {
    let html = template;
    html = html.replace(/\{\{PRINT_CSS\}\}/g, printCssText == null ? '' : String(printCssText));
    html = html.replace(/\{\{QR_SVG\}\}/g, qrSvg == null ? '' : String(qrSvg));
    const keys = ['orderId', 'firstName', 'itemName'];
    for (const key of keys) {
        const val = data[key] != null ? escapeHtmlForThankYou(data[key]) : '';
        const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        html = html.replace(re, val);
    }
    return html;
}

/**
 * Print a "Thank You" card in 4x6 format (async: loads template from extension package, renders QR locally)
 * @param {Object} orderData
 * @returns {Promise<void>}
 */
async function printThankYou(orderData) {
    console.log('[GBV Extension] Printing thank-you card for order:', orderData.sales_record_number);

    // Sized to preview the 4x6 portrait card at roughly its printed proportions (the @page CSS
    // rule in thank-you-print.css is what actually controls the physical printed page size).
    const printWindow = window.open('', '_blank', 'width=440,height=760');
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
        const msg = await chrome.runtime.sendMessage({ action: 'getThankYouTemplate' });
        if (!msg || !msg.success || typeof msg.html !== 'string' || typeof msg.css !== 'string') {
            throw new Error((msg && msg.error) || 'No template');
        }
        html = msg.html;
        printCss = msg.css;
    } catch (e) {
        console.error('Failed to load thank-you.html:', e);
        showSimpleNotification('❌ Could not load print template.');
        printWindow.close();
        return;
    }

    const data = await buildThankYouData(orderData);
    const qrSvg = await generateQrSvg(data.link);
    html = fillThankYouTemplate(html, data, printCss, qrSvg);

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.print();
    }, 500);

    showSimpleNotification(`✅ Thank-you card for order ${orderData.sales_record_number} opened for printing`);
}
