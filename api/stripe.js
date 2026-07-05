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
async function kvSet(key, value) {
  const { url, token } = kvCreds();
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

/* ── Auth ── */
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

/* ── Stripe REST helper ── */
function stripePost(path, params) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const req = https.request({
      hostname: 'api.stripe.com',
      path,
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${(process.env.STRIPE_SECRET_KEY || '').trim()}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Stripe: invalid JSON')); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ── Webhook signature ── */
function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return true;
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const signed   = `${parts['t']}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
    return expected === parts['v1'];
  } catch { return false; }
}

async function collectBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/* ══════════════════════════════════════════════════
   CHECKOUT  →  POST /api/stripe/checkout
   WEBHOOK   →  POST /api/stripe/webhook
   ══════════════════════════════════════════════════ */
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

    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(500).json({ error: 'Stripe nie jest skonfigurowany.' }); return;
    }

    let body = {};
    try { const raw = await collectBody(req); body = JSON.parse(raw.toString()); } catch {}
    const { plan } = body;
    if (!['monthly', 'lifetime'].includes(plan)) {
      res.status(400).json({ error: 'Nieprawidłowy plan.' }); return;
    }

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_LIFETIME;

    if (!priceId) {
      res.status(500).json({ error: `Brak STRIPE_PRICE_${plan.toUpperCase()} w env.` }); return;
    }

    const origin = `https://${req.headers.host || 'tableo-murex.vercel.app'}`;
    const mode   = plan === 'lifetime' ? 'payment' : 'subscription';

    const params = {
      mode,
      'customer_email':          user.email,
      'line_items[0][price]':    priceId,
      'line_items[0][quantity]': '1',
      'success_url':             `${origin}/editor?payment=success&plan=${plan}`,
      'cancel_url':              `${origin}/editor`,
      'metadata[email]':         user.email,
      'metadata[plan]':          plan,
      'allow_promotion_codes':   'true',
      'locale':                  'pl',
    };
    if (mode === 'subscription') params['subscription_data[metadata][email]'] = user.email;

    try {
      const session = await stripePost('/v1/checkout/sessions', params);
      if (session.error) { res.status(400).json({ error: session.error.message }); return; }
      res.json({ ok: true, url: session.url });
    } catch (e) {
      res.status(500).json({ error: 'Błąd Stripe: ' + e.message });
    }
    return;
  }

  /* ── Webhook ── */
  if (path.endsWith('/webhook')) {
    const rawBody = await collectBody(req);
    const sig     = req.headers['stripe-signature'] || '';

    if (!verifyStripeSignature(rawBody.toString(), sig, process.env.STRIPE_WEBHOOK_SECRET)) {
      res.status(400).send('Invalid signature'); return;
    }

    let event;
    try { event = JSON.parse(rawBody.toString()); }
    catch { res.status(400).send('Invalid JSON'); return; }

    const MONTH_MS = 35 * 24 * 60 * 60 * 1000;

    switch (event.type) {
      case 'checkout.session.completed': {
        const s     = event.data.object;
        const email = s.metadata?.email || s.customer_email;
        const plan  = s.metadata?.plan;
        if (!email) break;
        await kvSet(`paid:${email}`, {
          active: true, plan,
          activated_at:      Date.now(),
          stripe_customer:   s.customer,
          expires_at:        plan === 'lifetime' ? null : Date.now() + MONTH_MS,
          ...(plan !== 'lifetime' && { stripe_subscription: s.subscription }),
        });
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv   = event.data.object;
        const email = inv.customer_email;
        if (!email) break;
        const ex = (await kvGet(`paid:${email}`)) || {};
        if (ex.plan === 'monthly') { ex.active = true; ex.expires_at = Date.now() + MONTH_MS; await kvSet(`paid:${email}`, ex); }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub   = event.data.object;
        const email = sub.metadata?.email;
        if (!email) break;
        const ex = (await kvGet(`paid:${email}`)) || {};
        ex.active = false;
        await kvSet(`paid:${email}`, ex);
        break;
      }
    }

    res.json({ received: true });
    return;
  }

  res.status(404).json({ error: 'Nieznana akcja Stripe.' });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
