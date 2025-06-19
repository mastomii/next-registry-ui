import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_HOST = process.env.REGISTRY_HOST || 'https://registry.mastomi.cloud';

export async function POST(request: NextRequest) {
  try {
    const { repositories, auth } = await request.json();
    
    if (!auth || !auth.username || !auth.password) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const basicAuth = 'Basic ' + btoa(`${auth.username}:${auth.password}`);
    
    const enhancedRepos = await Promise.all(
      repositories.map(async (repo: any) => {
        try {
          // Get tags
          const tagsResponse = await fetch(`${REGISTRY_HOST}/v2/${repo.name}/tags/list`, {
            headers: {
              'Authorization': basicAuth,
              'Accept': 'application/json',
            },
          });

          if (!tagsResponse.ok) {
            console.error(`Failed to get tags for ${repo.name}:`, tagsResponse.status);
            return { ...repo, tags: [], size: 0 };
          }

          const tagsData = await tagsResponse.json();
          const tags = tagsData.tags || [];

          let totalSize = 0;

          // Calculate size from latest tag if available
          if (tags.includes('latest')) {
            try {
              const manifestResponse = await fetch(`${REGISTRY_HOST}/v2/${repo.name}/manifests/latest`, {
                headers: {
                  'Authorization': basicAuth,
                  'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
                },
              });

              if (manifestResponse.ok) {
                const manifestText = await manifestResponse.text();
                
                // Parse the manifest (handle both string and object responses)
                let manifest;
                try {
                  manifest = JSON.parse(manifestText);
                } catch {
                  // If it's already an object, use it directly
                  manifest = manifestText;
                }

                console.log(`Manifest for ${repo.name}:`, manifest);

                // Calculate total size: sum of all layers + config size
                if (manifest.layers && Array.isArray(manifest.layers)) {
                  totalSize = manifest.layers.reduce((sum: number, layer: any) => {
                    const layerSize = typeof layer.size === 'number' ? layer.size : 0;
                    return sum + layerSize;
                  }, 0);

                  // Add config size
                  if (manifest.config && typeof manifest.config.size === 'number') {
                    totalSize += manifest.config.size;
                  }

                  console.log(`Calculated size for ${repo.name}: ${totalSize} bytes`);
                }
              }
            } catch (error) {
              console.error(`Error calculating size for ${repo.name}:`, error);
            }
          }

          return {
            ...repo,
            tags,
            size: totalSize,
            lastUpdated: new Date().toISOString(),
          };
        } catch (error) {
          console.error(`Error processing repository ${repo.name}:`, error);
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