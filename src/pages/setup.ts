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
  const mcpUrl = base + "/mcp";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Harvia — Claude Setup</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1rem;gap:0;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:480px;overflow:hidden;}
.card.alt{background:var(--cream);border-color:var(--light-gray);}
.card-body{padding:2rem;}
.tagline{font-family:'Montserrat',sans-serif;font-weight:700;font-size:.85rem;color:var(--text2);letter-spacing:.05em;margin-bottom:1.25rem;}
h1{font-size:1.3rem;color:var(--text);margin-bottom:.4rem;}
h2{font-size:1rem;color:var(--text);margin-bottom:.4rem;}
.subtitle{font-size:.875rem;color:var(--text2);margin-bottom:1.5rem;line-height:1.5;}
.url-box{display:flex;align-items:center;gap:.5rem;background:var(--warm-gray);border:1px solid var(--light-gray);border-radius:6px;padding:.6rem .75rem;margin-bottom:1.25rem;}
.url-box code{flex:1;font-size:.8rem;color:var(--text);word-break:break-all;font-family:monospace;}
.copy-btn{flex-shrink:0;background:none;border:1px solid var(--light-gray);border-radius:4px;padding:.25rem .6rem;font-size:.75rem;font-family:'Noto Sans',sans-serif;color:var(--text2);cursor:pointer;transition:background .15s;}
.copy-btn:hover{background:var(--light-gray);}
.steps{list-style:none;padding:0;margin:0;}
.steps li{display:flex;gap:.75rem;font-size:.85rem;color:var(--text2);line-height:1.5;padding:.3rem 0;}
.step-num{flex-shrink:0;width:20px;height:20px;background:var(--red);color:white;border-radius:50%;font-size:.7rem;font-family:'Montserrat',sans-serif;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:.1rem;}
.instruction{border:1px solid var(--border);border-radius:8px;margin-bottom:.75rem;overflow:hidden;}
.instruction summary{list-style:none;cursor:pointer;padding:.7rem 1rem;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.84rem;color:var(--text);display:flex;align-items:center;gap:.5rem;background:var(--bg);}
.instruction summary::-webkit-details-marker{display:none;}
.instruction summary::before{content:'▶';font-size:.55rem;color:var(--text2);transition:transform .15s;flex-shrink:0;}
.instruction[open]>summary::before{transform:rotate(90deg);}
.instruction-body{padding:.9rem 1rem 1rem;border-top:1px solid var(--border);}
.step-row{display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.6rem;}
.step-dot{width:18px;height:18px;border-radius:50%;background:var(--warm-gray);border:1px solid var(--light-gray);font-family:'Montserrat',sans-serif;font-weight:700;font-size:.65rem;color:var(--text2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
.step-row p{font-size:.84rem;color:var(--text);line-height:1.5;}
.cmd-box{background:var(--near-black);border-radius:6px;padding:.6rem .9rem;font-family:monospace;font-size:.76rem;color:#e8e8e0;word-break:break-all;margin:.4rem 0 .6rem;}
.btn{display:inline-flex;align-items:center;padding:.4rem .9rem;border:none;border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.78rem;cursor:pointer;transition:all .15s;}
.btn-red{background:var(--red);color:white;}.btn-red:hover{background:var(--deep-red);}
.btn.ok{background:#2d7a2d !important;color:white !important;}
.more-soon{font-size:.78rem;color:var(--text2);margin-top:.5rem;font-style:italic;}
.notice-beta{background:var(--cream);border:1px solid var(--light-gray);border-radius:6px;padding:.75rem 1rem;font-size:.8rem;color:var(--text2);line-height:1.6;margin-bottom:1.1rem;}
.notice-beta strong{font-weight:600;}
.notice-beta ul{margin:.4rem 0 0 1.1rem;padding:0;}
.notice-beta li{margin-bottom:.2rem;}
.org-note{font-size:.82rem;color:var(--text2);background:var(--warm-gray);border-radius:6px;padding:.6rem .9rem;margin-bottom:.9rem;line-height:1.5;}
.divider{display:flex;align-items:center;gap:1rem;width:100%;max-width:480px;margin:1.5rem 0;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--light-gray);}
.divider span{font-size:.75rem;color:var(--text2);font-family:'Montserrat',sans-serif;font-weight:600;letter-spacing:.05em;}
.alt-label{font-family:'Montserrat',sans-serif;font-weight:700;font-size:.7rem;letter-spacing:.06em;color:var(--text2);text-transform:uppercase;margin-bottom:1rem;}
label{display:block;font-size:.8rem;font-weight:500;color:var(--text2);margin-bottom:.3rem;margin-top:1rem;letter-spacing:.03em;}
input{width:100%;padding:.65rem .8rem;border:1px solid var(--light-gray);border-radius:6px;font-size:.95rem;font-family:'Noto Sans',sans-serif;color:var(--text);background:var(--white);transition:border-color .15s;}
input:focus{outline:none;border-color:var(--red);}
.error-msg{background:#FFF0F0;border:1px solid #f5c4c4;border-radius:6px;padding:.65rem .9rem;font-size:.825rem;color:#7a2020;margin-top:1rem;}
button[type=submit]{margin-top:1.5rem;width:100%;padding:.8rem;background:var(--red);color:white;border:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.95rem;cursor:pointer;letter-spacing:.03em;transition:background .15s;}
button[type=submit]:hover{background:var(--deep-red);}
.hint{font-size:.75rem;color:var(--text2);margin-top:1.25rem;}
.forgot-btn{font-size:.75rem;color:var(--text2);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;font-family:'Noto Sans',sans-serif;margin-top:.5rem;display:block;}
.forgot-btn:hover{color:var(--text);}
.forgot-info{display:none;margin-top:.6rem;background:var(--warm-gray);border-radius:6px;padding:.65rem .9rem;font-size:.825rem;color:var(--text2);line-height:1.5;}
.forgot-info.open{display:block;}
footer{text-align:center;padding:1.5rem;font-size:.75rem;color:var(--text2);}
</style>
</head>
<body>
${setupHeader()}
<main>

  <!-- Primary: OAuth path -->
  <div class="card">
  <div class="card-body">
    <h1>Getting started with Harvia MCP server</h1>
    <p class="subtitle">Add the Harvia MCP server as a connector. You'll be asked to sign in with your MyHarvia account when connecting.</p>

    <div class="url-box">
      <code id="mcp-url">${escapeHtml(mcpUrl)}</code>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(mcpUrl)}').then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})">Copy</button>
    </div>

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
        <p class="org-note">If your organization has already enabled the Harvia MCP server, follow steps 1–3 below, find the MCP server, and connect to it.</p>
        <div class="step-row"><div class="step-dot">1</div><p>Open <a href="https://claude.ai" target="_blank" rel="noopener" style="color:var(--red);">claude.ai</a></p></div>
        <div class="step-row"><div class="step-dot">2</div><p>Click <strong>Customize</strong> in the left sidebar</p></div>
        <div class="step-row"><div class="step-dot">3</div><p>Select <strong>Connectors</strong></p></div>
        <div class="step-row"><div class="step-dot">4</div><p>Press the <strong>+</strong> icon and select <strong>Add custom connector</strong></p></div>
        <div class="step-row"><div class="step-dot">5</div><p>Give the server a name (e.g. <strong>"Harvia"</strong>), paste the URL above and click <strong>Add</strong></p></div>
        <div class="step-row"><div class="step-dot">6</div><p><strong>Connect</strong> to the server and sign in with your MyHarvia account when prompted</p></div>
      </div>
    </details>

    <p class="more-soon">More instructions coming soon</p>
  </div>
  </div>

  <div class="divider"></div>

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
      <button type="submit">Get my personal URL</button>
    </form>
    <p class="hint">Use your MyHarvia credentials &mdash; the same ones you use in the MyHarvia app.</p>
    <button class="forgot-btn" onclick="document.getElementById('forgot-info').classList.toggle('open')">Forgot password?</button>
    <div class="forgot-info" id="forgot-info">You can restore a forgotten password in the MyHarvia app or Harvia Web Portal.</div>
  </div>
  </div>

</main>
<footer>Created by <a href="https://www.harvialabs.com/" target="_blank" rel="noopener" style="color:inherit;">Harvia Labs</a>. &copy; 2026 Harvia</footer>
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
