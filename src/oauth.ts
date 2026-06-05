// OAuth 2.0 + PKCE handlers used by Claude Code's MCP client to authenticate
// via the /authorize → /login → /token flow before gaining access to /mcp.

import { Env, Session } from "./types.js";
import { generateToken, sha256Base64Url, escapeHtml, jsonResponse, getPublicBase } from "./utils.js";
import { loginWithCredentials } from "./auth.js";

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
  if (state) callback.searchParams.set("state", state);
  return Response.redirect(callback.toString(), 302);
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
