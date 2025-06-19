import { NextRequest, NextResponse } from 'next/server';
import { getRegistryHost } from '@/lib/auth-middleware';

const REGISTRY_HOST = getRegistryHost();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${REGISTRY_HOST}/v2/`, {
      headers,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
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
      status: response.status,
      apiVersion: response.headers.get('Docker-Distribution-API-Version'),
      authenticated: response.status === 200,
      data: responseData,
    }, {
      status: response.ok ? 200 : response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Registry version API error:', error);
    return NextResponse.json(
      { error: 'Failed to check registry version' },
      { status: 500 }
    );
  }
}