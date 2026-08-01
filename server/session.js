// Single-process in-memory session store. Fine for one local user running this dashboard;
// not meant for multi-tenant/production use.
const { SmartAPI } = require('smartapi-javascript');

let session = null; // { smartApi, apiKey, clientCode, jwtToken, refreshToken, feedToken }

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
    return { clientCode };
  });
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

module.exports = { login, getSession, requireSession, logout };
