// DEMO DATASET — entirely fictional companies, identifiers and articles, used for
// training, offline evaluation and testing. Real listed entities appear ONLY as
// sub-tier suppliers to show how screening catches them. No record here describes a
// real company's actual business relationships.

const AG = {
  dod: 'Department of Defense', dhs: 'Department of Homeland Security', hhs: 'Department of Health and Human Services',
  va: 'Department of Veterans Affairs', gsa: 'General Services Administration', doe: 'Department of Energy',
  nasa: 'National Aeronautics and Space Administration', nsf: 'National Science Foundation', doj: 'Department of Justice',
  treas: 'Department of the Treasury',
};

function trend(total, shape) {
  const fy = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const w = shape.reduce((a, b) => a + b, 0);
  return shape.map((s, i) => ({ fy: fy - shape.length + 1 + i, amount: Math.round((total * s) / w) }));
}
const agencies = (total, parts) => parts.map(([k, share, sub]) => ({ name: AG[k], code: k.toUpperCase(), amount: Math.round(total * share), sub }));
const sup = (name, amount, count, country, desc) => ({ name, amount, count, country, primeAwards: [], lastDate: '2026-06-30', descriptions: desc ? [desc] : [], source: 'usaspending-subawards (demo)' });
const award = (id, amount, agency, subAgency, desc, naics, psc, start) => ({ id, amount, agency, subAgency, description: desc, naics, psc, start, url: null });
const art = (title, domain, date, categories) => ({ title, url: `https://example.com/demo-news/${encodeURIComponent(title.toLowerCase().slice(0, 40))}`, date, domain, country: 'United States', categories });

