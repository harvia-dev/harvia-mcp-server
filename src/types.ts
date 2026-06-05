/// <reference types="@cloudflare/workers-types" />

/** Cloudflare Worker bindings — SESSIONS is the KV namespace that stores all session data. */
export interface Env {
  SESSIONS: KVNamespace;
}

/** A live user session: Harvia ID/refresh tokens plus enough metadata to renew them. */
export interface Session {
  idToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}
