export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRegistryRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRegistryRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRegistryRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRegistryRequest(request, params.path, 'DELETE');
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRegistryRequest(request, params.path, 'HEAD');
}

async function handleRegistryRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    const REGISTRY_HOST = process.env.REGISTRY_HOST || 'https://your-private-registry';
    const path = pathSegments.join('/');
    const url = `${REGISTRY_HOST}/${path}`;

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const headers: HeadersInit = {
      Authorization: authHeader,
      Accept: request.headers.get('accept') || 'application/json',
    };

    const contentType = request.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' || method === 'PUT') {
      const body = await request.text();
      if (body) {
        requestOptions.body = body;
      }
    }

    const registryResponse = await fetch(url, requestOptions);

    // HEAD request: return only headers
    if (method === 'HEAD') {
      const responseHeaders = new Headers();
      registryResponse.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });
      return new NextResponse(null, {
        status: registryResponse.status,
        headers: responseHeaders,
      });
    }

    const registryContentType = registryResponse.headers.get('content-type') || '';
    let responseData;

    if (registryContentType.includes('application/json')) {
      try {
        responseData = await registryResponse.json();
      } catch {
        responseData = await registryResponse.text(); // fallback if broken JSON
      }
    } else {
      responseData = await registryResponse.text();
    }

    const responseHeaders = new Headers();
    registryResponse.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      {
        status: registryResponse.status,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error('Registry proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to registry' },
      { status: 500 }
    );
  }
}
