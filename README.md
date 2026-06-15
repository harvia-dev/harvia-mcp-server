# Harvia MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Harvia [MyHarvia Cloud API](https://harvia.io/api) to AI assistants. Lets Claude (or any MCP-compatible client) control and monitor Harvia sauna devices through natural language.

Deployed as a **Cloudflare Worker** with a web-based setup UI. No local installation required — users connect via the [setup page](https://www.harvialabs.com/harvia-mcp/setup).

The MCP server includes main features of the device, events and data services of the [MyHarvia Cloud API](https://harvia.io/api).

## Features

- **Device control** — start/stop sauna sessions, send commands (heater, lights, fan, steamer, vaporizer, IR heater, after-heater, external switch, duration adjustment)
- **Device management** — list, search, and query devices; get device state and metadata
- **Fleet management** — fleet status summaries, organization-wide device listing
- **Heater configuration** — list heater models and configuration metadata
- **Events** — list device and organization events, query event type definitions
- **Measurements & sessions** — latest and historical sensor readings, sauna session history per device or organization
- **OTA updates** — list available firmware packages, query update states, start and cancel device updates

## How it works

There are two ways to connect:

**OAuth 2.1 (primary)** — Add the MCP URL as a connector in Claude.ai. Claude handles the OAuth flow automatically and prompts you to sign in with your MyHarvia account.

**Personal URL (alternative)** — Visit the [setup page](https://www.harvialabs.com/harvia-mcp/setup), sign in with your MyHarvia credentials, and receive a personal MCP URL to add directly to any MCP client. URLs are valid for 1 year and can be revoked at any time from the setup page.

In both cases, when Claude calls a tool the Worker looks up the session, refreshes the Harvia token if needed, and proxies the request to the appropriate GraphQL endpoint.

## Architecture

```
src/
  worker.ts          — HTTP router (Cloudflare Worker entry point)
  types.ts           — Shared TypeScript interfaces (Env, Session)
  utils.ts           — Utility functions (token generation, HTML escaping, JSON-RPC helpers)
  templates.ts       — Shared HTML: brand CSS, fonts, header component
  session.ts         — KV session management (create, validate, refresh)
  auth.ts            — MyHarvia API authentication (login, token refresh)
  config.ts          — Harvia endpoint discovery (cached from api.harvia.io)
  graphql-client.ts  — Authenticated GraphQL request helper
  oauth.ts           — OAuth 2.1 + PKCE handlers (authorize, login, token, registration, discovery)
  mcp.ts             — MCP endpoint: token auth + JSON-RPC tool dispatch
  pages/
    setup.ts         — Setup page: OAuth instructions and personal URL login form
    success.ts       — Post-login page: URL display, setup instructions, URL management
    revoke.ts        — Token revocation handlers
  tools/
    devices.ts       — Device control and management tools
    events.ts        — Event query tools
    data.ts          — Measurement and session data tools
```

**Storage (Cloudflare KV):**
| Key | Contents | TTL |
|-----|----------|-----|
| `session:{token}` | Harvia idToken, refreshToken, email, expiry | 30 days (OAuth) / 1 year (personal URL) |
| `manage:{token}` | Short-lived web session for the setup UI | 1 hour |
| `user:{email}` | List of active tokens for a user | — |
| `code:{code}` | OAuth authorization code + PKCE challenge | 5 minutes |

## Development

This project is deployed on Cloudflare Workers. To run or deploy your own instance:

1. Create a [Cloudflare account](https://cloudflare.com) and install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
2. Create a KV namespace in the Cloudflare dashboard and update the `id` in `wrangler.toml`
3. Install dependencies and deploy:

```bash
npm install
npx wrangler dev     # local dev server
npx wrangler deploy  # deploy to Cloudflare
```

## Created by

[Harvia Labs](https://www.harvialabs.com/)

## License

This software is provided with the [MIT license](https://opensource.org/license/mit)
