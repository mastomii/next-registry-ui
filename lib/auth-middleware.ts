// Authentication middleware for registry API
export interface AuthConfig {
  username: string;
  password: string;
}

export function validateAuth(auth: AuthConfig | null): boolean {
  if (!auth || !auth.username || !auth.password) {
    return false;
  }

  // Validate against environment variables
  const validUsername = process.env.REGISTRY_USERNAME;
  const validPassword = process.env.REGISTRY_PASSWORD;

  if (!validUsername || !validPassword) {
    console.warn('Registry credentials not configured in environment');
    return false;
  }

  return auth.username === validUsername && auth.password === validPassword;
}

export function createBasicAuth(auth: AuthConfig): string {
  return 'Basic ' + btoa(`${auth.username}:${auth.password}`);
}

export function getRegistryHost(): string {
  return process.env.REGISTRY_HOST || 'https://registry.mastomi.cloud';
}