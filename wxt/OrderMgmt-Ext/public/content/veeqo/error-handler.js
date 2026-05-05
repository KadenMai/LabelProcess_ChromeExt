/**
 * Global Error Handler for Extension Context Invalidation
 * Provides immediate feedback and recovery mechanisms
 */

/**
 * Check if Chrome extension context is valid
 * @returns {boolean} True if context is valid
 */
function isExtensionContextValid() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        return false;
    }
}

/**
 * Show extension recovery notification
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (error, warning, info)
 */
function showRecoveryNotification(message, type = 'warning') {
    // Remove any existing recovery notifications
    const existingNotification = document.getElementById('extension-recovery-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'extension-recovery-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: ${type === 'warning' ? '#000' : '#fff'};
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 500px;
        text-align: center;
        border: 2px solid ${type === 'error' ? '#c82333' : type === 'warning' ? '#e0a800' : '#138496'};
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 18px;">
                ${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; margin-left: 10px;">
                ×
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 15 seconds for context invalidation errors
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 15000);
}

/**
 * Global error handler for uncaught errors
 */
function setupGlobalErrorHandler() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
        if (event.error && event.error.message && 
            event.error.message.includes('Extension context invalidated')) {
            console.warn('Caught extension context invalidation error:', event.error);
            showRecoveryNotification(
                'Extension context invalidated. Please reload the page to restore full functionality.',
                'warning'
            );
        }
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message && 
            event.reason.message.includes('Extension context invalidated')) {
            console.warn('Caught extension context invalidation promise rejection:', event.reason);
            showRecoveryNotification(
                'Extension context invalidated. Please reload the page to restore full functionality.',
                'warning'
            );
        }
    });
}

/**
 * Enhanced Chrome API wrapper with context validation
 */
function createChromeApiWrapper() {
    const originalChrome = window.chrome;
    
    // Wrap chrome.storage.sync.get
    if (originalChrome && originalChrome.storage && originalChrome.storage.sync) {
        const originalGet = originalChrome.storage.sync.get;
        originalChrome.storage.sync.get = function(...args) {
            if (!isExtensionContextValid()) {
                return Promise.reject(new Error('Extension context invalidated'));
            }
            return originalGet.apply(this, args);
        };
    }
    
    // Wrap chrome.runtime.sendMessage
    if (originalChrome && originalChrome.runtime && originalChrome.runtime.sendMessage) {
        const originalSendMessage = originalChrome.runtime.sendMessage;
        originalChrome.runtime.sendMessage = function(...args) {
            if (!isExtensionContextValid()) {
                return Promise.reject(new Error('Extension context invalidated'));
            }
            return originalSendMessage.apply(this, args);
        };
    }
}

/**
 * Monitor extension context and show recovery notification when invalidated
 */
function monitorExtensionContext() {
    const checkInterval = setInterval(() => {
        if (!isExtensionContextValid()) {
            clearInterval(checkInterval);
            showRecoveryNotification(
                'Extension context invalidated. Please reload the page to restore full functionality.',
                'warning'
            );
        }
    }, 2000); // Check every 2 seconds for faster detection
    
    // Stop monitoring after 10 minutes to prevent memory leaks
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 600000);
}

/**
 * Initialize error handling and recovery system
 */
function initializeErrorHandling() {
    // Only initialize on Veeqo pages
    if (window.location.hostname === 'app.veeqo.com') {
        console.log('Initializing extension error handling and recovery system...');
        
        // Setup global error handlers
        setupGlobalErrorHandler();
        
        // Create Chrome API wrapper
        createChromeApiWrapper();
        
        // Start context monitoring
        monitorExtensionContext();
        
        console.log('Extension error handling system initialized');
    }
}

// Auto-initialize error handling
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeErrorHandling);
} else {
    initializeErrorHandling();
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isExtensionContextValid,
        showRecoveryNotification,
        setupGlobalErrorHandler,
        createChromeApiWrapper,
        monitorExtensionContext,
        initializeErrorHandling
    };
}
