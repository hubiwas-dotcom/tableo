const https = require('https');
const crypto = require('crypto');

function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (Date.now() - data.iat > 30 * 24 * 60 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

async function kvGet(key) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch { return null; }
}

async function kvSet(key, value) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, JSON.stringify(value)])
    });
    return res.ok;
  } catch { return false; }
}

const LANG_NAMES = { en: 'English', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish', ru: 'Russian' };

function callClaude(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) { reject(new Error('No JSON in response')); return; }
          resolve(JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1')));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* Build slim (text-only) menu and translate it via Claude. Returns translated slim menu. */
async function translateSlim(apiKey, sourceMenu, lang) {
  const slim = {
    restaurant_name: sourceMenu.restaurant_name,
    tagline:         sourceMenu.tagline,
    categories: (sourceMenu.categories || []).map(cat => ({
      name:  cat.name,
      items: (cat.items || []).map(item => ({
        name:        item.name,
        description: item.description,
        price:       item.price,
      }))
    }))
  };

  const prompt = `Translate this Polish restaurant menu JSON to ${LANG_NAMES[lang]}.
Rules:
- Translate: restaurant_name, tagline, category names, dish names, dish descriptions
- Keep prices EXACTLY as-is (do not translate "zł" or any currency)
- Keep JSON structure identical
- Return ONLY valid JSON, no markdown, no comments

${JSON.stringify(slim, null, 2)}`;

  const translated = await callClaude(apiKey, prompt);

  /* Always keep original prices */
  (translated.categories || []).forEach((cat, ci) => {
    (cat.items || []).forEach((item, ii) => {
      const orig = sourceMenu.categories?.[ci]?.items?.[ii];
      item.price = orig?.price || item.price;
    });
  });

  return translated;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Brak klucza API.' }); return; }

  /* ── POST: translate an in-editor (unpublished) menu, requires auth ── */
  if (req.method === 'POST') {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!verifyToken(token)) { res.status(401).json({ error: 'Sesja wygasła.' }); return; }

    const { menu, lang } = req.body || {};
    if (!menu || !Object.keys(LANG_NAMES).includes(lang)) {
      res.status(400).json({ error: 'Wymagane: menu, lang.' });
      return;
    }
    try {
      const translated = await translateSlim(apiKey, menu, lang);
      res.json({ ok: true, menu: translated });
    } catch (e) {
      res.status(500).json({ error: 'Błąd tłumaczenia: ' + e.message });
    }
    return;
  }

  /* ── GET: translate a published menu by slug, cached in KV ── */
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const { slug, lang } = req.query || {};
  if (!slug || !Object.keys(LANG_NAMES).includes(lang)) {
    res.status(400).json({ error: 'Wymagane: slug, lang.' });
    return;
  }

  /* Check cache first */
  const cacheKey = `menu:${slug}:${lang}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.json({ ok: true, menu: cached, cached: true });
    return;
  }

  /* Get original menu */
  const original = await kvGet(`menu:${slug}`);
  if (!original?.menu) {
    res.status(404).json({ error: 'Menu nie znalezione.' });
    return;
  }

  try {
    const translated = await translateSlim(apiKey, original.menu, lang);

    /* Merge images back from original */
    (translated.categories || []).forEach((cat, ci) => {
      (cat.items || []).forEach((item, ii) => {
        const orig = original.menu.categories?.[ci]?.items?.[ii];
        if (orig?.image) item.image = orig.image;
      });
    });
    if (original.menu.logo) translated.logo = original.menu.logo;

    /* Cache translation (text only, no images for size) */
    const toCache = {
      restaurant_name: translated.restaurant_name,
      tagline:         translated.tagline,
      logo:            translated.logo,
      categories: (translated.categories || []).map(cat => ({
        name:  cat.name,
        items: (cat.items || []).map(item => ({
          name:        item.name,
          description: item.description,
          price:       item.price,
        }))
      }))
    };
    await kvSet(cacheKey, toCache);

    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.json({ ok: true, menu: translated });
  } catch (e) {
    res.status(500).json({ error: 'Błąd tłumaczenia: ' + e.message });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '4mb' } } };
