require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const sessionStore = require('./session');
const instruments = require('./instruments');
const liveFeed = require('./liveFeed');

const app = express();
app.use(cors());
app.use(express.json());

function asyncHandler(fn) {
  return (req, res) => fn(req, res).catch((err) => {
    res.status(err.status || 500).json({ error: err.message });
  });
}

app.post('/api/login', asyncHandler(async (req, res) => {
  const { apiKey, clientCode, password, totp } = req.body;
  if (!apiKey || !clientCode || !password || !totp) {
    return res.status(400).json({ error: 'apiKey, clientCode, password, totp are required' });
  }
  const result = await sessionStore.login({ apiKey, clientCode, password, totp });
  res.json(result);
}));

app.post('/api/logout', asyncHandler(async (req, res) => {
  await sessionStore.logout();
  res.json({ ok: true });
}));

app.get('/api/session', (req, res) => {
  const s = sessionStore.getSession();
  res.json({ loggedIn: !!s, clientCode: s?.clientCode || null });
});

app.get('/api/profile', asyncHandler(async (req, res) => {
  const { smartApi } = sessionStore.requireSession();
  const result = await smartApi.getProfile();
  res.json(result);
}));

app.get('/api/rms', asyncHandler(async (req, res) => {
  const { smartApi } = sessionStore.requireSession();
  const result = await smartApi.getRMS();
  res.json(result);
}));

app.post('/api/candle-data', asyncHandler(async (req, res) => {
  const { smartApi } = sessionStore.requireSession();
  const { exchange, symboltoken, interval, fromdate, todate } = req.body;
  if (!exchange || !symboltoken || !interval || !fromdate || !todate) {
    return res.status(400).json({
      error: 'exchange, symboltoken, interval, fromdate, todate are required',
    });
  }
  const result = await smartApi.getCandleData({ exchange, symboltoken, interval, fromdate, todate });
  res.json(result);
}));

app.get('/api/instruments/search', asyncHandler(async (req, res) => {
  const { q, exchange, instrumenttype, limit } = req.query;
  const result = await instruments.search({
    query: q,
    exchange,
    instrumenttype,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(result);
}));

app.get('/api/instruments/indices', asyncHandler(async (req, res) => {
  res.json(await instruments.indices());
}));

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws-feed' });
liveFeed.attach(wss);

server.listen(PORT, () => {
  console.log(`SmartAPI backend listening on http://localhost:${PORT}`);
});
