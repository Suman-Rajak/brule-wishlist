import { classify, sortContacts, TIERS, OUTCOMES } from './priority.js';
import { conversationMessages } from './signals.js';

export function formatNumber(digits) {
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

function initials(name) {
  const letters = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!letters.length) return '#';
  return (letters[0][0] + (letters.length > 1 ? letters.at(-1)[0] : '')).toUpperCase();
}

function hashHue(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 6;
}

export function buildContact(data, id, now = Date.now()) {
  const chat = data.chats[id];
  const analysis = data.analysis[id] ?? null;
  const crm = data.crm[id] ?? { calls: [], notes: '', snoozeUntil: null, override: null, starred: false };
  const verdict = classify({ chat, analysis, crm, settings: data.settings, now });
  const s = verdict.signals;
  const demo = Boolean(chat.demo);
  const callable = Boolean(chat.number) && !demo;

  return {
    id,
    name: chat.name,
    note: chat.note ?? (chat.pushname && chat.pushname !== chat.name ? `~${chat.pushname}` : null),
    number: chat.number,
    displayNumber: formatNumber(chat.number),
    telUrl: callable ? `tel:+${chat.number}` : null,
    waUrl: callable ? `https://wa.me/${chat.number}` : null,
    avatar: data.source === 'whatsapp' && !demo ? `/api/avatar/${encodeURIComponent(id)}` : null,
    initials: initials(chat.name),
    hue: hashHue(id),
    demo,
    isGroup: chat.isGroup,
    isBusiness: chat.isBusiness,
    isMyContact: chat.isMyContact,
    unreadCount: chat.unreadCount ?? 0,
    lastActivityAt: chat.lastActivityAt,
    tier: verdict.tier,
    reason: verdict.reason,
    badges: verdict.badges,
    score: verdict.score,
    lastMessage: s.last ? { body: s.last.body, fromMe: s.last.fromMe, ack: s.last.ack, ts: s.last.ts, type: s.last.type } : null,
    signals: {
      leftOnSeen: verdict.leftOnSeen,
      awaitingReply: s.awaitingReply,
      theyCalled: s.theyCalledSince,
      hadConversation: s.hadConversation,
      everCalled: s.everCalled,
      noAnswerAttempts: s.noAnswerAttempts,
      daysSinceLast: s.daysSinceLast,
    },
    analysis: analysis && {
      source: analysis.source,
      model: analysis.model ?? null,
      analyzedAt: analysis.analyzedAt,
      fresh: verdict.analysisFresh,
      error: analysis.error ?? null,
      category: analysis.category,
      interest: analysis.interest,
      sentiment: analysis.sentiment,
      intent: analysis.intent,
      summary: analysis.summary,
      whyCall: analysis.whyCall,
      opener: analysis.opener,
      talkingPoints: analysis.talkingPoints ?? [],
      endedOnGoodNote: analysis.endedOnGoodNote,
      doNotCall: analysis.doNotCall,
      doNotCallReason: analysis.doNotCallReason,
    },
    crm: {
      calls: crm.calls ?? [],
      notes: crm.notes ?? '',
      snoozeUntil: crm.snoozeUntil ?? null,
      override: crm.override ?? null,
      starred: Boolean(crm.starred),
    },
  };
}

export function buildContacts(data, now = Date.now()) {
  const list = sortContacts(Object.keys(data.chats).map((id) => buildContact(data, id, now)));
  const rank = {};
  for (const c of list) c.rank = rank[c.tier] = (rank[c.tier] ?? 0) + 1;
  return list;
}

export function buildStats(data, contacts, now = Date.now()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const tiers = Object.fromEntries(TIERS.map((t) => [t, 0]));
  for (const c of contacts) tiers[c.tier]++;
  let calledToday = 0;
  for (const crm of Object.values(data.crm)) calledToday += (crm.calls ?? []).filter((c) => c.at >= startOfDay.getTime()).length;
  return {
    total: contacts.length,
    tiers,
    calledToday,
    leftOnSeen: contacts.filter((c) => c.signals.leftOnSeen).length,
    awaitingReply: contacts.filter((c) => c.signals.awaitingReply && ['first', 'next', 'later'].includes(c.tier)).length,
    aiAnalyzed: contacts.filter((c) => c.analysis?.source === 'ai' && c.analysis.fresh).length,
  };
}

export function contactDetail(data, id, now = Date.now()) {
  const contact = buildContact(data, id, now);
  const chat = data.chats[id];
  return {
    ...contact,
    messages: chat.messages ?? [],
    callLogs: chat.callLogs ?? [],
    conversationLength: conversationMessages(chat.messages).length,
  };
}

const TIER_LABEL = { first: 'Call first', next: 'Call next', later: 'Maybe later', skip: "Don't call", done: 'Called', snoozed: 'Snoozed' };

function csvCell(value) {
  let v = value === null || value === undefined ? '' : String(value);
  // Stop spreadsheets from treating text as a formula.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// "+91 98765 43210" would be read as a formula by Excel; "(+91) 98765 43210" stays text.
const csvPhone = (display) => (display ? display.replace(/^\+(\d{1,3}) /, '(+$1) ') : '');

export function contactsCsv(contacts) {
  const header = ['Rank', 'List', 'Name', 'Phone', 'Why', 'Interest', 'Mood', 'What they want', 'Summary', 'Say this first', 'Last message', 'Last message at', 'Calls logged', 'Last call outcome', 'Notes'];
  const rows = contacts.map((c) => [
    c.rank,
    TIER_LABEL[c.tier],
    c.name,
    csvPhone(c.displayNumber),
    c.analysis?.whyCall || c.reason,
    c.analysis?.interest ?? '',
    c.analysis?.sentiment ?? '',
    c.analysis?.intent ?? '',
    c.analysis?.summary ?? '',
    c.analysis?.opener ?? '',
    c.lastMessage ? `${c.lastMessage.fromMe ? 'You' : 'Them'}: ${c.lastMessage.body}` : '',
    c.lastMessage ? new Date(c.lastMessage.ts).toLocaleString() : '',
    c.crm.calls.length,
    c.crm.calls.length ? OUTCOMES[c.crm.calls.at(-1).outcome] : '',
    c.crm.notes,
  ]);
  // BOM so Excel reads ₹ and emoji correctly.
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
