/**
 * Content Script for Veeqo USPS Extension
 * Injects USPS button into the allocations table
 */

// Wait for DOM to be ready
function waitForDOM() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

// Wait for the allocations table to be present
function waitForAllocationsTable() {
    return new Promise((resolve) => {
        const checkTable = () => {
            const table = document.getElementById('allocations-table');
            if (table) {
                resolve(table);
            } else {
                setTimeout(checkTable, 100);
            }
        };
        checkTable();
    });
}

// Add USPS button to the 3rd column of each row in tbody
function addUSPSButtonsToTable(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.log('No tbody found in allocations table');
        return;
    }

    const rows = tbody.querySelectorAll('tr');
    console.log(`Found ${rows.length} rows in allocations table`);

    let buttonsAdded = 0;
    let buttonsSkipped = 0;

    rows.forEach((row, index) => {
        // Get the 3rd column (index 2)
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
            const thirdCell = cells[2];
            
            // Check if USPS button already exists in this cell
            if (!thirdCell.querySelector('.usps-label-button')) {
                // Create a container for the button if needed
                let buttonContainer = thirdCell.querySelector('.usps-button-container');
                if (!buttonContainer) {
                    buttonContainer = document.createElement('div');
                    buttonContainer.className = 'usps-button-container';
                    buttonContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin: 5px 0;';
                    
                    // Add the button container to the cell
                    thirdCell.appendChild(buttonContainer);
                }
                
                // Create and add the USPS button
                const uspsButton = createUSPSButton();
                buttonContainer.appendChild(uspsButton);
                
                buttonsAdded++;
                console.log(`Added USPS button to row ${index + 1}`);
            } else {
                buttonsSkipped++;
            }
        }
    });
    
    console.log(`USPS buttons: ${buttonsAdded} added, ${buttonsSkipped} already existed`);
}

// Observer to watch for dynamic content changes
function setupTableObserver(table) {
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Check if rows were added or removed
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'TR' || node.querySelector('tr')) {
                            shouldUpdate = true;
                        }
                    }
                });
                
                // Check if rows were removed (this happens when table is refreshed)
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'TR' || node.querySelector('tr')) {
                            shouldUpdate = true;
                        }
                    }
                });
            }
            
            // Also watch for attribute changes that might indicate table refresh
            if (mutation.type === 'attributes') {
                if (mutation.attributeName === 'aria-busy' || 
                    mutation.attributeName === 'class' ||
                    mutation.attributeName === 'style') {
                    shouldUpdate = true;
                }
            }
        });
        
        if (shouldUpdate) {
            console.log('Table content changed, updating USPS buttons');
            // Use a longer delay to ensure the table is fully updated
            setTimeout(() => addUSPSButtonsToTable(table), 500);
            // Also check again after a longer delay in case the table is still updating
            setTimeout(() => addUSPSButtonsToTable(table), 1500);
        }
    });
    
    // Start observing the tbody for changes
    const tbody = table.querySelector('tbody');
    if (tbody) {
        observer.observe(tbody, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-busy', 'class', 'style']
        });
        console.log('Table observer set up for dynamic content');
    }
    
    // Also observe the table itself for major changes
    const tableObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Check if tbody was replaced
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'TBODY') {
                        shouldUpdate = true;
                        // Set up observer on the new tbody
                        setTimeout(() => setupTableObserver(table), 100);
                    }
                });
            }
        });
        
        if (shouldUpdate) {
            console.log('Table structure changed, updating USPS buttons');
            setTimeout(() => addUSPSButtonsToTable(table), 500);
        }
    });
    
    tableObserver.observe(table, {
        childList: true,
        subtree: false
    });
}

