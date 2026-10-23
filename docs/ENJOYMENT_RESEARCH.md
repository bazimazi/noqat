# Making Noqat more enjoyable

Research and repository review: **22 October 2026**. This is a design opportunity map, not a claim that every game or cultural tradition has been surveyed. Features below are proposals unless explicitly described as present in the review baseline; this file is not an implementation changelog.

## What Noqat already does well

The starting point is unusually complete. The repository already contains six AI levels, chain/loop analysis, generated endgame puzzles, a seeded daily challenge, a 24-level campaign, trainer drills, speed/blitz games, two-to-four-player pass-and-play, online play, replay sharing, local progression, thirteen themes, eleven locales, Persian numerals/RTL, keyboard navigation, accessibility settings, procedural music and offline support. The Persian theme already uses turquoise/lapis/gold, an eight-point motif and Shur-inspired tuning.

The biggest opportunity is to make that depth visible and rewarding. Another ordinary difficulty level or cosmetic palette has less value than a new objective, an understandable result, a memorable capture, or a reason to replay a position.

Specific baseline findings from code review:

- `SetupScreen.tsx` exposes only classic, speed and blitz, although the core already supports misère and disabling capture extra turns.
- `ModeScreens.tsx` launches puzzles with a proven `context.par`, but the baseline result screen grades ordinary match victory. A player can meet a puzzle target below half the boxes and still receive a defeat headline.
- Trainer cards can reveal a best edge before play; there is room for an actual learn/try/explain loop during the attempt.
- The main menu's AI, pass-and-play and daily buttons all initially route to setup. Carrying intent into setup or launching the advertised challenge would reduce friction.
- Replay timelines, deterministic seeds and owner-less preplaced edges are reusable foundations for challenges, discoveries, coaching and asynchronous play.
- Existing support for reduced motion, sound controls and alternate palettes should apply to every new effect and objective.

These observations describe the review baseline, before concurrent implementation work.

## Research signals

### Preserve the real strategic hook

