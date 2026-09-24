import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import express from 'express';
import QRCode from 'qrcode';
import { CHROME_PATH, DATA_DIR, DAY, DEMO_ONLY, HOST, MODELS, PORT, PUBLIC_DIR } from './config.js';
import { createStore, emptyData } from './store.js';
import { WhatsAppService } from './whatsapp.js';
import { Analyzer, friendlyError } from './analyzer.js';
import { makeDemoData } from './demo.js';
import { OUTCOMES } from './priority.js';
import { buildContacts, buildStats, contactDetail, contactsCsv } from './views.js';

const store = createStore(path.join(DATA_DIR, 'db.json'));
const wa = new WhatsAppService({ dataDir: DATA_DIR, chromePath: CHROME_PATH });
const analyzer = new Analyzer({ store });
let sync = { running: false, done: 0, total: 0, current: null, error: null };

// ---------- Live updates to the browser (Server-Sent Events) ----------

const streams = new Set();
function send(event, payload) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of streams) res.write(chunk);
}
let stateTimer = null;
function pushState() {
  stateTimer ??= setTimeout(() => {
    stateTimer = null;
    send('state', appState());
  }, 150);
}
let contactsTimer = null;
function pushContacts() {
  contactsTimer ??= setTimeout(() => {
    contactsTimer = null;
    send('contacts', { at: Date.now() });
  }, 400);
}

function publicSettings() {
  const { anthropicApiKey, ...rest } = store.data.settings;
  return {
    ...rest,
    anthropicKeyHint: anthropicApiKey ? `${anthropicApiKey.slice(0, 10)}…${anthropicApiKey.slice(-4)}` : '',
    anthropicKeyFromEnv: !anthropicApiKey && Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

function appState() {
  return {
    whatsapp: wa.state,
    demoOnly: DEMO_ONLY,
    source: store.data.source,
    me: store.data.me,
    lastSyncAt: store.data.lastSyncAt,
    chatCount: Object.keys(store.data.chats).length,
    sync,
    analysis: { ...analyzer.state, pending: analyzer.pendingIds().length, configured: analyzer.configured },
    settings: publicSettings(),
    models: MODELS,
  };
}

// ---------- Demo data (your real data is set aside, not deleted) ----------

function loadDemo() {
  analyzer.cancel();
  const data = store.data;
  if (data.source === 'whatsapp') {
    data.stash = { chats: data.chats, analysis: data.analysis, crm: data.crm, me: data.me, lastSyncAt: data.lastSyncAt };
  }
  Object.assign(data, makeDemoData(), { source: 'demo', lastSyncAt: Date.now() });
  store.save();
}

function leaveDemo() {
  const data = store.data;
  if (data.source !== 'demo') return;
  analyzer.cancel();
  const stash = data.stash;
  delete data.stash;
  Object.assign(data, stash ?? { chats: {}, analysis: {}, crm: {}, me: null, lastSyncAt: null }, { source: stash ? 'whatsapp' : null });
  store.save();
}

// ---------- WhatsApp → store ----------

async function runSync() {
  if (sync.running || !wa.ready) return;
  sync = { running: true, done: 0, total: 0, current: null, error: null };
  pushState();
  try {
    const snapshots = await wa.syncChats(store.data.settings, (progress) => {
      Object.assign(sync, progress);
      pushState();
    });
    leaveDemo();
    const data = store.data;
    // Chats are replaced; analysis and your call log are kept per contact.
    data.chats = Object.fromEntries(snapshots.map((c) => [c.id, c]));
    data.source = 'whatsapp';
    data.me = wa.state.me;
    data.lastSyncAt = Date.now();
    analyzer.refreshBasic();
    store.save();
    pushContacts();
  } catch (err) {
    sync.error = err.message;
    console.error('[sync]', err);
  } finally {
    sync.running = false;
    sync.current = null;
    pushState();
  }
  if (!sync.error && store.data.settings.autoAnalyze && analyzer.configured) analyzer.run();
}

const refreshTimers = new Map();
wa.on('chat-activity', (chatId) => {
  if (store.data.source !== 'whatsapp' || chatId.split('@')[0] === store.data.me?.number) return;
  clearTimeout(refreshTimers.get(chatId));
  refreshTimers.set(chatId, setTimeout(() => refreshOne(chatId).catch((err) => console.warn('[refresh]', err.message)), 3000));
});

async function refreshOne(chatId) {
  refreshTimers.delete(chatId);
  if (sync.running) return; // the running sync will pick it up
  const snapshot = await wa.refreshChat(chatId, store.data.settings);
  if (!snapshot || (snapshot.isGroup && !store.data.settings.includeGroups)) return;
  store.data.chats[chatId] = snapshot;
  analyzer.refreshBasic();
  store.save();
  pushContacts();
  pushState();
}

wa.on('state', pushState);
wa.on('ready', () => {
  const data = store.data;
  const due = data.source !== 'whatsapp' || !data.lastSyncAt || Date.now() - data.lastSyncAt > 10 * 60 * 1000;
  if (due) runSync();
});
analyzer.on('progress', pushState);
analyzer.on('analyzed', pushContacts);
analyzer.on('finished', () => {
  pushContacts();
  pushState();
});

// ---------- HTTP ----------

const app = express();
app.disable('x-powered-by');

// Only answer requests addressed to this computer — blocks "DNS rebinding"
// tricks that would let a web page read your chats through the browser.
const loopback = ['127.0.0.1', 'localhost', '::1'].includes(HOST);
const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
app.use((req, res, next) => {
  if (!loopback || allowedHosts.has(req.headers.host)) return next();
  res.status(403).type('text').send('Call Desk only answers on localhost.');
});

// Changes must come from the dashboard itself (a custom header can't be sent cross-site).
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.get('x-call-desk') === '1') return next();
  res.status(403).json({ error: 'Blocked: request did not come from the dashboard.' });
});

