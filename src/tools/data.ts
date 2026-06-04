import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { gql } from "../graphql-client.js";

export const dataTools: Tool[] = [
  {
    name: "list_device_measurements",
    description: "Get historical sensor measurements for a device. IMPORTANT: timestamps must be Unix milliseconds as strings (e.g. \"1780339669000\"), not ISO 8601. Use samplingMode AVERAGE with sampleAmount to downsample for graphs. IMPORTANT: always query only ONE database per call — never call this tool twice in parallel for the same time range. Default to 'timestream'. Only switch to 'influxdb' if the user specifically requests diagnostic fields (rssi, batteryVoltage, heapSize) OR if timestream returns no data.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        startTimestamp: { type: "string", description: "Unix milliseconds as a string (e.g. '1780339669000'), NOT ISO 8601" },
        endTimestamp: { type: "string", description: "Unix milliseconds as a string (e.g. '1780339669000'), NOT ISO 8601" },
        samplingMode: {
          type: "string",
          enum: ["NONE", "SAMPLING", "AVERAGE"],
          description: "Sampling strategy — NONE returns all points, SAMPLING picks evenly spaced points, AVERAGE averages buckets",
        },
        sampleAmount: { type: "number", description: "Number of samples/buckets when samplingMode is SAMPLING or AVERAGE" },
        db: { type: "string", enum: ["timestream", "influxdb"], description: "Database backend to query" },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: ["deviceId", "startTimestamp", "endTimestamp"],
    },
  },
  {
    name: "get_latest_measurements",
    description: "Get the latest sensor measurements for a device",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "list_device_sessions",
    description: "List sauna sessions for a device within a time range",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        startTimestamp: { type: "string", description: "Start timestamp (ISO 8601, e.g. 2024-01-01T00:00:00.000Z)" },
        endTimestamp: { type: "string", description: "End timestamp (ISO 8601)" },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: ["deviceId", "startTimestamp", "endTimestamp"],
    },
  },
  {
    name: "list_organization_sessions",
    description: "List sauna sessions for all devices in an organization",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Organization ID" },
        startTimestamp: { type: "string", description: "Start timestamp (ISO 8601)" },
        endTimestamp: { type: "string", description: "End timestamp (ISO 8601)" },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: ["organizationId", "startTimestamp", "endTimestamp"],
    },
  },
];

export async function handleDataTool(
  name: string,
  args: Record<string, unknown>,
  endpoint: string,
  idToken?: string
): Promise<unknown> {
  const g = (query: string, variables?: Record<string, unknown>) =>
    gql<Record<string, unknown>>(endpoint, query, variables, idToken);
  switch (name) {
    case "list_device_measurements": {
      const data = await g(
        `query ListDeviceMeasurements(
          $deviceId: String!
          $startTimestamp: String!
          $endTimestamp: String!
          $samplingMode: SamplingMode
          $sampleAmount: Int
          $db: DatabaseType
          $nextToken: String
        ) {
          devicesMeasurementsList(
            deviceId: $deviceId
            startTimestamp: $startTimestamp
            endTimestamp: $endTimestamp
            samplingMode: $samplingMode
            sampleAmount: $sampleAmount
            db: $db
            nextToken: $nextToken
          ) {
            measurementItems { deviceId subId timestamp sessionId type data }
            nextToken
          }
        }`,
        args
      );
      return data.devicesMeasurementsList;
    }

    case "get_latest_measurements": {
      const data = await g(
        `query GetLatestMeasurements($deviceId: String!) {
          devicesMeasurementsLatest(deviceId: $deviceId) {
            deviceId subId timestamp sessionId type data
          }
        }`,
        { deviceId: args.deviceId }
      );
      return data.devicesMeasurementsLatest;
    }

    case "list_device_sessions": {
      const data = await g(
        `query ListDeviceSessions(
          $deviceId: String!
          $startTimestamp: AWSDateTime!
          $endTimestamp: AWSDateTime!
          $nextToken: String
        ) {
          devicesSessionsList(
            deviceId: $deviceId
            startTimestamp: $startTimestamp
            endTimestamp: $endTimestamp
            nextToken: $nextToken
          ) {
            sessions { deviceId sessionId organizationId subId timestamp type durationMs stats }
            nextToken
          }
        }`,
        args
      );
      return data.devicesSessionsList;
    }

    case "list_organization_sessions": {
      const data = await g(
        `query ListOrganizationSessions(
          $organizationId: String!
          $startTimestamp: AWSDateTime!
          $endTimestamp: AWSDateTime!
          $nextToken: String
        ) {
          organizationsSessionsList(
            organizationId: $organizationId
            startTimestamp: $startTimestamp
            endTimestamp: $endTimestamp
            nextToken: $nextToken
          ) {
            sessions { deviceId sessionId organizationId subId timestamp type durationMs stats }
            nextToken
          }
        }`,
        args
      );
      return data.organizationsSessionsList;
    }

    default:
      throw new Error(`Unknown data tool: ${name}`);
  }
}
