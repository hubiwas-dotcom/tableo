/* ══════════════════════════════════════════════════════════════════════════
   Qreat — i18n interfejsu (PL / ES / EN)
   ──────────────────────────────────────────────────────────────────────────
   Tłumaczy WYŁĄCZNIE interfejs (landing + edytor).
   NIE dotyka treści menu użytkownika:
     • podgląd menu żyje w <iframe> (osobny dokument) — walker tu nie wchodzi,
     • sekcje z treścią menu są oznaczone atrybutem data-no-i18n,
     • <textarea> i wartości <input> nigdy nie są tłumaczone.

   Jak to działa:
     • słownik kluczowany polskim źródłem → ["hiszpański", "angielski"],
     • walker po węzłach tekstowych + atrybutach (placeholder/title/aria-label/alt),
     • MutationObserver łapie treść dorysowaną przez JS (toasty, karty, panel),
     • elementy z data-i18n-key dostają podmieniony cały innerHTML
       (nagłówki łamane <br>/<em> i akapity z linkami — inny szyk zdania).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LANGS = ['pl', 'es', 'en'];
  var STORE = 'qreat_lang';

  /* ── Słownik: "polski" : [ES, EN] ─────────────────────────────────────── */
  var T = {
    /* ─── Nawigacja / wspólne ─── */
    'Jak działa': ['Cómo funciona', 'How it works'],
    'Jak to działa': ['Cómo funciona', 'How it works'],
    'Cennik': ['Precios', 'Pricing'],
    'Panel admina': ['Panel de administración', 'Admin panel'],
    'Zaloguj się': ['Iniciar sesión', 'Sign in'],
    'Zaloguj się →': ['Iniciar sesión →', 'Sign in →'],
    'Zarejestruj się': ['Crear cuenta', 'Sign up'],
    'Zarejestruj się →': ['Crear cuenta →', 'Sign up →'],
    'Edytor': ['Editor', 'Editor'],
    'Kontakt': ['Contacto', 'Contact'],
    'Produkt': ['Producto', 'Product'],
    'Regulamin': ['Términos del servicio', 'Terms of service'],
    'regulamin': ['los términos del servicio', 'the terms of service'],
    'Polityka prywatności': ['Política de privacidad', 'Privacy policy'],
    'politykę prywatności': ['la política de privacidad', 'the privacy policy'],
    'politykę prywatności.': ['la política de privacidad.', 'the privacy policy.'],
    'Kontakt i reklamacje': ['Contacto y reclamaciones', 'Contact & complaints'],
    'Wsparcie techniczne': ['Soporte técnico', 'Technical support'],
    'lub': ['o', 'or'],
    'i': ['y', 'and'],
    'oraz': ['y', 'and'],
    'Hasło': ['Contraseña', 'Password'],
    'Zamknij': ['Cerrar', 'Close'],
    'Odśwież': ['Actualizar', 'Refresh'],
    'Ładowanie…': ['Cargando…', 'Loading…'],
    'Ładuję…': ['Cargando…', 'Loading…'],
    'Zapisuję…': ['Guardando…', 'Saving…'],
    'Wyślij': ['Enviar', 'Send'],
    'Kategorie': ['Categorías', 'Categories'],
    'Konto': ['Cuenta', 'Account'],

    /* ─── Landing: hero ─── */
    'Generator cyfrowych menu dla restauracji':
      ['Generador de cartas digitales para restaurantes', 'Digital menu generator for restaurants'],
    'Wyślij zdjęcie swojego menu do AI — Claude przeanalizuje je i stworzy profesjonalną wersję online gotową do publikacji.':
      ['Envía una foto de tu carta a la IA: Claude la analizará y creará una versión online profesional, lista para publicar.',
       'Send a photo of your menu to the AI — Claude analyses it and builds a professional online version, ready to publish.'],
    'Generuj menu teraz': ['Generar carta ahora', 'Generate menu now'],
    'Zobacz jak to działa': ['Ver cómo funciona', 'See how it works'],
    'Przewiń': ['Desliza', 'Scroll'],

    /* ─── Landing: trzy kroki ─── */
    'Wyślij zdjęcie menu': ['Envía una foto de la carta', 'Send a photo of the menu'],
    'Zrób zdjęcie papierowego menu i wrzuć do czatu. Może być niewyraźne, odręczne — AI poradzi sobie ze wszystkim.':
      ['Haz una foto de tu carta en papel y súbela al chat. Puede estar borrosa o escrita a mano: la IA se encarga de todo.',
       'Take a photo of your paper menu and drop it into the chat. Blurry or handwritten is fine — the AI handles it.'],
    'AI generuje strukturę': ['La IA genera la estructura', 'The AI builds the structure'],
    'Claude analizuje zdjęcie, wyodrębnia pozycje, kategorie i ceny. Tworzy czytelną, responsywną stronę w kilkadziesiąt sekund.':
      ['Claude analiza la foto y extrae los platos, las categorías y los precios. Crea una página clara y responsive en unos segundos.',
       'Claude analyses the photo and extracts dishes, categories and prices. It builds a clear, responsive page in seconds.'],
    'Opublikuj link': ['Publica el enlace', 'Publish the link'],
    'Dostajesz unikalny link do menu. Wydrukuj kod QR, wklej na stronę lub prześlij gościom. Klienci widzą je natychmiast.':
      ['Recibes un enlace único a tu carta. Imprime el código QR, ponlo en tu web o envíaselo a tus clientes: lo ven al instante.',
       'You get a unique link to your menu. Print the QR code, embed it on your site or send it to guests — they see it instantly.'],

    /* ─── Landing: podgląd telefonu ─── */
    'Efekt końcowy': ['El resultado', 'The result'],
    'Responsywne, bez aplikacji — otwiera się od razu w przeglądarce.':
      ['Responsive y sin aplicaciones: se abre directamente en el navegador.',
       'Responsive, no app required — it opens straight in the browser.'],
    '24 pozycje · 5 kategorii': ['24 platos · 5 categorías', '24 items · 5 categories'],
    'Online w 2 min': ['Online en 2 min', 'Online in 2 min'],
    'link gotowy do publikacji': ['enlace listo para publicar', 'link ready to publish'],
    '1 247 aktywnych menu': ['1 247 cartas activas', '1,247 active menus'],
    'restauracji w Polsce': ['de restaurantes en Polonia', 'in restaurants across Poland'],
    'Menu cyfrowe · generowane przez AI': ['Carta digital · generada con IA', 'Digital menu · AI generated'],
    'Przystawki': ['Entrantes', 'Starters'],
    'Przystawki ·': ['Entrantes ·', 'Starters ·'],
    'Makarony': ['Pastas', 'Pasta'],
    'Desery': ['Postres', 'Desserts'],
    'z pomidorami i bazylią': ['con tomate y albahaca', 'with tomato and basil'],
    'z rukolą i parmezanem': ['con rúcula y parmesano', 'with rocket and parmesan'],
    'z kaparami i cytryną': ['con alcaparras y limón', 'with capers and lemon'],
    'AI od Claude · Anthropic': ['IA de Claude · Anthropic', 'AI by Claude · Anthropic'],
    'Gotowe w 2 minuty': ['Listo en 2 minutos', 'Ready in 2 minutes'],
    'Bez kodowania': ['Sin programar', 'No coding'],
    'Panel admina w chmurze': ['Panel de administración en la nube', 'Cloud admin panel'],

    /* ─── Landing: sekcja generatora ─── */
    'Generator AI': ['Generador con IA', 'AI generator'],
    'Wyślij zdjęcie swojego papierowego menu — AI wyodrębni wszystkie pozycje i ceny.':
      ['Envía una foto de tu carta en papel: la IA extraerá todos los platos y precios.',
       'Send a photo of your paper menu — the AI will extract every item and price.'],
    'gotowy': ['listo', 'ready'],
    'Wyczyść': ['Borrar', 'Clear'],
    'Cześć! Jestem AI od Qreat. Wyślij mi zdjęcie swojego papierowego menu — stworzę z niego profesjonalną wersję cyfrową. 📸':
      ['¡Hola! Soy la IA de Qreat. Envíame una foto de tu carta en papel y crearé una versión digital profesional. 📸',
       'Hi! I\'m the Qreat AI. Send me a photo of your paper menu and I\'ll turn it into a professional digital version. 📸'],
    'Możesz też po prostu opisać swoje menu tekstem.':
      ['También puedes describir tu carta con texto.', 'You can also just describe your menu in text.'],
    'Co potrafi AI:': ['Lo que puede hacer la IA:', 'What the AI can do:'],
    'Odczytyuje papierowe menu ze zdjęcia — nawet niewyraźne lub odręczne':
      ['Lee cartas en papel a partir de una foto, incluso borrosas o escritas a mano',
       'Reads paper menus from a photo — even blurry or handwritten ones'],
    'Grupuje pozycje według kategorii i wyodrębnia ceny':
      ['Agrupa los platos por categorías y extrae los precios', 'Groups items by category and extracts prices'],
    'Odpowiada na pytania i edytuje menu na Twoje polecenie':
      ['Responde preguntas y edita la carta según tus indicaciones', 'Answers questions and edits the menu on your command'],
    'Generuje gotowy kod HTML menu do publikacji online':
      ['Genera el código HTML listo para publicar online', 'Generates ready-to-publish HTML for your menu'],
    'Przykładowe pytania': ['Ejemplos de instrucciones', 'Example prompts'],
    '"Dodaj kategorię Napoje z kawą 12 zł i herbatą 8 zł"':
      ['«Añade la categoría Bebidas con café 3 € y té 2 €»', '"Add a Drinks category with coffee 3 € and tea 2 €"'],
    '"Wygeneruj menu dla restauracji włoskiej z 5 pozycjami"':
      ['«Genera una carta para un restaurante italiano con 5 platos»', '"Generate a menu for an Italian restaurant with 5 items"'],
    '"Zmień cenę tartra wołowego na 45 zł"':
      ['«Cambia el precio del tartar de ternera a 12 €»', '"Change the beef tartare price to 12 €"'],

    /* ─── Landing: panel admina ─── */
    'Prosty panel na komputer — bez technicznej wiedzy.':
      ['Un panel sencillo para ordenador, sin conocimientos técnicos.', 'A simple desktop panel — no technical knowledge needed.'],
    '🖥 Tylko na komputerze': ['🖥 Solo en ordenador', '🖥 Desktop only'],
    'Przegląd menu': ['Vista general', 'Menu overview'],
    'Dodaj pozycję': ['Añadir plato', 'Add item'],
    '+ Dodaj pozycję': ['+ Añadir plato', '+ Add item'],
    'Wygląd': ['Apariencia', 'Appearance'],
    'Kolor tła': ['Color de fondo', 'Background colour'],
    'Kolor tła menu': ['Color de fondo de la carta', 'Menu background colour'],
    'Czcionka': ['Tipografía', 'Font'],
    'Subskrypcja': ['Suscripción', 'Subscription'],
    'Przegląd menu — Trattoria Roma': ['Vista general — Trattoria Roma', 'Menu overview — Trattoria Roma'],
    'Podgląd live': ['Vista previa en vivo', 'Live preview'],
    'niedostępne': ['no disponible', 'unavailable'],

    /* ─── Landing: cennik ─── */
    'Abonament': ['Suscripción', 'Subscription'],
    'Abonament miesięczny': ['Suscripción mensual', 'Monthly plan'],
    'zł / mies': ['zł / mes', 'zł / month'],
    'zł / rok': ['zł / año', 'zł / year'],
    'zł/mies.': ['zł/mes', 'zł/month'],
    'zł/rok': ['zł/año', 'zł/year'],
    '/mies.': ['/mes', '/month'],
    'Pełny dostęp do edytora AI. Bez automatycznego odnawiania.':
      ['Acceso completo al editor con IA. Sin renovación automática.',
       'Full access to the AI editor. No auto-renewal.'],
    'Edytor AI — nieograniczone menu': ['Editor con IA: cartas ilimitadas', 'AI editor — unlimited menus'],
    'Analiza zdjęć papierowego menu': ['Análisis de fotos de cartas en papel', 'Paper menu photo analysis'],
    'Link publiczny + kod QR': ['Enlace público + código QR', 'Public link + QR code'],
    'Eksport HTML gotowy do wklejenia': ['Exportación HTML lista para pegar', 'Ready-to-paste HTML export'],
    'Zacznij teraz': ['Empieza ahora', 'Start now'],
    'Najpopularniejszy': ['El más popular', 'Most popular'],
    'Abonament roczny — 2 mies. gratis': ['Suscripción anual — 2 meses gratis', 'Annual plan — 2 months free'],
    'Płacisz za 10 miesięcy, korzystasz cały rok. Bez automatycznego odnawiania.':
      ['Pagas 10 meses y lo usas todo el año. Sin renovación automática.',
       'Pay for 10 months, use it all year. No auto-renewal.'],
    'Wszystko z planu miesięcznego': ['Todo lo del plan mensual', 'Everything in the monthly plan'],
    '2 miesiące gratis — 70 zł taniej rocznie': ['2 meses gratis: 70 zł menos al año (≈ 16 €)', '2 months free — 70 zł less per year (≈ 16 €)'],
    'Własna domena restauracji': ['Dominio propio del restaurante', 'Your own restaurant domain'],
    'Panel admina bez limitu': ['Panel de administración sin límites', 'Unlimited admin panel'],
    'Priorytetowe wsparcie techniczne': ['Soporte técnico prioritario', 'Priority technical support'],
    'Wybierz plan roczny': ['Elegir plan anual', 'Choose annual plan'],

    /* ─── Landing: CTA + stopka ─── */
    'Pierwsza generacja menu gratis. Żadna karta kredytowa nie jest wymagana na start.':
      ['La primera carta generada es gratis. No necesitas tarjeta para empezar.',
       'Your first generated menu is free. No credit card needed to start.'],
    'Generuj pierwsze menu': ['Generar mi primera carta', 'Generate your first menu'],
    'Zamień papierowe menu na cyfrowe w 2 minuty — dzięki AI od Claude.':
      ['Convierte tu carta en papel en digital en 2 minutos, con la IA de Claude.',
       'Turn your paper menu into a digital one in 2 minutes — powered by Claude AI.'],
    'Płatności online obsługuje': ['Pagos online gestionados por', 'Online payments handled by'],
    'BLIK · karta płatnicza · szybki przelew': ['BLIK · tarjeta · transferencia rápida', 'BLIK · card · instant transfer'],
    '© 2025 Qreat. Wszystkie prawa zastrzeżone.':
      ['© 2025 Qreat. Todos los derechos reservados.', '© 2025 Qreat. All rights reserved.'],
    'OK': ['OK', 'OK'],

    /* ─── Edytor: logowanie / rejestracja ─── */
    'Edytor menu restauracji': ['Editor de cartas para restaurantes', 'Restaurant menu editor'],
    '7 dni za darmo · bez karty kredytowej': ['7 días gratis · sin tarjeta', '7 days free · no credit card'],
    'Zaloguj się przez email': ['Iniciar sesión con email', 'Sign in with email'],
    'Nie masz konta?': ['¿No tienes cuenta?', 'No account yet?'],
    'Masz już konto?': ['¿Ya tienes cuenta?', 'Already have an account?'],
    'lub email': ['o con email', 'or email'],
    '(min. 6 znaków)': ['(mín. 6 caracteres)', '(min. 6 characters)'],
    'Potwierdź hasło': ['Confirmar contraseña', 'Confirm password'],
    'Akceptuję': ['Acepto', 'I accept'],
    'oraz wyrażam zgodę na przetwarzanie moich danych.':
      ['y doy mi consentimiento para el tratamiento de mis datos.', 'and I consent to the processing of my data.'],
    'Utwórz konto': ['Crear cuenta', 'Create account'],
    'Tworzenie konta...': ['Creando cuenta...', 'Creating account...'],
    'Logowanie...': ['Iniciando sesión...', 'Signing in...'],
    'Po 7 dniach możesz wybrać plan ·': ['Después de 7 días puedes elegir un plan ·', 'After 7 days you can choose a plan ·'],
    'Zobacz cennik →': ['Ver precios →', 'See pricing →'],
    'Logując się lub rejestrując akceptujesz':
      ['Al iniciar sesión o registrarte aceptas', 'By signing in or registering you accept'],

    /* ─── Edytor: górny pasek ─── */
    'Admin': ['Admin', 'Admin'],
    'Wyloguj': ['Cerrar sesión', 'Log out'],
    'Zacznij od nowa': ['Empezar de nuevo', 'Start over'],
    'Okres próbny dobiegł końca': ['El periodo de prueba ha terminado', 'Your trial has ended'],
    'Twój abonament wygasł': ['Tu suscripción ha caducado', 'Your subscription has expired'],
    'Wybierz plan aby kontynuować korzystanie z edytora.':
      ['Elige un plan para seguir usando el editor.', 'Choose a plan to keep using the editor.'],
    'Wybierz plan →': ['Elegir plan →', 'Choose a plan →'],
    'Odnów →': ['Renovar →', 'Renew →'],
    'Odnów abonament, aby dalej korzystać z generatora i utrzymać menu online.':
      ['Renueva tu suscripción para seguir usando el generador y mantener tu carta online.',
       'Renew your subscription to keep using the generator and keep your menu online.'],
    'Wybierz plan aby kontynuować korzystanie z generatora i utrzymać menu online.':
      ['Elige un plan para seguir usando el generador y mantener tu carta online.',
       'Choose a plan to keep using the generator and keep your menu online.'],
    '7 dni za darmo': ['7 días gratis', '7 days free'],
    'Trial wygasł': ['Prueba caducada', 'Trial expired'],
    'Plan wygasł — odnów': ['Plan caducado — renovar', 'Plan expired — renew'],
    'Plan miesięczny': ['Plan mensual', 'Monthly plan'],

    /* ─── Edytor: kroki i formularz ─── */
    'Edytor menu': ['Editor de cartas', 'Menu editor'],
    'Wgraj zdjęcia': ['Sube las fotos', 'Upload photos'],
    'Generuj AI': ['Genera con IA', 'Generate with AI'],
    'Opublikuj online': ['Publica online', 'Publish online'],
    'Logo restauracji': ['Logo del restaurante', 'Restaurant logo'],
    'Pojawi się w nagłówku Twojego menu': ['Aparecerá en la cabecera de tu carta', 'It appears in your menu header'],
    'opcjonalne': ['opcional', 'optional'],
    'Dodaj logo': ['Añadir logo', 'Add a logo'],
    'PNG, JPG — najlepiej kwadratowe': ['PNG, JPG — mejor cuadrado', 'PNG, JPG — square works best'],
    'Zdjęcia papierowego menu': ['Fotos de la carta en papel', 'Photos of your paper menu'],
    'Dodaj jedno lub więcej — AI odczyta całą treść':
      ['Añade una o varias: la IA leerá todo el contenido', 'Add one or more — the AI reads all the content'],
    'Przeciągnij zdjęcia tutaj': ['Arrastra las fotos aquí', 'Drag your photos here'],
    'kliknij aby wybrać pliki': ['haz clic para elegir archivos', 'click to choose files'],
    'JPG, PNG, WEBP · max 10 MB każde': ['JPG, PNG, WEBP · máx. 10 MB cada una', 'JPG, PNG, WEBP · max 10 MB each'],
    '+ Dodaj więcej': ['+ Añadir más', '+ Add more'],
    '⚠ Brak klucza API.': ['⚠ Falta la clave de API.', '⚠ Missing API key.'],
    'Skonfiguruj': ['Configura', 'Configure'],
    'w Vercel → Settings → Environment Variables.':
      ['en Vercel → Settings → Environment Variables.', 'in Vercel → Settings → Environment Variables.'],
    'Generuj i dostosuj': ['Genera y personaliza', 'Generate and customise'],
    'Dodatkowe informacje': ['Información adicional', 'Additional details'],
    'np. Włoska restauracja, elegancki styl, ok. 25 pozycji, ceny w złotych...':
      ['p. ej. Restaurante italiano, estilo elegante, unos 25 platos, precios en złoty...',
       'e.g. Italian restaurant, elegant style, around 25 items, prices in złoty...'],
    'Styl menu': ['Estilo de la carta', 'Menu style'],
    'Klasyczny — elegancki i czytelny': ['Clásico — elegante y legible', 'Classic — elegant and readable'],
    'Nowoczesny — minimalistyczny': ['Moderno — minimalista', 'Modern — minimal'],
    'Rustykalny — ciepły i tradycyjny': ['Rústico — cálido y tradicional', 'Rustic — warm and traditional'],
    'Premium — luksusowy fine dining': ['Premium — alta cocina de lujo', 'Premium — luxury fine dining'],
    'Języki menu': ['Idiomas de la carta', 'Menu languages'],
    'Goście przełączą język flagą na pasku menu — nie pisz tego w opisie.':
      ['Tus clientes cambian de idioma desde la barra de la carta: no hace falta indicarlo en la descripción.',
       'Guests switch language from the menu bar — no need to mention it in the description.'],
    'Generuj menu AI': ['Generar carta con IA', 'Generate menu with AI'],
    'Dodaj zdjęcie lub opis aby wygenerować menu':
      ['Añade una foto o una descripción para generar la carta', 'Add a photo or a description to generate the menu'],
    'Wgraj zdjęcie — może być odręczne lub niewyraźne':
      ['Sube una foto: puede estar escrita a mano o borrosa', 'Upload a photo — handwritten or blurry is fine'],
    'AI odczytuje kategorie, dania, ceny i dobiera styl':
      ['La IA lee categorías, platos y precios, y elige el estilo', 'The AI reads categories, dishes and prices, and picks a style'],
    'Wybierz języki menu, edytuj resztę przez czat: „zmień cenę…", „dodaj danie…"':
      ['Elige los idiomas de la carta y edita el resto por chat: «cambia el precio…», «añade un plato…»',
       'Pick the menu languages and edit the rest by chat: "change the price…", "add a dish…"'],
    'Publikuj i udostępnij link lub kod QR gościom':
      ['Publica y comparte el enlace o el código QR con tus clientes', 'Publish and share the link or QR code with your guests'],

    /* ─── Edytor: generowanie ─── */
    'Magia w toku...': ['Creando la magia...', 'Working the magic...'],
    'To zwykle trwa kilkanaście sekund — nie zamykaj tej strony':
      ['Suele tardar unos segundos: no cierres esta página', 'This usually takes a few seconds — don\'t close this page'],
    'Analizuję Twoje zdjęcie': ['Analizando tu foto', 'Analysing your photo'],
    'Odczytuję dania, opisy i ceny': ['Leyendo platos, descripciones y precios', 'Reading dishes, descriptions and prices'],
    'Porządkuję menu w kategorie': ['Organizando la carta por categorías', 'Organising the menu into categories'],
    'Buduję cyfrową stronę menu': ['Construyendo la página digital', 'Building the digital menu page'],
    'Coś nie zadziałało': ['Algo ha fallado', 'Something went wrong'],
    'Nie udało się wygenerować menu. Spróbuj ponownie za chwilę — jeśli problem się powtarza, skontaktuj się z naszą obsługą klienta, a pomożemy Ci od ręki.':
      ['No hemos podido generar la carta. Inténtalo de nuevo en unos instantes; si el problema persiste, escríbenos y te ayudamos enseguida.',
       'We couldn\'t generate the menu. Try again in a moment — if it keeps happening, contact our support and we\'ll help right away.'],
    'Limit generowań osiągnięty': ['Límite de generaciones alcanzado', 'Generation limit reached'],
    'Skontaktuj się z obsługą': ['Contacta con soporte', 'Contact support'],
    'Osiągnięto dzienny limit generowań menu. Spróbuj ponownie jutro.':
      ['Has alcanzado el límite diario de generaciones. Inténtalo mañana.',
       'You\'ve reached the daily generation limit. Please try again tomorrow.'],
    'Dodaj zdjęcie menu lub wpisz opis.': ['Añade una foto de la carta o escribe una descripción.', 'Add a menu photo or type a description.'],

    /* ─── Edytor: podgląd i publikacja ─── */
    'PODGLĄD · iPhone 17 Pro': ['VISTA PREVIA · iPhone 17 Pro', 'PREVIEW · iPhone 17 Pro'],
    'Opublikuj menu online': ['Publicar carta online', 'Publish menu online'],
    'Opublikuj menu': ['Publicar carta', 'Publish menu'],
    'Publikuję...': ['Publicando...', 'Publishing...'],
    'Przygotowuję tłumaczenia...': ['Preparando las traducciones...', 'Preparing translations...'],
    'Pobierz HTML (standalone)': ['Descargar HTML (autónomo)', 'Download HTML (standalone)'],
    'Menu opublikowane! Link skopiuj poniżej.': ['¡Carta publicada! Copia el enlace abajo.', 'Menu published! Copy the link below.'],
    'Błąd publikacji.': ['Error al publicar.', 'Publishing failed.'],
    'Nie można skopiować.': ['No se ha podido copiar.', 'Couldn\'t copy.'],
    'Opublikowano, ale nie udało się przygotować języków:':
      ['Publicado, pero no se han podido preparar los idiomas:', 'Published, but these languages could not be prepared:'],
    '. Opublikuj ponownie, aby spróbować jeszcze raz.':
      ['. Vuelve a publicar para intentarlo de nuevo.', '. Publish again to retry.'],
    'Ta wersja językowa nie jest jeszcze gotowa.': ['Esta versión de idioma aún no está lista.', 'This language version isn\'t ready yet.'],
    'Przygotowuję wersję:': ['Preparando la versión:', 'Preparing version:'],
    'Nie udało się przygotować:': ['No se ha podido preparar:', 'Could not prepare:'],
    'Zbyt długo trwało tłumaczenie:': ['La traducción ha tardado demasiado:', 'Translation took too long:'],
    'Błąd tłumaczenia:': ['Error de traducción:', 'Translation error:'],

    /* ─── Edytor: zdjęcia dań ─── */
    '📷 Dodaj zdjęcia dań i kategorii': ['📷 Añade fotos de platos y categorías', '📷 Add dish and category photos'],
    'Kliknij, aby przypisać zdjęcia — pojawią się na menu':
      ['Haz clic para asignar fotos: aparecerán en la carta', 'Click to assign photos — they appear on the menu'],
    'Zdjęcie': ['Foto', 'Photo'],
    'Zdjęcie kategorii': ['Foto de la categoría', 'Category photo'],
    'Zdjęcie dodane!': ['¡Foto añadida!', 'Photo added!'],
    'Zdjęcie kategorii dodane!': ['¡Foto de categoría añadida!', 'Category photo added!'],
    'Plik za duży (max 15 MB).': ['Archivo demasiado grande (máx. 15 MB).', 'File too large (max 15 MB).'],
    'Plik za duży (max 20 MB).': ['Archivo demasiado grande (máx. 20 MB).', 'File too large (max 20 MB).'],
    'Błąd kompresji pliku.': ['Error al comprimir el archivo.', 'File compression failed.'],
    'Błąd kompresji zdjęcia.': ['Error al comprimir la foto.', 'Photo compression failed.'],
    'Logo usunięte.': ['Logo eliminado.', 'Logo removed.'],

    /* ─── Edytor: kod QR i domena ─── */
    'Kod QR Twojego menu': ['El código QR de tu carta', 'Your menu QR code'],
    'Wygeneruj kod QR — goście skanują telefonem i od razu widzą menu':
      ['Genera un código QR: tus clientes lo escanean con el móvil y ven la carta al instante',
       'Generate a QR code — guests scan it with their phone and see the menu instantly'],
    'Personalizuj i pobierz kod QR': ['Personaliza y descarga tu código QR', 'Customise and download your QR code'],
    'Dobierz kolor kodu, tło i dowolny rozmiar w osobnym widoku z podglądem na żywo.':
      ['Elige el color, el fondo y el tamaño en una vista aparte con previsualización en vivo.',
       'Pick the colour, background and size in a separate view with a live preview.'],
    'Zobacz kod QR': ['Ver código QR', 'View QR code'],
    '🔄 Zresetuj adres i kod QR': ['🔄 Restablecer dirección y código QR', '🔄 Reset address and QR code'],
    'Kody QR z druku 3D': ['Códigos QR impresos en 3D', '3D-printed QR codes'],
    'Trwałe, drukowane 3D tabliczki z Twoim kodem QR — na każdy stolik. Zostaw dane, a skontaktujemy się z wyceną.':
      ['Placas duraderas impresas en 3D con tu código QR, una para cada mesa. Déjanos tus datos y te enviamos un presupuesto.',
       'Durable 3D-printed plaques with your QR code, one for every table. Leave your details and we\'ll send a quote.'],
    'Druk 3D': ['Impresión 3D', '3D printing'],
    'Twój kod QR': ['Tu código QR', 'Your QR code'],
    'Na każdy stolik': ['Para cada mesa', 'For every table'],
    'Przejdź dalej': ['Continuar', 'Continue'],
    'Własna domena': ['Dominio propio', 'Custom domain'],
    'Wyświetlaj menu pod własną domeną zamiast długiego linku Qreat.':
      ['Muestra tu carta en tu propio dominio en lugar del enlace largo de Qreat.',
       'Serve your menu on your own domain instead of the long Qreat link.'],
    'Najpierw opublikuj menu, potem ustaw własną domenę.':
      ['Publica primero la carta y luego configura tu dominio.', 'Publish the menu first, then set up your domain.'],
    'Zmień domenę': ['Cambiar dominio', 'Change domain'],
    'Zapisz domenę': ['Guardar dominio', 'Save domain'],
    'Usuń domenę': ['Eliminar dominio', 'Remove domain'],
    'Domena usunięta': ['Dominio eliminado', 'Domain removed'],
    'Wartość:': ['Valor:', 'Value:'],
    'Po ustawieniu DNS wyślij nam email na': ['Cuando configures el DNS, escríbenos a', 'Once DNS is set, email us at'],
    '— aktywujemy domenę w ciągu 24h.': ['— activaremos el dominio en 24 h.', '— we\'ll activate the domain within 24 h.'],
    'Najpierw opublikuj menu.': ['Publica primero la carta.', 'Publish the menu first.'],
    'Nie udało się zresetować adresu.': ['No se ha podido restablecer la dirección.', 'Could not reset the address.'],

    /* ─── Edytor: pomoc / kontakt ─── */
    'Masz pytanie lub potrzebujesz pomocy?': ['¿Tienes alguna duda o necesitas ayuda?', 'Got a question or need help?'],
    'Nasza obsługa klienta pomoże Ci z konfiguracją menu, własną domeną, płatnościami i wszystkim innym.':
      ['Nuestro equipo te ayuda con la configuración de la carta, el dominio propio, los pagos y todo lo demás.',
       'Our support team helps with menu setup, custom domains, payments and everything else.'],
    'Przejdź do kontaktu': ['Ir a contacto', 'Go to contact'],
    'Pytania?': ['¿Preguntas?', 'Questions?'],
    'Skontaktuj się z nami': ['Escríbenos', 'Get in touch'],

    /* ─── Edytor: czat ─── */
    'Napisz co zmienić w menu…': ['Escribe qué quieres cambiar en la carta…', 'Type what you\'d like to change…'],
    'Napisz zwykłym językiem, np. „zmień tło na granatowy", „usuń colę", „cena margherity 32 zł"':
      ['Escribe con normalidad: «cambia el fondo a azul marino», «quita la cola», «margarita a 9 €»',
       'Just write normally: "change the background to navy", "remove the cola", "margherita 9 €"'],
    'Wystąpił błąd. Spróbuj ponownie.': ['Se ha producido un error. Inténtalo de nuevo.', 'Something went wrong. Please try again.'],
    'Doprecyzuj proszę, co dokładnie zmienić.': ['¿Puedes concretar qué quieres cambiar?', 'Could you be more specific about the change?'],
    'Zmianę widzisz w podglądzie — kliknij „Opublikuj menu online", aby trafiła na Twoją stronę.':
      ['Ves el cambio en la vista previa: pulsa «Publicar carta online» para aplicarlo a tu página.',
       'You can see the change in the preview — click "Publish menu online" to push it live.'],
    'Uwaga — część się nie udała:': ['Atención: parte no se ha podido aplicar:', 'Heads up — part of it failed:'],
    'Anulowano — nic nie zmieniłem.': ['Cancelado, no he cambiado nada.', 'Cancelled — nothing was changed.'],

    /* ─── Edytor: komunikaty auth / konto ─── */
    'Wpisz adres email i hasło.': ['Introduce tu email y contraseña.', 'Enter your email and password.'],
    'Hasło musi mieć minimum 6 znaków.': ['La contraseña debe tener al menos 6 caracteres.', 'Password must be at least 6 characters.'],
    'Hasła nie są identyczne.': ['Las contraseñas no coinciden.', 'Passwords don\'t match.'],
    'Zaakceptuj regulamin i politykę prywatności, aby założyć konto.':
      ['Acepta los términos y la política de privacidad para crear una cuenta.',
       'Accept the terms and privacy policy to create an account.'],
    'Błąd rejestracji. Spróbuj ponownie.': ['Error al registrarse. Inténtalo de nuevo.', 'Registration failed. Please try again.'],
    'Błąd połączenia. Sprawdź internet i spróbuj ponownie.':
      ['Error de conexión. Comprueba tu internet e inténtalo de nuevo.', 'Connection error. Check your internet and try again.'],
    'Nieprawidłowy email lub hasło.': ['Email o contraseña incorrectos.', 'Incorrect email or password.'],
    'Błąd logowania. Spróbuj ponownie.': ['Error al iniciar sesión. Inténtalo de nuevo.', 'Sign-in failed. Please try again.'],
    'Logowanie przez Google nie jest skonfigurowane. Skontaktuj się z administratorem.':
      ['El inicio de sesión con Google no está configurado. Contacta con el administrador.',
       'Google sign-in isn\'t configured. Please contact the administrator.'],
    'Błąd ładowania logowania Google. Odśwież stronę.':
      ['Error al cargar el inicio de sesión con Google. Recarga la página.', 'Google sign-in failed to load. Refresh the page.'],
    'Sesja wygasła — zaloguj się ponownie.': ['Tu sesión ha caducado: vuelve a iniciar sesión.', 'Session expired — please sign in again.'],
    'Brak uprawnień.': ['Sin permisos.', 'Not authorised.'],
    'Błąd.': ['Error.', 'Error.'],
    'Błąd połączenia.': ['Error de conexión.', 'Connection error.'],
    'Błąd zapisu.': ['Error al guardar.', 'Save failed.'],
    'Menu załadowane z konta': ['Carta cargada desde tu cuenta', 'Menu loaded from your account'],
    'Menu wyczyszczone — link i kod QR zostają te same.':
      ['Carta borrada: el enlace y el código QR no cambian.', 'Menu cleared — your link and QR code stay the same.'],
    'Plan aktywny! Możesz teraz korzystać z edytora.':
      ['¡Plan activo! Ya puedes usar el editor.', 'Plan active! You can now use the editor.'],
    'Plan aktywowany — odśwież stronę aby zobaczyć status.':
      ['Plan activado: recarga la página para ver el estado.', 'Plan activated — refresh the page to see the status.'],
    'Płatność zakończona! Aktywujemy Twój plan…': ['¡Pago completado! Estamos activando tu plan…', 'Payment complete! Activating your plan…'],
    'Zamówienie opłacone! Wysyłka w 5–7 dni roboczych.':
      ['¡Pedido pagado! Envío en 5–7 días laborables.', 'Order paid! Shipping in 5–7 business days.'],
    'Płatność przerwana — zamówienie czeka na opłacenie.':
      ['Pago interrumpido: el pedido está pendiente de pago.', 'Payment interrupted — the order is awaiting payment.'],
    'Błąd płatności. Spróbuj ponownie.': ['Error en el pago. Inténtalo de nuevo.', 'Payment failed. Please try again.'],
    'Przekierowuję…': ['Redirigiendo…', 'Redirecting…'],
    'Zaznacz akceptację regulaminu i polityki prywatności.':
      ['Marca la aceptación de los términos y la política de privacidad.', 'Tick to accept the terms and privacy policy.'],

    /* ─── Edytor: bramka zgód ─── */
    'Zanim zaczniesz tworzyć menu': ['Antes de crear tu carta', 'Before you build your menu'],
    'Teraz': ['Ahora', 'Now'],
    '0 zł': ['0 €', '0 €'],
    'Potem': ['Después', 'Then'],
    '7 dni próbnych od pierwszego wygenerowania menu. Bez karty.':
      ['7 días de prueba desde la primera carta generada. Sin tarjeta.',
       '7-day trial from your first generated menu. No card.'],
    'lub 349,99 zł/rok. Ceny brutto (zawierają VAT).':
      ['o 349,99 zł/año (≈ 81,60 €). Precios con impuestos incluidos. El cobro se realiza en eslotis polacos (PLN).',
       'or 349,99 zł/year (≈ 81,60 €). Prices include VAT. Payment is taken in Polish złoty (PLN).'],
    'Akceptuję — przejdź do generatora': ['Acepto — ir al generador', 'I accept — go to the generator'],
    'Nie akceptuję — wyloguj mnie': ['No acepto — cerrar sesión', 'I don\'t accept — log me out'],
    'Zaznacz wszystkie trzy zgody, aby kontynuować.':
      ['Marca las tres casillas para continuar.', 'Tick all three boxes to continue.'],
    'Zapisuję zgodę…': ['Guardando tu consentimiento…', 'Saving your consent…'],
    'Dziękujemy — generator odblokowany.': ['Gracias, el generador está desbloqueado.', 'Thanks — the generator is unlocked.'],
    'Bez akceptacji regulaminu nie możemy udostępnić generatora.':
      ['Sin aceptar los términos no podemos darte acceso al generador.',
       'Without accepting the terms we can\'t give you access to the generator.'],
    'Usługodawca:': ['Prestador del servicio:', 'Service provider:'],
    'Miesięcznie': ['Mensual', 'Monthly'],
    'Rocznie · 2 mies. gratis': ['Anual · 2 meses gratis', 'Annual · 2 months free'],
    'Pełny dostęp do edytora, wielojęzyczność, aktualizacje. Bez automatycznego odnawiania.':
      ['Acceso completo al editor, multiidioma y actualizaciones. Sin renovación automática.',
       'Full editor access, multi-language and updates. No auto-renewal.'],
    'To samo co miesięczny, ale taniej — płacisz za 10 miesięcy, korzystasz cały rok. Bez automatycznego odnawiania.':
      ['Lo mismo que el mensual pero más barato: pagas 10 meses y lo usas todo el año. Sin renovación automática.',
       'Same as monthly but cheaper — pay for 10 months, use it all year. No auto-renewal.'],
    'Wybierz →': ['Elegir →', 'Choose →'],
    'Twój poprzedni plan': ['Tu plan anterior', 'Your previous plan'],
    'Zamawiam z obowiązkiem zapłaty i akceptuję':
      ['Realizo el pedido con obligación de pago y acepto', 'I place the order with an obligation to pay and accept'],
    'Płatność obsługuje Tpay — BLIK, karta, przelewy. Faktura VAT na życzenie.':
      ['Pagos gestionados por Tpay: BLIK, tarjeta y transferencias. Factura con IVA a petición.',
       'Payments handled by Tpay — BLIK, card, transfers. VAT invoice on request.'],

    /* ─── Panel admina (właściciel) ─── */
    'Wejścia gości': ['Visitas de clientes', 'Guest visits'],
    'Wejścia (7 dni)': ['Visitas (7 días)', 'Visits (7 days)'],
    'Unikalne urządzenia': ['Dispositivos únicos', 'Unique devices'],
    'Unikalne urządzenia gości': ['Dispositivos únicos de clientes', 'Unique guest devices'],
    'Wejścia z linku': ['Visitas desde enlace', 'Visits from link'],
    'Wejścia z linku, wyszukiwarki, social': ['Visitas desde enlace, buscador o redes', 'Visits from link, search or social'],
    'Skany kodu QR (wejścia bez referrera)': ['Escaneos de QR (visitas sin referente)', 'QR scans (visits without referrer)'],
    'Pobrania kodu QR przez właściciela': ['Descargas del QR por el propietario', 'QR downloads by the owner'],
    'Pokaż wykres dzienny': ['Ver gráfico diario', 'Show daily chart'],
    'Wejścia do menu — ostatnie 14 dni (wszystkie konta)':
      ['Visitas a la carta — últimos 14 días (todas las cuentas)', 'Menu visits — last 14 days (all accounts)'],
    'Brak użytkowników.': ['Sin usuarios.', 'No users.'],
    'Brak zapytań.': ['Sin consultas.', 'No enquiries.'],
    'Brak zamówień.': ['Sin pedidos.', 'No orders.'],
    'Brak opublikowanych menu.': ['Sin cartas publicadas.', 'No published menus.'],
    '✅ Brak alertów.': ['✅ Sin alertas.', '✅ No alerts.'],
    'nie generował': ['sin generaciones', 'never generated'],
    'Logowań': ['Inicios de sesión', 'Logins'],
    'Wejścia 7d/total': ['Visitas 7d/total', 'Visits 7d/total'],
    'Urządzeń': ['Dispositivos', 'Devices'],
    'Pobrań QR': ['Descargas QR', 'QR downloads'],
    'Zapytanie ogólne': ['Consulta general', 'General enquiry'],
    'Obsłużone': ['Atendido', 'Handled'],
    '✓ Oznacz jako obsłużone': ['✓ Marcar como atendido', '✓ Mark as handled'],
    'Oznaczono jako obsłużone.': ['Marcado como atendido.', 'Marked as handled.'],
    'Przywrócono jako nowe.': ['Restaurado como nuevo.', 'Restored as new.'],
    'Czeka na płatność': ['Pendiente de pago', 'Awaiting payment'],
    'Opłacone': ['Pagado', 'Paid'],
    'Wysłane': ['Enviado', 'Shipped'],
    '📦 Zamówienia stojaków': ['📦 Pedidos de soportes', '📦 Stand orders'],
    'Błąd zmiany statusu.': ['Error al cambiar el estado.', 'Status change failed.'],
    'Skanuję wszystkie menu…': ['Escaneando todas las cartas…', 'Scanning all menus…'],
    'Błąd audytu.': ['Error de auditoría.', 'Audit failed.'],
    '🔗 Audyt stałych linków (sprawdź duplikaty slugów)':
      ['🔗 Auditoría de enlaces permanentes (comprueba slugs duplicados)',
       '🔗 Permanent link audit (check for duplicate slugs)'],
    'Ustaw jako stały link': ['Fijar como enlace permanente', 'Set as permanent link'],
    'Nie udało się przywrócić linku.': ['No se ha podido restaurar el enlace.', 'Could not restore the link.'],

    /* ─── Nazwy języków menu (title na flagach + komunikaty tłumaczeń) ─── */
    'Angielski': ['Inglés', 'English'],
    'Niemiecki': ['Alemán', 'German'],
    'Francuski': ['Francés', 'French'],
    'Włoski': ['Italiano', 'Italian'],
    'Hiszpański': ['Español', 'Spanish'],
    'Rosyjski': ['Ruso', 'Russian'],
    'angielski': ['inglés', 'English'],
    'niemiecki': ['alemán', 'German'],
    'francuski': ['francés', 'French'],
    'włoski': ['italiano', 'Italian'],
    'hiszpański': ['español', 'Spanish'],
    'rosyjski': ['ruso', 'Russian'],

    /* ─── Generator: status konta i planu ─── */
    'Plan roczny': ['Plan anual', 'Annual plan'],
    'Aktywny plan': ['Plan activo', 'Active plan'],
    'Lifetime': ['Lifetime', 'Lifetime'],
    'Kup teraz →': ['Comprar ahora →', 'Buy now →'],

    /* ─── Generator: ekran generowania i komunikaty ─── */
    'Tworzymy Twoje cyfrowe menu': ['Estamos creando tu carta digital', 'Building your digital menu'],
    'Link skopiowany!': ['¡Enlace copiado!', 'Link copied!'],
    'Pobrano standalone HTML menu.': ['HTML de la carta descargado.', 'Standalone menu HTML downloaded.'],
    'Wybierz plik graficzny.': ['Elige un archivo de imagen.', 'Choose an image file.'],
    'Logo dodane!': ['¡Logo añadido!', 'Logo added!'],
    'Logo dodane': ['Logo añadido', 'Logo added'],
    'Gotowe.': ['Listo.', 'Done.'],
    'Anulowano.': ['Cancelado.', 'Cancelled.'],
    'Brak menu do edycji.': ['No hay ninguna carta que editar.', 'No menu to edit.'],
    'Nowa pozycja': ['Plato nuevo', 'New item'],
    'Inne': ['Otros', 'Other'],
    'Edytuj menu przez czat': ['Edita la carta por chat', 'Edit the menu by chat'],
    'Twój stały link i kod QR NIE zmienią się — po ponownej publikacji zaktualizują się pod tym samym adresem, więc wydrukowane stojaki dalej działają.':
      ['Tu enlace permanente y tu código QR NO cambiarán: al volver a publicar se actualizarán en la misma dirección, así que los soportes impresos seguirán funcionando.',
       'Your permanent link and QR code will NOT change — republishing updates them at the same address, so printed stands keep working.'],

    /* ─── Generator: własna domena ─── */
    'Najpierw opublikuj menu': ['Publica primero la carta', 'Publish the menu first'],
    'Nowy adres aktywny! Stary link przekierowuje na nowy.':
      ['¡Nueva dirección activa! El enlace antiguo redirige a la nueva.',
       'New address is live! The old link redirects to it.'],
    'Domena zapisana!': ['¡Dominio guardado!', 'Domain saved!'],
    'opublikuj menu': ['publica la carta', 'publish the menu'],
    'Konfiguracja DNS u dostawcy domeny': ['Configuración DNS en tu proveedor de dominio', 'DNS setup at your domain provider'],
    'Adres domeny': ['Dirección del dominio', 'Domain address'],
    'Typ:': ['Tipo:', 'Type:'],
    'Nazwa:': ['Nombre:', 'Name:'],
    'np. menu.moja-restauracja.pl': ['p. ej. menu.mi-restaurante.es', 'e.g. menu.my-restaurant.com'],

    /* ─── Panel admina: etykiety tabel ─── */
    'Konta': ['Cuentas', 'Accounts'],
    'Aktywne (7 dni)': ['Activas (7 días)', 'Active (7 days)'],
    'Generacje': ['Generaciones', 'Generations'],
    'Generacji': ['Generaciones', 'Generations'],
    '📷 Skany QR': ['📷 Escaneos QR', '📷 QR scans'],
    '⚠️ Alerty': ['⚠️ Alertas', '⚠️ Alerts'],
    'Logowanie': ['Inicio de sesión', 'Login'],
    'Ostatni login': ['Último acceso', 'Last login'],
    'Skan QR / link': ['Escaneo QR / enlace', 'QR scan / link'],
    'Status / trial': ['Estado / prueba', 'Status / trial'],
    'Problem': ['Problema', 'Issue'],
    'Status:': ['Estado:', 'Status:'],
    'Zapytanie': ['Consulta', 'Enquiry'],
    'Nowe': ['Nuevo', 'New'],
    '↩ Oznacz jako nowe': ['↩ Marcar como nuevo', '↩ Mark as new'],
    'W druku': ['En impresión', 'In production'],
    'Anulowane': ['Cancelado', 'Cancelled'],
    '✉️ Zapytania z formularza': ['✉️ Consultas del formulario', '✉️ Form enquiries'],
    'brak opublikowanego menu': ['sin carta publicada', 'no published menu'],
    '· kod:': ['· código:', '· code:'],
    '· płytka:': ['· placa:', '· plaque:'],

    /* ─── Strona kodu QR (/kody-qr) ─── */
    'Wróć do edytora': ['Volver al editor', 'Back to the editor'],
    '← Wróć do edytora': ['← Volver al editor', '← Back to the editor'],
    'Najpierw opublikuj menu': ['Publica primero tu carta', 'Publish your menu first'],
    'Aby wygenerować kod QR, opublikuj swoje menu w edytorze — dostaniesz stały adres, który zakodujemy w kodzie QR.':
      ['Para generar el código QR, publica tu carta en el editor: recibirás una dirección permanente que codificaremos en el QR.',
       'To generate a QR code, publish your menu in the editor — you\'ll get a permanent address that we encode in the QR.'],
    'Przejdź do edytora →': ['Ir al editor →', 'Go to the editor →'],
    'Dobierz kolory i rozmiar — podgląd po lewej odświeża się na żywo. Gdy będzie gotowy, pobierz plik PNG lub wydrukuj.':
      ['Elige colores y tamaño: la vista previa de la izquierda se actualiza en vivo. Cuando esté listo, descarga el PNG o imprímelo.',
       'Pick colours and size — the preview on the left updates live. When it looks right, download the PNG or print it.'],
    '⚠️ Zbyt mały kontrast między kolorem kodu a tłem — kod może się nie zeskanować. Wybierz ciemniejszy kod na jaśniejszym tle.':
      ['⚠️ Contraste insuficiente entre el código y el fondo: puede que no se escanee. Elige un código más oscuro sobre un fondo más claro.',
       '⚠️ Not enough contrast between the code and the background — it may not scan. Choose a darker code on a lighter background.'],
    'Kolor kodu': ['Color del código', 'Code colour'],
    'Szerokość (px)': ['Ancho (px)', 'Width (px)'],
    'Wysokość (px)': ['Alto (px)', 'Height (px)'],
    'Kwadrat (ta sama szerokość i wysokość)': ['Cuadrado (mismo ancho y alto)', 'Square (same width and height)'],
    'Kwadrat 600': ['Cuadrado 600', 'Square 600'],
    'Kwadrat 1000': ['Cuadrado 1000', 'Square 1000'],
    'Karta 2:3': ['Vertical 2:3', 'Portrait 2:3'],
    'Poziom 3:2': ['Horizontal 3:2', 'Landscape 3:2'],
    'Sam kod QR pozostaje kwadratowy i wyśrodkowany — reszta pola wypełnia się kolorem tła, więc kod nigdy się nie zniekształca.':
      ['El código QR se mantiene cuadrado y centrado; el resto del área se rellena con el color de fondo, así el código nunca se deforma.',
       'The QR code itself stays square and centred — the rest of the area fills with the background colour, so the code never distorts.'],
    '↓ Pobierz kod QR (PNG)': ['↓ Descargar código QR (PNG)', '↓ Download QR code (PNG)'],
    'Drukuj': ['Imprimir', 'Print'],

    /* ─── Strona kontaktu (/kontakt) ─── */
    'Pomoc i kontakt': ['Ayuda y contacto', 'Help & contact'],
    'Jesteśmy tu, żeby pomóc': ['Estamos aquí para ayudarte', 'We\'re here to help'],
    'Odpiszemy w ciągu 24 godzin roboczych. Pytania o płatności, domenę, generowanie — wszystko nas interesuje.':
      ['Respondemos en 24 horas laborables. Dudas sobre pagos, dominios o generación: cuéntanos lo que sea.',
       'We reply within 24 business hours. Questions about payments, domains, generation — anything at all.'],
    'Napisz do nas': ['Escríbenos', 'Write to us'],
    'Odpowiadamy': ['Respondemos', 'We reply'],
    'w ciągu 24h': ['en 24 h', 'within 24 h'],
    'w dni robocze.': ['en días laborables.', 'on business days.'],
    'Pilne sprawy — napisz "PILNE" w temacie.':
      ['Para asuntos urgentes, escribe «URGENTE» en el asunto.', 'For urgent matters, put "URGENT" in the subject.'],
    'Godziny wsparcia': ['Horario de atención', 'Support hours'],
    'Poniedziałek – Piątek': ['Lunes – Viernes', 'Monday – Friday'],
    'Sobota': ['Sábado', 'Saturday'],
    'Niedziela': ['Domingo', 'Sunday'],
    'Zamknięte': ['Cerrado', 'Closed'],
    'Dane sprzedawcy': ['Datos del vendedor', 'Seller details'],
    '— BLIK, karta, szybki przelew.': ['— BLIK, tarjeta, transferencia rápida.', '— BLIK, card, instant transfer.'],
    'Reklamacje i odstąpienie od umowy:': ['Reclamaciones y desistimiento:', 'Complaints and withdrawal:'],
    'Wyślij wiadomość': ['Enviar mensaje', 'Send message'],
    'Wyślij wiadomość →': ['Enviar mensaje →', 'Send message →'],
    'Wypełnij formularz, a my odpiszemy na Twój email.':
      ['Rellena el formulario y te responderemos por email.', 'Fill in the form and we\'ll reply by email.'],
    'Otworzyliśmy Twój program pocztowy': ['Hemos abierto tu programa de correo', 'We\'ve opened your email client'],
    'Wiadomość czeka gotowa do wysłania — kliknij „Wyślij" w programie pocztowym.':
      ['El mensaje está listo para enviarse: pulsa «Enviar» en tu programa de correo.',
       'The message is ready to send — click "Send" in your email client.'],
    'Jeśli nic się nie otworzyło, napisz bezpośrednio na':
      ['Si no se ha abierto nada, escríbenos directamente a', 'If nothing opened, email us directly at'],
    'Imię i nazwa restauracji': ['Nombre y nombre del restaurante', 'Your name and restaurant name'],
    'Adres email': ['Dirección de email', 'Email address'],
    'Temat': ['Asunto', 'Subject'],
    'Problem z generowaniem menu': ['Problema al generar la carta', 'Problem generating the menu'],
    'Płatności i abonament': ['Pagos y suscripción', 'Payments and subscription'],
    'Problemy z kontem': ['Problemas con la cuenta', 'Account problems'],
    'Inne pytanie': ['Otra consulta', 'Another question'],
    'Wiadomość': ['Mensaje', 'Message'],
    'Najczęstsze pytania': ['Preguntas frecuentes', 'Frequently asked questions'],
    'Jak działa 7-dniowy trial?': ['¿Cómo funciona la prueba de 7 días?', 'How does the 7-day trial work?'],
    '7 dni liczą się od momentu pierwszego wygenerowania menu. Nie potrzebujesz karty kredytowej. Po triale menu będzie niedostępne dopóki nie wybierzesz planu.':
      ['Los 7 días empiezan a contar desde la primera carta que generas. No necesitas tarjeta. Al terminar la prueba, la carta deja de estar disponible hasta que elijas un plan.',
       'The 7 days start from your first generated menu. No credit card needed. After the trial the menu is unavailable until you choose a plan.'],
    'Czym różni się plan miesięczny od rocznego?': ['¿En qué se diferencian el plan mensual y el anual?', 'What\'s the difference between monthly and annual?'],
    'Oba dają pełny dostęp do edytora i aktualizacji. Plan miesięczny to 34,99 zł/mies., a roczny — 349,99 zł/rok, czyli dwa miesiące gratis (ok. 70 zł taniej). Oba możesz anulować w każdej chwili.':
      ['Ambos dan acceso completo al editor y a las actualizaciones. El mensual cuesta 34,99 zł/mes (≈ 8,15 €) y el anual 349,99 zł/año (≈ 81,60 €), es decir, dos meses gratis (unos 70 zł menos). El cobro se realiza en eslotis polacos (PLN). Puedes cancelar cualquiera cuando quieras.',
       'Both give full access to the editor and updates. Monthly is 34,99 zł/month (≈ 8,15 €), annual is 349,99 zł/year (≈ 81,60 €) — two months free (about 70 zł less). Payment is taken in Polish złoty (PLN). You can cancel either at any time.'],
    'Jak ustawić własną domenę?': ['¿Cómo configuro mi propio dominio?', 'How do I set up my own domain?'],
    'Po publikacji menu, w panelu bocznym edytora znajdziesz sekcję "Własna domena". Wpisz adres (np. menu.restauracja.pl), skonfiguruj CNAME i napisz do nas — aktywujemy w 24h.':
      ['Una vez publicada la carta, en el panel lateral del editor verás la sección «Dominio propio». Introduce la dirección (p. ej. menu.restaurante.es), configura el CNAME y escríbenos: lo activamos en 24 h.',
       'Once your menu is published, the editor sidebar has a "Custom domain" section. Enter the address (e.g. menu.restaurant.com), set up the CNAME and email us — we activate it within 24 h.'],
    'Mogę anulować abonament?': ['¿Puedo cancelar la suscripción?', 'Can I cancel my subscription?'],
    'Tak, w każdej chwili. Po anulowaniu menu pozostaje aktywne do końca opłaconego okresu. Napisz do nas na hubiwas@gmail.com, a anulujemy Twój abonament — pozostaje aktywny do końca opłaconego okresu.':
      ['Sí, cuando quieras. Tras cancelar, la carta sigue activa hasta el final del periodo pagado. Escríbenos a hubiwas@gmail.com y cancelamos tu suscripción: seguirá activa hasta el final del periodo pagado.',
       'Yes, at any time. After cancelling, your menu stays live until the end of the paid period. Email us at hubiwas@gmail.com and we\'ll cancel your subscription — it stays active until the paid period ends.'],
    'Jakie formaty zdjęć akceptuje AI?': ['¿Qué formatos de foto acepta la IA?', 'Which photo formats does the AI accept?'],
    'JPG, PNG, WEBP — do 10 MB na zdjęcie. Możesz dodać wiele stron menu naraz. Działają odręczne menu i kartki. Im wyraźniejsze zdjęcie, tym lepszy wynik.':
      ['JPG, PNG, WEBP, hasta 10 MB por foto. Puedes subir varias páginas a la vez. Funciona con cartas escritas a mano. Cuanto más nítida sea la foto, mejor el resultado.',
       'JPG, PNG, WEBP — up to 10 MB each. You can add several menu pages at once. Handwritten menus work too. The sharper the photo, the better the result.'],
    'Czy mogę edytować menu po generacji?': ['¿Puedo editar la carta después de generarla?', 'Can I edit the menu after generating it?'],
    'Tak. Po wygenerowaniu możesz edytować menu przez czat AI ("zmień cenę zupy na 18 zł", "dodaj język angielski") lub dodać zdjęcia dań bezpośrednio w edytorze.':
      ['Sí. Después de generarla puedes editarla desde el chat con IA («cambia el precio de la sopa a 5 €», «añade el idioma inglés») o añadir fotos de los platos directamente en el editor.',
       'Yes. After generating you can edit it through the AI chat ("change the soup price to 5 €", "add English") or add dish photos directly in the editor.'],
    '© 2025 Qreat · menu cyfrowe dla restauracji ·':
      ['© 2025 Qreat · cartas digitales para restaurantes ·', '© 2025 Qreat · digital menus for restaurants ·'],
    'np. Anna Kowalska — Pizzeria Roma': ['p. ej. Ana García — Pizzeria Roma', 'e.g. Anna Smith — Pizzeria Roma'],
    'Opisz swój problem lub pytanie...': ['Describe tu problema o tu consulta...', 'Describe your problem or question...'],

    /* ─── Strona zamówienia stojaków (/zamow-stojaki) ─── */
    'Napisz, czego potrzebujesz': ['Cuéntanos qué necesitas', 'Tell us what you need'],
    'Trwałe, drukowane 3D tabliczki z Twoim kodem QR — gość skanuje i widzi menu. Opisz, co Cię interesuje, a odpiszemy z wyceną i szczegółami.':
      ['Placas duraderas impresas en 3D con tu código QR: el cliente lo escanea y ve la carta. Cuéntanos qué te interesa y te enviamos presupuesto y detalles.',
       'Durable 3D-printed plaques with your QR code — guests scan and see the menu. Tell us what you need and we\'ll reply with a quote and details.'],
    'Wiadomość wysłana': ['Mensaje enviado', 'Message sent'],
    'Mamy Twoje zapytanie i odpiszemy na podany adres e-mail, zwykle w ciągu 24 godzin w dni robocze.':
      ['Hemos recibido tu consulta y te responderemos al email indicado, normalmente en 24 horas laborables.',
       'We\'ve got your enquiry and will reply to the email you gave, usually within 24 business hours.'],
    'Telefon': ['Teléfono', 'Phone'],
    '(opcjonalnie)': ['(opcional)', '(optional)'],
    'Odpowiadamy zwykle w ciągu 24 godzin w dni robocze.':
      ['Solemos responder en 24 horas laborables.', 'We usually reply within 24 business hours.'],
    'Wolisz e-mail?': ['¿Prefieres el email?', 'Prefer email?'],
    'Jan Kowalski — Pizzeria Roma': ['Juan García — Pizzeria Roma', 'John Smith — Pizzeria Roma'],
    'Napisz, czego potrzebujesz — np. ile tabliczek, jaki rozmiar i kolor, czy ma być logo restauracji, na kiedy…':
      ['Cuéntanos qué necesitas: cuántas placas, qué tamaño y color, si quieres el logo del restaurante, para cuándo…',
       'Tell us what you need — how many plaques, what size and colour, whether you want the restaurant logo, and by when…'],

    /* ─── Tytuły stron ─── */
    'Kod QR menu — Qreat': ['Código QR de la carta — Qreat', 'Menu QR code — Qreat'],
    'Kontakt — Qreat': ['Contacto — Qreat', 'Contact — Qreat'],
    'Kody QR z druku 3D — kontakt — Qreat':
      ['Códigos QR impresos en 3D — contacto — Qreat', '3D-printed QR codes — contact — Qreat'],
    'Qreat — Cyfrowe menu generowane przez AI':
      ['Qreat — Cartas digitales generadas con IA', 'Qreat — Digital menus generated by AI'],
    'Edytor — Qreat': ['Editor — Qreat', 'Editor — Qreat']
  };

  /* ── Bloki z własnym szykiem zdania (cały innerHTML) ──────────────────── */
  var H = {
    'hero.h1': [
      'Convierte tu carta<br>de papel en <em style="color:var(--sage);font-style:italic;">digital</em><br><span style="color:rgba(27,42,74,0.45);">en 2 minutos.</span>',
      'Turn your paper<br>menu <em style="color:var(--sage);font-style:italic;">digital</em><br><span style="color:rgba(27,42,74,0.45);">in 2 minutes.</span>'
    ],
    'steps.h2': [
      'Tres pasos hasta<br>tu carta <em style="color:var(--sage);">digital</em>',
      'Three steps to your<br><em style="color:var(--sage);">digital</em> menu'
    ],
    'showcase.h2': [
      'Así ven tus clientes<br>la <em style="color:var(--sage);">carta digital</em>',
      'This is how your guests<br>see the <em style="color:var(--sage);">digital menu</em>'
    ],
    'chat.h2': [
      'Un chat sencillo,<br>un resultado <em style="color:var(--sage);">profesional</em>',
      'A simple chat,<br>a <em style="color:var(--sage);">professional</em> result'
    ],
    'admin.h2': [
      'Gestiona tu carta<br><em style="color:var(--sage);">como un profesional</em>',
      'Manage your menu<br><em style="color:var(--sage);">like a pro</em>'
    ],
    'pricing.h2': [
      'Precios claros,<br>sin costes <em style="color:var(--gold);">ocultos</em>',
      'Simple pricing,<br>no hidden <em style="color:var(--gold);">fees</em>'
    ],
    'cta.h2': [
      '¿Listo para tu <em style="font-style:italic;color:var(--sage);">carta digital</em>?',
      'Ready for your <em style="font-style:italic;color:var(--sage);">digital menu</em>?'
    ],
    'pricing.legal': [
      'Todos los precios son <strong>precios finales</strong> (impuestos incluidos).\n      Los precios se indican en eslotis polacos (PLN) y el cobro se realiza en esa moneda; los <strong>importes en euros son orientativos</strong> y tu banco aplicará su propio tipo de cambio.\n      Las cuentas nuevas tienen <strong>7 días gratis</strong>, sin tarjeta.\n      El pago se cobra una sola vez por el periodo elegido, <strong>sin renovación automática</strong>.\n      Los pagos online los gestiona <strong>Tpay</strong> — BLIK, tarjeta, transferencia rápida. Factura con IVA a petición.',
      'All prices are <strong>final prices</strong> (VAT included).\n      Prices are shown and charged in Polish złoty (PLN); the <strong>euro amounts are indicative</strong> and your bank will apply its own exchange rate.\n      New accounts get <strong>7 days free</strong>, no card required.\n      Payment is charged once for the chosen period, <strong>with no auto-renewal</strong>.\n      Online payments are handled by <strong>Tpay</strong> — BLIK, card, instant transfer. VAT invoice on request.'
    ],
    'cookie.text': [
      'Solo usamos los datos imprescindibles para que el servicio funcione y estadísticas anónimas (sin cookies de seguimiento). Consulta la <a href="/polityka-prywatnosci" style="color:var(--sage);font-weight:600;">política de privacidad</a>.',
      'We only use the data needed to run the service plus anonymous statistics (no tracking cookies). See our <a href="/polityka-prywatnosci" style="color:var(--sage);font-weight:600;">privacy policy</a>.'
    ],
    'ed.trialFoot': [
      'Después de 7 días puedes elegir un plan &nbsp;·&nbsp;\n            <a href="/#cennik" style="color:var(--sage);font-weight:600;text-decoration:none;">Ver precios →</a>',
      'After 7 days you can choose a plan &nbsp;·&nbsp;\n            <a href="/#cennik" style="color:var(--sage);font-weight:600;text-decoration:none;">See pricing →</a>'
    ],
    'ed.legalFoot': [
      'Al iniciar sesión o registrarte aceptas los\n            <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:600;text-decoration:none;">términos del servicio</a>\n            y la <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:600;text-decoration:none;">política de privacidad</a>.',
      'By signing in or registering you accept the\n            <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:600;text-decoration:none;">terms of service</a>\n            and the <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:600;text-decoration:none;">privacy policy</a>.'
    ],
    'ed.regConsent': [
      'Acepto los <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:600;">términos del servicio</a> y la <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:600;">política de privacidad</a>, y consiento el tratamiento de mis datos.',
      'I accept the <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:600;">terms of service</a> and the <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:600;">privacy policy</a>, and I consent to the processing of my data.'
    ],
    'ed.resetQr': [
      'Recibirás un enlace y un QR nuevos, y la <strong>dirección antigua redirigirá a la nueva</strong>, así que los soportes ya impresos seguirán funcionando.',
      'You\'ll get a new link and QR code, and the <strong>old address will redirect to the new one</strong>, so anything already printed keeps working.'
    ],
    'ed.gateIntro': [
      'Qreat es un servicio <strong>de pago tras el periodo de prueba</strong>.\n          Confirma las condiciones para desbloquear el generador.',
      'Qreat is a <strong>paid service after the trial period</strong>.\n          Confirm the terms to unlock the generator.'
    ],
    'ed.gatePay': [
      'El pago se cobra <strong>una sola vez por el periodo elegido</strong>: nada se renueva automáticamente y no guardamos los datos de tu tarjeta.\n        Los pagos los gestiona <strong>Tpay</strong> (BLIK, tarjeta, transferencia rápida).',
      'Payment is charged <strong>once for the chosen period</strong> — nothing renews automatically and we don\'t store your card details.\n        Payments are handled by <strong>Tpay</strong> (BLIK, card, instant transfer).'
    ],
    'ed.gateC1': [
      'He leído y acepto los <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:600;">términos del servicio</a> y la <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:600;">política de privacidad</a> de Qreat.',
      'I have read and accept the Qreat <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:600;">terms of service</a> and <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:600;">privacy policy</a>.'
    ],
    'ed.gateC2': [
      'Entiendo que, tras el <strong>periodo de prueba de 7 días</strong>, seguir usando el generador y mantener la carta online <strong>requiere contratar un plan</strong>: 34,99 zł al mes (≈ 8,15 €) o 349,99 zł al año (≈ 81,60 €), impuestos incluidos. El cobro se realiza en eslotis polacos (PLN).',
      'I understand that after the <strong>7-day trial</strong>, continued use of the generator and keeping the menu online <strong>requires a paid plan</strong> — 34,99 zł per month (≈ 8,15 €) or 349,99 zł per year (≈ 81,60 €), tax included. Payment is taken in Polish złoty (PLN).'
    ],
    'ed.gateC3': [
      'Solicito <strong>el inicio de la prestación del servicio digital</strong> antes de que expire el plazo de desistimiento de 14 días y entiendo que, una vez ejecutado el servicio por completo, <strong>pierdo el derecho de desistimiento</strong> (art.&nbsp;38 pto.&nbsp;13 de la ley polaca de derechos del consumidor).',
      'I request <strong>that the digital service begins</strong> before the 14-day withdrawal period expires, and I understand that once the service has been fully performed <strong>I lose the right of withdrawal</strong> (art.&nbsp;38 pt.&nbsp;13 of the Polish Consumer Rights Act).'
    ],
    /* ─── Ceny w ES/EN ─────────────────────────────────────────────────────
       Cena główna zostaje w ZŁOTYCH (bo Tpay pobiera złotówki), a pod spodem
       idzie przelicznik orientacyjny. Kurs ~4,29 PLN/EUR:
         34,99 zł ≈ 8,15 €   ·   349,99 zł ≈ 81,60 €
       Zmieniasz cenę? Zaktualizuj RÓWNIEŻ: api/tpay.js (PLANS), regulamin.html
       (§ z cenami + data), ceny w HTML index/editor/kontakt oraz klucze tego
       słownika, które zawierają kwotę w polskim źródle. ───────────────────── */
    'price.monthly': [
      '<span style="font-family:\'Playfair Display\',serif;font-size:3.4rem;font-weight:600;color:var(--navy);">34<span style="font-size:1.7rem;">,99</span></span>\n            <span style="color:rgba(27,42,74,0.4);font-size:14px;font-family:\'Plus Jakarta Sans\',sans-serif;">zł / mes</span>\n            <div style="flex-basis:100%;font-size:12.5px;color:rgba(27,42,74,0.42);font-family:\'Plus Jakarta Sans\',sans-serif;margin-top:3px;">≈ 8,15 € al mes</div>',
      '<span style="font-family:\'Playfair Display\',serif;font-size:3.4rem;font-weight:600;color:var(--navy);">34<span style="font-size:1.7rem;">,99</span></span>\n            <span style="color:rgba(27,42,74,0.4);font-size:14px;font-family:\'Plus Jakarta Sans\',sans-serif;">zł / month</span>\n            <div style="flex-basis:100%;font-size:12.5px;color:rgba(27,42,74,0.42);font-family:\'Plus Jakarta Sans\',sans-serif;margin-top:3px;">≈ 8,15 € per month</div>'
    ],
    'price.yearly': [
      '<span style="font-family:\'Playfair Display\',serif;font-size:3.4rem;font-weight:600;color:var(--navy);">349<span style="font-size:1.7rem;">,99</span></span>\n            <span style="color:rgba(27,42,74,0.4);font-size:14px;font-family:\'Plus Jakarta Sans\',sans-serif;">zł / año</span>\n            <div style="flex-basis:100%;font-size:12.5px;color:rgba(27,42,74,0.42);font-family:\'Plus Jakarta Sans\',sans-serif;margin-top:3px;">≈ 81,60 € al año</div>',
      '<span style="font-family:\'Playfair Display\',serif;font-size:3.4rem;font-weight:600;color:var(--navy);">349<span style="font-size:1.7rem;">,99</span></span>\n            <span style="color:rgba(27,42,74,0.4);font-size:14px;font-family:\'Plus Jakarta Sans\',sans-serif;">zł / year</span>\n            <div style="flex-basis:100%;font-size:12.5px;color:rgba(27,42,74,0.42);font-family:\'Plus Jakarta Sans\',sans-serif;margin-top:3px;">≈ 81,60 € per year</div>'
    ],
    'ed.priceMonthly': [
      '<span style="font-family:\'Playfair Display\',serif;font-size:2rem;font-weight:600;color:var(--navy);">34<span style="font-size:1.1rem;">,99</span></span>\n            <span style="font-size:13px;color:rgba(27,42,74,.5);">zł/mes</span>\n            <div style="flex-basis:100%;font-size:11px;color:rgba(27,42,74,.42);margin-top:2px;">≈ 8,15 €</div>',
      '<span style="font-family:\'Playfair Display\',serif;font-size:2rem;font-weight:600;color:var(--navy);">34<span style="font-size:1.1rem;">,99</span></span>\n            <span style="font-size:13px;color:rgba(27,42,74,.5);">zł/month</span>\n            <div style="flex-basis:100%;font-size:11px;color:rgba(27,42,74,.42);margin-top:2px;">≈ 8,15 €</div>'
    ],
    'ed.priceYearly': [
      '<span style="font-family:\'Playfair Display\',serif;font-size:2rem;font-weight:600;color:var(--navy);">349<span style="font-size:1.1rem;">,99</span></span>\n            <span style="font-size:13px;color:rgba(27,42,74,.5);">zł/año</span>\n            <div style="flex-basis:100%;font-size:11px;color:rgba(27,42,74,.42);margin-top:2px;">≈ 81,60 €</div>',
      '<span style="font-family:\'Playfair Display\',serif;font-size:2rem;font-weight:600;color:var(--navy);">349<span style="font-size:1.1rem;">,99</span></span>\n            <span style="font-size:13px;color:rgba(27,42,74,.5);">zł/year</span>\n            <div style="flex-basis:100%;font-size:11px;color:rgba(27,42,74,.42);margin-top:2px;">≈ 81,60 €</div>'
    ],
    'ed.gatePrice': [
      '34,99 zł<span style="font-size:.8rem;font-weight:500;color:rgba(27,42,74,.5);">/mes</span><span style="display:block;font-size:.62rem;font-weight:500;color:rgba(27,42,74,.45);margin-top:2px;">≈ 8,15 €</span>',
      '34,99 zł<span style="font-size:.8rem;font-weight:500;color:rgba(27,42,74,.5);">/month</span><span style="display:block;font-size:.62rem;font-weight:500;color:rgba(27,42,74,.45);margin-top:2px;">≈ 8,15 €</span>'
    ],

    'mock.price': [
      'La suscripción cuesta <strong>34,99 zł / mes</strong> (≈ 8,15 €) o <strong>349,99 zł / año</strong> (≈ 81,60 €, 2 meses gratis). La primera carta la generas <strong>gratis</strong> en la prueba de 7 días. 🎁',
      'The subscription is <strong>34,99 zł / month</strong> (≈ 8,15 €) or <strong>349,99 zł / year</strong> (≈ 81,60 €, 2 months free). Your first menu is <strong>free</strong> during the 7-day trial. 🎁'
    ],

    'ed.gateOrder': [
      'Realizo el pedido con obligación de pago y acepto los <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:700;">términos del servicio</a> y la <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:700;">política de privacidad</a>.',
      'I place the order with an obligation to pay and accept the <a href="/regulamin" target="_blank" style="color:var(--sage);font-weight:700;">terms of service</a> and <a href="/polityka-prywatnosci" target="_blank" style="color:var(--sage);font-weight:700;">privacy policy</a>.'
    ]
  };

  /* ── Komunikaty budowane w JS ({0} = podstawiana wartość) ─────────────── */
  var M = {
    /* Odznaka okresu próbnego — polska odmiana (1 dzień / N dni) nie ma
       odpowiednika 1:1, więc każdy język dostaje własne dwie formy. */
    'trial.day1':      ['1 día de prueba', '1 trial day'],
    'trial.days':      ['{0} días de prueba', '{0} trial days'],
    'trial.dayLeft1':  ['queda 1 día', '1 day left'],
    'trial.daysLeft':  ['quedan {0} días', '{0} days left'],
    'photos.count':    ['{0} / {1} con foto', '{0} / {1} with a photo'],

    /* Czat AI — odpowiedzi o nieudanych operacjach */
    'chat.failed':     ['No he podido aplicar este cambio ({0}). Descríbelo de otra forma, p. ej. «cambia el color de los precios a dorado».',
                        'I couldn\'t apply that change ({0}). Try describing it differently, e.g. "change the price colour to gold".'],
    'chat.noOps':      ['ninguna operación', 'no operations'],
    'chat.noItem':     ['no he encontrado el plato «{0}»', 'couldn\'t find the item "{0}"'],
    'chat.noCat':      ['no he encontrado la categoría «{0}»', 'couldn\'t find the category "{0}"'],
    'chat.catExists':  ['la categoría «{0}» ya existe', 'the category "{0}" already exists'],
    'confirm.remove':  ['¿Seguro que quieres eliminar: {0}? Esta acción no se puede deshacer.',
                        'Are you sure you want to remove: {0}? This cannot be undone.'],

    'confirm.reset': [
      '⚠️ ¿Borrar la carta actual y empezar de cero?\n\nSe eliminarán: las fotos subidas, los platos generados y la descripción.\n\nTu enlace permanente y tu código QR NO cambiarán: al volver a publicar se actualizarán en la misma dirección, así que los soportes impresos seguirán funcionando.',
      '⚠️ Clear the current menu and start over?\n\nThis removes: uploaded photos, generated items and the description.\n\nYour permanent link and QR code will NOT change — republishing updates the same address, so printed stands keep working.'
    ],
    'confirm.resetAddress': [
      '⚠️ ¿Restablecer la dirección de la carta y el código QR?\n\n• Se creará un enlace NUEVO y un código QR NUEVO.\n• La dirección antigua NO desaparecerá: redirigirá automáticamente a la nueva, así que los soportes y códigos QR impresos seguirán funcionando.\n• Si quieres usar el código nuevo, descárgalo y vuelve a imprimirlo.\n\n¿Continuar?',
      '⚠️ Reset the menu address and QR code?\n\n• A NEW link and a NEW QR code will be created.\n• The old address will NOT disappear — it redirects automatically to the new one, so printed stands and QR codes keep working.\n• If you want to use the new code, download and reprint it.\n\nContinue?'
    ]
  };

  /* ── Stan ─────────────────────────────────────────────────────────────── */
  var lang = 'pl';
  var idx = -1;                       /* -1 = polski (źródło) */
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|IFRAME|TEXTAREA|CODE|PRE|SVG|CANVAS)$/i;
  var busy = false;
  var obs = null;

  function norm(s) { return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }

  function lookup(s) {
    if (idx < 0) return null;
    var e = Object.prototype.hasOwnProperty.call(T, s) ? T[s] : null;
    return e ? e[idx] : null;
  }

  /* ── Węzeł tekstowy ───────────────────────────────────────────────────── */
  function doText(node) {
    var cur = node.nodeValue;
    /* jeśli aplikacja nadpisała nasz tekst — traktuj bieżący jako nowe źródło */
    var src = (node._i18nOut !== undefined && cur === node._i18nOut) ? node._i18nSrc : cur;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(src);
    var core = norm(m[2]);
    if (!core) return;
    var out = src;
    if (idx >= 0) {
      var hit = lookup(core);
      if (hit != null) out = m[1] + hit + m[3];
    }
    if (out === cur) { node._i18nSrc = src; node._i18nOut = cur; return; }
    node._i18nSrc = src;
    node._i18nOut = out;
    node.nodeValue = out;
  }

  /* ── Atrybuty ─────────────────────────────────────────────────────────── */
  function doAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var cur = el.getAttribute(a);
      var store = el._i18nAttr || (el._i18nAttr = {});
      var rec = store[a];
      var src = (rec && cur === rec.out) ? rec.src : cur;
      var core = norm(src);
      if (!core) continue;
      var out = src;
      if (idx >= 0) {
        var hit = lookup(core);
        if (hit != null) out = hit;
      }
      store[a] = { src: src, out: out };
      if (out !== cur) el.setAttribute(a, out);
    }
  }

  /* ── Blok z data-i18n-key (cały innerHTML) ────────────────────────────── */
  function doBlock(el) {
    var key = el.getAttribute('data-i18n-key');
    var e = H[key];
    if (el._i18nHtmlSrc === undefined) el._i18nHtmlSrc = el.innerHTML;
    var out = (idx >= 0 && e) ? e[idx] : el._i18nHtmlSrc;
    if (el.innerHTML !== out) el.innerHTML = out;
  }

  /* ── Walker ───────────────────────────────────────────────────────────── */
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    if (SKIP.test(root.tagName) || root.hasAttribute('data-no-i18n')) { doAttrs(root); return; }

    doAttrs(root);
    if (root.hasAttribute('data-i18n-key')) { doBlock(root); return; }

    var kids = root.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3) doText(n);
      else if (n.nodeType === 1) walk(n);
    }
  }

  function applyAll() {
    busy = true;
    document.documentElement.lang = lang;
    var ttl = norm(document.title);
    if (!document._i18nTitle) document._i18nTitle = ttl;
    var th = idx >= 0 ? lookup(document._i18nTitle) : null;
    document.title = th != null ? th : document._i18nTitle;
    if (document.body) walk(document.body);
    renderSwitchers();
    if (obs) obs.takeRecords();
    busy = false;
  }

  /* ── Przełącznik w nawigacji ──────────────────────────────────────────── */
  /* Flagi rysowane inline SVG — emoji flag nie renderuje się na Windowsie. */
  var FLAG = {
    pl: '<rect width="60" height="40" rx="0" fill="#fff"/><rect y="20" width="60" height="20" fill="#DC143C"/>',
    es: '<rect width="60" height="40" fill="#AA151B"/><rect y="10" width="60" height="20" fill="#F1BF00"/>',
    en: '<rect width="60" height="40" fill="#012169"/>' +
        '<path d="M0 0 60 40M60 0 0 40" stroke="#fff" stroke-width="9"/>' +
        '<path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" stroke-width="5"/>' +
        '<path d="M30 0V40M0 20H60" stroke="#fff" stroke-width="15"/>' +
        '<path d="M30 0V40M0 20H60" stroke="#C8102E" stroke-width="9"/>'
  };
  var LABEL = { pl: 'Polski', es: 'Español', en: 'English' };

  function injectCss() {
    if (document.getElementById('qreatLangCss')) return;
    var st = document.createElement('style');
    st.id = 'qreatLangCss';
    st.textContent =
      '.qr-lang{display:inline-flex;align-items:center;gap:3px;padding:3px;border-radius:100px;' +
      'background:rgba(27,42,74,.05);border:1px solid rgba(27,42,74,.10);flex-shrink:0;}' +
      '.qr-lang-btn{appearance:none;border:none;background:none;cursor:pointer;padding:3px;' +
      'border-radius:6px;display:inline-flex;line-height:0;opacity:.42;' +
      'transition:opacity 170ms cubic-bezier(.34,1.3,.64,1),transform 170ms cubic-bezier(.34,1.3,.64,1);}' +
      '.qr-lang-btn svg{width:23px;height:15.5px;border-radius:3px;display:block;' +
      'box-shadow:inset 0 0 0 1px rgba(27,42,74,.18),0 1px 2px rgba(27,42,74,.16);}' +
      '.qr-lang-btn:hover{opacity:.85;transform:translateY(-1px);}' +
      '.qr-lang-btn:focus-visible{outline:2px solid var(--sage,#7BAA8F);outline-offset:2px;}' +
      '.qr-lang-btn:active{transform:scale(.92);}' +
      '.qr-lang-btn.active{opacity:1;}' +
      '.qr-lang-btn.active svg{box-shadow:inset 0 0 0 1px rgba(27,42,74,.2),' +
      '0 0 0 2px var(--navy,#1B2A4A),0 2px 7px -1px rgba(27,42,74,.34);}' +
      '.qr-lang-btn.active:hover{transform:none;}' +
      '@media (max-width:640px){.qr-lang-btn svg{width:21px;height:14px;}}';
    document.head.appendChild(st);
  }

  function renderSwitchers() {
    var hosts = document.querySelectorAll('[data-lang-switch]');
    for (var i = 0; i < hosts.length; i++) {
      var el = hosts[i];
      el.setAttribute('data-no-i18n', '');
      el.className = (el.className.indexOf('qr-lang') >= 0) ? el.className : (el.className + ' qr-lang').trim();
      var html = '';
      for (var j = 0; j < LANGS.length; j++) {
        var l = LANGS[j];
        html += '<button type="button" class="qr-lang-btn' + (l === lang ? ' active' : '') + '"' +
                ' lang="' + l + '" title="' + LABEL[l] + '" aria-label="' + LABEL[l] + '"' +
                ' aria-pressed="' + (l === lang) + '"' +
                ' onclick="qreatSetLang(\'' + l + '\')">' +
                '<svg viewBox="0 0 60 40" aria-hidden="true">' + FLAG[l] + '</svg></button>';
      }
      if (el.innerHTML !== html) el.innerHTML = html;
    }
  }

  /* ── API ──────────────────────────────────────────────────────────────── */
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) l = 'pl';
    lang = l;
    idx = (l === 'es') ? 0 : (l === 'en') ? 1 : -1;
    try { localStorage.setItem(STORE, l); } catch (e) {}
    applyAll();
    try { window.dispatchEvent(new CustomEvent('qreat:lang', { detail: l })); } catch (e) {}
  }

  function detect() {
    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) {}
    if (saved && LANGS.indexOf(saved) >= 0) return saved;
    var n = (navigator.language || 'pl').slice(0, 2).toLowerCase();
    return LANGS.indexOf(n) >= 0 ? n : 'pl';
  }

  /* t() dla stringów, które nie trafiają do DOM jako gotowy węzeł tekstowy:
     confirm/alert oraz komunikaty sklejane ze zmiennymi.
     Argumenty po kluczu podstawiają się pod {0}, {1}, ...
     Zwraca null przy polskim — wywołujący używa wtedy oryginału. */
  function t(key) {
    if (idx < 0) return null;
    var e = M[key] || T[key];
    if (!e) return null;
    var s = e[idx];
    for (var i = 1; i < arguments.length; i++) {
      s = s.split('{' + (i - 1) + '}').join(String(arguments[i]));
    }
    return s;
  }

  window.qreatSetLang = setLang;
  window.qreatLang = function () { return lang; };
  window.qreatT = t;

  function start() {
    injectCss();
    lang = detect();
    idx = (lang === 'es') ? 0 : (lang === 'en') ? 1 : -1;
    applyAll();

    obs = new MutationObserver(function (muts) {
      if (busy) return;
      busy = true;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        } else if (m.type === 'characterData') {
          doText(m.target);
        } else if (m.type === 'attributes') {
          doAttrs(m.target);
        }
      }
      busy = false;
    });
    obs.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
