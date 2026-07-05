const crypto = require('crypto');

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Podaj email i hasło.' }); return;
  }

  const secret = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';

  /* Check registered users in KV */
  const userKey = `user:${email.toLowerCase().trim()}`;
  const user    = await kvGet(userKey);

  if (user) {
    const hash = crypto.createHmac('sha256', user.salt).update(password).digest('hex');
    if (hash !== user.hash) {
      res.status(401).json({ error: 'Nieprawidłowy email lub hasło.' }); return;
    }
    const ts      = user.trial_start || user.created_at || Date.now();
    user.last_login  = Date.now();
    user.login_count = (user.login_count || 0) + 1;
    if (!user.provider) user.provider = 'email';
    await kvSet(userKey, user);
    const payload = Buffer.from(JSON.stringify({ email: user.email, trial_start: ts, iat: Date.now() })).toString('base64');
    const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    res.json({ ok: true, token: `${payload}.${sig}`, email: user.email, trial_start: ts });
    return;
  }

  /* Fallback: admin password */
  const expectedPwd = process.env.EDITOR_PASSWORD || 'tableo2025';
  if (password !== expectedPwd) {
    res.status(401).json({ error: 'Nieprawidłowy email lub hasło.' }); return;
  }

  const ts      = Date.now();
  const existing = (await kvGet(userKey)) || {};
  await kvSet(userKey, {
    ...existing, email,
    provider:   existing.provider || 'admin',
    created_at: existing.created_at || ts,
    last_login: ts,
    login_count: (existing.login_count || 0) + 1,
  });
  const payload = Buffer.from(JSON.stringify({ email, iat: ts })).toString('base64');
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  res.json({ ok: true, token: `${payload}.${sig}`, email, trial_start: ts });
};
