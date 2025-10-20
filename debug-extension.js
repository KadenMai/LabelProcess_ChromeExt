/**
 * Debug script to help troubleshoot the USPS button disappearing issue
 * Add this to the content script to get detailed logging
 */

// Debug function to check button status
function debugButtonStatus() {
    const table = document.getElementById('allocations-table');
    if (!table) {
        console.log('🔍 DEBUG: No allocations table found');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.log('🔍 DEBUG: No tbody found');
        return;
    }
    
    const rows = tbody.querySelectorAll('tr');
    console.log(`🔍 DEBUG: Found ${rows.length} rows in table`);
    
    let buttonsFound = 0;
    let buttonsMissing = 0;
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
            const thirdCell = cells[2];
            const button = thirdCell.querySelector('.usps-label-button');
            if (button) {
                buttonsFound++;
                console.log(`✅ Row ${index + 1}: USPS button found`);
            } else {
                buttonsMissing++;
                console.log(`❌ Row ${index + 1}: USPS button missing`);
                
                // Check what's in the third cell
                console.log(`   Third cell content:`, thirdCell.innerHTML);
            }
        }
    });
    
    console.log(`🔍 DEBUG SUMMARY: ${buttonsFound} buttons found, ${buttonsMissing} buttons missing`);
    
    // Check table loading state
    const ariaBusy = table.getAttribute('aria-busy');
    console.log(`🔍 DEBUG: Table aria-busy = "${ariaBusy}"`);
    
    // Check if table has loading indicators
    const loadingElements = table.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="busy"]');
    console.log(`🔍 DEBUG: Found ${loadingElements.length} loading indicators`);
}

// Run debug check every 3 seconds
setInterval(debugButtonStatus, 3000);

// Also run when table changes
const table = document.getElementById('allocations-table');
if (table) {
    const debugObserver = new MutationObserver(() => {
        console.log('🔍 DEBUG: Table mutation detected');
        setTimeout(debugButtonStatus, 100);
    });
    
    debugObserver.observe(table, {
        childList: true,
        subtree: true,
        attributes: true
    });
    
    console.log('🔍 DEBUG: Started table mutation observer');
}

console.log('🔍 DEBUG: Debug script loaded');
