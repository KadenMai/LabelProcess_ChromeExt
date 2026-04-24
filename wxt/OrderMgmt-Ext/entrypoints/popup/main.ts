// @ts-nocheck
/**
 * Popup script — Veeqo USPS Extension
 */
const apiKeyInput = document.getElementById('apiKey');
const uspsButtonColumnInput = document.getElementById('uspsButtonColumn');
const printNoteColumnInput = document.getElementById('printNoteColumn');
const settingsForm = document.getElementById('settingsForm');
const statusMessage = document.getElementById('statusMessage');
const apiStatus = document.getElementById('apiStatus');
const apiStatusText = document.getElementById('apiStatusText');

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!apiKeyInput || !uspsButtonColumnInput || !printNoteColumnInput) return;
    const result = await chrome.storage.sync.get(['veeqoApiKey', 'uspsButtonColumn', 'printNoteColumn']);
    if (result.veeqoApiKey) {
      apiKeyInput.value = result.veeqoApiKey;
      await checkApiConnection();
    }

    if (result.uspsButtonColumn) {
      uspsButtonColumnInput.value = result.uspsButtonColumn;
    }

    if (result.printNoteColumn) {
      printNoteColumnInput.value = result.printNoteColumn;
    }

    setupEventListeners();
    setupTabs();
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
});

function setupEventListeners() {
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', testConnection);
  }

  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', togglePassword);
  }
}

settingsForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const uspsButtonColumn = parseInt(uspsButtonColumnInput.value) || 3;
  const printNoteColumn = parseInt(printNoteColumnInput.value) || 6;

  if (!apiKey) {
    showStatus('Please enter your Veeqo API key', 'error');
    return;
  }

  if (!isValidApiKey(apiKey)) {
    showStatus('Invalid API key format. Please check your key.', 'error');
    return;
  }

  if (uspsButtonColumn < 1 || uspsButtonColumn > 20) {
    showStatus('USPS Button Column must be between 1 and 20', 'error');
    return;
  }

  if (printNoteColumn < 1 || printNoteColumn > 20) {
    showStatus('Print Note Column must be between 1 and 20', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({
      veeqoApiKey: apiKey,
      uspsButtonColumn: uspsButtonColumn,
      printNoteColumn: printNoteColumn,
    });

    const isValid = await testApiConnection(apiKey);

    if (isValid) {
      showStatus('Settings saved successfully! API connection verified.', 'success');
      updateApiStatus(true, 'Connected to Veeqo API');
    } else {
      showStatus('Settings saved, but API connection failed. Please check your key.', 'error');
      updateApiStatus(false, 'Connection failed');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
});

async function testConnection() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter your API key first', 'error');
    return;
  }

  if (!isValidApiKey(apiKey)) {
    showStatus('❌ Invalid API key format. Veeqo API keys should start with "Vqt/"', 'error');
    return;
  }

  showStatus('Testing connection...', 'info');
  console.log('Testing API key:', apiKey.substring(0, 10) + '...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testVeeqoApi',
      apiKey: apiKey,
    });

    console.log('API test response:', response);

    if (response && response.success) {
      showStatus('✅ Connection successful! API key is valid.', 'success');
      updateApiStatus(true, 'Connected to Veeqo API');
    } else {
      const errorMsg = response?.error || 'Unknown error';
      showStatus(`❌ Connection failed: ${errorMsg}`, 'error');
      updateApiStatus(false, 'Connection failed');
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    showStatus('Error testing connection: ' + error.message, 'error');
    updateApiStatus(false, 'Connection error');
  }
}

async function testApiConnection(apiKey) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testVeeqoApi',
      apiKey: apiKey,
    });

    if (response && response.success) {
      return true;
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('API test failed:', error);
    return false;
  }
}

async function checkApiConnection() {
  try {
    const result = await chrome.storage.sync.get(['veeqoApiKey']);
    if (result.veeqoApiKey) {
      const isValid = await testApiConnection(result.veeqoApiKey);
      updateApiStatus(isValid, isValid ? 'Connected to Veeqo API' : 'Connection failed');
    }
  } catch (error) {
    console.error('Error checking API connection:', error);
    updateApiStatus(false, 'Connection error');
  }
}

function updateApiStatus(isConnected, message) {
  if (!apiStatus || !apiStatusText) return;
  apiStatus.style.display = 'flex';
  apiStatus.className = `api-status ${isConnected ? 'connected' : 'disconnected'}`;

  const indicator = apiStatus.querySelector('.status-indicator');
  if (indicator) indicator.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;

  apiStatusText.textContent = message;
}

function isValidApiKey(apiKey) {
  return apiKey.startsWith('Vqt/') && apiKey.length > 20;
}

function showStatus(message, type) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

function togglePassword() {
  const input = apiKeyInput;
  const button = document.querySelector('.toggle-password');

  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      tabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}
