import { getEndpointConfig } from "./config.js";

export interface TokenData {
  idToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}

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

interface TokenState {
  idToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}

let tokenState: TokenState | null = null;

export async function getIdToken(): Promise<string> {
  if (tokenState && Date.now() < tokenState.expiresAt - 60_000) {
    return tokenState.idToken;
  }
  if (tokenState) {
    return refreshIdToken();
  }
  return login();
}

async function login(): Promise<string> {
  const username = process.env.HARVIA_USERNAME;
  const password = process.env.HARVIA_PASSWORD;

  if (!username || !password) {
    throw new Error("HARVIA_USERNAME and HARVIA_PASSWORD environment variables are required");
  }

  const config = await getEndpointConfig();
  const response = await fetch(`${config.restApiBase}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const body = (await response.json()) as any;

  if (!response.ok) {
    throw new Error(body.message ?? `Authentication failed: ${response.status}`);
  }

  const tokens = body;

  tokenState = {
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    email: username,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };

  return tokenState.idToken;
}

async function refreshIdToken(): Promise<string> {
  if (!tokenState) throw new Error("No token state to refresh");

  const config = await getEndpointConfig();
  const response = await fetch(`${config.restApiBase}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokenState.refreshToken, email: tokenState.email }),
  });

  if (!response.ok) {
    tokenState = null;
    return login();
  }

  const tokens = (await response.json()) as any;

  tokenState = {
    ...tokenState,
    idToken: tokens.idToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };

  return tokenState.idToken;
}
