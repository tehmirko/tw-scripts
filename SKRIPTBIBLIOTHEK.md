# Einreichung Skriptbibliothek (Beta-Welt ZZ1)

**Name:** Snipe-Timer DE

**Kurzbeschreibung:**
Snipe- und Timing-Hilfe für den Bestätigungsbildschirm (Angriff/Unterstützung). Rechnet komplett in Serverzeit, zeigt Abschickzeitpunkt, Countdown, Ton und eine rote Linie für den optimalen Klickzeitpunkt. Abgeschickt wird immer vom Spieler selbst.

**Beschreibung:**
- Läuft nur auf dem Bestätigungsbildschirm des Versammlungsplatzes bzw. im Karten-Popup.
- Eingabe der gewünschten Ankunft in Serverzeit (`20:15:30:123`, `morgen …`, `24.09. …`) oder per Klick auf einen laufenden Befehl zum Ziel.
- Zeigt Abschickzeitpunkt (Server- und Ortszeit), Countdown im Tab-Titel, Fortschrittsbalken mit Millisekunden und einer roten Linie für den optimalen Klickzeitpunkt (Abschickzeitpunkt minus vom Spieler eingetragene Klick-Laufzeit).
- Optionaler Countdown-Ton (Web Audio), Lautstärke/Sekunden einstellbar.
- Fokus-Hilfe: Nach der letzten Eingabe wird der Fokus auf den vorhandenen „Angreifen/Unterstützung schicken“-Button gesetzt und grün markiert, damit der Spieler mit Enter selbst abschicken kann. Enter in den Script-Feldern schickt nicht ab.
- „Letzter Versand“ zeigt, wie weit der eigene Klick vom geplanten Zeitpunkt entfernt war (nur lokal gespeichert).

**Regelkonformität:**
- Das Script schickt keine Befehle ab und klickt nichts selbst – jeder Befehl wird manuell vom Spieler ausgelöst.
- Einzige Server-Anfrage: beim Start (durch Klick des Spielers in der Schnellleiste) wird einmal die Dorfinfo des Ziels geladen, um laufende Befehle zum Ziel anzuzeigen (wie im Original-Snipetool).
- Einstellungen werden nur im localStorage des Browsers gespeichert.

**Basis:** Umbau des Snipetools von Ricardo/Bottenkraker (Serverzeit-Umbau, Fokus-Hilfe, rote Linie).
