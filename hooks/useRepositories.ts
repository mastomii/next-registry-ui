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
      const res = await fetch('/api/registry/v2/repositories');
      const repos = await res.json();

      const withSizes = await Promise.all(
        repos.map(async (repo: any) => {
          let size = 0;
          let lastUpdated: string | undefined = undefined;

          try {
            const manifestRes = await fetch(
              `/api/registry/v2/${repo.name}/manifests/latest`,
              {
                headers: {
                  Accept:
                    'application/vnd.docker.distribution.manifest.v2+json'
                }
              }
            );

            if (manifestRes.ok) {
              const manifest = await manifestRes.json();

              // Hitung total size dari semua layer
              size =
                manifest.layers?.reduce(
                  (sum: number, layer: any) => sum + (layer.size || 0),
                  0
                ) ?? 0;

              // Ambil created dari config blob
              const configDigest = manifest.config?.digest;
              if (configDigest) {
                const configRes = await fetch(
                  `/api/registry/v2/${repo.name}/blobs/${configDigest}`
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
