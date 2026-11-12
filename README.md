# Snipe-Timer DE

Umbau des Bottenkraker-Snipetools (Ricardo). Rechnet komplett in **Serverzeit**, die PC-Zeitzone spielt keine Rolle.

## Einbinden (Schnellleiste / Lesezeichen)

```
javascript:
$.getScript('https://cdn.jsdelivr.net/gh/tehmirko/tw-scripts@skriptbibliothek/snipe-de.js');
```

Auf der Bestätigungsseite eines Angriffs/Unterstützung (Versammlungsplatz oder Karte) ausführen.

## Bedienung

- **Ankunft (Serverzeit):** `20:15:30:123`, `morgen 20:15:30:123`, `24.09. 20:15:30:123` oder die Ankunft aus dem Spiel reinkopieren.
- **Befehle zum Ziel:** Zeile anklicken → Ankunft wird übernommen.
- **Ton:** Countdown-Pieps auf die rote Linie hin (letzter hoher Klick = jetzt drücken).
- Balken: auf den optimalen Klick synchronisiert. Orange = warten, **grün = die Sekunde um den optimalen Klick**, rot = zu spät. **Abschicken, wenn der Balken die rote Linie in der Mitte erreicht.**
- „Letzter Versand“ zeigt, wie viele ms der Klick danebenlag.
- **Klick-Laufzeit (ms):** Zeit vom Klick bis der Server den Befehl hat, inkl. Versatz der Spieluhr (Standard 0 – einmal kalibrieren, siehe unten). Die rote Linie in der Balkenmitte ist der optimale Klickzeitpunkt (= Abschickzeitpunkt − Klick-Laufzeit). Wer genau auf die rote Linie drückt, kommt zur Zielzeit an (die frühere Korrektur entfällt). „Letzter Versand“ zeigt zusätzlich die Abweichung zur roten Linie.
- Kein Fokus-Modus: Laut Skriptbibliothek-Regeln darf ein Skript den Abschicken-Button weder fokussieren noch klicken. Abschicken immer selbst.
- Farben/Breite optional per Benutzerdaten (JSON): `{"timeColor":"green","waitingColor":"#ff9933","noDateColor":"green","barWidth":600}`

## Update

Nach Änderungen an `snipe-de.js` hält jsDelivr die alte Version bis zu 12 h im Cache. Sofort leeren:
https://purge.jsdelivr.net/gh/tehmirko/tw-scripts@main/snipe-de.js

## Klick-Laufzeit kalibrieren

1. Eine Unterstützung mit 1 Speer an ein eigenes Dorf vorbereiten, Snipe-Timer starten, Ziel-Ankunft z. B. `…:200` eintragen, Klick-Laufzeit `0`.
2. Auf die rote Linie klicken / Enter drücken.
3. Tatsächliche Ankunft in der Befehlsübersicht ablesen. Klick-Laufzeit = (tatsächliche ms − Ziel-ms) − (Abweichung zur roten Linie aus „Letzter Versand“).
4. 3–5 Tests, Mittelwert eintragen, Test-Befehle abbrechen. Der Wert gilt pro Internetanschluss.
