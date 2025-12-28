export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { repositories, auth } = await request.json();

    if (!auth?.username || !auth?.password) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const REGISTRY_HOST = process.env.REGISTRY_HOST || 'https://your-private-registry';
    const basicAuth = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');

    const enhancedRepos = await Promise.all(
      repositories.map(async (repo: any) => {
        try {
          // 1. Fetch tags
          const tagsRes = await fetch(`${REGISTRY_HOST}/v2/${repo.name}/tags/list`, {
            headers: {
              Authorization: basicAuth,
              Accept: 'application/json',
            },
          });

          const tagsData = tagsRes.ok ? await tagsRes.json() : null;
          const tags = tagsData?.tags || [];

          let totalSize = 0;
          let lastUpdated = '';

          // 2. Try to get manifest for 'latest' tag (or first tag if no 'latest')
          const targetTag = tags.includes('latest') ? 'latest' : tags[0];

          if (targetTag) {
            // Request manifest with multi-arch support
            const manifestRes = await fetch(`${REGISTRY_HOST}/v2/${repo.name}/manifests/${targetTag}`, {
              headers: {
                Authorization: basicAuth,
                Accept: 'application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json',
              },
            });

            if (manifestRes.ok) {
              const manifestText = await manifestRes.text();
              let manifest: any;

              try {
                manifest = JSON.parse(manifestText);
              } catch {
                manifest = manifestText; // fallback
              }

              // Check if this is a manifest list (multi-arch)
              if (manifest.manifests && Array.isArray(manifest.manifests)) {
                // Get the first manifest from the list (prefer amd64/linux)
                const firstManifest = manifest.manifests.find(
                  (m: any) => m.platform?.architecture === 'amd64' && m.platform?.os === 'linux'
                ) || manifest.manifests[0];

                if (firstManifest) {
                  // Fetch the actual manifest
                  const actualManifestRes = await fetch(
                    `${REGISTRY_HOST}/v2/${repo.name}/manifests/${firstManifest.digest}`,
                    {
                      headers: {
                        Authorization: basicAuth,
                        Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
                      },
                    }
                  );

                  if (actualManifestRes.ok) {
                    manifest = await actualManifestRes.json();
                  }
                }
              }

              // 3. Calculate total size from layers and config
              if (manifest?.layers && Array.isArray(manifest.layers)) {
                totalSize = manifest.layers.reduce((sum: number, layer: any) => {
                  return sum + (typeof layer.size === 'number' ? layer.size : 0);
                }, 0);

                if (manifest.config?.size) {
                  totalSize += manifest.config.size;
                }
              }

              // 4. Fetch config blob to get actual created time
              if (manifest?.config?.digest) {
                try {
                  const configRes = await fetch(
                    `${REGISTRY_HOST}/v2/${repo.name}/blobs/${manifest.config.digest}`,
                    {
                      headers: {
                        Authorization: basicAuth,
                        Accept: 'application/json',
                      },
                    }
                  );

                  if (configRes.ok) {
                    const config = await configRes.json();
                    if (config.created) {
                      lastUpdated = config.created;
                    }
                  }
                } catch (configError) {
                  console.error(`Error fetching config for ${repo.name}:`, configError);
                }
              }
            }
          }

          // Fallback if lastUpdated is still empty
          if (!lastUpdated) {
            lastUpdated = new Date().toISOString();
          }

          return {
            ...repo,
            tags,
            size: totalSize,
            lastUpdated,
          };
        } catch (err) {
          console.error(`Error processing ${repo.name}:`, err);
          return { ...repo, tags: [], size: 0, lastUpdated: new Date().toISOString() };
        }
      })
    );

    return NextResponse.json({ repositories: enhancedRepos });
  } catch (error) {
    console.error('Registry info API error:', error);
    return NextResponse.json(
      { error: 'Failed to process registry information' },
      { status: 500 }
    );
  }
}
