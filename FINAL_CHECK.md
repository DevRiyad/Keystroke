# FINAL CHECK - keystroke typing test

Date of check: 27 Oct 2026. Scope: whole project (client, server), security, mobile devices, accessibility.

## 0. Short summary (Bangla, English letters)

- Client-er shob main flow real Chromium-e chalano hoyeche: **215 browser check pass, 0 fail**. Unit test: **117 pass** (client 90, server 27).
- Security: client-e XSS, corrupt/tampered localStorage, blocked storage, strict CSP shob pass. Server-e security header, JSON-only write, fail-fast database fix korechi.
- Mobile: iPhone SE (320px), iPhone 13, Pixel 7 emulation-e touch, soft-keyboard-style input, IME composition, Backspace, paste block, landscape shob pass.
- **Ja verify hoy ni:** `npm install`, `vite build`, ESLint, asol `vitest`, server (`express` ar `mongoose` install nei), asol phone ar asol soft keyboard. Eigulo tomar machine-e chalate hobe (section 8).
- Ekta bhalo noy jinish: default yellow theme-er muted text contrast 2.17:1 (AA-te fail). Eta tomar dewa color palette, tai bodlai ni. Section 5 dekho.

## 1. How it was checked, and the limits

The sandbox has no network, so `npm install` was impossible. Instead:

- The real client source (`client/src`) was bundled with esbuild and run in a real Chromium (Playwright). Tailwind CSS was compiled with Tailwind 3.4.19 and the project's own `tailwind.config.js` (project pins 3.4.17). React in the sandbox is 19.2.5 (project pins 18.3.1). `lucide-react` was replaced by empty SVG stubs, so icon artwork was not seen.
- Pure logic (engine, statistics, words, settings, share, server validation) was run with Node's built-in test runner using a tiny shim for `vitest`, and type-checked with strict `tsc`.
- The server (`express`, `mongoose`) could not run. Its pure validation code was tested; the HTTP layer was only reviewed by reading.
- No real phone, no real soft keyboard, no Safari/Firefox, no Ryzen 3 3250U. Everything below was measured in a headless Chromium in a sandbox.

## 2. Results

| Suite | Result | What it covers |
|---|---|---|
| Browser: functional | 92 / 92 | typing, errors, Backspace rules, results, try again / next test, share, time-mode expiry (exactly 15.0 s), zen, custom, quote, settings + persistence, strict/blind, command palette, Tab+Enter, restart confirm, fast typing (no dropped/duplicated characters, line scroll, word refill) |
| Browser: layout | 28 / 28 | 320, 375, 768, 1280 px: no horizontal overflow (idle, results, settings dialog, custom panel), dialogs fit |
| Browser: security | 16 / 16 | XSS payloads, tampered/corrupt/blocked storage, no stray network calls, strict CSP with zero violations |
| Browser: mobile | 57 / 57 | 3 device profiles, touch, soft-keyboard-style input, IME composition, Android-style Backspace, paste block, tap targets, soft-keyboard resize, landscape |
| Browser: accessibility | 22 / 22 | names, landmarks, h1, keyboard order, focus ring, dialogs, live regions, chart alternative |
| Unit: client | 90 / 90 | engine, rules, timing (fake clock), stats, words/modes, settings, share |
| Unit: server | 27 / 27 | result validation (tamper/plausibility), settings, query, env, log redaction |
| `tsc` strict | pass | engine, stats, config, words, persist, settings, share, server validators |
| Server HTTP tests | written, not run | `server/src/api.test.ts` (needs express) |
| `vite build`, ESLint, real `vitest` | not run | needs `npm install` |

Measurements (headless sandbox, not your laptop): keystroke handler median < 0.01 ms, p95 0.1 ms, max 3.5 ms over 400 keystrokes. Production bundle estimate: JS 75 KB gzip, CSS 4.3 KB gzip.

## 3. Security

### Verified OK
- No `innerHTML`, `eval`, `dangerouslySetInnerHTML`, `document.write`, `window.open` in the client (code scan). HTML/script payloads typed as custom text stay literal text and never run.
- localStorage: garbage values, wrong types, `__proto__` keys, corrupt JSON, and a throwing/blocked `localStorage` all fall back to safe defaults with no console errors; the test still works without storage.
- The client makes no network requests of its own (only same-origin assets, plus Google Fonts in the real page).
- A strict CSP (`default-src 'self'; script-src 'self'; ...`, now shipped in `vercel.json`) runs the whole app with zero violations.
- No secrets in the repo (scan); `.env` is git-ignored, only `.env.example` is tracked; logs never contain bodies, headers or connection strings (redaction tested).

