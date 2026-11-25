import { defineConfig } from 'wxt';

/**
 * Chrome Store build — Google allowlist + Veeqo OAuth (Bearer) via Cloudflare Worker.
 *
 * Replace GOOGLE_OAUTH_CLIENT_ID before packaging for the Store.
 */
const GOOGLE_OAUTH_CLIENT_ID =
  'REPLACE_WITH_CHROME_EXTENSION_CLIENT_ID.apps.googleusercontent.com';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Veeqo USPS Label Manager',
    version: '2.0.0',
    description:
      'USPS label autofill and Mark Shipped for Veeqo — Google sign-in + Connect Veeqo (OAuth)',
    permissions: [
      'activeTab',
      'tabs',
      'scripting',
      'storage',
      'downloads',
      'downloads.open',
      'identity',
    ],
    host_permissions: [
      'https://api.veeqo.com/*',
      'https://cnsb.usps.com/*',
      'https://cns.usps.com/*',
      'https://*.workers.dev/*',
      'https://oauth2.googleapis.com/*',
      'https://accounts.google.com/*',
    ],
    oauth2: {
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
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
          'content/veeqo/print/qrcode.min.js',
          'content/veeqo/thank-you.js',
          'content/veeqo/content-script.js',
        ],
        css: ['css/veeqo/usps-button.css'],
        run_at: 'document_end',
      },
      {
        matches: ['*://cnsb.usps.com/*', '*://cns.usps.com/*'],
        js: ['content/usps/usps-autofill.js', 'content/usps/usps-confirmation.js'],
        run_at: 'document_end',
      },
    ],
  },
});
