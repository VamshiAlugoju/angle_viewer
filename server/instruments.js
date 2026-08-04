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

const OPTION_TYPES = ['OPTIDX', 'OPTSTK'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// AngelOne expiry strings look like "28DEC2023"
function parseExpiry(expiry) {
  const day = Number(expiry.slice(0, 2));
  const month = MONTHS.indexOf(expiry.slice(2, 5));
  const year = Number(expiry.slice(5));
  return new Date(Date.UTC(year, month, day));
}

async function optionUnderlyings(query) {
  const list = await loadInstruments();
  const q = (query || '').trim().toUpperCase();
  const names = new Set();
  for (const i of list) {
    if (i.exch_seg !== 'NFO' || !OPTION_TYPES.includes(i.instrumenttype)) continue;
    if (q && !i.name?.toUpperCase().includes(q)) continue;
    names.add(i.name);
  }
  return [...names].sort().slice(0, 50);
}

// Groups an underlying's option contracts by expiry and tags each expiry as
// WEEKLY or MONTHLY: the last expiry falling in a given calendar month is monthly.
async function optionsChain({ name, exchange = 'NFO' }) {
  const list = await loadInstruments();
  const results = list.filter(
    (i) => i.exch_seg === exchange && OPTION_TYPES.includes(i.instrumenttype) && i.name === name
  );

  const latestInMonth = new Map();
  for (const i of results) {
    if (!i.expiry) continue;
    const date = parseExpiry(i.expiry);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const current = latestInMonth.get(key);
    if (!current || date > current.date) latestInMonth.set(key, { expiry: i.expiry, date });
  }
  const monthlyExpiries = new Set([...latestInMonth.values()].map((v) => v.expiry));

  return results
    .map((i) => ({
      ...i,
      expiryType: monthlyExpiries.has(i.expiry) ? 'MONTHLY' : 'WEEKLY',
      optionType: i.symbol?.endsWith('CE') ? 'CE' : i.symbol?.endsWith('PE') ? 'PE' : '',
    }))
    .sort((a, b) => parseExpiry(a.expiry) - parseExpiry(b.expiry) || Number(a.strike) - Number(b.strike));
}

module.exports = { loadInstruments, search, indices, optionUnderlyings, optionsChain };
