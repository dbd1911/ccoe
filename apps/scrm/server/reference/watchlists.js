// Built-in reference lists that encode statutory/regulatory procurement prohibitions.
// These ship with the app so screening works offline; they are a curated subset and
// MUST be refreshed against the authoritative sources (URLs below) on a regular cadence.
// The full restricted-party universe (OFAC SDN, BIS Entity List, etc.) is loaded from
// the Consolidated Screening List — see connectors/screening.js.

export const WATCHLIST_AS_OF = '2026-11-01';

export const LISTS = {
  S889: {
    name: 'NDAA FY2019 §889 Covered Telecom/Video Surveillance',
    authority: 'Pub. L. 115-232 §889; FAR 52.204-24/-25/-26',
    effect: 'Prohibited: agencies may not procure covered equipment or contract with entities that USE it (Part B).',
    url: 'https://www.acquisition.gov/far/52.204-25',
    severity: 'critical',
  },
  FCC: {
    name: 'FCC Covered List',
    authority: 'Secure and Trusted Communications Networks Act; 47 CFR §1.50002',
    effect: 'Equipment/services deemed an unacceptable national-security risk.',
    url: 'https://www.fcc.gov/supplychain/coveredlist',
    severity: 'critical',
  },
  KAS: {
    name: 'Kaspersky Lab Prohibition',
    authority: 'NDAA FY2018 §1634; FAR 52.204-23; 15 CFR Part 791 Final Determination (2024)',
    effect: 'Prohibited: hardware, software or services developed or provided by Kaspersky Lab.',
    url: 'https://www.acquisition.gov/far/52.204-23',
    severity: 'critical',
  },
  BYTE: {
    name: 'ByteDance Covered Application',
    authority: 'No TikTok on Government Devices Act; FAR 52.204-27',
    effect: 'Prohibited on IT used or provided by contractors under a federal contract.',
    url: 'https://www.acquisition.gov/far/52.204-27',
    severity: 'high',
  },
  UAS: {
    name: 'American Security Drone Act — Covered Foreign Entities',
    authority: 'NDAA FY2024 §§1821-1832; NDAA FY2020 §848',
    effect: 'Prohibited: procurement/operation of UAS from covered foreign entities.',
    url: 'https://www.congress.gov/bill/118th-congress/senate-bill/473',
    severity: 'critical',
  },
  S5949: {
    name: 'NDAA FY2023 §5949 Semiconductor Prohibition',
    authority: 'Pub. L. 117-263 §5949 (effective Dec 2027)',
    effect: 'Prohibits procurement of products/services containing covered semiconductors.',
    url: 'https://www.congress.gov/117/plaws/publ263/PLAW-117publ263.pdf',
    severity: 'high',
  },
  CMC1260H: {
    name: 'DoD §1260H Chinese Military Companies',
    authority: 'NDAA FY2021 §1260H; NDAA FY2024 §805 (DoD contracting prohibition from June 2026)',
    effect: 'DoD may not contract directly (and, from 2027, indirectly) with listed entities.',
    url: 'https://www.defense.gov/News/Releases/',
    severity: 'critical',
  },
  NSCMIC: {
    name: 'Treasury NS-CMIC List',
    authority: 'E.O. 13959 as amended by E.O. 14032',
    effect: 'Investment prohibitions; strong FOCI/national-security signal.',
    url: 'https://ofac.treasury.gov/consolidated-sanctions-list-non-sdn-lists/ns-chinese-military-companies-identification-list',
    severity: 'high',
  },
  UFLPA: {
    name: 'UFLPA Entity List',
    authority: 'Uyghur Forced Labor Prevention Act, Pub. L. 117-78',
    effect: 'Goods presumed made with forced labor; import detention; FAR 52.222-50 exposure.',
    url: 'https://www.dhs.gov/uflpa-entity-list',
    severity: 'high',
  },
};

const E = (name, aliases, lists, country = 'CN') => ({ name, aliases, lists, country });

