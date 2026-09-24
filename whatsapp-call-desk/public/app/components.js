import { useEffect, useRef, useState } from 'preact/hooks';
import { html, cx, TIER_META, OUTCOMES, callbackChoices } from './lib.js';
import { Icon } from './icons.js';

export function Spinner() {
  return html`<span class="spinner" aria-hidden="true"></span>`;
}

export function Avatar({ contact, size = '' }) {
  const [failed, setFailed] = useState(false);
  return html`<span class=${cx('avatar', size && `avatar--${size}`)} data-hue=${contact.hue} aria-hidden="true">
    ${contact.initials}
    ${contact.avatar && !failed
      ? html`<img src=${contact.avatar} alt="" loading="lazy" referrerpolicy="no-referrer" onError=${() => setFailed(true)} />`
      : null}
  </span>`;
}

export function TierBadge({ tier }) {
  return html`<span class="badge badge--tier" data-tier=${tier}><span class="dot"></span>${TIER_META[tier].label}</span>`;
}

const BADGE_ICON = {
  theycalled: 'phoneIn',
  seen: 'ticks',
  read: 'ticks',
  delivered: 'ticks',
  undelivered: 'alert',
  waiting: 'chat',
  attempts: 'phoneMissed',
  callback: 'calendar',
};

export function Badge({ badge }) {
  return html`<span class=${`badge badge--${badge.kind}`}><${Icon} name=${BADGE_ICON[badge.kind] ?? 'info'} />${badge.label}</span>`;
}

export function Meter({ value, label = 'Interest' }) {
  if (value === null || value === undefined) return null;
  return html`<div class="meter" title=${`${label}: ${value} out of 100`}>
    <span class="meter__label">${label}</span>
    <span class="meter__track" role="meter" aria-valuenow=${value} aria-valuemin="0" aria-valuemax="100" aria-label=${label}>
      <span class="meter__fill" style=${{ width: `${value}%` }}></span>
    </span>
    <span class="meter__value">${value}</span>
  </div>`;
}

