import type { Env, GoogleIdentity } from './types';

/**
 * Verify a Google access token from chrome.identity.getAuthToken.
 * Uses Google's tokeninfo endpoint and checks audience against our client ID.
 */
export async function verifyGoogleAccessToken(
  env: Env,
  accessToken: string
): Promise<GoogleIdentity> {
  const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Invalid Google access token');
  }
  const data = (await res.json()) as {
    email?: string;
    sub?: string;
    aud?: string;
    azp?: string;
    error?: string;
    email_verified?: string;
  };

  if (data.error || !data.email || !data.sub) {
    throw new Error('Google token missing email');
  }

  const expected = env.GOOGLE_CLIENT_ID?.trim();
  if (expected) {
    const aud = data.aud || data.azp || '';
    // Chrome extension clients often appear as azp; accept either match
    if (aud !== expected && data.azp !== expected && data.aud !== expected) {
      // tokeninfo for access tokens may return the numeric project number as aud —
      // also accept when azp matches the OAuth client id
      if (data.azp !== expected) {
        throw new Error('Google token audience mismatch');
      }
    }
  }

  if (data.email_verified === 'false') {
    throw new Error('Google email is not verified');
  }

  return {
    email: data.email.toLowerCase(),
    sub: data.sub,
  };
}

export function extractBearer(request: Request): string | null {
  const h = request.headers.get('Authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}
