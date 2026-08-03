# Noqat — نقطه‌خط

A Dots & Boxes game that takes both halves of the name seriously: a genuinely
strong engine underneath, and thirteen culturally handcrafted skins on top.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit + integration suite
npm run server       # optional: online multiplayer on ws://localhost:8787
```

---

## What is actually interesting here

### The engine plays real Dots & Boxes

Most implementations of this game are greedy: take every box you can see, then
move at random. That is not the game. The game is *chain theory* — long chains,
loops, tempo, and the counter-intuitive art of deliberately giving boxes away to
avoid being the one who has to open the next chain.

`src/core/analysis.ts` implements that theory (dual graph, chain/loop
decomposition, the long-chain parity rule, and Berlekamp's controlled-endgame
recursion), and `src/ai/` searches on top of it:

| Level | Elo | How it plays |
| --- | --- | --- |
| Beginner | 600 | Greedy and forgetful — misses free boxes about a third of the time |
| Easy | 900 | Greedy but attentive; never thinks about giving a box back |
| Medium | 1200 | MCTS with a knowledgeable playout policy, plus shallow alpha-beta |
| Hard | 1550 | Alpha-beta to depth 7, exact once 15 edges remain |
| Expert | 1900 | Iterative deepening, chain parity, exact under 19 edges |
| Grandmaster | 2350 | Exact loony-endgame solver; effectively unbeatable after the opening |

The weak levels are weak *in a human way*. Their defining flaw is greed — always
taking the boxes in front of them — which is exactly how a beginner loses, and
reads far more convincingly than adding random noise to a strong engine.

**Two independent implementations agree.** The closed-form chain formula in
`core/analysis.ts` and the game-tree search in `ai/endgame.ts` share no code, and
`features/modes/__tests__/endgame-crossvalidation.test.ts` asserts they produce
identical values on generated positions. That cross-check earned its keep: it
caught a missing case in the classical formula — the *half-hearted handout*,
where a two-box chain opened through its middle cannot be double-crossed, so it
concedes two boxes while keeping control. Without it the formula was wrong by up
to ten boxes on ordinary positions.

### Puzzles are generated and proved, not authored

`features/modes/library.ts` builds puzzles, daily challenges and trainer drills
by playing safe moves until a position decomposes into chains and loops, then
asks the solver what it is worth. Par is defined as *what the engine achieves
from here playing itself*, so every published target is demonstrably reachable,
and the library can grow forever without anyone hand-checking a position.

The trainer specifically searches for positions where greed and correctness
disagree — the only positions worth drilling.

### Themes are a plugin system, not a palette swap

A theme declares colour, type, motion, motif, particles and *music*; nothing in
the game branches on a theme id. Captured boxes are filled with real geometry —
girih stars for Persian, ruyi clouds for Chinese, Greek meanders, Talavera
rosettes, kente weave — drawn from `themes/motifs.tsx`.

Each theme also carries a **scale in cents**, so the generated soundtrack can be
tuned properly. Persian uses Dastgāh-e Shur with its quarter-flat *koron*
second; Turkish uses makam Hicaz with Holdrian comma inflections; Japanese uses
hirajoshi. A test asserts that those two are genuinely microtonal, because a
maqam rendered in equal temperament is just a minor scale wearing a hat.

Every one of the thirteen palettes is checked against WCAG AA contrast in
`themes/__tests__/themes.test.ts` — body text and captured-box labels both.

### There is no audio file in the bundle

All music and effects are synthesised at runtime (`src/audio/`): Karplus–Strong
plucked strings for santoor, koto, guzheng, sitar and oud; FM bells; breath-noise
flutes for ney and shakuhachi; resonant noise bursts for ceramic tile clicks. The
soundtrack is composed live from the theme's scale and reacts to how tense the
position is. Thirteen themes' worth of music costs zero bytes of download.

### Accessibility is load-bearing

- Full keyboard play. Arrow keys walk the edge lattice; a connectivity test
  proves every edge on a board is reachable, which is how a bug that stranded
  the bottom row and last column got caught.
- `aria-activedescendant` on the board, a labelled button per edge, and a live
  region that narrates every move and capture.
- High contrast mode, three colour-blind palettes, reduced motion, adjustable
  animation speed, large-UI scaling — all wired to CSS variables so they apply
  instantly and everywhere.
- RTL throughout, including mirrored arrow-key navigation and Unicode isolates
  around scores so "12 – 9" doesn't reverse inside Persian prose.

### Online play works without deploying anything

The protocol (`src/online/protocol.ts`) is shared verbatim between browser and
server, and `server/index.ts` imports the *same* core engine to validate every
move — the client is a renderer, never an authority. When no server is
configured, a `BroadcastChannel` transport lets two tabs on one machine play a
real game with identical validation, so the feature is never "coming soon".

To use the real server:

```bash
npm run server
VITE_NOQAT_SERVER=ws://localhost:8787 npm run dev
```

---

## Architecture

```
src/
  core/        pure rules + chain theory  (no deps, runs in browser/worker/node)
  ai/          search-state, minimax, MCTS, exact endgame, worker
  themes/      plugin contract, motif kit, backdrops, 13 packs, token bridge
  audio/       Web Audio synthesis, tuning, adaptive composer
  i18n/        11 locales, plurals, numerals, RTL, lazy catalogues
  state/       zustand stores (game timeline, settings, profile, ui)
  persistence/ IndexedDB repositories
  online/      protocol + transports
  features/    board, game, menu, result, themes, settings, stats, modes, online
