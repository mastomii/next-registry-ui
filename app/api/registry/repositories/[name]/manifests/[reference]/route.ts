import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string; reference: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const acceptHeader = request.headers.get('accept') || 'application/vnd.docker.distribution.manifest.v2+json';

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/manifests/${params.reference}`, {
      headers: {
        'Authorization': authHeader,
        'Accept': acceptHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Registry error: ${response.status}`);
    }

    const manifestText = await response.text();
    
    // Parse manifest
    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      manifest = manifestText;
    }

    // Get digest from headers
    const digest = response.headers.get('Docker-Content-Digest') || '';
    
    // Forward important headers
    const responseHeaders = new Headers();
    if (digest) responseHeaders.set('Docker-Content-Digest', digest);
    responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');

    return NextResponse.json({
      manifest,
      digest,
      contentType: response.headers.get('content-type'),
    }, {
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Manifest API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manifest' },
      { status: 500 }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { name: string; reference: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const acceptHeader = request.headers.get('accept') || 'application/vnd.docker.distribution.manifest.v2+json';

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/manifests/${params.reference}`, {
      method: 'HEAD',
      headers: {
        'Authorization': authHeader,
        'Accept': acceptHeader,
      },
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(null, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Manifest HEAD API error:', error);
    return NextResponse.json(
      { error: 'Failed to check manifest' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string; reference: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const body = await request.text();
    const contentType = request.headers.get('content-type') || 'application/vnd.docker.distribution.manifest.v2+json';

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/manifests/${params.reference}`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': contentType,
      },
      body,
    });

    const responseData = response.ok ? null : await response.text();
    
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      data: responseData,
      location: response.headers.get('location'),
      digest: response.headers.get('Docker-Content-Digest'),
    }, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Manifest PUT API error:', error);
    return NextResponse.json(
      { error: 'Failed to upload manifest' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string; reference: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/manifests/${params.reference}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
    }, {
      status: response.status,
    });

  } catch (error) {
    console.error('Manifest DELETE API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete manifest' },
      { status: 500 }
    );
  }
}