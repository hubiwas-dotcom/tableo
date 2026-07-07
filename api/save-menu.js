const crypto = require('crypto');

function kvCreds() {
  return {
    url:   process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

async function kvGet(key) {
  const { url, token } = kvCreds();
  if (!url || !token) return null;
  try {
    const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch { return null; }
}

async function kvSet(key, value) {
  const { url, token } = kvCreds();
  if (!url || !token) throw new Error('KV_NOT_CONFIGURED');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(value)])
  });
  return res.ok;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (data.email) data.email = String(data.email).toLowerCase().trim();
    return data;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user  = verifyToken(token);
  if (!user) { res.status(401).json({ error: 'Sesja wygasła.' }); return; }

  const { menu } = req.body || {};
  if (!menu) { res.status(400).json({ error: 'Brak danych menu.' }); return; }

  const accountKey = `account:${user.email}`;
  /* Podwójny odczyt: chwilowy błąd KV nie może skutkować nowym slugiem —
     slug jest stały per konto na zawsze. */
  let account = await kvGet(accountKey);
  if (!account) account = await kvGet(accountKey);
  account = account || {};

  /* Reuse existing slug so the URL stays stable across republishes */
  let slug = account.slug;
  if (!slug) {
    const base = (menu.restaurant_name || 'menu')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 36);
    slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }

  /* URL jest stały: raz opublikowany adres nigdy się nie zmienia,
     niezależnie od tego, z jakiej domeny otwarto edytor. */
  const host          = (req.headers.host || 'qreat.pl').replace(/^www\./, '');
  const published_url = (account.slug === slug && account.published_url)
    ? account.published_url
    : `https://${host}/menu/${slug}`;
  const published_at  = Date.now();

  /* Save menu */
  await kvSet(`menu:${slug}`, { menu, owner: user.email, published_at });

  /* Update account record */
  account.slug          = slug;
  account.published_url = published_url;
  account.published_at  = published_at;
  await kvSet(accountKey, account);

  /* Keep domain index in sync if user has a custom domain */
  if (account.custom_domain) {
    await kvSet(`domain:${account.custom_domain}`, { slug, email: user.email });
  }

  res.json({ ok: true, slug, url: published_url });
};
