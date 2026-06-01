import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { gql } from "../graphql-client.js";

export const dataTools: Tool[] = [
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
    name: "list_measurements",
    description: "List historical measurements for a device within a time range",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        startTimestamp: { type: "string", description: "Start timestamp (ISO 8601 or Unix ms string)" },
        endTimestamp: { type: "string", description: "End timestamp (ISO 8601 or Unix ms string)" },
        samplingMode: { type: "string", enum: ["NONE", "SAMPLING", "AVERAGE"] },
        sampleAmount: { type: "number", description: "Number of samples to return" },
        nextToken: { type: "string", description: "Pagination token from a previous response" },
      },
      required: ["deviceId", "startTimestamp", "endTimestamp"],
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
  {
    name: "generate_measurements_pdf",
    description: "Generate a PDF report of measurements for a device and return a download URL",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        startTimestamp: { type: "string", description: "Start timestamp" },
        endTimestamp: { type: "string", description: "End timestamp" },
        samplingMode: { type: "string", enum: ["NONE", "SAMPLING", "AVERAGE"] },
        sampleAmount: { type: "number" },
      },
      required: ["deviceId", "startTimestamp", "endTimestamp"],
    },
  },
];

export async function handleDataTool(
  name: string,
  args: Record<string, unknown>,
  endpoint: string
): Promise<unknown> {
  switch (name) {
    case "get_latest_measurements": {
      const data = await gql<{ devicesMeasurementsLatest: unknown }>(
        endpoint,
        `query GetLatestMeasurements($deviceId: String!) {
          devicesMeasurementsLatest(deviceId: $deviceId) {
            deviceId subId timestamp sessionId type data
          }
        }`,
        { deviceId: args.deviceId }
      );
      return data.devicesMeasurementsLatest;
    }

    case "list_measurements": {
      const data = await gql<{ devicesMeasurementsList: unknown }>(
        endpoint,
        `query ListMeasurements(
          $deviceId: String!
          $startTimestamp: String!
          $endTimestamp: String!
          $samplingMode: SamplingMode
          $sampleAmount: Int
          $nextToken: String
        ) {
          devicesMeasurementsList(
            deviceId: $deviceId
            startTimestamp: $startTimestamp
            endTimestamp: $endTimestamp
            samplingMode: $samplingMode
            sampleAmount: $sampleAmount
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

    case "list_device_sessions": {
      const data = await gql<{ devicesSessionsList: unknown }>(
        endpoint,
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
      const data = await gql<{ organizationsSessionsList: unknown }>(
        endpoint,
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

    case "generate_measurements_pdf": {
      const data = await gql<{ devicesMeasurementsPdfGenerate: unknown }>(
        endpoint,
        `query GeneratePdf(
          $deviceId: String!
          $startTimestamp: String!
          $endTimestamp: String!
          $samplingMode: SamplingMode
          $sampleAmount: Int
        ) {
          devicesMeasurementsPdfGenerate(
            deviceId: $deviceId
            startTimestamp: $startTimestamp
            endTimestamp: $endTimestamp
            samplingMode: $samplingMode
            sampleAmount: $sampleAmount
          ) {
            url
          }
        }`,
        args
      );
      return data.devicesMeasurementsPdfGenerate;
    }

    default:
      throw new Error(`Unknown data tool: ${name}`);
  }
}
