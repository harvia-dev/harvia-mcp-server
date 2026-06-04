/// <reference types="@cloudflare/workers-types" />

import { getEndpointConfig } from "./config.js";
import { HARVIA_LOGO } from "./assets.js";
import { loginWithCredentials, refreshWithToken } from "./auth.js";
import { deviceTools, handleDeviceTool } from "./tools/devices.js";
import { eventsTools, handleEventsTool } from "./tools/events.js";
import { dataTools, handleDataTool } from "./tools/data.js";

export interface Env {
  SESSIONS: KVNamespace;
}

interface Session {
  idToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}

const allTools = [...deviceTools, ...eventsTools, ...dataTools];

// ── Utilities ────────────────────────────────────────────────────────────────

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function sha256Base64Url(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function jsonRpcOk(id: unknown, result: unknown): Response {
  return jsonResponse({ jsonrpc: "2.0", id, result });
}

function jsonRpcErr(id: unknown, code: number, message: string): Response {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } });
}

// ── Session helpers ───────────────────────────────────────────────────────────

async function getValidIdToken(env: Env, sessionToken: string, session: Session): Promise<string> {
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

// ── Route handlers ────────────────────────────────────────────────────────────

function getPublicBase(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}/harvia-mcp`;
  }
  return `${url.protocol}//${url.host}`;
}

