const crypto = require('crypto');

/* ── Vercel KV via native fetch (Node 18+) ── */
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  /* KV check */
  const { url: kvUrl, token: kvToken } = kvCreds();
  if (!kvUrl || !kvToken) {
    res.status(503).json({ error: 'Rejestracja nie jest jeszcze skonfigurowana. Zaloguj się przy użyciu hasła administratora.' });
    return;
  }

  const { email, password, privacy_accepted } = req.body || {};
  if (!email || !password) { res.status(400).json({ error: 'Podaj email i hasło.' }); return; }
  if (password.length < 6)  { res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków.' }); return; }
  if (!privacy_accepted)    { res.status(400).json({ error: 'Zaakceptuj politykę prywatności.' }); return; }

  const key = `user:${email.toLowerCase().trim()}`;

  /* Check duplicates */
  const existing = await kvGet(key);
  if (existing) { res.status(409).json({ error: 'Konto z tym adresem email już istnieje.' }); return; }

  /* Hash password */
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  const ts   = Date.now();

  /* Store user */
  try {
    await kvSet(key, { email, hash, salt, trial_start: ts, created_at: ts, provider: 'email', last_login: ts, login_count: 1, privacy_accepted: true, privacy_accepted_at: ts });
  } catch {
    res.status(500).json({ error: 'Błąd zapisu. Spróbuj ponownie.' }); return;
  }

  /* Issue JWT */
  const secret  = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';
  const payload = Buffer.from(JSON.stringify({ email, trial_start: ts, iat: ts })).toString('base64');
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  res.json({ ok: true, token: `${payload}.${sig}`, email, trial_start: ts });
};
