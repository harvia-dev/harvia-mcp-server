/// <reference types="@cloudflare/workers-types" />

export interface Env {
  SESSIONS: KVNamespace;
}

export interface Session {
  idToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}
