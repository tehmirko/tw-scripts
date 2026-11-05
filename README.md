# Snipe-Timer DE

Umbau des Bottenkraker-Snipetools (Ricardo). Rechnet komplett in **Serverzeit**, die PC-Zeitzone spielt keine Rolle.

## Einbinden (Schnellleiste / Lesezeichen)

```
javascript:
var timeColor = "green";
var waitingColor = "#ff9933";
var noDateColor = "green";
var timeBarWidth = false;
var focusDelay = 5;

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
- **Rote Linie / Klick-Laufzeit (ms):** Zeit vom Klick bis der Server den Befehl hat (Büro Mexiko ≈ 370 ms). Die rote Linie im Balken markiert den optimalen Klickzeitpunkt (= Abschickzeitpunkt − Klick-Laufzeit). Wer auf die rote Linie klickt, braucht Korrektur 0. „Letzter Versand“ zeigt zusätzlich die Abweichung zur roten Linie.
- **Fokus-Modus (Enter):** 5 s nach der letzten Eingabe im Snipe-Feld (und beim Zurückwechseln in den Tab) springt der Fokus auf den Abschicken-Button. Grün hinterlegt + „⏎ Enter bereit“ = mit Enter abschicken. Rot „Fokus nicht auf dem Button“ = nicht in die Seite klicken, kurz warten oder Tab neu anwählen. Enter in den Snipe-Feldern schickt nicht ab. Wartezeit über `var focusDelay = 5;` (0 = aus).

## Update

Nach Änderungen an `snipe-de.js` hält jsDelivr die alte Version bis zu 12 h im Cache. Sofort leeren:
https://purge.jsdelivr.net/gh/tehmirko/tw-scripts@main/snipe-de.js
