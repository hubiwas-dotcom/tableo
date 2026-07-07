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

/* Upstash SCAN — wszystkie klucze pasujące do wzorca */
async function kvScan(pattern) {
  const { url, token } = kvCreds();
  if (!url || !token) return [];
  const keys = [];
  let cursor = '0';
  do {
    const res  = await fetch(`${url}/scan/${cursor}?match=${encodeURIComponent(pattern)}&count=200`, { headers: { Authorization: `Bearer ${token}` } });
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user  = verifyToken(token);
  if (!user) { res.status(401).json({ error: 'Sesja wygasła.' }); return; }

  const accountKey = `account:${user.email}`;

  /* ── Admin panel (tylko właściciel): GET /api/account?admin=1 ── */
  if (req.method === 'GET' && req.query && req.query.admin === '1') {
    if ((user.email || '').toLowerCase().trim() !== 'hubiwas@gmail.com') {
      res.status(403).json({ error: 'Brak uprawnień.' }); return;
    }
    const TRIAL_MS = parseInt(process.env.TRIAL_DAYS || '7') * 24 * 60 * 60 * 1000;
    /* Zbierz adresy z OBU źródeł: user: (logowania) i account: (wygenerowane menu).
       Ktoś kto wygenerował menu ma account:, ale niekoniecznie user: (zapamiętane logowanie). */
    const [userKeys, acctKeys] = await Promise.all([kvScan('user:*'), kvScan('account:*')]);
    const emails = new Set();
    userKeys.forEach(k => emails.add(k.replace(/^user:/, '')));
    acctKeys.forEach(k => emails.add(k.replace(/^account:/, '')));
    const rows = await Promise.all([...emails].map(async (email) => {
      const [u, acc, paid] = await Promise.all([
        kvGet(`user:${email}`), kvGet(`account:${email}`), kvGet(`paid:${email}`),
      ]);
      const firstGen   = acc?.first_generated_at || null;
      const isPaidRow  = isAdmin(email) || !!(paid?.active && (!paid.expires_at || Date.now() < paid.expires_at));
      const trialExpired = !isPaidRow && firstGen ? (Date.now() - firstGen > TRIAL_MS) : false;
      const daysLeft   = firstGen ? Math.max(0, Math.ceil((firstGen + TRIAL_MS - Date.now()) / 86400000)) : null;
      return {
        email,
        provider:          u?.provider || 'email',
        is_admin:          isAdmin(email),
        last_login:        u?.last_login || null,
        login_count:       u?.login_count || 0,
        generation_count:  acc?.generation_count || 0,
        last_generated_at: acc?.last_generated_at || firstGen || null,
        error_count:       acc?.error_count || 0,
        last_error:        acc?.last_error || null,
        last_error_at:     acc?.last_error_at || null,
        paid:              isPaidRow,
        paid_plan:         isPaidRow ? (paid?.plan || (isAdmin(email) ? 'admin' : null)) : null,
        trial_days_left:   isPaidRow ? null : daysLeft,
        trial_expired:     trialExpired,
      };
    }));
    rows.sort((a, b) => (b.last_login || 0) - (a.last_login || 0) || (b.last_generated_at || 0) - (a.last_generated_at || 0));
    res.json({ ok: true, count: rows.length, user_keys: userKeys.length, account_keys: acctKeys.length, generated_at: Date.now(), users: rows });
    return;
  }

  /* ── GET: return account metadata + current menu + trial status ── */
  if (req.method === 'GET') {
    const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
    const account  = (await kvGet(accountKey)) || null;
    const paid     = await kvGet(`paid:${user.email}`);
    const isPaid   = isAdmin(user.email) || !!(paid?.active && (!paid.expires_at || Date.now() < paid.expires_at));

    const firstGen     = account?.first_generated_at || null;
    const trialExpired = firstGen ? (Date.now() - firstGen > TRIAL_MS) : false;
    const daysLeft     = firstGen
      ? Math.max(0, Math.ceil((firstGen + TRIAL_MS - Date.now()) / 86400000))
      : 7;

    const trial = {
      started:            !!firstGen,
      first_generated_at: firstGen,
      expires_at:         firstGen ? firstGen + TRIAL_MS : null,
      days_left:          daysLeft,
      expired:            trialExpired,
      paid:               isPaid,
      paid_plan:          isPaid ? (paid?.plan || null) : null,
    };

    if (!account?.slug) { res.json({ ok: true, account: null, menu: null, trial }); return; }

    const menuData = await kvGet(`menu:${account.slug}`);
    res.json({
      ok: true,
      account: {
        slug:               account.slug,
        published_url:      account.published_url,
        custom_domain:      account.custom_domain || null,
        published_at:       account.published_at,
        first_generated_at: firstGen,
      },
      menu:  menuData?.menu || null,
      trial,
    });
    return;
  }

  /* ── PATCH: reset lub zapis własnej domeny ── */
  if (req.method === 'PATCH') {
    const account = (await kvGet(accountKey)) || {};

    /* Reset „od nowa": usuwa opublikowane menu, link/slug, QR i domenę.
       ZACHOWUJE first_generated_at (trial) i status opłaty — reset nie zeruje okresu próbnego. */
    if (req.body && req.body.reset === true) {
      if (account.slug)          await kvSet(`menu:${account.slug}`, null);
      if (account.custom_domain) await kvSet(`domain:${account.custom_domain}`, null);
      account.slug = null;
      account.published_url = null;
      account.published_at = null;
      account.custom_domain = null;
      await kvSet(accountKey, account);
      res.json({ ok: true, reset: true });
      return;
    }

    const { custom_domain } = req.body || {};
    const oldDomain = account.custom_domain || null;
    const newDomain = (custom_domain || '').trim()
      .replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || null;

    account.custom_domain = newDomain;
    await kvSet(accountKey, account);

    /* Maintain domain → slug index so api/menu.js can route custom domains */
    if (oldDomain && oldDomain !== newDomain) {
      await kvSet(`domain:${oldDomain}`, null);
    }
    if (newDomain && account.slug) {
      await kvSet(`domain:${newDomain}`, { slug: account.slug, email: user.email });
    }

    res.json({ ok: true, custom_domain: newDomain });
    return;
  }

  res.status(405).end();
};
