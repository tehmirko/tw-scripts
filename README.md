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
- **Ton:** Countdown-Pieps auf die rote Linie hin (letzter hoher Klick = jetzt drücken).
- Balken: auf den optimalen Klick synchronisiert. Orange = warten, **grün = die Sekunde um den optimalen Klick**, rot = zu spät. **Abschicken, wenn der Balken die rote Linie in der Mitte erreicht.**
- „Letzter Versand“ zeigt, wie viele ms der Klick danebenlag.
- **Klick-Laufzeit (ms):** Zeit vom Klick bis der Server den Befehl hat, inkl. Versatz der Spieluhr (Büro Mexiko ≈ 390 ms, Kalibrierung 05.11.2026). Die rote Linie in der Balkenmitte ist der optimale Klickzeitpunkt (= Abschickzeitpunkt − Klick-Laufzeit). Wer auf die rote Linie klickt, braucht Korrektur 0. „Letzter Versand“ zeigt zusätzlich die Abweichung zur roten Linie.
- **Uhr-Sync (experimentell, aus):** `var clockSync = true;` gleicht die Spieluhr gegen den Server-Zeitstempel ab. Im Test 05.11. unzuverlässig, daher standardmäßig aus.
- **Fokus-Modus (Enter):** 5 s nach der letzten Eingabe im Snipe-Feld (und beim Zurückwechseln in den Tab) springt der Fokus auf den Abschicken-Button. Klick irgendwo in die Seite (nicht in ein Feld) holt den Fokus nach 0,7 s zurück. Grün hinterlegt + „⏎ Enter bereit“ (nur wenn auch das Browserfenster aktiv ist) = mit Enter abschicken. Rot „Fokus nicht auf dem Button“ = nicht in die Seite klicken, kurz warten oder Tab neu anwählen. Enter in den Snipe-Feldern schickt nicht ab. Wartezeit über `var focusDelay = 5;` (0 = aus).

## Update

Nach Änderungen an `snipe-de.js` hält jsDelivr die alte Version bis zu 12 h im Cache. Sofort leeren:
https://purge.jsdelivr.net/gh/tehmirko/tw-scripts@main/snipe-de.js
