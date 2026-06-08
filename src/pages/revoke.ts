import { Env, Session } from "../types.js";
import { getPublicBase } from "../utils.js";

export async function handleRevoke(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ms = url.searchParams.get("s") ?? "";
  const base = getPublicBase(request);
  const form = await request.formData();
  const token = (form.get("token") as string) ?? "";
  const current = (form.get("current") as string) ?? "";
  const ref = (form.get("ref") as string) ?? "";

  if (token) {
    const session = await env.SESSIONS.get<Session>(`session:${token}`, "json");
    await env.SESSIONS.delete(`session:${token}`);
    if (session) {
      const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${session.email}`, "json") ?? [];
      await env.SESSIONS.put(`user:${session.email}`, JSON.stringify(list.filter(e => e.token !== token)));
    }
  }

  if (ref === "logout") {
    return Response.redirect(`${base}/setup`, 302);
  }
  return Response.redirect(`${base}/setup?s=${ms}&t=${current}`, 302);
}

export async function handleRevokeAll(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ms = url.searchParams.get("s") ?? "";
  const base = getPublicBase(request);
  const form = await request.formData();
  const current = (form.get("current") as string) ?? "";
  const msData = await env.SESSIONS.get<{ email: string }>(`manage:${ms}`, "json");
  if (msData) {
    const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${msData.email}`, "json") ?? [];
    const previous = list.filter(e => e.token !== current);
    await Promise.all(previous.map(e => env.SESSIONS.delete(`session:${e.token}`)));
    await env.SESSIONS.put(`user:${msData.email}`, JSON.stringify(list.filter(e => e.token === current)));
  }
  return Response.redirect(`${base}/setup?s=${ms}&t=${current}`, 302);
}
