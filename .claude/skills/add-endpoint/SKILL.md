---
name: add-endpoint
description: Add a new API endpoint to Tableo following the existing patterns
---

# Dodaj nowy endpoint API do Tableo

## Wzorzec istniejących endpointów

Każdy plik `api/*.js` musi:
1. Ustawić nagłówki CORS
2. Obsłużyć OPTIONS preflight
3. Zweryfikować token jeśli endpoint wymaga auth
4. Zwrócić JSON

## Szablon z auth

```javascript
const crypto = require('crypto');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user  = verifyToken(token);
  if (!user) { res.status(401).json({ error: 'Sesja wygasła.' }); return; }

  // ... logika endpointu ...
  res.json({ ok: true });
};
```

## Kroki po napisaniu endpointu

1. Zapisz plik jako `api/nazwa.js`
2. Dodaj wpis do `vercel.json`:
```json
{ "src": "/api/nazwa", "dest": "/api/nazwa.js" }
```
3. Wywołaj z frontendu:
```javascript
const res = await fetch('/api/nazwa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
  body: JSON.stringify({ dane })
});
```

## KV Store helper (jeśli potrzebujesz zapisywać dane)

```javascript
async function kvSet(key, value) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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
  const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}
```
