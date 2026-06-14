const ALLOWED_HOST = 'calendar.google.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const icalUrl = url.searchParams.get('url');
    if (!icalUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    let parsed;
    try {
      parsed = new URL(icalUrl);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_HOST) {
      return new Response('Only Google Calendar iCal URLs are allowed', { status: 403 });
    }

    try {
      const response = await fetch(icalUrl, { redirect: 'manual' });
      if (!response.ok) {
        return new Response('Upstream error', { status: 502 });
      }
      const body = await response.text();

      return new Response(body, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch {
      return new Response('Upstream fetch failed', { status: 502 });
    }
  },
};
