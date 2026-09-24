import { useEffect, useRef, useState } from 'preact/hooks';
import { html, api, TIER_META, plural, copyText } from './lib.js';
import { Icon } from './icons.js';
import { Avatar, Badge, TierBadge, CallButtons, Spinner } from './components.js';
import { Conversation, OutcomeButtons } from './drawer.js';

/** One-at-a-time calling session over a frozen queue of contact ids. */
export function FocusMode({ queue, contacts, server, actions, onExit }) {
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState(null);
  const [log, setLog] = useState([]);
  const [notes, setNotes] = useState('');
  const notesDirty = useRef(false);

  const id = queue[index];
  const finished = index >= queue.length;
  const contact = contacts.find((c) => c.id === id);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setDetail(null);
    notesDirty.current = false;
    api(`/api/contacts/${encodeURIComponent(id)}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setNotes(d.crm.notes);
      })
      .catch(() => alive && setDetail(null));
    return () => {
      alive = false;
    };
  }, [id]);

  const saveNotes = async () => {
    if (!detail || !notesDirty.current) return;
    notesDirty.current = false;
    await actions.update(detail, { notes });
  };

  const go = async (delta) => {
    await saveNotes();
    setIndex((i) => Math.max(0, Math.min(queue.length, i + delta)));
  };

  const logged = (outcome) => {
    setLog((l) => [...l, { id, outcome }]);
    setTimeout(() => go(1), 250);
  };

  useEffect(() => {
    const onKey = async (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'Escape') onExit();
      if (finished || !detail) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      const direct = { 1: 'interested', 3: 'no_answer', 4: 'not_interested', 5: 'wrong_number' }[e.key];
      if (direct) {
        await actions.logCall(detail, direct);
        logged(direct);
      }
      if (e.key === '2') document.querySelector('[data-outcome="callback"]')?.click();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const pct = queue.length ? Math.round((Math.min(index, queue.length) / queue.length) * 100) : 100;
  const c = detail;
  const a = c?.analysis;

  return html`<div class="focus" role="dialog" aria-modal="true" aria-label="Calling session">
    <div class="focus__bar"><div class="shell focus__top">
      <button class="btn btn--sm" onClick=${onExit}><${Icon} name="x" />End session</button>
      <div class="focus__progress">
        <span class="hide-sm">${finished ? 'Done' : `${index + 1} of ${queue.length}`}${contact && !finished ? ` · ${TIER_META[contact.tier].label}` : ''}</span>
        <span class="progress__bar"><span class="progress__fill" style=${{ width: `${pct}%` }}></span></span>
      </div>
      <button class="icon-btn" onClick=${() => go(-1)} disabled=${index === 0} aria-label="Previous person" title="Previous (←)"><${Icon} name="chevronLeft" /></button>
      <button class="icon-btn" onClick=${() => go(1)} disabled=${finished} aria-label="Skip to next person" title="Skip (→)"><${Icon} name="chevronRight" /></button>
    </div></div>

    <div class="focus__scroll">
      <div class="shell">
        ${finished
          ? html`<div class="done-card">
              <p class="eyebrow">Session complete</p>
              <h2>That’s the list. ☕</h2>
              <p>${log.length ? `You logged ${plural(log.length, 'call')} this session.` : 'You went through everyone without logging a call.'}</p>
              <div class="done-stats">
                <div><b>${log.filter((l) => l.outcome === 'interested').length}</b><span>Interested</span></div>
                <div><b>${log.filter((l) => l.outcome === 'callback').length}</b><span>Call backs</span></div>
                <div><b>${log.filter((l) => l.outcome === 'no_answer').length}</b><span>No answer</span></div>
              </div>
              <button class="btn btn--primary btn--lg" onClick=${onExit}>Back to the dashboard</button>
            </div>`
          : !c
            ? html`<p class="muted" style=${{ padding: '40px 0' }}><${Spinner} /> Loading…</p>`
            : html`<div class="focus__grid">
                <section class="focus__card">
                  <div class="person">
                    <${Avatar} contact=${c} size="xl" />
                    <div style=${{ minWidth: 0 }}>
                      <h2 class="focus__name">${c.name}</h2>
                      <div class="focus__number">
                        ${c.displayNumber ?? 'Number hidden by WhatsApp'}
                        ${c.displayNumber
                          ? html` <button class="icon-btn icon-btn--sm icon-btn--ghost" aria-label="Copy number" title="Copy number"
                              onClick=${async () => actions.toast((await copyText(c.displayNumber)) ? 'Number copied' : 'Couldn’t copy')}><${Icon} name="copy" /></button>`
                          : null}
                      </div>
                    </div>
                  </div>
                  <div class="row__badges" style=${{ marginTop: '16px' }}>
                    <${TierBadge} tier=${c.tier} />
                    ${c.badges.map((b) => html`<${Badge} key=${b.kind} badge=${b} />`)}
                  </div>
                  <p class="focus__why">${a?.source === 'ai' && a.whyCall ? a.whyCall : c.reason}</p>

                  ${a?.opener
                    ? html`<div class="section">
                        <p class="eyebrow">Say this first</p>
                        <blockquote class="quote" style=${{ margin: 0 }}>“${a.opener}”</blockquote>
                      </div>`
                    : null}
                  ${a?.talkingPoints?.length
                    ? html`<div class="section">
                        <p class="eyebrow">Talking points</p>
                        <ul class="points">${a.talkingPoints.map((p) => html`<li key=${p}>${p}</li>`)}</ul>
                      </div>`
                    : null}

                  <div class="focus__callrow">
                    <${CallButtons} contact=${c} actions=${actions} size="lg" />
                  </div>

                  <div class="section">
                    <p class="eyebrow">How did it go? <span style=${{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— keys 1–5, → to skip</span></p>
                    <${OutcomeButtons} key=${c.id} contact=${c} actions=${actions} onLogged=${logged} keys=${true} />
                    <button class="btn btn--sm btn--ghost" style=${{ marginTop: '10px' }} onClick=${() => go(1)}>Skip for now<${Icon} name="arrowRight" /></button>
                  </div>
                </section>

                <aside class="focus__side">
                  ${c.telUrl
                    ? html`<div class="card dialqr">
                        <img src=${`/api/dial-qr/${encodeURIComponent(c.id)}`} alt=${`QR code to dial ${c.displayNumber}`} />
                        <p><b>Calling from your phone?</b><br />Point its camera here to dial ${c.displayNumber}.</p>
                      </div>`
                    : null}
                  ${a?.summary
                    ? html`<div class="card">
                        <p class="eyebrow" style=${{ marginBottom: '8px' }}>What Claude noticed</p>
                        <p style=${{ margin: 0 }}>${a.summary}</p>
                      </div>`
                    : null}
                  <div>
                    <p class="eyebrow" style=${{ marginBottom: '8px' }}>Latest messages</p>
                    <${Conversation} messages=${c.messages} callLogs=${c.callLogs} limit=${8} />
                  </div>
                  <div>
                    <label class="eyebrow" for="focus-notes" style=${{ display: 'block', marginBottom: '8px' }}>Notes</label>
                    <textarea id="focus-notes" class="notes" placeholder="What did they say?" value=${notes}
                      onInput=${(e) => { notesDirty.current = true; setNotes(e.currentTarget.value); }} onBlur=${saveNotes}></textarea>
                  </div>
                </aside>
              </div>`}
      </div>
    </div>
  </div>`;
}
