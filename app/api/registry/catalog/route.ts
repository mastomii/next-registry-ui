import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const n = searchParams.get('n');
    const last = searchParams.get('last');
    
    // Get auth from request headers or body
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Build URL with pagination parameters
    let url = `${REGISTRY_HOST}/v2/_catalog`;
    const params = new URLSearchParams();
    if (n) params.append('n', n);
    if (last) params.append('last', last);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Registry error: ${response.status}`);
    }

    const data = await response.json();
    
    // Forward pagination headers
    const responseHeaders = new Headers();
    const linkHeader = response.headers.get('link');
    if (linkHeader) {
      responseHeaders.set('link', linkHeader);
    }

    return NextResponse.json(data, {
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Catalog API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, pagination } = await request.json();
    
    if (!validateAuth(auth)) {
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      );
    }

    const basicAuth = createBasicAuth(auth);
    
    // Build URL with pagination
    let url = `${REGISTRY_HOST}/v2/_catalog`;
    if (pagination) {
      const params = new URLSearchParams();
      if (pagination.n) params.append('n', pagination.n.toString());
      if (pagination.last) params.append('last', pagination.last);
      if (params.toString()) url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': basicAuth,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Registry error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract pagination info
    const linkHeader = response.headers.get('link');
    let nextUrl = null;
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (match) {
        nextUrl = match[1];
      }
    }

    return NextResponse.json({
      repositories: data.repositories || [],
      pagination: {
        hasNext: !!nextUrl,
        nextUrl,
      },
    });

  } catch (error) {
    console.error('Catalog API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
}