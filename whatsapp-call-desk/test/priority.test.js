import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../server/priority.js';
import { computeSignals, expectsReplyHeuristic } from '../server/signals.js';
import { DEFAULT_SETTINGS, DAY, HOUR } from '../server/config.js';
import { makeDemoData } from '../server/demo.js';
import { buildContacts, buildStats, contactsCsv } from '../server/views.js';

const NOW = Date.UTC(2026, 8, 24, 9, 0);
const settings = { ...DEFAULT_SETTINGS };

let seq = 0;
const msg = (agoMs, who, body, extra = {}) => ({
  id: `m${seq++}`,
  fromMe: who === 'me',
  ts: NOW - agoMs,
  type: 'chat',
  body,
  ack: who === 'me' ? 3 : null,
  ...extra,
});
const chat = (messages, extra = {}) => ({ id: 'x@c.us', name: 'Test', number: '919800000000', isGroup: false, messages, callLogs: [], ...extra });
const ai = (c, fields) => ({ source: 'ai', basedOnMessageId: c.messages.at(-1).id, interest: 50, sentiment: 'neutral', category: 'lead', endedOnGoodNote: false, expectsReply: true, doNotCall: false, ...fields });
const run = (c, analysis, crm) => classify({ chat: c, analysis, crm, settings, now: NOW });

test('read your question and did not reply for days → call first', () => {
  const c = chat([msg(5 * DAY, 'them', 'How much for 1kg?'), msg(4 * DAY, 'me', '₹2,400. Want me to send it?')]);
  const r = run(c, ai(c, { interest: 70 }));
  assert.equal(r.tier, 'first');
  assert.equal(r.leftOnSeen, true);
  assert.match(r.reason, /Read your message 4 days ago/);
  assert.ok(r.badges.some((b) => b.kind === 'seen'));
});

test('left on seen only counts after 3 days by default (changeable in Settings)', () => {
  const readAgo = (days) => chat([msg(days * DAY + HOUR, 'them', 'Price for 1kg?'), msg(days * DAY, 'me', '₹2,400 — shall I send it?')]);
  const two = readAgo(2);
  const r2 = run(two, ai(two, { interest: 40 }));
  assert.equal(r2.leftOnSeen, false);
  assert.equal(r2.tier, 'later');
  assert.match(r2.reason, /Read 2 days ago — give them a little time/);

  const three = readAgo(3);
  assert.equal(run(three, ai(three, { interest: 40 })).tier, 'first');

  const fourDaySetting = classify({ chat: three, analysis: ai(three, { interest: 40 }), settings: { ...settings, seenAfterDays: 4 }, now: NOW });
  assert.equal(fourDaySetting.tier, 'later');
});

test('a warm chat read recently waits in call next until the 3 days are up', () => {
  const c = chat([
    msg(DAY + 3 * HOUR, 'them', 'Loved the sample! What does the subscription cost?'),
    msg(DAY + 2 * HOUR, 'them', 'Would love 2 bags a month'),
    msg(DAY + HOUR, 'me', '₹1,150 for 2 bags. Shall I start you next week?'),
    msg(DAY, 'them', 'Let me check with my wife'),
    msg(DAY - HOUR, 'me', 'Sure! Want me to hold a spot?'),
  ]);
  const r = run(c, ai(c, { interest: 75, sentiment: 'positive' }));
  assert.equal(r.tier, 'next');
  assert.ok(r.badges.some((b) => b.kind === 'read'));
});

test('read too recently → not yet left on seen', () => {
  const c = chat([msg(DAY, 'them', 'Price?'), msg(30 * 60 * 1000, 'me', 'It is ₹650 — want one?')]);
  const r = run(c, ai(c, {}));
  assert.equal(r.tier, 'later');
  assert.match(r.reason, /give them a little time/);
});

