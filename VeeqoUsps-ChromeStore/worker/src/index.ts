import { isEmailAllowed } from './allowlist';
import { extractBearer, verifyGoogleAccessToken } from './google';
import type { Env } from './types';
import {
  buildAuthorizeUrl,
  callbackRedirectUri,
  createOAuthState,
  deleteVeeqoToken,
  exchangeCodeForToken,
  getVeeqoToken,
  parseOAuthState,
  saveVeeqoToken,
} from './veeqo';

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function baseUrl(env: Env, request: Request): string {
  if (env.PUBLIC_BASE_URL?.trim()) return env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

async function requireGoogleUser(env: Env, request: Request, tokenOverride?: string | null) {
  const token = tokenOverride || extractBearer(request);
  if (!token) throw new Error('Missing Google access token');
  const identity = await verifyGoogleAccessToken(env, token);
  if (!isEmailAllowed(env, identity.email)) {
    const err = new Error('Email is not allowlisted for this extension');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return identity;
}

function successPage(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Veeqo connected</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1.25rem; color: #1a1a1a; }
    h1 { font-size: 1.35rem; margin-bottom: 0.5rem; }
    p { line-height: 1.5; color: #444; }
    code { background: #f3f3f3; padding: 0.1em 0.35em; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Veeqo connected</h1>
  <p>Signed in as <code>${escapeHtml(email)}</code>. You can close this tab and return to the Chrome extension.</p>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connection failed</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1.25rem; color: #1a1a1a; }
    h1 { font-size: 1.35rem; color: #b00020; }
  </style>
</head>
<body>
  <h1>Connection failed</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      if (url.pathname === '/health') {
        return json(request, { ok: true });
      }

      // Extension: verify Google login + allowlist
      if (url.pathname === '/api/me' && request.method === 'GET') {
        const identity = await requireGoogleUser(env, request);
        const veeqo = await getVeeqoToken(env, identity.email);
        return json(request, {
          email: identity.email,
          allowed: true,
          veeqoConnected: !!veeqo,
          connectedAt: veeqo?.connectedAt ?? null,
        });
      }

      // Extension: fetch Veeqo Bearer token for API calls
      if (url.pathname === '/api/veeqo/token' && request.method === 'GET') {
        const identity = await requireGoogleUser(env, request);
        const veeqo = await getVeeqoToken(env, identity.email);
        if (!veeqo) {
          return json(request, { error: 'Veeqo not connected' }, 404);
        }
        return json(request, {
          accessToken: veeqo.accessToken,
          tokenType: veeqo.tokenType,
          connectedAt: veeqo.connectedAt,
        });
      }

      // Extension: disconnect Veeqo for this Google account
      if (url.pathname === '/api/veeqo/disconnect' && request.method === 'POST') {
        const identity = await requireGoogleUser(env, request);
        await deleteVeeqoToken(env, identity.email);
        return json(request, { ok: true });
      }

      // Start Veeqo OAuth (opened in a browser tab from the extension)
      if (url.pathname === '/auth/veeqo/start' && request.method === 'GET') {
        const googleToken = url.searchParams.get('token');
        if (!googleToken) {
          return html(errorPage('Missing Google token. Open Connect Veeqo from the extension.'), 400);
        }
        const identity = await requireGoogleUser(env, request, googleToken);
        if (!env.VEEQO_CLIENT_ID || !env.VEEQO_CLIENT_SECRET || !env.STATE_SECRET) {
          return html(
            errorPage('Worker is not configured. Set VEEQO_CLIENT_ID, VEEQO_CLIENT_SECRET, and STATE_SECRET.'),
            500
          );
        }
        const redirectUri = callbackRedirectUri(baseUrl(env, request));
        const state = await createOAuthState(env, identity.email);
        const authorizeUrl = buildAuthorizeUrl(env, redirectUri, state);
        return Response.redirect(authorizeUrl, 302);
      }

      // Veeqo OAuth callback
      if (url.pathname === '/auth/veeqo/callback' && request.method === 'GET') {
        const err = url.searchParams.get('error');
        if (err) {
          return html(errorPage(`Veeqo authorization denied: ${err}`), 400);
        }
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) {
          return html(errorPage('Missing code or state from Veeqo.'), 400);
        }
        const payload = await parseOAuthState(env, state);
        if (!isEmailAllowed(env, payload.email)) {
          return html(errorPage('Email is not allowlisted.'), 403);
        }
        const redirectUri = callbackRedirectUri(baseUrl(env, request));
        const token = await exchangeCodeForToken(env, code, redirectUri);
        await saveVeeqoToken(env, payload.email, token);
        return html(successPage(payload.email));
      }

      if (url.pathname === '/' || url.pathname === '') {
        return html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Veeqo USPS Auth</title></head>
<body style="font-family:system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem">
  <h1>Veeqo USPS Auth Worker</h1>
  <p>OAuth callback + allowlist for the Chrome Store extension. Use <strong>Connect Veeqo</strong> from the extension popup.</p>
</body></html>`);
      }

      return json(request, { error: 'Not found' }, 404);
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err.status ?? 401;
      const message = err.message || 'Unauthorized';
      if (url.pathname.startsWith('/auth/')) {
        return html(errorPage(message), status);
      }
      return json(request, { error: message }, status);
    }
  },
} satisfies ExportedHandler<Env>;
