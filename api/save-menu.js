const crypto = require('crypto');

function kvCreds() {
  return {
    url:   process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
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
    return JSON.parse(Buffer.from(payload, 'base64').toString());
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

  const base = (menu.restaurant_name || 'menu')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 36);
  const slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;

  await kvSet(`menu:${slug}`, { menu, owner: user.email, published_at: Date.now() });

  const host = (req.headers.host || 'tableo-murex.vercel.app').replace(/^www\./, '');
  res.json({ ok: true, slug, url: `https://${host}/menu/${slug}` });
};
