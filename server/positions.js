// Paper-trade position store, persisted to a committed JSON file (not a real DB —
// single local user, no concurrent writers, and we want it to travel with the repo
// across machines).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data', 'positions.json');

function readAll() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return { open: data.open || [], closed: data.closed || [] };
  } catch {
    return { open: [], closed: [] };
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

function list() {
  return readAll();
}

// contract: { token, symbol, exch_seg, name, optionType, strike, expiry, lotsize }
// basketId links multiple legs placed together (e.g. a short strangle's CE + PE legs)
// so they can be shown/exited as one unit; null for a standalone single-leg trade.
function open({ contract, side, qty, entryPrice, basketId = null, basketLabel = null }) {
  const data = readAll();
  const position = {
    id: crypto.randomUUID(),
    ...contract,
    side,
    qty,
    entryPrice,
    entryTime: new Date().toISOString(),
    status: 'OPEN',
    basketId,
    basketLabel,
  };
  data.open.push(position);
  writeAll(data);
  return position;
}

function close(id, exitPrice) {
  const data = readAll();
  const idx = data.open.findIndex((p) => p.id === id);
  if (idx === -1) {
    const err = new Error('Position not found or already closed');
    err.status = 404;
    throw err;
  }
  const [position] = data.open.splice(idx, 1);
  const closed = {
    ...position,
    exitPrice,
    exitTime: new Date().toISOString(),
    status: 'CLOSED',
  };
  data.closed.push(closed);
  writeAll(data);
  return closed;
}

module.exports = { list, open, close };
