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

/* ── Paynow REST helper ──
   W przeciwieństwie do Tpay: brak OAuth — każde żądanie autoryzuje się parą
   Api-Key (jawny nagłówek) + Signature (HMAC-SHA256 z Signature-Key).
   Payload do podpisu wg dokumentacji Paynow (docs.paynow.pl/docs/v3/integration):
     JSON.stringify({ headers: { 'Api-Key', 'Idempotency-Key' }, parameters: {}, body: <ciało jako string> })
   podpisany kluczem Signature-Key, wynik zakodowany w Base64.
   Dla powiadomień (webhook) podpis liczy się inaczej: HMAC-SHA256 samego
   surowego ciała żądania (bez owijania w powyższą strukturę) — patrz verifyNotificationSignature. */
const PAYNOW_API_BASE = (process.env.PAYNOW_API_BASE || 'https://api.paynow.pl').replace(/\/+$/, '');

function paynowSignature(apiKey, idempotencyKey, bodyString, signatureKey) {
  const payload = JSON.stringify({
    headers: { 'Api-Key': apiKey, 'Idempotency-Key': idempotencyKey },
    parameters: {},
    body: bodyString
  });
  return crypto.createHmac('sha256', signatureKey).update(payload).digest('base64');
}

function verifyNotificationSignature(rawBody, signatureHeader, signatureKey) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', signatureKey).update(rawBody).digest('base64');
  /* porównanie stałoczasowe — chroni przed timing attack na podpis */
  const a = Buffer.from(expected), b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function paynowRequest(path, bodyObj) {
  return new Promise((resolve, reject) => {
    const apiKey       = (process.env.PAYNOW_API_KEY || '').trim();
    const signatureKey = (process.env.PAYNOW_SIGNATURE_KEY || '').trim();
    if (!apiKey || !signatureKey) { reject(new Error('PAYNOW_NOT_CONFIGURED')); return; }

    const bodyString     = JSON.stringify(bodyObj);
    const idempotencyKey = crypto.randomBytes(18).toString('hex'); // 36 znaków, limit to 45
    const signature      = paynowSignature(apiKey, idempotencyKey, bodyString, signatureKey);

    const url = new URL(PAYNOW_API_BASE + path);
    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers: {
        'Content-Type':     'application/json',
        'Accept':           'application/json',
        'Api-Key':          apiKey,
        'Signature':        signature,
        'Idempotency-Key':  idempotencyKey,
        'Content-Length':   Buffer.byteLength(bodyString),
      }
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch { reject(new Error('Paynow: invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.write(bodyString);
    req.end();
  });
}

/* Grosze, nie złotówki — Paynow przyjmuje amount jako liczbę całkowitą
   (100 = 1,00 zł). Cały reszta kodu (PLANS, ceny stojaków) trzyma złotówki
   jak dotąd — konwersja następuje TYLKO tuż przed wysyłką do Paynow. */
function toGrosze(zl) { return Math.round(zl * 100); }

async function collectBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/* ── Plany ──
   Kwota i opis idą wprost w każdym żądaniu — nie ma katalogu produktów do
   założenia w panelu. `days` to długość okresu dostępu po opłaceniu. */
const DAY_MS = 24 * 60 * 60 * 1000;
const PLANS = {
  monthly: { amount: 34.99,  days: 30,  description: 'Qreat — plan miesięczny' },
  yearly:  { amount: 349.99, days: 365, description: 'Qreat — plan roczny' },
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
   CHECKOUT  →  POST /api/paynow/checkout
   ORDER     →  POST /api/paynow/order
   WEBHOOK   →  POST /api/paynow/webhook
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

    if (!process.env.PAYNOW_API_KEY || !process.env.PAYNOW_SIGNATURE_KEY) {
      res.status(500).json({ error: 'Paynow nie jest skonfigurowany.' }); return;
    }

    let body = {};
    try { const raw = await collectBody(req); body = JSON.parse(raw.toString()); } catch {}
    const { plan } = body;
    const cfg = PLANS[plan];
    if (!cfg) { res.status(400).json({ error: 'Nieprawidłowy plan.' }); return; }

    const origin     = `https://${req.headers.host || 'www.qreat.pl'}`;
    const externalId = 'SUB-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    try {
      const result = await paynowRequest('/v3/payments', {
        amount:      toGrosze(cfg.amount),
        currency:    'PLN',
        externalId,
        description: cfg.description,
        buyer:       { email: user.email },
        /* Paynow ma JEDEN url powrotu (nie osobno success/error jak Tpay) —
           realną decyzję o aktywacji planu podejmuje WYŁĄCZNIE webhook;
           ten redirect tylko wraca klienta do edytora, który czeka na
           potwierdzenie (patrz istniejąca logika window._awaitingPayment). */
        continueUrl: `${origin}/editor?payment=success&plan=${plan}`,
      });

      if (result.status >= 400 || !result.body?.paymentId) {
        const msg = result.body?.errors?.[0]?.message;
        res.status(400).json({ error: msg ? `Błąd Paynow: ${msg}` : 'Błąd Paynow.' });
        return;
      }

      /* Zapamiętaj do jakiego konta/planu należy ta płatność — webhook
         dostaje tylko externalId, więc to jest jedyne wiązanie. */
      await kvSet(`paynow_tx:${externalId}`, { email: user.email, plan }, 7 * 24 * 60 * 60);

      res.json({ ok: true, url: result.body.redirectUrl });
    } catch (e) {
      res.status(500).json({ error: 'Błąd Paynow: ' + e.message });
    }
    return;
  }

  /* ── Zamówienie stojaków QR ──
     Zamówienie zapisujemy ZAWSZE, nawet gdy Paynow nie jest jeszcze
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

    if (!process.env.PAYNOW_API_KEY || !process.env.PAYNOW_SIGNATURE_KEY) {
      res.json({ ok: true, order_id: orderId, total: price.total, payment_pending: true });
      return;
    }

    try {
      const origin = `https://${req.headers.host || 'www.qreat.pl'}`;
      /* externalId = orderId wprost — webhook odróżnia zamówienia stojaków
         od subskrypcji po prefiksie "ORD-" i czyta rekord order:{orderId}
         bezpośrednio, bez dodatkowej mapy pośredniej (patrz webhook niżej). */
      const result = await paynowRequest('/v3/payments', {
        amount:      toGrosze(price.total),
        currency:    'PLN',
        externalId:  orderId,
        description: `Qreat — stojaki QR ${STANDS[stand].label} ${widthMm}x${heightMm}mm ${qty} szt. (${orderId})`,
        buyer:       { email: user.email, firstName: name || undefined },
        continueUrl: `${origin}/editor?order=success`,
      });

      if (result.status >= 400 || !result.body?.paymentId) {
        /* Zamówienie jest już zapisane — właściciel dośle link do płatności */
        res.json({ ok: true, order_id: orderId, total: price.total, payment_pending: true });
        return;
      }

      res.json({ ok: true, order_id: orderId, total: price.total, url: result.body.redirectUrl });
    } catch {
      res.json({ ok: true, order_id: orderId, total: price.total, payment_pending: true });
    }
    return;
  }

  /* ── Webhook ──
     Paynow wymaga odpowiedzi 200/202 z PUSTYM ciałem — inaczej ponawia
     powiadomienie. Podpis liczony jest z SUROWEGO ciała żądania, więc
     weryfikacja musi nastąpić PRZED próbą JSON.parse. */
  if (path.endsWith('/webhook')) {
    const raw = await collectBody(req);

    const signatureKey = (process.env.PAYNOW_SIGNATURE_KEY || '').trim();
    if (signatureKey) {
      const sig = req.headers['signature'];
      if (!verifyNotificationSignature(raw, sig, signatureKey)) {
        res.status(400).end();
        return;
      }
    }

    let body = {};
    try { body = JSON.parse(raw.toString()); } catch { res.status(400).end(); return; }

    if (body.status === 'CONFIRMED') {
      const externalId = String(body.externalId || '');

      if (externalId.startsWith('ORD-')) {
        const order = await kvGet(`order:${externalId}`);
        if (order && order.status !== 'paid') {
          order.status = 'paid';
          order.paid_at = Date.now();
          order.paynow_payment_id = body.paymentId;
          await kvSet(`order:${externalId}`, order);
        }
      } else {
        const txMeta = await kvGet(`paynow_tx:${externalId}`);
        if (txMeta?.email) {
          const cfg = PLANS[txMeta.plan];
          await kvSet(`paid:${txMeta.email}`, {
            active: true, plan: txMeta.plan,
            activated_at:      Date.now(),
            expires_at:        Date.now() + (cfg ? cfg.days : 30) * DAY_MS,
            paynow_payment_id: body.paymentId,
          });
        }
      }
    }

    res.status(200).end();
    return;
  }

  res.status(404).json({ error: 'Nieznana akcja Paynow.' });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
