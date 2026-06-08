import { getEndpointConfig } from "./config.js";

export interface TokenData {
  idToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}

/** Authenticates against the MyHarvia API and returns session tokens. */
export async function loginWithCredentials(username: string, password: string): Promise<TokenData> {
  const config = await getEndpointConfig();
  const response = await fetch(`${config.restApiBase}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const body = (await response.json()) as any;
  if (!response.ok) throw new Error(body.message ?? `Authentication failed: ${response.status}`);

  return {
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    email: username,
    expiresAt: Date.now() + body.expiresIn * 1000,
  };
}

/** Exchanges a refresh token for a new idToken. Throws if the refresh token is expired. */
export async function refreshWithToken(
  refreshToken: string,
  email: string
): Promise<Pick<TokenData, "idToken" | "expiresAt">> {
  const config = await getEndpointConfig();
  const response = await fetch(`${config.restApiBase}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken, email }),
  });

  if (!response.ok) throw new Error("Token refresh failed — user must re-authenticate");

  const tokens = (await response.json()) as any;
  return {
    idToken: tokens.idToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
}
