# Spidobot Cribbage

Cribbage im Browser für genau zwei Spieler, als kleiner Docker-Container (Node, keine Abhängigkeiten).

**Hausregel „Flush zählt immer“**
- Hand und Krippe: 4 Karten gleicher Farbe = 4 Punkte, +1 wenn die Startkarte dieselbe Farbe hat (die Krippe braucht also *keine* 5 Karten).
- Auslegen: liegen die letzten 4 oder mehr Karten in Folge in derselben Farbe, gibt es 1 Punkt pro Karte (z. B. 3♥ 4♥ 5♥ 6♥ = Straße 4 + Flush 4). 3 gleichfarbige Karten sind kein Flush.
- Die Mindestlänge beim Auslegen steht in `game.js` als `PEG_FLUSH_MIN`.

## Was es kann

- Karten mit der Maus oder dem Finger auf den Tisch ziehen (Klick geht auch)
- Alles bleibt liegen: ausgelegte Folgen mit „Go“, „31“ und „Letzte Karte“, Punkte fliegen als Animation ein, Stecker wandern übers Brett
- Ton & Ansage: Zählstand, „Go!“ und das klassische „fünfzehn 2, fünfzehn 4 …“ (abschaltbar)
- 0 Punkte heißen „19“ – mit Clown und Clownslachen
- Bewertung in %: wie gut war die Krippen-Auswahl und jede ausgelegte Karte – gemessen an den erwarteten Punkten mit dem, was man in dem Moment wissen konnte; dazu „gut gespielt“ gesamt und der direkte Vergleich beider Spieler
- Siegerehrung mit Podest und Vergleichstabelle
- Zählen im eigenen Tempo: jeder klickt die Hände selbst durch, weiter geht es erst, wenn beide fertig sind
- Kartenmotive: Klassisch, Tierisch, Monster, Futter, Weltall (pro Browser wählbar)
- Junge (J) statt Bube

## Unraid

**Mit Vorlage (empfohlen):** Unraid → Docker → *Add Container* → bei *Template* oben rechts die Vorlagen-URL eintragen
(oder `unraid/cribbage.xml` nach `/boot/config/plugins/dockerMan/templates-user/my-cribbage.xml` kopieren):

```
https://raw.githubusercontent.com/spidobot/cribbage/main/unraid/cribbage.xml
```

Die Vorlage setzt:

| Feld | Wert |
|---|---|
| Repository | `ghcr.io/spidobot/cribbage:latest` |
| WebUI-Port | Container `3000` → Host frei wählbar |
| Passwort (`PASSWORD`) | Passwort, das beide beim Hinsetzen eingeben. Leer = ohne Passwort |

Dann die WebUI öffnen, Namen und Passwort eingeben, Adresse an den Kumpel schicken.
Von außen braucht er einen Weg ins Heimnetz (Tailscale/WireGuard oder Reverse-Proxy) – dann unbedingt ein Passwort setzen.

Karten werden mit der Maus (oder dem Finger) auf den Tisch gezogen; ein Klick geht auch.

Der Spielstand liegt nur im Speicher: ein Neustart des Containers beendet das laufende Spiel und gibt beide Plätze frei.

Das Image baut GitHub Actions bei jedem Push auf `main` (`.github/workflows/docker.yml`).

## Lokal

```
node server.js     # http://localhost:3000
node test.js       # Wertungstests
```
