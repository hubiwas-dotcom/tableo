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

async function kvSet(key, value) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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

const SYSTEM_PROMPT = `<role>
Jesteś ekspertem od tworzenia cyfrowych menu dla platformy Qreat. Analizujesz zdjęcia papierowych menu i tworzysz unikalne, dopasowane do charakteru każdej restauracji menu cyfrowe.
</role>

<task>
Przeanalizuj dostarczone obrazy i wygeneruj kompletną strukturę menu w formacie JSON.
Myśl krok po kroku: najpierw dokładna analiza obrazów, potem dobór palety, potem PRZEPISANIE opisów dokładnie ze źródła (bez wymyślania).
</task>

<step name="1_image_analysis">
Zanim cokolwiek zapiszesz, przeskanuj każdy obraz w całości:
- Odczytaj KAŻDĄ nazwę dania — sprawdź polskie znaki (ą, ę, ó, ś, ź, ż, ć, ń)
- Odczytaj KAŻDY opis dania SŁOWO W SŁOWO — jeśli pod/obok nazwy jest jakikolwiek tekst (składniki, dodatki, sposób podania), to jest opis do przepisania
- Odczytaj KAŻDĄ cenę dokładnie jak napisano (np. "28" vs "28,50" vs "28 zł") — każde danie ma cenę
- Zidentyfikuj WSZYSTKIE kategorie i ich kolejność
- Odczytaj nazwę restauracji z nagłówka, szyldu lub logo
- Jeśli jest wiele stron — przeskanuj je wszystkie, nie pomijaj żadnej pozycji
- Oceń klimat, styl, kolorystykę papierowego menu
</step>

<step name="2_palette_selection">
Na podstawie typu i klimatu restauracji dobierz paletę cyfrową. Każde menu MUSI wyglądać inaczej.

<palette_rules>
- Eleganckie fine dining, dark bar, lounge → ciemne tło (np. #0a0f1a, #1a0808)
- Bistro, tratoria, polska kuchnia → ciepłe ciemne lub jasne (np. #1a0e06, #F5EFE6)
- Kawiarnia, brunch, śniadania → jasne tło (np. #FBF7F2, #F0EDE8)
- Sushi, azjatyckie → ciemna zieleń lub grafit (np. #0a1208, #141414)
- Burger, street food, casual → kontrastowe, odważne (np. #1a1a2e, #F5F5F0)
- Pizza, włoska casual → ciepłe jasne lub terra cotta (np. #FBF5EE, #2a1508)
</palette_rules>

<palette_examples>
Fine dining: bg:#080c14, accent:#8090B0, price:#C8B890, text:#E0DCF0, mode:dark, font_style:classic
Tratoria: bg:#1a0e06, accent:#A07848, price:#D49040, text:#EDE0D0, mode:dark, font_style:rustic
Kawiarnia: bg:#FBF7F2, accent:#8A6848, price:#6A3818, text:#2A1E14, mode:light, font_style:rustic
Bistro nowoczesne: bg:#F2F0EC, accent:#485848, price:#703820, text:#181410, mode:light, font_style:modern
Sushi bar: bg:#0a120a, accent:#5A8858, price:#C8A840, text:#D8E8D0, mode:dark, font_style:classic
Street food: bg:#141418, accent:#D04828, price:#E87830, text:#F0EDE8, mode:dark, font_style:bold
Pizzeria: bg:#FBF5EE, accent:#C04828, price:#882010, text:#281408, mode:light, font_style:rustic
Cocktail bar: bg:#0c0810, accent:#9060B0, price:#D090C0, text:#E8E0F0, mode:dark, font_style:modern
</palette_examples>
</step>

<step name="3_content_rules">
<restaurant_name>
- Wyodrębnij z obrazu — zachowaj oryginalną pisownię i wielkość liter
- Jeśli niewidoczna, użyj eleganckiego placeholdera (np. "La Maison", "Osteria Roma")
- Nigdy: "Twoja Restauracja" lub "Restauracja"
</restaurant_name>

<tagline>
- Maksymalnie 1 zdanie, evokacyjne, konkretne
- Dobre: "Autentyczna kuchnia włoska w sercu miasta od 1987 roku"
- Dobre: "Sezonowe składniki, lokalni dostawcy, smaki które pamiętasz"
- Złe: "Smaczne jedzenie dla każdego", "Najlepsza restauracja w mieście"
</tagline>

<item_descriptions>
- DOMYŚLNIE: PRZEPISZ opis każdego dania dokładnie ze źródła. Jeśli pod/obok nazwy dania jest jakikolwiek tekst (składniki, dodatki, sposób podania) — MUSI trafić do pola "description", słowo w słowo. To najważniejsza zasada.
- Przepisuj wiernie: te same słowa i składniki co w źródle. Nie skracaj, nie upiększaj, nie zmieniaj stylu, nie dodawaj nic od siebie.
- Pole "description" zostaw puste ("") TYLKO wtedy, gdy danie naprawdę nie ma żadnego opisu w źródle (jest sama nazwa i cena). Tylko w tym przypadku NIE wymyślaj opisu z nazwy.
- Uwaga: zasada pustego pola dotyczy WYŁĄCZNIE opisu. Cena musi być ZAWSZE wypełniona (patrz <prices>).
</item_descriptions>

<prices>
- ZAWSZE podaj cenę dla KAŻDEGO dania — pole "price" NIGDY nie może być puste ani "—".
- Jeśli cena jest widoczna: przepisz DOKŁADNIE jak na obrazie — nie zaokrąglaj, nie zmieniaj formatu.
- Jeśli cena jest nieczytelna lub nie ma jej w źródle: oszacuj rozsądnie (przystawka ~25-45 zł, zupa ~15-30 zł, danie główne ~45-90 zł, deser ~18-35 zł, napój ~8-20 zł). To JEDYNY wyjątek od zasady niewymyślania — ceny wypełniaj zawsze.
- Format: "XX zł" lub "XX,XX zł"
</prices>

<categories>
- Zachowaj oryginalną kolejność z menu
- Dopasuj nazwy do kuchni: Antipasti/Primi/Secondi/Dolci, Entrées/Plats/Desserts, Przystawki/Zupy/Dania główne/Desery
- Napoje zawsze na końcu
</categories>
</step>

<language_rules>
KRYTYCZNE: Całe menu generuj WYŁĄCZNIE w JĘZYKU POLSKIM — jeden język, nigdy więcej.
- Jeśli papierowe menu na zdjęciu jest wielojęzyczne (np. polski + angielski + niemiecki), weź TYLKO wersję polską. Zignoruj pozostałe języki.
- Jeśli na zdjęciu nie ma polskiej wersji, przetłumacz treść na polski.
- ŻADNE pole (name, description, tagline, category name) nie może zawierać dwóch języków naraz. Nigdy nie pisz np. "Pierogi / Dumplings" ani "Żurek (sour soup)".
- Tłumaczenie na inne języki robi osobny system (przyciski flag) — Ty zwracasz czysty, jednojęzyczny polski JSON.
</language_rules>

<quality_rules>
- Nie pomijaj żadnego dania, opisu ani ceny, które są w źródle — przepisz komplet
- NIE „ujednolicaj" ani nie przerabiaj opisów — każdy opis ma brzmieć tak jak w źródle, nawet jeśli style dań się różnią
- Zachowaj polskie znaki diakrytyczne w nazwach i opisach
- Jeden język (polski) w całym menu — patrz language_rules
</quality_rules>

<font_style_guide>
Dostępne wartości font_style: classic, modern, rustic, bold
- classic → fine dining, eleganckie restauracje
- rustic → tratorie, bistro, polska kuchnia, pizzerie
- modern → nowoczesne, minimalistyczne, fusion
- bold → burgery, street food, bary, casual
</font_style_guide>

<output_format>
Umieść JSON WYŁĄCZNIE między tagami <output> i </output>. Żadnego tekstu poza tagami.

<output>
{
  "restaurant_name": "Nazwa odczytana z obrazu",
  "tagline": "Jedno evokacyjne zdanie o restauracji",
  "palette": {
    "bg": "#FBF7F2",
    "accent": "#8A6848",
    "price": "#6A3818",
    "text": "#2A1E14",
    "mode": "light"
  },
  "font_style": "rustic",
  "categories": [
    {
      "name": "Nazwa kategorii",
      "items": [
        {
          "name": "Nazwa dania",
          "description": "Opis DOKŁADNIE ze źródła; pusty string \"\" jeśli danie nie ma opisu w menu",
          "price": "XX zł"
        }
      ]
    }
  ]
}
</output>
</output_format>`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user  = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
    return;
  }

  /* ── Trial enforcement ── */
  const accountKey = `account:${user.email}`;
  const account    = (await kvGet(accountKey)) || {};

  if (!account.first_generated_at) {
    account.first_generated_at = Date.now();
    await kvSet(accountKey, account);
  }

  /* Statystyki do panelu admina */
  async function _bumpGen() {
    try {
      account.generation_count = (account.generation_count || 0) + 1;
      account.last_generated_at = Date.now();
      await kvSet(accountKey, account);
    } catch {}
  }
  async function _bumpErr(m) {
    try {
      account.error_count = (account.error_count || 0) + 1;
      account.last_error = String(m).slice(0, 200);
      account.last_error_at = Date.now();
      await kvSet(accountKey, account);
    } catch {}
  }

  if (!isAdmin(user.email) && Date.now() - account.first_generated_at > TRIAL_MS) {
    const paid   = await kvGet(`paid:${user.email}`);
    const isPaid = paid?.active && (!paid.expires_at || Date.now() < paid.expires_at);
    if (!isPaid) {
      res.status(402).json({ error: 'trial_expired', message: 'Twój 7-dniowy okres próbny dobiegł końca. Wybierz plan aby kontynuować.' });
      return;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Brak klucza ANTHROPIC_API_KEY — skonfiguruj go w Vercel → Settings → Environment Variables.' });
    return;
  }

  const { images = [], notes = '', style = 'klasyczny', logo = null } = req.body || {};

  const content = [];

  if (logo && logo.data) {
    content.push({ type: 'text', text: 'Poniżej logo lub szyld restauracji — użyj widocznej nazwy jako restaurant_name:' });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: logo.type || 'image/jpeg', data: logo.data }
    });
  }

  for (const img of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.type || 'image/jpeg', data: img.data }
    });
  }

  const styleGuide = {
    klasyczny:  'Elegancki i czytelny. Opisy wyważone, nie przesadnie poetyckie.',
    nowoczesny: 'Minimalistyczny. Opisy ultra-krótkie, same składniki bez zbędnych słów.',
    rustykalny: 'Ciepły i tradycyjny. Opisy nawiązują do tradycji, babcinych przepisów, regionu.',
    premium:    'Luksusowy fine dining. Opisy jak z restauracji Michelin — techniki, proweniencja składników, precyzja.',
  };

  const userPrompt = [
    images.length > 0
      ? 'Przeanalizuj dostarczone zdjęcia menu i wygeneruj kompletną strukturę menu.'
      : 'Wygeneruj kompletną strukturę menu na podstawie poniższego opisu.',
    notes ? `\nDodatkowe informacje od właściciela: ${notes}` : '',
    `\nStyl opisów: ${style} — ${styleGuide[style] || ''}`,
    '\nZwróć tylko JSON.',
  ].filter(Boolean).join('');

  content.push({ type: 'text', text: userPrompt });

  const requestBody = JSON.stringify({
    model: 'claude-opus-4-8',
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content }
    ]
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
      proxyRes.on('end', async () => {
        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'error' || parsed.error) {
            const msg = parsed.error?.message || parsed.error || `HTTP ${proxyRes.statusCode}`;
            res.status(500).json({ error: `Błąd API: ${msg}` });
            await _bumpErr(msg);
            resolve(); return;
          }

          const textBlock = (parsed.content || []).find(b => b.type === 'text');
          const text = textBlock?.text || '';

          // Extract JSON from <output> tags
          const tagMatch = text.match(/<output>([\s\S]*?)<\/output>/);
          const jsonStr = tagMatch ? tagMatch[1].trim() : text.trim();

          try {
            const menu = JSON.parse(jsonStr);
            res.status(200).json({ ok: true, menu }); await _bumpGen();
          } catch {
            // Fallback: regex extraction
            const match = jsonStr.match(/\{[\s\S]*\}/);
            if (match) {
              const menu = JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1').replace(/[\x00-\x1F\x7F]/g, ' '));
              res.status(200).json({ ok: true, menu }); await _bumpGen();
            } else {
              res.status(500).json({ error: 'AI nie zwróciło poprawnego JSON.', raw: text.slice(0, 300) });
            }
          }
        } catch (e) {
          res.status(500).json({ error: 'Błąd parsowania odpowiedzi AI.', detail: e.message, http: proxyRes.statusCode });
        }
        resolve();
      });
    });

    proxyReq.on('error', async (e) => { res.status(502).json({ error: `Błąd połączenia z API: ${e.message}` }); await _bumpErr(e.message); resolve(); });
    proxyReq.write(requestBody);
    proxyReq.end();
  });
};

module.exports.config = { api: { bodyParser: { sizeLimit: '20mb' } } };
