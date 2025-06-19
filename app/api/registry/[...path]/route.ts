import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_HOST = process.env.REGISTRY_HOST || 'https://registry.mastomi.cloud';

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
    const path = pathSegments.join('/');
    const url = `${REGISTRY_HOST}/${path}`;
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Prepare headers for the registry request
    const headers: HeadersInit = {
      'Authorization': authHeader,
      'Accept': request.headers.get('accept') || 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json',
    };

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      const body = await request.text();
      if (body) {
        requestOptions.body = body;
      }
    }

    // Make request to registry
    const registryResponse = await fetch(url, requestOptions);

    // Handle different response types
    if (method === 'HEAD') {
      // For HEAD requests, return headers without body
      const responseHeaders = new Headers();
      registryResponse.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });
      
      return new NextResponse(null, {
        status: registryResponse.status,
        headers: responseHeaders,
      });
    }

    // For other requests, handle JSON or text response
    let responseData;
    const contentType = registryResponse.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        responseData = await registryResponse.json();
      } catch {
        responseData = await registryResponse.text();
      }
    } else {
      responseData = await registryResponse.text();
    }

    // Return response with appropriate status and headers
    const responseHeaders = new Headers();
    registryResponse.headers.forEach((value, key) => {
      // Skip headers that might cause issues
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return NextResponse.json(responseData, {
      status: registryResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Registry proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to registry' },
      { status: 500 }
    );
  }
}