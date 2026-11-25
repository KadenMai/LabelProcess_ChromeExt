import type { Env, OAuthStatePayload, VeeqoTokenRecord } from './types';

const VEEQO_AUTHORIZE = 'https://app.veeqo.com/oauth/authorize';
const VEEQO_TOKEN = 'https://api.veeqo.com/oauth/token';

function tokenKey(email: string): string {
  return `veeqo:token:${email.toLowerCase()}`;
}

function stateKey(nonce: string): string {
  return `oauth:state:${nonce}`;
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createOAuthState(
  env: Env,
  email: string
): Promise<string> {
  const payload: OAuthStatePayload = {
    email: email.toLowerCase(),
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  const body = btoa(JSON.stringify(payload));
  const sig = await hmacSign(env.STATE_SECRET, body);
  const state = `${body}.${sig}`;
  await env.SESSIONS.put(stateKey(payload.nonce), payload.email, { expirationTtl: 600 });
  return state;
}

export async function parseOAuthState(
  env: Env,
  state: string
): Promise<OAuthStatePayload> {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('Invalid state');
  const expected = await hmacSign(env.STATE_SECRET, body);
  if (!timingSafeEqual(expected, sig)) throw new Error('Invalid state signature');

  const payload = JSON.parse(atob(body)) as OAuthStatePayload;
  if (!payload.email || !payload.nonce || !payload.exp) {
    throw new Error('Invalid state payload');
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('State expired');
  }
  const stored = await env.SESSIONS.get(stateKey(payload.nonce));
  if (!stored || stored !== payload.email.toLowerCase()) {
    throw new Error('State not found or already used');
  }
  await env.SESSIONS.delete(stateKey(payload.nonce));
  return payload;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function buildAuthorizeUrl(env: Env, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.VEEQO_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: '',
    state,
  });
  return `${VEEQO_AUTHORIZE}?${params}`;
}

export async function exchangeCodeForToken(
  env: Env,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; created_at?: number }> {
  const res = await fetch(VEEQO_TOKEN, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      client_id: env.VEEQO_CLIENT_ID,
      client_secret: env.VEEQO_CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veeqo token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as {
    access_token: string;
    token_type: string;
    created_at?: number;
  };
}

export async function saveVeeqoToken(
  env: Env,
  email: string,
  token: { access_token: string; token_type: string; created_at?: number }
): Promise<VeeqoTokenRecord> {
  const record: VeeqoTokenRecord = {
    accessToken: token.access_token,
    tokenType: token.token_type || 'bearer',
    createdAt: token.created_at ?? Math.floor(Date.now() / 1000),
    connectedAt: Date.now(),
    email: email.toLowerCase(),
  };
  await env.SESSIONS.put(tokenKey(email), JSON.stringify(record));
  return record;
}

export async function getVeeqoToken(
  env: Env,
  email: string
): Promise<VeeqoTokenRecord | null> {
  const raw = await env.SESSIONS.get(tokenKey(email));
  if (!raw) return null;
  return JSON.parse(raw) as VeeqoTokenRecord;
}

export async function deleteVeeqoToken(env: Env, email: string): Promise<void> {
  await env.SESSIONS.delete(tokenKey(email));
}

export function callbackRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/auth/veeqo/callback`;
}
