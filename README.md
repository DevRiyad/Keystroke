# keystroke - a minimalist typing test

A Monkeytype-inspired typing speed test (original branding). React + TypeScript + Vite + Tailwind on the client, an optional Express + MongoDB backend.

The typing test runs entirely in the browser. It never needs the backend or a database.

## Requirements
Node.js 20.12+ (22 recommended) and npm. MongoDB is only needed for the optional backend features.

## Install and run
The repo is an npm workspace (`client/` and `server/`): one install at the root.
```
npm install                  # installs client + server (creates package-lock.json: commit it)
npm run dev                  # client: http://localhost:5173
```
Optional backend (the client dev server proxies `/api` to it, so URLs are same-origin like on Vercel):
```
cp .env.example server/.env  # set MONGODB_URI (leave empty to run without persistence)
npm run dev:server           # http://localhost:4000, check: curl localhost:4000/api/health
```

## Scripts (run from the repo root)
| Script | What it does |
|---|---|
| `npm run dev` / `dev:server` | start the client / server in watch mode |
| `npm run typecheck` | `tsc --noEmit` for client and server |
| `npm run lint` | ESLint for client and server |
| `npm run test` | Vitest for client and server |
| `npm run build` | type-check + production build of both (`client/dist`, `server/dist`) |
| `npm run build:vercel` | what Vercel runs: the same builds without the client type-check (CI does the type-check) |
| `npm run start:server` | run the built server (`node server/dist/server.js`) |
| `npm run e2e` | optional real-browser checks (see below) |

## Features
- Layout up to 1400 px wide. Focus mode: once you start typing, everything except the timer and the text is blurred; moving the mouse shows the page again until your next keystroke, and everything returns when the test ends.
- Modes: time (15/30/60/120), words (10-200), quote, zen, custom text. Punctuation and numbers toggles (time/words).
- Accurate timing from `performance.now()`; a time test ends exactly at `start + limit` even in a throttled background tab.
- Results screen: WPM and accuracy ring, per-second speed chart, raw WPM, consistency, time, keystrokes, character breakdown bar, next test / try again / share.
- Settings (saved in localStorage; unavailable or corrupt storage falls back to defaults): theme (yellow dark / dark / light), font size, font, cursor style, cursor animation, typing mode (normal / confidence / strict), sound (off by default), blind mode, live WPM, confirm restart. Reduced-motion is respected.
- Shortcuts: Tab then Enter restart; Esc releases typing focus, Esc again or Ctrl/Cmd+Shift+P opens the command palette (modes, durations, themes, settings); Shift+Enter finishes zen; Ctrl/Alt+Backspace deletes a word. Note: Firefox reserves Ctrl+Shift+P, use Esc there.
- Input: a real labelled `<input>` (desktop via keydown, mobile/IME via an input-event diff), so screen readers and mobile keyboards work. Dialogs trap focus and restore it on close.

## How statistics are calculated (`client/src/features/typing/stats.ts`)
- Net WPM = correct characters / 5 / minutes. Raw WPM = all keystrokes (mistakes included, Backspace excluded) / 5 / minutes.
- Correct/incorrect/extra/missed come from the final state of each word. A Space that closes a word is 1 correct char if the word was exact, otherwise 1 incorrect. The word still being typed is never "missed".
- Accuracy = correct keystrokes / all keystrokes (a corrected mistake still counts). 0 when nothing was typed.
- Consistency = 100 * (1 - tanh(cov + cov^3/3 + cov^5/5)), cov = stdev/mean of per-second raw WPM; empty with fewer than 2 full seconds.
- Zero elapsed time gives 0 WPM (never NaN/Infinity). Live and final numbers use the same function.
- Zen mode has no target text: every keystroke counts as correct (accuracy 100%).

## Backend API (optional)
| Endpoint | Needs | Purpose |
|---|---|---|
| `GET /api/health` | - | status + `database: up/down` (never rate limited) |
| `POST /api/results` | `X-Guest-Id` | save a validated result (201) |
| `GET /api/history?limit=` | `X-Guest-Id` | the caller's latest results |
| `GET /api/leaderboard?mode=&duration=&wordCount=&limit=` | - | best result per guest, time/words modes |
| `GET/PUT /api/settings` | `X-Guest-Id` | guest settings (PUT replaces all fields) |

Errors: `{ "error": { "code", "message", "details?" } }` with 400 validation, 403 origin, 404, 413, 429, 503 (database down), 500.

- Guest mode: the client creates a random id (16-64 chars) and sends it as `X-Guest-Id`. It identifies a browser, it is not authentication: anyone who knows an id can read that guest's history. The leaderboard shows only a nickname, never the id.
- Result validation (`server/src/validation/result.ts`): the server recomputes WPM, raw WPM and accuracy from the submitted counts and elapsed time, rejects values that disagree with the client's claim, enforces plausibility limits (max 350 WPM, max 25 keystrokes/s, time-mode elapsed must match the duration, correct chars <= correct keystrokes) and stores its own numbers. **Client-side results cannot be made cheat-proof**: someone can still submit a complete, consistent, fabricated set of numbers. These checks stop accidental and careless bad data only.
- Security: JSON body limit 10 kb, origin allow-list or same-origin + CORS, per-IP rate limits (stricter for writes), no `x-powered-by`, typed validation (raw request objects never reach Mongo queries), request bodies/headers/connection strings are never logged.
- The client UI is **not yet connected** to these endpoints (no saving, leaderboard or guest id in the UI). The leaderboard button is disabled.

