# CLAUDE.md — Tableo Project

## System Architecture

Tableo to platforma SaaS dla restauracji: właściciel wgrywa zdjęcie papierowego menu → AI (Claude Vision) generuje menu cyfrowe → menu dostępne online pod unikalnym URL.

### Pliki kluczowe
- `index.html` — landing page (marketing)
- `editor.html` → `/editor` — główna aplikacja (login + generator AI)
- `api/generate-menu.js` — wywołuje Claude claude-opus-4-7 z obrazami, zwraca JSON menu
- `api/menu.js` — serwuje publiczne menu HTML z Upstash KV pod `/menu/:slug`
- `api/save-menu.js` — zapisuje menu do Upstash KV, generuje slug
- `api/login.js` + `api/register.js` — auth email/hasło (HMAC token, bcrypt)
- `api/google-auth.js` — Google OAuth (weryfikacja JWT)
- `api/config.js` — zwraca `GOOGLE_CLIENT_ID` do frontendu

### Deployment
- Platforma: **Vercel** (serverless Node.js functions w `api/`)
- URL produkcyjny: `https://tableo-murex.vercel.app`
- Repo: `hubiwas-dotcom/tableo` na GitHubie, branch `master`
- Deploy: Vercel jest podłączony do repo przez GitHub integration — każdy push do `master` automatycznie wdraża na produkcję. To ustawienie żyje na koncie Vercel, nie zależy od komputera ani lokalnego `vercel` CLI.
- **Claude ma stałą autoryzację do `git commit` + `git push` na `master`, gdy użytkownik prosi o wdrożenie/aktualizację produkcji** — nie trzeba pytać za każdym razem o zgodę na ten konkretny push.
- Routing: zdefiniowany w `vercel.json`

### Zmienne środowiskowe (Vercel → Settings → Environment Variables)
- `ANTHROPIC_API_KEY` — klucz API do Claude (generate-menu)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — Upstash Redis (lub `UPSTASH_REDIS_REST_*`)
- `TOKEN_SECRET` — sekret do podpisywania HMAC tokenów auth
- `ADMIN_PASSWORD_HASH` — hash bcrypt do logowania email

### Auth system
- Token: `base64(JSON payload).HMAC_SHA256`
- Czas życia tokenu: 30 dni
- Trial: 7 dni od rejestracji (`trial_start` w localStorage)
- Przechowywane w `localStorage` jako `tableo_auth`

### AI Menu Generator
- Model: `claude-opus-4-7` (vision)
- Input: base64 zdjęcia + notatki + styl
- Output: JSON `{ restaurant_name, tagline, categories: [{ name, items: [{ name, description, price, emoji }] }] }`
- Prompt i parsowanie: `api/generate-menu.js`

### KV Store (Upstash Redis)
- Klucz: `menu:{slug}` → `{ menu, owner, published_at }`
- Slug generowany z nazwy restauracji + random hex

### Brand Colors
```
Navy:  #1B2A4A  (primary)
Sage:  #7BAA8F  (accent)
Gold:  #C9924A  (CTA / ceny)
Cream: #FDFBF7  (tło)
```
Fonty: Playfair Display (nagłówki) + Plus Jakarta Sans (body)

### Menu template (publiczne + podgląd)
Obie wersje (serwer `api/menu.js` i iframe w `editor.html`) używają tej samej ciemnej estetyki "Noir Gastronome":
- Tło: `#0d1624`, złote ceny, animacje `dishIn` ze staggered delay
- Funkcja `buildMenuHtml(menu)` w `editor.html` generuje HTML dla iframe + pobieranie
- `buildMenuPage(menu)` w `api/menu.js` generuje HTML dla publicznych URL

---

# Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
