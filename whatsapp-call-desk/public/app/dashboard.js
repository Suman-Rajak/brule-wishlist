import { useEffect, useMemo, useRef } from 'preact/hooks';
import { html, cx, TIERS, TIER_META, relTime, greeting, todayLong, plural } from './lib.js';
import { Icon } from './icons.js';
import { Avatar, Badge, TierBadge, Meter, LogCallMenu, MoreMenu, CallButtons, Spinner } from './components.js';

const TIER_INTRO = {
  first: (days) =>
    `Read your last message ${plural(days, 'day')} ago or more and never replied, asked for a call back, or tried calling you. Most promising first.`,
  next: 'You had a good conversation or they seem interested — and you haven’t called yet.',
  later: 'Delivered but unread, lukewarm, gone quiet for weeks, or too soon to chase.',
  skip: 'Said no, wrong number, friends & family, spam or automated messages.',
  done: 'You’ve already called. They come back to the list if they message again.',
  snoozed: 'Call-backs and snoozes. They return to the list when the time comes.',
};

const EMPTY = {
  first: ['No one to chase right now', 'Nobody has left you on seen. Nice.'],
  next: ['No warm chats waiting', 'When a conversation goes well, it shows up here until you call.'],
  later: ['Nothing on the back burner', ''],
  skip: ['Nobody to skip', ''],
  done: ['No calls logged yet', 'Log a call from any card and it lands here.'],
  snoozed: ['Nothing snoozed', 'Choose “Call back later” after a call to park someone here.'],
};

const CHIPS = [
  { id: 'seen', label: 'Left on seen', icon: 'ticks', test: (c) => c.signals.leftOnSeen },
  { id: 'waiting', label: 'Waiting on you', icon: 'chat', test: (c) => c.signals.awaitingReply },
  { id: 'interested', label: 'Interest 60+', icon: 'sparkle', test: (c) => (c.analysis?.interest ?? 0) >= 60 },
  { id: 'notcalled', label: 'Never called', icon: 'phone', test: (c) => !c.signals.everCalled },
  { id: 'starred', label: 'Starred', icon: 'star', test: (c) => c.crm.starred },
];

function ConnectionPill({ server, actions }) {
  const wa = server.whatsapp;
  let dot = 'dot--bad';
  let text = 'Not connected';
  if (server.source === 'demo') {
    dot = '';
    text = 'Sample data';
  } else if (wa.status === 'ready') {
    dot = 'dot--good';
    text = wa.me?.name ? `${wa.me.name} · connected` : 'WhatsApp connected';
  } else if (['starting', 'qr', 'loading'].includes(wa.status)) {
    dot = 'dot--busy';
    text = wa.status === 'qr' ? 'Scan to connect' : 'Connecting…';
  }
  return html`<button class="pill" onClick=${actions.openConnect} title="WhatsApp connection">
    <span class=${cx('dot', dot)}></span><span class="hide-sm">${text}</span>
  </button>`;
}

function AnalyzeButton({ server, actions }) {
  const a = server.analysis;
  if (!a.configured) {
    return html`<button class="btn btn--sm" onClick=${() => actions.openSettings('ai')}><${Icon} name="sparkle" /><span class="hide-sm">Turn on AI</span></button>`;
  }
  if (a.running) {
    return html`<button class="btn btn--sm" disabled><${Spinner} /><span class="hide-sm">Analyzing ${a.done}/${a.total}</span></button>`;
  }
  if (a.pending > 0) {
    return html`<button class="btn btn--sm btn--primary" onClick=${() => actions.analyzeAll()}><${Icon} name="sparkle" />Analyze ${a.pending}</button>`;
  }
  return html`<button class="btn btn--sm btn--ghost" onClick=${() => actions.toast('Every chat has an up-to-date analysis.')}><${Icon} name="sparkle" /><span class="hide-sm">AI up to date</span></button>`;
}

