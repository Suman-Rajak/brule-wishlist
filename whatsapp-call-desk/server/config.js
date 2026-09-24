import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Optional .env next to package.json (PORT, ANTHROPIC_API_KEY, CHROME_PATH, ...)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

// `npm run demo` runs the dashboard on sample chats without starting WhatsApp,
// and keeps its data apart from your real data.
export const DEMO_ONLY = process.argv.includes('--demo') || process.env.DEMO === '1';

export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data', DEMO_ONLY ? 'demo' : ''));
export const PORT = Number(process.env.PORT) || 3000;
export const HOST = process.env.HOST || '127.0.0.1';
export const CHROME_PATH = process.env.CHROME_PATH || '';

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — most thorough' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — balanced, cheaper' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest, cheapest' },
];

export const DEFAULT_SETTINGS = {
  businessContext:
    'I run Brulé, a specialty coffee brand that is launching soon. People message me on WhatsApp about our coffee, the waitlist, ' +
    'gift boxes, bulk or café orders and collaborations. A good call answers their questions and turns interest into an order.',
  ownerName: '',
  anthropicApiKey: '',
  model: MODELS[0].id,
  autoAnalyze: true,
  seenAfterDays: 3,
  staleAfterDays: 45,
  maxChats: 150,
  messagesPerChat: 40,
  lookbackDays: 120,
  includeGroups: false,
  includePersonal: false,
};

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
