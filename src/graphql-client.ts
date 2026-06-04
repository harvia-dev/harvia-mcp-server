import { getIdToken } from "./auth.js";

export async function gql<T = unknown>(
  endpoint: string,
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const idToken = token ?? await getIdToken();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }

  return result.data as T;
}