server/        authoritative WebSocket server
```

Two rules keep it honest: **nothing in `core/` may import from the app**, and
**no game logic may branch on a theme id**. The first is what lets the server
and the AI worker share the engine; the second is what makes a theme
marketplace possible later without touching gameplay.

The game store keeps the entire position timeline rather than one current
position. Undo, redo, replay scrubbing, spectating and post-game analysis all
fall out of that one decision, and a finished 6×6 game costs a few kilobytes.

---

## Testing

```bash
npm test              # unit + integration (vitest, jsdom)
npm run typecheck
npm run e2e           # playwright; run `npx playwright install` first
npm run coverage
```

The suite covers the engine exhaustively (rules, geometry, chain decomposition,
endgame values verified by hand), AI strength ordering (Grandmaster must beat
Beginner; Expert must not lose to Easy), all eleven locale catalogues for
completeness and placeholder parity, WCAG contrast for every theme, protocol
validation against hostile input, and a set of app-level tests that mount the
real tree and play a game to completion through the UI in two locales.

The Playwright specs run against the production build and cover what jsdom
structurally cannot: screen transitions with real animations (a stalled exit
animation strands the app on the outgoing screen while every unit test still
passes), the Web Worker opponent actually answering, autosave surviving a
reload, and two browser tabs playing each other over the loopback transport.

---

## Scope and honest gaps

Built and working: the engine and all six AI levels, thirteen themes, procedural
audio, eleven locales with RTL, accessibility, PWA/offline, autosave, replays,
statistics, progression and unlocks, classic / speed / blitz / puzzle / daily /
campaign / trainer / pass-and-play modes, and online play against the bundled
server or between browser tabs.

Deliberately not built, and worth knowing before relying on them:

- **Accounts and cloud sync.** The server keeps rooms and ratings in memory and
  forgets them on restart. Real accounts need a database and an auth story; the
  protocol is shaped so adding one changes only where players are loaded from.
- **Seasonal leagues, tournaments, a theme marketplace.** The extension points
  exist (theme registry, mode generators, transport interface); the product
  surfaces do not.
- **Puzzle par is stated but not scored.** Puzzles carry a proven target and the
  result screen receives it, but nothing yet grades an attempt against it the
  way the campaign grades stars.
- **No Storybook.** The component primitives are small and covered by the
  jsdom tests; a story catalogue would be scaffolding without a design team
  consuming it.
- **Fonts** use per-locale system stacks rather than bundled webfonts, so the
  app stays fully offline-capable. On a system with no Devanagari or Arabic
  font installed, those locales fall back to whatever the OS provides.
- **Push notifications** are declared in the manifest but have no server to
  send them.

---

## Licence

MIT.
