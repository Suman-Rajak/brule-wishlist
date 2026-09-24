import EventEmitter from 'node:events';
import path from 'node:path';
import QRCode from 'qrcode';
import { DAY } from './config.js';

// Chat ids: <phone>@c.us (person), <id>@lid (person behind WhatsApp's privacy id),
// <id>@g.us (group), <id>@newsletter (channel), status@broadcast (status updates).
export function isPersonChatId(id) {
  return id.endsWith('@c.us') || id.endsWith('@lid');
}

const SKIP_TYPES = new Set(['e2e_notification', 'notification_template', 'gp2', 'protocol', 'ciphertext', 'debug', 'notification', 'broadcast_notification']);

function describeBody(m) {
  const text = (m.body || '').trim();
  const withCaption = (label) => (text ? `[${label}] ${text}` : `[${label}]`);
  switch (m.type) {
    case 'chat': return text;
    case 'image': return withCaption('photo');
    case 'video': return withCaption('video');
    case 'album': return withCaption('photos');
    case 'ptt': return `[voice note${m.duration ? `, ${m.duration}s` : ''}]`;
    case 'audio': return '[audio]';
    case 'document': return withCaption(`document${m._data?.filename ? `: ${m._data.filename}` : ''}`);
    case 'sticker': return '[sticker]';
    case 'location': return '[location]';
    case 'vcard':
    case 'multi_vcard': return '[contact card]';
    case 'revoked': return '[deleted message]';
    case 'poll_creation': return withCaption('poll');
    case 'order':
    case 'product': return withCaption('order');
    case 'payment': return '[payment]';
    default: return text || `[${m.type}]`;
  }
}

export function normalizeMessage(m) {
  if (SKIP_TYPES.has(m.type)) return null;
  return {
    id: m.id?._serialized ?? m.id?.id ?? String(m.timestamp),
    fromMe: Boolean(m.fromMe),
    ts: (m.timestamp || 0) * 1000,
    type: m.type,
    body: describeBody(m).slice(0, 2000),
    ack: m.fromMe ? (m.ack ?? null) : null,
  };
}

function friendlyStartError(err) {
  const msg = String(err?.message || err);
  if (/Could not find (Chrome|expected browser)|Browser was not found|executablePath/i.test(msg)) {
    return 'Chrome could not be found. Run `npx puppeteer browsers install chrome` in this folder, or set CHROME_PATH in .env to your Chrome.';
  }
  if (/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|ERR_TUNNEL|net::/i.test(msg)) {
    return 'Couldn’t open WhatsApp Web — check your internet connection and try again.';
  }
  if (/already running|SingletonLock|ProcessSingleton/i.test(msg)) {
    return 'The WhatsApp browser session is already open in another Call Desk window. Close it and try again.';
  }
  return msg;
}

/**
 * Wraps whatsapp-web.js: logs in with a QR code (session is kept in data/whatsapp-session,
 * so you only scan once), then reads chats on request.
 */
