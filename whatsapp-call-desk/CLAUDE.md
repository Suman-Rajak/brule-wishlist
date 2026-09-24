# Brulé Call Desk — notes for Claude Code

A local dashboard that links to WhatsApp as a linked device (whatsapp-web.js driving a headless Chrome), reads recent one-to-one chats, and sorts people into call lists. Claude analyses each chat. It runs only on the owner's computer (`localhost`) and never sends WhatsApp messages.

## Run

- `npm install`, then `npm start` → http://localhost:3000 (opens the browser; `OPEN_BROWSER=0` skips that)
- `npm run demo` → 30 sample chats, WhatsApp not started, data kept apart in `data/demo/`
- `npm test` → node:test suite: list rules, the exact Claude request (against a fake API), the WhatsApp adapter (against a fake client), and the HTTP API
- Settings live in `.env` (see `.env.example`): `ANTHROPIC_API_KEY`, `PORT`, `CHROME_PATH`, `DATA_DIR`, `HOST`

## Layout

- `server/index.js`: Express API plus live updates over Server-Sent Events (`/api/events`). It only answers on localhost host names, and writes need the `X-Call-Desk: 1` header.
- `server/whatsapp.js`: the whatsapp-web.js wrapper.
  - QR login, with the session kept in `data/whatsapp-session`
  - `syncChats` / `snapshot`
  - WhatsApp call history, read through `pupPage.evaluate` because `fetchMessages` hides `call_log` entries
  - profile pictures
- `server/signals.js`: facts from a chat.
  - Read ticks: ack 3 or 4 means read.
  - "Left on seen": read and not replied to for `settings.seenAfterDays` (default 3).
  - Also who is waiting on whom, and calls.
- `server/priority.js`: the list rules (`first`, `next`, `later`, `skip`, `done`, `snoozed`), with reasons, badges and a score.
- `server/analyzer.js`: the Claude analysis and a keyword fallback.
  - Uses structured output (a JSON schema).
  - Defaults to `claude-opus-5` with adaptive thinking, low effort and server-side refusal fallbacks.
  - Analyses 3 chats at a time.
- `server/views.js`: contact view models, stats and the CSV export.
- `server/demo.js`: the sample data.
- `public/`: the dashboard, built with Preact and htm with no build step. An import map points to `/vendor/*`, which is served from `node_modules`.

## Things to know

- whatsapp-web.js is pinned to a GitHub commit (a tarball URL in `package.json`). The npm release 1.34.7 fails at login with "Cannot read properties of null (reading 'Socket')", because it reads WhatsApp's socket before WhatsApp Web has loaded it. To update, install a newer commit tarball from github.com/wwebjs/whatsapp-web.js. Don't use `npm install whatsapp-web.js@latest`, which brings back 1.34.7.
- On some Macs, the Chrome for Testing that Puppeteer downloads fails to launch with a `dlopen` error. The fix is to set `CHROME_PATH` in `.env` to Google Chrome or Brave.
- The WhatsApp side was written against the whatsapp-web.js source, but hasn't been checked against a real account yet. Check these on the first real sync:
  - `fetchMessages` results
  - ack values
  - the `call_log` extraction
  - phone-number lookup for `@lid` chats
- Never commit `data/` or `.env`. `data/` holds the WhatsApp session, synced chats, call log, notes and the saved API key; `.env` holds private settings.
