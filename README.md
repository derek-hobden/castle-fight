# Castle Fight

A spiritual successor to the classic Warcraft 3 custom map **Castle Fight** — a 3D browser arena where you raise structures, muster auto-marching armies, and raze the enemy keep.

## Play

- **Local:** `npm install && npm run dev` → open [http://127.0.0.1:43123](http://127.0.0.1:43123)
- **Build:** `npm run build` (static output in `dist/`, ready for Vercel)

## How it works (MVP)

1. Two castles face each other across a fantasy lane.
2. Gold ticks over time (income rises as the match goes on).
3. Build **Barracks**, **Archer Range**, **War Stables**, or a **Watchtower** on your half of the map.
4. Buildings spawn units that auto-path and auto-fight — no micro required.
5. Destroy the enemy castle to win; lose if yours falls.

## Controls

- Click a structure in the build menu, then click open ground on your side to place it.
- Units and towers fight automatically.
- Surrender from the HUD if you want a clean defeat screen.

## Tech

- Vite + TypeScript + Three.js
- Procedural low-poly meshes (castle, buildings, units, terrain props) — Blender was not available in this environment, so assets are intentional Three.js geometry rather than GLTF exports.
- No auth, no database, no backend services.

## States

- **Menu** — branded title screen before the fight
- **In match** — income, build menu, castle HP bars
- **Victory / Defeat** — clear outcomes with a rematch
