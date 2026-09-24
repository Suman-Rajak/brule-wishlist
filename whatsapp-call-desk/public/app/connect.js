import { html } from './lib.js';
import { Icon } from './icons.js';
import { Spinner } from './components.js';

/** The QR / status panel — used on the welcome screen and in the "Connect" dialog. */
export function ConnectPanel({ server, actions }) {
  const wa = server.whatsapp;
  const sync = server.sync;
  const hasData = server.chatCount > 0 && server.source === 'whatsapp';

  let body;
  if (server.demoOnly) {
    body = html`<div class="qr"><div class="qr__placeholder"><${Icon} name="info" /><span>Demo mode</span></div></div>
      <p class="qr__status">Call Desk was started with <code>npm run demo</code>, so WhatsApp is off. Run <code>npm start</code> to connect your real chats.</p>`;
  } else if (wa.status === 'qr' && wa.qr) {
    body = html`<div class="qr"><img src=${wa.qr} alt="WhatsApp login QR code" /></div>
      <p class="qr__status"><strong>Scan with WhatsApp</strong> → Linked devices. The code refreshes by itself every few seconds.</p>`;
  } else if (wa.status === 'loading') {
    body = html`<div class="qr"><div class="qr__placeholder"><${Spinner} /><span>Linked!</span></div></div>
      <p class="qr__status"><strong>Loading WhatsApp…</strong> ${wa.percent ? `${wa.percent}%` : ''}</p>
      ${wa.percent ? html`<div class="loadbar"><div style=${{ width: `${wa.percent}%` }}></div></div>` : null}`;
  } else if (wa.status === 'ready' && sync.running) {
    const pct = sync.total ? Math.round((sync.done / sync.total) * 100) : 0;
    body = html`<div class="qr"><div class="qr__placeholder"><${Spinner} /><span>${sync.total ? `${sync.done} of ${sync.total}` : 'Starting…'}</span></div></div>
      <p class="qr__status"><strong>Reading your chats…</strong>${sync.current ? html`<br /><span class="muted">${sync.current}</span>` : null}</p>
      <div class="loadbar"><div style=${{ width: `${pct}%` }}></div></div>`;
  } else if (wa.status === 'ready') {
    body = html`<div class="qr"><div class="qr__placeholder"><${Icon} name="check" /><span>Connected</span></div></div>
      <p class="qr__status"><strong>WhatsApp is connected${wa.me?.name ? ` as ${wa.me.name}` : ''}.</strong>
        ${hasData ? ' Your chats are up to date.' : ' Ready to read your chats.'}</p>
      ${sync.error ? html`<p class="qr__status" style=${{ color: 'var(--bad)' }}>${sync.error}</p>` : null}
      <button class="btn btn--primary" onClick=${actions.sync}><${Icon} name="refresh" />${hasData ? 'Sync again' : 'Read my chats'}</button>`;
  } else if (wa.status === 'error' || wa.status === 'disconnected') {
    body = html`<div class="qr"><div class="qr__placeholder"><${Icon} name="alert" /><span>${wa.status === 'error' ? 'Couldn’t connect' : 'Disconnected'}</span></div></div>
      <p class="qr__status">${wa.error || 'WhatsApp disconnected.'}</p>
      <button class="btn btn--primary" onClick=${actions.startWhatsApp}><${Icon} name="refresh" />Try again</button>`;
  } else {
    body = html`<div class="qr"><div class="qr__placeholder"><${Spinner} /><span>Starting WhatsApp…</span></div></div>
      <p class="qr__status">Opening WhatsApp Web in the background. The first start can take up to a minute.</p>`;
  }

  return html`<div class="connect__qrside">
    ${body}
    <p class="privacy"><${Icon} name="lock" /><span>Runs on your computer. Your chats only leave it when Claude analyses them, and nothing is ever sent from your WhatsApp.</span></p>
  </div>`;
}

export function ConnectScreen({ server, actions }) {
  return html`<div class="connect">
    <header class="shell topbar__inner" style=${{ height: '72px' }}>
      <span class="brand"><span class="brand__mark">Brulé</span><span class="brand__rule"></span><span class="brand__name">Call Desk</span></span>
      <span class="topbar__spacer"></span>
      <button class="icon-btn icon-btn--ghost" aria-label="Settings" title="Settings" onClick=${actions.openSettings}><${Icon} name="sliders" /></button>
    </header>
    <main class="connect__main">
      <section class="connect__card">
        <div class="connect__copy">
          <p class="eyebrow">WhatsApp → call list</p>
          <h1>Know exactly who to call next.</h1>
          <p>Link your WhatsApp once. Claude reads your recent chats and sorts people into who to call first, who to call next — and who to leave alone.</p>
          <ol class="steps">
            <li><span>Open <b>WhatsApp</b> on your phone.</span></li>
            <li><span>Tap <b>Settings</b> (iPhone) or the <b>⋮ menu</b> (Android), then <b>Linked devices</b>.</span></li>
            <li><span>Tap <b>Link a device</b> and point your phone at the code.</span></li>
          </ol>
          <div class="connect__alt">
            <span>Just looking around?</span>
            <button class="btn btn--sm" onClick=${actions.loadDemo}><${Icon} name="play" />Explore with sample chats</button>
          </div>
        </div>
        <${ConnectPanel} server=${server} actions=${actions} />
      </section>
    </main>
    <footer class="connect__foot">Call Desk reads chats — it never sends messages or calls anyone for you.</footer>
  </div>`;
}
