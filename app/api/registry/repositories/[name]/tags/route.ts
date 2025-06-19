import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const n = searchParams.get('n');
    const last = searchParams.get('last');
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Build URL with pagination
    let url = `${REGISTRY_HOST}/v2/${params.name}/tags/list`;
    const urlParams = new URLSearchParams();
    if (n) urlParams.append('n', n);
    if (last) urlParams.append('last', last);
    if (urlParams.toString()) url += `?${urlParams.toString()}`;

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
    console.error('Tags API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
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
    let url = `${REGISTRY_HOST}/v2/${params.name}/tags/list`;
    if (pagination) {
      const urlParams = new URLSearchParams();
      if (pagination.n) urlParams.append('n', pagination.n.toString());
      if (pagination.last) urlParams.append('last', pagination.last);
      if (urlParams.toString()) url += `?${urlParams.toString()}`;
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
      name: data.name,
      tags: data.tags || [],
      pagination: {
        hasNext: !!nextUrl,
        nextUrl,
      },
    });

  } catch (error) {
    console.error('Tags API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}