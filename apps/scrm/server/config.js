// Central configuration. Values come from environment variables first, then from
// the settings table (editable in the UI), so operators can run fully from env
// in hardened deployments or configure interactively on a workstation.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DATA_DIR = process.env.SCRM_DATA_DIR || path.join(ROOT, 'data');

// Minimal .env loader (no dependency): KEY=VALUE lines, # comments.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const PORT = Number(process.env.PORT || 8787);
export const HOST = process.env.HOST || '127.0.0.1';

// Setting keys the UI may edit. `secret` values are never returned to the browser.
export const SETTING_DEFS = {
  mode:                 { env: 'SCRM_MODE', def: 'live', label: 'Data mode (live | demo)' },
  sam_api_key:          { env: 'SAM_API_KEY', secret: true, label: 'SAM.gov public API key' },
  csl_api_key:          { env: 'CSL_API_KEY', secret: true, label: 'Trade.gov Consolidated Screening List subscription key' },
  opensanctions_api_key:{ env: 'OPENSANCTIONS_API_KEY', secret: true, label: 'OpenSanctions API key' },
  anthropic_api_key:    { env: 'ANTHROPIC_API_KEY', secret: true, label: 'Anthropic API key (AI analyst)' },
  ai_model:             { env: 'SCRM_AI_MODEL', def: 'claude-opus-5-5', label: 'Claude model' },
  sec_user_agent:       { env: 'SEC_USER_AGENT', def: 'SCRM-Sentinel/1.0 (set-contact@your-agency.gov)', label: 'SEC EDGAR User-Agent (must include a contact email)' },
  lookback_years:       { env: 'SCRM_LOOKBACK_YEARS', def: '5', label: 'Federal award look-back (fiscal years)' },
  max_prime_awards:     { env: 'SCRM_MAX_PRIME_AWARDS', def: '15', label: 'Prime awards to expand for sub-tier suppliers' },
  stale_days:           { env: 'SCRM_STALE_DAYS', def: '90', label: 'Days before an assessment is considered stale' },
  enable_media:         { env: 'SCRM_ENABLE_MEDIA', def: 'true', label: 'Adverse media screening (GDELT)' },
  enable_kev:           { env: 'SCRM_ENABLE_KEV', def: 'true', label: 'Product vulnerability screening (CISA KEV)' },
};

export const APP_USER = process.env.SCRM_USER || '';
export const APP_PASSWORD = process.env.SCRM_PASSWORD || '';