export const WATCH_ENTITIES = [
  E('Huawei Technologies Co., Ltd.', ['Huawei', 'Huawei Technologies USA', 'HiSilicon', 'Futurewei Technologies'], ['S889', 'FCC', 'CMC1260H', 'NSCMIC']),
  E('ZTE Corporation', ['ZTE', 'ZTE USA', 'Zhongxing Telecommunication Equipment'], ['S889', 'FCC']),
  E('Hytera Communications Corporation Limited', ['Hytera', 'Hytera America', 'Hytera Communications'], ['S889', 'FCC']),
  E('Hangzhou Hikvision Digital Technology Co., Ltd.', ['Hikvision', 'Hikvision USA', 'EZVIZ'], ['S889', 'FCC', 'CMC1260H', 'NSCMIC']),
  E('Zhejiang Dahua Technology Co., Ltd.', ['Dahua', 'Dahua Technology', 'Dahua Technology USA', 'Lorex Technology'], ['S889', 'FCC', 'CMC1260H']),
  E('AO Kaspersky Lab', ['Kaspersky', 'Kaspersky Lab', 'Kaspersky Labs'], ['KAS', 'FCC'], 'RU'),
  E('China Mobile International USA Inc.', ['China Mobile International', 'China Mobile Communications Group', 'China Mobile Limited'], ['FCC', 'CMC1260H', 'NSCMIC']),
  E('China Telecom (Americas) Corporation', ['China Telecom Americas', 'China Telecom Corporation', 'China Telecommunications Corporation'], ['FCC', 'CMC1260H', 'NSCMIC']),
  E('China Unicom (Americas) Operations Limited', ['China Unicom Americas', 'China United Network Communications Group', 'China Unicom'], ['FCC', 'CMC1260H', 'NSCMIC']),
  E('Pacific Networks Corp.', ['Pacific Networks', 'ComNet (USA) LLC', 'ComNet USA'], ['FCC']),
  E('ByteDance Ltd.', ['ByteDance', 'TikTok', 'Beijing ByteDance Technology'], ['BYTE']),
  E('SZ DJI Technology Co., Ltd.', ['DJI', 'Da-Jiang Innovations', 'DJI Technology'], ['UAS', 'CMC1260H', 'NSCMIC']),
  E('Autel Robotics Co., Ltd.', ['Autel Robotics', 'Autel'], ['UAS', 'CMC1260H']),
  E('Semiconductor Manufacturing International Corporation', ['SMIC'], ['S5949', 'CMC1260H', 'NSCMIC']),
  E('Yangtze Memory Technologies Co., Ltd.', ['YMTC', 'Yangtze Memory'], ['S5949', 'CMC1260H']),
  E('ChangXin Memory Technologies, Inc.', ['CXMT', 'ChangXin Memory'], ['S5949', 'CMC1260H']),
  E('Aviation Industry Corporation of China', ['AVIC', 'AVIC International'], ['CMC1260H', 'NSCMIC']),
  E('China Aerospace Science and Technology Corporation', ['CASC'], ['CMC1260H', 'NSCMIC']),
  E('China Aerospace Science and Industry Corporation', ['CASIC'], ['CMC1260H', 'NSCMIC']),
  E('China Electronics Technology Group Corporation', ['CETC'], ['CMC1260H', 'NSCMIC']),
  E('China Electronics Corporation', ['CEC', 'China Electronics Corp'], ['CMC1260H', 'NSCMIC']),
  E('China North Industries Group Corporation', ['NORINCO', 'China North Industries'], ['CMC1260H', 'NSCMIC']),
  E('China State Shipbuilding Corporation', ['CSSC'], ['CMC1260H', 'NSCMIC']),
  E('China General Nuclear Power Corporation', ['CGN', 'China General Nuclear'], ['CMC1260H', 'NSCMIC']),
  E('CRRC Corporation Limited', ['CRRC', 'China Railway Rolling Stock'], ['CMC1260H', 'NSCMIC']),
  E('COSCO Shipping Holdings Co., Ltd.', ['COSCO', 'China COSCO Shipping'], ['CMC1260H']),
  E('Inspur Group Co., Ltd.', ['Inspur', 'Inspur Electronic Information Industry'], ['CMC1260H']),
  E('Contemporary Amperex Technology Co., Limited', ['CATL', 'Contemporary Amperex'], ['CMC1260H']),
  E('Tencent Holdings Limited', ['Tencent'], ['CMC1260H']),
  E('Quectel Wireless Solutions Co., Ltd.', ['Quectel'], ['CMC1260H']),
  E('China National Offshore Oil Corporation', ['CNOOC'], ['CMC1260H', 'NSCMIC']),
  E('China State Construction Engineering Corporation', ['CSCEC', 'China State Construction'], ['CMC1260H', 'NSCMIC']),
  E('China Railway Construction Corporation Limited', ['CRCC', 'China Railway Construction'], ['CMC1260H', 'NSCMIC']),
  E('Megvii Technology Limited', ['Megvii', 'Face++'], ['CMC1260H']),
  E('SenseTime Group Limited', ['SenseTime'], ['NSCMIC']),
  E('Xinjiang Production and Construction Corps', ['XPCC', 'Bingtuan'], ['UFLPA']),
  E('Hoshine Silicon Industry Co., Ltd.', ['Hoshine Silicon'], ['UFLPA']),
  E('Xinjiang Daqo New Energy Co., Ltd.', ['Daqo New Energy', 'Xinjiang Daqo'], ['UFLPA']),
  E('Xinjiang GCL New Energy Material Technology Co., Ltd.', ['Xinjiang GCL'], ['UFLPA']),
  E('Xinjiang East Hope Nonferrous Metals Co., Ltd.', ['Xinjiang East Hope'], ['UFLPA']),
  E('Xinjiang Zhongtai Chemical Co., Ltd.', ['Xinjiang Zhongtai Chemical'], ['UFLPA']),
  E('Hefei Bitland Information Technology Co., Ltd.', ['Hefei Bitland', 'Bitland Information Technology'], ['UFLPA']),
  E('Aksu Huafu Textiles Co., Ltd.', ['Aksu Huafu Textiles'], ['UFLPA']),
  E('Changji Esquel Textile Co., Ltd.', ['Changji Esquel Textile'], ['UFLPA']),
];

