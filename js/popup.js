/**
 * Popup Script for Veeqo USPS Extension
 * Handles settings management and API key storage
 */

// DOM elements
const apiKeyInput = document.getElementById('apiKey');
const settingsForm = document.getElementById('settingsForm');
const statusMessage = document.getElementById('statusMessage');
const apiStatus = document.getElementById('apiStatus');
const apiStatusText = document.getElementById('apiStatusText');

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await chrome.storage.sync.get(['veeqoApiKey']);
        if (result.veeqoApiKey) {
            apiKeyInput.value = result.veeqoApiKey;
            // Check API connection if key exists
            await checkApiConnection();
        }
        
        // Add event listeners
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
    
    // Toggle password button
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', togglePassword);
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
    
    // Validate API key format first
    if (!isValidApiKey(apiKey)) {
        showStatus('❌ Invalid API key format. Veeqo API keys should start with "Vqt/"', 'error');
        return;
    }
    
    showStatus('Testing connection...', 'info');
    console.log('Testing API key:', apiKey.substring(0, 10) + '...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'testVeeqoApi',
            apiKey: apiKey
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

// Toggle password visibility
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

// Functions are now properly scoped and don't need to be global
