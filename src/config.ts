export interface EndpointConfig {
  restApiBase: string;
  graphql: {
    data: string;
    device: string;
    events: string;
  };
}

let cachedConfig: EndpointConfig | null = null;

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
