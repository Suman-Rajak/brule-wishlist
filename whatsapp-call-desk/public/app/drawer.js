import { useEffect, useRef, useState } from 'preact/hooks';
import { html, api, cx, OUTCOMES, OUTCOME_LABEL, callbackChoices, dayLabel, clock, dateTime, relTime, copyText } from './lib.js';
import { Icon, Ticks } from './icons.js';
import { Avatar, Badge, TierBadge, Meter, MoreMenu, CallButtons, Spinner } from './components.js';

const CATEGORY_LABEL = {
  lead: 'Lead', customer: 'Customer', partner: 'Partner', personal: 'Personal', service: 'Automated', spam: 'Spam', other: 'Other',
};

export function Conversation({ messages, callLogs = [], limit }) {
  const ref = useRef(null);
  const items = [
    ...messages.filter((m) => !['call_log', 'e2e_notification'].includes(m.type)).map((m) => ({ kind: 'msg', ts: m.ts, m })),
    ...callLogs.map((c) => ({ kind: 'call', ts: c.ts, c })),
  ].sort((a, b) => a.ts - b.ts);
  const shown = limit ? items.slice(-limit) : items;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length]);

  let lastDay = null;
  return html`<div class="chat" ref=${ref}>
    ${shown.length === 0 ? html`<span class="muted">No messages.</span>` : null}
    ${shown.map((item) => {
      const day = dayLabel(item.ts);
      const sep = day !== lastDay ? html`<span class="chat__day">${day}</span>` : null;
      lastDay = day;
      if (item.kind === 'call') {
        return html`${sep}<div class="bubble bubble--call"><${Icon} name=${item.c.fromMe ? 'phone' : 'phoneIn'} class="icon" /> WhatsApp call ${item.c.fromMe ? 'from you' : 'from them'} · ${clock(item.ts)}</div>`;
      }
      const m = item.m;
      return html`${sep}<div class=${cx('bubble', m.fromMe ? 'bubble--me' : 'bubble--them')}>
        ${m.body || html`<span class="muted">[${m.type}]</span>`}
        <span class="bubble__meta">${clock(m.ts)}${m.fromMe ? html`<${Ticks} ack=${m.ack} />` : null}</span>
      </div>`;
    })}
  </div>`;
}

function CallHistory({ contact, actions }) {
  const calls = [
    ...contact.crm.calls.map((c) => ({ ts: c.at, text: OUTCOME_LABEL[c.outcome] ?? c.outcome, note: c.note, desk: true })),
    ...(contact.callLogs ?? []).map((c) => ({ ts: c.ts, text: c.fromMe ? 'WhatsApp call from you' : 'WhatsApp call from them' })),
  ].sort((a, b) => b.ts - a.ts);
  if (!calls.length) return html`<p class="muted" style=${{ margin: 0 }}>No calls yet.</p>`;
  return html`<ul class="timeline">
    ${calls.map(
      (c, i) => html`<li key=${i}>
        <time datetime=${new Date(c.ts).toISOString()}>${dateTime(c.ts)}</time>
        <span>${c.text}${c.note ? html`<span class="muted"> — ${c.note}</span>` : null}</span>
      </li>`,
    )}
    ${contact.crm.calls.length
      ? html`<li><button class="btn btn--sm btn--ghost" onClick=${() => actions.undoCall(contact)}><${Icon} name="undo" />Undo last logged call</button></li>`
      : null}
  </ul>`;
}

export function OutcomeButtons({ contact, actions, onLogged, keys = false }) {
  const [askWhen, setAskWhen] = useState(false);
  const log = async (outcome, extra) => {
    setAskWhen(false);
    await actions.logCall(contact, outcome, extra);
    onLogged?.(outcome);
  };
  if (askWhen) {
    return html`<div>
      <p class="muted" style=${{ margin: '0 0 8px' }}>When should you call back?</p>
      <div class="outcomes">
        ${callbackChoices().map(
          (c) => html`<button class="outcome outcome--wait" key=${c.label} onClick=${() => log('callback', { callbackAt: c.at })}><${Icon} name="calendar" />${c.label}</button>`,
        )}
        <button class="outcome" onClick=${() => setAskWhen(false)}><${Icon} name="chevronLeft" />Back</button>
      </div>
    </div>`;
  }
  return html`<div class="outcomes">
    ${OUTCOMES.map(
      (o) => html`<button class=${`outcome outcome--${o.tone}`} key=${o.id} data-outcome=${o.id}
          onClick=${() => (o.id === 'callback' ? setAskWhen(true) : log(o.id))}>
        <${Icon} name=${o.icon} />${o.label}${keys ? html`<kbd>${o.key}</kbd>` : null}
      </button>`,
    )}
  </div>`;
}

