import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, createBasicAuth, getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string; uuid: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/blobs/uploads/${params.uuid}`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return NextResponse.json({
      status: response.status,
      location: response.headers.get('location'),
      range: response.headers.get('range'),
      uploadUuid: response.headers.get('Docker-Upload-UUID'),
    }, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Blob upload status API error:', error);
    return NextResponse.json(
      { error: 'Failed to get upload status' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { name: string; uuid: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const body = await request.arrayBuffer();
    const contentLength = request.headers.get('content-length');
    const contentRange = request.headers.get('content-range');

    const headers: HeadersInit = {
      'Authorization': authHeader,
      'Content-Type': 'application/octet-stream',
    };

    if (contentLength) headers['Content-Length'] = contentLength;
    if (contentRange) headers['Content-Range'] = contentRange;

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/blobs/uploads/${params.uuid}`, {
      method: 'PATCH',
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
      range: response.headers.get('range'),
      uploadUuid: response.headers.get('Docker-Upload-UUID'),
      data: responseData,
    }, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Blob upload chunk API error:', error);
    return NextResponse.json(
      { error: 'Failed to upload chunk' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string; uuid: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const digest = searchParams.get('digest');

    if (!digest) {
      return NextResponse.json(
        { error: 'Digest parameter required for upload completion' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const body = await request.arrayBuffer();
    const contentLength = request.headers.get('content-length');
    const contentRange = request.headers.get('content-range');

    const headers: HeadersInit = {
      'Authorization': authHeader,
      'Content-Type': 'application/octet-stream',
    };

    if (contentLength) headers['Content-Length'] = contentLength;
    if (contentRange) headers['Content-Range'] = contentRange;

    const url = `${REGISTRY_HOST}/v2/${params.name}/blobs/uploads/${params.uuid}?digest=${digest}`;

    const response = await fetch(url, {
      method: 'PUT',
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
      digest: response.headers.get('Docker-Content-Digest'),
      contentRange: response.headers.get('content-range'),
      data: responseData,
    }, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Blob upload complete API error:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string; uuid: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/${params.name}/blobs/uploads/${params.uuid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Length': '0',
      },
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
    }, {
      status: response.status,
    });

  } catch (error) {
    console.error('Blob upload cancel API error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel upload' },
      { status: 500 }
    );
  }
}