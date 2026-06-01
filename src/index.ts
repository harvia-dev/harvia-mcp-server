import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getEndpointConfig } from "./config.js";
import { dataTools, handleDataTool } from "./tools/data.js";
import { eventsTools, handleEventsTool } from "./tools/events.js";
import { deviceTools, handleDeviceTool } from "./tools/devices.js";

const server = new Server(
  { name: "harvia-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const allTools = [...deviceTools, ...eventsTools, ...dataTools];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  try {
    const config = await getEndpointConfig();
    let result: unknown;

    if (deviceTools.some((t) => t.name === name)) {
      result = await handleDeviceTool(name, safeArgs, config.graphql.device);
    } else if (eventsTools.some((t) => t.name === name)) {
      result = await handleEventsTool(name, safeArgs, config.graphql.events);
    } else if (dataTools.some((t) => t.name === name)) {
      result = await handleDataTool(name, safeArgs, config.graphql.data);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Harvia MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
