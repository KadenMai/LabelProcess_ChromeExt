/**
 * Background script — Veeqo USPS (migrated from LabelProcess_ChromeExt)
 */
export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('Veeqo USPS Extension installed/updated:', details.reason);
    if (details.reason === 'install') {
      console.log('First time installation - setting up extension');
    } else if (details.reason === 'update') {
      console.log('Extension updated to version:', chrome.runtime.getManifest().version);
    }
  });

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Background received message:', request);

    switch (request.action) {
      case 'openUSPSTab':
        handleOpenUSPSTab(request, sendResponse);
        return true;
      case 'testVeeqoApi':
        handleTestVeeqoApi(request, sendResponse);
        return true;
      case 'fetchVeeqoOrders':
        handleFetchVeeqoOrders(request, sendResponse);
        return true;
      case 'fetchOrderById':
        handleFetchOrderById(request, sendResponse);
        return true;
      case 'updateVeeqoOrder_CustomerNote':
        handleUpdateVeeqoOrder_CustomerNote(request, sendResponse);
        return true;
      case 'updateVeeqoOrder_InternalNote':
        handleUpdateVeeqoOrder_InternalNote(request, sendResponse);
        return true;
      case 'injectUSPSAutoFill':
        handleInjectUSPSAutoFill(request, sendResponse);
        return true;
      case 'logMessage':
        console.log('Content script log:', request.message);
        break;
      default:
        console.log('Unknown message action:', request.action);
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    console.log('Veeqo USPS Extension started');
  });
});

function handleOpenUSPSTab(
  request: { orderData?: unknown },
  sendResponse: (r: { success: boolean; tabId?: number; error?: string }) => void
) {
  const { orderData } = request;
  console.log('Background: Opening USPS tab with order data:', orderData);

  if (orderData) {
    const dataKey = `veeqoOrderData_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    chrome.storage.local.set({ [dataKey]: orderData }, () => {
      const uspsUrl = `https://cnsb.usps.com/label-manager/new-label/quick?veeqoKey=${dataKey}`;
      chrome.tabs.create({ url: uspsUrl, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, tabId: tab?.id });
        }
      });
    });
  } else {
    chrome.tabs.create(
      { url: 'https://cnsb.usps.com/label-manager/new-label/quick', active: true },
      (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, tabId: tab?.id });
        }
      }
    );
  }
}

async function handleTestVeeqoApi(
  request: { apiKey?: string },
  sendResponse: (r: { success: boolean; message?: string; error?: string }) => void
) {
  try {
    const { apiKey } = request;
    if (!apiKey) {
      sendResponse({ success: false, error: 'No API key provided' });
      return;
    }
    const url = 'https://api.veeqo.com/orders?page_size=1';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      mode: 'cors',
    });
    if (response.ok) {
      await response.json();
      sendResponse({ success: true, message: 'API connection successful' });
    } else if (response.status === 401) {
      sendResponse({ success: false, error: 'Invalid API key' });
    } else if (response.status === 403) {
      sendResponse({ success: false, error: 'API key does not have required permissions' });
    } else {
      const errorText = await response.text();
      sendResponse({
        success: false,
        error: `API request failed with status: ${response.status} - ${errorText}`,
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      sendResponse({
        success: false,
        error:
          'CORS error: Failed to fetch. Please ensure you are on a Veeqo page for the API proxy to work.',
      });
    } else {
      sendResponse({ success: false, error: err.message });
    }
  }
}

