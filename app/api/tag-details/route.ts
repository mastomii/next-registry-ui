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
          const manifestRes = await fetch(`${REGISTRY_HOST}/v2/${repository}/manifests/${tagName}`, {
            headers: {
              Authorization: basicAuth,
              Accept: 'application/vnd.docker.distribution.manifest.v2+json',
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

          if (manifest?.layers && Array.isArray(manifest.layers)) {
            totalSize = manifest.layers.reduce((sum: number, layer: any) => {
              return sum + (typeof layer.size === 'number' ? layer.size : 0);
            }, 0);

            if (manifest.config?.size && typeof manifest.config.size === 'number') {
              totalSize += manifest.config.size;
            }
          }

          return {
            name: tagName,
            digest,
            size: totalSize,
            created: new Date().toISOString(),
            architecture: manifest.architecture || 'amd64',
            os: manifest.os || 'linux',
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
