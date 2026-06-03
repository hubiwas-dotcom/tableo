async function kvSet(key, value) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('KV_NOT_CONFIGURED');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(value)])
  });
  return res.ok;
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const adminSecret = process.env.ACTIVATE_SECRET || 'tableo-activate-changeme';

  /* GET /api/activate?email=x&secret=y — check status */
  if (req.method === 'GET') {
    const { email, secret } = req.query || {};
    if (secret !== adminSecret) { res.status(403).json({ error: 'Brak uprawnień.' }); return; }
    if (!email) { res.status(400).json({ error: 'Brak email.' }); return; }
    const paid = await kvGet(`paid:${email}`);
    res.json({ email, paid: !!paid?.active, data: paid });
    return;
  }

  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { email, secret, action } = req.body || {};

  if (secret !== adminSecret) {
    res.status(403).json({ error: 'Brak uprawnień.' });
    return;
  }
  if (!email) {
    res.status(400).json({ error: 'Wymagany parametr: email.' });
    return;
  }

  if (action === 'deactivate') {
    /* Deactivate — revoke subscription */
    await kvSet(`paid:${email}`, { active: false, deactivated_at: Date.now(), email });
    res.json({ ok: true, message: `Dezaktywowano: ${email}` });
    return;
  }

  /* Default: activate */
  const days = parseInt(req.body.days || '0') || 0; /* 0 = permanent */
  const expires_at = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null;

  await kvSet(`paid:${email}`, {
    active: true,
    activated_at: Date.now(),
    expires_at,
    email,
  });

  res.json({
    ok: true,
    message: `Aktywowano: ${email}`,
    expires_at: expires_at ? new Date(expires_at).toISOString() : 'permanent',
  });
};
