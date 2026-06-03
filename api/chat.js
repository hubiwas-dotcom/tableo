const https  = require('https');
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

const SYSTEM_PROMPT = `Jesteś asystentem AI pomagającym właścicielom restauracji edytować cyfrowe menu w platformie Tableo.

Otrzymujesz aktualne menu w JSON i prośbę użytkownika. Modyfikujesz menu i zwracasz zaktualizowaną wersję.

<operations>
- Tłumaczenie: "dodaj język angielski/francuski/niemiecki/włoski/hiszpański/etc"
  → przetłumacz names kategorii, names dań i descriptions na ten język
  → NIE tłumacz nazwy restauracji (to własna nazwa marki)
  → ceny zostaw bez zmian
  → wszystkie pola tekstowe muszą być przetłumaczone

- Dodawanie dania: "dodaj [nazwa] za [cena] do [kategoria]"
  → dodaj do odpowiedniej kategorii, wymyśl opis jeśli nie podano

- Dodawanie kategorii: "dodaj kategorię [nazwa]"

- Usuwanie: "usuń danie [nazwa]" lub "usuń kategorię [nazwa]"

- Edycja: "zmień nazwę na X", "zmień cenę X na Y", "zmień opis X na Y"

- Zmiana stylu opisów: "napisz opisy bardziej elegancko/prosto/z humorem"
</operations>

<output_rules>
Zwróć WYŁĄCZNIE JSON w tagach <output>:
<output>
{
  "reply": "Jedno zdanie po polsku co zrobiłeś",
  "menu": { ...pełne zaktualizowane menu w dokładnie tej samej strukturze... }
}
</output>
Nie pisz nic poza tagami. Menu musi mieć identyczną strukturę jak oryginał (restaurant_name, tagline, palette, font_style, categories).
</output_rules>`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Sesja wygasła.' });
    return;
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
  (menuForAI.categories || []).forEach(cat =>
    (cat.items || []).forEach(item => delete item.image)
  );

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-6',
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
          res.status(200).json({ ok: true, menu: result.menu, reply: result.reply });
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
