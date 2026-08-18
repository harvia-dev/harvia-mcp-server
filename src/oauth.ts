// OAuth 2.0 + PKCE handlers used by Claude Code's MCP client to authenticate
// via the /authorize → /login → /token flow before gaining access to /mcp.

import { Env, Session } from "./types.js";
import { generateToken, sha256Base64Url, escapeHtml, jsonResponse, getPublicBase } from "./utils.js";
import { loginWithCredentials } from "./auth.js";
import { BRAND_FONTS, stylesLink, THEME_COLOR, setupHeader, siteFooter } from "./templates.js";

export function handleOAuthMetadata(request: Request): Response {
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

export function handleProtectedResourceMetadata(request: Request): Response {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : `${url.protocol}//${url.host}`;
  const base = getPublicBase(request);
  return jsonResponse({
    resource: `${base}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:tools"],
    resource_name: "Harvia MCP Server",
  });
}

export async function handleClientRegistration(request: Request): Promise<Response> {
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

export function handleAuthorize(request: Request): Response {
  const url = new URL(request.url);
  const hasError = url.searchParams.has("error");

  const params = new URLSearchParams({
    redirect_uri: url.searchParams.get("redirect_uri") ?? "",
    state: url.searchParams.get("state") ?? "",
    code_challenge: url.searchParams.get("code_challenge") ?? "",
    code_challenge_method: url.searchParams.get("code_challenge_method") ?? "S256",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to Harvia</title>
${THEME_COLOR}
${BRAND_FONTS}
${stylesLink(getPublicBase(request))}
<style>
main{justify-content:center;}
.column{max-width:420px;}
.au-card h1{font-size:1.5rem;margin-bottom:.5rem;}
.au-card .subtitle{margin-bottom:1.5rem;}
.au-submit{width:100%;margin-top:1.75rem;padding:.9rem;font-size:.9rem;}
.au-hint{margin-top:1.25rem;}
</style>
</head>
<body>
${setupHeader()}
<main>
<div class="column">
<div class="card au-card">
<div class="card-body">
  <h1>Sign in</h1>
  <p class="subtitle">Sign in with your MyHarvia account to connect to Harvia MCP server.</p>
  <form method="POST" action="${escapeHtml(getPublicBase(request) + "/login?" + params.toString())}">
    ${hasError ? `<div class="error-msg">Incorrect email or password. Please try again.</div>` : ""}
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@example.com">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
    <button type="submit" class="btn btn-primary au-submit">Sign in</button>
  </form>
  <p class="hint au-hint">Use your MyHarvia credentials &mdash; the same ones you use in the MyHarvia app.</p>
  <button class="forgot-btn" onclick="document.getElementById('forgot-info').classList.toggle('open')">Forgot password?</button>
  <div class="forgot-info" id="forgot-info">You can restore a forgotten password in the MyHarvia app or Harvia Web Portal.</div>
</div>
</div>
</div>
</main>
${siteFooter()}
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
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
  callback.searchParams.set("state", state);
  const callbackUrlHtml = escapeHtml(callback.toString());
  const callbackUrlJs = JSON.stringify(callback.toString());

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="2;url=${callbackUrlHtml}">
<title>Signed in — Harvia</title>
${THEME_COLOR}
${BRAND_FONTS}
${stylesLink(getPublicBase(request))}
<style>
main{justify-content:center;}
.column{max-width:420px;}
.au-done .card-body{text-align:center;}
.au-done h1{font-size:1.5rem;margin-bottom:.6rem;}
.check{
  width:52px;height:52px;
  background:var(--harvia-red);border-radius:var(--radius);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 1.5rem;
}
.check svg{width:26px;height:26px;}
/* The checkmark draws itself in, matching the confirmation pattern
   used by the Labs form overlay. */
.check svg polyline{stroke-dasharray:30;stroke-dashoffset:30;animation:check-draw .45s ease-out .15s forwards;}
@keyframes check-draw{to{stroke-dashoffset:0;}}
@media (prefers-reduced-motion:reduce){
  .check svg polyline{animation:none;stroke-dashoffset:0;}
}
.dots{display:inline-block;margin-left:2px;}
</style>
</head>
<body>
${setupHeader()}
<main>
<div class="column">
<div class="card au-done">
<div class="card-body">
  <div class="check">
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
  <h1>Login successful</h1>
  <p class="subtitle">Redirecting<span class="dots" id="dots"></span></p>
</div>
</div>
</div>
</main>
${siteFooter()}
<script>
  const dots = document.getElementById('dots');
  let i = 0;
  setInterval(() => { dots.textContent = '.'.repeat((++i % 3) + 1); }, 400);
  setTimeout(() => { window.location.href = ${callbackUrlJs}; }, 2000);
</script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

export async function handleToken(request: Request, env: Env): Promise<Response> {
  let code = "";
  let codeVerifier = "";

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

  const codeData = await env.SESSIONS.get<{ sessionToken: string; codeChallenge: string }>(
    `code:${code}`,
    "json"
  );
  if (!codeData) {
    return jsonResponse({ error: "invalid_grant" }, 400);
  }

  const challenge = await sha256Base64Url(codeVerifier);
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
