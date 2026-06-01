import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { gql } from "../graphql-client.js";

export const deviceTools: Tool[] = [
  {
    name: "get_device",
    description: "Get details of a specific device by ID",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "search_devices",
    description: "Search for devices by a query string",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        nextToken: { type: "string", description: "Pagination token" },
        maxResults: { type: "number", description: "Maximum number of results" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_organization_devices",
    description: "List all devices in an organization",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Organization ID" },
        nextToken: { type: "string", description: "Pagination token" },
        maxResults: { type: "number" },
        recursive: { type: "boolean", description: "Include devices from sub-organizations" },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "list_user_devices",
    description: "List all devices accessible to the currently authenticated user. Does not include display names — call get_device_state with shadowName='C1' for each device to retrieve the displayName field.",
    inputSchema: {
      type: "object",
      properties: {
        nextToken: { type: "string", description: "Pagination token" },
      },
    },
  },
  {
    name: "get_device_state",
    description: "Get the device shadow state (desired and reported state) including connection status. Use shadowName='C1' to get the primary sauna state, which includes displayName and heater/sensor settings. The desired and reported fields are JSON strings — parse them to access individual properties. For displayName, prefer reported over desired; fall back to desired if reported is null (e.g. device is offline).",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        shadowName: { type: "string", description: "Named shadow — use 'C1' for primary sauna state including displayName" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "get_device_metadata",
    description: "Get device metadata including owner and assigned roles",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "list_device_tags",
    description: "List tags assigned to a device",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "send_device_command",
    description:
      "Send a command to a device. Use SAUNA to start or stop a sauna session (the primary command for 'heat up the sauna', 'turn on the sauna', etc.). HEATER controls only the heating element directly and should not be used for general sauna start/stop. Other commands: STEAMER (steam generator), LIGHTS, FAN, VAPORIZER, IR_HEATER, AFTER_HEATER, EXT_SWITCH, ADJUST_DURATION, REMAINING_TIME, RESTART, UPDATE, TRACE_LOG.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        commandType: {
          type: "string",
          enum: [
            "ADJUST_DURATION",
            "REMAINING_TIME",
            "AFTER_HEATER",
            "EXT_SWITCH",
            "FAN",
            "HEATER",
            "IR_HEATER",
            "LIGHTS",
            "RESTART",
            "SAUNA",
            "STEAMER",
            "TRACE_LOG",
            "UPDATE",
            "VAPORIZER",
          ],
          description: "Command type",
        },
        params: { type: "object", description: "Optional command parameters" },
      },
      required: ["deviceId", "commandType"],
    },
  },
  {
    name: "update_device_state",
    description: "Update the desired state of a device shadow. Do NOT use this to start or stop sauna heating — use send_device_command with commandType SAUNA instead.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        state: { type: "object", description: "Desired state as a JSON object" },
        shadowName: { type: "string", description: "Named shadow (omit for classic shadow)" },
      },
      required: ["deviceId", "state"],
    },
  },
  {
    name: "update_device",
    description: "Update device attributes (key-value pairs)",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        attributes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
            required: ["key", "value"],
          },
          description: "Attributes to update",
        },
      },
      required: ["deviceId", "attributes"],
    },
  },
  {
    name: "update_device_tags",
    description: "Replace all tags on a device with the provided list",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "New tag list (replaces existing tags)",
        },
      },
      required: ["deviceId", "tags"],
    },
  },
  {
    name: "move_device",
    description: "Move a device to another organization, or remove it from its current organization",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        organizationId: {
          type: "string",
          description: "Target organization ID (omit to remove from current org)",
        },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "get_fleet_status",
    description: "Get fleet status summary for an organization (connected/disconnected counts, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Organization ID" },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "list_ota_updates",
    description: "List available OTA firmware update packages",
    inputSchema: {
      type: "object",
      properties: {
        deviceType: { type: "string", description: "Filter by device type" },
        hwVersion: { type: "string", description: "Filter by hardware version" },
        nextToken: { type: "string", description: "Pagination token" },
      },
    },
  },
  {
    name: "start_device_ota",
    description: "Start an OTA firmware update for a specific device",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        otaId: { type: "string", description: "OTA update package ID" },
      },
      required: ["deviceId", "otaId"],
    },
  },
  {
    name: "cancel_device_ota",
    description: "Cancel an in-progress OTA firmware update for a device",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "list_heater_models",
    description: "List available heater models (electric, wood, gas, other)",
    inputSchema: {
      type: "object",
      properties: {
        brandType: { type: "string", description: "Filter by brand type" },
      },
    },
  },
];

