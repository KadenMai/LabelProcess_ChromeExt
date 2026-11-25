# Veeqo USPS — Chrome Store edition

Google allowlist + **Connect Veeqo** (OAuth Bearer) via a Cloudflare Worker. No shared or pasted Veeqo API keys.

```
VeeqoUsps-ChromeStore/
  extension/   # WXT Chrome extension (MV3)
  worker/      # Cloudflare Worker — OAuth callback, allowlist, token store
```

## Architecture

1. User signs in with **Google** (`chrome.identity`) — must be on the Worker allowlist.
2. User clicks **Connect Veeqo** → Worker starts Veeqo OAuth → callback stores a permanent access token in KV (keyed by Gmail).
3. Extension syncs the token and calls `https://api.veeqo.com` with `Authorization: Bearer …`.

## Tests

Vitest covers Worker functions/routes and extension auth + label helpers. No live Google/Veeqo credentials required (fetch and Chrome APIs are mocked).

### Run everything

```bash
cd VeeqoUsps-ChromeStore
npm test --prefix worker
npm test --prefix extension
# or from this folder after installing both packages:
npm test
```

### Worker only

```bash
cd worker
npm install
npm test              # one-shot
npm run test:watch    # watch mode
```

Covers:

| Area | File | What it asserts |
|------|------|-----------------|
| Allowlist | `tests/allowlist.test.ts` | parse list, fail-closed empty list, case-insensitive match |
| Google token | `tests/google.test.ts` | Bearer extract, tokeninfo OK/fail, audience, unverified email |
| Veeqo OAuth helpers | `tests/veeqo.test.ts` | authorize URL, state HMAC round-trip/tamper/expire/reuse, KV token CRUD, code exchange |
| Full HTTP processes | `tests/routes.test.ts` | `/health`, CORS, `/api/me`, `/api/veeqo/token`, disconnect, OAuth start→callback, allowlist denials |

### Extension only

```bash
cd extension
npm install
npm test
npm run test:watch
```

Covers:

| Area | File | What it asserts |
|------|------|-----------------|
| Auth config | `utils/authConfig.test.ts` | Bearer headers, storage token, Worker URL default/trim |
| Worker client | `utils/workerAuth.test.ts` | Google token, `/api/me` status, sync/disconnect token, Connect tab URL, sign-out |
| Daily labels helpers | `utils/dailyLabels.test.ts` | UPS shipment detection, buy-time stamp format |

### Manual smoke (after deploy)

1. Load unpacked build (`cd extension && npm run build` → `.output/chrome-mv3`).
2. Set Auth Worker URL → **Sign in with Google** (allowlisted) → **Connect Veeqo** → **Refresh status** → **Test Veeqo API**.
3. On `app.veeqo.com`, confirm USPS button still injects; on USPS confirmation, Mark Shipped uses the synced Bearer token.

## 1. Cloudflare Worker

```bash
cd worker
npm install
npx wrangler kv namespace create veeqo-usps-sessions
npx wrangler kv namespace create veeqo-usps-sessions --preview
```

Put the returned IDs into `wrangler.toml` (`id` / `preview_id`).

Set secrets:

```bash
npx wrangler secret put VEEQO_CLIENT_ID
npx wrangler secret put VEEQO_CLIENT_SECRET
npx wrangler secret put STATE_SECRET          # long random string
npx wrangler secret put GOOGLE_CLIENT_ID      # same as extension oauth2.client_id
```

Edit `[vars]` in `wrangler.toml`:

- `ALLOWED_EMAILS` — comma-separated Gmail addresses
- optionally `PUBLIC_BASE_URL` — public Worker URL (no trailing slash)

Deploy:

```bash
npx wrangler deploy
```

Note the Worker URL, e.g. `https://veeqo-usps-auth.<account>.workers.dev`.

### Worker routes

| Path | Purpose |
|------|---------|
| `GET /api/me` | Verify Google token + allowlist; Veeqo connection status |
| `GET /api/veeqo/token` | Return stored Veeqo Bearer token |
| `POST /api/veeqo/disconnect` | Remove stored token |
| `GET /auth/veeqo/start?token=` | Start Veeqo OAuth (opened by extension) |
| `GET /auth/veeqo/callback` | Veeqo redirect URI |

## 2. Veeqo OAuth app

Email [helpme@support.veeqo.com](mailto:helpme@support.veeqo.com) with:

- App name (e.g. Veeqo USPS Label Manager)
- Redirect URI: `https://<your-worker>/auth/veeqo/callback`

They return `client_id` and `client_secret` — store them as Worker secrets.

Docs: [Veeqo Authentication](https://developers.veeqo.com/getting-started/authentication/)

## 3. Google OAuth (Chrome extension)

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. APIs & Services → Credentials → **Create OAuth client ID** → Application type: **Chrome Extension**.
3. Use the extension ID from `chrome://extensions` (after first load) or from the Chrome Web Store listing.
4. Put that client ID in:
   - `extension/wxt.config.ts` → `manifest.oauth2.client_id`
   - Worker secret `GOOGLE_CLIENT_ID`

## 4. Extension

```bash
cd extension
npm install
```

1. Set `GOOGLE_OAUTH_CLIENT_ID` in `wxt.config.ts`.
2. `npm run dev` or `npm run build` → load `extension/.output/chrome-mv3` (or zip via `npm run zip`).
3. In the popup **Settings** tab, set **Auth Worker URL** to your deployed Worker.
4. **Sign in with Google** → **Connect Veeqo** → **Refresh status**.

## 5. Chrome Web Store

1. Package: `cd extension && npm run zip`
2. Upload the zip in the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. After publication, update the Google OAuth client with the **Store extension ID** (it may differ from your unpacked ID).
4. Privacy / single purpose: state that Google login is for allowlisting operators and Veeqo OAuth is for order/shipping API access.

## Local vs API-key fork

| | `wxt/OrderMgmt-Ext` | `VeeqoUsps-ChromeStore` |
|--|---------------------|-------------------------|
| Auth | Paste `Vqt/…` API key | Google allowlist + Veeqo OAuth |
| Token storage | Browser only | Cloudflare KV per Gmail |
| Store-ready | Internal / unpacked | Designed for Chrome Store |

## Ops notes

- Allowlist changes: update `ALLOWED_EMAILS` in the Worker dashboard (or `wrangler.toml` + redeploy).
- Revoke Veeqo access: user **Disconnect Veeqo**, or delete KV key `veeqo:token:<email>`.
- Veeqo issues a long-lived access token (no refresh flow in their docs); reconnect if API calls start returning 401.