// Main initialization function
async function initializeExtension() {
    try {
        console.log('Veeqo USPS Extension: Initializing...');
        
        // Mark that the extension has been initialized
        window.veeqoUSPSExtensionInitialized = true;
        
        // Wait for DOM to be ready
        await waitForDOM();
        
        // Check if we're on the correct page
        if (!isVeeqoAllocationsPage()) {
            console.log('Not on Veeqo allocations page, skipping initialization');
            return;
        }
        
        // Wait for the allocations table
        const table = await waitForAllocationsTable();
        console.log('Allocations table found');
        
        // Add USPS buttons to existing rows
        addUSPSButtonsToTable(table);
        
        // Set up observer for dynamic content
        setupTableObserver(table);
        
        console.log('Veeqo USPS Extension: Initialization complete');
        
    } catch (error) {
        console.error('Error initializing Veeqo USPS Extension:', error);
    }
}

// Start the extension
initializeExtension();

// Also run when the page becomes visible (in case of tab switching)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(initializeExtension, 500);
    }
});

// Periodic check to ensure buttons are always present
let periodicCheckInterval = null;

function startPeriodicCheck() {
    // Clear any existing interval
    if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
    }
    
    // Check every 2 seconds for missing buttons
    periodicCheckInterval = setInterval(() => {
        const table = document.getElementById('allocations-table');
        if (table && isVeeqoAllocationsPage()) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                let missingButtons = 0;
                
                rows.forEach((row) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        const thirdCell = cells[2];
                        if (!thirdCell.querySelector('.usps-label-button')) {
                            missingButtons++;
                        }
                    }
                });
                
                if (missingButtons > 0) {
                    console.log(`Found ${missingButtons} rows missing USPS buttons, adding them...`);
                    addUSPSButtonsToTable(table);
                }
            }
        }
    }, 2000);
    
    console.log('Started periodic check for USPS buttons');
}

// Start periodic check after a delay
setTimeout(startPeriodicCheck, 3000);

// Also watch for Veeqo-specific loading indicators
function watchForVeeqoLoading() {
    // Watch for loading spinners or busy indicators
    const loadingObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
                const target = mutation.target;
                if (target.getAttribute('aria-busy') === 'false') {
                    // Table finished loading, check for buttons
                    console.log('Table finished loading (aria-busy=false), checking for USPS buttons');
                    setTimeout(() => {
                        const table = document.getElementById('allocations-table');
                        if (table) {
                            addUSPSButtonsToTable(table);
                        }
                    }, 500);
                }
            }
        });
    });
    
    // Observe the table for aria-busy changes
    const table = document.getElementById('allocations-table');
    if (table) {
        loadingObserver.observe(table, {
            attributes: true,
            attributeFilter: ['aria-busy']
        });
        console.log('Started watching for Veeqo loading indicators');
    }
}

// Start watching for loading indicators
setTimeout(watchForVeeqoLoading, 1000);

// Also listen for network activity that might indicate data loading
let networkActivityTimeout = null;
const originalFetch = window.fetch;
const originalXHROpen = XMLHttpRequest.prototype.open;

// Monitor fetch requests
window.fetch = function(...args) {
    const result = originalFetch.apply(this, args);
    if (args[0] && args[0].includes && args[0].includes('veeqo.com')) {
        console.log('Detected Veeqo API call, will check for buttons after response');
        clearTimeout(networkActivityTimeout);
        networkActivityTimeout = setTimeout(() => {
            const table = document.getElementById('allocations-table');
            if (table) {
                console.log('Network activity detected, checking for USPS buttons');
                addUSPSButtonsToTable(table);
            }
        }, 1000);
    }
    return result;
};

// Monitor XMLHttpRequest
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (url && url.includes && url.includes('veeqo.com')) {
        console.log('Detected Veeqo XHR request, will check for buttons after response');
        clearTimeout(networkActivityTimeout);
        networkActivityTimeout = setTimeout(() => {
            const table = document.getElementById('allocations-table');
            if (table) {
                console.log('XHR activity detected, checking for USPS buttons');
                addUSPSButtonsToTable(table);
            }
        }, 1000);
    }
    return originalXHROpen.apply(this, [method, url, ...args]);
};
