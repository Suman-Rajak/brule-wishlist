import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calldesk-test-'));
let child;

before(async () => {
  child = spawn(process.execPath, ['server/index.js', '--demo'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ANTHROPIC_API_KEY: '' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/state`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => {
  child.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const post = (p, body, headers = { 'X-Call-Desk': '1' }) =>
  fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body ?? {}) });
const contacts = async () => (await (await fetch(`${base}/api/contacts`)).json()).contacts;

test('serves the dashboard and its vendored modules', async () => {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Brulé Call Desk/);
  for (const p of ['/vendor/preact/dist/preact.module.js', '/vendor/preact/hooks/dist/hooks.module.js', '/vendor/htm/preact/index.module.js', '/app/main.js']) {
    assert.equal((await fetch(base + p)).status, 200, p);
  }
});

test('state reports demo mode without exposing secrets', async () => {
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.demoOnly, true);
  assert.equal(state.source, 'demo');
  assert.equal(state.chatCount, 30);
  assert.equal('anthropicApiKey' in state.settings, false);
});

test('changes need the dashboard header (no cross-site requests)', async () => {
  const res = await post('/api/demo/load', {}, {});
  assert.equal(res.status, 403);
});

test('requests for another host name are refused (DNS rebinding)', async () => {
  const status = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/api/state', headers: { Host: `evil.example:${port}` } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  assert.equal(status, 403);
});

test('logging a call moves the contact, and undo puts it back', async () => {
  const first = (await contacts()).find((c) => c.tier === 'first');
  const id = encodeURIComponent(first.id);

  const logged = await (await post(`/api/contacts/${id}/call`, { outcome: 'interested', note: 'Wants 2kg' })).json();
  assert.equal(logged.tier, 'done');
  assert.equal(logged.crm.calls.at(-1).note, 'Wants 2kg');

  const undone = await (await post(`/api/contacts/${id}/undo-call`)).json();
  assert.equal(undone.tier, 'first');

  const later = await (await post(`/api/contacts/${id}/call`, { outcome: 'callback', callbackAt: Date.now() + 3600e3 })).json();
  assert.equal(later.tier, 'snoozed');
  await post(`/api/contacts/${id}/undo-call`);

  assert.equal((await post(`/api/contacts/${id}/call`, { outcome: 'bogus' })).status, 400);
});

test('manual moves, stars and notes are saved', async () => {
  const c = (await contacts()).find((x) => x.tier === 'next');
  const id = encodeURIComponent(c.id);
  const moved = await (await post(`/api/contacts/${id}/update`, { override: 'skip', starred: true, notes: 'Prefers evenings' })).json();
  assert.equal(moved.tier, 'skip');
  assert.equal(moved.crm.starred, true);
  assert.equal(moved.crm.notes, 'Prefers evenings');
  const back = await (await post(`/api/contacts/${id}/update`, { override: null })).json();
  assert.equal(back.tier, 'next');
});

test('settings are validated and the API key is never sent back', async () => {
  const saved = await (await post('/api/settings', { seenAfterHours: 9999, model: 'not-a-model', anthropicApiKey: 'sk-ant-api03-abcdefghijklmnop' })).json();
  assert.equal(saved.seenAfterHours, 240);
  assert.equal(saved.model, 'claude-opus-5');
  assert.equal(saved.anthropicApiKey, undefined);
  assert.match(saved.anthropicKeyHint, /^sk-ant-api…mnop$/);
  await post('/api/settings', { anthropicApiKey: '' });
});

test('CSV export has today’s call list', async () => {
  const res = await fetch(`${base}/api/export.csv`);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /call-list-/);
  const lines = (await res.text()).trim().split('\r\n');
  assert.ok(lines.length > 5);
  assert.match(lines[1], /^1,Call first,/);
});

test('WhatsApp actions are refused in demo mode', async () => {
  assert.equal((await post('/api/sync')).status, 409);
  assert.equal((await post('/api/whatsapp/start')).status, 400);
});
