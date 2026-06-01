# Harvia MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the Harvia MyHarvia Cloud API to AI assistants. Lets Claude (or any MCP-compatible client) control and monitor Harvia sauna devices through natural language.

## Features

- **Device control** — start/stop heating, send commands (lights, fan, steamer, etc.), update device state
- **Device management** — list, search, move, and update devices and tags
- **Events** — list and deactivate device events, manage notification subscriptions (SMS/email/push)
- **Measurements & sessions** — query historical sensor data, list sauna sessions, generate PDF reports
- **OTA updates** — list and trigger firmware updates

## Setup

1. Copy `.env.example` to `.env` and fill in your MyHarvia credentials:

```
HARVIA_USERNAME=your-email@example.com
HARVIA_PASSWORD=your-password
```

2. Install dependencies and build:

```bash
npm install
npm run build
```

3. Add the server to your Claude Code config (`~/.claude/claude_desktop_config.json` or `.claude/settings.json`):

```json
{
  "mcpServers": {
    "harvia": {
      "command": "node",
      "args": ["/path/to/harvia-mcp-server/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm run dev   # run with tsx (no build step)
npm run build # compile to dist/
npm start     # run compiled output
```
