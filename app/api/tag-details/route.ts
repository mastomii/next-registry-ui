export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { repository, tags, auth } = await request.json();

    if (!auth?.username || !auth?.password) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const REGISTRY_HOST = process.env.REGISTRY_HOST || 'https://your-private-registry';
    const basicAuth = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');

    const tagDetails = await Promise.all(
      tags.map(async (tagName: string) => {
        try {
          // First, try to get manifest list (for multi-arch images)
          let manifestRes = await fetch(`${REGISTRY_HOST}/v2/${repository}/manifests/${tagName}`, {
            headers: {
              Authorization: basicAuth,
              Accept: 'application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json',
            },
          });

          if (!manifestRes.ok) {
            throw new Error(`Manifest not found for tag: ${tagName}`);
          }

          const digest = manifestRes.headers.get('Docker-Content-Digest') || '';
          const manifestText = await manifestRes.text();

          let manifest: any;
          try {
            manifest = JSON.parse(manifestText);
          } catch {
            manifest = manifestText;
          }

          let totalSize = 0;
          let created = '';
          let architecture = 'amd64';
          let os = 'linux';

          // Check if this is a manifest list (multi-arch)
          if (manifest.manifests && Array.isArray(manifest.manifests)) {
            // Get the first manifest from the list (usually amd64/linux)
            const firstManifest = manifest.manifests.find(
              (m: any) => m.platform?.architecture === 'amd64' && m.platform?.os === 'linux'
            ) || manifest.manifests[0];

            if (firstManifest) {
              architecture = firstManifest.platform?.architecture || 'amd64';
              os = firstManifest.platform?.os || 'linux';

              // Fetch the actual manifest
              const actualManifestRes = await fetch(
                `${REGISTRY_HOST}/v2/${repository}/manifests/${firstManifest.digest}`,
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

          // Calculate size from layers
          if (manifest?.layers && Array.isArray(manifest.layers)) {
            totalSize = manifest.layers.reduce((sum: number, layer: any) => {
              return sum + (typeof layer.size === 'number' ? layer.size : 0);
            }, 0);

            if (manifest.config?.size && typeof manifest.config.size === 'number') {
              totalSize += manifest.config.size;
            }
          }

          // Fetch config blob to get the actual created time
          if (manifest?.config?.digest) {
            try {
              const configRes = await fetch(
                `${REGISTRY_HOST}/v2/${repository}/blobs/${manifest.config.digest}`,
                {
                  headers: {
                    Authorization: basicAuth,
                    Accept: 'application/json',
                  },
                }
              );

              if (configRes.ok) {
                const config = await configRes.json();
                // The created field is in the config blob
                if (config.created) {
                  created = config.created;
                }
                // Also get architecture and os from config if available
                if (config.architecture) {
                  architecture = config.architecture;
                }
                if (config.os) {
                  os = config.os;
                }
              }
            } catch (configError) {
              console.error(`Error fetching config blob for ${tagName}:`, configError);
            }
          }

          // Fallback to current time if created is not found
          if (!created) {
            created = new Date().toISOString();
          }

          return {
            name: tagName,
            digest,
            size: totalSize,
            created,
            architecture,
            os,
          };
        } catch (error) {
          console.error(`Error fetching tag ${tagName}:`, error);
          return {
            name: tagName,
            digest: '',
            size: 0,
            created: new Date().toISOString(),
            error: true,
          };
        }
      })
    );

    return NextResponse.json({ tags: tagDetails });
  } catch (error) {
    console.error('Tag details API error:', error);
    return NextResponse.json(
      { error: 'Failed to get tag details' },
      { status: 500 }
    );
  }
}
