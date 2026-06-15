// Core MCP endpoint. Validates the bearer token, then dispatches JSON-RPC
// tool calls to the appropriate Harvia GraphQL API.

import { Env, Session } from "./types.js";
import { corsHeaders, jsonResponse, jsonRpcOk, jsonRpcErr, getPublicBase } from "./utils.js";
import { getValidIdToken } from "./session.js";
import { getEndpointConfig } from "./config.js";
import { deviceTools, handleDeviceTool } from "./tools/devices.js";
import { eventsTools, handleEventsTool } from "./tools/events.js";
import { dataTools, handleDataTool } from "./tools/data.js";

const allTools = [...deviceTools, ...eventsTools, ...dataTools];

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const authHeader = request.headers.get("Authorization") ?? "";
  // Accept token from Bearer header OR ?token= query param
  const sessionToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (url.searchParams.get("token") ?? null);
  const wwwAuth = `Bearer realm="harvia-mcp", resource_metadata="${getPublicBase(request)}/.well-known/oauth-protected-resource"`;
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "WWW-Authenticate": wwwAuth, ...corsHeaders() },
    });
  }

  let session = await env.SESSIONS.get<Session>(`session:${sessionToken}`, "json");
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
