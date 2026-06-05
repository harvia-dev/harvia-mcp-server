export interface EndpointConfig {
  restApiBase: string;
  graphql: {
    data: string;
    device: string;
    events: string;
  };
}

let cachedConfig: EndpointConfig | null = null;

/**
 * Fetches live API endpoint URLs from Harvia's discovery service and caches them
 * for the lifetime of the Worker instance.
 */
export async function getEndpointConfig(): Promise<EndpointConfig> {
  if (cachedConfig) return cachedConfig;

  const response = await fetch("https://api.harvia.io/endpoints");
  if (!response.ok) {
    throw new Error(`Failed to fetch endpoint configuration: ${response.status}`);
  }

  const { endpoints } = (await response.json()) as any;

  cachedConfig = {
    restApiBase: endpoints.RestApi.generics.https,
    graphql: {
      data: endpoints.GraphQL.data.https,
      device: endpoints.GraphQL.device.https,
      events: endpoints.GraphQL.events.https,
    },
  };

  return cachedConfig;
}