### Fixed during this check
- API responses now send `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and a locked-down CSP.
- POST/PUT must be `application/json` (415 otherwise).
- Mongoose buffering is now disabled per schema, so a down database fails fast instead of hanging; `MongooseError` maps to 503.
- Dependency security bumps: `vite 5.4.19`, `vitest 2.1.9` (dev-tool vulnerabilities fixed in later 5.4.x / 2.1.9). Version numbers could not be verified offline: if `npm install` rejects one, use the nearest newer patch.

### Server design, by code review (not executed)
Origin allow-list (403), CORS, 10 kb body limit (413), per-IP rate limit (read 120/min, write 20/min, 429), strict typed validation, Mongo queries built only from validated primitives, result numbers recomputed on the server, `x-powered-by` off, generic 500 messages.

### Residual risks (accepted or to decide)
| Risk | Severity | Note |
|---|---|---|
| Results can be fabricated | Medium for a public leaderboard | Server checks consistency and plausibility only. Client-side typing results cannot be made cheat-proof. Needs accounts + server-side evidence to go further. |
| Guest id is a bearer token | Low | Anyone who knows an id can read that guest's history/settings. Data is typing stats only. |
| No cap on stored results per guest, no delete endpoint | Low-Medium | Writes are rate limited (20/min/IP) but storage can still grow. Add a per-guest cap or TTL, and a delete endpoint (privacy). |
| Rate limiter is in memory | Low | Not shared between instances, resets on restart. Behind a proxy set `TRUST_PROXY`, otherwise all users share one bucket. |
| Nickname moderation | Low | Charset is restricted (no XSS), but no profanity/impersonation filter. |
| Dependencies not audited | Unknown | Run `npm audit` in `client/` and `server/`. |
| HSTS / HTTPS | - | Vercel serves HTTPS and `vercel.json` sets HSTS. |

## 4. Mobile

Tested with Playwright device profiles `iPhone SE` (320 px), `iPhone 13`, `Pixel 7`, plus landscape (844x390):

- No autofocus on touch devices (no surprise keyboard); a "click here or press any key" hint is shown; tapping the text focuses the input (this is what opens the real soft keyboard).
- Typing input is 16 px (prevents iOS zoom-on-focus); viewport meta does not block pinch-zoom.
- Text arriving without key events (soft keyboard), IME composition with replaced predictions, Android-style Backspace at the start of a word, deleting the rest of a word: all correct. Paste is blocked. A whole test completes with this input style.
- No horizontal overflow at 320 / 375 / 768 / 1280 px or in landscape; the 3-line text area keeps the caret visible after the viewport shrinks (keyboard-open simulation).
- Tap targets: all >= 24 px (WCAG 2.2 AA). On touch screens buttons are now at least 40 px high (added in this check). 21 controls are still below the 44 px "comfortable" size (advisory only).

Not testable here: real iOS Safari / Android Chrome soft keyboards (autocorrect, swipe typing, key repeat), real keyboard height behaviour, haptics. Please test on a real phone once; the first things to check are autocorrect/predictive text on Android and the caret position when the keyboard opens on iOS.

## 5. Accessibility

Passed: every control has an accessible name; one `h1`; header/nav/main/footer landmarks; no duplicate ids; skip link is the first focusable element; visible focus outline; dialogs have role, `aria-modal`, label, trap Tab, close with Esc and restore focus; radio groups labelled with one checked option; test completion is announced in a live region; chart has a text alternative (or a text empty state); `prefers-reduced-motion` is honoured; the typing input is described by the full test text.

Keyboard trap note: inside the typing input, Tab is used for Tab+Enter restart, so Tab does not leave it. Escape does (WCAG 2.1.2 allows this when the exit is documented). The exit is now in the visible hints and announced to screen readers.

### Colour contrast (WCAG AA = 4.5:1 normal text)
| Theme | Main text | Muted text | Accent | Error |
|---|---|---|---|---|
| yellow dark (default, your palette) | 8.05 pass | **2.17 FAIL** | 6.55 pass | **2.70 FAIL** |
| dark | 13.41 pass | 4.63 pass | 8.00 pass | 6.13 pass |
| light (accent darkened in this check) | 16.03 pass | 5.33 pass | 5.37 pass (4.66 on toolbar) | 4.99 pass |

The default theme uses the exact colours you specified (Monkeytype's palette), which are intentionally dim. Untyped words, labels and hints are therefore low contrast. The `dark` and `light` themes pass. Decision for you: keep the default for fidelity, or lighten `--muted` / `--error` in `client/src/styles/index.css` (for example muted `139 141 145` and error `224 97 109`) to pass AA at the cost of a less dim look.

## 6. Bugs found and fixed across the whole check

1. (Earlier phase) Theme colours did not support opacity classes (`bg-muted/60`), so keyboard-hint backgrounds were missing. Colours are now RGB channels; confirmed with the real Tailwind output.
2. Restart confirmation: pressing Escape could open the command palette instead of cancelling. Focus now moves into the confirmation; Escape cancels.
3. Footer buttons were below 24 px tall.
4. Page had no `h1`.
5. Light theme accent failed contrast on the toolbar; darkened.
6. Tab-trap exit was not visible to users; hint text and screen-reader description added.
7. Server: missing security headers, no content-type enforcement, possible request buffering when the database is down.
8. Two test-script mistakes (not app bugs) were found and corrected while checking (composition simulation, test text parsing).

## 7. Known limitations (unchanged)
Characters are UTF-16 code units (English only; Bangla needs a grapheme-aware layer and keyboard-layout testing). Sound plays only for desktop key input. Quote mode has 5 passages; word bank about 200 words. The client UI is not connected to the backend (no saving, history or leaderboard in the UI; the leaderboard button is disabled). Nothing has been deployed.

## 8. Run this on your machine before launch

```
cd typing-test
npm install
npm run typecheck
npm run lint
npm run test
npm run build
npm audit -w client
npm audit -w server
npm run dev                       # terminal 1
npm i -D playwright -w client && npx playwright install chromium
npm run e2e       # terminal 2 (all browser checks)
```
Backend: copy `.env.example` to `server/.env`, set `MONGODB_URI` and `CLIENT_ORIGIN`, run `npm run dev:server`, then `curl localhost:4000/api/health`.
Before deploying: see the Vercel section of `README.md` (headers come from `vercel.json`), use HTTPS, set `TRUST_PROXY` correctly, and test once on a real iPhone and a real Android phone.

## 9. Files
Project: `typing-test-final.zip`. Browser checks: `client/e2e/` (`e2e`, `layout`, `security`, `mobile`, `a11y`). Security headers: `vercel.json`. Docs: `README.md`.

## 10. Vercel changes (added after this check)
The project was adapted for Vercel (see `README.md`, section "Deployment on Vercel"): npm workspaces at the root, `vercel.json`, serverless entry `api/index.js`, lazy cached MongoDB connection, same-origin requests accepted by the API origin guard, trust-proxy default on Vercel, Vite dev proxy for `/api`, `tsconfig` moved to `Node16` module resolution. Verified here: JSON validity, syntax of `api/index.js`, that the compiled server emits exactly the files `api/index.js` requires, 27 pure server tests (new: origin rules, Vercel env default), strict type checks of the pure modules, and a full semantic compile whose only errors come from the missing third-party type packages. **Not verified:** an actual Vercel build or deployment, `npm install` with the workspace layout, the `/api` rewrite on Vercel, MongoDB Atlas connectivity from Vercel.

## 11. UI changes and production pass (latest)
- **Wider layout:** content width 1200 -> 1400 px (checked at 1920 px: 1400 px).
- **Focus mode:** as soon as the first key is typed, header, toolbar, language label, restart row, hints and footer are blurred and faded; only the timer (with live WPM) and the text stay sharp. A resting mouse does not reveal them; moving the mouse shows the page again until the next keystroke; keyboard focus inside a blurred area reveals it; everything returns when the test finishes or restarts. Verified in the browser (opacity/blur values, mouse peek, keyboard focus, restart, finish) and by screenshot.
- **New results screen:** hero WPM tile, animated accuracy ring, per-second chart with filled area, raw WPM / consistency (with bar) / time / keystrokes tiles, character breakdown bar with legend (correct / incorrect / extra / missed), primary "next test" button. Responsive (checked at 320, 375, 768, 1280 px; no overflow), reduced-motion respected, all previous behaviour kept (focus delay on "next test", share, try again).
- **Production/Vercel:** version 1.0.0; meta description + Open Graph tags; `robots.txt`; `.nvmrc`; GitHub Actions CI (`npm ci`, typecheck, lint, test, build); the Vercel deploy build no longer type-checks the client (so an unverified type nit cannot block a deploy; CI and `npm run build` do the type-check); header/rewrite patterns in `vercel.json` checked against sample paths.
- Browser scripts now write screenshots to the OS temp folder (they previously used a sandbox path).
- Still not verified: a real Vercel build/deploy, `npm install`, ESLint, real `vitest`, the server's HTTP layer, real phones.
