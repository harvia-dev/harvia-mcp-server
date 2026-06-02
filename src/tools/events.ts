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
  {
    name: "deactivate_event",
    description: "Deactivate an active device event",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID" },
        timestamp: { type: "string", description: "Event timestamp" },
        eventId: { type: "string", description: "Event ID" },
        organizationId: { type: "string" },
        type: { type: "string", enum: ["SENSOR", "GENERIC"] },
        severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        sensorName: { type: "string" },
        sensorValue: { type: "number" },
        metadata: { type: "string" },
        displayName: { type: "string" },
        deviceType: { type: "string" },
      },
      required: ["deviceId", "timestamp"],
    },
  },
  {
    name: "list_notification_subscriptions",
    description: "List notification subscriptions for a user in an organization",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID" },
        organizationId: { type: "string", description: "Organization ID" },
      },
      required: ["userId", "organizationId"],
    },
  },
  {
    name: "create_notification_subscription",
    description: "Create a notification subscription (SMS, EMAIL, or PUSH) for device events",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["SMS", "EMAIL", "PUSH"], description: "Notification channel" },
        userId: { type: "string", description: "User ID" },
        organizationId: { type: "string", description: "Organization to receive notifications for" },
        owningOrganization: { type: "string", description: "Owning organization (defaults to caller's home org)" },
        eventId: { type: "string", description: "Subscribe to a specific event type only" },
        deviceId: { type: "string", description: "Subscribe to a specific device only" },
      },
      required: ["type", "userId"],
    },
  },
  {
    name: "remove_notification_subscription",
    description: "Remove a notification subscription",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID" },
        subscriptionId: { type: "string", description: "Subscription ID to remove" },
      },
      required: ["userId", "subscriptionId"],
    },
  },
  {
    name: "list_organization_notification_subscriptions",
    description: "List all notification subscriptions in an organization",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "Organization ID" },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: ["organizationId"],
    },
  },
];

export async function handleEventsTool(
  name: string,
  args: Record<string, unknown>,
  endpoint: string
): Promise<unknown> {
  switch (name) {
    case "list_device_events": {
      const { deviceId, startTimestamp, endTimestamp, limit, order, nextToken } = args as any;
      const period =
        startTimestamp && endTimestamp ? { startTimestamp, endTimestamp } : undefined;
      const data = await gql<{ devicesEventsList: unknown }>(
        endpoint,
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
      const data = await gql<{ organizationsEventsList: unknown }>(
        endpoint,
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
      const data = await gql<{ eventsMetadataList: unknown }>(
        endpoint,
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

    case "deactivate_event": {
      const data = await gql<{ eventsDeactivate: unknown }>(
        endpoint,
        `mutation DeactivateEvent($payload: EventPayload!) {
          eventsDeactivate(payload: $payload) {
            deviceId timestamp eventId organizationId updatedTimestamp
            type eventState severity sensorName sensorValue metadata displayName deviceType
          }
        }`,
        { payload: args }
      );
      return data.eventsDeactivate;
    }

    case "list_notification_subscriptions": {
      const data = await gql<{ notificationsSubscriptionsList: unknown }>(
        endpoint,
        `query ListNotificationSubscriptions($userId: ID!, $organizationId: ID!) {
          notificationsSubscriptionsList(userId: $userId, organizationId: $organizationId) {
            subscriptions { id userId organizationId eventIds type state }
            nextToken
          }
        }`,
        args
      );
      return data.notificationsSubscriptionsList;
    }

    case "create_notification_subscription": {
      const data = await gql<{ notificationsSubscriptionsCreate: unknown }>(
        endpoint,
        `mutation CreateNotificationSubscription($subscriptionDetails: SubscriptionDetails!) {
          notificationsSubscriptionsCreate(subscriptionDetails: $subscriptionDetails) {
            id userId organizationId eventIds type state
          }
        }`,
        { subscriptionDetails: args }
      );
      return data.notificationsSubscriptionsCreate;
    }

    case "remove_notification_subscription": {
      const data = await gql<{ notificationsSubscriptionsRemove: unknown }>(
        endpoint,
        `mutation RemoveNotificationSubscription($userId: ID!, $subscriptionId: ID!) {
          notificationsSubscriptionsRemove(userId: $userId, subscriptionId: $subscriptionId) {
            subscription { id userId organizationId eventIds type state }
          }
        }`,
        args
      );
      return data.notificationsSubscriptionsRemove;
    }

    case "list_organization_notification_subscriptions": {
      const data = await gql<{ organizationsNotificationsSubscriptionsList: unknown }>(
        endpoint,
        `query ListOrganizationNotificationSubscriptions($organizationId: ID!, $nextToken: ID) {
          organizationsNotificationsSubscriptionsList(organizationId: $organizationId, nextToken: $nextToken) {
            subscriptions { id userId organizationId eventIds type state }
            nextToken
          }
        }`,
        args
      );
      return data.organizationsNotificationsSubscriptionsList;
    }

    default:
      throw new Error(`Unknown events tool: ${name}`);
  }
}
