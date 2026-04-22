import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy Wikipedia REST API to fetch page HTML.
 * Wikipedia blocks iframes (X-Frame-Options: DENY) so we fetch server-side
 * and return the HTML to the client for in-app rendering.
 *
 * GET /api/wiki?lang=fr&title=France
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lang = searchParams.get('lang') ?? 'fr';
  const title = searchParams.get('title');

  if (!title) {
    return NextResponse.json(
      { error: 'Missing "title" query parameter' },
      { status: 400 },
    );
  }

  // Validate lang to prevent SSRF
  if (!/^[a-z]{2,5}$/.test(lang)) {
    return NextResponse.json(
      { error: 'Invalid lang parameter' },
      { status: 400 },
    );
  }

  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encoded}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html; charset=utf-8',
        'User-Agent': 'MVPCulture-WikiRace/1.0 (educational game)',
      },
      next: { revalidate: 300 }, // Cache 5 min
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Wikipedia returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      );
    }

    const html = await res.text();

    // Extract the display title from the response header or from the HTML
    const displayTitle =
      res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] ??
      title.replace(/_/g, ' ');

    return NextResponse.json(
      { html, title: displayTitle },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    console.error('[api/wiki] fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch from Wikipedia' },
      { status: 502 },
    );
  }
}
