import { computeSignals, expectsReplyHeuristic } from './signals.js';

export const TIERS = ['first', 'next', 'later', 'skip', 'done', 'snoozed'];

export const OUTCOMES = {
  interested: 'Interested',
  callback: 'Call back later',
  no_answer: 'No answer',
  not_interested: 'Not interested',
  wrong_number: 'Wrong number',
};

const MOVED = {
  first: 'You moved them to Call first',
  next: 'You moved them to Call next',
  later: 'You moved them to Maybe later',
  skip: 'You marked them as Don’t call',
  done: 'You marked them as done',
};

export function ago(ts, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - ts) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

function agoWords(ts, now) {
  const short = ago(ts, now);
  const n = parseInt(short, 10);
  const unit = { m: 'minute', h: 'hour', d: 'day', w: 'week', mo: 'month' }[short.replace(/\d+/, '')];
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

function dayLabel(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Decide which list a chat belongs in, and why.
 * Order matters: your own decisions first, then hard "don't call" reasons,
 * then calls already made, then the call-first / call-next rules.
 */
export function classify({ chat, analysis, crm = {}, settings, now = Date.now() }) {
  const s = computeSignals(chat, crm, settings, now);
  const a = analysis ?? null;
  const fresh = Boolean(a && s.last && a.basedOnMessageId === s.last.id);
  const expectsReply = fresh && a.expectsReply !== undefined ? a.expectsReply : expectsReplyHeuristic(s.last);
  const leftOnSeen = s.readNoReply && expectsReply;
  const stale = s.daysSinceLast !== null && s.daysSinceLast > settings.staleAfterDays;
  const interest = a?.interest ?? null;

  const [tier, reason] = decide();
  return {
    tier,
    reason,
    badges: badges(),
    score: score(),
    leftOnSeen,
    expectsReply,
    analysisFresh: fresh,
    signals: s,
  };

  function decide() {
    if (crm.snoozeUntil && crm.snoozeUntil > now) {
      return ['snoozed', s.lastOutcome === 'callback' ? `Call back on ${dayLabel(crm.snoozeUntil)}` : `Snoozed until ${dayLabel(crm.snoozeUntil)}`];
    }
    if (crm.override && MOVED[crm.override]) return [crm.override, MOVED[crm.override]];
    if (!s.last) return ['skip', 'No messages to go on yet'];
    if (chat.isGroup && !settings.includeGroups) return ['skip', 'Group chat'];
    if (s.lastOutcome === 'wrong_number') return ['skip', 'Wrong number'];
    if (s.lastOutcome === 'not_interested' && !(s.lastTheirsAt > s.lastDeskCallAt)) {
      return ['skip', 'Said not interested on the call'];
    }
    if (a?.doNotCall) return ['skip', a.doNotCallReason || 'Not interested'];
    if (a?.category === 'spam') return ['skip', 'Looks like spam'];
    if (a?.category === 'service') return ['skip', 'Automated or company messages'];
    if (a?.category === 'personal' && !settings.includePersonal) return ['skip', 'Personal chat — friends & family'];

    // Snooze is over (or was never set): a requested call back is due now.
    if (s.callbackRequested) return ['first', 'Asked you to call back — it’s time'];
    if (s.talkedOnCallSince) {
      const when = agoWords(s.lastDeskCallAt, now);
      return ['done', `Called ${when} — ${OUTCOMES[s.lastOutcome] ?? 'logged'}`];
    }
    if (s.youCalledOnWhatsAppSince) return ['done', `You called on WhatsApp ${agoWords(s.lastWaCallAt, now)}`];
    if (s.noAnswerAttempts >= 3) return ['later', `No answer ${s.noAnswerAttempts} times — try again another day`];

    if (s.theyCalledSince) return ['first', `They tried calling you ${agoWords(s.lastWaCallAt, now)}`];
    if (leftOnSeen) {
      if (stale) return ['later', `Left you on seen ${agoWords(s.lastMessageAt, now)} — gone cold`];
      return ['first', `Read your message ${agoWords(s.lastMessageAt, now)} and didn’t reply`];
    }

    // Warm = real interest, not just politeness ("maybe later, thanks!" is not warm).
    const warm = Boolean(a) && (interest >= 60 || (interest >= 45 && (a.endedOnGoodNote || a.sentiment === 'positive')));
    if (s.hadConversation && warm) {
      if (stale) return ['later', `Good chat, but that was ${agoWords(s.lastMessageAt, now)}`];
      if (s.awaitingReply) return ['next', 'Good chat — and they’re waiting on your reply'];
      return ['next', s.everCalled ? 'Good chat since your last call' : 'Good chat, not called yet'];
    }
    if (s.awaitingReply && interest !== null && interest >= 40 && !stale) return ['next', 'They messaged last — waiting on your reply'];

    if (s.readRecently) return ['later', `Read ${agoWords(s.lastMessageAt, now)} — give them a little time`];
    if (s.deliveredNoReply) return ['later', 'Delivered, not read yet (or read receipts are off)'];
    if (s.notDelivered) return ['later', 'Your message wasn’t delivered — number may be inactive'];
    if (stale) return ['later', `Quiet for ${agoWords(s.lastMessageAt, now).replace(' ago', '')}`];
    if (interest !== null && interest < 35) return ['later', 'Not much interest so far'];
    if (!s.hadConversation) return ['later', 'Hasn’t really talked with you yet'];
    return ['later', 'Neutral conversation'];
  }

  // Small status chips shown on the card. Chat-state chips are hidden once
  // someone is done or not to be called — they'd only be noise there.
  function badges() {
    const list = [];
    const live = tier !== 'skip' && tier !== 'done';
    if (s.theyCalledSince) list.push({ kind: 'theycalled', label: 'They called you' });
    if (live) {
      if (leftOnSeen) list.push({ kind: 'seen', label: `Seen, no reply · ${ago(s.lastMessageAt, now)}` });
      else if (s.readRecently && expectsReply) list.push({ kind: 'read', label: `Read · ${ago(s.lastMessageAt, now)}` });
      else if (s.deliveredNoReply) list.push({ kind: 'delivered', label: `Delivered, not read · ${ago(s.lastMessageAt, now)}` });
      else if (s.notDelivered) list.push({ kind: 'undelivered', label: 'Not delivered' });
      if (s.awaitingReply && !s.talkedOnCallSince) list.push({ kind: 'waiting', label: `Waiting on your reply · ${ago(s.lastMessageAt, now)}` });
    }
    if (s.noAnswerAttempts) list.push({ kind: 'attempts', label: `No answer ×${s.noAnswerAttempts}` });
    if (s.callbackRequested) list.push({ kind: 'callback', label: 'Asked for a call back' });
    return list;
  }

  function score() {
    const days = s.daysSinceLast ?? 365;
    const recency = 100 * Math.exp(-days / 14);
    const engagement = Math.min(100, s.theirCount * 10 + s.exchanges * 8);
    let v = 0.5 * (interest ?? 50) + 0.3 * recency + 0.2 * engagement;
    if (s.theyCalledSince) v += 15;
    if (s.awaitingReply) v += 5;
    if (a?.endedOnGoodNote) v += 5;
    v -= 8 * s.noAnswerAttempts;
    if (crm.starred) v += 20;
    return Math.round(Math.max(0, Math.min(100, v)));
  }
}

export function sortContacts(list) {
  return list.sort((x, y) => TIERS.indexOf(x.tier) - TIERS.indexOf(y.tier) || y.score - x.score || (y.lastActivityAt ?? 0) - (x.lastActivityAt ?? 0));
}
