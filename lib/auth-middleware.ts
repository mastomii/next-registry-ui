export const dynamic = 'force-dynamic';

export interface AuthConfig {
  username: string;
  password: string;
}

/**
 * Validates provided credentials against environment variables.
 */
export function validateAuth(auth: AuthConfig | null): boolean {
  if (!auth || !auth.username || !auth.password) {
    console.warn('[AUTH] Missing username or password');
    return false;
  }

  const validUsername = process.env.REGISTRY_USER;
  const validPassword = process.env.REGISTRY_PASS;

  if (!validUsername || !validPassword) {
    console.warn('[AUTH] Registry credentials not found in environment variables');
    return false;
  }

  const isValid = auth.username === validUsername && auth.password === validPassword;

  if (!isValid) {
    console.warn('[AUTH] Invalid credentials provided');
  }

  return isValid;
}

/**
 * Creates a Basic Auth header from given credentials.
 */
export function createBasicAuth(auth: AuthConfig): string {
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Retrieves the current registry host from the environment.
 * Use this inside handlers to ensure it's fetched dynamically at runtime.
 */
export function getRegistryHost(): string {
  return process.env.REGISTRY_HOST || 'https://your-private-registry';
}
