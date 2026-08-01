// Proxies AngelOne's binary WebSocketV2 market feed to plain-JSON browser websockets.
// One upstream connection to AngelOne is shared across all connected browser clients.
const { WebSocketV2 } = require('smartapi-javascript');
const { getSession } = require('./session');

let upstream = null;
let browserClients = new Set();

function ensureUpstream() {
  if (upstream) return upstream;
  const session = getSession();
  if (!session) throw new Error('Not logged in');

  upstream = new WebSocketV2({
    clientcode: session.clientCode,
    jwttoken: session.jwtToken,
    apikey: session.apiKey,
    feedtype: session.feedToken,
  });

  upstream.connect().then(() => {
    upstream.on('tick', (tick) => {
      const payload = JSON.stringify({ type: 'tick', data: tick });
      for (const client of browserClients) {
        if (client.readyState === client.OPEN) client.send(payload);
      }
    });
  });

  return upstream;
}

function closeUpstreamIfIdle() {
  if (upstream && browserClients.size === 0) {
    upstream.close();
    upstream = null;
  }
}

function attach(wss) {
  wss.on('connection', (client) => {
    browserClients.add(client);

    client.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return client.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }

      try {
        const feed = ensureUpstream();
        if (msg.action === 'subscribe' || msg.action === 'unsubscribe') {
          feed.fetchData({
            correlationID: msg.correlationID || 'ui',
            action: msg.action === 'subscribe' ? 1 : 0,
            mode: msg.mode || 1,
            exchangeType: msg.exchangeType,
            tokens: msg.tokens,
          });
        }
      } catch (err) {
        client.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    client.on('close', () => {
      browserClients.delete(client);
      closeUpstreamIfIdle();
    });
  });
}

module.exports = { attach };
