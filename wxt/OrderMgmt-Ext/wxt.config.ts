import { defineConfig } from 'wxt';

// Unbundled legacy scripts live in public/ (see public/veeqo-legacy, public/js) for global scope parity with the pre-WXT extension.
export default defineConfig({
  manifest: {
    name: 'Veeqo USPS Label Manager',
    version: '1.0',
    description:
      'Adds USPS button to Veeqo allocations table for quick access to USPS label manager',
    permissions: ['activeTab', 'tabs', 'scripting', 'storage'],
    host_permissions: ['https://api.veeqo.com/*', 'https://cnsb.usps.com/*'],
    content_scripts: [
      {
        matches: ['*://app.veeqo.com/*'],
        js: [
          'veeqo-legacy/error-handler.js',
          'veeqo-legacy/extension-recovery.js',
          'veeqo-legacy/usps-functions.js',
          'veeqo-legacy/veeqo-api.js',
          'veeqo-legacy/api-proxy.js',
          'veeqo-legacy/print-functions.js',
          'veeqo-legacy/content-script.js',
        ],
        css: ['veeqo-legacy/usps-button.css'],
        run_at: 'document_end',
      },
      {
        matches: ['*://cnsb.usps.com/*'],
        js: ['js/usps-autofill.js'],
        run_at: 'document_end',
      },
    ],
  },
});
