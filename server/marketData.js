// Wraps SmartAPI's market_data (LTP/Quote/Full) endpoint. Angel caps a single request
// at 50 scrips combined across exchanges, so we chunk and issue requests sequentially
// to stay well under the per-second rate limit.
const sessionStore = require('./session');

const MAX_TOKENS_PER_REQUEST = 50;

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// exchangeTokens: { NFO: ['12345', ...], NSE: ['99926000'] }
async function quote({ exchangeTokens, mode = 'FULL' }) {
  const { smartApi } = sessionStore.requireSession();

  const pairs = [];
  for (const [exchange, tokens] of Object.entries(exchangeTokens || {})) {
    for (const token of tokens || []) pairs.push([exchange, token]);
  }
  if (pairs.length === 0) return { fetched: [], unfetched: [] };

  const fetched = [];
  const unfetched = [];

  for (const batch of chunk(pairs, MAX_TOKENS_PER_REQUEST)) {
    const grouped = {};
    for (const [exchange, token] of batch) {
      (grouped[exchange] ??= []).push(token);
    }
    const res = await smartApi.marketData({ mode, exchangeTokens: grouped });
    if (res?.status === false) {
      throw new Error(res.message || 'Failed to fetch market data');
    }
    if (res?.data?.fetched) fetched.push(...res.data.fetched);
    if (res?.data?.unfetched) unfetched.push(...res.data.unfetched);
  }

  return { fetched, unfetched };
}

// Angel's optionGreek endpoint returns IV/delta/gamma/theta/vega for every strike of an
// underlying+expiry in one call, so callers should fetch it once per expiry and reuse it
// (not once per contract).
async function optionGreeks({ name, expirydate }) {
  const { smartApi } = sessionStore.requireSession();
  const res = await smartApi.optionGreek({ name, expirydate });
  if (!res || res.status !== true) {
    throw new Error(res?.message || 'Failed to fetch option greeks');
  }
  return res.data || [];
}

module.exports = { quote, optionGreeks };
