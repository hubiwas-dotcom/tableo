---
name: deploy
description: Deploy Tableo to Vercel production and verify everything works
---

# Deploy Tableo to Vercel

## Pre-deploy checklist

1. **Sprawdź pliki do wdrożenia** — uruchom `git status` lub sprawdź jakie pliki się zmieniły
2. **Zweryfikuj vercel.json** — upewnij się że routing jest poprawny dla nowych endpointów (każdy nowy `api/*.js` musi mieć wpis)
3. **Sprawdź czy nie ma sekretów w kodzie** — przejrzyj zmienione pliki pod kątem kluczy API, haseł, tokenów zahardkodowanych w JS

## Deploy

```bash
vercel --prod
```

Jeśli `vercel` nie jest zainstalowany:
```bash
npm i -g vercel
vercel login
vercel --prod
```

## Po deployu — weryfikacja

4. **Otwórz** `https://tableo-murex.vercel.app` — sprawdź landing page
5. **Otwórz** `https://tableo-murex.vercel.app/editor` — sprawdź ekran logowania
6. **Sprawdź logi Vercel** jeśli coś nie działa: `vercel logs --prod`

## Zmienne środowiskowe

Jeśli dodałeś nową zmienną środowiskową, musisz ją ustawić w Vercel:
```bash
vercel env add NAZWA_ZMIENNEJ production
```

Lub przez panel: Vercel → projekt → Settings → Environment Variables

## Wymagane zmienne (bez nich system nie działa)

- `ANTHROPIC_API_KEY` — generator AI nie zadziała bez tego
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — zapis/odczyt menu nie zadziała
- `TOKEN_SECRET` — auth nie zadziała (lub użyje domyślnego, co jest niebezpieczne)
- `GOOGLE_CLIENT_ID` — logowanie Google nie zadziała (ale email/hasło dalej będzie działać)
