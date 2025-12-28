export interface Repository {
  name: string;
  tags?: string[];
  lastUpdated?: string;
  size?: number;
  pullCount?: number;
}

export interface Tag {
  name: string;
  digest: string;
  size: number;
  created: string;
  architecture?: string;
  os?: string;
}

export interface Manifest {
  schemaVersion: number;
  mediaType: string;
  config?: {
    digest: string;
    size: number;
    mediaType: string;
  };
  layers: Array<{
    digest: string;
    size: number;
    mediaType: string;
  }>;
  architecture?: string;
  os?: string;
  created?: string;
}

export interface RepositoryDeletionResult {
  success: boolean;
  message: string;
  repositoryName: string;
  isEmpty: boolean;
  deletedTags: number;
  deletedManifests: number;
  totalTags: number;
  errors: string[];
  manifests: Array<{
    tag: string;
    digest: string;
    deleted: boolean;
  }>;
  note: string;
}

class RegistryAPI {
  private credentials: string;

  constructor(username: string, password: string) {
    this.credentials = btoa(`${username}:${password}`);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `/api/registry${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.credentials}`,
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Registry API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/v2/_catalog');
      return true;
    } catch {
      return false;
    }
  }

  async getRepositories(): Promise<Repository[]> {
    const response = await this.request('/v2/_catalog');
    const data = await response.json();
    return data.repositories?.map((name: string) => ({ name })) || [];
  }

  async getRepositoryTags(repository: string): Promise<string[]> {
    try {
      const response = await this.request(`/v2/${repository}/tags/list`);
      const data = await response.json();
      return data.tags || [];
    } catch {
      return [];
    }
  }

  async getManifest(repository: string, tag: string): Promise<Manifest> {
    const response = await this.request(`/v2/${repository}/manifests/${tag}`, {
      headers: {
        'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
      },
    });
    return response.json();
  }

  async deleteManifest(repository: string, digest: string): Promise<void> {
    await this.request(`/v2/${repository}/manifests/${digest}`, {
      method: 'DELETE',
    });
  }

  async deleteRepository(repository: string): Promise<RepositoryDeletionResult> {
    const authRaw = localStorage.getItem('registry_auth');
    if (!authRaw) {
      throw new Error('No authentication found');
    }

    const auth = JSON.parse(authRaw);

    const response = await fetch(`/api/registry/repositories/${repository}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auth }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete repository');
    }

    return response.json();
  }

  async getTagDetails(repository: string, tag: string): Promise<Tag> {
    try {
      const manifest = await this.getManifest(repository, tag);
      const response = await this.request(`/v2/${repository}/manifests/${tag}`, {
        method: 'HEAD',
        headers: {
          'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
        },
      });

      const digest = response.headers.get('Docker-Content-Digest') || '';

      // Calculate total size: sum of all layers + config size
      let totalSize = 0;
      let created = '';
      let architecture = manifest.architecture;
      let os = manifest.os;

      // Sum all layer sizes
      if (manifest.layers && Array.isArray(manifest.layers)) {
        totalSize = manifest.layers.reduce((sum, layer) => {
          const layerSize = typeof layer.size === 'number' ? layer.size : 0;
          return sum + layerSize;
        }, 0);
      }

      // Add config size
      if (manifest.config && typeof manifest.config.size === 'number') {
        totalSize += manifest.config.size;
      }

      // Fetch config blob to get actual created time
      if (manifest.config?.digest) {
        try {
          const configResponse = await this.request(`/v2/${repository}/blobs/${manifest.config.digest}`);
          const config = await configResponse.json();
          if (config.created) {
            created = config.created;
          }
          if (config.architecture) {
            architecture = config.architecture;
          }
          if (config.os) {
            os = config.os;
          }
        } catch (configError) {
          console.error(`Error fetching config blob:`, configError);
        }
      }

      // Fallback to current time if created is not found
      if (!created) {
        created = new Date().toISOString();
      }

      return {
        name: tag,
        digest,
        size: totalSize,
        created,
        architecture,
        os,
      };
    } catch (error) {
      console.error(`Error getting tag details for ${repository}:${tag}:`, error);
      return {
        name: tag,
        digest: '',
        size: 0,
        created: new Date().toISOString(),
      };
    }
  }
}

export default RegistryAPI;