// Foreign adversaries per 15 CFR §791.4, plus jurisdictions BIS has flagged for
// transshipment/diversion risk. ISO 3166-1 alpha-2 (USAspending uses alpha-3; see toIso2).
export const COUNTRY_RISK = {
  CN: { level: 'adversary', name: 'China' }, HK: { level: 'adversary', name: 'Hong Kong' },
  MO: { level: 'adversary', name: 'Macau' }, CU: { level: 'adversary', name: 'Cuba' },
  IR: { level: 'adversary', name: 'Iran' }, KP: { level: 'adversary', name: 'North Korea' },
  RU: { level: 'adversary', name: 'Russia' }, VE: { level: 'adversary', name: 'Venezuela (Maduro regime)' },
  BY: { level: 'elevated', name: 'Belarus' }, SY: { level: 'elevated', name: 'Syria' }, MM: { level: 'elevated', name: 'Burma' },
  AE: { level: 'diversion', name: 'United Arab Emirates' }, TR: { level: 'diversion', name: 'Türkiye' },
  KZ: { level: 'diversion', name: 'Kazakhstan' }, KG: { level: 'diversion', name: 'Kyrgyzstan' },
  AM: { level: 'diversion', name: 'Armenia' }, GE: { level: 'diversion', name: 'Georgia' }, UZ: { level: 'diversion', name: 'Uzbekistan' },
};

