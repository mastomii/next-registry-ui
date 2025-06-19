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

          // 2. Try to get manifest for 'latest' tag
          if (tags.includes('latest')) {
            const manifestRes = await fetch(`${REGISTRY_HOST}/v2/${repo.name}/manifests/latest`, {
              headers: {
                Authorization: basicAuth,
                Accept: 'application/vnd.docker.distribution.manifest.v2+json',
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

              // 3. Calculate total size from layers and config
              if (manifest?.layers && Array.isArray(manifest.layers)) {
                totalSize = manifest.layers.reduce((sum: number, layer: any) => {
                  return sum + (typeof layer.size === 'number' ? layer.size : 0);
                }, 0);

                if (manifest.config?.size) {
                  totalSize += manifest.config.size;
                }
              }
            }
          }

          return {
            ...repo,
            tags,
            size: totalSize,
            lastUpdated: new Date().toISOString(),
          };
        } catch (err) {
          console.error(`Error processing ${repo.name}:`, err);
          return { ...repo, tags: [], size: 0 };
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
