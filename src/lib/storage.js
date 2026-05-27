export const LS_KEY = "personaDB::v3";
export const LS_FOLDER_KEY = "personaDB::imageDirName";
export const CLASSIFIED_PIN_KEY = "personaDB::classifiedPin";

export function normalizeProfile(p) {
  return {
    ...p,
    contacts: Array.isArray(p.contacts) ? p.contacts : [],
    relationships: Array.isArray(p.relationships) ? p.relationships : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    poi: !!p.poi,
    hidden: !!p.hidden,
    classified: !!p.classified,
    country: p.country || "",
    status: p.status || "",
  };
}

export function extractProfilesFromBackup(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.profiles)) return data.profiles;
    if (Array.isArray(data.records)) return data.records;
    if (Array.isArray(data.data)) return data.data;
    const values = Object.values(data).filter(Array.isArray);
    if (values.length === 1) return values[0];
    if (Object.keys(data).length && !Array.isArray(data)) return [data];
  }
  return [];
}

export function loadProfiles() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeProfile);
  } catch (e) {
    return [];
  }
}

export function saveProfiles(list) {
  try {
    const clean = (list || []).map((p) => {
      const { imageData, ...rest } = p;
      return rest;
    });
    localStorage.setItem(LS_KEY, JSON.stringify(clean));
  } catch (e) { console.warn("saveProfiles failed", e); }
}

export function saveAllState(profiles, dirName, classifiedPin) {
  saveProfiles(profiles || []);
  try {
    if (dirName != null) localStorage.setItem(LS_FOLDER_KEY, dirName);
  } catch (e) { console.warn("saveAllState folder save failed", e); }
  try {
    if (classifiedPin != null) localStorage.setItem(CLASSIFIED_PIN_KEY, classifiedPin);
  } catch (e) { console.warn("saveAllState pin save failed", e); }
  try { _saveGeocodeCache(); } catch (e) { console.warn("saveAllState geocode save failed", e); }
}

// Imported by saveAllState — resolved at runtime via geocode module
// geocode.js sets this up
let _saveGeocodeCache = () => {};
export function registerGeocodeSaver(fn) { _saveGeocodeCache = fn; }
