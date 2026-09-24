import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { Analyzer, analyzeWithClaude, basicAnalysis, buildTranscript, ANALYSIS_SCHEMA } from '../server/analyzer.js';
import { DEFAULT_SETTINGS, DAY, HOUR } from '../server/config.js';

// A stand-in for the Claude API that records what the SDK actually sends.
const requests = [];
let reply = () => ({ status: 200, body: okMessage(goodJson()) });
let server;
let baseURL;

function goodJson(overrides = {}) {
  return JSON.stringify({
    category: 'lead', interest: 120, sentiment: 'positive', ended_on_good_note: true, awaiting_their_reply: true,
    do_not_call: false, do_not_call_reason: '', intent: 'Bulk order', summary: 'Wants 5kg a month.',
    why_call: 'Close the first order.', opener: 'Hi Rohan!', talking_points: ['a', 'b', 'c', 'd'], ...overrides,
  });
}
function okMessage(text, extra = {}) {
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5',
    content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 }, ...extra,
  };
}

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ url: req.url, headers: req.headers, body });
      const { status, body: out } = reply(body);
      res.writeHead(status, { 'content-type': 'application/json', 'request-id': 'req_test' });
      res.end(JSON.stringify(out));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const NOW = Date.UTC(2026, 8, 24, 9, 0);
const chat = {
  id: '919800000001@c.us', name: 'Rohan Mehta', savedName: 'Rohan Mehta', number: '919800000001', isGroup: false, isBusiness: false,
  unreadCount: 0, lastActivityAt: NOW - DAY,
  messages: [
    { id: 'a', fromMe: false, ts: NOW - 3 * DAY, type: 'chat', body: 'Looking for 5kg a month for my café', ack: null },
    { id: 'b', fromMe: true, ts: NOW - DAY, type: 'chat', body: '₹1,180/kg with free delivery. Shall I set up Monday?', ack: 3 },
  ],
  callLogs: [{ ts: NOW - 4 * DAY, fromMe: false }],
};
const client = () => new Anthropic({ apiKey: 'sk-ant-test', baseURL, maxRetries: 0 });

test('Opus 5 request: structured output, adaptive thinking, low effort, server-side fallback, cached system prompt', async () => {
  requests.length = 0;
  reply = () => ({ status: 200, body: okMessage(goodJson()) });
  const result = await analyzeWithClaude(client(), { chat, crm: { calls: [] }, settings: DEFAULT_SETTINGS, ownerName: 'Asha', now: NOW });

  const { url, headers, body } = requests[0];
  assert.match(url, /^\/v1\/messages/);
  assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(body.model, 'claude-opus-5');
  assert.equal(body.fallbacks, 'default');
  assert.deepEqual(body.thinking, { type: 'adaptive' });
  assert.equal(body.output_config.effort, 'low');
  assert.deepEqual(body.output_config.format, { type: 'json_schema', schema: ANALYSIS_SCHEMA });
  assert.deepEqual(body.system[0].cache_control, { type: 'ephemeral' });
  assert.match(body.system[0].text, /specialty coffee brand/);
  const transcript = body.messages[0].content;
  assert.match(transcript, /Owner's name: Asha/);
  assert.match(transcript, /They read it \(blue ticks\) and haven't replied/);
  assert.match(transcript, /WhatsApp call from Them/);
  assert.match(transcript, /\] Me: ₹1,180\/kg/);

  // Normalised: interest clamped, talking points capped at 3.
  assert.equal(result.source, 'ai');
  assert.equal(result.interest, 100);
  assert.equal(result.talkingPoints.length, 3);
  assert.equal(result.basedOnMessageId, 'b');
  assert.equal(result.expectsReply, true);
});

test('Haiku 4.5 request: no thinking, no effort, no fallback beta', async () => {
  requests.length = 0;
  await analyzeWithClaude(client(), { chat, crm: {}, settings: { ...DEFAULT_SETTINGS, model: 'claude-haiku-4-5' }, now: NOW });
  const { headers, body } = requests[0];
  assert.equal(headers['anthropic-beta'], undefined);
  assert.equal(body.thinking, undefined);
  assert.equal(body.fallbacks, undefined);
  assert.equal(body.output_config.effort, undefined);
  assert.equal(body.output_config.format.type, 'json_schema');
});

test('a refusal is reported, not parsed', async () => {
  reply = () => ({ status: 200, body: okMessage('', { content: [], stop_reason: 'refusal' }) });
  await assert.rejects(
    analyzeWithClaude(client(), { chat, crm: {}, settings: DEFAULT_SETTINGS, now: NOW }),
    /declined/,
  );
});

test('runner analyses every pending chat and stops on a bad key', async () => {
  const data = {
    settings: { ...DEFAULT_SETTINGS, anthropicApiKey: 'sk-ant-test' },
    me: null,
    chats: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { ...chat, id }])),
    analysis: {},
    crm: {},
  };
  const store = { data, save() {} };
  const analyzer = new Analyzer({ store, createClient: client });
  analyzer.refreshBasic(NOW);
  assert.equal(data.analysis.a.source, 'basic');
  assert.equal(analyzer.pendingIds().length, 5);

  reply = () => ({ status: 200, body: okMessage(goodJson({ interest: 64 })) });
  await analyzer.run();
  assert.equal(analyzer.state.done, 5);
  assert.equal(analyzer.pendingIds().length, 0);
  assert.equal(data.analysis.c.interest, 64);

  reply = () => ({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } });
  await analyzer.run({ force: true });
  assert.match(analyzer.state.error, /API key was rejected/);
  assert.ok(analyzer.state.done < 5, 'stops early instead of failing every chat');
});

test('basic analysis reads obvious signals without AI', () => {
  const keen = basicAnalysis({ messages: [
    { id: '1', fromMe: false, ts: 1, type: 'chat', body: 'What’s the price for 2kg? Can you deliver this week?' },
    { id: '2', fromMe: true, ts: 2, type: 'chat', body: '₹2,400 with delivery. Shall I book it?' },
  ] });
  assert.ok(keen.interest >= 55, `interest ${keen.interest}`);
  assert.equal(keen.expectsReply, true);

  const no = basicAnalysis({ messages: [{ id: '1', fromMe: false, ts: 1, type: 'chat', body: 'Not interested. Please stop messaging.' }] });
  assert.equal(no.doNotCall, true);
  assert.equal(no.sentiment, 'negative');
});

test('transcript marks omitted history and unread messages', () => {
  const many = { ...chat, unreadCount: 2, messages: Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, fromMe: i % 2 === 0, ts: NOW - (40 - i) * HOUR, type: 'chat', body: `msg ${i}`, ack: 3 })) };
  const t = buildTranscript({ chat: many, crm: {}, settings: DEFAULT_SETTINGS, now: NOW });
  assert.match(t, /older ones are omitted/);
  assert.match(t, /2 message\(s\) from them/);
});
