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

## Build & install (WXT — current version)

The extension is built with [WXT](https://wxt.dev/) from **`wxt/OrderMgmt-Ext`**, not from the repo root. Running `npm run build` at the root will fail with *“No entrypoints found”*.

```powershell
cd wxt\OrderMgmt-Ext
npm install
npm run build
```

Load the built extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select `wxt\OrderMgmt-Ext\.output\chrome-mv3`

For development with auto-rebuild:

```powershell
cd wxt\OrderMgmt-Ext
npm run dev
```

Then reload the extension in Chrome after code changes.

## Installation (legacy unpacked layout)

The root `manifest.json` + `js/` folder is an older layout. Prefer the WXT build above. If you still use the legacy folder:

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will be installed and ready to use

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

**WXT project (use this):**

```
wxt/OrderMgmt-Ext/
├── entrypoints/               # popup, options, background (WXT entrypoints)
├── public/content/            # Veeqo + USPS content scripts
├── wxt.config.ts
├── package.json
└── .output/chrome-mv3/        # Created by `npm run build` — load this in Chrome
```

**Legacy (repo root):**

```
├── manifest.json              # Extension manifest
├── popup.html                 # Extension popup (settings)
├── options.html               # Advanced settings page
├── js/
│   ├── error-handler.js       # Content-script error handling
│   ├── extension-recovery.js  # Recovery after extension context invalidation
│   ├── usps-functions.js      # USPS-related functions
│   ├── veeqo-api.js           # Veeqo API integration
│   ├── api-proxy.js           # API proxy helpers (Veeqo page)
│   ├── print-functions.js     # Print delivery instructions
│   ├── content-script.js      # Main content script
│   ├── usps-autofill.js       # USPS Label Manager autofill
│   ├── background.js          # Background service worker
│   ├── popup.js               # Popup functionality
│   └── options.js             # Options page functionality
├── css/
│   └── usps-button.css        # Button styling
└── README.md                  # This file
```

## Technical Details

- **Manifest Version**: 3 (Chrome Extension Manifest V3)
- **Permissions**: activeTab, tabs, storage
- **Content Scripts**: Veeqo (`*://app.veeqo.com/*`), USPS Label Manager (`*://cnsb.usps.com/*`)
- **Target Table**: `#allocations-table`
- **Target Column**: 3rd column (index 2)
- **USPS URL**: `https://cnsb.usps.com/label-manager/new-label/quick`

## Development

Work in `wxt/OrderMgmt-Ext/`. Main sources:

- `public/content/veeqo/content-script.js` — allocations table UI (USPS, Fill Order Data, Print Note)
- `public/content/usps/usps-autofill.js` — USPS label autofill
- `entrypoints/background.ts` — API proxy, print templates
- `entrypoints/popup/` — settings UI (React)

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## License

This project is for internal use. Please ensure compliance with Veeqo's terms of service and USPS usage policies.