export const DEMO_VENDORS = [
  {
    entity: { name: 'Northwind Avionics Inc.', uei: 'NWA7KLM2Q9X4', cage: '7N4W1', lei: '5493004NWAVX0DEMO001', website: 'https://northwind-avionics.example',
      country: 'US', state: 'KS', city: 'Wichita', incorporationState: 'KS', structure: 'Corporate Entity, Not Tax Exempt', startDate: '1994-05-11',
      businessTypes: ['For Profit Organization', 'Manufacturer of Goods'], naicsPrimary: '336413', registration: { status: 'Active', expirationDate: '2027-04-02' } },
    ownership: { immediateParent: null, ultimateParent: null, gleif: { directParent: null, ultimateParent: null, children: [{ name: 'Northwind Avionics Services LLC', country: 'US' }], ultimateException: 'NO_KNOWN_PERSON' } },
    federal: { total: 412_600_000, shape: [62, 71, 80, 95, 104], agencies: [['dod', 0.91, 'Department of the Air Force'], ['nasa', 0.06], ['dhs', 0.03, 'U.S. Coast Guard']],
      naics: [{ code: '336413', name: 'Other Aircraft Parts and Auxiliary Equipment Manufacturing', share: 0.82 }, { code: '334511', name: 'Search, Detection, Navigation, Guidance, Aeronautical Systems', share: 0.18 }],
      psc: [{ code: '1680', name: 'Miscellaneous Aircraft Accessories and Components', share: 0.7 }, { code: '5841', name: 'Radar Equipment, Airborne', share: 0.3 }],
      awards: [award('FA8625-22-C-0417', 128_400_000, AG.dod, 'Department of the Air Force', 'C-130 avionics modernization kits', '336413', '1680', '2022-03-14'),
        award('N00019-23-D-0098', 61_200_000, AG.dod, 'Department of the Navy', 'Mission computer spares and repair', '336413', '1680', '2023-06-01'),
        award('80NSSC24C0112', 18_900_000, AG.nasa, 'NASA', 'Flight test instrumentation', '334511', '5841', '2024-01-22')] },
    suppliers: [sup('Prairie Precision Machining LLC', 14_200_000, 22, 'US', 'Machined housings'), sup('Ostrander Composites Inc.', 9_800_000, 11, 'US', 'Composite radomes'),
      sup('Heliotrope Sensors GmbH', 6_100_000, 7, 'DE', 'Inertial sensors'), sup('Calder Wire & Cable Co.', 3_400_000, 15, 'US', 'Wire harnesses')],
    primes: [{ name: 'Atlas Aerostructures Corp.', amount: 21_000_000, count: 6, agency: AG.dod }],
    exclusions: [], proceedings: [], sec: null, media: [], kev: null,
  },
  {
    entity: { name: 'Helix Data Systems LLC', uei: 'HLXD9T3PQ2M8', cage: '8H2D4', website: 'https://helixdata.example', country: 'US', state: 'VA', city: 'Reston',
      incorporationState: 'DE', structure: 'Limited Liability Company', startDate: '2011-09-01', businessTypes: ['For Profit Organization', 'Small Business', 'Woman Owned Business'],
      naicsPrimary: '541512', registration: { status: 'Active', expirationDate: '2027-01-18' } },
    ownership: { immediateParent: null, ultimateParent: null, gleif: null },
    federal: { total: 96_300_000, shape: [14, 17, 19, 22, 24], agencies: [['dhs', 0.48, 'Cybersecurity and Infrastructure Security Agency'], ['va', 0.31], ['hhs', 0.21, 'Centers for Medicare and Medicaid Services']],
      naics: [{ code: '541512', name: 'Computer Systems Design Services', share: 0.77 }, { code: '518210', name: 'Computing Infrastructure Providers, Data Processing, Web Hosting', share: 0.23 }],
      psc: [{ code: 'DA01', name: 'IT and Telecom - Business Application/Application Development Support', share: 0.6 }, { code: 'DH01', name: 'IT and Telecom - Platform Support', share: 0.4 }],
      awards: [award('70QS0124F00000211', 31_700_000, AG.dhs, 'Cybersecurity and Infrastructure Security Agency', 'Continuous diagnostics dashboard O&M', '541512', 'DA01', '2024-02-01'),
        award('36C10B23F0412', 22_400_000, AG.va, 'Department of Veterans Affairs', 'Cloud migration services', '518210', 'DH01', '2023-08-15')] },
    suppliers: [sup('Brightline Cloud Partners Inc.', 7_900_000, 9, 'US', 'Cloud engineering staff'), sup('Quantum Ridge Consulting LLC', 4_300_000, 6, 'US', 'Agile coaching'),
      sup('Shenzhen Lianxin Electronics Co., Ltd.', 640_000, 3, 'CN', 'Network appliances (hardware)'), sup('Pacific Network Solutions Inc.', 1_200_000, 4, 'US', 'Cabling and LAN')],
    primes: [{ name: 'Granite Federal Systems Inc.', amount: 12_500_000, count: 4, agency: AG.dhs }],
    exclusions: [], proceedings: [], sec: null,
    media: [art('Helix Data Systems discloses data breach affecting contractor portal', 'fedtechwire.example', '2026-03-02', ['cyber'])], kev: null,
  },
  {
    entity: { name: 'Crestline Microelectronics Corp.', uei: 'CRSM4V8XK1J6', cage: '9C3M2', lei: '5493006CRESTDEMO0002', website: 'https://crestline-micro.example', country: 'US', state: 'CA', city: 'San Jose',
      incorporationState: 'DE', structure: 'Corporate Entity, Not Tax Exempt', startDate: '2016-02-08', businessTypes: ['For Profit Organization', 'Foreign Owned'],
      naicsPrimary: '334413', registration: { status: 'Active', expirationDate: '2026-12-30' } },
    ownership: { immediateParent: { name: 'Crestline Holdings (HK) Limited', country: 'HK' }, ultimateParent: { name: 'Shenzhen Crestline Semiconductor Group Co., Ltd.', country: 'CN' },
      gleif: { directParent: { name: 'Crestline Holdings (HK) Limited', country: 'HK', lei: '5493006CRESTDEMO0099' }, ultimateParent: { name: 'Shenzhen Crestline Semiconductor Group Co., Ltd.', country: 'CN' }, children: [] } },
    federal: { total: 58_200_000, shape: [6, 9, 12, 14, 17], agencies: [['dod', 0.72, 'Defense Logistics Agency'], ['doe', 0.28, 'National Nuclear Security Administration']],
      naics: [{ code: '334413', name: 'Semiconductor and Related Device Manufacturing', share: 1 }], psc: [{ code: '5962', name: 'Microcircuits, Electronic', share: 1 }],
      awards: [award('SPE7M1-23-D-0144', 24_100_000, AG.dod, 'Defense Logistics Agency', 'Radiation-tolerant microcircuits', '334413', '5962', '2023-04-10'),
        award('89233123CNA000221', 9_800_000, AG.doe, 'National Nuclear Security Administration', 'FPGA modules for test systems', '334413', '5962', '2023-11-03')] },
    suppliers: [sup('Hangzhou Hikvision Digital Technology Co., Ltd.', 2_300_000, 5, 'CN', 'Imaging sensor modules'), sup('Semiconductor Manufacturing International Corp.', 6_700_000, 8, 'CN', 'Wafer foundry services'),
      sup('Golden Gate Test Labs LLC', 1_900_000, 12, 'US', 'Reliability testing')],
    primes: [{ name: 'Sentinel Defense Electronics Inc.', amount: 8_400_000, count: 3, agency: AG.dod }],
    exclusions: [], proceedings: [], sec: null,
    media: [art('Lawmakers question chip firm Crestline over Chinese parent and export control compliance', 'defensenews.example', '2026-07-19', ['sanctions', 'foreign']),
      art('Crestline Microelectronics named in Commerce investigation into export control violations', 'tradecompliance.example', '2026-05-02', ['sanctions', 'legal'])], kev: null,
  },
  {
    entity: { name: 'Bluewater Maritime Logistics LLC', uei: 'BLWM2R7HN5C3', cage: '6B7W9', website: 'https://bluewater-ml.example', country: 'US', state: 'VA', city: 'Norfolk',
      incorporationState: 'VA', structure: 'Limited Liability Company', startDate: '2008-06-20', businessTypes: ['For Profit Organization', 'Service-Disabled Veteran-Owned Small Business'],
      naicsPrimary: '488510', registration: { status: 'Expired', expirationDate: '2026-08-14' } },
    ownership: { immediateParent: null, ultimateParent: null, gleif: null },
    federal: { total: 31_400_000, shape: [11, 10, 7, 3, 2], agencies: [['dod', 0.88, 'Department of the Navy'], ['dhs', 0.12, 'U.S. Customs and Border Protection']],
      naics: [{ code: '488510', name: 'Freight Transportation Arrangement', share: 1 }], psc: [{ code: 'V112', name: 'Transportation/Travel/Relocation - Motor Freight', share: 1 }],
      awards: [award('N3220522C4031', 12_200_000, AG.dod, 'Department of the Navy', 'Military Sealift Command freight forwarding', '488510', 'V112', '2022-01-12')] },
    suppliers: [sup('Gulf Star Freight Forwarding FZE', 2_900_000, 14, 'AE', 'Transshipment services'), sup('Tidewater Drayage Inc.', 1_100_000, 20, 'US', 'Drayage')],
    primes: [], exclusions: [], proceedings: [{ proceedingDate: '2025-10-01', proceedingType: 'Civil', proceedingDescription: 'False Claims Act settlement related to fuel surcharge billing' }],
    sec: null,
    media: [art('Norfolk logistics firm Bluewater agrees to settle False Claims Act allegations', 'justice-news.example', '2025-10-02', ['fraud', 'legal']),
      art('Bluewater Maritime faces penalty over overbilling of Navy shipments', 'navaltimes.example', '2025-09-12', ['legal']),
      art('Former Bluewater executive indicted in kickback scheme', 'courtwatch.example', '2026-02-27', ['fraud', 'legal'])], kev: null,
  },
  {
    entity: { name: 'Summit Ridge Analytics Inc.', uei: 'SMRA3K9WL7P1', cage: '0S8R3', website: 'https://summitridge.example', country: 'US', state: 'CO', city: 'Boulder',
      incorporationState: 'CO', structure: 'Corporate Entity, Not Tax Exempt', startDate: '2025-03-17', businessTypes: ['For Profit Organization', 'Small Business'],
      naicsPrimary: '541715', registration: { status: 'Active', expirationDate: '2027-03-17' } },
    ownership: { immediateParent: null, ultimateParent: null, gleif: null },
    federal: { total: 4_200_000, shape: [0, 0, 0, 1, 3], agencies: [['nsf', 0.6], ['nasa', 0.4]],
      naics: [{ code: '541715', name: 'R&D in the Physical, Engineering, and Life Sciences', share: 1 }], psc: [{ code: 'AJ11', name: 'R&D - General Science/Technology: Basic Research', share: 1 }],
      awards: [award('80NSSC26C0007', 1_700_000, AG.nasa, 'NASA', 'SBIR Phase II — orbital debris analytics', '541715', 'AJ11', '2026-01-05')] },
    suppliers: [], primes: [], exclusions: [], proceedings: [], sec: null, media: [], kev: null,
  },
  {
    entity: { name: 'Apex Federal Solutions LLC', uei: 'APXF8N2DM4Q7', cage: '5A1F6', website: 'https://apexfed.example', country: 'US', state: 'MD', city: 'Columbia',
      incorporationState: 'MD', structure: 'Limited Liability Company', startDate: '2013-04-02', businessTypes: ['For Profit Organization', 'Small Business'],
      naicsPrimary: '541611', registration: { status: 'Active', expirationDate: '2027-02-09' } },
    ownership: { immediateParent: null, ultimateParent: null, gleif: null },
    federal: { total: 18_700_000, shape: [5, 6, 4, 2, 1], agencies: [['dod', 0.66, 'Department of the Army'], ['gsa', 0.34]],
      naics: [{ code: '541611', name: 'Administrative Management and General Management Consulting', share: 1 }], psc: [{ code: 'R408', name: 'Support - Professional: Program Management/Support', share: 1 }],
      awards: [award('W91CRB-21-F-0388', 7_400_000, AG.dod, 'Department of the Army', 'PMO support services', '541611', 'R408', '2021-07-19')] },
    suppliers: [sup('Patriot Staffing Group LLC', 900_000, 5, 'US', 'Staff augmentation')], primes: [],
    exclusions: [{ name: 'Apex Federal Solutions LLC', uei: 'APXF8N2DM4Q7', classification: 'Firm', type: 'Ineligible (Proceedings Completed)', program: 'Reciprocal',
      agency: 'Department of the Army', activeDate: '2026-04-21', terminationDate: '2029-04-20', score: 1 }],
    proceedings: [], sec: null,
    media: [art('Army debars Maryland contractor Apex Federal Solutions over falsified labor qualifications', 'govexec-news.example', '2026-04-23', ['legal', 'fraud'])], kev: null,
  },
  {
    entity: { name: 'Kestrel Industrial Components Inc.', uei: 'KSTL6P1VB8R2', cage: '3K6T8', lei: '5493009KESTRELDEMO03', website: 'https://kestrel-ic.example', country: 'US', state: 'OH', city: 'Dayton',
      incorporationState: 'DE', structure: 'Corporate Entity, Not Tax Exempt', startDate: '2019-10-28', businessTypes: ['For Profit Organization', 'Manufacturer of Goods'],
      naicsPrimary: '332710', registration: { status: 'Active', expirationDate: '2027-05-30' } },
    ownership: { immediateParent: { name: 'Kestrel International B.V.', country: 'NL' }, ultimateParent: null,
      gleif: { directParent: { name: 'Kestrel International B.V.', country: 'NL' }, ultimateParent: { name: 'Kestrel Holdings JSC', country: 'RU' }, children: [] } },
    federal: { total: 22_900_000, shape: [3, 5, 6, 5, 4], agencies: [['dod', 1, 'Defense Logistics Agency']],
      naics: [{ code: '332710', name: 'Machine Shops', share: 1 }], psc: [{ code: '3040', name: 'Miscellaneous Power Transmission Equipment', share: 1 }],
      awards: [award('SPE4A6-24-C-0211', 6_800_000, AG.dod, 'Defense Logistics Agency', 'Gearbox components, ground vehicles', '332710', '3040', '2024-03-08')] },
    suppliers: [sup('Volga Precision Castings LLC', 1_800_000, 6, 'RU', 'Steel castings'), sup('Miami Valley Heat Treat Inc.', 700_000, 9, 'US', 'Heat treating')], primes: [],
    exclusions: [], proceedings: [], sec: null, media: [], kev: null,
  },
  {
    entity: { name: 'Meridian Secure Networks Inc.', uei: 'MRDN5S2KC9T4', cage: '4M9S1', cik: '0009999901', lei: '5493001MERIDIANDEMO4', website: 'https://meridian-secure.example', country: 'US', state: 'TX', city: 'Austin',
      incorporationState: 'DE', structure: 'Corporate Entity, Not Tax Exempt', startDate: '2004-01-15', businessTypes: ['For Profit Organization'],
      naicsPrimary: '334210', tickers: ['MSNX'], exchanges: ['Nasdaq'], registration: { status: 'Active', expirationDate: '2027-06-11' } },
    ownership: { immediateParent: null, ultimateParent: null, gleif: { directParent: null, ultimateParent: null, children: [{ name: 'Meridian Secure Networks UK Ltd', country: 'GB' }], ultimateException: 'NO_KNOWN_PERSON' } },
    federal: { total: 141_000_000, shape: [21, 26, 30, 33, 31], agencies: [['dhs', 0.38, 'Cybersecurity and Infrastructure Security Agency'], ['dod', 0.35, 'Defense Information Systems Agency'], ['treas', 0.15, 'Internal Revenue Service'], ['doj', 0.12, 'Federal Bureau of Investigation']],
      naics: [{ code: '334210', name: 'Telephone Apparatus Manufacturing', share: 0.55 }, { code: '511210', name: 'Software Publishers', share: 0.45 }],
      psc: [{ code: '7G21', name: 'IT and Telecom - Network: Satellite and Network Hardware', share: 0.55 }, { code: '7A21', name: 'IT and Telecom - Business Application Software', share: 0.45 }],
      awards: [award('HC1028-23-F-0071', 39_800_000, AG.dod, 'Defense Information Systems Agency', 'Secure VPN gateway appliances and licenses', '334210', '7G21', '2023-05-17'),
        award('70QS0123F00000318', 27_500_000, AG.dhs, 'Cybersecurity and Infrastructure Security Agency', 'Zero trust network access licenses', '511210', '7A21', '2023-09-28')] },
    suppliers: [sup('Lonestar Circuit Assembly LLC', 8_200_000, 18, 'US', 'PCB assembly'), sup('Taoyuan Precision Electronics Co., Ltd.', 5_400_000, 7, 'TW', 'Appliance chassis')], primes: [{ name: 'Granite Federal Systems Inc.', amount: 15_300_000, count: 5, agency: AG.dhs }],
    exclusions: [], proceedings: [],
    sec: { cik: '0009999901', name: 'MERIDIAN SECURE NETWORKS INC', sic: '3576', sicDescription: 'Computer Communications Equipment', tickers: ['MSNX'], exchanges: ['Nasdaq'], stateOfIncorporation: 'DE',
      lastAnnualReport: '2025-03-03', formerNames: ['Meridian Networks Inc'], riskFilings: [{ form: 'NT 10-K', date: '2026-03-02', label: 'Late annual report (NT 10-K)', url: null }], recentFilings: [], edgarUrl: null },
    media: [art('Meridian Secure Networks VPN flaw exploited by state-sponsored hackers, CISA warns', 'cyberscoop.example', '2026-08-09', ['cyber']),
      art('Ransomware gangs target unpatched Meridian gateways', 'bleeping.example', '2026-06-21', ['cyber'])],
    kev: { total: 7, lastYear: 3, ransomware: 2, products: ['Meridian SecureGate', 'Meridian ZTNA Connector'],
      recent: [{ cve: 'CVE-2026-0000X (demo)', product: 'Meridian SecureGate', name: 'Authentication bypass (demo)', dateAdded: '2026-08-08', ransomware: 'Known' }] },
  },
];