function handleOAuthMetadata(request: Request): Response {
  const base = getPublicBase(request);
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  // issuer must equal the origin (no path) to satisfy RFC 8414 discovery validation
  const issuer = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : `${url.protocol}//${url.host}`;
  return jsonResponse({
    issuer,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}

async function handleClientRegistration(request: Request): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;
  return jsonResponse({
    client_id: generateToken(),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    redirect_uris: body.redirect_uris ?? [],
    client_name: body.client_name ?? "MCP Client",
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  }, 201);
}

function handleAuthorize(request: Request): Response {
  const url = new URL(request.url);
  const errorHtml = url.searchParams.has("error")
    ? `<p class="error">Invalid email or password. Please try again.</p>`
    : "";

  const params = new URLSearchParams({
    redirect_uri: url.searchParams.get("redirect_uri") ?? "",
    state: url.searchParams.get("state") ?? "",
    code_challenge: url.searchParams.get("code_challenge") ?? "",
    code_challenge_method: url.searchParams.get("code_challenge_method") ?? "S256",
  });

  const html = `<!DOCTYPE html>
<!-- login form posts to /harvia-mcp/login -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in — Harvia</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#f4f4f4;display:flex;justify-content:center;align-items:center;min-height:100vh}
  .card{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.1);width:100%;max-width:360px}
  h1{font-size:1.3rem;margin-bottom:1.5rem;color:#111}
  label{display:block;font-size:.85rem;color:#555;margin-bottom:.25rem;margin-top:.75rem}
  input{width:100%;padding:.6rem .75rem;border:1px solid #ddd;border-radius:6px;font-size:1rem}
  input:focus{outline:none;border-color:#c0392b}
  button{margin-top:1.25rem;width:100%;padding:.75rem;background:#c0392b;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer}
  button:hover{background:#a93226}
  .error{color:#c0392b;font-size:.85rem;margin-top:.5rem}
</style>
</head>
<body>
<div class="card">
  <h1>Sign in to Harvia</h1>
  <form method="POST" action="${escapeHtml(getPublicBase(request) + "/login?" + params.toString())}">
    ${errorHtml}
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
</div>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";

  const form = await request.formData();
  const email = ((form.get("email") as string) ?? "").trim();
  const password = (form.get("password") as string) ?? "";

  let session: Session;
  try {
    session = await loginWithCredentials(email, password);
  } catch {
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      error: "1",
    });
    return Response.redirect(`${getPublicBase(request)}/authorize?${params}`, 302);
  }

  const sessionToken = generateToken();
  await env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: 30 * 24 * 60 * 60,
  });

  const code = generateToken();
  await env.SESSIONS.put(
    `code:${code}`,
    JSON.stringify({ sessionToken, codeChallenge }),
    { expirationTtl: 300 }
  );

  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);
  return Response.redirect(callback.toString(), 302);
}

async function handleToken(request: Request, env: Env): Promise<Response> {
  let code = "";
  let codeVerifier = "";
  console.log("[token] content-type:", request.headers.get("Content-Type"));

  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    code = (form.get("code") as string) ?? "";
    codeVerifier = (form.get("code_verifier") as string) ?? "";
  } else {
    const body = (await request.json()) as Record<string, string>;
    code = body.code ?? "";
    codeVerifier = body.code_verifier ?? "";
  }

  console.log("[token] code length:", code.length, "verifier length:", codeVerifier.length);
  const codeData = await env.SESSIONS.get<{ sessionToken: string; codeChallenge: string }>(
    `code:${code}`,
    "json"
  );
  console.log("[token] codeData found:", codeData !== null);
  if (!codeData) {
    return jsonResponse({ error: "invalid_grant" }, 400);
  }

  const challenge = await sha256Base64Url(codeVerifier);
  console.log("[token] challenge match:", challenge === codeData.codeChallenge);
  if (challenge !== codeData.codeChallenge) {
    return jsonResponse({ error: "invalid_grant", error_description: "code_verifier mismatch" }, 400);
  }

  await env.SESSIONS.delete(`code:${code}`);

  return jsonResponse({
    access_token: codeData.sessionToken,
    token_type: "bearer",
    expires_in: 30 * 24 * 60 * 60,
  });
}

const BRAND_FONTS = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Noto+Sans:wght@300;400;500&display=swap" rel="stylesheet">`;

const BRAND_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --red:#ED1C24;--deep-red:#C01718;--near-black:#1A0000;
    --text:#505045;--text2:#727266;--warm-gray:#EAE8E0;
    --light-gray:#D9D6C8;--white:#fff;--cream:#FEFCF3;
    --border:rgba(80,80,69,0.15);
  }
  body{font-family:'Noto Sans',sans-serif;background:var(--warm-gray);color:var(--text);min-height:100vh;display:flex;flex-direction:column;}
  h1,h2,h3{font-family:'Montserrat',sans-serif;font-weight:700;}
`;

function setupHeader(): string {
  return `<header style="background:var(--red);padding:.6rem 1.25rem;display:flex;align-items:center;">
  <img src="${HARVIA_LOGO}" alt="Harvia" style="height:36px;width:auto;display:block;">
</header>`;
}

function handleSetupPage(request: Request): Response {
  const url = new URL(request.url);
  const hasError = url.searchParams.has("error");
  const base = getPublicBase(request);
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
  <h1>Connect Harvia to Claude</h1>
  <p class="subtitle">Sign in with your MyHarvia account to get a personal URL for Claude Code.</p>
  <form method="POST" action="${escapeHtml(base + "/setup")}">
    ${hasError ? `<div class="error-msg">Incorrect email or password. Please try again.</div>` : ""}
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@example.com">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
    <button type="submit">Get my personal URL</button>
  </form>
</div>
</div>
</main>
<footer>Use your MyHarvia credentials &mdash; the same ones you use in the Harvia app.</footer>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function createManageSession(env: Env, email: string): Promise<string> {
  const ms = generateToken();
  await env.SESSIONS.put(`manage:${ms}`, JSON.stringify({ email }), { expirationTtl: 3600 });
  return ms;
}

async function handleSetupSubmit(request: Request, env: Env): Promise<Response> {
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

  const sessionToken = generateToken();
  await env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: 365 * 24 * 60 * 60,
  });
  const existing = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${email}`, "json") ?? [];
  existing.push({ token: sessionToken, createdAt: Date.now() });
  await env.SESSIONS.put(`user:${email}`, JSON.stringify(existing));

  // Build the full page: new URL + install instructions + all URLs
  const mcpUrl = `${base}/mcp?token=${sessionToken}`;
  const cmd = `claude mcp add harvia --transport http "${mcpUrl}" -s user`;

  // Load all active sessions for this user
  const allList = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${email}`, "json") ?? [];
  const alive = (await Promise.all(
    allList.map(async e => {
      const exists = await env.SESSIONS.get(`session:${e.token}`) !== null;
      return exists ? e : null;
    })
  )).filter(Boolean) as {token:string;createdAt:number}[];
  const ms = await createManageSession(env, email);

  const urlRows = alive.sort((a,b) => b.createdAt - a.createdAt).map(e => {
    const d = new Date(e.createdAt);
    const dateStr = d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
    const timeStr = d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
    const isNew = e.token === sessionToken;
    return `<tr${isNew ? ' style="background:#f0fff0;"' : ''}>
      <td style="font-size:.825rem;color:var(--text);">${escapeHtml(dateStr)}<br><span style="font-size:.75rem;color:var(--text2);">${escapeHtml(timeStr)}</span>${isNew ? ' <span style="font-size:.7rem;background:var(--red);color:white;padding:1px 6px;border-radius:10px;margin-left:4px;">new</span>' : ''}</td>
      <td style="font-family:monospace;font-size:.75rem;color:var(--text2);">${escapeHtml(e.token.substring(0,12))}…</td>
      <td>
        <form method="POST" action="${escapeHtml(base + "/revoke?s=" + ms)}" style="display:inline;">
          <input type="hidden" name="token" value="${escapeHtml(e.token)}">
          <button type="submit" class="revoke-btn">Revoke</button>
        </form>
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harvia MCP Setup</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;padding:2rem 1rem;display:flex;flex-direction:column;align-items:center;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:580px;overflow:hidden;margin-bottom:1rem;}
.card-header{background:var(--near-black);padding:.9rem 1.4rem;display:flex;align-items:center;gap:.6rem;}
.card-header h2{font-size:.875rem;color:white;font-weight:600;}
.step-badge{width:22px;height:22px;border-radius:50%;background:var(--red);color:white;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.7rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.card-body{padding:1.25rem 1.5rem;}
.url-box{background:var(--cream);border:1px solid var(--light-gray);border-radius:6px;padding:.7rem 1rem;font-family:monospace;font-size:.78rem;color:var(--text);word-break:break-all;margin:.6rem 0 .8rem;}
.btn{display:inline-flex;align-items:center;padding:.4rem .9rem;border:none;border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.78rem;cursor:pointer;transition:all .15s;}
.btn-red{background:var(--red);color:white;}.btn-red:hover{background:var(--deep-red);}
.btn-dark{background:var(--text);color:white;}.btn-dark:hover{background:var(--near-black);}
.btn-gray{background:var(--warm-gray);color:var(--text);border:1px solid var(--light-gray);}.btn-gray:hover{background:var(--red);color:white;border-color:var(--red);}
.btn-danger{background:white;color:#7a2020;border:1px solid #f5c4c4;}.btn-danger:hover{background:#7a2020;color:white;}
.btn.ok{background:#2d7a2d !important;color:white !important;}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:.9rem;}
.tab{padding:.4rem 1rem;font-size:.825rem;font-weight:500;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
.tab.active{color:var(--red);border-bottom-color:var(--red);}
.tab-panel{display:none;}.tab-panel.active{display:block;}
.step-row{display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.6rem;}
.step-dot{width:18px;height:18px;border-radius:50%;background:var(--warm-gray);border:1px solid var(--light-gray);font-family:'Montserrat',sans-serif;font-weight:700;font-size:.65rem;color:var(--text2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
.step-row p{font-size:.84rem;color:var(--text);line-height:1.5;}
.cmd-box{background:var(--near-black);border-radius:6px;padding:.6rem .9rem;font-family:monospace;font-size:.76rem;color:#e8e8e0;word-break:break-all;margin:.4rem 0 .6rem;}
.note{font-size:.76rem;color:var(--text2);padding:.7rem 1rem;background:var(--warm-gray);border-radius:6px;margin-top:.75rem;}
table{width:100%;border-collapse:collapse;}
th{text-align:left;font-size:.72rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text2);padding:.6rem 1rem;border-bottom:1px solid var(--border);background:var(--warm-gray);}
td{padding:.65rem 1rem;border-bottom:1px solid var(--border);vertical-align:middle;}
tr:last-child td{border-bottom:none;}
.revoke-btn{padding:.3rem .65rem;background:white;color:#7a2020;border:1px solid #f5c4c4;border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.72rem;cursor:pointer;}
.revoke-btn:hover{background:#7a2020;color:white;}
.table-footer{padding:.8rem 1rem;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);background:var(--warm-gray);}
footer{text-align:center;padding:1.25rem;font-size:.75rem;color:var(--text2);}
</style>
<script>
function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 2000);
}
function switchTab(os) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.os === os));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.os === os));
}
</script>
</head>
<body>
${setupHeader()}
<main>

