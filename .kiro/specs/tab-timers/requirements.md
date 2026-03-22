# Kravdokument – Tab Timers

## Introduktion

Tab Timers är en funktion i Time Tracker Chrome-tillägget som låter användaren sätta en nedräkningstimer kopplad till en specifik domän. När timern löper ut visas en Chrome-notifikation som påminner användaren om att göra något i den aktuella fliken eller domänen. Timers hanteras helt i tillägget (background service worker + chrome.storage) utan behov av backend-ändringar.

## Ordlista

- **Timer**: En nedräkningstimer med en angiven varaktighet kopplad till en domän.
- **Domän**: Webbplatsens hostname, t.ex. `github.com`, som identifieras av den befintliga `getDomain()`-funktionen i background.js.
- **Notifikation**: En Chrome-systemnotifikation som visas via `chrome.notifications`-API:et.
- **Background_Worker**: Den befintliga service workern i background.js som hanterar flik-spårning och meddelanden.
- **Popup**: Det befintliga popup-gränssnittet i popup.html/popup.js.
- **Timer_Storage**: `chrome.storage.local` som används för att spara aktiva timers persistent.
- **Alarm**: Ett `chrome.alarms`-larm som triggar när en timer löper ut.

---

## Krav

### Krav 1: Skapa en timer för en domän

**User Story:** Som användare vill jag kunna sätta en nedräkningstimer för den domän jag för tillfället besöker, så att jag får en påminnelse när det är dags att göra något.

#### Acceptanskriterier

1. WHEN användaren öppnar popup:en, THE Popup SHALL visa ett formulär för att skapa en ny timer med ett inmatningsfält för varaktighet (i minuter) och en knapp för att starta timern.
2. WHEN användaren anger en varaktighet och startar timern, THE Popup SHALL skicka ett meddelande till Background_Worker med domännamnet för den aktiva fliken och den angivna varaktigheten i sekunder.
3. IF användaren anger ett värde som inte är ett positivt heltal, THEN THE Popup SHALL visa ett felmeddelande och inte skapa timern.
4. IF användaren anger ett värde som överstiger 1440 minuter (24 timmar), THEN THE Popup SHALL visa ett felmeddelande och inte skapa timern.
5. WHEN Background_Worker tar emot en begäran om att skapa en timer, THE Background_Worker SHALL spara timern i Timer_Storage med domän, starttid och varaktighet.
6. WHEN Background_Worker tar emot en begäran om att skapa en timer, THE Background_Worker SHALL skapa ett Alarm via `chrome.alarms.create` med ett unikt namn baserat på domänen.

### Krav 2: Visa aktiva timers i popup

**User Story:** Som användare vill jag se mina aktiva timers i popup:en, så att jag vet hur lång tid som återstår.

#### Acceptanskriterier

1. WHEN användaren öppnar popup:en, THE Popup SHALL hämta alla aktiva timers från Background_Worker och visa dem i en lista.
2. WHILE en timer är aktiv, THE Popup SHALL visa domännamnet och återstående tid i formatet `Xm Ys` för varje timer i listan.
3. THE Popup SHALL uppdatera den visade återstående tiden för varje aktiv timer en gång per sekund.
4. IF inga aktiva timers finns, THE Popup SHALL visa ett meddelande om att inga timers är aktiva.

### Krav 3: Notifikation när timer löper ut

**User Story:** Som användare vill jag få en tydlig notifikation när min timer löper ut, så att jag inte missar påminnelsen.

#### Acceptanskriterier

1. WHEN ett Alarm utlöses, THE Background_Worker SHALL hämta motsvarande timer från Timer_Storage baserat på alarmets namn.
2. WHEN ett Alarm utlöses, THE Background_Worker SHALL visa en Chrome-notifikation med domännamnet och ett meddelande om att timern har löpt ut.
3. WHEN ett Alarm utlöses, THE Background_Worker SHALL ta bort timern från Timer_Storage.
4. THE Notifikation SHALL innehålla tilläggets ikon, en titel och en beskrivande text som anger vilken domän timern gällde.

### Krav 4: Avbryta en aktiv timer

**User Story:** Som användare vill jag kunna avbryta en aktiv timer, så att jag kan ta bort påminnelser jag inte längre behöver.

#### Acceptanskriterier

1. WHEN en aktiv timer visas i popup:en, THE Popup SHALL visa en knapp för att avbryta timern.
2. WHEN användaren klickar på avbryt-knappen, THE Popup SHALL skicka ett meddelande till Background_Worker med domännamnet för den timer som ska avbrytas.
3. WHEN Background_Worker tar emot en begäran om att avbryta en timer, THE Background_Worker SHALL ta bort motsvarande Alarm via `chrome.alarms.clear`.
4. WHEN Background_Worker tar emot en begäran om att avbryta en timer, THE Background_Worker SHALL ta bort timern från Timer_Storage.
5. WHEN en timer har avbrutits, THE Popup SHALL uppdatera listan och inte längre visa den avbrutna timern.

### Krav 5: En timer per domän

**User Story:** Som användare vill jag att det bara kan finnas en aktiv timer per domän, så att jag inte råkar skapa dubbletter av misstag.

#### Acceptanskriterier

1. IF en aktiv timer redan finns för en domän, THEN THE Popup SHALL visa den befintliga timern och inte visa formuläret för att skapa en ny timer för samma domän.
2. IF Background_Worker tar emot en begäran om att skapa en timer för en domän som redan har en aktiv timer, THEN THE Background_Worker SHALL ersätta den befintliga timern med den nya.

### Krav 6: Persistent lagring av timers

**User Story:** Som användare vill jag att mina timers överlever om service workern startas om, så att påminnelserna fungerar tillförlitligt.

#### Acceptanskriterier

1. THE Background_Worker SHALL spara alla aktiva timers i Timer_Storage (`chrome.storage.local`) så att de överlever en omstart av service workern.
2. WHEN Background_Worker startar, THE Background_Worker SHALL läsa in alla aktiva timers från Timer_Storage och verifiera att motsvarande Alarm fortfarande existerar.
3. IF ett Alarm saknas för en sparad timer vid uppstart, THEN THE Background_Worker SHALL återskapa Alarm:et baserat på sparad starttid och varaktighet.
4. IF en sparad timers beräknade sluttid redan har passerat vid uppstart, THEN THE Background_Worker SHALL omedelbart visa notifikationen och ta bort timern från Timer_Storage.

### Krav 7: Behörigheter och manifest

**User Story:** Som utvecklare vill jag att tillägget begär de minimala behörigheter som krävs för timer-funktionen, så att användaren inte exponeras för onödiga rättigheter.

#### Acceptanskriterier

1. THE manifest.json SHALL inkludera behörigheten `"alarms"` för att stödja `chrome.alarms`-API:et.
2. THE manifest.json SHALL inkludera behörigheten `"notifications"` för att stödja `chrome.notifications`-API:et.
3. THE Background_Worker SHALL inte kräva några nya `host_permissions` utöver de som redan finns.
