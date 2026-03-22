# Implementationsplan: Tab Timers

## Översikt

Implementera Tab Timers-funktionen i det befintliga Chrome-tillägget. Arbetet delas upp i: manifest-uppdatering, background.js-logik, popup-UI och tester. Ingen backend-kod ändras.

## Tasks

- [x] 1. Uppdatera manifest.json med nya behörigheter
  - Lägg till `"alarms"` och `"notifications"` i `permissions`-arrayen
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Implementera timer-logik i background.js
  - [x] 2.1 Lägg till hjälpfunktioner och meddelandehantering
    - Implementera `alarmName(domain)` som returnerar `"tab-timer::" + domain`
    - Implementera `createTimer(domain, durationSeconds)`: validera input, ersätt befintlig timer (clear alarm + remove storage), spara `TimerRecord` i `chrome.storage.local`, anropa `chrome.alarms.create`
    - Implementera `cancelTimer(domain)`: anropa `chrome.alarms.clear` och ta bort `TimerRecord` från storage
    - Utöka `chrome.runtime.onMessage`-lyssnaren med actions `createTimer`, `cancelTimer`, `getTimers`
    - _Requirements: 1.2, 1.5, 1.6, 4.2, 4.3, 4.4, 5.2_

  - [x]* 2.2 Skriv property-test för ogiltig varaktighet (Property 1)
    - **Property 1: Ogiltig varaktighet avvisas alltid**
    - **Validates: Requirements 1.3, 1.4**
    - Använd `fc.oneof(fc.constant(0), fc.integer({max:-1}), fc.float(), fc.string())` samt heltal > 1440
    - Verifiera att ingen timer skapas i storage och inget alarm registreras

  - [x]* 2.3 Skriv property-test för createTimer sparar korrekt TimerRecord (Property 2)
    - **Property 2: createTimer sparar korrekt TimerRecord**
    - **Validates: Requirements 1.5**
    - Generatorer: `fc.string()` (domän), `fc.integer({min:1, max:86400})` (sekunder)
    - Verifiera att `TimerRecord` i storage har rätt `domain`, `durationMs` och `endTime`

  - [x]* 2.4 Skriv property-test för alarm schemaläggs med korrekt tid (Property 3)
    - **Property 3: Alarm schemaläggs med korrekt tid**
    - **Validates: Requirements 1.6, 6.3**
    - Generatorer: samma som Property 2
    - Verifiera att `chrome.alarms.create` anropas med `when === endTime` från `TimerRecord`

  - [x]* 2.5 Skriv property-test för en timer per domän (Property 7)
    - **Property 7: En domän kan bara ha en aktiv timer**
    - **Validates: Requirements 5.2**
    - Generatorer: `fc.string()` (domän), två `fc.integer({min:1, max:86400})` (varaktigheter)
    - Verifiera att storage och alarm-registret bara innehåller en post efter två anrop

- [x] 3. Implementera alarm-hanterare och uppstartslogik i background.js
  - [x] 3.1 Lägg till `chrome.alarms.onAlarm`-lyssnare
    - Filtrera på prefix `"tab-timer::"`
    - Hämta `TimerRecord` från storage; om saknas, ignorera tyst
    - Anropa `chrome.notifications.create` med domännamn i titel och beskrivning
    - Ta bort `TimerRecord` från storage
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Lägg till uppstartslogik (service worker init)
    - Läs alla nycklar med prefix `"tab-timer::"` från `chrome.storage.local`
    - För varje post: kontrollera om alarm finns via `chrome.alarms.get`
    - Om alarm saknas och `endTime` är i framtiden: återskapa alarm med `when: endTime`
    - Om `endTime` redan passerat: visa notifikation direkt och ta bort posten
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x]* 3.3 Skriv property-test för alarm-hanteraren (Property 5)
    - **Property 5: Alarm-hanteraren visar notifikation med rätt innehåll och tar bort timern**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Generatorer: `fc.string()` (domän)
    - Verifiera att `chrome.notifications.create` anropas med domännamnet och att `TimerRecord` tas bort

  - [x]* 3.4 Skriv property-test för cancelTimer (Property 6)
    - **Property 6: cancelTimer rensar alarm och storage**
    - **Validates: Requirements 4.3, 4.4**
    - Generatorer: `fc.string()` (domän)
    - Verifiera att `chrome.alarms.clear` anropas och att `TimerRecord` inte längre finns i storage

  - [x]* 3.5 Skriv property-test för uppstartslogik (Property 8)
    - **Property 8: Uppstart återskapar alarm för timers vars sluttid är i framtiden**
    - **Validates: Requirements 6.2, 6.3**
    - Generatorer: `fc.string()` (domän), `fc.integer({min:1})` (sekunder kvar)
    - Verifiera att `chrome.alarms.create` anropas med korrekt `when`-värde

