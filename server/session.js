// Single-process in-memory session store. Fine for one local user running this dashboard;
// not meant for multi-tenant/production use.
const { SmartAPI } = require('smartapi-javascript');

let session = null; // { smartApi, apiKey, clientCode, jwtToken, refreshToken, feedToken }

function tokenBundle(s) {
  return {
    clientCode: s.clientCode,
    apiKey: s.apiKey,
    jwtToken: s.jwtToken,
    refreshToken: s.refreshToken,
    feedToken: s.feedToken,
  };
}

function login({ apiKey, clientCode, password, totp }) {
  const smartApi = new SmartAPI({ api_key: apiKey });
  return smartApi.generateSession(clientCode, password, totp).then((res) => {
    if (!res || res.status !== true) {
      const message = res?.message || 'Login failed';
      throw new Error(message);
    }
    session = {
      smartApi,
      apiKey,
      clientCode,
      jwtToken: res.data.jwtToken,
      refreshToken: res.data.refreshToken,
      feedToken: res.data.feedToken,
    };
    return tokenBundle(session);
  });
}

// Rehydrates the in-memory session from tokens the browser persisted (e.g. after a
// server restart wiped our in-memory state). Confirms the jwt still works with a
// cheap call before trusting it.
async function restore({ apiKey, clientCode, jwtToken, refreshToken, feedToken }) {
  const smartApi = new SmartAPI({ api_key: apiKey });
  smartApi.setAccessToken(jwtToken);
  smartApi.setPublicToken(refreshToken);
  smartApi.setClientCode(clientCode);

  const profile = await smartApi.getProfile();
  if (!profile || profile.status !== true) {
    const err = new Error('Session expired');
    err.status = 401;
    throw err;
  }

  session = { smartApi, apiKey, clientCode, jwtToken, refreshToken, feedToken };
  return tokenBundle(session);
}

// Exchanges a refresh token for a new jwt once the old one has expired.
async function refresh({ apiKey, clientCode, refreshToken, feedToken }) {
  const smartApi = new SmartAPI({ api_key: apiKey });
  smartApi.setClientCode(clientCode);

  const res = await smartApi.generateToken(refreshToken);
  if (!res || res.status !== true) {
    const err = new Error(res?.message || 'Session expired');
    err.status = 401;
    throw err;
  }

  session = {
    smartApi,
    apiKey,
    clientCode,
    jwtToken: res.data.jwtToken,
    refreshToken: res.data.refreshToken || refreshToken,
    feedToken,
  };
  return tokenBundle(session);
}

function getSession() {
  return session;
}

function requireSession() {
  if (!session) {
    const err = new Error('Not logged in');
    err.status = 401;
    throw err;
  }
  return session;
}

function logout() {
  const s = session;
  session = null;
  if (s) return s.smartApi.logout(s.clientCode);
  return Promise.resolve();
}

module.exports = { login, restore, refresh, getSession, requireSession, logout };