app.use(express.json({ limit: '256kb' }));

const require = createRequire(import.meta.url);
// Folder of an installed package (their package.json isn't always resolvable directly).
function packageDir(name) {
  let dir = path.dirname(require.resolve(name));
  while (path.basename(dir) !== name && dir !== path.dirname(dir)) dir = path.dirname(dir);
  return dir;
}
app.use('/vendor/preact', express.static(packageDir('preact'), { index: false }));
app.use('/vendor/htm', express.static(packageDir('htm'), { index: false }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/state', (req, res) => res.json(appState()));

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: state\ndata: ${JSON.stringify(appState())}\n\n`);
  streams.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    streams.delete(res);
  });
});

app.get('/api/contacts', (req, res) => {
  const now = Date.now();
  const contacts = buildContacts(store.data, now);
  res.json({ contacts, stats: buildStats(store.data, contacts, now) });
});

function chatOr404(req, res) {
  const chat = store.data.chats[req.params.id];
  if (!chat) res.status(404).json({ error: 'Contact not found.' });
  return chat;
}

function changed(req, res) {
  store.save();
  pushContacts();
  pushState();
  res.json(contactDetail(store.data, req.params.id));
}

app.get('/api/contacts/:id', (req, res) => {
  if (chatOr404(req, res)) res.json(contactDetail(store.data, req.params.id));
});

app.post('/api/contacts/:id/call', (req, res) => {
  if (!chatOr404(req, res)) return;
  const { outcome, note = '', callbackAt = null } = req.body ?? {};
  if (!OUTCOMES[outcome]) return res.status(400).json({ error: 'Unknown call outcome.' });
  const crm = store.crm(req.params.id);
  crm.calls.push({ at: Date.now(), outcome, note: String(note).slice(0, 1000) });
  crm.override = null;
  crm.snoozeUntil = outcome === 'callback' ? Number(callbackAt) || Date.now() + DAY : null;
  changed(req, res);
});

app.post('/api/contacts/:id/undo-call', (req, res) => {
  if (!chatOr404(req, res)) return;
  const crm = store.crm(req.params.id);
  const removed = crm.calls.pop();
  if (removed?.outcome === 'callback') crm.snoozeUntil = null;
  changed(req, res);
});

app.post('/api/contacts/:id/update', (req, res) => {
  if (!chatOr404(req, res)) return;
  const body = req.body ?? {};
  const crm = store.crm(req.params.id);
  if ('notes' in body) crm.notes = String(body.notes ?? '').slice(0, 5000);
  if ('starred' in body) crm.starred = Boolean(body.starred);
  if ('override' in body) crm.override = ['first', 'next', 'later', 'skip', 'done'].includes(body.override) ? body.override : null;
  if ('snoozeUntil' in body) crm.snoozeUntil = Number(body.snoozeUntil) > Date.now() ? Number(body.snoozeUntil) : null;
  changed(req, res);
});

app.post('/api/contacts/:id/refresh', async (req, res) => {
  if (!chatOr404(req, res)) return;
  if (!wa.ready) return res.status(409).json({ error: 'Connect WhatsApp to refresh this chat.' });
  const snapshot = await wa.refreshChat(req.params.id, store.data.settings);
  if (snapshot) store.data.chats[req.params.id] = snapshot;
  analyzer.refreshBasic();
  changed(req, res);
});

app.post('/api/contacts/:id/analyze', async (req, res) => {
  if (!chatOr404(req, res)) return;
  if (!analyzer.configured) return res.status(400).json({ error: 'Add your Claude API key in Settings first.' });
  try {
    await analyzer.analyzeOne(req.params.id);
  } catch (err) {
    return res.status(502).json({ error: friendlyError(err, store.data.settings.model) });
  }
  changed(req, res);
});

app.post('/api/sync', (req, res) => {
  if (!wa.ready) return res.status(409).json({ error: 'Connect WhatsApp first.' });
  runSync();
  res.json({ ok: true });
});

app.post('/api/analyze', (req, res) => {
  if (!analyzer.configured) return res.status(400).json({ error: 'Add your Claude API key in Settings first.' });
  analyzer.run({ force: Boolean(req.body?.force) });
  res.json({ ok: true });
});

app.post('/api/analyze/cancel', (req, res) => {
  analyzer.cancel();
  res.json({ ok: true });
});

app.post('/api/settings', (req, res) => {
  const body = req.body ?? {};
  const s = store.data.settings;
  if (typeof body.businessContext === 'string') s.businessContext = body.businessContext.slice(0, 3000);
  if (typeof body.ownerName === 'string') s.ownerName = body.ownerName.trim().slice(0, 80);
  if (typeof body.anthropicApiKey === 'string') s.anthropicApiKey = body.anthropicApiKey.trim();
  if (MODELS.some((m) => m.id === body.model)) s.model = body.model;
  for (const key of ['autoAnalyze', 'includeGroups', 'includePersonal']) {
    if (typeof body[key] === 'boolean') s[key] = body[key];
  }
  const ranges = { seenAfterDays: [1, 30], staleAfterDays: [1, 365], maxChats: [10, 1000], messagesPerChat: [10, 200], lookbackDays: [7, 730] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const n = Math.round(Number(body[key]));
    if (body[key] !== undefined && Number.isFinite(n)) s[key] = Math.min(max, Math.max(min, n));
  }
  store.save();
  pushState();
  pushContacts();
  res.json(publicSettings());
});

app.post('/api/whatsapp/start', (req, res) => {
  if (DEMO_ONLY) return res.status(400).json({ error: 'Started with --demo. Run `npm start` to connect WhatsApp.' });
  wa.restart().catch((err) => console.error('[whatsapp]', err));
  res.json({ ok: true });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  await wa.logout();
  res.json({ ok: true });
  if (!DEMO_ONLY) wa.start().catch((err) => console.error('[whatsapp]', err)); // show a fresh QR code
});

app.post('/api/demo/load', (req, res) => {
  loadDemo();
  pushState();
  pushContacts();
  res.json({ ok: true });
});

app.post('/api/demo/exit', (req, res) => {
  leaveDemo();
  pushState();
  pushContacts();
  res.json({ ok: true });
});

app.post('/api/data/clear', (req, res) => {
  analyzer.cancel();
  store.replaceAll({ ...emptyData(), settings: store.data.settings });
  pushState();
  pushContacts();
  res.json({ ok: true });
});

app.get('/api/export.csv', (req, res) => {
  const tiers = String(req.query.tiers || 'first,next').split(',');
  const contacts = buildContacts(store.data).filter((c) => tiers.includes(c.tier));
  const day = new Date().toISOString().slice(0, 10);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="call-list-${day}.csv"` });
  res.send(contactsCsv(contacts));
});