export function TopBar({ server, actions, theme }) {
  const canSync = server.whatsapp.status === 'ready';
  return html`<header class="topbar">
    <div class="shell topbar__inner">
      <span class="brand"><span class="brand__mark">Brulé</span><span class="brand__rule"></span><span class="brand__name">Call Desk</span></span>
      <span class="topbar__spacer"></span>
      <div class="topbar__actions">
        <${ConnectionPill} server=${server} actions=${actions} />
        ${canSync
          ? html`<button class="icon-btn" onClick=${actions.sync} disabled=${server.sync.running} aria-label="Sync chats from WhatsApp" title="Sync chats from WhatsApp">
              ${server.sync.running ? html`<${Spinner} />` : html`<${Icon} name="refresh" />`}
            </button>`
          : null}
        <${AnalyzeButton} server=${server} actions=${actions} />
        <button class="icon-btn icon-btn--ghost hide-sm" onClick=${actions.toggleTheme} aria-label="Switch light or dark theme" title="Light / dark">
          <${Icon} name=${theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button class="icon-btn icon-btn--ghost" onClick=${() => actions.openSettings()} aria-label="Settings" title="Settings"><${Icon} name="sliders" /></button>
      </div>
    </div>
    <${ProgressStrip} server=${server} actions=${actions} />
  </header>`;
}

function ProgressStrip({ server, actions }) {
  const { sync, analysis } = server;
  let label = null;
  let done = 0;
  let total = 0;
  let cancel = null;
  if (sync.running) {
    label = `Reading your chats${sync.current ? ` · ${sync.current}` : ''}`;
    ({ done, total } = sync);
  } else if (analysis.running) {
    label = `Claude is reading chats${analysis.current ? ` · ${analysis.current}` : ''}`;
    ({ done, total } = analysis);
    cancel = actions.cancelAnalysis;
  }
  if (!label) return null;
  const pct = total ? Math.round((done / total) * 100) : 4;
  return html`<div class="shell progress" role="status">
    <${Spinner} />
    <span class="progress__label">${label}</span>
    <span class="progress__bar"><span class="progress__fill" style=${{ width: `${pct}%`, display: 'block' }}></span></span>
    <span class="muted">${total ? `${done} of ${total}` : ''}</span>
    ${cancel ? html`<button class="btn btn--sm btn--ghost" onClick=${cancel}>Stop</button>` : null}
  </div>`;
}

function Banners({ server, actions }) {
  const list = [];
  const wa = server.whatsapp;
  if (server.source === 'demo') {
    list.push(html`<div class="banner" key="demo"><${Icon} name="info" />
      <span class="banner__text">You’re looking at <b>sample chats</b> — the names and numbers are made up.</span>
      ${server.demoOnly ? null : html`<button class="btn btn--sm btn--primary" onClick=${actions.openConnect}>Connect WhatsApp</button>`}
      ${server.demoOnly ? null : html`<button class="btn btn--sm btn--ghost" onClick=${actions.exitDemo}>Exit sample data</button>`}
    </div>`);
  } else if (server.source === 'whatsapp' && wa.status !== 'ready') {
    list.push(html`<div class="banner banner--warn" key="wa"><${Icon} name="alert" />
      <span class="banner__text">WhatsApp isn’t connected — showing your last sync from ${relTime(server.lastSyncAt)}.${wa.error ? ` ${wa.error}` : ''}</span>
      <button class="btn btn--sm" onClick=${actions.openConnect}>Reconnect</button>
    </div>`);
  }
  if (server.sync.error) {
    list.push(html`<div class="banner banner--bad" key="sync"><${Icon} name="alert" /><span class="banner__text">Sync failed: ${server.sync.error}</span>
      <button class="btn btn--sm" onClick=${actions.sync}>Try again</button></div>`);
  }
  if (server.analysis.error) {
    list.push(html`<div class="banner banner--bad" key="ai"><${Icon} name="alert" /><span class="banner__text">Claude stopped: ${server.analysis.error}</span>
      <button class="btn btn--sm" onClick=${() => actions.openSettings('ai')}>Open settings</button></div>`);
  } else if (!server.analysis.configured && server.source === 'whatsapp') {
    list.push(html`<div class="banner" key="nokey"><${Icon} name="sparkle" />
      <span class="banner__text">These lists use a quick keyword read. Add a Claude API key to get interest scores, summaries and what to say on each call.</span>
      <button class="btn btn--sm btn--primary" onClick=${() => actions.openSettings('ai')}>Add API key</button></div>`);
  }
  return list.length ? html`<div>${list}</div>` : null;
}

