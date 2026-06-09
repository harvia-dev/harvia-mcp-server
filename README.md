# Harvia MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Harvia [MyHarvia Cloud API](https://harvia.io/api) to AI assistants. Lets Claude (or any MCP-compatible client) control and monitor Harvia sauna devices through natural language.

Deployed as a **Cloudflare Worker** with a web-based setup UI. Users sign in with their MyHarvia credentials, receive a personal MCP URL, and add it to their Claude account — no local installation required.

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

1. A user visits the [setup page](https://www.harvialabs.com/harvia-mcp/setup) and signs in with their MyHarvia credentials
2. The server authenticates against the MyHarvia API and stores the session in **Cloudflare KV**
3. The user receives a personal MCP URL
4. The user adds this URL as a connector in Claude
5. When Claude calls a tool, the Worker looks up the session, refreshes the Harvia token if needed, and proxies the request to the appropriate GraphQL endpoint

URLs are valid for 1 year and can be revoked at any time from the setup page.

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
  oauth.ts           — OAuth 2.0 + PKCE handlers (for Claude Code integration)
  mcp.ts             — MCP endpoint: token auth + JSON-RPC tool dispatch
  pages/
    setup.ts         — Login page and form submission
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
| `session:{token}` | Harvia idToken, refreshToken, email, expiry | 1 year |
| `manage:{token}` | Short-lived web session for the setup UI | 1 hour |
| `user:{email}` | List of active tokens for a user | — |

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