app.get('/api/avatar/:id', async (req, res) => {
  const url = store.data.source === 'whatsapp' ? await wa.avatarUrl(req.params.id) : null;
  if (!url || !url.startsWith('https://')) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=3600').redirect(302, url);
});

// A QR code of tel:+number — scan it with your phone's camera to dial.
app.get('/api/dial-qr/:id', async (req, res) => {
  const chat = store.data.chats[req.params.id];
  if (!chat?.number || chat.demo) return res.status(404).end();
  const svg = await QRCode.toString(`tel:+${chat.number}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').send(svg);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong — see the terminal for details.' });
});

// ---------- Start ----------

// Open the dashboard in the default browser (set OPEN_BROWSER=0 to skip).
function openBrowser(url) {
  if (process.env.OPEN_BROWSER === '0') return;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['explorer', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true });
    child.on('error', () => {}); // no browser here — the link is printed in the terminal
    child.unref();
  } catch {
    // same as above
  }
}

app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Is Call Desk already running? Or set PORT=3001 in .env.` : err);
    process.exit(1);
  }
  console.log(`\n  ☕ Brulé Call Desk is running → http://localhost:${PORT}\n`);
  if (DEMO_ONLY) {
    loadDemo();
    console.log('  Demo mode: showing sample chats. WhatsApp is not started.\n');
  } else {
    console.log('  Starting WhatsApp… open the link above to scan the QR code.\n');
    wa.start().catch((e) => console.error('[whatsapp]', e));
  }
  openBrowser(`http://localhost:${PORT}`);
});

async function shutdown() {
  console.log('\n  Saving and closing WhatsApp…');
  try {
    store.flush();
  } catch (err) {
    console.error(err);
  }
  await Promise.race([wa.stop(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// whatsapp-web.js runs some async work in event handlers; log a failure there instead of crashing the dashboard.
process.on('unhandledRejection', (err) => console.error('[unhandled]', err));