export async function handleDeviceTool(
  name: string,
  args: Record<string, unknown>,
  endpoint: string
): Promise<unknown> {
  switch (name) {
    case "get_device": {
      const data = await gql<{ devicesGet: unknown }>(
        endpoint,
        `query GetDevice($deviceId: ID!) {
          devicesGet(deviceId: $deviceId) {
            id type attr { key value } roles via
          }
        }`,
        args
      );
      return data.devicesGet;
    }

    case "search_devices": {
      const data = await gql<{ devicesSearch: unknown }>(
        endpoint,
        `query SearchDevices($query: String!, $nextToken: String, $maxResults: Int) {
          devicesSearch(query: $query, nextToken: $nextToken, maxResults: $maxResults) {
            devices { id type attr { key value } roles via }
            nextToken
          }
        }`,
        args
      );
      return data.devicesSearch;
    }

    case "list_organization_devices": {
      const data = await gql<{ organizationsDevicesList: unknown }>(
        endpoint,
        `query ListOrganizationDevices($organizationId: ID!, $nextToken: String, $maxResults: Int, $recursive: Boolean) {
          organizationsDevicesList(
            organizationId: $organizationId
            nextToken: $nextToken
            maxResults: $maxResults
            recursive: $recursive
          ) {
            devices { id type attr { key value } roles via }
            nextToken
          }
        }`,
        args
      );
      return data.organizationsDevicesList;
    }

    case "list_user_devices": {
      const data = await gql<{ usersDevicesList: unknown }>(
        endpoint,
        `query ListUserDevices($nextToken: ID) {
          usersDevicesList(nextToken: $nextToken) {
            devices { id type attr { key value } roles via }
            nextToken
          }
        }`,
        { nextToken: args.nextToken }
      );
      return data.usersDevicesList;
    }

    case "get_device_state": {
      const data = await gql<{ devicesStatesGet: unknown }>(
        endpoint,
        `query GetDeviceState($deviceId: ID!, $shadowName: String) {
          devicesStatesGet(deviceId: $deviceId, shadowName: $shadowName) {
            deviceId shadowName desired reported timestamp version clientToken
            connectionState { connected updatedTimestamp }
          }
        }`,
        args
      );
      return data.devicesStatesGet;
    }

    case "get_device_metadata": {
      const data = await gql<{ devicesMetadataGet: unknown }>(
        endpoint,
        `query GetDeviceMetadata($deviceId: ID) {
          devicesMetadataGet(deviceId: $deviceId) {
            deviceId owner roles contactName phoneCountryCode phoneNumber
          }
        }`,
        args
      );
      return data.devicesMetadataGet;
    }

    case "list_device_tags": {
      const data = await gql<{ devicesTagsList: unknown }>(
        endpoint,
        `query ListDeviceTags($deviceId: ID!) {
          devicesTagsList(deviceId: $deviceId)
        }`,
        args
      );
      return data.devicesTagsList;
    }

    case "send_device_command": {
      const { deviceId, commandType, params } = args as any;
      const data = await gql<{ devicesCommandsSend: unknown }>(
        endpoint,
        `mutation SendCommand($deviceId: ID!, $command: Command!, $params: AWSJSON) {
          devicesCommandsSend(deviceId: $deviceId, command: $command, params: $params) {
            response failureReason
          }
        }`,
        {
          deviceId,
          command: { type: commandType },
          params: params != null ? JSON.stringify(params) : undefined,
        }
      );
      return data.devicesCommandsSend;
    }

    case "update_device_state": {
      const { deviceId, state, shadowName } = args as any;
      const data = await gql<{ devicesStatesUpdate: unknown }>(
        endpoint,
        `mutation UpdateDeviceState($deviceId: ID!, $state: AWSJSON!, $shadowName: String) {
          devicesStatesUpdate(deviceId: $deviceId, state: $state, shadowName: $shadowName)
        }`,
        { deviceId, state: JSON.stringify(state), shadowName }
      );
      return data.devicesStatesUpdate;
    }

    case "update_device": {
      const data = await gql<{ devicesUpdate: unknown }>(
        endpoint,
        `mutation UpdateDevice($deviceId: ID!, $attributes: [AttributeInput!]!) {
          devicesUpdate(deviceId: $deviceId, attributes: $attributes) {
            id type attr { key value } roles via
          }
        }`,
        args
      );
      return data.devicesUpdate;
    }

    case "update_device_tags": {
      const data = await gql<{ devicesTagsUpdate: unknown }>(
        endpoint,
        `mutation UpdateDeviceTags($deviceId: ID!, $tags: [String!]!) {
          devicesTagsUpdate(deviceId: $deviceId, tags: $tags)
        }`,
        args
      );
      return data.devicesTagsUpdate;
    }

    case "move_device": {
      const data = await gql<{ organizationsDevicesMove: unknown }>(
        endpoint,
        `mutation MoveDevice($deviceId: ID!, $organizationId: ID) {
          organizationsDevicesMove(deviceId: $deviceId, organizationId: $organizationId) {
            id type attr { key value } roles via
          }
        }`,
        args
      );
      return data.organizationsDevicesMove;
    }

    case "get_fleet_status": {
      const data = await gql<{ devicesFleetStatusGet: unknown }>(
        endpoint,
        `query GetFleetStatus($organizationId: ID!) {
          devicesFleetStatusGet(organizationId: $organizationId) {
            fleetStatus { key value }
          }
        }`,
        args
      );
      return data.devicesFleetStatusGet;
    }

    case "list_ota_updates": {
      const data = await gql<{ otaUpdatesList: unknown }>(
        endpoint,
        `query ListOtaUpdates($nextToken: String, $deviceType: String, $hwVersion: String) {
          otaUpdatesList(nextToken: $nextToken, deviceType: $deviceType, hwVersion: $hwVersion) {
            otaUpdates {
              otaId firmwareVersion size description filename
              enabled deviceType hwVersion betaTesting mandatory
            }
            nextToken
          }
        }`,
        args
      );
      return data.otaUpdatesList;
    }

    case "start_device_ota": {
      const data = await gql<{ devicesOtaUpdatesStart: unknown }>(
        endpoint,
        `mutation StartDeviceOta($deviceId: ID!, $otaId: ID!) {
          devicesOtaUpdatesStart(deviceId: $deviceId, otaId: $otaId)
        }`,
        args
      );
      return data.devicesOtaUpdatesStart;
    }

    case "cancel_device_ota": {
      const data = await gql<{ devicesOtaUpdatesCancel: unknown }>(
        endpoint,
        `mutation CancelDeviceOta($deviceId: ID!) {
          devicesOtaUpdatesCancel(deviceId: $deviceId)
        }`,
        args
      );
      return data.devicesOtaUpdatesCancel;
    }

    case "list_heater_models": {
      const data = await gql<{ devicesHeaterModelList: unknown }>(
        endpoint,
        `query ListHeaterModels($brandType: String) {
          devicesHeaterModelList(brandType: $brandType) {
            electric { name powerkW stonesKg }
            wood { name stonesKg }
            gas { name powerkW stonesKg }
            other { name powerkW stonesKg }
          }
        }`,
        args
      );
      return data.devicesHeaterModelList;
    }

    default:
      throw new Error(`Unknown device tool: ${name}`);
  }
}