export function AnalysisCard({ contact, server, actions, busy }) {
  const a = contact.analysis;
  if (!a) return null;
  const ai = a.source === 'ai';
  return html`<div class="card">
    ${a.summary ? html`<p style=${{ margin: 0, fontSize: '14.5px' }}>${a.summary}</p>` : null}
    <div class="facts">
      <div class="fact"><div class="fact__k">Interest</div><div class="fact__v">${a.interest ?? '—'}<span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}> /100</span></div></div>
      <div class="fact"><div class="fact__k">Mood</div><div class="fact__v">${a.sentiment ?? '—'}</div></div>
      <div class="fact"><div class="fact__k">Type</div><div class="fact__v">${CATEGORY_LABEL[a.category] ?? '—'}</div></div>
    </div>
    <div style=${{ marginTop: '14px' }}><${Meter} value=${a.interest} label="Interest" /></div>
    ${!ai
      ? html`<p class="note">This is a quick keyword read. ${server.analysis.configured ? 'Ask Claude for a proper read of this chat.' : 'Add a Claude API key in Settings for a proper read.'}</p>`
      : !a.fresh
        ? html`<p class="note">Written before their latest messages — ask Claude to read it again.</p>`
        : null}
    ${a.error ? html`<p class="note" style=${{ color: 'var(--bad)' }}>Last attempt failed: ${a.error}</p>` : null}
    ${server.analysis.configured && !contact.demo
      ? html`<div style=${{ marginTop: '12px' }}>
          <button class="btn btn--sm" disabled=${busy} onClick=${() => actions.analyzeOne(contact)}>
            ${busy ? html`<${Spinner} />` : html`<${Icon} name="sparkle" />`}${ai ? 'Read again with Claude' : 'Read with Claude'}
          </button>
        </div>`
      : null}
    ${ai && a.model && a.model !== 'demo' ? html`<p class="muted" style=${{ margin: '10px 0 0', fontSize: '12px' }}>By ${a.model} · ${relTime(a.analyzedAt)}</p>` : null}
  </div>`;
}

