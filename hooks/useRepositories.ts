import { useEffect, useState } from 'react';

interface Repository {
  name: string;
  tags: string[];
  size?: number;
  lastUpdated?: string;
}

export function useRepositories() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRepositories() {
      setLoading(true);

      // Get auth from localStorage
      const authRaw = localStorage.getItem('registry_auth');
      let authHeader = '';
      if (authRaw) {
        try {
          const auth = JSON.parse(authRaw);
          authHeader = 'Basic ' + btoa(`${auth.username}:${auth.password}`);
        } catch {
          console.error('Failed to parse auth');
        }
      }

      const res = await fetch('/api/registry/v2/repositories', {
        headers: authHeader ? { Authorization: authHeader } : {}
      });
      const repos = await res.json();

      const withSizes = await Promise.all(
        repos.map(async (repo: any) => {
          let size = 0;
          let lastUpdated: string | undefined = undefined;

          try {
            // First try to get manifest with multi-arch support
            let manifestRes = await fetch(
              `/api/registry/v2/${repo.name}/manifests/latest`,
              {
                headers: {
                  Accept: 'application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json',
                  ...(authHeader ? { Authorization: authHeader } : {})
                }
              }
            );

            if (manifestRes.ok) {
              let manifest = await manifestRes.json();

              // Check if this is a manifest list (multi-arch)
              if (manifest.manifests && Array.isArray(manifest.manifests)) {
                // Get the first manifest from the list (usually amd64/linux)
                const firstManifest = manifest.manifests.find(
                  (m: any) => m.platform?.architecture === 'amd64' && m.platform?.os === 'linux'
                ) || manifest.manifests[0];

                if (firstManifest) {
                  // Fetch the actual manifest
                  const actualManifestRes = await fetch(
                    `/api/registry/v2/${repo.name}/manifests/${firstManifest.digest}`,
                    {
                      headers: {
                        Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
                        ...(authHeader ? { Authorization: authHeader } : {})
                      }
                    }
                  );

                  if (actualManifestRes.ok) {
                    manifest = await actualManifestRes.json();
                  }
                }
              }

              // Hitung total size dari semua layer
              if (manifest.layers && Array.isArray(manifest.layers)) {
                size = manifest.layers.reduce(
                  (sum: number, layer: any) => sum + (layer.size || 0),
                  0
                );

                // Add config size
                if (manifest.config?.size) {
                  size += manifest.config.size;
                }
              }

              // Ambil created dari config blob
              const configDigest = manifest.config?.digest;
              if (configDigest) {
                const configRes = await fetch(
                  `/api/registry/v2/${repo.name}/blobs/${configDigest}`,
                  {
                    headers: authHeader ? { Authorization: authHeader } : {}
                  }
                );
                if (configRes.ok) {
                  const config = await configRes.json();
                  lastUpdated = config.created;
                }
              }
            }
          } catch (err) {
            console.error('Gagal parsing manifest', err);
          }

          return {
            ...repo,
            size,
            lastUpdated
          };
        })
      );

      setRepositories(withSizes);
      setLoading(false);
    }

    fetchRepositories();
  }, []);

  return { repositories, loading };
}
