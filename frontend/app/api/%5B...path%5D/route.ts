import { NextRequest, NextResponse } from 'next/server';

const BACKEND_TARGET =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://199.192.23.46:4702';

async function handleProxy(req: NextRequest, { params }: { params: { path?: string[] } }) {
  const pathArray = params?.path ?? [];
  const pathname = `/api/${pathArray.join('/')}`;
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_TARGET.replace(/\/+$/, '')}${pathname}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Avoid forwarding host or connection headers that conflict with upstream
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });
    // Ensure cache-control is no-store for dynamic endpoints
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    const resData = await upstreamRes.arrayBuffer();
    return new NextResponse(resData, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[API Proxy Error] Failed to proxy to ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Backend unreachable', detail: String(err) },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const dynamic = 'force-dynamic';