export function ContactDrawer({ id, version, server, actions, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const notesDirty = useRef(false);

  useEffect(() => {
    let alive = true;
    api(`/api/contacts/${encodeURIComponent(id)}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setError(null);
        if (!notesDirty.current) setNotes(d.crm.notes);
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [id, version]);

  useEffect(() => {
    notesDirty.current = false;
    setShowQr(false);
  }, [id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.menu')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveNotes = async () => {
    if (!detail || !notesDirty.current) return;
    notesDirty.current = false;
    await actions.update(detail, { notes });
  };

  const c = detail;
  const analyze = async () => {
    setBusy(true);
    try {
      await actions.analyzeOne(c);
    } finally {
      setBusy(false);
    }
  };

  return html`
    <div class="scrim" onClick=${onClose}></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label=${c ? c.name : 'Contact'}>
      <div class="drawer__top">
        <button class="icon-btn icon-btn--ghost" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>
        <span class="topbar__spacer"></span>
        ${c && server.whatsapp.status === 'ready' && !c.demo
          ? html`<button class="btn btn--sm btn--ghost" onClick=${() => actions.refreshOne(c)} title="Fetch the latest messages"><${Icon} name="refresh" />Refresh</button>`
          : null}
        ${c ? html`<${MoreMenu} contact=${c} actions=${actions} />` : null}
      </div>
      <div class="drawer__body">
        ${error ? html`<p class="muted">${error}</p>` : null}
        ${!c && !error ? html`<p class="muted"><${Spinner} /> Loading…</p>` : null}
        ${c
          ? html`
            <div class="person">
              <${Avatar} contact=${c} size="xl" />
              <div style=${{ minWidth: 0 }}>
                <h2>${c.name}</h2>
                <div class="person__number">
                  ${c.displayNumber ?? 'Number hidden by WhatsApp'}
                  ${c.displayNumber
                    ? html`<button class="icon-btn icon-btn--sm icon-btn--ghost" title="Copy number" aria-label="Copy number"
                        onClick=${async () => actions.toast((await copyText(c.displayNumber)) ? 'Number copied' : 'Couldn’t copy')}><${Icon} name="copy" /></button>`
                    : null}
                </div>
                ${c.note ? html`<div class="muted" style=${{ fontSize: '13px' }}>${c.note}</div>` : null}
              </div>
            </div>
            <div class="row__badges" style=${{ marginTop: '14px' }}>
              <${TierBadge} tier=${c.tier} />
              ${c.badges.map((b) => html`<${Badge} key=${b.kind} badge=${b} />`)}
            </div>
            <p style=${{ margin: '12px 0 0', fontSize: '14px' }}>${c.reason}</p>

            <div class="focus__callrow" style=${{ marginTop: '18px' }}>
              <${CallButtons} contact=${c} actions=${actions} compactOnPhone=${false} />
              ${c.telUrl
                ? html`<button class="btn btn--sm" aria-pressed=${showQr} onClick=${() => setShowQr((s) => !s)}><${Icon} name="qr" />Call from phone</button>`
                : null}
            </div>
            ${showQr && c.telUrl
              ? html`<div class="card dialqr" style=${{ marginTop: '12px' }}>
                  <img src=${`/api/dial-qr/${encodeURIComponent(c.id)}`} alt=${`QR code to dial ${c.displayNumber}`} />
                  <p>Point your phone’s camera at this code to dial <b>${c.displayNumber}</b> straight away.</p>
                </div>`
              : null}

            ${c.analysis?.whyCall || c.analysis?.opener || c.analysis?.talkingPoints?.length
              ? html`<div class="section">
                  <p class="eyebrow">Before you dial</p>
                  ${c.analysis.whyCall ? html`<p style=${{ margin: '0 0 12px', fontSize: '15px', fontWeight: 500 }}>${c.analysis.whyCall}</p>` : null}
                  ${c.analysis.opener
                    ? html`<figure style=${{ margin: 0 }}>
                        <blockquote class="quote">“${c.analysis.opener}”</blockquote>
                        <figcaption class="muted" style=${{ fontSize: '12px', marginTop: '6px' }}>Say this first
                          <button class="btn btn--sm btn--ghost" onClick=${async () => actions.toast((await copyText(c.analysis.opener)) ? 'Copied' : 'Couldn’t copy')}><${Icon} name="copy" />Copy</button>
                        </figcaption>
                      </figure>`
                    : null}
                  ${c.analysis.talkingPoints?.length
                    ? html`<ul class="points" style=${{ marginTop: '12px' }}>${c.analysis.talkingPoints.map((p) => html`<li key=${p}>${p}</li>`)}</ul>`
                    : null}
                </div>`
              : null}

            <div class="section">
              <p class="eyebrow">What Claude noticed</p>
              <${AnalysisCard} contact=${c} server=${server} actions=${{ ...actions, analyzeOne: analyze }} busy=${busy} />
            </div>

            <div class="section">
              <p class="eyebrow">How did the call go?</p>
              <${OutcomeButtons} contact=${c} actions=${actions} />
            </div>

            <div class="section">
              <p class="eyebrow">Call history</p>
              <${CallHistory} contact=${c} actions=${actions} />
            </div>

            <div class="section">
              <p class="eyebrow">Notes</p>
              <label class="visually-hidden" for="notes">Notes about ${c.name}</label>
              <textarea id="notes" class="notes" placeholder="Anything to remember for next time…" value=${notes}
                onInput=${(e) => { notesDirty.current = true; setNotes(e.currentTarget.value); }} onBlur=${saveNotes}></textarea>
            </div>

            <div class="section">
              <p class="eyebrow">Chat · last ${c.conversationLength} messages</p>
              <${Conversation} messages=${c.messages} callLogs=${c.callLogs} />
            </div>
          `
          : null}
      </div>
    </aside>
  `;
}
