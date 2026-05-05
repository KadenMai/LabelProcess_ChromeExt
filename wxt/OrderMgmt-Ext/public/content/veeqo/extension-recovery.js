/**
 * Extension Recovery Utilities
 * Handles extension context invalidation and provides recovery mechanisms
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
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
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
    }, 5000); // Check every 5 seconds
    
    // Stop monitoring after 5 minutes to prevent memory leaks
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 300000);
}

/**
 * Initialize extension recovery monitoring
 */
function initializeExtensionRecovery() {
    // Only start monitoring if we're on a Veeqo page
    if (window.location.hostname === 'app.veeqo.com') {
        console.log('Starting extension context monitoring...');
        monitorExtensionContext();
    }
}

// Auto-initialize recovery monitoring
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtensionRecovery);
} else {
    initializeExtensionRecovery();
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isExtensionContextValid,
        showRecoveryNotification,
        monitorExtensionContext,
        initializeExtensionRecovery
    };
}
