# Spielraum

Partyspiele für den Abend – direkt im Browser, ohne Konto und ohne Download.
Ein Gerät macht den Raum auf, alle anderen tippen den Code ein. Das Spiel läuft
per WebRTC direkt zwischen euren Geräten, ein Server ist nicht beteiligt.

**Live:** https://ahsumasearch-afk.github.io/spielraum/

## Die Spiele

| Spiel | Worum es geht | Spieler |
|---|---|---|
| [Fragen-Impostor](./impostor/) | Alle beantworten dieselbe Frage – einer nicht. Findet den Lügner. | 3–12 |
| [Mind-Match](./mind-match/) | Der King antwortet zuerst, alle anderen müssen etwas anderes sagen. | 2–12 |
| [Wavelength](./wavelength/) | Zwischen zwei Gegensätzen liegt ein verstecktes Ziel – nur das Medium sieht es. | 2–16 |

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

## Wavelength – die Regeln

1. Reihum ist ein Spieler das **Medium**. Es sieht als Einziges, wo auf der
   Skala zwischen zwei Gegensätzen (etwa *kalt* – *heiß*) der Zielbereich liegt.
2. Das Medium gibt **einen einzigen Hinweis** und sagt danach nichts mehr.
3. Die anderen drehen den Zeiger dorthin, wo sie das Ziel vermuten.
4. Im Teammodus tippt die Gegenseite zusätzlich, ob das Ziel weiter **links**
   oder **rechts** vom Zeiger liegt.

**Punkte:** 4 im Zentrum, 3 im Ring darum, 2 im äußeren Ring, sonst nichts.
Ein richtiger Links-rechts-Tipp bringt der Gegenseite **+1**. Gespielt wird bis
10, 20, 30, einer eigenen Zahl – oder ohne Ende.

Zwei Spielarten:

* **Zwei Teams** ab vier Leuten – beide Teams brauchen mindestens zwei, weil sie
  abwechselnd drankommen. Das Team am Zug dreht einen gemeinsamen Zeiger.
* **Jeder für sich** ab zwei Leuten – jeder tippt **verdeckt für sich** und
  bekommt die Punkte für den **eigenen** Abstand. Beim Aufdecken stehen alle
  Zeiger nebeneinander auf der Skala.

Das **Medium bekommt in beiden Spielarten keine Punkte** – es kannte das Ziel ja.
Im Teammodus zählt der Rundenertrag trotzdem voll für sein Team.
Es gibt einen Chat für alle und – im Teammodus – einen zweiten nur fürs eigene
Team. Der Host stellt Spielart, Punktziel und Zeitlimits ein, Aussehen und
Teamzugehörigkeit lassen sich im Warteraum ändern.

## Aufbau

```
index.html          Hub mit der Spielauswahl
mind-match/         das Spiel (statisch, kein Build)
  index.html
  css/style.css
  js/questions.js   425 Fragen: 17 Kategorien à 25, fünf Stufen à fünf Fragen
  js/core.js        Identität, Emojis, Farben, Hilfsfunktionen
  js/host.js        Spiellogik – der Host ist der Spielserver
  js/net.js         Verbindungen über PeerJS
  js/notify.js      Ton, Tab-Titel, Benachrichtigungen
  js/render.js      Oberfläche aktualisieren, ohne neu zu laden
  js/screens.js     Start-, Einladungs- und Fehlerbildschirme
  js/game.js        die Spielbildschirme
  js/app.js         Start
wavelength/         gleicher Aufbau; js/karten.js hält die 232 Begriffspaare
```

Bei jeder Änderung wird die Versionsnummer in `mind-match/index.html`
hochgezählt (`?v=…` an allen Dateien), damit niemand eine Mischung aus alten
und neuen Dateien lädt.


## Verbindung

Früher sprachen die Geräte direkt miteinander (WebRTC). Das ist schnell,
scheitert aber an Netzen, die eine direkte Verbindung von außen gar nicht
zulassen – strenge Firmen- und Gästenetze, manche Mobilfunkanschlüsse. Genau
daran sind Spiele über verschiedene Netze hinweg gescheitert.

Seit v2.0 läuft alles über einen öffentlichen Relay-Dienst (MQTT über
WebSocket). Jedes Gerät baut nur **eine ausgehende, verschlüsselte Verbindung**
nach außen auf – technisch dasselbe wie das Laden einer Webseite. Es gibt keine
Verbindung zwischen den Geräten mehr, die ein Router blockieren könnte. Damit
ist es egal, wer in welchem Netz sitzt.

Der Host bleibt der Spielserver: alle Nachrichten laufen über ihn, er rechnet
und schickt den Zustand zurück. Nur der Weg dorthin ist neu.

Die Dienste stehen in `js/net.js` unter `RELAYS`, in der Reihenfolge, in der
sie versucht werden. Nachgemessen: `broker.hivemq.com` stellt auch ganze
Nachrichtenschwälle vollständig zu, `broker.emqx.io` verliert dabei welche –
deshalb steht HiveMQ vorn und EMQX nur als letzter Notnagel.

Damit auch der beste Dienst nicht überfordert wird:

* Nachrichten gehen **bestätigt** raus und werden **bestätigt** abonniert
  (QoS 1 in beide Richtungen – ein Abo mit QoS 0 stuft sonst alles wieder
  herunter).
* Ausgehende Nachrichten werden auf ~70 ms Abstand **entzerrt**; ein noch
  nicht abgeschickter Zustand wird durch den neueren ersetzt.
* Der Zustand geht **einmal an alle** statt einmal je Spieler. Beim Impostor
  wird nur die persönliche Frage einzeln zugestellt, und auch nur dann, wenn
  sie sich geändert hat.
* Der Chatverlauf wird auf die letzten 50 Beiträge gekürzt, statt in jedem
  Paket komplett mitzugehen.
* Alle zehn Sekunden schickt der Host den vollen Zustand nach – sollte doch
  etwas verlorengehen, holt sich jeder von selbst wieder ein.

**Zur Vertraulichkeit:** Der Relay-Dienst ist öffentlich und ohne Konto
nutzbar. Die Spielnachrichten sind für Außenstehende uninteressant, aber sie
sind auch nicht geheim – wer den vierstelligen Raum-Code kennt oder errät,
könnte mitlesen. Für einen Spieleabend ist das in Ordnung; nichts Vertrauliches
in den Chat schreiben.

**Verbindung testen** auf der Startseite prüft, ob der Dienst erreichbar ist
und ob Nachrichten wirklich durchkommen.
