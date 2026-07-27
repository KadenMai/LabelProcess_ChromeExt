import { defineConfig } from 'wxt';

/**
 * Content scripts under public/content/:
 * - veeqo: app.veeqo.com (error/recovery, USPS UI, api, delivery-instructions, main content) · see css/veeqo for Veeqo styles
 * - usps: cnsb.usps.com autofill
 */
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Veeqo USPS Label Manager',
    version: '1.0',
    description:
      'Adds USPS button to Veeqo allocations table for quick access to USPS label manager',
    permissions: ['activeTab', 'tabs', 'scripting', 'storage', 'downloads', 'downloads.open'],
    host_permissions: ['https://api.veeqo.com/*', 'https://cnsb.usps.com/*'],
    content_scripts: [
      {
        matches: ['*://app.veeqo.com/*'],
        js: [
          'content/veeqo/error-handler.js',
          'content/veeqo/extension-recovery.js',
          'content/veeqo/usps-functions.js',
          'content/veeqo/api/veeqo-api.js',
          'content/veeqo/api/api-proxy.js',
          'content/veeqo/delivery-instructions.js',
          'content/veeqo/content-script.js',
        ],
        css: ['css/veeqo/usps-button.css'],
        run_at: 'document_end',
      },
      {
        matches: ['*://cnsb.usps.com/*'],
        js: ['content/usps/usps-autofill.js'],
        run_at: 'document_end',
      },
    ],
  },
});
