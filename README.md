# Spielraum

Partyspiele für den Abend – direkt im Browser, ohne Konto und ohne Download.
Ein Gerät macht den Raum auf, alle anderen tippen den Code ein. Das Spiel läuft
per WebRTC direkt zwischen euren Geräten, ein Server ist nicht beteiligt.

**Live:** https://ahsumasearch-afk.github.io/spielraum/

## Die Spiele

| Spiel | Worum es geht | Spieler |
|---|---|---|
| [Fragen-Impostor](https://ahsumasearch-afk.github.io/impostor/) | Alle beantworten dieselbe Frage – einer nicht. Findet den Lügner. | 3–12 |
| [Mind-Match](./mind-match/) | Der King antwortet zuerst, alle anderen müssen etwas anderes sagen. | 3–12 |

## Mind-Match – die Regeln

1. Reihum ist ein Spieler der **King** und beantwortet alle Fragen der Runde zuerst und allein.
2. Danach beantworten die anderen dieselben Fragen.
3. Ziel: **nicht** dasselbe antworten wie der King.
4. Alle außer dem King haben Leben (Standard: 3).
5. Gleiche Antwort wie der King → ein Leben weniger.
6. Keine Leben mehr → ausgeschieden, schaut zu.
7. Sind am Ende alle ausgeschieden → der King bekommt **+2 Punkte**.
8. Hält mindestens einer durch → alle außer dem King bekommen **+1 Punkt**.

Der Host stellt im Warteraum Rundenzahl, Fragen pro Runde, Leben, Zeitlimits und
die Fragen-Kategorien ein. Groß- und Kleinschreibung, Satzzeichen und ein
führender Artikel werden beim Vergleich ignoriert – „Der Hund" und „hund"
zählen als dieselbe Antwort.

## Aufbau

```
index.html          Hub mit der Spielauswahl
mind-match/         das Spiel (statisch, kein Build)
  index.html
  css/style.css
  js/questions.js   374 Fragen in 17 Kategorien, leicht bis schwer
  js/core.js        Identität, Emojis, Farben, Hilfsfunktionen
  js/host.js        Spiellogik – der Host ist der Spielserver
  js/net.js         Verbindungen über PeerJS
  js/notify.js      Ton, Tab-Titel, Benachrichtigungen
  js/render.js      Oberfläche aktualisieren, ohne neu zu laden
  js/screens.js     Start-, Einladungs- und Fehlerbildschirme
  js/game.js        die Spielbildschirme
  js/app.js         Start
```

Bei jeder Änderung wird die Versionsnummer in `mind-match/index.html`
hochgezählt (`?v=…` an allen Dateien), damit niemand eine Mischung aus alten
und neuen Dateien lädt.
