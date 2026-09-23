# Snipe-Timer DE

Umbau des Bottenkraker-Snipetools (Ricardo). Rechnet komplett in **Serverzeit**, die PC-Zeitzone spielt keine Rolle.

## Einbinden (Schnellleiste / Lesezeichen)

```
javascript:
var timeColor = "green";
var waitingColor = "#ff9933";
var noDateColor = "green";
var timeBarWidth = false;

$.getScript('https://cdn.jsdelivr.net/gh/tehmirko/tw-scripts@main/snipe-de.js');
```

Auf der Bestätigungsseite eines Angriffs/Unterstützung (Versammlungsplatz oder Karte) ausführen.

## Bedienung

- **Ankunft (Serverzeit):** `20:15:30:123`, `morgen 20:15:30:123`, `24.09. 20:15:30:123` oder die Ankunft aus dem Spiel reinkopieren.
- **Befehle zum Ziel:** Zeile anklicken → Ankunft wird übernommen.
- **Korrektur (ms):** z.B. `+50` = 50 ms nach der Zielzeit ankommen.
- **Ton:** klingt X Sekunden vor dem Abschicken.
- Balken: orange = warten, **grün = letzte Sekunde**, rot = zu spät. Abschicken, wenn der grüne Balken voll ist.
- „Letzter Versand“ zeigt, wie viele ms der Klick danebenlag.

## Update

Nach Änderungen an `snipe-de.js` hält jsDelivr die alte Version bis zu 12 h im Cache. Sofort leeren:
https://purge.jsdelivr.net/gh/tehmirko/tw-scripts@main/snipe-de.js
