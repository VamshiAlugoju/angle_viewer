// AngelOne publishes the full tradable instrument list (stocks, indices, F&O, etc) as a
// public JSON file. We cache it in memory and expose a search endpoint over it.
const SCRIP_MASTER_URL =
  'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

let cache = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadInstruments() {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  const res = await fetch(SCRIP_MASTER_URL);
  if (!res.ok) throw new Error(`Failed to fetch instrument master: ${res.status}`);
  cache = await res.json();
  cachedAt = Date.now();
  return cache;
}

async function search({ query, exchange, instrumenttype, limit = 50 }) {
  const list = await loadInstruments();
  const q = (query || '').trim().toUpperCase();
  let results = list;

  if (exchange) results = results.filter((i) => i.exch_seg === exchange);
  if (instrumenttype) {
    const types = instrumenttype.split(',').map((t) => t.trim());
    results = results.filter((i) => types.includes(i.instrumenttype));
  }
  if (q) {
    results = results.filter(
      (i) => i.symbol?.toUpperCase().includes(q) || i.name?.toUpperCase().includes(q)
    );
  }

  return results.slice(0, limit);
}

async function indices() {
  const list = await loadInstruments();
  return list.filter((i) => i.instrumenttype === 'AMXIDX').slice(0, 200);
}

module.exports = { loadInstruments, search, indices };
