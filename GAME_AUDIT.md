# Sound Quest – Gameplay-Audit

Stand: 17. September 2026

## Priorität 1 – vor einem Release

### 1. Speichern und Fortsetzen

Der komplette Spielfortschritt lebt derzeit nur im Zustand der laufenden Browser-Sitzung. Nach einem Neuladen gehen Name, Level, XP, HP, Gate, Bossfortschritt und das Finale verloren.

Empfehlung:

- Autosave nach Fragmenten, Kämpfen, Level-ups, Gate und Boss
- „Fortsetzen“ und „Neues Spiel“ auf dem Titelbildschirm
- Spielerposition und bereits eingesammelte Fragmente mitspeichern
- Versionsnummer im Savegame, damit spätere Updates alte Spielstände migrieren können

### 2. Pause- und Einstellungsmenü

Musiklautstärke, Effektlautstärke und Mute sind technisch vorhanden, aber nur über `window.audio` in der Browser-Konsole erreichbar.

Empfehlung:

- Pause über Escape und einen mobilen Button
- Regler für Musik und Effekte
- Vollbild, Pixel-Skalierung und Textgeschwindigkeit
- Steuerungsübersicht
- Zurück zum Titelbildschirm

### 3. Battle-System mit echten Entscheidungen

Aktuell ist fast immer die zuletzt freigeschaltete Attacke die beste Wahl. `mp`, `maxMp`, Inventar und Item-Typen existieren bereits im Store, werden im Kampf aber nicht genutzt.

Empfehlung:

- MP-Kosten oder Cooldowns für starke Attacken
- Guard/Defend, Heilen und ein Item-Slot
- Statuseffekte wie Distortion, Mute und Reverb
- sichtbare Gegner-Telegraphen vor starken Attacken
- individuelle Stärken pro Attacke statt nur höherem Schaden

Konkreter Fehler: „Echo Wave“ verspricht zwei Treffer, zieht derzeit aber nur einmal Schaden ab.

### 4. Zielanzeige und Sammelfortschritt

Die Einleitung nennt „3 fragments / Level 2 / Defeat the Gatekeeper“, danach fehlt eine dauerhaft abrufbare Übersicht.

Empfehlung:

- kompakter Quest-Tracker im HUD oder Pause-Menü
- Anzeige `Fragmente 0/3`
- Hinweis, warum das Gate noch geschlossen ist
- Marker oder Richtungshinweis, wenn der Spieler länger nicht weiterkommt

### 5. Release-Build aufräumen

`public/` umfasst derzeit rund 136 MB. Der Build kopiert unter anderem WAV-Duplikate, große PNG-Quellen, zwei RAR-Archive, PSD-Dateien und alte NPC-Versionen mit aus.

Empfehlung:

- nur tatsächlich geladene WebP/MP3-Dateien in `public/`
- Quelldateien außerhalb von `public/` ablegen
- alte Varianten und Archive aus dem Deployment entfernen
- Entwicklungseditor und Cheat-Befehle nur im Development-Modus aktivieren

## Priorität 2 – Qualität und Spieltiefe

### Zonenabhängige Begegnungen

Jede Grasfläche wählt aktuell aus allen drei normalen Gegnern. Eigene Encounter-Tabellen pro Zone würden Schwierigkeitskurve und Weltgefühl verbessern.

Beispiel:

- Echo Village: Static Noise
- Neon Junction: Static Noise, Broken Signal
- Höhlen: Broken Signal, Silence

### Mehr Weltinteraktionen

Die Welt besitzt drei NPCs, zwei Schilder, drei Fragmente, Grasbegegnungen, Heilung, Gate und Boss. Für die Größe der Karte wären zusätzliche kleine Interaktionen wirkungsvoll:

- Radios, Plattenspieler und Terminals untersuchen
- kurze optionale NPC-Geschichten
- versteckte Kassetten oder Remix-Fragmente
- Abkürzungen nach geöffnetem Gate
- kleine Rätsel mit Frequenzen oder Klangfolgen

### Bestiarium und Archiv

Besiegte Gegnertypen werden bereits gespeichert, aber nicht angezeigt. Daraus kann ohne neues Kampfsystem ein Signal-Archiv entstehen:

- Gegnerbild und Attacken
- Anzahl der Siege
- gefundene Fragmente
- freigeschaltete Tracks
- Lore-Texte

### Bessere Belohnung für Kämpfe

Die drei Weltfragmente reichen exakt für Level 2 und damit für das Gate. Normale Kämpfe sind bis dahin weitgehend optional.

Empfehlung:

- Fragmente zusätzlich als sammelbare Schlüssel behandeln
- Kämpfe mit Heilitems, Archiv-Einträgen oder temporären Buffs belohnen
- vor dem Boss einen empfohlenen Level anzeigen

## Fehlende Audio-Inhalte

Im Manifest vorgesehen, aber noch nicht als Datei vorhanden:

```text
music/overworld/echo-village.mp3
music/overworld/signal-path.mp3
music/overworld/neon-junction.mp3
music/overworld/fading-path.mp3
music/overworld/resonant-cave.mp3
music/overworld/void-cave.mp3
music/overworld/living-core.mp3
music/overworld/the-core.mp3
music/battle/boss-phase1.mp3
music/battle/boss-phase2.mp3
music/battle/boss-phase3.mp3
sfx/battle/boss-phase-change.mp3
sfx/world/gate-blocked.mp3
sfx/world/respawn.mp3
sfx/ui/dialog-blip.mp3
sfx/ui/confirm.mp3
```

Die acht Overworld-Zonen verwenden deshalb momentan alle denselben Track. Gegnerattacken sind vollständig hörbar, teilen sich aber größtenteils drei allgemeine Monster-Sounds.

## Sinnvolle Reihenfolge

1. Save/Continue
2. Pause und sichtbare Audioeinstellungen
3. Quest- und Fragmentanzeige
4. Echo-Wave-Fehler sowie MP/Guard/Items
5. zonenabhängige Gegner
6. fehlende UI-, Gate- und Boss-Sounds
7. öffentliche Assets und Release-Werkzeuge aufräumen
8. Archiv, Nebeninteraktionen und optionale Sammelobjekte
