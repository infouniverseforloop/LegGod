// adapters/exnessAdapter.js
// Simple WS client adapter for Exness-like feeds (expects JSON { symbol, price })
const WebSocket = require('ws');
const logger = require('../utils/logger');

let ws = null;
let ticks = {};
let connected = false;

function init() {
  const url = (process.env.EXNESS_WS_URL || '').trim();
  if (!url) {
    logger.warn('EXNESS_WS_URL not configured; exnessAdapter disabled');
    return false;
  }
  try {
    ws = new WebSocket(url);
    ws.on('open', () => { logger.info('Exness WS connected'); connected = true; });
    ws.on('message', m => {
      try {
        const d = JSON.parse(m.toString());
        if (d.symbol && d.price) {
          ticks[d.symbol] = ticks[d.symbol] || [];
          ticks[d.symbol].push({ ts: Math.floor(Date.now() / 1000), price: parseFloat(d.price) });
          if (ticks[d.symbol].length > 5000) ticks[d.symbol].shift();
        }
      } catch (e) { /* ignore parse errors */ }
    });
    ws.on('error', e => logger.warn('Exness WS error: ' + e.message));
    ws.on('close', () => { logger.warn('Exness WS closed'); connected = false; });
    return true;
  } catch (e) {
    logger.error('Exness init failed: ' + e.message);
    return false;
  }
}

function buildCandlesFromTicks(symbol, count = 600) {
  const arr = ticks[symbol] || [];
  if (arr.length < 3) throw new Error('Not enough ticks for ' + symbol);
  const map = {};
  arr.forEach(t => {
    const sec = t.ts;
    map[sec] = map[sec] || { time: sec, open: t.price, high: t.price, low: t.price, close: t.price, volume: 1 };
    map[sec].high = Math.max(map[sec].high, t.price);
    map[sec].low = Math.min(map[sec].low, t.price);
    map[sec].close = t.price;
    map[sec].volume += 1;
  });
  const keys = Object.keys(map).sort();
  const out = [];
  for (let i = keys.length - 1; i >= 0 && out.length < count; i--) out.push(map[keys[i]]);
  return out.reverse();
}

module.exports = { init, buildCandlesFromTicks, isConnected: () => connected };