## Configuration (`.env.example`)
`PORT`, `MONGODB_URI` (empty = no persistence), `CLIENT_ORIGIN` (comma-separated browser origins allowed to call the API), `TRUST_PROXY` (number of reverse proxies in front of the server), `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `WRITE_LIMIT_MAX`. Never commit a real `.env`. The client needs no environment variables.

## Deployment on Vercel (whole project from GitHub)
How it is wired (all config is in the repo, nothing to set in the dashboard except env vars):
- `vercel.json`: installs at the repo root, runs `npm run build:vercel` (builds the client with Vite and compiles the server to `server/dist`), serves `client/dist` as the site, rewrites `/api/*` to the serverless function, and sets security headers (CSP etc.) for the pages.
- `api/index.js`: the Vercel function. It loads the compiled Express app, connects to MongoDB lazily (connection cached while the instance is warm) and hands the request to Express. The API and the site share one domain, so there is no CORS to configure; production, preview and custom domains all work (same-origin requests are always allowed).

Steps:
1. Locally run `npm install` once and commit the generated `package-lock.json`. Run `npm run typecheck && npm run lint && npm run test && npm run build` and fix anything that fails. The deploy itself does not type-check the client, so this step (and the GitHub Actions workflow in `.github/workflows/ci.yml`, which runs the same commands on every push) is what protects you from shipping type errors.
2. Push to GitHub (`.gitignore` already excludes `node_modules`, `dist` and `.env*`).
3. MongoDB Atlas: create a cluster and a database user limited to one database with a strong password. Vercel functions have no fixed IP, so under Network Access allow `0.0.0.0/0` (the password is then your protection) or use Vercel's MongoDB Atlas integration / Secure Compute. Pick the Atlas region closest to your Vercel function region.
4. Vercel: Add New > Project > import the GitHub repo. Framework Preset: **Other**. Root Directory: the repo root (`./`). Leave the build/output settings as they are (they come from `vercel.json`).
5. Environment Variables (Production and Preview): `MONGODB_URI` = your Atlas connection string. Optional: `CLIENT_ORIGIN` (only if another site must call the API), `RATE_LIMIT_MAX`, `WRITE_LIMIT_MAX`. Do not set `TRUST_PROXY` (defaults to 1 on Vercel).
6. Deploy, then open `https://<your-project>.vercel.app/api/health`. Expect `{"status":"ok","database":"up",...}`. Without `MONGODB_URI` you get `"database":"down"` and the persistence endpoints answer 503; the typing test itself works either way.

Serverless notes:
- The in-memory rate limiter is per function instance, so it is only a soft limit on Vercel. Add a rate-limit rule in Vercel Firewall (dashboard > Firewall) for `/api/*` for real protection.
- The first request after a pause (cold start) also opens the database connection and is slower. Function timeout is set to 10 s.
- Preview deployments get their own URL; they use the same `MONGODB_URI` unless you set a different value for Preview (recommended: a separate database).
- Vercel's preview-comment toolbar injects scripts that the strict CSP blocks on Preview URLs; production is unaffected. Loosen `script-src` in `vercel.json` only if you need that toolbar.
- The client UI does not call the API yet (see Known limitations), so right now the deployed API is reachable but unused by the pages.

Nothing in this repository has been deployed by me; the steps above have not been run end to end.

## Testing
- `npm run test` runs Vitest unit tests: typing engine (keys, backspace rules, finish, reset, strict/confidence, time limit with a fake clock, refill, zen, keystroke log, listener cleanup), statistics, word generation, mode building, custom-text validation, settings/config persistence, share logic, plus server validation, env parsing and an HTTP test suite (`server/src/api.test.ts`, uses an in-memory store).
- `client/e2e/*.mjs` are optional browser checks (functional flows, layout at 320-1280 px, security probes, mobile device emulation incl. soft-keyboard/IME-style input, accessibility audit; `npm run e2e` runs all). They need `npm i -D playwright -w client && npx playwright install chromium`, the dev server running, then `npm run e2e` (set `E2E_URL` if the port differs).

## Security notes
- Client: no `innerHTML`/`eval`/`dangerouslySetInnerHTML` anywhere; custom text is rendered as plain text; localStorage content is validated field by field (corrupt, tampered or blocked storage falls back to defaults); the client makes no network calls of its own.
- Pages: `vercel.json` sets a strict Content-Security-Policy and other security headers (the policy was tested against the app with zero violations; `connect-src 'self'` is enough because the API is same-origin). On other hosts copy the headers from `vercel.json`.
- API: origin allow-list, JSON-only writes (415 otherwise), 10 kb body limit, per-IP rate limits (in memory, per process), security headers on every response, typed validation, no sensitive data in logs. Run `npm audit` in `client/` and `server/` before releasing.
- Residual risks: guest ids are not authentication; results can be fabricated (see above); there is no cap on stored results per guest and no delete endpoint; nicknames are not profanity-filtered.

## Known limitations
- Characters are UTF-16 code units: fine for English. Bangla needs a grapheme-aware layer and a layout/keyboard test pass; the word bank and engine are structured so a language can be added, but it is not implemented.
- Sound plays only for desktop keyboard input (not the mobile/IME path).
- Quote mode has 5 passages; the English word bank has about 200 words.
- Guest data has no expiry or delete endpoint.
- Package versions are pinned to versions known to be compatible but were chosen without network access in the build environment.
# Keystroke
# Keystroke
