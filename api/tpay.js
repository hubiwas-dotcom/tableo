const https  = require('https');
const crypto = require('crypto');

/* ── KV helpers ── */
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
async function kvSet(key, value, exSeconds) {
  const { url, token } = kvCreds();
  if (!url || !token) return false;
  try {
    const cmd = exSeconds ? ['SET', key, JSON.stringify(value), 'EX', String(exSeconds)] : ['SET', key, JSON.stringify(value)];
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd)
    });
    return res.ok;
  } catch { return false; }
}

/* ── Auth (nasz token sesji, ten sam co reszta API) ── */
function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (Date.now() - data.iat > 30 * 24 * 60 * 60 * 1000) return null;
    if (data.email) data.email = String(data.email).toLowerCase().trim();
    return data;
  } catch { return null; }
}

/* ── Tpay REST helper (JSON body, Bearer OAuth token) ── */
const TPAY_API_BASE = (process.env.TPAY_API_BASE || 'https://api.tpay.com').replace(/\/+$/, '');

function tpayRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(TPAY_API_BASE + path);
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      }
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch { reject(new Error('Tpay: invalid JSON response')); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* Token OAuth cache'owany w KV (ważny 2h) — jedna para kluczy na cały serwis,
   więc trzymanie go w KV zamiast pobierania za każdym razem oszczędza wywołania. */
async function getAccessToken() {
  const cached = await kvGet('tpay:token');
  if (cached && cached.expires_at > Date.now() + 30000) return cached.value;

  const clientId     = (process.env.TPAY_CLIENT_ID || '').trim();
  const clientSecret = (process.env.TPAY_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) throw new Error('TPAY_NOT_CONFIGURED');

  const body = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.tpay.com',
      path: '/oauth/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Tpay: invalid oauth response')); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  if (!result.access_token) throw new Error('Tpay: brak access_token w odpowiedzi OAuth');

  const expiresIn = Number(result.expires_in) || 7200;
  await kvSet('tpay:token', { value: result.access_token, expires_at: Date.now() + expiresIn * 1000 });
  return result.access_token;
}

async function collectBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/* ── Plany ──
   W przeciwieństwie do Stripe, Tpay nie ma katalogu "Produktów/Cen" do
   założenia w panelu — kwota i opis idą wprost w każdym żądaniu transakcji.
   `days` to długość okresu dostępu po opłaceniu. */
const DAY_MS = 24 * 60 * 60 * 1000;
const PLANS = {
  monthly: { amount: 29.99,  days: 30,  description: 'Qreat — plan miesięczny' },
  yearly:  { amount: 299.99, days: 365, description: 'Qreat — plan roczny' },
};

/* ══════════════════════════════════════════════════
   CHECKOUT  →  POST /api/tpay/checkout
   WEBHOOK   →  POST /api/tpay/webhook
   ══════════════════════════════════════════════════
   MVP bez auto-odnawiania: klient płaci za cały okres z góry, jednorazowo.
   Po wygaśnięciu (paid.expires_at) konto wraca do stanu "trial wygasł" w
   /api/account, a frontend pokazuje ten sam paywall z etykietą "Odnów
   abonament" zamiast pierwszego zakupu (patrz api/account.js: last_plan). */
const handler = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const path = (req.url || '').split('?')[0];

  /* ── Checkout ── */
  if (path.endsWith('/checkout')) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user  = verifyToken(token);
    if (!user) { res.status(401).json({ error: 'Sesja wygasła.' }); return; }

    if (!process.env.TPAY_CLIENT_ID || !process.env.TPAY_CLIENT_SECRET) {
      res.status(500).json({ error: 'Tpay nie jest skonfigurowany.' }); return;
    }

    let body = {};
    try { const raw = await collectBody(req); body = JSON.parse(raw.toString()); } catch {}
    const { plan } = body;
    const cfg = PLANS[plan];
    if (!cfg) { res.status(400).json({ error: 'Nieprawidłowy plan.' }); return; }

    const origin = `https://${req.headers.host || 'www.qreat.pl'}`;

    try {
      const accessToken = await getAccessToken();
      const result = await tpayRequest('POST', '/transactions', accessToken, {
        amount:      cfg.amount,
        description: cfg.description,
        payer: {
          email: user.email,
          name:  user.email,
        },
        callbacks: {
          notification: { url: `${origin}/api/tpay/webhook` },
          payerUrls: {
            success: `${origin}/editor?payment=success&plan=${plan}`,
            error:   `${origin}/editor?payment=cancelled`,
          },
        },
      });

      if (result.status >= 400 || !result.body?.transactionId) {
        res.status(400).json({ error: result.body?.errorCode ? `Błąd Tpay: ${result.body.errorCode}` : 'Błąd Tpay.' });
        return;
      }

      /* Zapamiętaj do jakiego konta/planu należy ta transakcja — webhook
         dostaje tylko id transakcji Tpay, więc to jest jedyne wiązanie. */
      await kvSet(`tpay_tx:${result.body.transactionId}`, { email: user.email, plan }, 7 * 24 * 60 * 60);

      res.json({ ok: true, url: result.body.transactionPaymentUrl });
    } catch (e) {
      res.status(500).json({ error: 'Błąd Tpay: ' + e.message });
    }
    return;
  }

  /* ── Webhook ── */
  if (path.endsWith('/webhook')) {
    let body = {};
    try { const raw = await collectBody(req); body = JSON.parse(raw.toString()); } catch {}

    const securityCode = (process.env.TPAY_SECURITY_CODE || '').trim();
    if (securityCode) {
      const expected = crypto.createHash('md5')
        .update(`${body.id || ''}${body.tr_id || ''}${body.tr_amount || ''}${body.tr_crc || ''}${securityCode}`)
        .digest('hex');
      if (expected !== body.md5sum) { res.status(400).send('Invalid signature'); return; }
    }

    if (body.tr_status === 'TRUE' || body.tr_status === 'true') {
      const txMeta = await kvGet(`tpay_tx:${body.tr_id}`);
      if (txMeta?.email) {
        const cfg = PLANS[txMeta.plan];
        await kvSet(`paid:${txMeta.email}`, {
          active: true, plan: txMeta.plan,
          activated_at:   Date.now(),
          expires_at:     Date.now() + (cfg ? cfg.days : 30) * DAY_MS,
          tpay_transaction: body.tr_id,
        });
      }
    }

    res.status(200).send('TRUE');
    return;
  }

  res.status(404).json({ error: 'Nieznana akcja Tpay.' });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
