# Time Tracker - Chrome Extension

Ett Chrome-tillägg (Manifest V3) som spårar tid spenderad på olika webbplatser och skickar datan till en lokal PHP/PostgreSQL-backend.

## Hur det fungerar

- **background.js** körs som en service worker och lyssnar på flikbyten. När du byter domän skickas den insamlade tiden till backend via ett POST-anrop.
- **popup.html/js** visar en lista över de mest besökta domänerna med tid, hämtat från backend. Live-data från pågående session kombineras med sparad statistik.
- **PHP-backend** (separat) tar emot, lagrar och returnerar statistik via PostgreSQL.

## Krav

- Google Chrome
- PHP 8+ med inbyggd webbserver
- PostgreSQL

## Backend-endpoints (förväntas på `http://localhost:8000`)

| Fil | Metod | Beskrivning |
|---|---|---|
| `track.php` | POST | Tar emot `{ domain, duration_seconds }` och sparar i databasen |
| `stats.php` | GET | Returnerar top 20 domäner med total tid |
| `delete.php` | POST | Tar emot `{ domain }` eller `{ clear_all: true }` och raderar data |

## Installation

### 1. Starta PHP-backend

Navigera till din backend-mapp och kör:

```bash
php -S localhost:8000
```

Se till att databasen är konfigurerad och att `track.php`, `stats.php` och `delete.php` finns i den mappen.

### 2. Ladda in tillägget i Chrome

1. Öppna `chrome://extensions/`
2. Aktivera **Utvecklarläge** (uppe till höger)
3. Klicka på **Läs in okomprimerat tillägg**
4. Välj den här mappen

## Användning

- Surfa som vanligt — tillägget spårar automatiskt tid per domän i bakgrunden.
- Klicka på tilläggsikonen för att se din statistik.
- Klicka på `×` bredvid en domän för att radera dess data.
- Klicka på **Nollställ Allt** för att rensa all insamlad data.

## Projektstruktur

```
extension/
├── manifest.json     # Chrome extension manifest (v3)
├── background.js     # Service worker – spårar aktiv flik och skickar data
├── popup.html        # Popup-gränssnitt
├── popup.js          # Hämtar och renderar statistik
├── popup.css         # Styling för popup
├── icon*.png         # Tilläggsikoner (16, 32, 48, 128px)
└── tests/
    ├── background.test.js
    └── popup.test.js

backend/
├── config.php        # Databasuppgifter
├── track.php         # Tar emot och sparar tid
├── stats.php         # Returnerar statistik
└── delete.php        # Raderar data

schema.sql            # PostgreSQL-schema för databasen
```
