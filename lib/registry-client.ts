import { AuthConfig } from './auth-middleware';

export interface RegistryResponse<T = any> {
  success: boolean;
  status: number;
  data: T;
  headers?: Record<string, string>;
}

export interface PaginationOptions {
  n?: number;
  last?: string;
}

export interface PaginationResult {
  hasNext: boolean;
  nextUrl?: string;
}

export class RegistryClient {
  private auth: AuthConfig;

  constructor(auth: AuthConfig) {
    this.auth = auth;
  }

  private async makeRequest<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    params?: Record<string, string>
  ): Promise<RegistryResponse<T>> {
    const response = await fetch('/api/registry-middleware', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method,
        body,
        auth: this.auth,
        params,
      }),
    });

    return response.json();
  }

  // Version check
  async checkVersion(): Promise<RegistryResponse> {
    return this.makeRequest('/v2/');
  }

  // Catalog operations
  async getCatalog(pagination?: PaginationOptions): Promise<RegistryResponse<{
    repositories: string[];
    pagination: PaginationResult;
  }>> {
    const params: Record<string, string> = {};
    if (pagination?.n) params.n = pagination.n.toString();
    if (pagination?.last) params.last = pagination.last;

    return this.makeRequest('/v2/_catalog', 'GET', null, params);
  }

  // Repository operations
  async getRepositoryTags(
    repository: string,
    pagination?: PaginationOptions
  ): Promise<RegistryResponse<{
    name: string;
    tags: string[];
    pagination: PaginationResult;
  }>> {
    const params: Record<string, string> = {};
    if (pagination?.n) params.n = pagination.n.toString();
    if (pagination?.last) params.last = pagination.last;

    return this.makeRequest(`/v2/${repository}/tags/list`, 'GET', null, params);
  }

  // Manifest operations
  async getManifest(repository: string, reference: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/manifests/${reference}`);
  }

  async checkManifest(repository: string, reference: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/manifests/${reference}`, 'HEAD');
  }

  async uploadManifest(
    repository: string,
    reference: string,
    manifest: any,
    contentType: string = 'application/vnd.docker.distribution.manifest.v2+json'
  ): Promise<RegistryResponse> {
    return this.makeRequest(
      `/v2/${repository}/manifests/${reference}`,
      'PUT',
      manifest
    );
  }

  async deleteManifest(repository: string, reference: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/manifests/${reference}`, 'DELETE');
  }

  // Blob operations
  async getBlob(repository: string, digest: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/blobs/${digest}`);
  }

  async checkBlob(repository: string, digest: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/blobs/${digest}`, 'HEAD');
  }

  async deleteBlob(repository: string, digest: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/blobs/${digest}`, 'DELETE');
  }

  // Upload operations
  async initiateUpload(
    repository: string,
    options?: {
      digest?: string;
      mount?: string;
      from?: string;
    }
  ): Promise<RegistryResponse> {
    const params: Record<string, string> = {};
    if (options?.digest) params.digest = options.digest;
    if (options?.mount) params.mount = options.mount;
    if (options?.from) params.from = options.from;

    return this.makeRequest(`/v2/${repository}/blobs/uploads/`, 'POST', null, params);
  }

  async getUploadStatus(repository: string, uuid: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/blobs/uploads/${uuid}`);
  }

  async uploadChunk(
    repository: string,
    uuid: string,
    chunk: ArrayBuffer,
    contentRange?: string
  ): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/blobs/uploads/${uuid}`, 'PATCH', chunk);
  }

  async completeUpload(
    repository: string,
    uuid: string,
    digest: string,
    finalChunk?: ArrayBuffer
  ): Promise<RegistryResponse> {
    const params = { digest };
    return this.makeRequest(
      `/v2/${repository}/blobs/uploads/${uuid}`,
      'PUT',
      finalChunk,
      params
    );
  }

  async cancelUpload(repository: string, uuid: string): Promise<RegistryResponse> {
    return this.makeRequest(`/v2/${repository}/blobs/uploads/${uuid}`, 'DELETE');
  }
}