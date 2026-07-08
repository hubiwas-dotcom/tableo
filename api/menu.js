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

/* Liczniki wejść (anonimowe, bez IP/cookies) — INCR + EXPIRE przez Upstash REST */
async function kvIncr(key) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return 0;
  try {
    const res  = await fetch(`${url}/incr/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    return typeof data.result === 'number' ? data.result : 0;
  } catch { return 0; }
}
async function kvExpire(key, seconds) {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try { await fetch(`${url}/expire/${encodeURIComponent(key)}/${seconds}`, { headers: { Authorization: `Bearer ${token}` } }); } catch {}
}

function fontConfig(style) {
  const fonts = {
    classic: {
      url: 'Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400',
      heading: "'Cinzel',serif", dish: "'Cormorant Garamond',serif", body: "'DM Sans',sans-serif",
      navFs:'9.5px', catFs:'16px', catLs:'.16em', dishFs:'17px',
    },
    modern: {
      url: 'Jost:wght@300;400;500;600&family=Inter:wght@300;400',
      heading: "'Jost',sans-serif", dish: "'Jost',sans-serif", body: "'Inter',sans-serif",
      navFs:'10px', catFs:'15px', catLs:'.12em', dishFs:'16px',
    },
    rustic: {
      url: 'Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lora:ital,wght@0,400;1,400&family=Source+Sans+3:wght@300;400',
      heading: "'Playfair Display',serif", dish: "'Lora',serif", body: "'Source Sans 3',sans-serif",
      navFs:'9px', catFs:'17px', catLs:'.1em', dishFs:'18px',
    },
    bold: {
      url: 'Oswald:wght@400;500;600&family=Merriweather:ital,wght@0,300;1,300&family=Open+Sans:wght@300;400',
      heading: "'Oswald',sans-serif", dish: "'Merriweather',serif", body: "'Open Sans',sans-serif",
      navFs:'10px', catFs:'15px', catLs:'.14em', dishFs:'16px',
    },
  };
  return fonts[style] || fonts.classic;
}

function paletteVars(p) {
  const bg     = (p && p.bg)     || '#0d1520';
  const accent = (p && p.accent) || '#7BAA8F';
  const price  = (p && p.price)  || '#C9924A';
  const text   = (p && p.text)   || '#E8DFD0';
  const isHex = h => /^#[0-9a-fA-F]{3,6}$/.test(h);
  const hr = h => {
    if (!isHex(h)) h = '#888888';
    h = h.replace('#','');
    if (h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  };
  const lh = (h, a) => {
    const [r,g,b] = hr(h);
    const n = c => Math.min(255,Math.round(c+a*255)).toString(16).padStart(2,'0');
    return '#'+n(r)+n(g)+n(b);
  };
  const [tr,tg,tb]   = hr(text);
  const [ar,ag,ab]   = hr(accent);
  const [pr,pg,pb]   = hr(price);
  const [bgr,bgg,bgb] = hr(bg);
  return {
    bg, accent, price, text,
    priceLight: lh(price, 0.12),
    tRgb:  `${tr},${tg},${tb}`,
    aRgb:  `${ar},${ag},${ab}`,
    pRgb:  `${pr},${pg},${pb}`,
    bgRgb: `${bgr},${bgg},${bgb}`,
  };
}

function buildMenuPage(menu, slug, version) {
  const v       = paletteVars(menu.palette);
  const f       = fontConfig(menu.font_style);
  const cats    = menu.categories || [];
  const name    = menu.restaurant_name || 'Menu restauracji';
  const tagline = menu.tagline || '';
  const logo    = menu.logo || null;

  const catLinks = cats.map((c, i) =>
    `<a class="cat-link" href="#s${i}" onclick="goTo(event,${i})">${c.name}</a>`
  ).join('');

  const sections = cats.map((c, i) => {
    const dishes = (c.items || []).map((item, k) => {
      const imgHtml  = item.image
        ? `<img class="dish-img" src="${item.image}" alt="${item.name}" loading="lazy">`
        : '';
      const descHtml = item.description
        ? `<p class="dish-desc">${item.description}</p>`
        : '';
      return `<article class="dish" style="animation-delay:${k * 0.06}s">`
           + imgHtml
           + `<div class="dish-row"><span class="dish-name">${item.name}</span>`
           + `<span class="dish-price">${item.price || ''}</span></div>`
           + descHtml
           + `</article>`;
    }).join('');

    const catImg = c.image
      ? `<img class="cat-img" src="${c.image}" alt="${c.name}" loading="lazy">`
      : '';
    return `<section class="cat-section" id="s${i}">`
         + `<div class="cat-heading"><span class="cat-line-l"></span>`
         + `<span class="cat-title">${c.name}</span><span class="cat-line-r"></span></div>`
         + catImg
         + `<div class="dishes">${dishes}</div></section>`;
  }).join('');

  const logoHtml = logo
    ? `<img class="nav-logo-img" src="${logo}" alt="${name}">`
    : '';

  const LANG_LABELS = { pl:'PL', en:'EN', de:'DE', fr:'FR', it:'IT', es:'ES', ru:'RU' };
  const translations = menu.translations || {};
  /* Pokaż flagę tylko dla PL + języków, które mają gotowe tłumaczenie (albo starych menu z menu.languages) */
  const hasBaked = Object.keys(translations).length > 0;
  const langs = hasBaked
    ? ['pl', ...Object.keys(translations)]
    : (Array.isArray(menu.languages) && menu.languages.length > 1 ? menu.languages : []);
  const langBtns = langs.map(l =>
    `<button class="lang-btn${l === 'pl' ? ' active' : ''}" data-lang="${l}" onclick="switchLang('${l}')">${LANG_LABELS[l] || l.toUpperCase()}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${f.url}&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{
      --bg:${v.bg};--nav-h:54px;
      --sage:${v.accent};--gold:${v.price};--gold-light:${v.priceLight};
      --cream:${v.text};--cream-dim:rgba(${v.tRgb},.5);--cream-muted:rgba(${v.tRgb},.32);
      --border:rgba(${v.tRgb},.07);
    }
    html{background:var(--bg);}
    body{font-family:${f.body};background:var(--bg);color:var(--cream);
      -webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden;}
    body::after{content:'';position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.02;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23n)'/%3E%3C/svg%3E");}

    /* ── Nav ── */
    .topnav{position:sticky;top:0;z-index:100;
      display:flex;align-items:center;justify-content:space-between;
      height:var(--nav-h);padding:0 14px;
      background:rgba(${v.bgRgb},.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border-bottom:1px solid var(--border);}
    .nav-left{display:flex;align-items:center;overflow:hidden;}
    .nav-right{display:flex;align-items:center;gap:4px;flex-shrink:0;}
    .nav-logo-img{max-height:32px;width:auto;max-width:160px;object-fit:contain;}
    .nav-name{font-family:${f.heading};font-size:${f.navFs};font-weight:600;
      letter-spacing:.12em;text-transform:uppercase;color:var(--cream);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .lang-btn{background:none;border:1px solid rgba(${v.tRgb},.15);color:var(--cream-dim);
      border-radius:6px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
      padding:4px 8px;cursor:pointer;font-family:${f.heading};
      transition:background 120ms,color 120ms,border-color 120ms;}
    .lang-btn.active,.lang-btn:hover{background:rgba(${v.tRgb},.1);color:var(--cream);border-color:rgba(${v.tRgb},.3);}

    /* ── Hero ── */
    .hero{position:relative;padding:38px 20px 30px;text-align:center;overflow:hidden;}
    .hero-glow{position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse 90% 70% at 50% 120%,rgba(${v.aRgb},.1) 0%,transparent 60%),
                radial-gradient(ellipse 50% 40% at 15% 0%,rgba(${v.pRgb},.06) 0%,transparent 50%);}
    .hero-eyebrow{display:inline-flex;align-items:center;gap:8px;
      font-family:${f.heading};font-size:7.5px;font-weight:500;
      letter-spacing:.28em;text-transform:uppercase;color:var(--sage);margin-bottom:12px;opacity:.7;}
    .hero-eyebrow::before,.hero-eyebrow::after{content:'';width:18px;height:1px;background:currentColor;opacity:.4;}
    .hero-name{font-family:${f.heading};font-size:clamp(1.25rem,5.5vw,2.1rem);font-weight:600;
      letter-spacing:.07em;text-transform:uppercase;color:var(--cream);line-height:1.1;position:relative;}
    .hero-tagline{font-family:${f.dish};font-style:italic;font-size:13.5px;
      font-weight:300;color:var(--cream-muted);letter-spacing:.02em;line-height:1.7;
      max-width:260px;margin:10px auto 0;position:relative;}
    .hero-rule{position:absolute;bottom:0;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent,rgba(123,170,143,.14),rgba(201,146,74,.2),rgba(123,170,143,.14),transparent);}

    /* ── Category scroll bar ── */
    .cat-grid{position:sticky;top:var(--nav-h);z-index:99;
      background:rgba(${v.bgRgb},.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border-bottom:1px solid var(--border);
      display:flex;flex-wrap:nowrap;overflow-x:auto;gap:0;
      -ms-overflow-style:none;scrollbar-width:none;}
    .cat-grid::-webkit-scrollbar{display:none;}
    .cat-link{font-family:${f.heading};font-size:11px;font-weight:600;
      letter-spacing:.1em;text-transform:uppercase;text-decoration:none;
      color:var(--cream-dim);padding:13px 16px;flex-shrink:0;
      border-bottom:2px solid transparent;
      transition:color 150ms,border-color 150ms;white-space:nowrap;
      -webkit-tap-highlight-color:transparent;}
    .cat-link:hover{color:var(--gold-light);}
    .cat-link.active{color:var(--gold-light);border-bottom-color:var(--gold);
      font-weight:700;background:linear-gradient(to top,rgba(${v.pRgb},.14),transparent);}

    /* ── Content ── */
    main{max-width:680px;margin:0 auto;padding:14px 16px 100px;}
    .cat-section{margin-bottom:32px;}
    .cat-heading{display:flex;align-items:center;gap:10px;padding:16px 0 11px;}
    .cat-title{font-family:${f.heading};font-size:${f.catFs};font-weight:600;
      letter-spacing:${f.catLs};text-transform:uppercase;color:var(--cream);white-space:nowrap;}
    .cat-line-l{flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(${v.pRgb},.17));}
    .cat-line-r{flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(${v.pRgb},.17));}

    /* ── Dish ── */
    .dish{padding:13px 0;border-bottom:1px solid var(--border);
      opacity:0;animation:fadeUp .4s cubic-bezier(.23,1,.32,1) both;}
    .dish:last-child{border-bottom:none;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
    .dish-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;
      margin-bottom:9px;border:1px solid rgba(232,223,208,.06);
      box-shadow:0 4px 18px rgba(0,0,0,.4);}
    .cat-img{width:100%;aspect-ratio:16/6;object-fit:cover;border-radius:10px;
      margin:2px 0 14px;border:1px solid rgba(232,223,208,.08);
      box-shadow:0 6px 22px rgba(0,0,0,.45);}
    .dish-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
    .dish-name{font-family:${f.dish};font-size:${f.dishFs};font-weight:400;
      color:var(--cream);line-height:1.2;letter-spacing:.01em;}
    .dish-price{font-family:${f.heading};font-size:14px;font-weight:700;
      color:var(--gold-light);white-space:nowrap;letter-spacing:.04em;flex-shrink:0;}
    .dish-desc{font-size:12px;color:rgba(${v.tRgb},.62);margin-top:5px;line-height:1.65;font-weight:400;}

    /* ── Footer ── */
    footer{position:fixed;bottom:0;left:0;right:0;padding:12px 20px 16px;text-align:center;
      background:linear-gradient(to top,var(--bg) 60%,transparent);pointer-events:none;}
    footer span{font-size:9px;color:rgba(232,223,208,.1);letter-spacing:.06em;}
    footer a{color:rgba(123,170,143,.18);text-decoration:none;pointer-events:all;}
  </style>
</head>
<body>

<nav class="topnav">
  <div class="nav-left">${logo ? logoHtml : `<span class="nav-name">${name}</span>`}</div>
  <div class="nav-right">${langBtns}</div>
</nav>

<div class="cat-grid">${catLinks}</div>
<main>${sections}</main>

<footer><span>menu cyfrowe · <a href="https://tableo-murex.vercel.app" target="_blank">qreat</a></span></footer>

<script>
  var _SLUG = '${slug}';
  var _VER  = '${version || 0}';
  var _lang = 'pl';
  var _cache = ${JSON.stringify(translations).replace(/</g, '\\u003c')};

  function goTo(e, i) {
    e.preventDefault();
    var el = document.getElementById('s' + i);
    if (!el) return;
    var navH  = document.querySelector('.topnav').offsetHeight;
    var gridH = document.querySelector('.cat-grid').offsetHeight;
    /* Podświetl od razu i zablokuj obserwator na czas płynnego przewijania,
       żeby nie "kradł" podświetlenia mijanym kategoriom */
    _navLock = Date.now() + 1200;
    _setActiveCat(i);
    var top = el.getBoundingClientRect().top + window.scrollY - navH - gridH - 6;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  /* ── Language switch ── */
  var _langBusy = false;
  function _setActiveLang(lang) {
    document.querySelectorAll('.lang-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
  }

  async function switchLang(lang) {
    if (_langBusy || lang === _lang) return;

    if (lang === 'pl') { location.reload(); return; }

    if (_cache[lang]) { _lang = lang; _setActiveLang(lang); _applyMenu(_cache[lang]); return; }

    _langBusy = true;
    _setActiveLang(lang);
    var main = document.querySelector('main');
    main.style.transition = 'opacity 200ms';
    main.style.opacity = '0.3';

    var ctrl  = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 60000);
    try {
      var r = await fetch('/api/translate?slug=' + _SLUG + '&lang=' + lang + '&v=' + _VER, { signal: ctrl.signal });
      var d = await r.json();
      if (d.ok && d.menu) { _cache[lang] = d.menu; _lang = lang; _applyMenu(d.menu); }
      else { _setActiveLang(_lang); _showToast('Nie udało się załadować tłumaczenia'); }
    } catch(e) {
      _setActiveLang(_lang);
      _showToast(e.name === 'AbortError' ? 'Tłumaczenie trwało zbyt długo — spróbuj ponownie' : 'Błąd połączenia');
    } finally {
      clearTimeout(timer);
      _langBusy = false;
      main.style.opacity = '1';
    }
  }

  function _applyMenu(menu) {
    /* Save existing images from DOM before rebuilding */
    var imgs = {};
    var catImgs = {};
    document.querySelectorAll('.cat-section').forEach(function(sec, ci) {
      var cimg = sec.querySelector('.cat-img');
      if (cimg) catImgs[ci] = cimg.src;
      sec.querySelectorAll('.dish').forEach(function(dish, ii) {
        var img = dish.querySelector('.dish-img');
        if (img) imgs[ci + '-' + ii] = img.src;
      });
    });

    /* Rebuild sections */
    var sections = (menu.categories || []).map(function(c, i) {
      var dishes = (c.items || []).map(function(item, k) {
        var imgSrc = item.image || imgs[i + '-' + k] || '';
        var img  = imgSrc ? '<img class="dish-img" src="' + imgSrc + '" loading="lazy">' : '';
        var desc = item.description ? '<p class="dish-desc">' + item.description + '</p>' : '';
        return '<article class="dish" style="animation-delay:' + (k * 0.06) + 's">'
             + img
             + '<div class="dish-row"><span class="dish-name">' + item.name + '</span>'
             + '<span class="dish-price">' + (item.price || '') + '</span></div>'
             + desc + '</article>';
      }).join('');
      var catImgSrc = c.image || catImgs[i] || '';
      var catImg = catImgSrc ? '<img class="cat-img" src="' + catImgSrc + '" loading="lazy">' : '';
      return '<section class="cat-section" id="s' + i + '">'
           + '<div class="cat-heading"><span class="cat-line-l"></span>'
           + '<span class="cat-title">' + c.name + '</span><span class="cat-line-r"></span></div>'
           + catImg
           + '<div class="dishes">' + dishes + '</div></section>';
    }).join('');

    document.querySelector('main').innerHTML = sections;

    /* Update nav name + cat links */
    if (menu.restaurant_name) {
      var nn = document.querySelector('.nav-name');
      if (nn) nn.textContent = menu.restaurant_name;
    }
    /* Przebuduj pasek kategorii w całości — liczba kategorii w tłumaczeniu
       może się różnić od oryginału; aktualizacja po indeksie mieszała języki */
    var grid = document.querySelector('.cat-grid');
    if (grid) {
      grid.innerHTML = (menu.categories || []).map(function(c, i) {
        return '<a class="cat-link" href="#s' + i + '" onclick="goTo(event,' + i + ')">' + c.name + '</a>';
      }).join('');
      lnks = Array.from(document.querySelectorAll('.cat-link'));
    }

    /* Re-init observer */
    _initObs();
  }

  function _showToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed',bottom:'60px',left:'50%',transform:'translateX(-50%)',
      background:'rgba(13,21,32,.97)',color:'rgba(232,223,208,.65)',
      padding:'8px 18px',borderRadius:'100px',fontSize:'11px',
      fontFamily:"sans-serif",letterSpacing:'.05em',
      border:'1px solid rgba(232,223,208,.08)',zIndex:'9998',whiteSpace:'nowrap'
    });
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2500);
  }

  /* ── Scroll highlight ── */
  var secs = [];
  var lnks = Array.from(document.querySelectorAll('.cat-link'));
  var obs;
  var _navLock = 0;

  function _setActiveCat(idx) {
    lnks.forEach(function(l, j) { l.classList.toggle('active', j === idx); });
    /* Przewiń TYLKO pasek kategorii (nie stronę) tak, by aktywny chip był widoczny */
    var grid = document.querySelector('.cat-grid');
    var a = lnks[idx];
    if (grid && a) grid.scrollTo({ left: a.offsetLeft - (grid.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
  }

  function _initObs() {
    if (obs) obs.disconnect();
    secs = Array.from(document.querySelectorAll('.cat-section'));
    obs = new IntersectionObserver(function(entries) {
      if (Date.now() < _navLock) return;
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var idx = secs.indexOf(entry.target);
          if (idx >= 0) _setActiveCat(idx);
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });
    secs.forEach(function(s) { obs.observe(s); });
  }

  _initObs();
<\/script>
</body>
</html>`;
}

function buildExpiredPage(restaurantName) {
  const name = restaurantName || 'Menu';
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#0d1520;color:#E8DFD0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}.card{text-align:center;max-width:340px;}.lock{font-size:2.8rem;margin-bottom:28px;filter:grayscale(.3);}.eyebrow{font-family:'Cinzel',serif;font-size:8px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:#7BAA8F;opacity:.7;margin-bottom:16px;}.title{font-family:'Cinzel',serif;font-size:1.25rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#C9924A;margin-bottom:14px;line-height:1.2;}.desc{font-size:13px;color:rgba(232,223,208,.38);line-height:1.75;font-weight:300;}.divider{width:40px;height:1px;background:linear-gradient(to right,transparent,rgba(201,146,74,.3),transparent);margin:24px auto;}.btn{display:inline-block;margin-top:4px;background:#C9924A;color:#0d1520;padding:12px 28px;border-radius:100px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:.06em;font-family:'Cinzel',serif;transition:opacity 150ms;}.btn:hover{opacity:.85;}.brand{margin-top:36px;font-size:9px;color:rgba(232,223,208,.1);letter-spacing:.1em;}</style></head><body><div class="card"><div class="lock">🔒</div><div class="eyebrow">Qreat</div><h1 class="title">Dostęp wygasł</h1><p class="desc">7-dniowy okres próbny tego menu dobiegł końca.<br>Aby menu było dalej dostępne online, odnów subskrypcję.</p><div class="divider"></div><a class="btn" href="https://tableo-murex.vercel.app">Odnów dostęp →</a><p class="brand">menu cyfrowe · qreat</p></div></body></html>`;
}

const TRIAL_MS = parseInt(process.env.TRIAL_DAYS || '7') * 24 * 60 * 60 * 1000;

/* Wstrzykiwane na publiczną stronę menu przed </body>: beacon liczący anonimowe wejścia + baner cookies (informacyjny, PL) */
const PUBLIC_EXTRAS = `<div id="qr-cookie" style="display:none;position:fixed;left:12px;right:12px;bottom:10px;z-index:10000;max-width:520px;margin:0 auto;background:rgba(13,21,32,.97);color:rgba(232,223,208,.85);border:1px solid rgba(232,223,208,.14);border-radius:12px;padding:10px 14px;font-family:'DM Sans',sans-serif;font-size:11.5px;line-height:1.5;gap:10px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.45);"><span style="flex:1;">Zbieramy wyłącznie anonimowe statystyki odwiedzin — bez plików cookie śledzących i bez zapisywania adresu IP. <a href="/polityka-prywatnosci" style="color:#C9924A;text-decoration:underline;">Polityka prywatności</a></span><button onclick="try{localStorage.setItem('qr_cookie_ok','1')}catch(e){}document.getElementById('qr-cookie').style.display='none'" style="flex-shrink:0;background:#C9924A;color:#0d1520;border:none;border-radius:8px;padding:7px 15px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;">OK</button></div><script>try{fetch(location.pathname+'?beacon=1',{cache:'no-store'}).catch(function(){});}catch(e){}try{if(!localStorage.getItem('qr_cookie_ok'))document.getElementById('qr-cookie').style.display='flex';}catch(e){document.getElementById('qr-cookie').style.display='flex';}<\/script>`;

module.exports = async function handler(req, res) {
  /* Custom domain support: if request arrives at a non-Qreat host, look up
     the slug that was mapped to that domain in api/account.js PATCH. */
  const host        = (req.headers.host || '').replace(/^www\./, '');
  const isMainHost  = !host || host.includes('qreat') || host.includes('tableo') || host.includes('vercel.app') || host.includes('localhost');
  let slug;
  if (isMainHost) {
    slug = (req.url || '').replace(/^\/menu\//, '').split('?')[0].split('/')[0];
  } else {
    const domainData = await kvGet(`domain:${host}`);
    slug = domainData?.slug || '';
  }
  if (!slug) { res.status(400).send('<h1>Brak slug menu.</h1>'); return; }

  /* Anonimowy licznik wejść gości — wywoływany beaconem z opublikowanej strony (?beacon=1).
     Nie zapisujemy IP ani cookies; tylko zbiorcze liczniki (łącznie + dziennie, dzienne wygasają po 90 dniach). */
  if ((req.url || '').includes('beacon=1')) {
    try {
      const day = new Date().toISOString().slice(0, 10);
      await kvIncr(`views:${slug}`);
      const n = await kvIncr(`views:${slug}:${day}`);
      if (n === 1) await kvExpire(`views:${slug}:${day}`, 90 * 24 * 60 * 60);
    } catch {}
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
    return;
  }

  const data = await kvGet(`menu:${slug}`);
  if (!data || !data.menu) {
    res.status(404).send(`<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>Nie znaleziono</title><style>body{font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1520;color:#E8DFD0;text-align:center;}h1{font-family:'Cinzel',serif;font-size:2.5rem;margin-bottom:12px;color:#C9924A;}p{color:rgba(232,223,208,.35);font-size:14px;}</style></head><body><div><h1>404</h1><p>Menu nie zostało znalezione lub zostało usunięte.</p></div></body></html>`);
    return;
  }

  /* ── Trial / subscription check ── */
  const owner        = data.owner;
  const adminEmails  = (process.env.ADMIN_EMAILS || 'hubiwas@gmail.com').split(',').map(e => e.trim().toLowerCase());
  const ownerIsAdmin = adminEmails.includes((owner || '').toLowerCase());
  const ownerAccount = owner ? await kvGet(`account:${owner}`) : null;
  const trialAnchor  = ownerAccount?.first_generated_at || data.published_at;
  if (!ownerIsAdmin && trialAnchor && Date.now() - trialAnchor > TRIAL_MS) {
    const paid       = owner ? await kvGet(`paid:${owner}`) : null;
    const paidActive = paid?.active && (!paid.expires_at || Date.now() < paid.expires_at);
    if (!paidActive) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.status(402).send(buildExpiredPage(data.menu?.restaurant_name));
      return;
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.send(buildMenuPage(data.menu, slug, data.published_at).replace('</body>', PUBLIC_EXTRAS + '</body>'));
};
