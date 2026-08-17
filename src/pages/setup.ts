import { Env, Session } from "../types.js";
import { escapeHtml, getPublicBase } from "../utils.js";
import { BRAND_FONTS, stylesLink, THEME_COLOR, setupHeader, siteFooter } from "../templates.js";
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
  const mcpUrl = base + "/mcp";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Harvia — Claude Setup</title>
${THEME_COLOR}
${BRAND_FONTS}
${stylesLink(base)}
<style>
.su-hero{margin-bottom:1.75rem;}
.su-hero h1{margin-bottom:.85rem;max-width:20ch;}
.su-hero .subtitle{max-width:54ch;}
.su-url-row{
  display:flex;align-items:center;gap:.7rem;
  background:#000;border:1px solid var(--line-strong);border-radius:var(--radius);
  padding:.7rem .8rem;margin-bottom:1.75rem;
}
.su-url-row code{flex:1;font-size:.8rem;color:var(--text);word-break:break-all;}
.su-instructions{margin-bottom:.75rem;}
.instruction-body>.notice-beta{margin-bottom:1.15rem;}
.instruction-body>.org-note{margin:.35rem 0 1rem;}
.su-divider{margin:3rem 0;}
.card.alt{background:var(--bg-1);}
.card.alt h2{font-size:1.15rem;margin-bottom:.5rem;}
.card.alt .alt-label{margin-bottom:1.15rem;}
.card.alt .subtitle{font-size:.875rem;}
.su-submit{width:100%;margin-top:1.75rem;padding:.9rem;font-size:.9rem;}
.su-hint{margin-top:1.25rem;}
</style>
</head>
<body>
${setupHeader()}
<main>
  <div class="column">

  <!-- Primary: OAuth path -->
  <div class="su-hero">
    <h1>Getting started with Harvia MCP server</h1>
    <p class="subtitle">Add the Harvia MCP server as a connector. You'll be asked to sign in with your MyHarvia account when connecting.</p>
  </div>

  <div class="su-url-row">
    <code id="mcp-url">${escapeHtml(mcpUrl)}</code>
    <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(mcpUrl)}').then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})">Copy</button>
  </div>

  <div class="su-instructions">
    <details class="instruction" open>
      <summary>Claude</summary>
      <div class="instruction-body">
        <div class="notice-beta">
          <strong>Beta feature</strong> — Connectors in Claude.ai are currently in beta and subject to change.
          <ul>
            <li>Adding custom connectors is only available on <strong>personal accounts</strong>. Members of team workspaces need to contact their admins to add the Harvia MCP server to their workspace.</li>
            <li>Free plan users can currently have <strong>one custom connector</strong> at a time.</li>
          </ul>
        </div>
        <div class="step-row"><div class="step-dot">1</div><p>Open <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a></p></div>
        <div class="step-row"><div class="step-dot">2</div><p>Click <strong>Customize</strong> in the left sidebar</p></div>
        <div class="step-row"><div class="step-dot">3</div><p>Select <strong>Connectors</strong></p></div>
        <p class="org-note">If you are a <strong>team workspace</strong> user, and your organization has already enabled the Harvia MCP server, find the MCP server from the list of connectors and connect to it. If you are using a <strong>personal</strong> account, continue to steps 4-6 below.</p>
        <div class="step-row"><div class="step-dot">4</div><p>Press the <strong>+</strong> icon and select <strong>Add custom connector</strong></p></div>
        <div class="step-row"><div class="step-dot">5</div><p>Give the server a name (e.g. <strong>"Harvia"</strong>), paste the URL above and click <strong>Add</strong></p></div>
        <div class="step-row"><div class="step-dot">6</div><p><strong>Connect</strong> to the server and sign in with your MyHarvia account when prompted</p></div>
      </div>
    </details>

    <p class="more-soon">More instructions coming soon</p>
  </div>

  <div class="divider su-divider"></div>

  <!-- Alternative: personal URL -->
  <div class="card alt">
  <div class="card-body">
    <p class="alt-label">Alternative: Personal URL</p>
    <h2>Get a personal URL</h2>
    <p class="subtitle">Sign in to generate a personal URL you can add directly to any MCP client.</p>
    <form method="POST" action="${escapeHtml(base + "/setup")}">
      ${hasError ? `<div class="error-msg">Incorrect email or password. Please try again.</div>` : ""}
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@example.com">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
      <button type="submit" class="btn btn-primary su-submit">Get my personal URL</button>
    </form>
    <p class="hint su-hint">Use your MyHarvia credentials &mdash; the same ones you use in the MyHarvia app.</p>
    <button class="forgot-btn" onclick="document.getElementById('forgot-info').classList.toggle('open')">Forgot password?</button>
    <div class="forgot-info" id="forgot-info">You can restore a forgotten password in the MyHarvia app or Harvia Web Portal.</div>
  </div>
  </div>

  </div>
</main>
${siteFooter()}
<script>
function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 2000);
}
</script>
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
