# Installation Guide

## Quick Installation Steps

1. **Download the Extension**
   - Download all files from this repository
   - Keep the folder structure intact

2. **Fix Icon Issue (if you get an error)**
   - If you see "Could not load icon" error, you have two options:
   - **Option A**: Open `icon-generator.html` in your browser, right-click each icon and save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder
   - **Option B**: The extension works fine without icons, just ignore the error

3. **Open Chrome Extensions Page**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Or click the three dots menu → More tools → Extensions

4. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

5. **Load the Extension**
   - Click "Load unpacked" button
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

6. **Verify Installation**
   - You should see "Veeqo USPS Label Manager" in your extensions list
   - Make sure it's enabled (toggle switch should be on)

## Testing the Extension

1. **Navigate to Veeqo**
   - Go to `https://app.veeqo.com/orders`
   - Make sure you're on a page with the allocations table

2. **Look for USPS Buttons**
   - In the allocations table, you should see blue "USPS" buttons in the 3rd column
   - Each row should have its own USPS button

3. **Test the Functionality**
   - Click any USPS button
   - A new tab should open with the USPS Label Manager

## Troubleshooting

### Extension Not Working
- Check that you're on the correct Veeqo page (`app.veeqo.com/orders`)
- Refresh the page after installing the extension
- Check the browser console for any error messages

### Buttons Not Appearing
- Make sure the allocations table is loaded
- Try refreshing the page
- Check if the table has the id "allocations-table"

### USPS Page Not Opening
- Check your internet connection
- Verify the USPS URL is accessible: `https://cnsb.usps.com/label-manager/new-label/quick`
- Check if popup blockers are interfering

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Veeqo USPS Label Manager"
3. Click "Remove"
4. Confirm the removal

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify all files are in the correct locations
3. Make sure you're using a compatible browser (Chrome, Edge, etc.)
