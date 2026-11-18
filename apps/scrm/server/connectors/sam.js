// SAM.gov Entity Management + Exclusions APIs (free public API key from sam.gov
// "Account Details" page). Public (non-FOUO) data only.
// Docs: https://open.gsa.gov/api/entity-api/  https://open.gsa.gov/api/exclusions-api/
import { fetchJson, DAY } from '../lib/http.js';
import { similarity } from '../lib/match.js';

const BASE = 'https://api.sam.gov/entity-information/v4';

export const meta = {
  id: 'sam', name: 'SAM.gov Entity & Exclusions', provider: 'General Services Administration',
  url: 'https://sam.gov', docs: 'https://open.gsa.gov/api/entity-api/', requiresKey: true, keySetting: 'sam_api_key',
};

const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();

function mapEntity(e) {
  const reg = e.entityRegistration || {};
  const core = e.coreData || {};
  const info = core.entityInformation || {};
  const gen = core.generalInformation || {};
  const addr = core.physicalAddress || {};
  const goods = e.assertions?.goodsAndServices || {};
  const hier = core.entityHierarchyInformation || {};
  const parent = (p) => p && (p.legalBusinessName || p.ueiSAM) ? {
    name: p.legalBusinessName, uei: p.ueiSAM, country: p.physicalAddress?.countryCode || null,
  } : null;
  return {
    legalName: reg.legalBusinessName, dba: reg.dbaName, uei: reg.ueiSAM, cage: reg.cageCode,
    registrationStatus: reg.registrationStatus, registrationDate: reg.registrationDate,
    expirationDate: reg.registrationExpirationDate, lastUpdate: reg.lastUpdateDate,
    exclusionFlag: reg.exclusionStatusFlag, purpose: reg.purposeOfRegistrationDesc,
    startDate: info.entityStartDate, website: info.entityURL,
    structure: gen.entityStructureDesc, entityType: gen.entityTypeDesc,
    incorporationCountry: gen.countryOfIncorporationCode, incorporationState: gen.stateOfIncorporationCode,
    address: { line1: addr.addressLine1, city: addr.city, state: addr.stateOrProvinceCode, zip: addr.zipCode, country: addr.countryCode },
    businessTypes: (core.businessTypes?.businessTypeList || []).map((b) => b.businessTypeDesc).filter(Boolean),
    sbaTypes: (core.businessTypes?.sbaBusinessTypeList || []).map((b) => b.sbaBusinessTypeDesc).filter(Boolean),
    primaryNaics: goods.primaryNaics, naics: (goods.naicsList || []).map((n) => ({ code: n.naicsCode, name: n.naicsDescription })),
    psc: (goods.pscList || []).map((p) => ({ code: p.pscCode, name: p.pscDescription })),
    immediateParent: parent(hier.immediateParentEntity), ultimateParent: parent(hier.ultimateParentEntity),
    proceedings: e.integrityInformation?.proceedingsData?.listOfProceedings || [],
    responsibilityInfo: e.integrityInformation?.responsibilityInformationList || [],
  };
}

export async function lookupEntity(key, { uei, cage, name }) {
  const base = { api_key: key, includeSections: 'entityRegistration,coreData,assertions,integrityInformation' };
  let params;
  if (uei) params = { ...base, ueiSAM: uei };
  else if (cage) params = { ...base, cageCode: cage };
  else params = { ...base, legalBusinessName: name };
  const r = await fetchJson(`${BASE}/entities?${q(params)}`, { cacheTtlMs: DAY });
  const list = (r?.entityData || []).map(mapEntity);
  if (!list.length) return null;
  if (uei || cage) return list[0];
  return list.map((e) => ({ e, s: similarity(name, e.legalName) })).sort((a, b) => b.s - a.s)[0].e;
}

export async function searchEntities(key, text) {
  const r = await fetchJson(`${BASE}/entities?${q({ api_key: key, q: text, registrationStatus: 'A', includeSections: 'entityRegistration,coreData' })}`, { cacheTtlMs: DAY });
  return (r?.entityData || []).slice(0, 10).map(mapEntity).map((e) => ({
    source: 'sam', name: e.legalName, uei: e.uei, cage: e.cage, country: e.address.country, state: e.address.state,
    score: similarity(text, e.legalName),
  }));
}

export async function exclusions(key, { uei, name }) {
  const params = { api_key: key, ...(uei ? { ueiSAM: uei } : { q: `"${name}"` }) };
  const r = await fetchJson(`${BASE}/exclusions?${q(params)}`, { cacheTtlMs: DAY / 2 });
  return (r?.excludedEntity || []).map((x) => {
    const id = x.exclusionIdentification || {};
    const det = x.exclusionDetails || {};
    const act = x.exclusionActions?.listOfActions?.[0] || {};
    const exName = id.entityName || [id.firstName, id.lastName].filter(Boolean).join(' ');
    return {
      name: exName, uei: id.ueiSAM, cage: id.cageCode, classification: det.classificationType, type: det.exclusionType,
      program: det.exclusionProgram, agency: det.excludingAgencyName, activeDate: act.activateDate, terminationDate: act.terminationDate,
      ctCode: det.ctCode, score: uei && id.ueiSAM === uei ? 1 : similarity(name, exName),
    };
  }).filter((x) => x.score >= 0.86);
}
