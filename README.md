# Harvia MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the Harvia MyHarvia Cloud API to AI assistants. Lets Claude (or any MCP-compatible client) control and monitor Harvia sauna devices through natural language. The MCP service includes all features of the device, events and data services of the [MyHarvia Cloud API](https://harvia.io/api)

## Features

- **Device control** — start/stop sauna sessions, send commands (heater, lights, fan, steamer, vaporizer, IR heater, after-heater, external switch, duration adjustment)
- **Device management** — list, search, update, move, and tag devices; query device state and metadata; list and filter by organization
- **Fleet management** — fleet status summaries, contract device lists, organization-wide device listing
- **Heater configuration** — list heater models (electric, wood, gas) and query configuration metadata (brands, power, stones)
- **Events** — list device and organization events, deactivate events, query event type definitions
- **Notifications** — create, list, and remove notification subscriptions (SMS, email, push) per user or organization
- **Measurements & sessions** — latest sensor readings, historical measurements with sampling options, sauna session history per device or organization, PDF report generation
- **OTA updates** — list available firmware packages, query update states, start and cancel device updates

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

3. Add the server to your Claude config (`~/.claude/claude_desktop_config.json` or `.claude/settings.json`):

```json
{
  "mcpServers": {
    "harvia": {
      "command": "node",
      "args": ["/path/to/harvia-mcp-server/dist/index.js"],
      "env": {
        "HARVIA_USERNAME": "your-email@example.com",
        "HARVIA_PASSWORD": "your-password"
      }
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

## Testing

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to browse and call all tools interactively without Claude:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
