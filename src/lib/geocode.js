import { registerGeocodeSaver } from "./storage.js";

const GEOCODE_LS_KEY = "personaDB::geocode::v2";

let _geocodeCache = (() => {
  try { return JSON.parse(localStorage.getItem(GEOCODE_LS_KEY) || "{}"); }
  catch (e) { return {}; }
})();

function _saveGeocodeCache() {
  try { localStorage.setItem(GEOCODE_LS_KEY, JSON.stringify(_geocodeCache)); } catch (e) {}
}

registerGeocodeSaver(_saveGeocodeCache);

// Nominatim: max ~1 req/sec — serialize via chain
let _nominatimChain = Promise.resolve();

export function geocodeOSM(address) {
  if (!address) return Promise.resolve(null);
  const key = address.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(_geocodeCache, key)) {
    return Promise.resolve(_geocodeCache[key]);
  }
  const myTurn = _nominatimChain.then(async () => {
    if (Object.prototype.hasOwnProperty.call(_geocodeCache, key)) return _geocodeCache[key];
    await new Promise((r) => setTimeout(r, 1100));
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=" + encodeURIComponent(address);
      const resp = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!resp.ok) throw new Error("nominatim " + resp.status);
      const arr = await resp.json();
      const top = arr && arr[0];
      const result = top ? {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        display: top.display_name || address,
        country: (top.address && top.address.country) || "",
      } : null;
      _geocodeCache[key] = result;
      _saveGeocodeCache();
      return result;
    } catch (e) {
      console.warn("[nominatim]", e);
      return null;
    }
  });
  _nominatimChain = myTurn.catch(() => {});
  return myTurn;
}

export function geocodeCached(address) {
  if (!address) return null;
  const key = address.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(_geocodeCache, key) ? _geocodeCache[key] : undefined;
}
