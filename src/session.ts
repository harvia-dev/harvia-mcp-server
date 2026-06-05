import { Env, Session } from "./types.js";
import { generateToken } from "./utils.js";
import { refreshWithToken } from "./auth.js";

export async function getValidIdToken(env: Env, sessionToken: string, session: Session): Promise<string> {
  if (Date.now() < session.expiresAt - 60_000) {
    return session.idToken;
  }
  const refreshed = await refreshWithToken(session.refreshToken, session.email);
  const updated: Session = { ...session, ...refreshed };
  await env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(updated), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
  return updated.idToken;
}

export async function createManageSession(env: Env, email: string, session: Session): Promise<string> {
  const ms = generateToken();
  await env.SESSIONS.put(`manage:${ms}`, JSON.stringify({ email, idToken: session.idToken, refreshToken: session.refreshToken, expiresAt: session.expiresAt }), { expirationTtl: 3600 });
  return ms;
}

export async function createMcpSession(env: Env, email: string, session: Session): Promise<string> {
  const sessionToken = generateToken();
  await env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: 365 * 24 * 60 * 60,
  });
  const existing = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${email}`, "json") ?? [];
  existing.push({ token: sessionToken, createdAt: Date.now() });
  await env.SESSIONS.put(`user:${email}`, JSON.stringify(existing));
  return sessionToken;
}