- [x] 4. Checkpoint – Säkerställ att alla background-tester passerar
  - Säkerställ att alla tester passerar, fråga användaren om frågor uppstår.

- [x] 5. Bygg timer-UI i popup.html och popup.js
  - [x] 5.1 Lägg till `#timers-section` i popup.html
    - Infoga sektionen under befintlig statistiklista enligt design:
      `<section id="timers-section">` med `#timer-form`, `#timer-minutes`, `#timer-start`, `#timer-error`, `#timer-list`, `#no-timers`
    - _Requirements: 1.1, 2.1, 2.4, 4.1_

  - [x] 5.2 Implementera `loadTimers()` i popup.js
    - Skicka `getTimers`-meddelande till background och rendera listan
    - Visa domän, återstående tid (format `Xm Ys`) och avbryt-knapp per timer
    - Starta `setInterval` (1 s) som räknar ned visad tid lokalt
    - Visa `#no-timers` om listan är tom
    - Dölj `#timer-form` om aktiv timer redan finns för aktiv domän
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1_

  - [x] 5.3 Implementera `startTimer()` och `cancelTimer(domain)` i popup.js
    - `startTimer()`: läs och validera `#timer-minutes` (positivt heltal, 1–1440), visa fel i `#timer-error` vid ogiltigt värde, skicka `createTimer` till background, anropa `loadTimers()` på svar
    - `cancelTimer(domain)`: skicka `cancelTimer` till background, anropa `loadTimers()` på svar
    - Koppla `#timer-start` click-händelse till `startTimer()`
    - _Requirements: 1.2, 1.3, 1.4, 4.2, 4.5_

  - [x]* 5.4 Skriv property-test för tidformateringsfunktionen (Property 4)
    - **Property 4: Tidformateringsfunktionen är korrekt**
    - **Validates: Requirements 2.2**
    - Generatorer: `fc.integer({min:0, max:86400})`
    - Verifiera att returnerad sträng matchar mönstret `Xm Ys`, `Xm` eller `Ys` och korrekt representerar angiven tid

  - [x]* 5.5 Skriv enhetstester för popup-rendering
    - Testa att formulär visas vid öppning (krav 1.1)
    - Testa att lista renderas med aktiva timers (krav 2.1)
    - Testa att `#no-timers` visas när listan är tom (krav 2.4)
    - Testa att avbryt-knapp visas per timer (krav 4.1)
    - Testa att formulär döljs om aktiv timer finns för domänen (krav 5.1)
    - Testa att listan uppdateras efter avbryt (krav 4.5)
    - _Requirements: 1.1, 2.1, 2.4, 4.1, 5.1, 4.5_

- [x] 6. Lägg till CSS-stilar för timer-sektionen i popup.css
  - Styla `#timers-section`, `#timer-form`, `#timer-list`, `#timer-error` och `#no-timers` konsekvent med befintlig design
  - _Requirements: 1.1, 2.1_

- [x] 7. Skriv enhetstester för uppstartslogik och manifest
  - Testa att uppstartslogiken läser storage och kontrollerar alarm (krav 6.2)
  - Testa att passerad sluttid vid uppstart ger notifikation och borttagning (krav 6.4)
  - Verifiera att manifest.json innehåller `"alarms"`, `"notifications"` och inga nya host_permissions (krav 7.1–7.3)
  - _Requirements: 6.2, 6.4, 7.1, 7.2, 7.3_

- [x] 8. Final checkpoint – Säkerställ att alla tester passerar
  - Säkerställ att alla tester passerar, fråga användaren om frågor uppstår.

## Notes

- Tasks markerade med `*` är valfria och kan hoppas över för snabbare MVP
- Varje task refererar till specifika krav för spårbarhet
- Property-tester använder **fast-check** med minst 100 iterationer per test
- Enhetstester använder **Jest + jsdom** för popup och Jest med mockade Chrome-API:er för background
- Tagga varje property-test med `// Feature: tab-timers, Property N: <property_text>`
- Backend-koden i `backend/` ska inte ändras
