const https  = require('https');
const crypto = require('crypto');

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

function isAdmin(email) {
  const admins = (process.env.ADMIN_EMAILS || 'hubiwas@gmail.com').split(',').map(e => e.trim().toLowerCase());
  return admins.includes((email || '').toLowerCase());
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

const SYSTEM_PROMPT = `Jesteś EDYTOREM istniejącego cyfrowego menu restauracji w platformie Qreat.
Otrzymujesz AKTUALNY stan menu w formacie JSON oraz prośbę użytkownika.
Zwracasz WYŁĄCZNIE listę operacji do wykonania — zmieniasz tylko to, o co prosi użytkownik, i nie ruszasz niczego innego.

<zasady>
- Jesteś edytorem, NIE kreatorem. NIGDY nie proponuj tworzenia menu od nowa, wgrywania zdjęć ani żadnego onboardingu.
- Nie proś o dane, które już są w menu — widzisz je w JSON.
- Wykonaj konkretną prośbę jako MINIMALNY zestaw operacji. Zero zbędnych pytań, zero zmian „przy okazji".
- Jeśli prośba jest naprawdę niejednoznaczna (np. „zmień kolor" bez podania jakiego), zadaj JEDNO krótkie pytanie doprecyzowujące — zwróć wtedy "operations": [] i pytanie w "reply". Nie zaczynaj procesu od nowa.
- Kolory zwracaj WYŁĄCZNIE jako HEX (nigdy nazwą!) i dobierz sensowny odcień (granatowy → "#1a2b4c", czerwony → "#7a1020", butelkowa zieleń → "#0f3d2e", kremowy → "#f5efe6", złoty → "#D4A017").
- „kolor cen" / „kolor ceny" to ZAWSZE field "price_color". Przykład: „zmień kolor cen na złoty" → {"type":"update_style","field":"price_color","value":"#D4A017"}. Prośba o kolor konkretnego elementu NIE jest niejednoznaczna — wykonaj ją od razu, bez dopytywania.
- Pole font: dokładnie jedna z wartości: classic (eleganckie, serif), modern (nowoczesne, sans), rustic (bistro/tratoria), bold (street food/burgery). „Bardziej elegancka czcionka" → "classic".
- Pozycje i kategorie identyfikuj po NAZWIE (widocznej w JSON), niewrażliwie na wielkość liter.
</zasady>

<typy_operacji>
- update_style: { "field": "background_color" | "text_color" | "accent_color" | "price_color" | "font", "value": "<hex albo nazwa fontu>" }
- update_item: { "item": "<nazwa dania>", "field": "name" | "price" | "description", "value": "<nowa wartość>" }
- add_item: { "category": "<nazwa kategorii>", "name": "...", "price": "XX zł", "description": "" }
- remove_item: { "item": "<nazwa dania>" }
- rename_category: { "from": "<obecna nazwa>", "to": "<nowa nazwa>" }
- add_category: { "name": "<nazwa>" }
- remove_category: { "name": "<nazwa>" }
- reorder_items: { "category": "<nazwa>", "order": ["danie1","danie2", ...] }
- add_language: { "code": "en" | "de" | "fr" | "it" | "es" | "ru" }
</typy_operacji>

<format_odpowiedzi>
Zwróć WYŁĄCZNIE JSON w tagach <output>. Nic poza tagami.
<output>
{"reply":"Jedno krótkie zdanie po polsku co zrobiłeś (albo pytanie doprecyzowujące)","operations":[ ... ]}
</output>
Jeśli zadajesz pytanie doprecyzowujące, "operations" ma być pustą tablicą [].
</format_odpowiedzi>`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user  = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sesja wygasła.' });
    return;
  }

  /* ── Trial check ── */
  const account = (await kvGet(`account:${user.email}`)) || {};
  if (!isAdmin(user.email) && account.first_generated_at && Date.now() - account.first_generated_at > TRIAL_MS) {
    const paid   = await kvGet(`paid:${user.email}`);
    const isPaid = paid?.active && (!paid.expires_at || Date.now() < paid.expires_at);
    if (!isPaid) {
      res.status(402).json({ error: 'trial_expired', message: 'Twój okres próbny dobiegł końca.' });
      return;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Brak ANTHROPIC_API_KEY.' });
    return;
  }

  const { menu, message } = req.body || {};
  if (!menu || !message) {
    res.status(400).json({ error: 'Brak menu lub wiadomości.' });
    return;
  }

  // Strip logo/image data before sending to Claude (saves tokens)
  const menuForAI = JSON.parse(JSON.stringify(menu));
  delete menuForAI.logo;
  (menuForAI.categories || []).forEach(cat => {
    delete cat.image;
    (cat.items || []).forEach(item => delete item.image);
  });

  const requestBody = JSON.stringify({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Aktualne menu:\n${JSON.stringify(menuForAI, null, 2)}\n\nProśba: ${message}`
    }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(requestBody)
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            res.status(500).json({ error: parsed.error.message || 'Błąd API' });
            resolve(); return;
          }
          const text = (parsed.content || []).find(b => b.type === 'text')?.text || '';
          const tagMatch = text.match(/<output>([\s\S]*?)<\/output>/);
          if (!tagMatch) {
            res.status(500).json({ error: 'AI nie zwróciło poprawnej odpowiedzi.', raw: text.slice(0, 200) });
            resolve(); return;
          }
          const result = JSON.parse(tagMatch[1].trim());
          res.status(200).json({ ok: true, operations: Array.isArray(result.operations) ? result.operations : [], reply: result.reply || 'Gotowe.' });
        } catch(e) {
          res.status(500).json({ error: 'Błąd parsowania odpowiedzi.', detail: e.message });
        }
        resolve();
      });
    });

    proxyReq.on('error', (e) => { res.status(502).json({ error: e.message }); resolve(); });
    proxyReq.write(requestBody);
    proxyReq.end();
  });
};