async function handleFetchVeeqoOrders(
  request: { apiKey?: string; params?: Record<string, string | number> },
  sendResponse: (r: { success: boolean; data?: unknown; error?: string }) => void
) {
  try {
    const { apiKey, params = {} } = request;
    if (!apiKey) {
      sendResponse({ success: false, error: 'No API key provided' });
      return;
    }
    const defaultParams = { page_size: 100, status: 'awaiting_fulfillment' };
    const queryParams = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries({ ...defaultParams, ...params }).map(([k, v]) => [k, String(v)])
      ),
    });
    const apiUrl = `https://api.veeqo.com/orders?${queryParams}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        sendResponse({ success: true, data });
      } else {
        const errorText = await response.text();
        sendResponse({
          success: false,
          error: `API request failed with status: ${response.status} - ${errorText}`,
        });
      }
    } catch (fetchError: unknown) {
      const fe = fetchError as Error;
      if (fe.name === 'TypeError' && fe.message.includes('Failed to fetch')) {
        sendResponse({
          success: false,
          error:
            'CORS error: Failed to fetch. Please ensure you are on a Veeqo page for the API proxy to work.',
        });
      } else {
        sendResponse({ success: false, error: `Network error: ${fe.message}` });
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    sendResponse({ success: false, error: err.message });
  }
}

async function handleFetchOrderById(
  request: { apiKey?: string; orderId?: string | number },
  sendResponse: (r: { success: boolean; data?: unknown; error?: string }) => void
) {
  try {
    const { apiKey, orderId } = request;
    if (!apiKey) {
      sendResponse({ success: false, error: 'No API key provided' });
      return;
    }
    if (!orderId) {
      sendResponse({ success: false, error: 'No order ID provided' });
      return;
    }
    const url = `https://api.veeqo.com/orders/${orderId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      mode: 'cors',
    });
    if (response.ok) {
      const data = await response.json();
      sendResponse({ success: true, data });
    } else {
      const errorText = await response.text();
      sendResponse({
        success: false,
        error: `Order fetch failed with status: ${response.status} - ${errorText}`,
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    sendResponse({ success: false, error: err.message });
  }
}

async function handleUpdateVeeqoOrder_CustomerNote(
  request: { apiKey?: string; orderId?: string | number; customerNote?: string },
  sendResponse: (r: { success: boolean; data?: unknown; error?: string }) => void
) {
  try {
    const { apiKey, orderId, customerNote } = request;
    if (!apiKey) {
      sendResponse({ success: false, error: 'API key is required' });
      return;
    }
    if (!orderId) {
      sendResponse({ success: false, error: 'Order ID is required' });
      return;
    }
    if (!customerNote) {
      sendResponse({ success: false, error: 'Customer note is required' });
      return;
    }
    const response = await fetch(`https://api.veeqo.com/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: { customer_note_attributes: { text: customerNote } },
      }),
    });
    if (response.ok) {
      const data = await response.json();
      sendResponse({ success: true, data });
    } else {
      const errorText = await response.text();
      sendResponse({ success: false, error: `API request failed: ${response.status} ${errorText}` });
    }
  } catch (error: unknown) {
    const err = error as Error;
    sendResponse({ success: false, error: err.message });
  }
}

async function handleUpdateVeeqoOrder_InternalNote(
  request: { apiKey?: string; orderId?: string | number; internalNote?: string },
  sendResponse: (r: { success: boolean; data?: unknown; error?: string }) => void
) {
  try {
    const { apiKey, orderId, internalNote } = request;
    if (!apiKey) {
      sendResponse({ success: false, error: 'API key is required' });
      return;
    }
    if (!orderId) {
      sendResponse({ success: false, error: 'Order ID is required' });
      return;
    }
    if (!internalNote) {
      sendResponse({ success: false, error: 'Internal note is required' });
      return;
    }
    const response = await fetch(`https://api.veeqo.com/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: { employee_notes_attributes: [{ text: internalNote }] },
      }),
    });
    if (response.ok) {
      const data = await response.json();
      sendResponse({ success: true, data });
    } else {
      const errorText = await response.text();
      sendResponse({ success: false, error: `API request failed: ${response.status} ${errorText}` });
    }
  } catch (error: unknown) {
    const err = error as Error;
    sendResponse({ success: false, error: err.message });
  }
}

async function handleInjectUSPSAutoFill(
  request: { tabId?: number; orderData?: unknown },
  sendResponse: (r: { success: boolean; error?: string; message?: string }) => void
) {
  try {
    const { tabId, orderData } = request;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID provided' });
      return;
    }
    if (orderData) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (data) => {
          sessionStorage.setItem('veeqoOrderData', JSON.stringify(data));
          console.log('Order data stored in USPS page session storage:', data);
        },
        args: [orderData],
      });
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['js/usps-autofill.js'],
    });
    sendResponse({ success: true, message: 'USPS auto-fill script injected' });
  } catch (error: unknown) {
    const err = error as Error;
    sendResponse({ success: false, error: err.message });
  }
}