<div class="card">
  <div class="card-header"><div class="step-badge">1</div><h2>Your personal Harvia MCP URL</h2></div>
  <div class="card-body">
    <p style="font-size:.84rem;color:var(--text2);">This URL connects Claude to your Harvia account. Keep it private — treat it like a password.</p>
    <div class="url-box">${escapeHtml(mcpUrl)}</div>
    <button class="btn btn-red" onclick="copyText('${escapeHtml(mcpUrl)}',this)">Copy URL</button>
  </div>
</div>

<div class="card">
  <div class="card-header"><div class="step-badge">2</div><h2>Add to Claude Code</h2></div>
  <div class="card-body">
    <div class="tabs">
      <div class="tab active" data-os="win" onclick="switchTab('win')">Windows</div>
      <div class="tab" data-os="mac" onclick="switchTab('mac')">macOS</div>
    </div>
    <div class="tab-panel active" data-os="win">
      <div class="step-row"><div class="step-dot">1</div><p>Open <strong>PowerShell</strong> (press Win, type PowerShell, press Enter)</p></div>
      <div class="step-row"><div class="step-dot">2</div><p>Run this command:</p></div>
      <div class="cmd-box">${escapeHtml(cmd)}</div>
      <button class="btn btn-gray" onclick="copyText('${escapeHtml(cmd)}',this)">Copy command</button>
      <div class="step-row" style="margin-top:.75rem;"><div class="step-dot">3</div><p>Start a <strong>new Claude Code session</strong> — your Harvia devices will be available.</p></div>
    </div>
    <div class="tab-panel" data-os="mac">
      <div class="step-row"><div class="step-dot">1</div><p>Open <strong>Terminal</strong> (Applications → Utilities → Terminal)</p></div>
      <div class="step-row"><div class="step-dot">2</div><p>Run this command:</p></div>
      <div class="cmd-box">${escapeHtml(cmd)}</div>
      <button class="btn btn-gray" onclick="copyText('${escapeHtml(cmd)}',this)">Copy command</button>
      <div class="step-row" style="margin-top:.75rem;"><div class="step-dot">3</div><p>Start a <strong>new Claude Code session</strong> — your Harvia devices will be available.</p></div>
    </div>
    <div class="note">Don't have Claude Code? Install it first: <code style="font-size:.76rem;">npm install -g @anthropic-ai/claude-code</code></div>
  </div>
