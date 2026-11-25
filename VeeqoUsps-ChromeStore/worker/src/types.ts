export interface Env {
  SESSIONS: KVNamespace;
  /** Comma-separated allowlisted Gmail addresses */
  ALLOWED_EMAILS: string;
  /** Optional; defaults to request origin */
  PUBLIC_BASE_URL?: string;
  VEEQO_CLIENT_ID: string;
  VEEQO_CLIENT_SECRET: string;
  /** Chrome extension Google OAuth client ID */
  GOOGLE_CLIENT_ID: string;
  /** HMAC secret for OAuth state */
  STATE_SECRET: string;
}

export interface GoogleIdentity {
  email: string;
  sub: string;
  name?: string;
}

export interface VeeqoTokenRecord {
  accessToken: string;
  tokenType: string;
  createdAt: number;
  connectedAt: number;
  email: string;
}

export interface OAuthStatePayload {
  email: string;
  nonce: string;
  exp: number;
}
