import { DAY } from './config.js';

// WhatsApp tick states (whatsapp-web.js MessageAck)
export const ACK = { ERROR: -1, PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, PLAYED: 4 };

// Message types that are not part of the conversation itself.
const SYSTEM_TYPES = new Set([
  'e2e_notification', 'gp2', 'notification', 'notification_template', 'group_notification',
  'protocol', 'ciphertext', 'debug', 'broadcast_notification', 'call_log', 'unknown', 'revoked',
]);

export function conversationMessages(messages = []) {
  return messages.filter((m) => !SYSTEM_TYPES.has(m.type));
}

function findLast(list, test) {
  for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) return list[i];
  return null;
}

/**
 * Facts measured straight from the chat and your call log — no AI involved.
 * `crm.calls` are calls you logged in the dashboard; `chat.callLogs` are WhatsApp calls.
 */
export function computeSignals(chat, crm = {}, settings, now = Date.now()) {
  const msgs = conversationMessages(chat.messages);
  const last = msgs.at(-1) ?? null;
  const lastTheirs = findLast(msgs, (m) => !m.fromMe);
  const theirCount = msgs.filter((m) => !m.fromMe).length;
  const myCount = msgs.length - theirCount;

  let exchanges = 0;
  for (let i = 1; i < msgs.length; i++) if (msgs[i].fromMe !== msgs[i - 1].fromMe) exchanges++;

  const sinceLast = last ? now - last.ts : Infinity;
  const lastFromMe = Boolean(last?.fromMe);
  const ack = lastFromMe ? (last.ack ?? null) : null;
  // "Left on seen" only after they have sat on your message for a few days (Settings, default 3).
  const waitedLongEnough = sinceLast >= settings.seenAfterDays * DAY;

  const deskCalls = [...(crm.calls ?? [])].sort((a, b) => a.at - b.at);
  const waCalls = [...(chat.callLogs ?? [])].sort((a, b) => a.ts - b.ts);
  const lastMsgTs = last?.ts ?? 0;
  const lastDeskCall = deskCalls.at(-1) ?? null;
  // Only calls made after the latest message count — if they wrote again, the chat is live again.
  const deskCallSince = lastDeskCall && lastDeskCall.at >= lastMsgTs ? lastDeskCall : null;
  const lastWaCall = waCalls.at(-1) ?? null;
  const waCallSince = lastWaCall && lastWaCall.ts >= lastMsgTs ? lastWaCall : null;

  return {
    last,
    lastMessageAt: last?.ts ?? null,
    lastTheirsAt: lastTheirs?.ts ?? null,
    daysSinceLast: last ? sinceLast / DAY : null,
    theirCount,
    myCount,
    exchanges,
    // A real back-and-forth, not a single ping.
    hadConversation: theirCount >= 1 && myCount >= 1 && exchanges >= 2,
    lastFromMe,
    lastAck: ack,
    // They opened your last message (blue ticks) and have not answered.
    readNoReply: lastFromMe && ack !== null && ack >= ACK.READ && waitedLongEnough,
    readRecently: lastFromMe && ack !== null && ack >= ACK.READ && !waitedLongEnough,
    // Grey double tick: delivered but not opened — or they have read receipts turned off.
    deliveredNoReply: lastFromMe && ack === ACK.DELIVERED && sinceLast >= DAY,
    notDelivered: lastFromMe && ack !== null && ack <= ACK.SENT && sinceLast >= DAY,
    awaitingReply: Boolean(last) && !lastFromMe,
    unreadCount: chat.unreadCount ?? 0,
    // Calls
    lastDeskCallAt: lastDeskCall?.at ?? null,
    lastOutcome: lastDeskCall?.outcome ?? null,
    noAnswerAttempts: deskCalls.filter((c) => c.at >= lastMsgTs && c.outcome === 'no_answer').length,
    talkedOnCallSince: Boolean(deskCallSince && deskCallSince.outcome !== 'no_answer'),
    callbackRequested: deskCallSince?.outcome === 'callback',
    theyCalledSince: Boolean(waCallSince && !waCallSince.fromMe && !(lastDeskCall && lastDeskCall.at > waCallSince.ts)),
    youCalledOnWhatsAppSince: Boolean(waCallSince && waCallSince.fromMe),
    lastWaCallAt: lastWaCall?.ts ?? null,
    everCalled: deskCalls.length > 0 || waCalls.length > 0,
  };
}

const CLOSING =
  /^(ok(ay)?|k|thanks?|thank you( so much)?|thx|ty|welcome|you['’]?re welcome|anytime|cheers|see you( soon| then)?|bye|good ?night|gn|done|sure|great|perfect|noted|cool|nice|haha+)[\s!.,☕🙏😊🙂👍❤️✨🤝]*$/iu;
const ASKS = /(\?|₹|rs\.?\s?\d|price|quote|offer|link|http|order|let me know|lmk|would you|shall i|can i|do you|interested|available|confirm|when can|how about)/i;

/** Best guess (without AI) at whether your last message needed an answer. */
export function expectsReplyHeuristic(message) {
  if (!message || !message.fromMe) return false;
  const text = (message.body || '').trim();
  if (!text) return message.type !== 'sticker';
  if (text.length < 40 && CLOSING.test(text)) return false;
  if (ASKS.test(text)) return true;
  return text.length > 12;
}