test('a read sign-off is not "left on seen"; a warm chat goes to call next', () => {
  const c = chat([
    msg(3 * DAY, 'them', 'Loved the coffee! Will order at launch 😍'),
    msg(3 * DAY - HOUR, 'me', 'Amazing, thank you!'),
    msg(2 * DAY, 'them', 'Thanks!'),
    msg(2 * DAY - HOUR, 'me', 'Anytime ☕'),
  ]);
  const r = run(c, ai(c, { interest: 70, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false }));
  assert.equal(r.leftOnSeen, false);
  assert.equal(r.tier, 'next');
  assert.equal(r.reason, 'Good chat, not called yet');
});

test('polite but uninterested is not warm', () => {
  const c = chat([msg(5 * DAY, 'me', 'Want to try our sampler?'), msg(4 * DAY, 'them', 'Maybe later, thanks'), msg(4 * DAY - HOUR, 'me', 'No worries! 😊')]);
  const r = run(c, ai(c, { interest: 25, endedOnGoodNote: true, expectsReply: false }));
  assert.equal(r.tier, 'later');
});

test('grey ticks (delivered, not read) → maybe later', () => {
  const c = chat([msg(3 * DAY, 'me', 'Hi! Welcome to the waitlist — any questions?', { ack: 2 })]);
  const r = run(c, ai(c, { interest: 40 }));
  assert.equal(r.tier, 'later');
  assert.ok(r.badges.some((b) => b.kind === 'delivered'));
});

test('left on seen long ago → gone cold', () => {
  const c = chat([msg(70 * DAY, 'them', 'price?'), msg(69 * DAY, 'me', '₹650. Shall I send the menu?')]);
  const r = run(c, ai(c, { interest: 50 }));
  assert.equal(r.tier, 'later');
  assert.match(r.reason, /gone cold/);
});

test('do-not-call, spam, service and personal chats are skipped', () => {
  const c = chat([msg(DAY, 'them', 'Not interested, stop messaging')]);
  assert.equal(run(c, ai(c, { doNotCall: true, doNotCallReason: 'Asked you to stop' })).tier, 'skip');
  assert.equal(run(c, ai(c, { category: 'spam' })).tier, 'skip');
  assert.equal(run(c, ai(c, { category: 'service' })).tier, 'skip');
  assert.equal(run(c, ai(c, { category: 'personal' })).tier, 'skip');
  const withFamily = classify({ chat: c, analysis: ai(c, { category: 'personal', interest: 70 }), settings: { ...settings, includePersonal: true }, now: NOW });
  assert.notEqual(withFamily.tier, 'skip');
});

test('they called you on WhatsApp after the last message → call first', () => {
  const c = chat([msg(2 * DAY, 'them', 'Can I pay by UPI?'), msg(2 * DAY - HOUR, 'me', 'Yes 👍')], { callLogs: [{ ts: NOW - 5 * HOUR, fromMe: false }] });
  const r = run(c, ai(c, { interest: 80, expectsReply: false }));
  assert.equal(r.tier, 'first');
  assert.match(r.reason, /tried calling you/);
});

test('your WhatsApp call after the last message → called', () => {
  const c = chat([msg(3 * DAY, 'them', 'Tasting for my staff?'), msg(3 * DAY - HOUR, 'me', 'Yes! I’ll call you.')], { callLogs: [{ ts: NOW - DAY, fromMe: true }] });
  assert.equal(run(c, ai(c, { interest: 80 })).tier, 'done');
});

test('logged calls: interested → done, no answer stays with a badge, 3 no-answers → later', () => {
  const c = chat([msg(5 * DAY, 'them', 'Price?'), msg(4 * DAY, 'me', '₹650 — want it?')]);
  const a = ai(c, { interest: 70 });
  assert.equal(run(c, a, { calls: [{ at: NOW - HOUR, outcome: 'interested' }] }).tier, 'done');

  const once = run(c, a, { calls: [{ at: NOW - HOUR, outcome: 'no_answer' }] });
  assert.equal(once.tier, 'first');
  assert.ok(once.badges.some((b) => b.kind === 'attempts'));

  const thrice = run(c, a, { calls: [1, 2, 3].map((h) => ({ at: NOW - h * HOUR, outcome: 'no_answer' })) });
  assert.equal(thrice.tier, 'later');
});

