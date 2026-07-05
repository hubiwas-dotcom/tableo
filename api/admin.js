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

/* Upstash SCAN — zwraca wszystkie klucze pasujące do wzorca */
async function kvScan(pattern) {
  const { url, token } = kvCreds();
  if (!url || !token) return [];
  const keys = [];
  let cursor = '0';
  do {
    const res = await fetch(`${url}/scan/${cursor}/match/${encodeURIComponent(pattern)}/count/200`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.result) break;
    cursor = data.result[0];
    (data.result[1] || []).forEach(k => keys.push(k));
  } while (cursor !== '0');
  return keys;
}

function isAdmin(email) {
  const admins = (process.env.ADMIN_EMAILS || 'hubiwas@gmail.com').split(',').map(e => e.trim().toLowerCase());
  return admins.includes((email || '').toLowerCase());
}

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')     { res.status(405).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user  = verifyToken(token);
  if (!user)            { res.status(401).json({ error: 'Sesja wygasła.' }); return; }
  if (!isAdmin(user.email)) { res.status(403).json({ error: 'Brak uprawnień.' }); return; }

  const TRIAL_MS = parseInt(process.env.TRIAL_DAYS || '7') * 24 * 60 * 60 * 1000;

  const userKeys = await kvScan('user:*');

  const rows = await Promise.all(userKeys.map(async (key) => {
    const email = key.replace(/^user:/, '');
    const [u, account, paid] = await Promise.all([
      kvGet(key),
      kvGet(`account:${email}`),
      kvGet(`paid:${email}`),
    ]);

    const firstGen = account?.first_generated_at || null;
    const isPaidRow = isAdmin(email) || !!(paid?.active && (!paid.expires_at || Date.now() < paid.expires_at));
    const trialExpired = !isPaidRow && firstGen ? (Date.now() - firstGen > TRIAL_MS) : false;
    const daysLeft = firstGen ? Math.max(0, Math.ceil((firstGen + TRIAL_MS - Date.now()) / 86400000)) : null;

    return {
      email,
      provider:        u?.provider || 'email',
      is_admin:        isAdmin(email),
      created_at:      u?.created_at || null,
      last_login:      u?.last_login || null,
      login_count:     u?.login_count || 0,
      generation_count: account?.generation_count || 0,
      last_generated_at: account?.last_generated_at || firstGen || null,
      first_generated_at: firstGen,
      published_url:   account?.published_url || null,
      error_count:     account?.error_count || 0,
      last_error:      account?.last_error || null,
      last_error_at:   account?.last_error_at || null,
      paid:            isPaidRow,
      paid_plan:       isPaidRow ? (paid?.plan || (isAdmin(email) ? 'admin' : null)) : null,
      trial_days_left: isPaidRow ? null : daysLeft,
      trial_expired:   trialExpired,
    };
  }));

  /* Najnowsze logowania na górze */
  rows.sort((a, b) => (b.last_login || 0) - (a.last_login || 0));

  res.json({
    ok: true,
    count: rows.length,
    generated_at: Date.now(),
    users: rows,
  });
};