</div>

<div class="card">
  <div class="card-header"><div class="step-badge" style="background:var(--text2);">↓</div><h2>All your active URLs</h2></div>
  <table>
    <thead><tr><th>Created</th><th>Token</th><th></th></tr></thead>
    <tbody>${urlRows}</tbody>
  </table>
  <div class="table-footer">
    <a href="${escapeHtml(base+"/setup")}" class="btn btn-red" style="text-decoration:none;">+ Generate new URL</a>
    ${alive.length > 1 ? `<form method="POST" action="${escapeHtml(base+"/revoke-all?s="+ms)}">
      <button type="submit" class="btn btn-danger" onclick="return confirm('Revoke all ${alive.length} URLs?')">Revoke all</button>
    </form>` : ""}
  </div>
</div>

</main>
<footer>URLs are valid for 1 year</footer>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}


async function handleLogout(request: Request, env: Env): Promise<Response> {
  const base = getPublicBase(request);
  const form = await request.formData();
  const token = (form.get("token") as string) ?? "";
  if (token) {
    const session = await env.SESSIONS.get<Session>(`session:${token}`, "json");
    await env.SESSIONS.delete(`session:${token}`);
    if (session) {
      const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${session.email}`, "json") ?? [];
      await env.SESSIONS.put(`user:${session.email}`, JSON.stringify(list.filter(e => e.token !== token)));
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access revoked — Harvia</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:400px;padding:2rem;text-align:center;}
.icon{font-size:2.5rem;margin-bottom:1rem;}
h1{font-size:1.2rem;color:var(--text);margin-bottom:.5rem;}
p{font-size:.875rem;color:var(--text2);line-height:1.6;margin-bottom:1.25rem;}
a{display:inline-block;padding:.65rem 1.25rem;background:var(--red);color:white;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.85rem;text-decoration:none;}
a:hover{background:var(--deep-red);}
</style>
</head>
<body>
${setupHeader()}
<main>
<div class="card">
  <div class="icon">✓</div>
  <h1>Access revoked</h1>
  <p>Your URL has been invalidated. Claude can no longer access your Harvia devices with it.</p>
  <a href="${escapeHtml(base + "/setup")}">Generate a new URL</a>
</div>
</main>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function renderManagePage(base: string, ms: string, email: string, env: Env): Promise<Response> {
  const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${email}`, "json") ?? [];
  const alive = (await Promise.all(
    list.map(async e => {
      const exists = await env.SESSIONS.get(`session:${e.token}`) !== null;
      return exists ? e : null;
    })
  )).filter(Boolean) as {token:string;createdAt:number}[];

  const rows = alive.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:2rem;font-size:.875rem;">No active URLs — <a href="${escapeHtml(base+"/setup")}" style="color:var(--red);">generate one</a></td></tr>`
    : alive.sort((a,b) => b.createdAt - a.createdAt).map((e, i) => {
        const d = new Date(e.createdAt);
        const dateStr = d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
        const timeStr = d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
        const mcpUrl = `${base}/mcp?token=${e.token}`;
        const cmd = `claude mcp add harvia --transport http "${mcpUrl}" -s user`;
        const idx = i;
        return `
        <tr>
          <td style="font-size:.825rem;color:var(--text);">${escapeHtml(dateStr)}<br><span style="font-size:.75rem;color:var(--text2);">${escapeHtml(timeStr)}</span></td>
          <td>
            <button class="action-btn" onclick="copyText('${escapeHtml(mcpUrl)}','copy-url-${idx}',this)">Copy URL</button>
          </td>
          <td>
            <button class="action-btn" onclick="toggleInstall(${idx})">Install</button>
          </td>
          <td>
            <form method="POST" action="${escapeHtml(base + "/revoke?s=" + ms)}" style="display:inline;">
              <input type="hidden" name="token" value="${escapeHtml(e.token)}">
              <button type="submit" class="revoke-btn">Revoke</button>
            </form>
          </td>
        </tr>
        <tr class="install-row" id="install-${idx}" style="display:none;">
          <td colspan="4" style="padding:0;background:var(--warm-gray);">
            <div style="padding:1rem 1.25rem;">
              <div class="tabs">
                <div class="tab active" onclick="switchTab(${idx},'win')">Windows</div>
                <div class="tab" onclick="switchTab(${idx},'mac')">macOS</div>
              </div>
              <div class="tab-panel active" id="tab-${idx}-win">
                <p style="font-size:.8rem;color:var(--text2);margin-bottom:.4rem;">Open PowerShell and run:</p>
                <div class="cmd-box">${escapeHtml(cmd)}</div>
                <button class="action-btn" onclick="copyText('${escapeHtml(cmd)}','copy-cmd-${idx}-win',this)">Copy</button>
              </div>
              <div class="tab-panel" id="tab-${idx}-mac">
                <p style="font-size:.8rem;color:var(--text2);margin-bottom:.4rem;">Open Terminal and run:</p>
                <div class="cmd-box">${escapeHtml(cmd)}</div>
                <button class="action-btn" onclick="copyText('${escapeHtml(cmd)}','copy-cmd-${idx}-mac',this)">Copy</button>
              </div>
              <p style="font-size:.75rem;color:var(--text2);margin-top:.75rem;">Then start a new Claude Code session — your Harvia devices will be available.</p>
            </div>
          </td>
        </tr>`;
      }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Harvia URLs</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;padding:2rem 1rem;display:flex;flex-direction:column;align-items:center;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:640px;overflow:hidden;margin-bottom:1rem;}
.card-header{background:var(--near-black);padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;}
.card-header h2{font-size:.9rem;color:white;font-weight:600;}
.card-header span{font-size:.8rem;color:rgba(255,255,255,.6);}
table{width:100%;border-collapse:collapse;}
th{text-align:left;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);padding:.65rem 1rem;border-bottom:1px solid var(--border);background:var(--warm-gray);}
td{padding:.7rem 1rem;border-bottom:1px solid var(--border);vertical-align:middle;}
.install-row td{border-bottom:2px solid var(--light-gray);}
.action-btn{padding:.3rem .7rem;background:var(--warm-gray);color:var(--text);border:1px solid var(--light-gray);border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.72rem;cursor:pointer;transition:all .15s;}
.action-btn:hover{background:var(--red);color:white;border-color:var(--red);}
.action-btn.ok{background:#2d7a2d;color:white;border-color:#2d7a2d;}
.revoke-btn{padding:.3rem .7rem;background:white;color:#7a2020;border:1px solid #f5c4c4;border-radius:5px;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.72rem;cursor:pointer;transition:all .15s;}
.revoke-btn:hover{background:#7a2020;color:white;}
.footer-row{padding:.9rem 1rem;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);background:var(--warm-gray);}
.new-btn{padding:.5rem 1rem;background:var(--red);color:white;border:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer;text-decoration:none;display:inline-block;}
.new-btn:hover{background:var(--deep-red);}
.revoke-all-btn{padding:.5rem 1rem;background:white;color:#7a2020;border:1px solid #f5c4c4;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer;}
.revoke-all-btn:hover{background:#7a2020;color:white;}
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:.75rem;}
.tab{padding:.4rem .9rem;font-size:.8rem;font-weight:500;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
.tab.active{color:var(--red);border-bottom-color:var(--red);}
.tab-panel{display:none;}.tab-panel.active{display:block;}
.cmd-box{background:var(--near-black);border-radius:6px;padding:.6rem .9rem;font-family:monospace;font-size:.76rem;color:#e8e8e0;word-break:break-all;margin-bottom:.5rem;}
footer{text-align:center;padding:1.5rem;font-size:.75rem;color:var(--text2);}
</style>
<script>
function copyText(text, id, btn) {
  navigator.clipboard.writeText(text);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 2000);
}
function toggleInstall(i) {
  const row = document.getElementById('install-' + i);
  row.style.display = row.style.display === 'none' ? '' : 'none';
}
function switchTab(i, os) {
  const panels = document.querySelectorAll('#install-' + i + ' .tab-panel');
  const tabs = document.querySelectorAll('#install-' + i + ' .tab');
  panels.forEach(p => p.classList.toggle('active', p.id === 'tab-' + i + '-' + os));
  tabs.forEach((t,j) => t.classList.toggle('active', (os === 'win') ? j===0 : j===1));
}
</script>
</head>
<body>
${setupHeader()}
<main>
<div class="card">
  <div class="card-header">
    <h2>Active Harvia URLs</h2>
    <span>${escapeHtml(email)}</span>
  </div>
  <table>
    <thead><tr><th>Created</th><th></th><th></th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer-row">
    <a href="${escapeHtml(base + "/setup")}" class="new-btn">+ Generate new URL</a>
    ${alive.length > 0 ? `<form method="POST" action="${escapeHtml(base + "/revoke-all?s=" + ms)}">
      <button type="submit" class="revoke-all-btn" onclick="return confirm('Revoke all ${alive.length} URL${alive.length !== 1 ? "s" : ""}? All Claude sessions will lose access.')">Revoke all</button>
    </form>` : ""}
  </div>
</div>
</main>
<footer>Harvia MCP — URLs are valid for 1 year</footer>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleManage(request: Request, env: Env): Promise<Response> {
  const base = getPublicBase(request);
  const url = new URL(request.url);

  // POST: validate credentials, create manage session, redirect
  if (request.method === "POST") {
    const form = await request.formData();
    const email = ((form.get("email") as string) ?? "").trim();
    const password = (form.get("password") as string) ?? "";
    try {
      await loginWithCredentials(email, password);
    } catch {
      return Response.redirect(`${base}/manage?error=1`, 302);
    }
    const ms = await createManageSession(env, email);
    return Response.redirect(`${base}/manage?s=${ms}`, 302);
  }

  // GET with manage session
  const ms = url.searchParams.get("s");
  if (ms) {
    const msData = await env.SESSIONS.get<{ email: string }>(`manage:${ms}`, "json");
    if (!msData) return Response.redirect(`${base}/manage`, 302);
    return renderManagePage(base, ms, msData.email, env);
  }

  // GET with MCP token (direct link from setup page)
  const token = url.searchParams.get("token");
  if (token) {
    const session = await env.SESSIONS.get<Session>(`session:${token}`, "json");
    if (!session) return Response.redirect(`${base}/manage`, 302);
    const ms2 = await createManageSession(env, session.email);
    return Response.redirect(`${base}/manage?s=${ms2}`, 302);
  }

  // GET: show login form
  const hasError = url.searchParams.has("error");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manage access — Harvia</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:400px;overflow:hidden;}
.card-body{padding:2rem;}
h1{font-size:1.3rem;color:var(--text);margin-bottom:.4rem;}
.subtitle{font-size:.875rem;color:var(--text2);margin-bottom:1.75rem;line-height:1.5;}
label{display:block;font-size:.8rem;font-weight:500;color:var(--text2);margin-bottom:.3rem;margin-top:1rem;}
input{width:100%;padding:.65rem .8rem;border:1px solid var(--light-gray);border-radius:6px;font-size:.95rem;font-family:'Noto Sans',sans-serif;color:var(--text);background:var(--cream);}
input:focus{outline:none;border-color:var(--red);}
.error-msg{background:#FFF0F0;border:1px solid #f5c4c4;border-radius:6px;padding:.65rem .9rem;font-size:.825rem;color:#7a2020;margin-top:1rem;}
button[type=submit]{margin-top:1.5rem;width:100%;padding:.8rem;background:var(--red);color:white;border:none;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.95rem;cursor:pointer;}
button[type=submit]:hover{background:var(--deep-red);}
footer{text-align:center;padding:1.5rem;font-size:.75rem;color:var(--text2);}
</style>
</head>
<body>
${setupHeader()}
<main>
<div class="card">
<div class="card-body">
  <h1>Manage access</h1>
  <p class="subtitle">Sign in to view and revoke your active Claude URLs.</p>
  <form method="POST" action="${escapeHtml(base + "/manage")}">
    ${hasError ? `<div class="error-msg">Incorrect email or password.</div>` : ""}
    <label>Email</label>
    <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
    <label>Password</label>
    <input type="password" name="password" required autocomplete="current-password" placeholder="••••••••">
    <button type="submit">View my URLs</button>
  </form>
</div>
</div>
</main>
<footer>Use your MyHarvia credentials.</footer>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleRevoke(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ms = url.searchParams.get("s") ?? "";
  const base = getPublicBase(request);
  const form = await request.formData();
  const token = (form.get("token") as string) ?? "";
  if (token) {
    const session = await env.SESSIONS.get<Session>(`session:${token}`, "json");
    await env.SESSIONS.delete(`session:${token}`);
    if (session) {
      const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${session.email}`, "json") ?? [];
      await env.SESSIONS.put(`user:${session.email}`, JSON.stringify(list.filter(e => e.token !== token)));
    }
  }
  return Response.redirect(`${base}/manage?s=${ms}`, 302);
}

async function handleRevokeAll(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ms = url.searchParams.get("s") ?? "";
  const base = getPublicBase(request);
  const msData = await env.SESSIONS.get<{ email: string }>(`manage:${ms}`, "json");
  if (msData) {
    const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${msData.email}`, "json") ?? [];
    await Promise.all(list.map(e => env.SESSIONS.delete(`session:${e.token}`)));
    await env.SESSIONS.delete(`user:${msData.email}`);
  }
  return Response.redirect(`${base}/manage?s=${ms}`, 302);
}

async function handleLogoutAll(request: Request, env: Env): Promise<Response> {
  const base = getPublicBase(request);
  const form = await request.formData();
  const token = (form.get("token") as string) ?? "";

  let count = 0;
  if (token) {
    const session = await env.SESSIONS.get<Session>(`session:${token}`, "json");
    if (session) {
      const list = await env.SESSIONS.get<{token:string;createdAt:number}[]>(`user:${session.email}`, "json") ?? [];
      await Promise.all(list.map(e => env.SESSIONS.delete(`session:${e.token}`)));
      await env.SESSIONS.delete(`user:${session.email}`);
      count = list.length;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All access revoked — Harvia</title>
${BRAND_FONTS}
<style>
${BRAND_CSS}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;}
.card{background:var(--white);border-radius:12px;border:1px solid var(--border);width:100%;max-width:400px;padding:2rem;text-align:center;}
.icon{font-size:2.5rem;margin-bottom:1rem;}
h1{font-size:1.2rem;color:var(--text);margin-bottom:.5rem;}
p{font-size:.875rem;color:var(--text2);line-height:1.6;margin-bottom:1.25rem;}
a{display:inline-block;padding:.65rem 1.25rem;background:var(--red);color:white;border-radius:6px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:.85rem;text-decoration:none;}
a:hover{background:var(--deep-red);}
</style>
</head>
<body>
${setupHeader()}
<main>
<div class="card">
  <div class="icon">✓</div>
  <h1>All access revoked</h1>
  <p>${count} URL${count !== 1 ? "s" : ""} invalidated. No Claude session can access your Harvia devices anymore.</p>
  <a href="${escapeHtml(base + "/setup")}">Generate a new URL</a>
</div>
</main>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function handleMcp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const authHeader = request.headers.get("Authorization") ?? "";
  // Accept token from Bearer header OR ?token= query param
  const sessionToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (url.searchParams.get("token") ?? null);
  const wwwAuth = `Bearer realm="harvia-mcp", error="invalid_token"`;
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "WWW-Authenticate": wwwAuth, ...corsHeaders() },
    });
  }

  console.log("[mcp] token prefix:", sessionToken.substring(0, 8));
  let session = await env.SESSIONS.get<Session>(`session:${sessionToken}`, "json");
  console.log("[mcp] session found:", session !== null);
  // Retry once after short delay to handle KV global propagation lag
  if (!session) {
    await new Promise(r => setTimeout(r, 1500));
    session = await env.SESSIONS.get<Session>(`session:${sessionToken}`, "json");
  }
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "WWW-Authenticate": wwwAuth, ...corsHeaders() },
    });
  }

  let body: { method: string; params: any; id: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonRpcErr(null, -32700, "Parse error");
  }

  const { method, params, id } = body;

  // Notifications have no id — no response needed
  if (id === undefined || id === null) {
    return new Response(null, { status: 204 });
  }

  try {
    if (method === "initialize") {
      const requestedVersion = (params as any)?.protocolVersion ?? "2025-03-26";
      return jsonRpcOk(id, {
        protocolVersion: requestedVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "harvia-mcp-server", version: "0.1.0" },
      });
    }

    if (method === "ping") {
      return jsonRpcOk(id, {});
    }

    if (method === "tools/list") {
      return jsonRpcOk(id, { tools: allTools });
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params as {
        name: string;
        arguments: Record<string, unknown>;
      };

      const idToken = await getValidIdToken(env, sessionToken, session);
      const config = await getEndpointConfig();
      const safeArgs = args ?? {};
      let result: unknown;

      if (deviceTools.some((t) => t.name === name)) {
        result = await handleDeviceTool(name, safeArgs, config.graphql.device, idToken);
      } else if (eventsTools.some((t) => t.name === name)) {
        result = await handleEventsTool(name, safeArgs, config.graphql.events, idToken);
      } else if (dataTools.some((t) => t.name === name)) {
        result = await handleDataTool(name, safeArgs, config.graphql.data, idToken);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      return jsonRpcOk(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    }

    return jsonRpcErr(id, -32601, "Method not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonRpcOk(id, {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    });
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    switch (pathname) {
      case "/.well-known/oauth-authorization-server":
        return handleOAuthMetadata(request);

      case "/setup":
        if (request.method === "GET") return handleSetupPage(request);
        if (request.method === "POST") return handleSetupSubmit(request, env);
        return new Response("Method Not Allowed", { status: 405 });

      case "/logout":
        return request.method === "POST"
          ? handleLogout(request, env)
          : new Response("Method Not Allowed", { status: 405 });

      case "/logout-all":
        return request.method === "POST"
          ? handleLogoutAll(request, env)
          : new Response("Method Not Allowed", { status: 405 });

      case "/manage":
        return handleManage(request, env);

      case "/revoke":
        return request.method === "POST"
          ? handleRevoke(request, env)
          : new Response("Method Not Allowed", { status: 405 });

      case "/revoke-all":
        return request.method === "POST"
          ? handleRevokeAll(request, env)
          : new Response("Method Not Allowed", { status: 405 });

      case "/register":
        return request.method === "POST"
          ? handleClientRegistration(request)
          : new Response("Method Not Allowed", { status: 405 });

      case "/authorize":
        return handleAuthorize(request);

      case "/login":
        return request.method === "POST"
          ? handleLogin(request, env)
          : new Response("Method Not Allowed", { status: 405 });

      case "/token":
        return request.method === "POST"
          ? handleToken(request, env)
          : new Response("Method Not Allowed", { status: 405 });

      case "/mcp":
        if (request.method === "POST") return handleMcp(request, env);
        if (request.method === "GET")
          return jsonResponse({ name: "harvia-mcp-server", version: "0.1.0" });
        return new Response("Method Not Allowed", { status: 405 });

      default:
        return new Response("Not Found", { status: 404 });
    }
  },
};