test('call back: snoozed until due, then back on top', () => {
  const c = chat([msg(3 * DAY, 'them', 'Call me after my trip')]);
  const a = ai(c, { interest: 75, expectsReply: false });
  const calls = [{ at: NOW - 2 * DAY, outcome: 'callback' }];
  assert.equal(run(c, a, { calls, snoozeUntil: NOW + DAY }).tier, 'snoozed');
  const due = run(c, a, { calls, snoozeUntil: NOW - HOUR });
  assert.equal(due.tier, 'first');
  assert.match(due.reason, /call back/);
});

test('"not interested" on a call skips them — unless they write again later', () => {
  const c = chat([msg(3 * DAY, 'them', 'Price?'), msg(2 * DAY, 'me', '₹650')]);
  const a = ai(c, { interest: 60 });
  assert.equal(run(c, a, { calls: [{ at: NOW - DAY, outcome: 'not_interested' }] }).tier, 'skip');
  const again = chat([...c.messages, msg(HOUR, 'them', 'Actually, is the decaf out yet?')]);
  const r = run(again, ai(again, { interest: 60, sentiment: 'positive' }), { calls: [{ at: NOW - DAY, outcome: 'not_interested' }] });
  assert.notEqual(r.tier, 'skip');
});

test('your manual move wins, and a stale AI read falls back to the reply heuristic', () => {
  const c = chat([msg(5 * DAY, 'them', 'Hi'), msg(4 * DAY, 'me', 'Hello! How can I help?')]);
  assert.equal(run(c, ai(c, {}), { override: 'skip' }).tier, 'skip');
  const stale = { ...ai(c, { expectsReply: false }), basedOnMessageId: 'older' };
  const r = run(c, stale);
  assert.equal(r.analysisFresh, false);
  assert.equal(r.leftOnSeen, true); // "How can I help?" asks something
});

test('groups are skipped unless included', () => {
  const c = chat([msg(DAY, 'them', 'Meeting at 5?')], { isGroup: true });
  assert.equal(run(c, ai(c, {})).tier, 'skip');
});

test('expectsReplyHeuristic', () => {
  assert.equal(expectsReplyHeuristic({ fromMe: true, body: 'Thanks!', type: 'chat' }), false);
  assert.equal(expectsReplyHeuristic({ fromMe: true, body: 'You’re welcome ☕', type: 'chat' }), false);
  assert.equal(expectsReplyHeuristic({ fromMe: true, body: 'Shall I book it?', type: 'chat' }), true);
  assert.equal(expectsReplyHeuristic({ fromMe: true, body: '₹1,250 each for 25+', type: 'chat' }), true);
  assert.equal(expectsReplyHeuristic({ fromMe: false, body: 'Hi?', type: 'chat' }), false);
});

test('signals ignore system messages', () => {
  const c = chat([msg(2 * DAY, 'them', 'Hi'), msg(DAY, 'me', 'Hey!'), msg(HOUR, 'them', '', { type: 'e2e_notification' })]);
  const s = computeSignals(c, {}, settings, NOW);
  assert.equal(s.lastFromMe, true);
  assert.equal(s.theirCount, 1);
});

test('demo data lands in every list, and CSV export is spreadsheet-safe', () => {
  const data = { settings, source: 'demo', ...makeDemoData(NOW) };
  const contacts = buildContacts(data, NOW);
  const stats = buildStats(data, contacts, NOW);
  for (const tier of ['first', 'next', 'later', 'skip', 'done', 'snoozed']) assert.ok(stats.tiers[tier] > 0, tier);
  assert.equal(contacts[0].tier, 'first');
  assert.ok(contacts.every((c) => c.telUrl === null), 'demo contacts are not dialable');

  const csv = contactsCsv([
    { ...contacts[0], name: '=HYPERLINK("http://evil")', displayNumber: '+91 98765 43210' },
  ]);
  assert.ok(csv.startsWith('﻿Rank,List,Name'));
  assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"")"`));
  assert.ok(csv.includes('(+91) 98765 43210'));
});
