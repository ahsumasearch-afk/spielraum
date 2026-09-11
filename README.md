# Spielraum

Partyspiele für den Abend – direkt im Browser, ohne Konto und ohne Download.
Ein Gerät macht den Raum auf, alle anderen tippen den Code ein. Das Spiel läuft
per WebRTC direkt zwischen euren Geräten, ein Server ist nicht beteiligt.

**Live:** https://ahsumasearch-afk.github.io/spielraum/

## Die Spiele

| Spiel | Worum es geht | Spieler |
|---|---|---|
| [Fragen-Impostor](https://ahsumasearch-afk.github.io/impostor/) | Alle beantworten dieselbe Frage – einer nicht. Findet den Lügner. | 3–12 |
| [Mind-Match](./mind-match/) | Der King antwortet zuerst, alle anderen müssen etwas anderes sagen. | 2–12 |

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
die Fragen-Kategorien ein.

Beim Vergleich zählt die Schreibweise nicht: Groß- und Kleinschreibung, Umlaute
und ß, Satzzeichen, ein führender Artikel, Mehrzahl-Endungen und kleine
Vertipper werden ignoriert; Zahlwörter gelten wie Ziffern. „Der Hund", „hund"
und „Hunde" sind dieselbe Antwort, ebenso „zwei" und „2". Kurze Wörter, die sich
nur in einem Buchstaben unterscheiden, bleiben getrennt – „Hund" und „Bund"
zählen nicht als Treffer.

Die Fragen bleiben bewusst unpersönlich: keine Frage verlangt, jemanden aus dem
eigenen Umfeld zu nennen oder etwas Privates preiszugeben.

## Aufbau

```
index.html          Hub mit der Spielauswahl
mind-match/         das Spiel (statisch, kein Build)
  index.html
  css/style.css
  js/questions.js   459 Fragen in 17 Kategorien, vier Schwierigkeitsstufen
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


## Verbindung

Die Geräte reden direkt miteinander (WebRTC). Damit sie sich über verschiedene
Netze hinweg finden, fragen sie mehrere STUN-Server nach ihrer öffentlichen
Adresse – das genügt in den allermeisten Heim- und Mobilfunknetzen.

Wo ein Router gar keine direkte Verbindung zulässt (strenge Firmen- und
Gästenetze, manche Mobilfunkanschlüsse), muss der Datenstrom über einen
Relay-Server (TURN) laufen. Einen dauerhaft verlässlichen gibt es nicht
kostenlos ohne Konto. Eigene Zugangsdaten lassen sich auf zwei Wegen
hinterlegen:

* dauerhaft für alle: in `mind-match/js/net.js` in die Liste `TURN` eintragen
* nur für ein Gerät: **Verbindung testen** auf der Startseite → *Eigenes Relay
  hinterlegen*

Der Verbindungstest zeigt außerdem, ob der Treffpunkt-Server erreichbar ist und
ob das Gerät von außen gefunden wird – damit lässt sich einkreisen, woran es
hakt, wenn ein Spiel über Netzgrenzen hinweg nicht zustande kommt.
