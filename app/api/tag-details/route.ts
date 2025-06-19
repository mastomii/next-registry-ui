import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_HOST = process.env.REGISTRY_HOST || 'https://registry.mastomi.cloud';

export async function POST(request: NextRequest) {
  try {
    const { repository, tags, auth } = await request.json();
    
    if (!auth || !auth.username || !auth.password) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const basicAuth = 'Basic ' + btoa(`${auth.username}:${auth.password}`);
    
    const tagDetails = await Promise.all(
      tags.map(async (tagName: string) => {
        try {
          // Get manifest
          const manifestResponse = await fetch(`${REGISTRY_HOST}/v2/${repository}/manifests/${tagName}`, {
            headers: {
              'Authorization': basicAuth,
              'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
            },
          });

          if (!manifestResponse.ok) {
            throw new Error(`Manifest not found for ${tagName}`);
          }

          // Get digest from headers
          const digest = manifestResponse.headers.get('Docker-Content-Digest') || '';
          
          const manifestText = await manifestResponse.text();
          
          // Parse the manifest (handle both string and object responses)
          let manifest;
          try {
            manifest = JSON.parse(manifestText);
          } catch {
            manifest = manifestText;
          }

          console.log(`Manifest for ${repository}:${tagName}:`, manifest);

          // Calculate total size: sum of all layers + config size
          let totalSize = 0;
          
          if (manifest.layers && Array.isArray(manifest.layers)) {
            totalSize = manifest.layers.reduce((sum: number, layer: any) => {
              const layerSize = typeof layer.size === 'number' ? layer.size : 0;
              return sum + layerSize;
            }, 0);

            // Add config size
            if (manifest.config && typeof manifest.config.size === 'number') {
              totalSize += manifest.config.size;
            }
          }

          console.log(`Calculated size for ${repository}:${tagName}: ${totalSize} bytes`);

          return {
            name: tagName,
            digest,
            size: totalSize,
            created: new Date().toISOString(),
            architecture: manifest.architecture || 'amd64',
            os: manifest.os || 'linux',
          };
        } catch (error) {
          console.error(`Error getting details for tag ${tagName}:`, error);
          return {
            name: tagName,
            digest: '',
            size: 0,
            created: new Date().toISOString(),
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