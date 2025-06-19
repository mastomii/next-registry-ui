import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const digest = searchParams.get('digest');
    const mount = searchParams.get('mount');
    const from = searchParams.get('from');

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Build URL with query parameters
    let url = `${REGISTRY_HOST}/v2/${params.name}/blobs/uploads/`;
    const urlParams = new URLSearchParams();
    if (digest) urlParams.append('digest', digest);
    if (mount) urlParams.append('mount', mount);
    if (from) urlParams.append('from', from);
    if (urlParams.toString()) url += `?${urlParams.toString()}`;

    const headers: HeadersInit = {
      'Authorization': authHeader,
    };

    let body = null;
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      body = await request.arrayBuffer();
      headers['Content-Length'] = contentLength;
      headers['Content-Type'] = request.headers.get('content-type') || 'application/octet-stream';
    } else {
      headers['Content-Length'] = '0';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    let responseData = null;
    if (!response.ok) {
      try {
        responseData = await response.text();
      } catch {
        responseData = null;
      }
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      location: response.headers.get('location'),
      uploadUuid: response.headers.get('Docker-Upload-UUID'),
      range: response.headers.get('range'),
      data: responseData,
    }, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Blob upload initiate API error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate blob upload' },
      { status: 500 }
    );
  }
}