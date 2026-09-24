import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from './lib.js';
import { Icon } from './icons.js';
import { Modal, Switch, Spinner } from './components.js';

const pick = (s) => ({
  businessContext: s.businessContext,
  ownerName: s.ownerName,
  model: s.model,
  autoAnalyze: s.autoAnalyze,
  seenAfterHours: s.seenAfterHours,
  staleAfterDays: s.staleAfterDays,
  maxChats: s.maxChats,
  messagesPerChat: s.messagesPerChat,
  lookbackDays: s.lookbackDays,
  includeGroups: s.includeGroups,
  includePersonal: s.includePersonal,
});

function NumberSelect({ id, value, options, onChange, suffix }) {
  const list = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return html`<select id=${id} value=${value} onChange=${(e) => onChange(Number(e.currentTarget.value))}>
    ${list.map((n) => html`<option key=${n} value=${n}>${n} ${suffix}</option>`)}
  </select>`;
}

export function SettingsModal({ server, actions, focus, onClose }) {
  const s = server.settings;
  const [form, setForm] = useState(() => pick(s));
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const keyRef = useRef(null);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (focus === 'ai') keyRef.current?.focus();
  }, [focus]);

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (apiKey.trim()) body.anthropicApiKey = apiKey.trim();
      await actions.saveSettings(body);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const wa = server.whatsapp;
  const keyStatus = s.anthropicKeyHint
    ? html`Saved: <code>${s.anthropicKeyHint}</code> — paste a new one to replace it.`
    : s.anthropicKeyFromEnv
      ? html`Using <code>ANTHROPIC_API_KEY</code> from your .env file.`
      : html`Create one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> → API keys.`;

  return html`<${Modal}
    title="Settings"
    onClose=${onClose}
    footer=${html`
      <button class="btn" onClick=${onClose}>Cancel</button>
      <button class="btn btn--primary" onClick=${save} disabled=${saving}>${saving ? html`<${Spinner} />` : null}Save</button>
    `}
  >
    <div class="settings-group">
      <h3>Claude AI</h3>
      <div class="field">
        <label for="apikey">Claude API key</label>
        <input id="apikey" ref=${keyRef} class="input" type="password" autocomplete="off" spellcheck="false"
          placeholder=${s.anthropicKeyHint ? 'Paste a new key to replace the saved one' : 'sk-ant-…'}
          value=${apiKey} onInput=${(e) => setApiKey(e.currentTarget.value)} />
        <small>${keyStatus} Stored only on this computer.</small>
        ${s.anthropicKeyHint
          ? html`<div><button class="btn btn--sm btn--ghost btn--danger" onClick=${() => actions.saveSettings({ anthropicApiKey: '' })}><${Icon} name="trash" />Remove saved key</button></div>`
          : null}
      </div>
      <div class="field">
        <label for="model">Model</label>
        <select id="model" value=${form.model} onChange=${(e) => set('model')(e.currentTarget.value)}>
          ${server.models.map((m) => html`<option key=${m.id} value=${m.id}>${m.label}</option>`)}
        </select>
        <small>Each chat is read once and only read again when new messages arrive.</small>
      </div>
      <${Switch} checked=${form.autoAnalyze} onChange=${set('autoAnalyze')} label="Analyze new chats automatically after each sync" hint="Otherwise use the Analyze button at the top." />
      <p class="note"><${Icon} name="lock" /> When Claude analyses a chat, that chat’s recent messages are sent to Anthropic’s API. Nothing else leaves your computer.</p>
    </div>

    <div class="settings-group">
      <h3>About you</h3>
      <div class="field">
        <label for="owner">Your first name</label>
        <input id="owner" class="input" value=${form.ownerName} placeholder=${server.me?.name || 'Your name'} onInput=${(e) => set('ownerName')(e.currentTarget.value)} />
        <small>Used in the greeting and in suggested call openers.</small>
      </div>
      <div class="field">
        <label for="business">What you do, and what a good call looks like</label>
        <textarea id="business" class="textarea" value=${form.businessContext} onInput=${(e) => set('businessContext')(e.currentTarget.value)}></textarea>
        <small>Claude uses this to judge who is interested. Mention what you sell and who your buyers are.</small>
      </div>
    </div>

    <div class="settings-group">
      <h3>Call rules</h3>
      <div class="grid-2">
        <div class="field">
          <label for="seen">“Left on seen” after</label>
          <${NumberSelect} id="seen" value=${form.seenAfterHours} options=${[1, 2, 4, 8, 12, 24, 48]} suffix="hours" onChange=${set('seenAfterHours')} />
          <small>How long after they read your message before it counts.</small>
        </div>
        <div class="field">
          <label for="stale">Gone cold after</label>
          <${NumberSelect} id="stale" value=${form.staleAfterDays} options=${[14, 30, 45, 60, 90, 180]} suffix="days" onChange=${set('staleAfterDays')} />
          <small>Older chats drop to “Maybe later”.</small>
        </div>
      </div>
      <${Switch} checked=${form.includePersonal} onChange=${set('includePersonal')} label="Include friends & family" hint="Normally personal chats are kept off the call list." />
      <${Switch} checked=${form.includeGroups} onChange=${set('includeGroups')} label="Include group chats" hint="Takes effect on the next sync." />
    </div>

    <div class="settings-group">
      <h3>Reading chats</h3>
      <div class="grid-2">
        <div class="field">
          <label for="maxchats">How many recent chats</label>
          <${NumberSelect} id="maxchats" value=${form.maxChats} options=${[50, 100, 150, 250, 400]} suffix="chats" onChange=${set('maxChats')} />
        </div>
        <div class="field">
          <label for="lookback">Active within</label>
          <${NumberSelect} id="lookback" value=${form.lookbackDays} options=${[30, 60, 120, 180, 365]} suffix="days" onChange=${set('lookbackDays')} />
        </div>
        <div class="field">
          <label for="perchat">Messages per chat</label>
          <${NumberSelect} id="perchat" value=${form.messagesPerChat} options=${[20, 40, 60, 100]} suffix="messages" onChange=${set('messagesPerChat')} />
        </div>
      </div>
      <small class="muted">More chats and messages take longer to sync and analyze.</small>
    </div>

    <div class="settings-group">
      <h3>WhatsApp & data</h3>
      <p class="muted" style=${{ margin: '8px 0 0' }}>
        ${wa.status === 'ready' ? `Connected${wa.me?.name ? ` as ${wa.me.name}` : ''}${wa.me?.number ? ` (+${wa.me.number})` : ''}.` : 'WhatsApp is not connected.'}
      </p>
      <div style=${{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        ${server.analysis.configured && server.chatCount
          ? html`<button class="btn btn--sm" onClick=${() => { actions.analyzeAll(true); onClose(); }}><${Icon} name="sparkle" />Re-analyze every chat</button>`
          : null}
        ${server.source === 'demo'
          ? server.demoOnly ? null : html`<button class="btn btn--sm" onClick=${() => { actions.exitDemo(); onClose(); }}>Exit sample data</button>`
          : html`<button class="btn btn--sm" onClick=${() => { actions.loadDemo(); onClose(); }}><${Icon} name="play" />Try sample chats</button>`}
        ${['ready', 'qr', 'loading'].includes(wa.status)
          ? html`<button class="btn btn--sm btn--danger" onClick=${() => { if (confirm('Log out of WhatsApp on this computer? You can link again with a new QR code.')) { actions.logoutWhatsApp(); onClose(); } }}><${Icon} name="logout" />Log out of WhatsApp</button>`
          : null}
        <button class="btn btn--sm btn--danger" onClick=${() => { if (confirm('Delete all synced chats, analyses, call logs and notes from this computer? Settings are kept.')) { actions.clearData(); onClose(); } }}><${Icon} name="trash" />Clear all data</button>
      </div>
    </div>
  <//>`;
}
