import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function POST(request: NextRequest) {
  try {
    const { auth } = await request.json();
    
    if (!validateAuth(auth)) {
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      );
    }

    const basicAuth = createBasicAuth(auth);
    
    // Get catalog
    const catalogResponse = await fetch(`${REGISTRY_HOST}/v2/_catalog`, {
      headers: {
        'Authorization': basicAuth,
        'Accept': 'application/json',
      },
    });

    if (!catalogResponse.ok) {
      throw new Error('Failed to fetch catalog');
    }

    const catalog = await catalogResponse.json();
    const repositories = catalog.repositories || [];

    // Analyze each repository
    const analytics = await Promise.all(
      repositories.map(async (repoName: string) => {
        try {
          // Get tags
          const tagsResponse = await fetch(`${REGISTRY_HOST}/v2/${repoName}/tags/list`, {
            headers: {
              'Authorization': basicAuth,
              'Accept': 'application/json',
            },
          });

          if (!tagsResponse.ok) {
            return {
              name: repoName,
              tags: [],
              totalSize: 0,
              layerCount: 0,
              error: 'Failed to fetch tags',
            };
          }

          const tagsData = await tagsResponse.json();
          const tags = tagsData.tags || [];

          let totalSize = 0;
          let layerCount = 0;
          const tagDetails = [];

          // Analyze each tag
          for (const tag of tags) {
            try {
              const manifestResponse = await fetch(`${REGISTRY_HOST}/v2/${repoName}/manifests/${tag}`, {
                headers: {
                  'Authorization': basicAuth,
                  'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
                },
              });

              if (manifestResponse.ok) {
                const manifestText = await manifestResponse.text();
                let manifest;
                
                try {
                  manifest = JSON.parse(manifestText);
                } catch {
                  manifest = manifestText;
                }

                if (manifest.layers && Array.isArray(manifest.layers)) {
                  const tagSize = manifest.layers.reduce((sum: number, layer: any) => {
                    return sum + (typeof layer.size === 'number' ? layer.size : 0);
                  }, 0);

                  // Add config size
                  if (manifest.config && typeof manifest.config.size === 'number') {
                    totalSize += manifest.config.size;
                  }

                  totalSize += tagSize;
                  layerCount += manifest.layers.length;

                  tagDetails.push({
                    name: tag,
                    size: tagSize + (manifest.config?.size || 0),
                    layers: manifest.layers.length,
                    digest: manifestResponse.headers.get('Docker-Content-Digest') || '',
                    architecture: manifest.architecture || 'unknown',
                    os: manifest.os || 'unknown',
                  });
                }
              }
            } catch (error) {
              console.error(`Error analyzing tag ${tag} in ${repoName}:`, error);
            }
          }

          return {
            name: repoName,
            tags: tagDetails,
            totalSize,
            layerCount,
            tagCount: tags.length,
          };
        } catch (error) {
          console.error(`Error analyzing repository ${repoName}:`, error);
          return {
            name: repoName,
            tags: [],
            totalSize: 0,
            layerCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Calculate overall statistics
    const totalRepositories = repositories.length;
    const totalTags = analytics.reduce((sum, repo) => sum + (repo.tagCount || 0), 0);
    const totalSize = analytics.reduce((sum, repo) => sum + repo.totalSize, 0);
    const totalLayers = analytics.reduce((sum, repo) => sum + repo.layerCount, 0);

    // Find largest repositories
    const largestRepos = analytics
      .filter(repo => !repo.error)
      .sort((a, b) => b.totalSize - a.totalSize)
      .slice(0, 10);

    // Architecture distribution
    const architectures: Record<string, number> = {};
    analytics.forEach(repo => {
      repo.tags.forEach((tag: any) => {
        const arch = tag.architecture || 'unknown';
        architectures[arch] = (architectures[arch] || 0) + 1;
      });
    });

    return NextResponse.json({
      summary: {
        totalRepositories,
        totalTags,
        totalSize,
        totalLayers,
        averageRepoSize: totalRepositories > 0 ? totalSize / totalRepositories : 0,
        averageTagsPerRepo: totalRepositories > 0 ? totalTags / totalRepositories : 0,
      },
      repositories: analytics,
      insights: {
        largestRepositories: largestRepos,
        architectureDistribution: architectures,
        repositoriesWithErrors: analytics.filter(repo => repo.error).length,
      },
    });

  } catch (error) {
    console.error('Registry analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}