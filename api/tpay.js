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

/* ── Stojaki na kody QR (produkt fizyczny, druk 3D) ──
   Jedna cena za sztukę niezależnie od rodzaju podstawki, rozmiaru i koloru —
   te wybory są wyłącznie konfiguracją druku, nie wpływają na kwotę.
   Ceny liczone WYŁĄCZNIE po stronie serwera; klient przysyła tylko wybory. */
const STAND_PRICE = 15;
const SHIPPING    = 15;
const STANDS = {
  classic: { label: 'Klasyczny' },
  premium: { label: 'Premium' },
  logo:    { label: 'Z logo restauracji' },
};
const COLORS = ['czarny', 'biały', 'szary', 'drewno', 'złoty', 'granatowy', 'bordowy'];

function priceOrder(qty) {
  const items = STAND_PRICE * qty;
  return { unit: STAND_PRICE, items, shipping: SHIPPING, total: Number((items + SHIPPING).toFixed(2)) };
}
/* Wymiary płytki w mm — niezależne szerokość i wysokość */
const MM_MIN = 40, MM_MAX = 300;

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

  /* ── Zamówienie stojaków QR ──
     Zamówienie zapisujemy ZAWSZE, nawet gdy Tpay nie jest jeszcze
     skonfigurowany (konto w weryfikacji) — wtedy czeka ze statusem
     'awaiting_payment' i właściciel wysyła link do płatności ręcznie. */
  if (path.endsWith('/order')) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user  = verifyToken(token);
    if (!user) { res.status(401).json({ error: 'Sesja wygasła.' }); return; }

    let body = {};
    try { const raw = await collectBody(req); body = JSON.parse(raw.toString()); } catch {}

    const stand     = String(body.stand || '');
    const widthMm   = Math.round(Number(body.width_mm)  || 0);
    const heightMm  = Math.round(Number(body.height_mm) || 0);
    const plateColor = String(body.plate_color || '');
    const codeColor  = String(body.code_color  || '');
    const qty   = Math.floor(Number(body.qty) || 0);
    const text  = String(body.text || '').trim().slice(0, 40);

    if (!STANDS[stand])                  { res.status(400).json({ error: 'Wybierz rodzaj podstawki.' }); return; }
    if (widthMm  < MM_MIN || widthMm  > MM_MAX) { res.status(400).json({ error: `Szerokość: ${MM_MIN}–${MM_MAX} mm.` }); return; }
    if (heightMm < MM_MIN || heightMm > MM_MAX) { res.status(400).json({ error: `Wysokość: ${MM_MIN}–${MM_MAX} mm.` }); return; }
    if (!COLORS.includes(plateColor))    { res.status(400).json({ error: 'Wybierz kolor płytki.' }); return; }
    if (!COLORS.includes(codeColor))     { res.status(400).json({ error: 'Wybierz kolor kodu.' }); return; }
    if (plateColor === codeColor)        { res.status(400).json({ error: 'Kolor kodu musi różnić się od koloru płytki.' }); return; }
    if (qty < 1 || qty > 500)            { res.status(400).json({ error: 'Liczba sztuk: od 1 do 500.' }); return; }

    /* Układ na płytce (kosmetyka druku) — sanityzacja z bezpiecznymi domyślnymi */
    const clampInt = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
    const qrScale   = clampInt(body.qr_scale, 40, 95, 72);
    const textScale = clampInt(body.text_scale, 50, 180, 100);
    const blockPos  = ['top','center','bottom'].includes(body.block_pos) ? body.block_pos : 'center';
    const textPos   = ['above','below','none'].includes(body.text_pos)   ? body.text_pos  : 'below';
    const textColor = COLORS.includes(String(body.text_color)) ? String(body.text_color) : (plateColor === 'biały' ? 'czarny' : 'biały');

    const ship = body.shipping || {};
    const name    = String(ship.name    || '').trim();
    const street  = String(ship.street  || '').trim();
    const zip     = String(ship.zip     || '').trim();
    const city    = String(ship.city    || '').trim();
    const phone   = String(ship.phone   || '').trim();
    if (!name || !street || !zip || !city || !phone) {
      res.status(400).json({ error: 'Uzupełnij dane do wysyłki.' }); return;
    }

    const price = priceOrder(qty);

    /* Slug konta — żeby wiadomo było jaki kod QR nadrukować na stojaki */
    const account = await kvGet(`account:${user.email}`);

    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const order = {
      id: orderId,
      email:      user.email,
      created_at: Date.now(),
      status:     'awaiting_payment',
      config:     { stand, stand_label: STANDS[stand].label, width_mm: widthMm, height_mm: heightMm, plate_color: plateColor, code_color: codeColor, qr_scale: qrScale, block_pos: blockPos, text_pos: textPos, text_scale: textScale, text_color: textColor, qty, text },
      price,
      shipping:   { name, street, zip, city, phone },
      menu_slug:  account?.slug || null,
      menu_url:   account?.published_url || null,
    };
    await kvSet(`order:${orderId}`, order);

    if (!process.env.TPAY_CLIENT_ID || !process.env.TPAY_CLIENT_SECRET) {
      res.json({ ok: true, order_id: orderId, total: price.total, payment_pending: true });
      return;
    }

    try {
      const accessToken = await getAccessToken();
      const origin = `https://${req.headers.host || 'www.qreat.pl'}`;
      const result = await tpayRequest('POST', '/transactions', accessToken, {
        amount:      price.total,
        description: `Qreat — stojaki QR ${STANDS[stand].label} ${widthMm}x${heightMm}mm ${qty} szt. (${orderId})`,
        payer: { email: user.email, name: name || user.email },
        callbacks: {
          notification: { url: `${origin}/api/tpay/webhook` },
          payerUrls: {
            success: `${origin}/editor?order=success`,
            error:   `${origin}/editor?order=cancelled`,
          },
        },
      });

      if (result.status >= 400 || !result.body?.transactionId) {
        /* Zamówienie jest już zapisane — właściciel dośle link do płatności */
        res.json({ ok: true, order_id: orderId, total: price.total, payment_pending: true });
        return;
      }

      await kvSet(`tpay_tx:${result.body.transactionId}`, { email: user.email, kind: 'order', orderId }, 7 * 24 * 60 * 60);
      res.json({ ok: true, order_id: orderId, total: price.total, url: result.body.transactionPaymentUrl });
    } catch {
      res.json({ ok: true, order_id: orderId, total: price.total, payment_pending: true });
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

      if (txMeta?.kind === 'order' && txMeta.orderId) {
        /* Opłacone zamówienie stojaków — do realizacji przez właściciela */
        const order = await kvGet(`order:${txMeta.orderId}`);
        if (order) {
          order.status = 'paid';
          order.paid_at = Date.now();
          order.tpay_transaction = body.tr_id;
          await kvSet(`order:${txMeta.orderId}`, order);
        }
      } else if (txMeta?.email) {
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
