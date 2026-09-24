import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { html, api, store, OUTCOME_LABEL } from './lib.js';
import { ConnectScreen, ConnectPanel } from './connect.js';
import { Dashboard } from './dashboard.js';
import { ContactDrawer } from './drawer.js';
import { FocusMode } from './focus.js';
import { SettingsModal } from './settings.js';
import { Modal, Toasts } from './components.js';
import { Icon } from './icons.js';

const enc = encodeURIComponent;

function currentTheme() {
  const saved = store.get('calldesk-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [server, setServer] = useState(null);
  const [online, setOnline] = useState(true);
  const [data, setData] = useState({ contacts: [], stats: null });
  const [version, setVersion] = useState(0);
  const [ui, setUi] = useState({ tier: 'first', search: '', chips: [], sort: 'priority', selectedId: null });
  const [modal, setModal] = useState(null);
  const [focusQueue, setFocusQueue] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(currentTheme);

  const dataRef = useRef(data);
  dataRef.current = data;

  // ----- contacts: reload on demand, coalescing overlapping requests -----
  const busy = useRef(false);
  const queued = useRef(false);
  const reload = useCallback(async () => {
    if (busy.current) {
      queued.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        queued.current = false;
        setData(await api('/api/contacts'));
        setVersion((v) => v + 1);
      } while (queued.current);
    } catch {
      // the offline banner covers a server that went away
    } finally {
      busy.current = false;
    }
  }, []);

  // ----- live state from the server -----
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => {
      setServer(JSON.parse(e.data));
      setOnline(true);
    });
    es.addEventListener('contacts', reload);
    es.onopen = () => {
      setOnline(true);
      reload();
    };
    es.onerror = () => setOnline(false);
    return () => es.close();
  }, [reload]);

  // Start on "Call next" when nobody is in "Call first".
  const pickedTier = useRef(false);
  useEffect(() => {
    if (pickedTier.current || !data.stats) return;
    pickedTier.current = true;
    if (!data.stats.tiers.first && data.stats.tiers.next) setUi((u) => ({ ...u, tier: 'next' }));
  }, [data.stats]);

  useEffect(() => {
    const n = data.stats?.tiers.first;
    document.title = n ? `(${n}) Brulé Call Desk` : 'Brulé Call Desk';
  }, [data.stats]);

  // Close the connect dialog once real chats have arrived.
  const prevSource = useRef(null);
  useEffect(() => {
    const source = server?.source ?? null;
    if (prevSource.current !== null && prevSource.current !== 'whatsapp' && source === 'whatsapp') {
      setModal((m) => (m === 'connect' ? null : m));
      toast('WhatsApp connected — your call list is ready.');
    }
    prevSource.current = source ?? 'none';
  }, [server?.source]);

  // ----- toasts -----
  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration ?? 5000);
  }, []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // ----- actions -----
  const actions = useMemo(() => {
    const post = async (path, body, success) => {
      try {
        const result = await api(path, { method: 'POST', body });
        if (success) toast(success);
        reload();
        return result ?? true;
      } catch (err) {
        toast(err.message, { tone: 'bad' });
        return null;
      }
    };
    const a = {
      toast,
      openContact: (id) => setUi((u) => ({ ...u, selectedId: id })),
      closeContact: () => setUi((u) => ({ ...u, selectedId: null })),
      openSettings: (focus) => setModal(focus === 'ai' ? 'settings:ai' : 'settings'),
      openConnect: () => setModal('connect'),
      toggleTheme: () =>
        setTheme((t) => {
          const next = t === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = next;
          store.set('calldesk-theme', next);
          return next;
        }),
      async logCall(contact, outcome, extra = {}) {
        const ok = await post(`/api/contacts/${enc(contact.id)}/call`, { outcome, ...extra });
        if (ok) {
          toast(`${OUTCOME_LABEL[outcome]} — ${contact.name}`, { action: { label: 'Undo', run: () => a.undoCall(contact, true) } });
        }
        return Boolean(ok);
      },
      undoCall: (contact, quiet) => post(`/api/contacts/${enc(contact.id)}/undo-call`, {}, quiet ? 'Undone' : 'Removed the last logged call'),
      update: (contact, patch, message) => post(`/api/contacts/${enc(contact.id)}/update`, patch, message),
      analyzeOne: (contact) => post(`/api/contacts/${enc(contact.id)}/analyze`, {}, `Claude read ${contact.name}’s chat again`),
      refreshOne: (contact) => post(`/api/contacts/${enc(contact.id)}/refresh`, {}, 'Fetched the latest messages'),
      sync: () => post('/api/sync', {}),
      analyzeAll: (force = false) => post('/api/analyze', { force }),
      cancelAnalysis: () => post('/api/analyze/cancel', {}, 'Stopped. Chats read so far are kept.'),
      saveSettings: (body) => post('/api/settings', body, 'Settings saved'),
      loadDemo: async () => {
        await post('/api/demo/load', {});
        pickedTier.current = false;
        setUi((u) => ({ ...u, tier: 'first', search: '', chips: [], selectedId: null }));
      },
      exitDemo: () => post('/api/demo/exit', {}),
      startWhatsApp: () => post('/api/whatsapp/start', {}),
      logoutWhatsApp: () => post('/api/whatsapp/logout', {}, 'Logged out of WhatsApp'),
      clearData: () => post('/api/data/clear', {}, 'All data cleared'),
      startFocus: () => {
        const queue = dataRef.current.contacts.filter((c) => c.tier === 'first' || c.tier === 'next').map((c) => c.id);
        setUi((u) => ({ ...u, selectedId: null }));
        setFocusQueue(queue);
      },
    };
    return a;
  }, [reload, toast]);

  if (!server) {
    return html`<div class="splash"><span class="brand__mark">Brulé</span></div>
      ${online ? null : html`<${Offline} />`}`;
  }

  const hasData = server.chatCount > 0;
  const waitingForList = hasData && !data.stats;

  return html`
    ${online ? null : html`<${Offline} />`}
    ${waitingForList
      ? html`<div class="splash"><span class="brand__mark">Brulé</span></div>`
      : hasData
        ? html`<${Dashboard} server=${server} data=${data} ui=${ui} setUi=${setUi} actions=${actions} theme=${theme} />`
        : html`<${ConnectScreen} server=${server} actions=${actions} />`}
    ${ui.selectedId && hasData && data.stats
      ? html`<${ContactDrawer} id=${ui.selectedId} version=${version} server=${server} actions=${actions} onClose=${actions.closeContact} />`
      : null}
    ${focusQueue
      ? html`<${FocusMode} queue=${focusQueue} contacts=${data.contacts} server=${server} actions=${actions} onExit=${() => setFocusQueue(null)} />`
      : null}
    ${modal?.startsWith('settings')
      ? html`<${SettingsModal} server=${server} actions=${actions} focus=${modal === 'settings:ai' ? 'ai' : null} onClose=${() => setModal(null)} />`
      : null}
    ${modal === 'connect'
      ? html`<${Modal} title="WhatsApp" onClose=${() => setModal(null)}>
          <p class="muted" style=${{ margin: '10px 0 14px' }}>Open WhatsApp on your phone → <b>Linked devices</b> → <b>Link a device</b>, then scan the code.</p>
          <div style=${{ borderRadius: '18px', overflow: 'hidden', border: '1px solid var(--line)' }}><${ConnectPanel} server=${server} actions=${actions} /></div>
        <//>`
      : null}
    <${Toasts} toasts=${toasts} dismiss=${dismiss} />
  `;
}

function Offline() {
  return html`<div class="banner banner--bad" style=${{ position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, marginTop: 0, width: 'min(560px, calc(100% - 32px))', boxShadow: 'var(--shadow-2)' }}>
    <${Icon} name="alert" />
    <span class="banner__text">Can’t reach Call Desk. Is it still running in your terminal? Reconnecting…</span>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