/** Dropdown menu. `children` is a function (close) => items. */
export function Menu({ label, button, up = false, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const close = () => setOpen(false);
  return html`<span class="menu-wrap" ref=${ref} onClick=${(e) => e.stopPropagation()}>
    ${button({ open, toggle: () => setOpen((o) => !o), label })}
    ${open ? html`<div class=${cx('menu', up && 'menu--up')} role="menu" aria-label=${label}>${children(close)}</div>` : null}
  </span>`;
}

export function MenuItem({ icon, onClick, children, hint }) {
  return html`<button class="menu__item" role="menuitem" onClick=${onClick}>
    ${icon ? html`<${Icon} name=${icon} />` : null}<span>${children}</span>${hint ? html`<kbd>${hint}</kbd>` : null}
  </button>`;
}

/** "Log call" dropdown with call-back time choices. */
export function LogCallMenu({ contact, actions, up = false, compact = false }) {
  return html`<${Menu}
    label=${`Log a call with ${contact.name}`}
    up=${up}
    button=${({ toggle, open, label }) => html`<button class="btn btn--sm" aria-haspopup="menu" aria-expanded=${open} aria-label=${label} onClick=${toggle}>
      <${Icon} name="check" />${compact ? null : html`<span class="hide-sm">Log call</span>`}<${Icon} name="chevronDown" />
    </button>`}
  >
    ${(close) => html`
      <div class="menu__label">How did it go?</div>
      ${OUTCOMES.filter((o) => o.id !== 'callback').map(
        (o) => html`<${MenuItem} key=${o.id} icon=${o.icon} onClick=${() => { close(); actions.logCall(contact, o.id); }}>${o.label}<//>`,
      )}
      <div class="menu__sep"></div>
      <div class="menu__label">Call back…</div>
      ${callbackChoices().map(
        (c) => html`<${MenuItem} key=${c.label} icon="calendar" onClick=${() => { close(); actions.logCall(contact, 'callback', { callbackAt: c.at }); }}>${c.label}<//>`,
      )}
    `}
  <//>`;
}

/** Snooze / move / star menu. */
export function MoreMenu({ contact, actions, up = false }) {
  const moveTo = (tier, close) => {
    close();
    actions.update(contact, { override: tier, snoozeUntil: null }, `Moved ${contact.name}`);
  };
  return html`<${Menu}
    label=${`More for ${contact.name}`}
    up=${up}
    button=${({ toggle, open, label }) => html`<button class="icon-btn icon-btn--sm icon-btn--ghost" aria-haspopup="menu" aria-expanded=${open} aria-label=${label} title="More" onClick=${toggle}><${Icon} name="more" /></button>`}
  >
    ${(close) => html`
      <${MenuItem} icon="star" onClick=${() => { close(); actions.update(contact, { starred: !contact.crm.starred }); }}>${contact.crm.starred ? 'Remove star' : 'Star — keep near the top'}<//>
      <div class="menu__sep"></div>
      <div class="menu__label">Snooze</div>
      <${MenuItem} icon="clock" onClick=${() => { close(); actions.update(contact, { snoozeUntil: Date.now() + 86400e3 }, `Snoozed ${contact.name} for a day`); }}>For a day<//>
      <${MenuItem} icon="clock" onClick=${() => { close(); actions.update(contact, { snoozeUntil: Date.now() + 3 * 86400e3 }, `Snoozed ${contact.name} for 3 days`); }}>For 3 days<//>
      <${MenuItem} icon="clock" onClick=${() => { close(); actions.update(contact, { snoozeUntil: Date.now() + 7 * 86400e3 }, `Snoozed ${contact.name} for a week`); }}>For a week<//>
      <div class="menu__sep"></div>
      <div class="menu__label">Move to</div>
      ${contact.tier !== 'first' ? html`<${MenuItem} icon="arrowRight" onClick=${() => moveTo('first', close)}>Call first<//>` : null}
      ${contact.tier !== 'next' ? html`<${MenuItem} icon="arrowRight" onClick=${() => moveTo('next', close)}>Call next<//>` : null}
      ${contact.tier !== 'later' ? html`<${MenuItem} icon="arrowRight" onClick=${() => moveTo('later', close)}>Maybe later<//>` : null}
      ${contact.tier !== 'skip' ? html`<${MenuItem} icon="userX" onClick=${() => moveTo('skip', close)}>Don’t call<//>` : null}
      ${contact.crm.override || contact.crm.snoozeUntil
        ? html`<${MenuItem} icon="undo" onClick=${() => { close(); actions.update(contact, { override: null, snoozeUntil: null }, 'Back to its automatic list'); }}>Let the AI decide again<//>`
        : null}
    `}
  <//>`;
}

/** Call + WhatsApp buttons. Demo contacts can't be dialled. */
export function CallButtons({ contact, actions, size = 'sm', label = true, compactOnPhone = true }) {
  const onDemo = (e) => {
    e.preventDefault();
    e.stopPropagation();
    actions.toast(
      contact.demo
        ? 'Sample contact — calling is turned off for made-up numbers.'
        : 'WhatsApp doesn’t share this contact’s number. Call them from WhatsApp on your phone.',
    );
  };
  const stop = (e) => e.stopPropagation();
  const btnSize = size === 'lg' ? 'btn--lg' : 'btn--sm';
  return html`
    <a class=${`btn btn--call ${btnSize}`} href=${contact.telUrl ?? '#'} onClick=${contact.telUrl ? stop : onDemo} aria-label=${`Call ${contact.name}`}>
      <${Icon} name="phone" />${label ? html`<span class=${size === 'lg' || !compactOnPhone ? '' : 'hide-sm'}>${size === 'lg' ? `Call ${contact.displayNumber ?? ''}` : 'Call'}</span>` : null}
    </a>
    <a class=${size === 'lg' ? 'btn btn--lg' : 'icon-btn icon-btn--sm'} href=${contact.waUrl ?? '#'} target="_blank" rel="noopener" onClick=${contact.waUrl ? stop : onDemo} aria-label=${`Open ${contact.name} in WhatsApp`} title="Open in WhatsApp">
      <${Icon} name="chat" />${size === 'lg' ? html`<span>WhatsApp</span>` : null}
    </a>
  `;
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return html`
    <div class="scrim" onClick=${onClose}></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="modal__card" style=${wide ? { width: 'min(820px, 100%)' } : null}>
        <div class="modal__head">
          <h2>${title}</h2>
          <button class="icon-btn icon-btn--ghost" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button>
        </div>
        <div class="modal__body">${children}</div>
        ${footer ? html`<div class="modal__foot">${footer}</div>` : null}
      </div>
    </div>
  `;
}

export function Switch({ checked, onChange, label, hint }) {
  return html`<label class="switch">
    <input type="checkbox" checked=${checked} onChange=${(e) => onChange(e.currentTarget.checked)} />
    <span class="switch__track" aria-hidden="true"></span>
    <span class="switch__text">${label}${hint ? html`<small>${hint}</small>` : null}</span>
  </label>`;
}

export function Toasts({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return html`<div class="toasts" role="status" aria-live="polite">
    ${toasts.map(
      (t) => html`<div class=${cx('toast', t.tone === 'bad' && 'toast--bad')} key=${t.id}>
        <span class="toast__text">${t.message}</span>
        ${t.action ? html`<button onClick=${() => { dismiss(t.id); t.action.run(); }}>${t.action.label}</button>` : null}
        <button aria-label="Dismiss" onClick=${() => dismiss(t.id)}>✕</button>
      </div>`,
    )}
  </div>`;
}
