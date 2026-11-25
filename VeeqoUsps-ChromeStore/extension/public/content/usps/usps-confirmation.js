/**
 * USPS Mark Shipped buttons
 *
 * Supported pages:
 * - /confirmation-page
 * - /history/orders/:orderUUID  (Shipping History order detail)
 *
 * Relies on Reference 1 (customerReference) being the Veeqo order id.
 * Internal note written: {"v":"USPS","p":<price>}
 */

if (window.veeqoUspsConfirmationLoaded) {
    console.log('USPS confirmation script already loaded, skipping...');
} else {
    window.veeqoUspsConfirmationLoaded = true;

    // Account-specific USPS carrier (Veeqo UI uses 29 when marking shipped with USPS).
    // Built-in docs list 7 as USPS; this account maps USPS to 29 (shown as Endicia in UI).
    const USPS_CARRIER_ID = 29;
    const BUTTON_CLASS = 'veeqo-mark-shipped-btn';

    function isUspsHost() {
        const host = window.location.hostname;
        return host === 'cns.usps.com' || host === 'cnsb.usps.com';
    }

    function getRedirectPath() {
        try {
            return new URLSearchParams(window.location.search).get('redirectPath') || '';
        } catch (error) {
            return '';
        }
    }

    function currentPathContext() {
        return `${window.location.pathname}${window.location.search}${getRedirectPath()}`;
    }

    function isConfirmationPage() {
        if (!isUspsHost()) return false;
        const ctx = currentPathContext();
        return ctx.includes('/confirmation-page');
    }

    function isHistoryOrderDetailPage() {
        if (!isUspsHost()) return false;
        const ctx = currentPathContext();
        return /\/history\/orders\/[^/?#]+/i.test(ctx);
    }

    function isSupportedPage() {
        return isConfirmationPage() || isHistoryOrderDetailPage();
    }

    function getApiKey() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['veeqoAccessToken'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!result.veeqoAccessToken) {
                    reject(new Error('Veeqo not connected. Sign in and Connect Veeqo in the extension popup.'));
                    return;
                }
                resolve(result.veeqoAccessToken);
            });
        });
    }

    /**
     * Parse "$6.28 (1 labels)" from confirmation / order summary.
     * Used when a per-row price is not available.
     */
    function getOrderAverageLabelPrice() {
        const candidates = Array.from(document.querySelectorAll('p, span, div')).map((el) =>
            (el.textContent || '').trim()
        );
        for (const text of candidates) {
            const match = text.match(/\$([\d.]+)\s*\((\d+)\s*labels?\)/i);
            if (match) {
                const total = parseFloat(match[1]);
                const count = parseInt(match[2], 10) || 1;
                if (!Number.isNaN(total) && count > 0) {
                    return Math.round((total / count) * 100) / 100;
                }
            }
        }
        return null;
    }

    /**
     * Reference 1 renders as span.d-block under the recipient.
     * Prefer a pure numeric Veeqo id.
     */
    function getVeeqoIdFromRow(row) {
        const spans = Array.from(row.querySelectorAll('span.d-block'));
        for (const span of spans) {
            const text = (span.textContent || '').trim();
            if (/^\d+$/.test(text)) return text;
        }
        // Fallback: digit-only text that looks like a Veeqo id (not a ZIP)
        for (const span of spans) {
            const text = (span.textContent || '').trim();
            if (/^\d{5,}$/.test(text)) return text;
        }
        return null;
    }

    function getTrackingLink(row) {
        return (
            row.querySelector('a[href*="/history/label/"]') ||
            row.querySelector('[id^="label-num-"]') ||
            null
        );
    }

    function getTrackingFromRow(row) {
        const el = getTrackingLink(row);
        if (!el) return null;
        const text = (el.textContent || '').trim();
        const digits = text.replace(/\s+/g, '');
        return /^\d{10,}$/.test(digits) ? digits : text || null;
    }

    /**
     * History order detail shows a real per-label price (e.g. $6.61).
     */
    function getPriceFromRow(row) {
        const cells = Array.from(row.querySelectorAll('td'));
        for (const cell of cells) {
            const text = (cell.textContent || '').trim();
            if (/^\$[\d.]+$/.test(text)) {
                return parseFloat(text.slice(1));
            }
        }
        const boldPrice = row.querySelector('p.fw-bold.fs-16, p.fw-bold');
        if (boldPrice) {
            const match = (boldPrice.textContent || '').trim().match(/^\$([\d.]+)$/);
            if (match) return parseFloat(match[1]);
        }
        return null;
    }

    function pickAllocationId(order) {
        const allocations = order?.allocations || [];
        if (!allocations.length) return null;
        const open = allocations.find((a) => !a.shipment && !a.shipped_at);
        return (open || allocations[0])?.id ?? null;
    }

    function setButtonState(button, { text, disabled, success, error }) {
        button.textContent = text;
        button.disabled = !!disabled;
        if (success) {
            button.style.backgroundColor = '#28a745';
            button.style.borderColor = '#28a745';
        } else if (error) {
            button.style.backgroundColor = '#dc3545';
            button.style.borderColor = '#dc3545';
        } else if (disabled) {
            button.style.backgroundColor = '#6c757d';
            button.style.borderColor = '#6c757d';
        } else {
            button.style.backgroundColor = '#007bff';
            button.style.borderColor = '#007bff';
        }
    }

    async function markOrderShipped(veeqoId, trackingNumber, price) {
        const apiKey = await getApiKey();

        const orderResponse = await chrome.runtime.sendMessage({
            action: 'fetchOrderById',
            apiKey,
            orderId: veeqoId,
        });
        if (!orderResponse?.success || !orderResponse.data) {
            throw new Error(orderResponse?.error || `Could not load Veeqo order ${veeqoId}`);
        }

        const order = orderResponse.data;
        const allocationId = pickAllocationId(order);
        if (!allocationId) {
            throw new Error(`No allocation found on Veeqo order ${veeqoId}`);
        }

        const shipResponse = await chrome.runtime.sendMessage({
            action: 'createVeeqoShipment',
            apiKey,
            orderId: order.id || veeqoId,
            allocationId,
            trackingNumber,
            carrierId: USPS_CARRIER_ID,
            notifyCustomer: false,
            updateRemoteOrder: true,
        });
        if (!shipResponse?.success) {
            throw new Error(shipResponse?.error || 'Failed to create Veeqo shipment');
        }

        const internalNote = JSON.stringify({ v: 'USPS', p: price });
        const noteResponse = await chrome.runtime.sendMessage({
            action: 'updateVeeqoOrder_InternalNote',
            apiKey,
            orderId: order.id || veeqoId,
            internalNote,
        });
        if (!noteResponse?.success) {
            throw new Error(noteResponse?.error || 'Shipped, but failed to add internal note');
        }

        return { orderId: order.id || veeqoId, allocationId, internalNote };
    }

    async function handleMarkShippedClick(event) {
        const button = event.currentTarget;
        const row = button.closest('tr');
        if (!row) return;

        const veeqoId = button.dataset.veeqoId || getVeeqoIdFromRow(row);
        const trackingNumber = button.dataset.tracking || getTrackingFromRow(row);
        const price = parseFloat(button.dataset.price);

        if (!veeqoId) {
            alert(
                'No Veeqo ID found on this label. Re-create the label after Fill Order Data so Reference 1 is the Veeqo ID.'
            );
            return;
        }
        if (!trackingNumber) {
            alert('No USPS label/tracking number found on this row.');
            return;
        }
        if (Number.isNaN(price)) {
            alert('Could not determine the label price from this page.');
            return;
        }

        const originalText = button.textContent;
        setButtonState(button, { text: 'Shipping…', disabled: true });

        try {
            console.log('Marking Veeqo order shipped:', { veeqoId, trackingNumber, price });
            await markOrderShipped(veeqoId, trackingNumber, price);
            setButtonState(button, { text: 'Shipped ✓', disabled: true, success: true });
        } catch (error) {
            console.error('Mark shipped failed:', error);
            setButtonState(button, { text: originalText, disabled: false, error: true });
            alert(`Failed to mark shipped: ${error.message}`);
            setTimeout(() => {
                setButtonState(button, { text: originalText, disabled: false });
            }, 2500);
        }
    }

    function createMarkShippedButton({ veeqoId, trackingNumber, price }) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${BUTTON_CLASS} btn btn-primary btn-sm`;
        button.textContent = 'Mark Shipped';
        button.title = veeqoId
            ? `Mark Veeqo order ${veeqoId} as shipped (USPS)`
            : 'Veeqo ID missing from label reference';
        button.dataset.veeqoId = veeqoId || '';
        button.dataset.tracking = trackingNumber || '';
        button.dataset.price = price != null ? String(price) : '';
        button.style.cssText = `
            display: block;
            margin-top: 8px;
            background: #007bff;
            color: #fff;
            border: 1px solid #007bff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            cursor: pointer;
        `;
        if (!veeqoId) {
            button.disabled = true;
            button.textContent = 'No Veeqo ID';
            button.style.backgroundColor = '#6c757d';
            button.style.borderColor = '#6c757d';
            button.style.cursor = 'not-allowed';
        } else {
            button.addEventListener('click', handleMarkShippedClick);
        }
        return button;
    }

    function getTargetTables() {
        const tables = [];
        const historyTable = document.getElementById('history-table');
        const shippingHistoryTable = document.getElementById('shipping-history-table');
        const confirmationTable = document.getElementById('payment-confirmation-table');
        if (historyTable) tables.push(historyTable);
        if (shippingHistoryTable) tables.push(shippingHistoryTable);
        if (confirmationTable) tables.push(confirmationTable);
        return tables;
    }

    /**
     * Insert button under the tracking number element.
     */
    function getTrackingInsertParent(row) {
        const trackingLink = getTrackingLink(row);
        if (!trackingLink) return null;

        // Prefer wrapping parent section/td so the button sits under the link
        if (trackingLink.parentElement && trackingLink.parentElement.tagName === 'SECTION') {
            return trackingLink.parentElement;
        }
        if (trackingLink.closest('td')) {
            return trackingLink.closest('td');
        }
        return trackingLink.parentElement;
    }

    function injectButtons() {
        const tables = getTargetTables();
        if (!tables.length) return false;

        const fallbackPrice = getOrderAverageLabelPrice();
        let added = 0;

        tables.forEach((table) => {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row) => {
                if (row.querySelector(`.${BUTTON_CLASS}`)) return;

                const insertParent = getTrackingInsertParent(row);
                if (!insertParent) return;

                const veeqoId = getVeeqoIdFromRow(row);
                const trackingNumber = getTrackingFromRow(row);
                const rowPrice = getPriceFromRow(row);
                const price = rowPrice != null ? rowPrice : fallbackPrice;

                const button = createMarkShippedButton({
                    veeqoId,
                    trackingNumber,
                    price,
                });
                insertParent.appendChild(button);
                added++;
            });
        });

        if (added > 0) {
            console.log(`Added ${added} Veeqo Mark Shipped button(s)`);
        }
        return true;
    }

    function startWatchingForButtons() {
        console.log(
            'USPS mark-shipped page detected:',
            window.location.href,
            '— watching for label rows'
        );
        injectButtons();

        let checks = 0;
        const timer = setInterval(() => {
            checks++;
            injectButtons();
            if (checks >= 90) clearInterval(timer);
        }, 1000);

        const observer = new MutationObserver(() => injectButtons());
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        setTimeout(() => observer.disconnect(), 180000);
    }

    function start() {
        if (!isUspsHost()) return;

        if (isSupportedPage()) {
            startWatchingForButtons();
            return;
        }

        // USPS often boots at /?redirectPath=/history/orders/... then restores the route.
        let checks = 0;
        const timer = setInterval(() => {
            checks++;
            if (isSupportedPage()) {
                clearInterval(timer);
                startWatchingForButtons();
            } else if (checks >= 60) {
                clearInterval(timer);
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
}
