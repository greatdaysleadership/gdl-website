// Returns the four newest Bad Days Leadership episodes for the podcast page.
// Reads the show's YouTube playlist feed, not the channel feed, because the
// channel also carries Lessons From The Sidelines, The Core and Shorts.
// An episode that is never added to the playlist never appears on the site.
// On any feed problem it returns 502 with an empty list, and the page keeps
// the four episodes written into its HTML.

const PLAYLIST_ID = 'PLMYjq2D3rYhifM5jjmTeTeNn7NYuMf5rh';
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?playlist_id=' + PLAYLIST_ID;
const COUNT = 4;

function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  return m ? decode(m[1]) : '';
}

function parseFeed(xml) {
  const entries = String(xml).match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const out = [];
  for (const e of entries) {
    const id = tag(e, 'yt:videoId');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    out.push({ id, title: tag(e, 'title'), published: tag(e, 'published') });
  }
  out.sort((a, b) => (b.published > a.published ? 1 : b.published < a.published ? -1 : 0));
  return out.slice(0, COUNT);
}

exports.parseFeed = parseFeed;

exports.handler = async () => {
  const fail = (reason) => ({
    statusCode: 502,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ episodes: [], error: reason })
  });

  let xml;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(FEED_URL, { signal: ctrl.signal, headers: { 'User-Agent': 'greatdaysleadership.com podcast page' } });
    clearTimeout(timer);
    if (!res.ok) return fail('feed returned ' + res.status);
    xml = await res.text();
  } catch (e) {
    return fail('feed unreachable');
  }

  const episodes = parseFeed(xml);
  if (episodes.length < COUNT) return fail('feed had ' + episodes.length + ' episodes');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      // Browsers recheck after 10 minutes; Netlify's edge holds it for an hour.
      'Cache-Control': 'public, max-age=600',
      'Netlify-CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
    },
    body: JSON.stringify({ episodes })
  };
};
