// Entity-name normalization and fuzzy matching used for restricted-party screening.
// Screening is deliberately conservative: a "potential" match is surfaced for an
// analyst to adjudicate; only strong matches drive automatic hard-stop scoring.

const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'llc', 'l', 'lc', 'ltd', 'limited',
  'plc', 'llp', 'lp', 'pllc', 'pc', 'gmbh', 'ag', 'sa', 'sas', 'sarl', 'srl', 'spa', 'bv', 'nv', 'oy',
  'ab', 'as', 'asa', 'kk', 'pte', 'pty', 'jsc', 'pjsc', 'ojsc', 'zao', 'ooo', 'oao', 'group', 'holdings',
  'holding', 'the', 'and', 'of', 'intl', 'international', 'technologies', 'technology', 'tech',
]);
const WEAK_TOKENS = new Set(['china', 'beijing', 'shanghai', 'shenzhen', 'hangzhou', 'usa', 'us', 'america', 'americas',
  'global', 'systems', 'system', 'services', 'solutions', 'industries', 'industry', 'industrial', 'enterprises', 'science',
  'mobile', 'telecom', 'telecommunications', 'communications', 'communication', 'electronics', 'electronic', 'aerospace',
  'aviation', 'shipbuilding', 'nuclear', 'power', 'energy', 'construction', 'network', 'networks', 'digital', 'software',
  'data', 'defense', 'security', 'general', 'national', 'state', 'federal', 'american', 'united', 'north', 'south', 'east',
  'west', 'new', 'first', 'advanced', 'applied', 'integrated', 'research', 'engineering', 'manufacturing', 'products',
  'components', 'logistics', 'pacific', 'atlantic', 'gulf', 'mountain', 'valley', 'coastal', 'central', 'midwest',
  'semiconductor', 'semiconductors', 'microelectronics', 'precision', 'machinery', 'equipment', 'devices', 'instruments',
  'materials', 'chemical', 'chemicals', 'metals', 'robotics', 'wireless', 'imaging', 'optical', 'photonics', 'medical',
  'western', 'eastern', 'northern', 'southern', 'great', 'golden', 'star', 'eagle', 'liberty', 'patriot', 'supply', 'trading', 'import', 'export', 'investment', 'capital', 'partners', 'associates']);

export function normalizeName(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter((t) => t && !LEGAL_SUFFIXES.has(t))
    .join(' ').trim();
}

export function tokens(s) { return normalizeName(s).split(' ').filter(Boolean); }

function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false), bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++; }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let p = 0; while (p < 4 && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

/** Similarity in [0,1] combining token-set overlap and character-level Jaro-Winkler. */
export function similarity(x, y) {
  const a = normalizeName(x), b = normalizeName(y);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  let strongA = [...ta].filter((t) => !WEAK_TOKENS.has(t)), strongB = [...tb].filter((t) => !WEAK_TOKENS.has(t));
  if (!strongA.length || !strongB.length) { strongA = [...ta]; strongB = [...tb]; }
  const inter = strongA.filter((t) => tb.has(t)).length;
  const denom = Math.max(1, Math.min(strongA.length, strongB.length));
  const containment = inter / denom; // all distinctive tokens of the shorter name appear in the longer
  const jw = jaroWinkler([...ta].sort().join(' '), [...tb].sort().join(' '));
  // Single shared distinctive token is weak evidence unless the names are near-identical.
  let tokenScore = inter === 0 ? 0 : (denom === 1 && Math.max(strongA.length, strongB.length) >= 2 ? containment * 0.85 : containment);
  // Distinctive single tokens shorter than 4 chars (e.g. "ZTE") need the rest of the name to look alike too.
  if (denom === 1 && inter === 1 && strongA.concat(strongB).every((t) => t.length < 4) && jw < 0.8) tokenScore *= 0.9;
  return Math.max(jw * 0.95, tokenScore * 0.97, (jw + tokenScore) / 2);
}

export const MATCH_STRONG = 0.93;
export const MATCH_POTENTIAL = 0.86;

export function classifyMatch(score) {
  if (score >= MATCH_STRONG) return 'strong';
  if (score >= MATCH_POTENTIAL) return 'potential';
  return null;
}

/** Best match of `name` against an entry with a primary name and aliases. */
export function bestMatch(name, entry) {
  let best = { score: 0, matched: null };
  for (const candidate of [entry.name, ...(entry.aliases || entry.alt_names || [])]) {
    if (!candidate) continue;
    const s = similarity(name, candidate);
    if (s > best.score) best = { score: s, matched: candidate };
  }
  return best;
}