export class WhatsAppService extends EventEmitter {
  constructor({ dataDir, chromePath }) {
    super();
    this.dataDir = dataDir;
    this.chromePath = chromePath;
    this.client = null;
    this.state = { status: 'idle', qr: null, percent: null, me: null, error: null };
    this.avatarCache = new Map();
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  get ready() {
    return this.state.status === 'ready' && this.client !== null;
  }

  async start() {
    if (this.client) return;
    this.setState({ status: 'starting', qr: null, percent: null, error: null });

    let wweb;
    try {
      wweb = (await import('whatsapp-web.js')).default;
    } catch (err) {
      this.setState({ status: 'error', error: `WhatsApp library failed to load (${err.message}). Run npm install.` });
      return;
    }
    const { Client, LocalAuth } = wweb;

    const puppeteer = { headless: true, args: [] };
    if (this.chromePath) puppeteer.executablePath = this.chromePath;
    // Chrome refuses to start as root on Linux without this.
    if (process.platform === 'linux' && process.getuid?.() === 0) puppeteer.args.push('--no-sandbox', '--disable-setuid-sandbox');

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(this.dataDir, 'whatsapp-session') }),
      webVersionCache: { type: 'local', path: path.join(this.dataDir, 'whatsapp-web-cache') },
      puppeteer,
    });
    this.client = client;

    client.on('qr', async (qr) => {
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
      if (this.client === client) this.setState({ status: 'qr', qr: dataUrl, error: null });
    });
    client.on('authenticated', () => this.setState({ status: 'loading', qr: null, percent: null }));
    client.on('loading_screen', (percent) => this.setState({ status: 'loading', qr: null, percent: Number(percent) || null }));
    client.on('auth_failure', (message) => this.setState({ status: 'error', error: `WhatsApp login failed: ${message}. Try linking again.` }));
    client.on('ready', () => {
      const info = client.info;
      this.setState({
        status: 'ready',
        qr: null,
        percent: null,
        error: null,
        me: { name: info?.pushname || null, number: info?.wid?.user || null },
      });
      this.emit('ready');
    });
    client.on('disconnected', (reason) => {
      if (this.client !== client) return;
      this.client = null;
      this.setState({ status: 'disconnected', qr: null, error: reason === 'LOGOUT' ? 'You logged out from your phone.' : String(reason || '') });
      client.destroy().catch(() => {});
    });

    // Keep the dashboard live: new messages and read receipts update that chat.
    const touched = (msg) => {
      const chatId = msg?.id?.remote || (msg?.fromMe ? msg?.to : msg?.from);
      if (chatId && isPersonChatId(chatId)) this.emit('chat-activity', chatId);
    };
    client.on('message_create', touched);
    client.on('message_ack', touched);
    client.on('message_revoke_everyone', touched);

    try {
      await client.initialize();
    } catch (err) {
      if (this.client !== client) return;
      this.client = null;
      this.setState({ status: 'error', qr: null, error: friendlyStartError(err) });
      await client.destroy().catch(() => {});
    }
  }

  async stop() {
    const client = this.client;
    this.client = null;
    if (client) await client.destroy().catch(() => {});
    this.setState({ status: 'idle', qr: null, percent: null });
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  async logout() {
    const client = this.client;
    this.client = null;
    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    }
    this.setState({ status: 'idle', qr: null, percent: null, me: null, error: null });
  }

  /** Read the most recent person-to-person chats. */
  async syncChats(settings, onProgress = () => {}) {
    if (!this.ready) throw new Error('WhatsApp isn’t connected.');
    const client = this.client;
    const myNumber = this.state.me?.number;
    const cutoff = Date.now() - settings.lookbackDays * DAY;

    const all = await client.getChats();
    const chats = all
      .filter((c) => {
        const id = c.id?._serialized ?? '';
        if (c.isGroup) return settings.includeGroups && id.endsWith('@g.us');
        return isPersonChatId(id) && c.id.user !== myNumber;
      })
      .filter((c) => (c.timestamp || 0) * 1000 >= cutoff)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, settings.maxChats);

    const snapshots = [];
    for (let i = 0; i < chats.length; i++) {
      onProgress({ done: i, total: chats.length, current: chats[i].name || null });
      try {
        snapshots.push(await this.snapshot(chats[i], settings));
      } catch (err) {
        console.warn(`[whatsapp] skipped ${chats[i].id?._serialized}: ${err.message}`);
      }
    }
    onProgress({ done: chats.length, total: chats.length, current: null });
    return snapshots;
  }

  async refreshChat(chatId, settings) {
    if (!this.ready) return null;
    const chat = await this.client.getChatById(chatId);
    return chat ? this.snapshot(chat, settings) : null;
  }

  async snapshot(chat, settings) {
    const client = this.client;
    const id = chat.id._serialized;
    const fetched = await chat.fetchMessages({ limit: settings.messagesPerChat });
    const messages = fetched.map(normalizeMessage).filter(Boolean).sort((a, b) => a.ts - b.ts);

    let contact = null;
    if (!chat.isGroup) contact = await chat.getContact().catch(() => null);

    // Work out a dialable number. For @lid chats WhatsApp hides it unless it's known.
    let number = null;
    if (id.endsWith('@c.us')) number = chat.id.user;
    else if (contact?.id?._serialized?.endsWith('@c.us')) number = contact.id.user;
    if (!number && id.endsWith('@lid')) {
      const [pair] = await client.getContactLidAndPhone([id]).catch(() => []);
      if (pair?.pn) number = pair.pn.split('@')[0];
    }

    return {
      id,
      name: contact?.name || chat.name || contact?.pushname || (number ? `+${number}` : 'Unknown'),
      savedName: contact?.name || null,
      pushname: contact?.pushname || null,
      number,
      isGroup: Boolean(chat.isGroup),
      isBusiness: Boolean(contact?.isBusiness),
      isMyContact: Boolean(contact?.isMyContact),
      unreadCount: chat.unreadCount || 0,
      archived: Boolean(chat.archived),
      pinned: Boolean(chat.pinned),
      muted: Boolean(chat.isMuted),
      lastActivityAt: Math.max((chat.timestamp || 0) * 1000, messages.at(-1)?.ts ?? 0),
      messages,
      callLogs: await this.callLogs(id),
      syncedAt: Date.now(),
    };
  }

  // WhatsApp call history shows up as "call_log" entries in the chat, which
  // whatsapp-web.js filters out of fetchMessages — read them from the loaded chat.
  async callLogs(chatId) {
    try {
      return await this.client.pupPage.evaluate(async (chatId) => {
        const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
        if (!chat?.msgs) return [];
        return chat.msgs
          .getModelsArray()
          .filter((m) => m.type === 'call_log')
          .map((m) => ({ ts: m.t * 1000, fromMe: Boolean(m.id?.fromMe), isVideo: Boolean(m.isVideoCall) }));
      }, chatId);
    } catch {
      return [];
    }
  }

  async avatarUrl(chatId) {
    const cached = this.avatarCache.get(chatId);
    if (cached && cached.expires > Date.now()) return cached.url;
    if (!this.ready) return null;
    const url = (await this.client.getProfilePicUrl(chatId).catch(() => null)) || null;
    this.avatarCache.set(chatId, { url, expires: Date.now() + 6 * 60 * 60 * 1000 });
    return url;
  }
}