const A3 = { USA: 'US', CHN: 'CN', HKG: 'HK', MAC: 'MO', CUB: 'CU', IRN: 'IR', PRK: 'KP', RUS: 'RU', VEN: 'VE', BLR: 'BY',
  SYR: 'SY', MMR: 'MM', ARE: 'AE', TUR: 'TR', KAZ: 'KZ', KGZ: 'KG', ARM: 'AM', GEO: 'GE', UZB: 'UZ', CAN: 'CA', GBR: 'GB',
  DEU: 'DE', FRA: 'FR', JPN: 'JP', KOR: 'KR', TWN: 'TW', ISR: 'IL', IND: 'IN', MEX: 'MX', AUS: 'AU', ITA: 'IT', NLD: 'NL',
  SWE: 'SE', CHE: 'CH', SGP: 'SG', IRL: 'IE', ESP: 'ES', NOR: 'NO', DNK: 'DK', FIN: 'FI', BEL: 'BE', POL: 'PL', VNM: 'VN',
  MYS: 'MY', THA: 'TH', PHL: 'PH', IDN: 'ID', BRA: 'BR', UKR: 'UA' };
export function toIso2(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  if (c.length === 2) return c;
  return A3[c] || c;
}
export function countryRisk(code) { return COUNTRY_RISK[toIso2(code)] || null; }

// NAICS 2-digit sectors -> human vertical; plus prefixes the DoD/DHS treat as critical.
export const NAICS_SECTORS = {
  11: 'Agriculture', 21: 'Mining & Extraction', 22: 'Utilities', 23: 'Construction', 31: 'Manufacturing', 32: 'Manufacturing',
  33: 'Manufacturing', 42: 'Wholesale Trade', 44: 'Retail', 45: 'Retail', 48: 'Transportation & Logistics', 49: 'Transportation & Logistics',
  51: 'Information & Telecommunications', 52: 'Finance & Insurance', 53: 'Real Estate & Leasing', 54: 'Professional, Scientific & Technical Services',
  55: 'Management of Companies', 56: 'Administrative & Support Services', 61: 'Education', 62: 'Health Care', 71: 'Arts & Recreation',
  72: 'Accommodation & Food', 81: 'Other Services', 92: 'Public Administration',
};
export const CRITICAL_NAICS_PREFIXES = {
  '3344': 'Semiconductors & electronic components', '3342': 'Communications equipment', '3341': 'Computer hardware',
  '3345': 'Navigation, guidance & measuring instruments', '3364': 'Aerospace products & parts', '3329': 'Ordnance & ammunition',
  '3366': 'Ship & boat building', '5415': 'Computer systems design & IT services', '5182': 'Data processing & hosting',
  '5112': 'Software publishers', '5132': 'Software publishers', '5173': 'Telecommunications', '3359': 'Batteries & electrical equipment',
  '3254': 'Pharmaceuticals', '5417': 'R&D (physical, engineering, life sciences)',
};
export function verticalFromNaics(code) {
  if (!code) return null;
  const c = String(code);
  for (const [p, label] of Object.entries(CRITICAL_NAICS_PREFIXES)) if (c.startsWith(p)) return label;
  return NAICS_SECTORS[Number(c.slice(0, 2))] || null;
}
export function isCriticalNaics(code) {
  return !!code && Object.keys(CRITICAL_NAICS_PREFIXES).some((p) => String(code).startsWith(p));
}
// SEC SIC -> vertical fallback for companies without federal awards.
export function verticalFromSic(sic, desc) {
  const s = Number(sic);
  if (!s) return desc || null;
  if (s >= 3570 && s <= 3579) return 'Computer hardware';
  if (s >= 3660 && s <= 3679) return 'Communications equipment & electronic components';
  if (s >= 3720 && s <= 3729) return 'Aerospace products & parts';
  if (s >= 7370 && s <= 7379) return 'Computer systems design & IT services';
  if (s >= 4800 && s <= 4899) return 'Information & Telecommunications';
  return desc || null;
}
