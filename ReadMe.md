<div align="center">

# 🎧 SOUND QUEST

### Find the Lost Track

**Enter the signal. Fight the noise. Recover what was lost.**

<br>

<img src="./docs/images/player.png" width="260" alt="Sound Quest Player">

<br><br>

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge\&logo=react\&logoColor=white)](https://react.dev/)
[![Phaser](https://img.shields.io/badge/Phaser-3.88-8A2BE2?style=for-the-badge)](https://phaser.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge\&logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge\&logo=vite\&logoColor=white)](https://vite.dev/)

<br>

*A browser-based, hand-painted RPG where music, signals and silence collide.*

</div>

---

## 📡 About the Game

**Sound Quest** is a music-inspired RPG built with Phaser, React and TypeScript, rendered in high resolution with painted, realistically lit artwork.

You enter a world where sound has been corrupted.

Explore strange environments, talk to musicians and survivors, collect fragments of the **Lost Track**, survive encounters with corrupted signals and fight your way toward the source of the silence.

Your goal is simple:

> **Recover the Lost Track before the signal disappears forever.**

---

## 🌌 Enter the Signal

The world of Sound Quest combines classic top-down RPG exploration with a modern audiovisual style inspired by music equipment, signal processing and digital distortion.

Travel through locations such as:

### 🌿 Echo Village

The beginning of your journey.

Meet the **Elder Muse**, learn what happened to the signal and begin searching for the missing fragments.

### ⚡ Neon Junction

A corrupted connection point filled with strange signals, musicians and dangerous encounters.

Meet characters such as **Quincy, the Junction Guard**, and **Kian Vero, the Wandering Musician**, while getting closer to the source of the disturbance.

### 🕳️ The Corrupted Cave

The signal becomes unstable.

Push deeper into the corruption, survive increasingly dangerous encounters and prepare for what waits below.

---

## ⚔️ Battle the Noise

Sound Quest features a custom turn-based battle system.

Enemies aren't traditional monsters.

They're broken pieces of the signal.

| Enemy                 | Threat                                                 |
| :-------------------- | :----------------------------------------------------- |
| 📺 **Static Noise**   | White Noise · Frequency Jab                            |
| 📡 **Broken Signal**  | Signal Burst · Distortion                              |
| 🔇 **Silence**        | Void Touch · Mute · Dead Air                           |
| 🚪 **The Gatekeeper** | Silence Wave · Void Crush · Gate Slam · Frequency Lock |

<br>

<div align="center">

<img src="./docs/images/enemy-silence.png" width="330" alt="Silence Enemy">

**The signal is fading.**

</div>

---

## 🎵 Fight Back With Sound

Your attacks are built around music and audio.

Use abilities such as:

```text
BASS DROP
ECHO WAVE
HOOK IMPACT
REVERB STRIKE
```

Each encounter uses its own battle interface with:

* Player and enemy HP
* Attack selection
* Damage variation
* Battle messages
* Animated attacks
* Enemy responses
* Experience rewards
* Boss phases
* Dynamic visual effects

The stronger you become, the further you can push into the corrupted signal.

---

## 👾 The Gatekeeper

At the deepest point of the journey waits **The Gatekeeper**.

A multi-phase boss encounter standing between you and the Lost Track.

<div align="center">

### `SIGNAL STATUS: CRITICAL`

```text
████████████████████████████████████
      CONNECTION UNSTABLE
████████████████████████████████████
```

</div>

The Gatekeeper has significantly more health than ordinary enemies and uses powerful attacks designed around silence, distortion and frequency control.

Defeat it to reach the final part of the signal.

---

## 🗺️ Explore the World

Sound Quest isn't just a battle screen.

The game includes a complete explorable overworld with:

* Player movement
* Animated directional sprites
* Collision
* Multiple world areas
* NPC interaction
* Dialog sequences
* Signs and environmental storytelling
* Tall grass encounters
* Random battles
* Gates and progression areas
* Cave environments
* Collectible fragments
* Boss trigger zones
* Respawning after defeat
* A complete finale sequence

---

## 🧍 Player Animation

The player uses separate directional animation frames for smooth overworld movement.

<div align="center">

<table>
<tr>
<td align="center">
<img src="./docs/images/player-down.png" width="120" alt="Player facing down">
<br>
<sub>Down</sub>
</td>

<td align="center">
<img src="./docs/images/player-left.png" width="120" alt="Player facing left">
<br>
<sub>Left</sub>
</td>

<td align="center">
<img src="./docs/images/player-up.png" width="120" alt="Player facing up">
<br>
<sub>Up</sub>
</td>

<td align="center">
<img src="./docs/images/player-right.png" width="120" alt="Player facing right">
<br>
<sub>Right</sub>
</td>
</tr>
</table>

</div>

---

## 💬 Meet the World

The journey includes several characters that guide the player through the story.

<div align="center">

<table>
<tr>
<td align="center">
<img src="./docs/images/npc-professor.png" width="150" alt="Elder Muse">
<br>
<strong>Elder Muse</strong>
</td>

<td align="center">
<img src="./docs/images/npc-guard.png" width="150" alt="Quincy, the Junction Guard">
<br>
<strong>Quincy — Junction Guard</strong>
</td>

<td align="center">
<img src="./docs/images/npc-musician.png" width="150" alt="Kian Vero, the Wandering Musician">
<br>
<strong>Kian Vero — Wandering Musician</strong>
</td>
</tr>
</table>

</div>

NPC conversations use animated dialog sequences and are tied directly into world progression.

---

## 🎮 Controls

### Desktop

| Action           | Control                  |
| ---------------- | ------------------------ |
| Move             | `WASD` / Arrow Keys      |
| Interact         | Keyboard interaction key |
| Navigate Battles | Mouse / Keyboard         |
| Select Attacks   | Battle UI                |

### Mobile

Sound Quest also includes dedicated mobile input handling, allowing the game to be played using touch controls.

---

## 🧩 Random Encounters

Walking through tall grass can trigger corrupted signals.

Every step carries a chance of starting an encounter.

```text
Walking...
Walking...
Walking...

⚠ WILD SIGNAL DETECTED
```

Enemies vary in strength and provide experience when defeated.

The further the journey progresses, the more dangerous the signal becomes.

---

## 💀 Death & Respawn

Losing a battle doesn't simply reload the browser.

Sound Quest contains a dedicated death sequence and respawn system.

After defeat:

1. The current encounter ends
2. The world is temporarily locked
3. The death sequence is shown
4. The player respawns
5. Exploration continues

Boss encounters can then be attempted again.

---

## 🗺️ Built-in Map Editor

The project also contains a custom editor for building and modifying the game world.

Features include:

* Tile painting
* Tile erasing
* Fill tool
* Tile selection
* Grid management
* Undo / redo
* Clipboard operations
* Camera movement
* Zoom controls
* World-coordinate conversion

The editor draws the map with the game's own terrain shader and artwork, so
what you paint is what you will walk through, including free-form houses built
from wall, window, door and roof tiles.

This makes the world easier to expand without manually placing every object in code.

---

## 🛠️ Tech Stack

<table>
<tr>
<td><strong>Game Engine</strong></td>
<td>Phaser 3</td>
</tr>

<tr>
<td><strong>UI</strong></td>
<td>React 19</td>
</tr>

<tr>
<td><strong>Language</strong></td>
<td>TypeScript</td>
</tr>

<tr>
<td><strong>State Management</strong></td>
<td>Zustand</td>
</tr>

<tr>
<td><strong>Build Tool</strong></td>
<td>Vite</td>
</tr>

<tr>
<td><strong>Styling</strong></td>
<td>Tailwind CSS</td>
</tr>
</table>

---

## 🏗️ Project Structure

```text
MiniGame/
│
├── public/
│   └── assets/
│       ├── player/
│       ├── enemies
│       ├── NPC artwork
│       └── game assets
│
├── src/
│   ├── game/
│   │   ├── art/
│   │   ├── assets/
│   │   ├── entities/
│   │   ├── input/
│   │   ├── render/
│   │   ├── scenes/
│   │   ├── systems/
│   │   ├── utils/
│   │   └── world/
│   │
│   ├── store/
│   ├── types/
│   └── main.tsx
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### Requirements

Make sure you have installed:

* **Node.js 18+**
* **npm**

### Clone the repository

```bash
git clone https://github.com/Nick190401/MiniGame.git
cd MiniGame
```

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

Vite will start the local development server.

Open the displayed local URL in your browser and enter the signal.

---

## 📦 Production Build

Create an optimized production build:

```bash
npm run build
```

The build copies only runtime assets into `dist`; archives, source artwork and
unused recordings stay in `public`. Images and generated sprite paths come from
the manifests in `src/game/assets`, and music/SFX from `AudioLibrary.ts`. Literal
`assets/...` URLs in UI components and CSS are included automatically. Register
new dynamically generated paths in a manifest used by `vite.config.ts`.
Missing required assets fail the build; optional audio slots may remain empty.

Run `npm run test:build` to check the asset selection rules.

Preview the production version locally:

```bash
npm run preview
```

---

## 🧠 Architecture

Sound Quest separates game logic from the surrounding application UI.

### Phaser

Responsible for:

* World rendering
* Player movement
* Physics
* Collision
* NPCs
* Battles
* Animations
* Effects
* Game scenes

### React

Responsible for the surrounding application interface and browser integration.

### Zustand

Maintains shared game state between systems and scenes.

### Event Bus

Game systems communicate through events instead of tightly coupling scenes together.

This allows systems such as:

```text
World
   ↓
Encounter
   ↓
Battle
   ↓
Result
   ↓
World
```

to remain separated while still sharing state.

---

## 🎨 Visual Direction

Sound Quest combines:

* High-resolution, painted presentation (no pixel art)
* A GPU terrain shader for grass, roads, paving, water and cliffs with organic borders, animated water and drifting cloud shadows
* Soft daylight from the upper left, cast shadows and an underground light system (darkness with glowing crystals, braziers and the player's own light)
* Acid green signal accents, cyan highlights and orange distortion effects
* Music-production imagery
* Modern typography
* Classic RPG mechanics

The result is a world somewhere between a classic RPG and a broken audio workstation.

### How the art is made

The ground is generated in code when the game loads; buildings, trees, props,
characters, enemies, the boss, the battle arenas and the title artwork are
painted HD images based on the original designs:

| Area | Source |
| --- | --- |
| Terrain | `src/game/world/terrain` (splat maps from the tile grid + shader) |
| Buildings, trees, bushes, rocks, flowers, bridge, gate, signs, cave props | `public/assets/world`, listed in `src/game/assets/WorldArt.ts` |
| Tall grass, gate wall, core circle and arch | `src/game/art` (painted in code) |
| Characters | `public/assets/characters/<id>`: 8-frame walk cycles and idle poses in four directions, a full-body illustration, a dialogue portrait and, for the hero, a battle stance |
| Enemies, boss and arenas | `public/assets/battle` |
| Title key art | `public/assets/title` |

World images are stored at 5 pixels per world unit and resampled once at load
to the screen's density (`src/game/art/paintedArt.ts`). They take over the
texture keys of the code painters, so placement, collision and the projected
shadows (`src/game/art/castShadow.ts`) stay as they are; if an image cannot be
loaded, the code painter draws that object instead. Light comes from the upper
left everywhere, matching the direction of the cast shadows.

The canvas renders at a multiple of the logical 640 x 480 board
(`src/game/render/RenderScale.ts`), so the game stays sharp on high-density
screens while gameplay keeps its original coordinates. The character images
in this README (`docs/images`) are the game's own frames and illustrations.

---

<div align="center">

<br>

<img src="./docs/images/player.png" width="210" alt="Player">

## THE TRACK IS STILL OUT THERE.

### Can you recover it before the signal goes silent?

<br>

```text
> CONNECTING TO SIGNAL...
> SEARCHING FOR LOST TRACK...
> CONNECTION ESTABLISHED.
```

<br>

**SOUND QUEST**

*Find the Lost Track.*

<br>

⭐ If you like the project, consider starring the repository.

</div>
