# Enjoyment upgrade verification

Verified on 22 October 2026, Windows, Node 24.16.0.

## Results

| Check | Result |
| --- | --- |
| `npm test` | 358 passed across 20 files |
| `npm run build` | Passed, including TypeScript and the production PWA build |
| `npm run lint` | No errors; six existing Fast Refresh warnings in `src/i18n/index.tsx` |
| `git diff --check` | Passed |
| Production Playwright suite | 96 passed, 0 failed; desktop and Pixel 7 emulation, installed Chrome |

Browser command in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run e2e
```

Without that override, Playwright uses its downloaded Chromium. Each run builds and serves the production application. Four workers keep the browser suite within a reasonable local resource budget.

## What the browser checks cover

| Area | Verified behavior |
| --- | --- |
| Classic gameplay | Pointer and keyboard moves, captures, correct turn changes, complete matches and results |
| Persian Garden | Neutral symmetric opening, complete match, exact paths and turn restored after reload, shared replay |
| Reverse | Lowest score wins; complete real-worker AI match; preserved rules in a shared replay |
| One Line | A capture passes the turn; complete match; correct shared replay |
| Local multiplayer | Two, three and four players; correct individual scores, winners and replay player counts |
| Puzzles | Meeting par succeeds even in a 1–3 match loss; missed-par grade; saved stars and best; reversible pagination |
| Daily challenge | Direct launch, correct local calendar key, visible target, completion/streak, best score, quit/continue/reload context |
| Match feedback | Coach toggle, contextual advice, visible capture celebration, extra-turn message and completion strip |
| Timed play | Speed deadline draws a legal move; Blitz autosaves; clocks have separate restore regression tests |
| Controls | Pause blocks moves, confirmation cancels/commits once, a worker hint names a legal edge, Undo restores the decision |
| Accessibility | Named controls, skip link, keyboard play, high contrast and reduced-motion persistence |
| Persian | Authored new menu/coach copy, Persian labels and document RTL |
| Offline | Service worker activation, cached reload without a network, playable local match |
| Online | Two browser tabs exchange validated moves through the BroadcastChannel transport |
| Layout | Menu overflow checks; board, player cards and controls stay within 320×568, 360×740 and 740×360 viewports |

Screenshots of the menu and gameplay were visually inspected. They are regenerated under `test-results/screenshots/` and intentionally excluded from version control. The small-phone review caught board/card clipping; the final sizing and compact multiplayer scoreboard are covered by explicit element-bound checks.

The unit suite additionally checks core rules, independent exact-solver agreement, AI legality and strength, variant AI against an independent exhaustive reference, safe symmetric garden generation, share-code compatibility, profile migration, local-day boundaries, clock restoration, theme contrast and existing locale catalogues.

## Scope

The browser projects use desktop and mobile viewport/input emulation in Chrome. They do not claim physical-device, Firefox or Safari coverage. Online browser coverage exercises the bundled loopback transport, rather than a deployed public WebSocket service.

The [research roadmap](ENJOYMENT_RESEARCH.md) distinguishes implemented foundations from larger proposed concepts; the 33 proposals are not all implemented. New experience copy is authored in English and Persian, with English fallback for other locales.
