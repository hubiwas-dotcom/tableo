const https  = require('https');
const crypto = require('crypto');

function _kvCreds() {
  return {
    url:   process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}
async function kvGet(key) {
  const { url, token } = _kvCreds();
  if (!url || !token) return null;
  try {
    const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch { return null; }
}
async function kvSet(key, value) {
  const { url, token } = _kvCreds();
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

function verifyGoogleToken(credential) {
  return new Promise((resolve) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          if (info.error || !info.email) resolve(null);
          else resolve(info);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const { credential, trial_start } = req.body || {};
  if (!credential) {
    res.status(400).json({ error: 'Brak tokenu Google.' }); return;
  }

  const userInfo = await verifyGoogleToken(credential);
  if (!userInfo) {
    res.status(401).json({ error: 'Nieprawidłowy token Google.' }); return;
  }

  const secret = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';
  const ts     = trial_start || Date.now();
  const normEmail = String(userInfo.email || '').toLowerCase().trim();

  /* Zapisz/aktualizuj rekord usera (logowania) do panelu admina */
  const userKey  = `user:${normEmail}`;
  const existing = (await kvGet(userKey)) || {};
  await kvSet(userKey, {
    ...existing,
    email:       normEmail,
    name:        userInfo.name || existing.name || '',
    provider:    'google',
    created_at:  existing.created_at || Date.now(),
    trial_start: existing.trial_start || ts,
    last_login:  Date.now(),
    login_count: (existing.login_count || 0) + 1,
  });

  const payload = Buffer.from(JSON.stringify({
    email:       normEmail,
    name:        userInfo.name  || '',
    picture:     userInfo.picture || '',
    google_sub:  userInfo.sub,
    trial_start: ts,
    iat:         Date.now()
  })).toString('base64');

  const sig   = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = `${payload}.${sig}`;

  res.json({
    ok:          true,
    token,
    email:       normEmail,
    name:        userInfo.name    || '',
    picture:     userInfo.picture || '',
    trial_start: ts
  });
};