/** Expand compact demo records into the same profile shape the live pipeline produces. */
export function demoRaw(rec) {
  const f = rec.federal;
  const byAgency = agencies(f.total, f.agencies);
  return {
    entity: { ...rec.entity, legalName: rec.entity.name },
    ownership: rec.ownership,
    federal: {
      totalObligated: f.total, awardCount: f.awards.length * 7, firstAwardDate: f.awards.map((a) => a.start).sort()[0], lastAwardDate: f.awards.map((a) => a.start).sort().pop(),
      byAgency: byAgency.map(({ name, code, amount }) => ({ name, code, amount })),
      bySubAgency: byAgency.filter((a) => a.sub).map((a) => ({ name: a.sub, amount: a.amount })),
      naics: f.naics.map((n) => ({ code: n.code, name: n.name, amount: Math.round(f.total * n.share) })),
      psc: f.psc.map((n) => ({ code: n.code, name: n.name, amount: Math.round(f.total * n.share) })),
      trend: trend(f.total, f.shape), topAwards: f.awards, assistance: [],
      subawardCoverage: { primeAwardsExpanded: f.awards.length, subawardRows: rec.suppliers.reduce((t, s) => t + s.count, 0) },
    },
    suppliers: rec.suppliers.map((s) => ({ ...s })),
    primes: (rec.primes || []).map((p) => ({ ...p })),
    exclusions: rec.exclusions, proceedings: rec.proceedings, sec: rec.sec, media: rec.media, kev: rec.kev,
  };
}
