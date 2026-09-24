import { html } from './lib.js';

// Hand-drawn 24×24 stroke icons.
const PATHS = {
  phone: () => html`<path d="M6.6 3.5h2.7c.4 0 .8.3.9.7l1 3.3c.1.4 0 .8-.3 1l-1.7 1.4a12 12 0 0 0 5 5l1.4-1.7c.3-.3.7-.4 1-.3l3.3 1c.4.1.7.5.7.9v2.7c0 1.2-1 2.1-2.2 2A16.8 16.8 0 0 1 4.5 5.7c-.1-1.2.8-2.2 2.1-2.2z" />`,
  phoneIn: () => html`<path d="M6.6 3.5h2.7c.4 0 .8.3.9.7l1 3.3c.1.4 0 .8-.3 1l-1.7 1.4a12 12 0 0 0 5 5l1.4-1.7c.3-.3.7-.4 1-.3l3.3 1c.4.1.7.5.7.9v2.7c0 1.2-1 2.1-2.2 2A16.8 16.8 0 0 1 4.5 5.7c-.1-1.2.8-2.2 2.1-2.2z" /><path d="M20.5 3.5 15 9M15 4.5V9h4.5" />`,
  phoneMissed: () => html`<path d="M6.6 3.5h2.7c.4 0 .8.3.9.7l1 3.3c.1.4 0 .8-.3 1l-1.7 1.4a12 12 0 0 0 5 5l1.4-1.7c.3-.3.7-.4 1-.3l3.3 1c.4.1.7.5.7.9v2.7c0 1.2-1 2.1-2.2 2A16.8 16.8 0 0 1 4.5 5.7c-.1-1.2.8-2.2 2.1-2.2z" /><path d="m15.5 3.5 5 5M20.5 3.5l-5 5" />`,
  chat: () => html`<path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8.5L6 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" />`,
  check: () => html`<path d="m5 12.5 4.5 4.5L19 7.5" />`,
  x: () => html`<path d="M6 6l12 12M18 6 6 18" />`,
  clock: () => html`<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />`,
  eye: () => html`<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" />`,
  sparkle: () => html`<path d="m11 3.5 1.8 5.2 5.2 1.8-5.2 1.8L11 17.5l-1.8-5.2L4 10.5l5.2-1.8zM18.5 15l.8 2 2 .7-2 .8-.8 2-.7-2-2-.8 2-.7z" />`,
  refresh: () => html`<path d="M20 11.5a8 8 0 1 0-2.4 5.9" /><path d="M20.5 4.5v7h-7" />`,
  sliders: () => html`<path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" />`,
  search: () => html`<circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" />`,
  star: () => html`<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7.9-5.6-4-3.9 5.6-.8z" />`,
  more: () => html`<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />`,
  chevronDown: () => html`<path d="m6 9 6 6 6-6" />`,
  chevronRight: () => html`<path d="m9 6 6 6-6 6" />`,
  chevronLeft: () => html`<path d="m15 6-6 6 6 6" />`,
  arrowRight: () => html`<path d="M5 12h14M13 6l6 6-6 6" />`,
  copy: () => html`<rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />`,
  qr: () => html`<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h2M20 14v2" />`,
  moon: () => html`<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />`,
  sun: () => html`<circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />`,
  play: () => html`<path d="M8 5.5v13l10.5-6.5z" />`,
  logout: () => html`<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />`,
  alert: () => html`<path d="M12 4 21 19.5H3z" /><path d="M12 10v4M12 17v.01" />`,
  info: () => html`<circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" />`,
  trash: () => html`<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7" />`,
  undo: () => html`<path d="M9 13.5 4.5 9 9 4.5" /><path d="M4.5 9h10a5.5 5.5 0 0 1 0 11H11" />`,
  calendar: () => html`<rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />`,
  download: () => html`<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />`,
  thumbsUp: () => html`<path d="M7.5 10.5v9h-3v-9zM7.5 10.5l3.8-7a2 2 0 0 1 2.2 2v4h5.2a2 2 0 0 1 2 2.3l-1.2 6.6a2 2 0 0 1-2 1.6H7.5" />`,
  thumbsDown: () => html`<path d="M16.5 13.5v-9h3v9zM16.5 13.5l-3.8 7a2 2 0 0 1-2.2-2v-4H5.3a2 2 0 0 1-2-2.3l1.2-6.6a2 2 0 0 1 2-1.6h10" />`,
  hash: () => html`<path d="M5 9h14M5 15h14M10.5 4 8.5 20M15.5 4l-2 16" />`,
  skip: () => html`<path d="M5.5 5.5v13l9.5-6.5zM18.5 5.5v13" />`,
  pencil: () => html`<path d="M4 20h4L19.5 8.5l-4-4L4 16z" />`,
  inbox: () => html`<path d="M3.5 13 6.5 5h11l3 8v6h-17z" /><path d="M3.5 13h5l1.5 2.5h4l1.5-2.5h5" />`,
  external: () => html`<path d="M14 4.5h5.5V10M19.5 4.5l-8.5 8.5M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />`,
  link: () => html`<path d="M9.5 14.5l5-5" /><path d="m11 6.5 1.6-1.6a3.9 3.9 0 0 1 5.5 5.5L16.5 12M13 17.5l-1.6 1.6a3.9 3.9 0 0 1-5.5-5.5L7.5 12" />`,
  lock: () => html`<rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />`,
  userX: () => html`<circle cx="9.5" cy="8" r="3.8" /><path d="M2.5 20.5a7 7 0 0 1 14 0M17 8.5l4.5 4.5M21.5 8.5 17 13" />`,
  ticks: () => html`<path d="m1.5 12.5 4 4 8-9M9.5 16.5l1 0 8-9" />`,
};

export function Icon({ name, class: className = '', title }) {
  return html`<svg class=${`icon ${className}`} viewBox="0 0 24 24" aria-hidden=${title ? undefined : 'true'} role=${title ? 'img' : undefined}>
    ${title ? html`<title>${title}</title>` : null}${(PATHS[name] ?? PATHS.info)()}
  </svg>`;
}

/** WhatsApp-style ticks for your own messages. */
export function Ticks({ ack }) {
  if (ack === null || ack === undefined || ack < 0) return null;
  if (ack <= 1) {
    return html`<svg class="ticks" viewBox="0 0 18 12" aria-label="Sent"><path d="m3 6.5 3 3 6-7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  }
  return html`<svg class=${`ticks ${ack >= 3 ? 'ticks--read' : ''}`} viewBox="0 0 18 12" aria-label=${ack >= 3 ? 'Read' : 'Delivered'}>
    <path d="m1 6.5 3 3 6-7M7.5 9.5l.6.1 6.4-7.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}
