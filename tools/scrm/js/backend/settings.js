// Settings. Non-secret defaults come from tools/scrm/config.json (edit that file once on the
// .mil copy — e.g. the GenAI endpoint and model). Per-user values and API keys are stored in
// this browser only: localStorage when "remember on this computer" is ticked, otherwise
// sessionStorage (cleared when the browser closes). Keys are never written to IndexedDB,
// never exported, and never committed to the repository.

export const DEFS = {
  mode:             { def: 'live', label: 'Data mode (live | demo)' },
  llm_endpoint:     { def: 'https://api.genai.mil/v1/chat/completions', label: 'GenAI chat-completions endpoint' },
  llm_model:        { def: 'gemini-2.5-flash', label: 'Model' },
  llm_api_key:      { secret: true, label: 'GenAI.mil / Gemini API key' },
  sam_api_key:      { secret: true, label: 'SAM.gov public API key' },
  csl_api_key:      { secret: true, label: 'Trade.gov CSL subscription key' },
  opensanctions_api_key: { secret: true, label: 'OpenSanctions API key' },
  lookback_years:   { def: '5', label: 'Federal award look-back (fiscal years)' },
  max_prime_awards: { def: '15', label: 'Prime awards to expand for sub-tier suppliers' },
  stale_days:       { def: '90', label: 'Days before an assessment is considered stale' },
  enable_media:     { def: 'true', label: 'Adverse media screening (GDELT)' },
  enable_kev:       { def: 'true', label: 'Product vulnerability screening (CISA KEV)' },
  remember_keys:    { def: 'true', label: 'Remember keys on this computer' },
};

const PREFIX = 'scrm.';
let siteConfig = {};
const memStore = new Map();
const ls = () => { try { return globalThis.localStorage; } catch { return null; } };
const ss = () => { try { return globalThis.sessionStorage; } catch { return null; } };
const read = (s, k) => { try { return s?.getItem(PREFIX + k) ?? null; } catch { return null; } };
const writeS = (s, k, v) => { try { v === '' || v == null ? s?.removeItem(PREFIX + k) : s?.setItem(PREFIX + k, v); return !!s; } catch { return false; } };

/** Load site-wide defaults (config.json next to index.html). Missing file is fine. */
export async function loadSiteConfig(url = 'config.json') {
  try { const r = await fetch(url, { cache: 'no-cache' }); if (r.ok) siteConfig = await r.json(); } catch { /* optional */ }
  return siteConfig;
}
export const site = () => siteConfig;

export function getSetting(key) {
  const v = memStore.get(key) ?? read(ss(), key) ?? read(ls(), key);
  if (v != null && v !== '') return v;
  const fromSite = siteConfig.defaults?.[key];
  return fromSite != null ? String(fromSite) : DEFS[key]?.def ?? '';
}

export function setSetting(key, value) {
  const d = DEFS[key]; if (!d) throw new Error(`Unknown setting ${key}`);
  const v = value == null ? '' : String(value);
  if (d.secret) {
    const remember = getSetting('remember_keys') !== 'false';
    writeS(remember ? ss() : ls(), key, ''); // keep only one copy
    if (!writeS(remember ? ls() : ss(), key, v)) memStore.set(key, v);
  } else if (!writeS(ls(), key, v)) memStore.set(key, v);
}

/** When "remember" is toggled, move existing keys between storages. */
export function setRemember(on) {
  const keys = Object.keys(DEFS).filter((k) => DEFS[k].secret).map((k) => [k, getSetting(k)]);
  writeS(ls(), 'remember_keys', on ? 'true' : 'false');
  for (const [k, v] of keys) { writeS(ls(), k, ''); writeS(ss(), k, ''); if (v) setSetting(k, v); }
}

export function forgetKeys() {
  for (const k of Object.keys(DEFS).filter((x) => DEFS[x].secret)) { writeS(ls(), k, ''); writeS(ss(), k, ''); memStore.delete(k); }
}

export function publicSettings() {
  const out = {};
  for (const [k, d] of Object.entries(DEFS)) {
    const v = getSetting(k);
    out[k] = { label: d.label, secret: !!d.secret, value: d.secret ? '' : v, configured: !!v, fromEnv: false,
      hint: d.secret && v ? `••••${v.slice(-4)}` : '' };
  }
  return out;
}
