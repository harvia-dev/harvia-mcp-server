import { Env, Session } from "../types.js";
import { escapeHtml, getPublicBase } from "../utils.js";
import { BRAND_FONTS, BRAND_CSS, setupHeader } from "../templates.js";
import { createManageSession, createMcpSession } from "../session.js";
import { loginWithCredentials } from "../auth.js";
import { renderSetupSuccess } from "./success.js";

export async function handleSetupPage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const base = getPublicBase(request);
  const ms = url.searchParams.get("s");

  // If a valid manage session exists, skip re-auth
  if (ms) {
    const msData = await env.SESSIONS.get<{ email: string; idToken: string; refreshToken: string; expiresAt: number }>(`manage:${ms}`, "json");
    if (msData) {
      // If an existing token is provided (e.g. after revoke-previous), show it without generating a new one
      const t = url.searchParams.get("t");
      if (t) {
        const existing = await env.SESSIONS.get<Session>(`session:${t}`, "json");
        if (existing) {
          return renderSetupSuccess(request, env, msData.email, t, ms);
        }
      }
      // Otherwise generate a new token
      const session: Session = { email: msData.email, idToken: msData.idToken, refreshToken: msData.refreshToken, expiresAt: msData.expiresAt };
      const sessionToken = await createMcpSession(env, msData.email, session);
      return renderSetupSuccess(request, env, msData.email, sessionToken, ms);
    }
  }

  const hasError = url.searchParams.has("error");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Harvia — Claude Setup</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:400px;overflow:hidden;}
.card-body{padding:2rem;}
.tagline{font-family:'Montserrat',sans-serif;font-weight:700;font-size:.85rem;color:var(--text2);letter-spacing:.05em;margin-bottom:1.25rem;}
h1{font-size:1.3rem;color:var(--text);margin-bottom:.4rem;}
.subtitle{font-size:.875rem;color:var(--text2);margin-bottom:1.75rem;line-height:1.5;}
label{display:block;font-size:.8rem;font-weight:500;color:var(--text2);margin-bottom:.3rem;margin-top:1rem;letter-spacing:.03em;}
input{width:100%;padding:.65rem .8rem;border:1px solid var(--light-gray);border-radius:6px;font-size:.95rem;font-family:'Noto Sans',sans-serif;color:var(--text);background:var(--cream);transition:border-color .15s;}
input:focus{outline:none;border-color:var(--red);}
.error-msg{background:#FFF0F0;border:1px solid #f5c4c4;border-radius:6px;padding:.65rem .9rem;font-size:.825rem;color:#7a2020;margin-top:1rem;}
button[type=submit]{margin-top:1.5rem;width:100%;padding:.8rem;background:var(--red);color:white;border:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.95rem;cursor:pointer;letter-spacing:.03em;transition:background .15s;}
button[type=submit]:hover{background:var(--deep-red);}
footer{text-align:center;padding:1.5rem;font-size:.75rem;color:var(--text2);}
</style>
</head>
<body>
${setupHeader()}
<main>
<div class="card">
<div class="card-body">
  <p class="tagline">Let's sauna.</p>
  <h1>Start using Harvia MCP server</h1>
  <p class="subtitle">Sign in with your MyHarvia account to get a personal URL for using the MCP server and step-by-step instructions.</p>
  <form method="POST" action="${escapeHtml(base + "/setup")}">
    ${hasError ? `<div class="error-msg">Incorrect email or password. Please try again.</div>` : ""}
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@example.com">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
    <button type="submit">Get my personal URL</button>
  </form>
  <p style="font-size:.75rem;color:var(--text2);margin-top:1.25rem;">Use your MyHarvia credentials &mdash; the same ones you use in the MyHarvia app.</p>
</div>
</div>
</main>
<footer>Created by <a href="https://www.harvialabs.com/" target="_blank" rel="noopener" style="color:inherit;">Harvia Labs</a>. &copy; 2026 Harvia</footer>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

export async function handleSetupSubmit(request: Request, env: Env): Promise<Response> {
  const base = getPublicBase(request);
  const form = await request.formData();
  const email = ((form.get("email") as string) ?? "").trim();
  const password = (form.get("password") as string) ?? "";

  let session: Session;
  try {
    session = await loginWithCredentials(email, password);
  } catch {
    return Response.redirect(`${base}/setup?error=1`, 302);
  }

  const sessionToken = await createMcpSession(env, email, session);
  const ms = await createManageSession(env, email, session);
  return renderSetupSuccess(request, env, email, sessionToken, ms);
}
