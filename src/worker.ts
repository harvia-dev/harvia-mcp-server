/// <reference types="@cloudflare/workers-types" />

// Entry point for the Cloudflare Worker. Routes every incoming HTTP request to
// the appropriate handler based on pathname.

import { Env } from "./types.js";
import { corsHeaders, jsonResponse } from "./utils.js";
import { handleOAuthMetadata, handleProtectedResourceMetadata, handleClientRegistration, handleAuthorize, handleLogin, handleToken } from "./oauth.js";
import { handleMcp } from "./mcp.js";
import { handleSetupPage, handleSetupSubmit } from "./pages/setup.js";
import { handleRevoke, handleRevokeAll } from "./pages/revoke.js";

/** Cloudflare Worker default export — the sole HTTP router for this service. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    switch (pathname) {
      case "/.well-known/oauth-protected-resource":
        return handleProtectedResourceMetadata(request);

      case "/.well-known/oauth-authorization-server":
        return handleOAuthMetadata(request);

      case "/setup":
        if (request.method === "GET") return handleSetupPage(request, env);
        if (request.method === "POST") return handleSetupSubmit(request, env);
        return new Response("Method Not Allowed", { status: 405 });

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
