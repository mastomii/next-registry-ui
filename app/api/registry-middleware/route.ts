import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost, AuthConfig } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function POST(request: NextRequest) {
  try {
    const { endpoint, method = 'GET', body, auth, params = {} } = await request.json();
    
    // Validate authentication
    if (!validateAuth(auth)) {
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      );
    }

    const basicAuth = createBasicAuth(auth);
    
    // Build URL with parameters
    let url = `${REGISTRY_HOST}${endpoint}`;
    if (Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Prepare headers
    const headers: HeadersInit = {
      'Authorization': basicAuth,
      'Accept': 'application/json',
    };

    // Set content type for requests with body
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      headers['Content-Type'] = 'application/json';
    }

    // Make request to registry
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    
    // Handle different response types
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    // Return response with headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return NextResponse.json({
      status: response.status,
      data: responseData,
      headers: Object.fromEntries(responseHeaders.entries()),
    }, {
      status: response.ok ? 200 : response.status,
    });

  } catch (error) {
    console.error('Registry middleware error:', error);
    return NextResponse.json(
      { error: 'Failed to process registry request' },
      { status: 500 }
    );
  }
}