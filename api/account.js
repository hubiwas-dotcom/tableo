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

async function kvDel(key) {
  const { url, token } = kvCreds();
  if (!url || !token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['DEL', key])
    });
    return res.ok;
  } catch { return false; }
}

/* SET NX — zapis tylko gdy klucz nie istnieje (insert-only, atomowo) */
async function kvSetNX(key, value) {
  const { url, token } = kvCreds();
  if (!url || !token) return false;
  try {
    const res  = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, JSON.stringify(value), 'NX'])
    });
    const data = await res.json();
    return data.result === 'OK';
  } catch { return false; }
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
    if (data.email) data.email = String(data.email).toLowerCase().trim();
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
    const now = Date.now();
    const days7 = Array.from({ length: 7 }, (_, i) => new Date(now - i * 86400000).toISOString().slice(0, 10));

    /* ── Audyt stałych linków: GET /api/account?admin=1&audit=1 ──
       Wypisuje wszystkie opublikowane menu per konto. Jeśli konto ma >1 slug,
       to ślad po dawnym bugu — aktywny link mógł się różnić od wydrukowanego.
       Naprawa: PATCH { admin_action:'set_slug', target_email, slug }. */
    if (req.query.audit === '1') {
      const menuKeys = (await kvScan('menu:*')).filter(k => k.split(':').length === 2);
      const byOwner = {};
      for (const k of menuKeys) {
        const m = await kvGet(k);
        if (!m) continue;
        const owner = (m.owner || '').toLowerCase().trim() || '(bez właściciela)';
        (byOwner[owner] = byOwner[owner] || []).push({
          slug: k.slice(5),
          published_at: m.published_at || null,
          restaurant: m.menu?.restaurant_name || null,
        });
      }
      const audit = await Promise.all(Object.entries(byOwner).map(async ([email, menus]) => {
        const [rec, acc] = await Promise.all([kvGet(`slug:${email}`), kvGet(`account:${email}`)]);
        menus.sort((a, b) => (a.published_at || 0) - (b.published_at || 0));
        return {
          email,
          active_slug: rec?.slug || acc?.slug || null,
          active_url:  rec?.url  || acc?.published_url || null,
          menus,
          duplicates: menus.length > 1,
        };
      }));
      audit.sort((a, b) => Number(b.duplicates) - Number(a.duplicates));
      res.json({ ok: true, audit });
      return;
    }

    /* Zbierz adresy z OBU źródeł: user: (logowania) i account: (wygenerowane menu). */
    const [userKeys, acctKeys] = await Promise.all([kvScan('user:*'), kvScan('account:*')]);
    const emails = new Set();
    userKeys.forEach(k => emails.add(k.replace(/^user:/, '')));
    acctKeys.forEach(k => emails.add(k.replace(/^account:/, '')));

    const rows = await Promise.all([...emails].map(async (email) => {
      const [u, acc, paid] = await Promise.all([
        kvGet(`user:${email}`), kvGet(`account:${email}`), kvGet(`paid:${email}`),
      ]);
      const firstGen   = acc?.first_generated_at || null;
      const isPaidRow  = isAdmin(email) || !!(paid?.active && (!paid.expires_at || now < paid.expires_at));
      const trialExpired = !isPaidRow && firstGen ? (now - firstGen > TRIAL_MS) : false;
      const daysLeft   = firstGen ? Math.max(0, Math.ceil((firstGen + TRIAL_MS - now) / 86400000)) : null;

      /* Anonimowe wejścia gości z licznika beacon (views:{slug} + dzienne) */
      let viewsTotal = 0, views7 = 0;
      const slug = acc?.slug || null;
      if (slug) {
        const [tot, ...daily] = await Promise.all([
          kvGet(`views:${slug}`),
          ...days7.map(d => kvGet(`views:${slug}:${d}`)),
        ]);
        viewsTotal = Number(tot) || 0;
        views7 = daily.reduce((s, v) => s + (Number(v) || 0), 0);
      }

      return {
        email, slug,
        provider:          u?.provider || 'email',
        is_admin:          isAdmin(email),
        registered_at:     u?.created_at || null,
        last_login:        u?.last_login || null,
        login_count:       u?.login_count || 0,
        generation_count:  acc?.generation_count || 0,
        last_generated_at: acc?.last_generated_at || firstGen || null,
        qr_downloads:      acc?.qr_downloads || 0,
        views_total:       viewsTotal,
        views_7d:          views7,
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

    /* Statystyki globalne */
    const active7d = rows.filter(r =>
      (r.last_login && now - r.last_login < 7 * 86400000) ||
      (r.last_generated_at && now - r.last_generated_at < 7 * 86400000)
    ).length;
    const globals = {
      accounts:          rows.length,
      active_7d:         active7d,
      total_views:       rows.reduce((s, r) => s + r.views_total, 0),
      total_generations: rows.reduce((s, r) => s + r.generation_count, 0),
    };

    /* Alerty */
    const alerts = {
      trial_ending:  rows.filter(r => !r.paid && r.trial_days_left != null && r.trial_days_left <= 2 && !r.trial_expired)
                         .map(r => ({ email: r.email, days_left: r.trial_days_left })),
      trial_expired: rows.filter(r => r.trial_expired).map(r => ({ email: r.email })),
      with_errors:   rows.filter(r => r.error_count > 0).map(r => ({ email: r.email, error_count: r.error_count, last_error: r.last_error })),
      heavy_usage:   rows.filter(r => r.generation_count >= 15).map(r => ({ email: r.email, generation_count: r.generation_count })),
    };

    res.json({ ok: true, count: rows.length, user_keys: userKeys.length, account_keys: acctKeys.length, generated_at: now, globals, alerts, users: rows });
    return;
  }

  /* ── GET: return account metadata + current menu + trial status ── */
  if (req.method === 'GET') {
    const TRIAL_MS = parseInt(process.env.TRIAL_DAYS || '7', 10) * 24 * 60 * 60 * 1000;
    let account  = (await kvGet(accountKey)) || null;

    /* Migracja: starsze tokeny miały email z oryginalną wielkością liter,
       więc konto (i stały slug) mogło trafić pod klucz typu account:Jan@x.pl.
       Jeśli konto pod kluczem małymi literami nie ma sluga, znajdź stary
       wariant, przenieś dane i usuń duplikat — slug wraca do właściciela. */
    if (!account?.slug) {
      try {
        const keys = await kvScan('account:*');
        const legacyKey = keys.find(k => k !== accountKey && k.toLowerCase() === accountKey);
        if (legacyKey) {
          const legacy = await kvGet(legacyKey);
          if (legacy) {
            const merged = { ...legacy, ...(account || {}) };
            if (legacy.slug)          merged.slug          = legacy.slug;
            if (legacy.published_url) merged.published_url = legacy.published_url;
            if (legacy.first_generated_at && account?.first_generated_at) {
              merged.first_generated_at = Math.min(legacy.first_generated_at, account.first_generated_at);
            }
            await kvSet(accountKey, merged);
            await kvDel(legacyKey);
            account = merged;
          }
        }
      } catch {}
    }

    /* ── Stały link: rekord slug:{email} jest źródłem prawdy ──
       - istnieje → konto ZAWSZE pokazuje ten slug/URL (auto-naprawa,
         gdyby rekord konta został kiedykolwiek uszkodzony/nadpisany)
       - nie istnieje, a konto ma slug → utwórz go raz (insert-only) */
    try {
      const slugKey = `slug:${user.email}`;
      let rec = await kvGet(slugKey);
      if (!rec && account?.slug) {
        await kvSetNX(slugKey, {
          slug:       account.slug,
          url:        account.published_url || `https://qreat.pl/menu/${account.slug}`,
          created_at: account.published_at || Date.now(),
        });
        rec = await kvGet(slugKey);
      }
      if (rec && (account?.slug !== rec.slug || account?.published_url !== rec.url)) {
        account = { ...(account || {}), slug: rec.slug, published_url: rec.url };
        await kvSet(accountKey, account);
      }
    } catch {}

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

  /* ── PATCH: zapis własnej domeny / liczniki / naprawa admina ──
     UWAGA: slug/URL/QR są STAŁE per konto. Źródłem prawdy jest rekord
     slug:{email} (insert-only), tworzony w save-menu.js przez SET NX. */
  if (req.method === 'PATCH') {

    /* Admin: przywrócenie kanonicznego (wydrukowanego) linku dla konta.
       Jedyne miejsce w systemie, które może nadpisać rekord slug:{email}. */
    if (req.body && req.body.admin_action === 'set_slug') {
      if ((user.email || '') !== 'hubiwas@gmail.com') { res.status(403).json({ error: 'Brak uprawnień.' }); return; }
      const target = String(req.body.target_email || '').toLowerCase().trim();
      const slug   = String(req.body.slug || '').trim();
      if (!target || !slug) { res.status(400).json({ error: 'Wymagane: target_email, slug.' }); return; }
      const menuRec = await kvGet(`menu:${slug}`);
      if (!menuRec) { res.status(404).json({ error: 'Menu o tym slugu nie istnieje.' }); return; }
      if ((menuRec.owner || '').toLowerCase().trim() !== target) {
        res.status(400).json({ error: 'Ten slug należy do innego konta.' }); return;
      }
      const url = `https://${(req.headers.host || 'qreat.pl').replace(/^www\./, '')}/menu/${slug}`;
      await kvSet(`slug:${target}`, { slug, url, created_at: menuRec.published_at || Date.now(), restored_at: Date.now() });
      let acc = await kvGet(`account:${target}`);
      if (!acc) acc = await kvGet(`account:${target}`);
      acc = acc || {};
      acc.slug = slug; acc.published_url = url;
      await kvSet(`account:${target}`, acc);
      res.json({ ok: true, slug, url });
      return;
    }

    /* Świeży odczyt z ponowieniem; gdy odczyt padnie, NIE nadpisujemy konta
       (zapis "pustego" obiektu kasowałby slug i liczniki) */
    let account = await kvGet(accountKey);
    if (!account) account = await kvGet(accountKey);

    /* Zdarzenie: pobranie kodu QR — licznik do panelu admina */
    if (req.body && req.body.event === 'qr_downloaded') {
      if (account) {
        account.qr_downloads = (account.qr_downloads || 0) + 1;
        account.last_qr_download_at = Date.now();
        await kvSet(accountKey, account);
      }
      res.json({ ok: true });
      return;
    }

    if (!account) {
      res.status(503).json({ error: 'Chwilowy problem z zapisem — spróbuj ponownie.' });
      return;
    }

    /* ── Reset adresu (świadoma decyzja właściciela konta) ──
       Tworzy NOWY slug/URL/QR, a WSZYSTKIE dotychczasowe adresy zostają
       w bazie jako przekierowania 301 → wydrukowane kody QR działają dalej.
       To (obok admin_action=set_slug) jedyne miejsce nadpisujące slug:{email}. */
    if (req.body && req.body.action === 'reset_address') {
      const slugKey = `slug:${user.email}`;
      let rec = await kvGet(slugKey);
      if (!rec) rec = await kvGet(slugKey);
      const oldSlug = rec?.slug || account.slug || null;
      if (!oldSlug) { res.status(400).json({ error: 'Brak opublikowanego menu — nie ma czego resetować.' }); return; }

      const oldMenu = await kvGet(`menu:${oldSlug}`);
      if (!oldMenu?.menu) { res.status(400).json({ error: 'Nie znaleziono menu do przeniesienia.' }); return; }

      const base = (oldMenu.menu.restaurant_name || 'menu')
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 36);
      const newSlug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
      const host    = (req.headers.host || 'qreat.pl').replace(/^www\./, '');
      const newUrl  = `https://${host}/menu/${newSlug}`;

      /* przenieś treść pod nowy adres */
      await kvSet(`menu:${newSlug}`, { menu: oldMenu.menu, owner: user.email, published_at: Date.now() });

      /* wszystkie dotychczasowe adresy (także z wcześniejszych resetów) → 301 na najnowszy */
      const previous = [...new Set([...(rec?.previous || []), oldSlug])].filter(s => s && s !== newSlug);
      await Promise.all(previous.map(s => kvSet(`menu:${s}`, { redirect: newSlug, owner: user.email, moved_at: Date.now() })));

      await kvSet(slugKey, { slug: newSlug, url: newUrl, created_at: Date.now(), previous });

      account.slug          = newSlug;
      account.published_url = newUrl;
      account.published_at  = Date.now();
      await kvSet(accountKey, account);

      if (account.custom_domain) {
        await kvSet(`domain:${account.custom_domain}`, { slug: newSlug, email: user.email });
      }
      await Promise.all(['en','de','fr','it','es','ru'].map(l => kvDel(`menu:${oldSlug}:${l}`)));

      res.json({ ok: true, slug: newSlug, url: newUrl, redirected_from: previous });
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
