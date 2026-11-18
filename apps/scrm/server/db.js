// SQLite persistence using Node's built-in driver (no native dependency).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, SETTING_DEFS } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.SCRM_DB || path.join(DATA_DIR, 'scrm.db');
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  uei TEXT, cage TEXT, cik TEXT, lei TEXT, website TEXT,
  country TEXT, state TEXT, vertical TEXT, naics TEXT,
  criticality TEXT NOT NULL DEFAULT 'moderate',      -- low | moderate | high | mission-critical
  status TEXT NOT NULL DEFAULT 'under-review',        -- under-review | approved | conditional | rejected
  annual_spend REAL DEFAULT 0,
  contract_ref TEXT, owner TEXT, notes TEXT, tags TEXT,
  latest_assessment_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS vendors_name ON vendors(name);
CREATE TABLE IF NOT EXISTS portfolios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS portfolio_vendors (
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (portfolio_id, vendor_id)
);
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  mode TEXT NOT NULL, score REAL, tier TEXT,
  profile_json TEXT, findings_json TEXT, scores_json TEXT,
  sources_json TEXT, ai_json TEXT, duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS assessments_vendor ON assessments(vendor_id, created_at);
CREATE TABLE IF NOT EXISTS finding_actions (
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  finding_key TEXT NOT NULL,
  disposition TEXT NOT NULL,          -- open | mitigating | mitigated | accepted | false-positive
  note TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (vendor_id, finding_key)
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, status TEXT NOT NULL, total INTEGER, done INTEGER DEFAULT 0,
  items_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT
);
CREATE TABLE IF NOT EXISTS screening_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT, name TEXT NOT NULL, alt_names TEXT, country TEXT, programs TEXT,
  entity_type TEXT, url TEXT, start_date TEXT, norm TEXT
);
CREATE INDEX IF NOT EXISTS screening_norm ON screening_entries(norm);
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires INTEGER);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT NOT NULL, detail TEXT
);
`);

export const json = (v) => (v == null ? null : JSON.stringify(v));
export const parse = (s, d = null) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };

// ---------- settings ----------
export function getSetting(key) {
  const def = SETTING_DEFS[key];
  if (def?.env && process.env[def.env]) return process.env[def.env];
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row && row.value !== '') return row.value;
  return def?.def ?? '';
}
export function setSetting(key, value) {
  if (!SETTING_DEFS[key]) throw new Error(`Unknown setting ${key}`);
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value ?? ''));
}
export function publicSettings() {
  const out = {};
  for (const [k, d] of Object.entries(SETTING_DEFS)) {
    const v = getSetting(k);
    out[k] = { label: d.label, secret: !!d.secret, fromEnv: !!(d.env && process.env[d.env]),
      value: d.secret ? '' : v, configured: !!v };
  }
  return out;
}

// ---------- cache ----------
export function cacheGet(key) {
  const r = db.prepare('SELECT value, expires FROM cache WHERE key = ?').get(key);
  if (!r) return undefined;
  if (r.expires < Date.now()) { db.prepare('DELETE FROM cache WHERE key = ?').run(key); return undefined; }
  return parse(r.value);
}
export function cacheSet(key, value, ttlMs) {
  db.prepare('INSERT OR REPLACE INTO cache(key,value,expires) VALUES(?,?,?)').run(key, JSON.stringify(value), Date.now() + ttlMs);
}

export function audit(action, detail) {
  db.prepare('INSERT INTO audit_log(action, detail) VALUES(?,?)').run(action, typeof detail === 'string' ? detail : JSON.stringify(detail ?? null));
}

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