The game's interesting decisions involve chains, loops and keeping control rather than simply grabbing an available box. Allcock's research gives exact play for a restricted family of long-chain/loop endgames; it should not be advertised as solving arbitrary positions. Noqat can turn its existing analysis into short, visual lessons and post-game discoveries. [Best play in Dots and Boxes endgames](https://arxiv.org/abs/1811.10747)

There are established geometric expansions beyond square boxes. Dickson and Perrier study Dots-and-Triangles and Dots-and-Polygons on a lattice, including area scoring. These are real variants and useful long-term directions, but require new topology, hit testing, AI and accessibility work. [Dots-and-Polygons](https://arxiv.org/abs/2012.09971)

Strings-and-Coins is an established graph generalization, with Nimstring a related normal-play variant. A thread-and-knot view could eventually explain chains beautifully; changing the victory condition makes a different game and needs its own rules and search. [Strings-and-Coins and Nimstring are PSPACE-complete](https://arxiv.org/abs/2101.06361)

### Borrow repeatable play loops, not product clutter

Lichess demonstrates two distinct puzzle appetites: a timed run with progressively harder puzzles and combo bonuses, and an untimed streak with escalating challenge. Noqat can offer both using its own generated and verified content, with local personal bests before any public leaderboard. [Puzzle Storm rules](https://lichess.org/page/storm), [Puzzle Streak announcement](https://lichess.org/page/changelog-2021)

### Let Persian culture shape the play

UNESCO describes Persian gardens as geometric, often four-part layouts with sophisticated water management. This directly suggests a four-region objective or water-channel puzzle rather than a decorative name pasted onto an unrelated power-up. [The Persian Garden](https://whc.unesco.org/en/list/1372/)

Kashan carpet craft offers weaving, floral motifs, knotting and dyes as an internally coherent progression language. An expanding collection of completed patterns can make a player's history visible. This is design inspiration, not a simulation of carpet making. [Traditional skills of carpet weaving in Kashan](https://ich.unesco.org/en/RL/traditional-skills-of-carpet-weaving-in-kashan-00383)

The Met's Iranian eight-pointed tile combines blue/turquoise/white glaze, vegetal decoration and a poetry border. It is a useful concrete reference for restrained tile reveals and collectible medallions. Art reference does not imply permission to reuse arbitrary photographs. [Star-Shaped Tile, The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search/450428)

Yaldā/Chella includes family gathering, storytelling, poetry, games and music in Iran and Afghanistan. It is a natural home for hospitable local multiplayer and a long-night challenge collection. [Yaldā/Chella](https://ich.unesco.org/en/RL/yaldayelda-01877)

Nowruz provides renewal, visits, gifts and shared celebration as a seasonal framing; it is celebrated across several countries and should not be presented as exclusive to Iran. [UNESCO Nowruz decision](https://f5vip11.unesco.org/en/Decisions/11.COM/10.b.1)

The radif is a rich modal and melodic repertoire, taught through extensive practice and improvisation. The synthesized soundtrack should be described as Persian-inspired, not an authentic performance or a complete representation of a dastgāh. [Radif of Iranian music](https://ich.unesco.org/en/RL/radif-of-iranian-music-00279)

### Enjoyment includes comfortable input

WCAG's target-size guidance is especially relevant to tiny board edges on phones. Keep visible strokes delicate while making hit areas generous and unambiguous; provide keyboard alternatives and zoom for large boards. Interaction-triggered nonessential motion should be suppressible. [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## Prioritized opportunities

Labels distinguish **existing capability**, **established variant/pattern**, and **original Noqat concept**. Original means proposed here, not a claim of global novelty. Impact/effort estimates are design judgments that should be checked with real players.

| Priority | Opportunity | Provenance | Why players benefit | Scope |
| --- | --- | --- | --- | --- |
| P0 | Grade puzzles against par; show target met, score, best and retry | Existing capability, completed feedback | A successful solve should feel successful even when the AI owns more boxes | Small |
| P0 | Challenge destination with clear rule cards and previews | Existing capability + original packaging | Players immediately see what feels different | Medium |
| P0 | Reverse/misère preset | Established variant, already in core | Makes familiar greed suddenly dangerous | Small UI; verify AI |
| P0 | One-line-per-turn preset | Existing rule, deliberate variant | Breaks long capture monopolies and changes planning | Small UI; verify search |
| P0 | Capture-chain feedback, double-capture celebration and visible extra turn | Established feedback pattern | Creates moments of surprise and communicates turn ownership | Small/medium |
| P0 | Persian Caravan: curated stages with distinct openings and rules | Original Noqat concept | A coherent reason to explore, with a short session arc | Medium |
| P0 | Restore the exact active challenge across refresh | Existing persistence extended | Avoids losing a special attempt or silently changing its rules | Medium |
| P1 | One-tap rematch, new seed and retry same challenge as distinct actions | Established pattern | Separates learning a position from seeking novelty | Small |
| P1 | Coach explains capture, safe move, sacrifice or chain opening | Existing analysis, original delivery | Makes improvement understandable without reading a manual | Medium |
| P1 | Chain overlay on request, never forced in competitive play | Existing analysis | Reveals the game's real strategic structure | Medium |
| P1 | Post-game turning point and “try from here” | Existing timeline + original delivery | A loss creates curiosity and a useful next action | Medium |
| P1 | Personal best, completion seal and attempted/solved markers | Established progression pattern | Gives puzzle libraries a sense of history | Small/medium |
| P1 | Untimed puzzle streak and optional three-minute puzzle sprint | Established cross-game pattern | Serves both relaxed and energetic sessions | Medium |
| P1 | Daily target card, spoiler-free result share and replay later | Established daily pattern | Creates a shared conversation with low setup cost | Medium |
| P1 | Optional best-of-three local duel with alternating starter | Established competitive pattern | Makes one lucky opening less decisive and rematches meaningful | Medium |
| P1 | Small-board quick duel presets | Existing capability | Lets players choose a true two-minute session | Small |
| P1 | New-player first-box interactive lesson | Established tutorial pattern | Teaches drawing, capture and extra turn through action | Medium |
| P1 | Large-board pan/zoom or magnified edge selection | Established accessibility pattern | Reduces mis-taps without changing visual style | Medium |
| P2 | Chahar Bagh: own at least one tile in each garden | Original Noqat concept | Adds spatial trade-offs to an otherwise uniform board | Medium; objective grading |
| P2 | Kashan Loom: complete a visible row, border or symmetric motif | Original Noqat concept | Makes captured locations matter and grows a personal carpet | Medium; objective grading |
| P2 | Bazaar: openly valued saffron/turquoise/pomegranate tiles | Original Noqat concept using established weighted scoring | Creates tempting sacrifices and tactical hotspots | Large; rules + AI |
| P2 | Qanat: connect captured plots to a spring through a planned channel | Original Noqat concept | Introduces a spatial puzzle with a Persian engineering theme | Large; new objective solver |
| P2 | Mirror Court: paired symmetric moves when both are legal | Original Noqat concept | A readable spatial twist | Large; turn/capture semantics |
| P2 | Tea-house team game, two pairs around one board | Original packaging of team play | Welcoming social play with conversation | Medium/large |
| P2 | Handcrafted “one brilliant sacrifice” lessons with verified explanations | Established teaching pattern | Gives the trainer memorable names and discoveries | Medium |
| P2 | AI personalities such as patient planner and eager collector | Existing difficulty behavior, original presentation | Opponents become recognizable without adding engine tiers | Medium; honest descriptions |
| P2 | Share a challenge seed and compete on the identical position | Established asynchronous pattern | Social competition without simultaneous availability | Medium |
| P2 | Pattern album built from a player's completed challenge boards | Original Noqat concept | Cosmetic progress is tied to meaningful play | Medium |
| P2 | Yalda family pack and Nowruz renewal pack, always replayable | Cultural inspiration + original content | Seasonal identity without making missed days punitive | Medium |
| P3 | Triangular/polygon boards and area scoring | Established published variants | Visually and strategically substantial expansion | Large |
| P3 | Strings-and-Coins thread view | Established graph formulation, original presentation | Explains connectivity while enabling future graph boards | Large |
| P3 | Community puzzle editor with solver verification | Established creator-tool pattern | Players produce the most replayable content | Large |
| P3 | Persistent friends, correspondence and tournaments | Established online patterns | Supports a community after the solo game is strong | Large; backend/auth |
| P3 | Cooperative target puzzles with shared limited mistakes | Original Noqat concept | Lets mixed-ability players collaborate | Large; solvability design |

## A distinctive Persian direction

The product idea is **a welcoming courtyard of small strategic discoveries**. The Persian identity should appear in the rhythm, words, craft and goals, while every mode remains understandable to someone unfamiliar with Iran.

### Persian Caravan — recommended first original feature

Offer a small journey through named challenge cards. Each card has a Persian name with a short English explanation, a board thumbnail, one rule sentence, a clear target and an estimated session length. Possible stops:

1. **Isfahan Courtyard:** a symmetric pre-drawn opening; ordinary capture rules; learn to build a beautiful position.
2. **Kashan Weaver:** a compact capture challenge; target a proven score rather than match victory.
3. **Shiraz Reversal:** fewer boxes wins; use the existing misère rule.
4. **Yazd Rhythm:** each drawn line passes the turn, even after a capture; use the existing no-extra-turn rule.
5. **Yalda Gathering:** short pass-and-play duel; hospitable shared result language names the winner.
6. **Chahar Bagh:** a future four-region objective once region grading is implemented and tested.

The names and mechanics above are original proposals. They are not historical claims that those cities had these games. Keep tiles, woven borders and stars consistent across cards; use authentic place names without inventing quotations or sacred symbols. Reward completion with a small medallion and the best result. Let players replay freely.

### Language and typography

- Write Persian naturally, including نیم‌فاصله where appropriate; preserve language direction without reversing mathematical board coordinates unpredictably.
- Give each unusual rule a plain-language sentence and a visible in-game badge. A poetic title cannot carry the rules alone.
- Keep Persian numerals, date presentation and screen-reader text consistent with the selected locale.
- Ship a properly licensed Persian font only if offline delivery, file size and shaping have been verified; the baseline currently uses system font stacks.
- Ask Persian-speaking players to review copy and cultural details in a later playtest. An attractive motif alone cannot validate authenticity.

### Motion and sound

Drawn lines can feel like a brush or a ceramic join; captured tiles can reveal a geometric rosette. A chain of captures can create a gentle ascending phrase using the selected theme's scale. Double captures deserve a distinct, brief flourish. Keep effects local to the board so they do not obscure the next move.

Respect reduced motion, animation speed, music, effects and mute independently. Do not shake the screen, flash bright full-screen colors or make audiovisual feedback the only way to know whose turn it is. Instrument synthesis can suggest santur/ney timbres while remaining clearly described as an original synthesized score.

## Rule and architecture constraints

1. **Do not disguise a new scoring system as a theme.** Cultural appearance belongs to `themes/`; gameplay belongs to explicit rules/objectives. A Persian theme should remain usable in classic play.
2. **Variant-aware AI matters.** `SearchState`, minimax, endgame evaluation and heuristics must respect extra-turn/misère rules. Classical chain formulas assume their original rules. Fall back to a variant-aware search or restrict an experimental mode to local humans until support is proven.
3. **Weighted scoring is a real engine extension.** Update scores, search, winner selection, serialization, online validation, UI, par generation and statistics together. Never present a solver-proven target if the solver ignored tile values.
4. **Objectives need explicit metadata.** Mode id, challenge id/version, seed, target, scoring direction and special rules must survive autosave, replay and sharing. Do not infer them from a screen title or theme id.
5. **Use deterministic generation with validation.** Curated seeds are useful only if the resulting position is legal and its target stays reproducible. Version challenge content when generation or rules change.
6. **Separate objective success from match victory.** Puzzle, reverse, multi-seat and team results need their own correct interpretation. A replay should never pay rewards a second time.
7. **Avoid unsupported competitive promises.** Existing displayed AI Elo values are difficulty labels unless calibrated through a published rating process. Local personal bests require much less infrastructure than global ratings or leaderboards.
8. **Use profile progress as encouragement.** Unlock artwork and new learning goals; do not lock essential accessibility settings or punish missed daily sessions. Preserve completed content for return visits.

## Suggested release sequence

### First release: clear variety and satisfying play

Deliver a discoverable challenge destination, several carefully explained rule/opening presets, a clear active objective, puzzle target grading, capture feedback and persistent completion/best results. Make the default quick game remain easy to start. This creates real variety using the mature engine.

Success looks like a new player being able to explain the chosen challenge's objective before their first move, recognize an extra turn, finish a small board, understand the result and immediately retry or choose another challenge.

### Second release: learning and personal ritual

Add interactive first-box onboarding, contextual explanations, a turning-point replay, a puzzle streak, an optional timed puzzle sprint and a richer daily card. Use the same content and result infrastructure rather than multiplying special screens.

Success looks like a player knowing why a sacrifice worked, improving a personal best and voluntarily returning for a short daily session. These are hypotheses to validate with playtesting, not claims established by the cited research.

### Third release: richer boards and social play

Prototype Chahar Bagh and weighted Bazaar on small boards; evaluate whether new spatial decisions justify the extra rules. Build a puzzle editor, correspondence or tournaments only when the solo experience and challenge format are stable. Polygon boards are a separate substantial expansion.

## Verification plan for the implementation team

The baseline has `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and Playwright projects for desktop Chromium and Pixel 7. Browser tests should exercise the shipped production build and actual worker/persistence behavior, not just inject finished state.

Required browser journeys for a release adding challenges:

- First launch, quick play, each menu destination, back navigation and an entire small classic match.
- Every new preset: enter from its card, verify the stated rule/target, play legal moves, complete a match, inspect the correct result, retry and rematch.
- Explicit capture-turn checks in classic and no-extra-turn variants; explicit fewer-boxes winner in misère; draw and multi-player winner handling where supported.
- Puzzle target met and missed paths, including a successful target below half the board; target and completion persist after reload.
- Refresh in the middle of a special challenge, continue from the menu and verify challenge id, seed, objective and rules are identical.
- Undo/redo, hint, pause/resume, settings, replay scrubbing/playback, replay return, no duplicate rewards and no stale challenge banner.
- AI replies through the actual Web Worker in both classic and every AI-supported variant, including after undo/restart and captures.
- Daily challenge identity, streak/best updates and repeat attempt behavior with controlled dates; clarify shared UTC challenge rollover versus the user's local display date.
- Desktop and narrow phone layouts, portrait and landscape; no clipped target text, unreadable four-player cards, board overlap or horizontal overflow.
- Persian/RTL and English/LTR paths, keyboard navigation through every edge, accessible objective announcements, focus after navigation and result actions.
- Reduced motion and muted audio remain functional; new effects never block the next input or replay.
- Online two-tab validation, state synchronization and reconnect behavior after any shared rule/schema changes.
- Offline reload after service-worker installation and persistence across browser refresh.
- Collect browser errors and failed app requests; investigate failures instead of hiding them behind retries. Retain screenshots/traces for materially changed screens.

Automated tests cannot prove that a game is universally fun or cover every possible board. Report the actual projects, journeys and test counts that passed, and distinguish known limits from verified behavior. A short human playtest with beginners, strong players, Persian readers and keyboard/touch users is the next evidence needed after functional validation.
