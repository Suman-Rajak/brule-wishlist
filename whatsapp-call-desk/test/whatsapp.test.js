import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppService, normalizeMessage } from '../server/whatsapp.js';
import { DEFAULT_SETTINGS } from '../server/config.js';

// A fake whatsapp-web.js client with the same shapes the real library returns.
const nowSec = Math.floor(Date.now() / 1000);
const wmsg = (n, fromMe, body, extra = {}) => ({
  id: { _serialized: `msg_${n}` },
  fromMe,
  timestamp: nowSec - 3600 * (10 - n),
  type: 'chat',
  body,
  ack: fromMe ? 3 : 0,
  _data: {},
  ...extra,
});
const wchat = (id, { name, ageDays = 1, messages = [], contact = null } = {}) => ({
  id: { _serialized: id, user: id.split('@')[0], server: id.split('@')[1] },
  name,
  isGroup: id.endsWith('@g.us'),
  unreadCount: 1,
  timestamp: nowSec - ageDays * 86400,
  archived: false,
  pinned: false,
  isMuted: false,
  fetchMessages: async ({ limit }) => messages.slice(-limit),
  getContact: async () => contact,
});

function fakeClient() {
  const chats = [
    wchat('919800000001@c.us', {
      name: 'Priya',
      messages: [
        wmsg(1, false, 'Hi! Price for 250g?'),
        wmsg(2, true, '₹650'),
        wmsg(3, false, '', { type: 'e2e_notification' }),
        wmsg(4, false, '', { type: 'ptt', duration: 12 }),
        wmsg(5, false, 'our café', { type: 'image', directPath: '/x' }),
      ],
      contact: { id: { _serialized: '919800000001@c.us', user: '919800000001' }, name: 'Priya S', pushname: 'Priya', isBusiness: false, isMyContact: true },
    }),
    wchat('555000111222@lid', {
      name: 'Lid Person',
      messages: [wmsg(1, false, 'hello')],
      contact: { id: { _serialized: '555000111222@lid', user: '555000111222' }, name: null, pushname: 'Lid', isMyContact: false },
    }),
    wchat('120363000000@g.us', { name: 'Family group', messages: [wmsg(1, false, 'hi all')] }),
    wchat('status@broadcast', { name: 'Status' }),
    wchat('120363111111@newsletter', { name: 'A channel' }),
    wchat('919999999999@c.us', { name: 'Me (you)', messages: [wmsg(1, true, 'note to self')] }),
    wchat('919800000009@c.us', { name: 'Old chat', ageDays: 400, messages: [wmsg(1, false, 'ancient')] }),
  ];
  return {
    getChats: async () => chats,
    getChatById: async (id) => chats.find((c) => c.id._serialized === id),
    getContactLidAndPhone: async ([id]) => [{ lid: id, pn: '919812345678@c.us' }],
    getProfilePicUrl: async () => 'https://pps.whatsapp.net/v/pic.jpg',
    pupPage: {
      evaluate: async (fn, chatId) => (chatId === '919800000001@c.us' ? [{ ts: Date.now() - 1000, fromMe: false, isVideo: false }] : []),
    },
  };
}

function readyService() {
  const svc = new WhatsAppService({ dataDir: '/tmp/unused', chromePath: '' });
  svc.client = fakeClient();
  svc.state = { ...svc.state, status: 'ready', me: { name: 'Me', number: '919999999999' } };
  return svc;
}

test('sync keeps one-to-one chats only, newest first, within the lookback window', async () => {
  const progress = [];
  const snaps = await readyService().syncChats(DEFAULT_SETTINGS, (p) => progress.push(p));
  assert.deepEqual(snaps.map((s) => s.id), ['919800000001@c.us', '555000111222@lid']);
  assert.equal(progress.at(-1).done, 2);
});

test('groups are included when asked', async () => {
  const snaps = await readyService().syncChats({ ...DEFAULT_SETTINGS, includeGroups: true });
  assert.ok(snaps.some((s) => s.isGroup));
});

test('snapshot: names, numbers (incl. hidden @lid numbers), messages and call logs', async () => {
  const [priya, lid] = await readyService().syncChats(DEFAULT_SETTINGS);
  assert.equal(priya.name, 'Priya S');
  assert.equal(priya.number, '919800000001');
  assert.equal(priya.isMyContact, true);
  assert.deepEqual(priya.messages.map((m) => m.body), ['Hi! Price for 250g?', '₹650', '[voice note, 12s]', '[photo] our café']);
  assert.equal(priya.messages[1].ack, 3);
  assert.equal(priya.messages[0].ack, null);
  assert.equal(priya.callLogs.length, 1);

  assert.equal(lid.number, '919812345678');
  assert.equal(lid.name, 'Lid Person'); // WhatsApp's own chat title beats the push name
});

test('normalizeMessage drops system notices', () => {
  assert.equal(normalizeMessage({ id: { _serialized: 'x' }, type: 'notification_template', timestamp: 1 }), null);
  assert.equal(normalizeMessage({ id: { _serialized: 'y' }, type: 'revoked', timestamp: 1, fromMe: false }).body, '[deleted message]');
});

test('sync refuses to run when WhatsApp is not connected', async () => {
  const svc = new WhatsAppService({ dataDir: '/tmp/unused', chromePath: '' });
  await assert.rejects(svc.syncChats(DEFAULT_SETTINGS), /isn’t connected/);
});