function Hello({ server, stats, actions }) {
  const name = server.settings.ownerName || server.me?.name;
  const first = stats.tiers.first;
  const next = stats.tiers.next;
  let lede;
  if (first && next) {
    lede = html`Start with <strong>${plural(first, 'person', 'people')}</strong> who left you on seen or are waiting for a call. Then <strong>${plural(next, 'warm chat')}</strong> you haven’t called yet.`;
  } else if (first) {
    lede = html`<strong>${plural(first, 'person', 'people')}</strong> left you on seen or ${first === 1 ? 'is' : 'are'} waiting for a call. Start there.`;
  } else if (next) {
    lede = html`Nobody’s left you on seen. <strong>${plural(next, 'warm chat')}</strong> ${next === 1 ? 'is' : 'are'} waiting for a first call.`;
  } else {
    lede = html`You’re all caught up — nothing urgent to call about. ☕`;
  }
  return html`<section class="hello">
    <div>
      <p class="eyebrow">${todayLong()}${stats.calledToday ? ` · ${plural(stats.calledToday, 'call')} logged today` : ''}</p>
      <h1 class="hello__title">${greeting()}${name ? `, ${name.split(' ')[0]}` : ''}.</h1>
      <p class="hello__lede">${lede}</p>
    </div>
    <div class="hello__cta">
      <button class="btn btn--primary btn--lg" disabled=${!first && !next} onClick=${() => actions.startFocus()}>
        <${Icon} name="play" />Start calling
      </button>
      <small>${first + next ? `${first} first, then ${next} next — one at a time` : 'Nothing queued'}</small>
    </div>
  </section>`;
}

function Tiles({ stats, tier, onSelect }) {
  const hint = (t) => (t === 'done' && stats.calledToday ? `${stats.calledToday} logged today` : TIER_META[t].hint);
  return html`<nav class="tiles" role="tablist" aria-label="Call lists">
    ${TIERS.map(
      (t) => html`<button class="tile" key=${t} role="tab" data-tier=${t} aria-selected=${tier === t} onClick=${() => onSelect(t)}>
        <span class="tile__label"><span class="dot"></span>${TIER_META[t].label}</span>
        <span class="tile__value">${stats.tiers[t]}</span>
        <span class="tile__hint">${hint(t)}</span>
      </button>`,
    )}
  </nav>`;
}

function Row({ contact: c, showTier, active, actions }) {
  const a = c.analysis;
  const ai = a?.source === 'ai';
  const live = ['first', 'next', 'later'].includes(c.tier) && !c.crm.override;
  const why = live && ai && a.whyCall ? a.whyCall : c.reason;
  const meta = [c.displayNumber, a?.intent, c.note].filter(Boolean).join(' · ');
  const detail = ai && a.summary ? a.summary : c.lastMessage ? `${c.lastMessage.fromMe ? 'You' : 'Them'}: ${c.lastMessage.body}` : null;
  const open = () => actions.openContact(c.id);
  return html`<article class="row" data-tier=${c.tier} aria-current=${active ? 'true' : undefined} tabindex="0"
      onClick=${open} onKeyDown=${(e) => e.key === 'Enter' && e.target === e.currentTarget && open()}>
    <div class="row__rank">${c.rank}</div>
    <${Avatar} contact=${c} />
    <div class="row__main">
      <div class="row__head">
        <h3 class="row__name">${c.crm.starred ? '★ ' : ''}${c.name}</h3>
        ${meta ? html`<span class="row__meta">${meta}</span>` : null}
      </div>
      ${showTier || c.badges.length
        ? html`<div class="row__badges">
            ${showTier ? html`<${TierBadge} tier=${c.tier} />` : null}
            ${c.badges.map((b) => html`<${Badge} key=${b.kind} badge=${b} />`)}
          </div>`
        : null}
      <p class="row__why">${why}</p>
      ${detail ? html`<p class="row__summary">${detail}</p>` : null}
    </div>
    <div class="row__side">
      <${Meter} value=${a?.interest} />
      <div class="row__actions">
        <${CallButtons} contact=${c} actions=${actions} />
        <${LogCallMenu} contact=${c} actions=${actions} />
        <${MoreMenu} contact=${c} actions=${actions} />
      </div>
    </div>
  </article>`;
}

