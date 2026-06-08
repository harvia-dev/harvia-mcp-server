import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { gql } from "../graphql-client.js";

export const eventsTools: Tool[] = [
  {
    name: "list_device_events",
    description: "List events for a specific device, optionally filtered by time period",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        startTimestamp: { type: "string", description: "Start of time period" },
        endTimestamp: { type: "string", description: "End of time period (required if startTimestamp is set)" },
        limit: { type: "number", description: "Maximum number of events to return" },
        order: { type: "string", enum: ["ASC", "DESC"], description: "Sort order (default DESC)" },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "list_organization_events",
    description: "List events for all devices in an organization",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Organization ID" },
        startTimestamp: { type: "string", description: "Start of time period" },
        endTimestamp: { type: "string", description: "End of time period (required if startTimestamp is set)" },
        limit: { type: "number", description: "Maximum number of events to return" },
        order: { type: "string", enum: ["ASC", "DESC"] },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "list_event_metadata",
    description: "List all available event type definitions with names and descriptions",
    inputSchema: {
      type: "object",
      properties: {
        nextToken: { type: "string", description: "Pagination token" },
      },
    },
  },
];

export async function handleEventsTool(
  name: string,
  args: Record<string, unknown>,
  endpoint: string,
  idToken?: string
): Promise<unknown> {
  const g = (query: string, variables?: Record<string, unknown>) =>
    gql<Record<string, unknown>>(endpoint, query, variables, idToken);
  switch (name) {
    case "list_device_events": {
      const { deviceId, startTimestamp, endTimestamp, limit, order, nextToken } = args as any;
      const period =
        startTimestamp && endTimestamp ? { startTimestamp, endTimestamp } : undefined;
      const data = await g(
        `query ListDeviceEvents($deviceId: ID!, $period: TimePeriod, $nextToken: ID, $limit: Int, $order: Order) {
          devicesEventsList(deviceId: $deviceId, period: $period, nextToken: $nextToken, limit: $limit, order: $order) {
            events {
              deviceId timestamp eventId organizationId updatedTimestamp
              type eventState severity sensorName sensorValue metadata displayName deviceType
            }
            nextToken
          }
        }`,
        { deviceId, period, nextToken, limit, order }
      );
      return data.devicesEventsList;
    }

    case "list_organization_events": {
      const { organizationId, startTimestamp, endTimestamp, limit, order, nextToken } = args as any;
      const period =
        startTimestamp && endTimestamp ? { startTimestamp, endTimestamp } : undefined;
      const data = await g(
        `query ListOrganizationEvents($organizationId: ID!, $period: TimePeriod, $nextToken: ID, $limit: Int, $order: Order) {
          organizationsEventsList(organizationId: $organizationId, period: $period, nextToken: $nextToken, limit: $limit, order: $order) {
            events {
              deviceId timestamp eventId organizationId updatedTimestamp
              type eventState severity sensorName sensorValue metadata displayName deviceType
            }
            nextToken
          }
        }`,
        { organizationId, period, nextToken, limit, order }
      );
      return data.organizationsEventsList;
    }

    case "list_event_metadata": {
      const data = await g(
        `query ListEventMetadata($nextToken: ID) {
          eventsMetadataList(nextToken: $nextToken) {
            eventMetadataItems { eventId name description }
            nextToken
          }
        }`,
        { nextToken: args.nextToken }
      );
      return data.eventsMetadataList;
    }

    default:
      throw new Error(`Unknown events tool: ${name}`);
  }
}
