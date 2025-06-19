import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string; digest: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const rangeHeader = request.headers.get('range');
    const headers: HeadersInit = {
      'Authorization': authHeader,
    };

    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/blobs/${params.digest}`, {
      headers,
    });

    // Handle redirects
    if (response.status === 307 || response.status === 302) {
      const location = response.headers.get('location');
      return NextResponse.json({
        redirect: true,
        location,
        digest: response.headers.get('Docker-Content-Digest'),
      });
    }

    if (!response.ok) {
      throw new Error(`Registry error: ${response.status}`);
    }

    // For successful responses, we might want to stream the blob
    // For now, we'll return metadata
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Blob GET API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blob' },
      { status: 500 }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { name: string; digest: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/blobs/${params.digest}`, {
      method: 'HEAD',
      headers: {
        'Authorization': authHeader,
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
    console.error('Blob HEAD API error:', error);
    return NextResponse.json(
      { error: 'Failed to check blob' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string; digest: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/blobs/${params.digest}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      digest: response.headers.get('Docker-Content-Digest'),
    }, {
      status: response.status,
    });

  } catch (error) {
    console.error('Blob DELETE API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete blob' },
      { status: 500 }
    );
  }
}