export function Dashboard({ server, data, ui, setUi, actions, theme }) {
  const searchRef = useRef(null);
  const { contacts, stats } = data;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const query = ui.search.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = query
      ? contacts.filter((c) =>
          [c.name, c.displayNumber, c.number, c.note, c.analysis?.intent, c.analysis?.summary, c.lastMessage?.body]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
      : contacts.filter((c) => c.tier === ui.tier);
    for (const chip of CHIPS) if (ui.chips.includes(chip.id)) list = list.filter(chip.test);
    const sorted = [...list];
    if (ui.sort === 'recent') sorted.sort((x, y) => (y.lastActivityAt ?? 0) - (x.lastActivityAt ?? 0));
    if (ui.sort === 'interest') sorted.sort((x, y) => (y.analysis?.interest ?? -1) - (x.analysis?.interest ?? -1));
    if (ui.sort === 'name') sorted.sort((x, y) => x.name.localeCompare(y.name));
    return sorted;
  }, [contacts, query, ui.tier, ui.chips, ui.sort]);

  const toggleChip = (id) =>
    setUi((u) => ({ ...u, chips: u.chips.includes(id) ? u.chips.filter((c) => c !== id) : [...u.chips, id] }));

  const [emptyTitle, emptyText] = query ? [`No one matches “${ui.search.trim()}”`, 'Try a name, a number or a word from the chat.'] : EMPTY[ui.tier];

  return html`
    <${TopBar} server=${server} actions=${actions} theme=${theme} />
    <main class="shell">
      <${Banners} server=${server} actions=${actions} />
      <${Hello} server=${server} stats=${stats} actions=${actions} />
      <${Tiles} stats=${stats} tier=${query ? null : ui.tier} onSelect=${(t) => setUi((u) => ({ ...u, tier: t, search: '' }))} />

      <div class="toolbar">
        <label class="search">
          <span class="visually-hidden">Search all chats</span>
          <${Icon} name="search" />
          <input ref=${searchRef} type="search" placeholder="Search everyone — name, number, chat…" value=${ui.search}
            onInput=${(e) => setUi((u) => ({ ...u, search: e.currentTarget.value }))} />
          ${ui.search ? null : html`<kbd class="hide-sm">/</kbd>`}
        </label>
        <div class="chips" role="group" aria-label="Filters">
          ${CHIPS.map(
            (chip) => html`<button class="chip" key=${chip.id} aria-pressed=${ui.chips.includes(chip.id)} onClick=${() => toggleChip(chip.id)}>
              <${Icon} name=${chip.icon} />${chip.label}
            </button>`,
          )}
        </div>
        <div class="toolbar__end">
          <label class="visually-hidden" for="sort">Sort</label>
          <select id="sort" class="select" value=${ui.sort} onChange=${(e) => setUi((u) => ({ ...u, sort: e.currentTarget.value }))}>
            <option value="priority">Best to call first</option>
            <option value="recent">Most recent chat</option>
            <option value="interest">Most interested</option>
            <option value="name">Name A–Z</option>
          </select>
          <a class="icon-btn icon-btn--sm" href="/api/export.csv?tiers=first,next" download title="Download today’s call list (CSV)" aria-label="Download call list as CSV">
            <${Icon} name="download" />
          </a>
        </div>
      </div>

      <div class="list-head">
        <div>
          <h2>${query ? 'Search results' : TIER_META[ui.tier].label}</h2>
          <p>${query ? plural(visible.length, 'match', 'matches') : ui.tier === 'first' ? TIER_INTRO.first(server.settings.seenAfterDays) : TIER_INTRO[ui.tier]}</p>
        </div>
      </div>

      <section class="list" aria-label="Contacts">
        ${visible.length
          ? visible.map((c) => html`<${Row} key=${c.id} contact=${c} showTier=${Boolean(query)} active=${ui.selectedId === c.id} actions=${actions} />`)
          : html`<div class="empty"><${Icon} name="inbox" /><h3>${emptyTitle}</h3>${emptyText ? html`<p>${emptyText}</p>` : null}</div>`}
      </section>
    </main>
  `;
}
