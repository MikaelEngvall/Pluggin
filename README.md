# Time Tracker Chrome Extension

Ett Chrome-tillägg som automatiskt loggar hur mycket tid du spenderar på olika webbplatser. Den visualiserar sedan en live-uppdaterad lista av dina mest besökta domäner via tilläggets popup-meny. Projektet använder en egenutvecklad PHP-backend och sparar datan i en PostgreSQL-databas.

## 🚀 Tech Stack

*   **Frontend (Chrome-tillägget)**
    *   **JavaScript (Manifest V3)**: Körs i bakgrunden (Service Worker) för att lyssna på flik-byten. Hanterar också logiken i popup-gränssnittet.
    *   **HTML & CSS**: För att måla upp tilläggets användargränssnitt.
*   **Backend (API)**
    *   **PHP (v8.x)**: Binder ihop databasen med Chromes förfrågningar och returnerar formaterad JSON-data (`track.php` och `stats.php`).
*   **Databas**
    *   **PostgreSQL**: Sparar historiken över alla besökta domäner med hjälp av PHP Data Objects (PDO).

---

## 🛠 Installation

### 1. Förbered databasen (PostgreSQL)
1. Öppna PostgreSQL och säkerställ att du är uppkopplad (via t.ex psql eller pgAdmin).
2. Skapa databasen och tillhörande tabell genom att köra filen `schema.sql`:
   ```sql
   CREATE DATABASE time_tracker;
   -- Anslut sedan till time_tracker och kör koden i schema.sql
   ```
3. Fyll i dina databasuppgifter i filen `backend/config.php`.

### 2. Starta Backend (PHP server)
För att PHP-filerna ska fungera behöver du en server. Vi använder PHP:s inbyggda development server.

1. Öppna en terminal och navigera till backend-mappen:
   ```bash
   cd C:\Users\mikae\Code\Pluggin\backend
   ```
2. Starta servern (anpassa sökvägen till din `php.exe` om du kör t.ex XAMPP):
   ```bash
   C:\Users\mikae\Desktop\xampp\php\php.exe -S localhost:8000
   ```
*Tips: Får du felmeddelandet "could not find driver", säkerställ att du har aktiverat `extension=pdo_pgsql` i din `php.ini`.*

### 3. Installera Chrome-tillägget
1. Öppna Google Chrome och gå till `chrome://extensions/`.
2. Aktivera **Utvecklarläge** (Developer mode) högst uppe till höger.
3. Klicka på **Läs in opackat tillägg** (Load unpacked).
4. Välj mappen `C:\Users\mikae\Code\Pluggin\extension`.

### 4. Användning
Allt är klart!
När du nu surfar runt så skickar Google Chrome data till din server i bakgrunden varje gång du byter aktiv flik. 

Klicka på tilläggs-ikonen ("pusselbiten") och därefter på "**Time Tracker - PHP Backend**" uppe i verktygsfältet för att i realtid se vilka sidor du ödslar mest tid på!
