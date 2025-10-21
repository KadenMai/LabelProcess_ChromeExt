/**
 * Options Page Script for Veeqo USPS Extension
 * Handles advanced settings and statistics
 */

// DOM elements
const apiKeyInput = document.getElementById('apiKey');
const settingsForm = document.getElementById('settingsForm');
const statusMessage = document.getElementById('statusMessage');
const apiStatus = document.getElementById('apiStatus');
const apiStatusText = document.getElementById('apiStatusText');

// Statistics elements
const buttonsAddedStat = document.getElementById('buttonsAdded');
const apiCallsStat = document.getElementById('apiCalls');
const ordersFetchedStat = document.getElementById('ordersFetched');

// Load saved settings and statistics when page opens
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load API key
        const result = await chrome.storage.sync.get(['veeqoApiKey']);
        if (result.veeqoApiKey) {
            apiKeyInput.value = result.veeqoApiKey;
            await checkApiConnection();
        }
        
        // Load statistics
        await loadStatistics();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Error loading settings', 'error');
    }
});

// Setup event listeners for buttons
function setupEventListeners() {
    // Test connection button
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testConnection);
    }
    
    // Clear API key button
    const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
    if (clearApiKeyBtn) {
        clearApiKeyBtn.addEventListener('click', clearApiKey);
    }
}

// Handle form submission
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showStatus('Please enter your Veeqo API key', 'error');
        return;
    }
    
    if (!isValidApiKey(apiKey)) {
        showStatus('Invalid API key format. Please check your key.', 'error');
        return;
    }
    
    try {
        // Save API key to Chrome storage
        await chrome.storage.sync.set({ veeqoApiKey: apiKey });
        
        // Test the connection
        const isValid = await testApiConnection(apiKey);
        
        if (isValid) {
            showStatus('Settings saved successfully! API connection verified.', 'success');
            updateApiStatus(true, 'Connected to Veeqo API');
            await updateStatistic('apiCalls', 1);
        } else {
            showStatus('Settings saved, but API connection failed. Please check your key.', 'error');
            updateApiStatus(false, 'Connection failed');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings', 'error');
    }
});

// Test API connection
async function testConnection() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showStatus('Please enter your API key first', 'error');
        return;
    }
    
    showStatus('Testing connection...', 'info');
    
    try {
        const isValid = await testApiConnection(apiKey);
        
        if (isValid) {
            showStatus('✅ Connection successful! API key is valid.', 'success');
            updateApiStatus(true, 'Connected to Veeqo API');
            await updateStatistic('apiCalls', 1);
        } else {
            showStatus('❌ Connection failed. Please check your API key.', 'error');
            updateApiStatus(false, 'Connection failed');
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        showStatus('Error testing connection: ' + error.message, 'error');
        updateApiStatus(false, 'Connection error');
    }
}

// Clear API key
async function clearApiKey() {
    if (confirm('Are you sure you want to clear your API key? This will disable API functionality.')) {
        try {
            await chrome.storage.sync.remove(['veeqoApiKey']);
            apiKeyInput.value = '';
            updateApiStatus(false, 'No API key configured');
            showStatus('API key cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing API key:', error);
            showStatus('Error clearing API key', 'error');
        }
    }
}

// Test API connection with the provided key using background script
async function testApiConnection(apiKey) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'testVeeqoApi',
            apiKey: apiKey
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

// Check API connection using stored key
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

// Update API status display
function updateApiStatus(isConnected, message) {
    apiStatus.style.display = 'flex';
    apiStatus.className = `api-status ${isConnected ? 'connected' : 'disconnected'}`;
    
    const indicator = apiStatus.querySelector('.status-indicator');
    indicator.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
    
    apiStatusText.textContent = message;
}

// Validate API key format
function isValidApiKey(apiKey) {
    // Veeqo API keys typically start with 'Vqt/' and are base64-like
    return apiKey.startsWith('Vqt/') && apiKey.length > 20;
}

// Show status message
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    // Hide status after 5 seconds
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

// Load statistics from storage
async function loadStatistics() {
    try {
        const result = await chrome.storage.local.get([
            'buttonsAdded',
            'apiCalls',
            'ordersFetched'
        ]);
        
        buttonsAddedStat.textContent = result.buttonsAdded || 0;
        apiCallsStat.textContent = result.apiCalls || 0;
        ordersFetchedStat.textContent = result.ordersFetched || 0;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Update a specific statistic
async function updateStatistic(statName, increment = 1) {
    try {
        const result = await chrome.storage.local.get([statName]);
        const currentValue = result[statName] || 0;
        const newValue = currentValue + increment;
        
        await chrome.storage.local.set({ [statName]: newValue });
        
        // Update the display
        const statElement = document.getElementById(statName);
        if (statElement) {
            statElement.textContent = newValue;
        }
    } catch (error) {
        console.error('Error updating statistic:', error);
    }
}

// Functions are now properly scoped and don't need to be global
