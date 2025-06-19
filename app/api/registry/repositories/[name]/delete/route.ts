import { NextRequest, NextResponse } from 'next/server';
import { createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

// Optional: hardcoded basic auth from env
const registryAuth = {
  username: process.env.REGISTRY_USER || '',
  password: process.env.REGISTRY_PASS || '',
};

const basicAuth = createBasicAuth(registryAuth);

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const repositoryName = params.name;
    console.log(`Starting deletion for repository: ${repositoryName}`);

    // Step 1: Get all tags
    const tagsRes = await fetch(`${REGISTRY_HOST}/v2/${repositoryName}/tags/list`, {
      headers: {
        Authorization: basicAuth,
        Accept: 'application/json',
      },
    });

    if (!tagsRes.ok) {
      if (tagsRes.status === 404) {
        return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
      }
      throw new Error(`Failed to get tags: ${tagsRes.status}`);
    }

    const tagsData = await tagsRes.json();
    const tags = tagsData.tags || [];

    const results = {
      totalTags: tags.length,
      deletedTags: 0,
      deletedManifests: 0,
      errors: [] as string[],
      manifests: [] as { tag: string; digest: string; deleted: boolean }[],
    };

    // Step 2: Delete all digests
    for (const tag of tags) {
      try {
        const head = await fetch(`${REGISTRY_HOST}/v2/${repositoryName}/manifests/${tag}`, {
          method: 'HEAD',
          headers: {
            Authorization: basicAuth,
            Accept: 'application/vnd.docker.distribution.manifest.v2+json',
          },
        });

        if (!head.ok) {
          results.errors.push(`HEAD failed for tag ${tag}: ${head.status}`);
          continue;
        }

        const digest = head.headers.get('Docker-Content-Digest');
        if (!digest) {
          results.errors.push(`No digest for tag ${tag}`);
          continue;
        }

        const del = await fetch(`${REGISTRY_HOST}/v2/${repositoryName}/manifests/${digest}`, {
          method: 'DELETE',
          headers: {
            Authorization: basicAuth,
          },
        });

        results.manifests.push({
          tag,
          digest,
          deleted: del.ok,
        });

        if (del.ok) {
          results.deletedTags++;
          results.deletedManifests++;
        } else {
          results.errors.push(`Delete failed for tag ${tag} (digest ${digest})`);
        }
      } catch (err) {
        results.errors.push(`Error deleting tag ${tag}: ${err}`);
      }
    }

    const finalRes = {
      success: results.errors.length === 0,
      repositoryName,
      deletedTags: results.deletedTags,
      deletedManifests: results.deletedManifests,
      errors: results.errors,
      note: 'You may need to run garbage-collect on the registry host to free up space.',
    };

    return NextResponse.json(finalRes);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Server error deleting repository',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
