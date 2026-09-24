import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS } from './config.js';

// Everything the app knows lives in one JSON file under data/ (git-ignored):
//   chats    – snapshot of each WhatsApp chat (contact info + recent messages)
//   analysis – Claude's (or the basic) read of each chat
//   crm      – what you did: calls logged, notes, snoozes, manual moves
export function emptyData() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    source: null, // 'whatsapp' | 'demo'
    me: null,
    lastSyncAt: null,
    chats: {},
    analysis: {},
    crm: {},
  };
}

export function createStore(file) {
  let data = load();
  let timer = null;

  function load() {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return emptyData();
      // Keep the unreadable file for inspection instead of silently overwriting it.
      const backup = `${file}.unreadable-${Date.now()}`;
      try {
        fs.renameSync(file, backup);
        console.warn(`[store] ${file} could not be read (${err.message}); moved it to ${backup}`);
      } catch {
        console.warn(`[store] ${file} could not be read (${err.message})`);
      }
      return emptyData();
    }
    const base = emptyData();
    return { ...base, ...raw, settings: { ...base.settings, ...raw.settings } };
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }

  return {
    get data() {
      return data;
    },
    crm(id) {
      return (data.crm[id] ??= { calls: [], notes: '', snoozeUntil: null, override: null, starred: false });
    },
    save() {
      if (!timer) timer = setTimeout(flush, 400);
    },
    flush,
    replaceAll(next) {
      data = next;
      flush();
    },
  };
}
