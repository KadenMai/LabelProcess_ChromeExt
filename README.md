# Veeqo USPS Label Manager Chrome Extension

A Chrome extension that adds a USPS button to the Veeqo allocations table for quick access to the USPS label manager.

## Features

- Adds a "USPS" button to the 3rd column of each row in the Veeqo allocations table
- Clicking the button opens the USPS Label Manager in a new tab
- Automatically handles dynamic content updates in the table
- Clean, professional styling that matches Veeqo's design
- **NEW**: Optional Veeqo API integration for enhanced functionality
- Secure API key storage in browser
- Settings page for easy configuration

## Installation

1. Download or clone this repository
2. **Fix Icons (if needed)**: If you get an icon loading error:
   - Open `icon-generator.html` in your browser
   - Right-click each icon and save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder
   - Or use the extension without icons (it will work fine)
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension folder
6. The extension will be installed and ready to use

## Usage

### Basic Usage
1. Navigate to your Veeqo orders page (`app.veeqo.com/orders`)
2. Look for the allocations table with id="allocations-table"
3. You'll see a blue "USPS" button in the 3rd column of each row
4. Click the button to open the USPS Label Manager in a new tab

### Advanced Usage (with API Key)
1. Click the extension icon in your browser toolbar
2. Enter your Veeqo API key (get it from Veeqo Settings → API Keys)
3. Click "Test Connection" to verify your key works
4. Click "Save Settings" to store your key securely
5. The extension will now have access to order data for enhanced functionality

### API Key Setup
1. Log into your Veeqo account
2. Go to Settings → API Keys
3. Create a new API key or use an existing one
4. Copy the key (starts with "Vqt/")
5. Paste it in the extension settings

## File Structure

```
├── manifest.json              # Extension manifest
├── popup.html                 # Extension popup (settings)
├── options.html               # Advanced settings page
├── js/
│   ├── usps-functions.js      # USPS-related functions
│   ├── veeqo-api.js          # Veeqo API integration
│   ├── content-script.js      # Main content script
│   ├── background.js          # Background service worker
│   ├── popup.js              # Popup functionality
│   └── options.js            # Options page functionality
├── css/
│   └── usps-button.css        # Button styling
├── icons/                     # Extension icons (16px, 48px, 128px)
└── README.md                  # This file
```

## Technical Details

- **Manifest Version**: 3 (Chrome Extension Manifest V3)
- **Permissions**: activeTab, tabs, storage
- **Content Scripts**: Injected on `*://app.veeqo.com/*`
- **Target Table**: `#allocations-table`
- **Target Column**: 3rd column (index 2)
- **USPS URL**: `https://cnsb.usps.com/label-manager/new-label/quick`

## Development

The extension is built with modular architecture:

- `usps-functions.js`: Contains the core USPS functionality
- `content-script.js`: Handles DOM manipulation and button injection
- `background.js`: Manages tab creation and extension lifecycle
- `usps-button.css`: Provides styling for the USPS button

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## License

This project is for internal use. Please ensure compliance with Veeqo's terms of service and USPS usage policies.
