// core/masterOverseer.js
const quotex = require('../adapters/quotexAdapter');
const exness = require('../adapters/exnessAdapter');
const compute = require('./computeStrategy');
const optimizer = require('./optimizer');
const resultResolver = require('./resultResolver');
const db = require('../utils/db');
const notifier = require('../utils/notifier');
const logger = require('../utils/logger');

const WATCH = (process.env.WATCH_SYMBOLS || 'EUR/USD,GBP/USD,USD/JPY').split(',').map(s => s.trim());
const INTERVAL = parseInt(process.env.SCAN_INTERVAL_MS || '3000', 10);
const MIN_CONF = parseInt(process.env.MIN_CONFIDENCE || '80', 10);

let wss = null;
let frontendClients = new Set();
let adaptersInitialized = false;

async function init() {
  // initialize adapters (try both)
  adaptersInitialized = false;
  const qok = (process.env.QUOTEX_ENABLED || 'true') === 'true' ? await quotex.init().catch(() => false) : false;
  const eok = (process.env.EXNESS_ENABLED || 'false') === 'true' ? exness.init() : false;
  adaptersInitialized = !!(qok || eok);
  if (!adaptersInitialized) logger.warn('No adapters active — safe-mode (no live signals)');
  else logger.info('Adapters active');
}

function registerWebSocketServer(server) {
  wss = server;
}
function registerFrontend(ws) { frontendClients.add(ws); ws.on('close', () => frontendClients.delete(ws)); }

function broadcast(obj) {
  if (!wss) return;
  const raw = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(raw); });
}

async function startScanLoop() {
  logger.info('Master scan loop started');
  while (true) {
    try {
      if (!adaptersInitialized) {
        // attempt re-init
        await init();
      }
      for (const pair of WATCH) {
        try {
          let candles1m = null, candles5m = null;
          // try exness first (forex)
          if ((process.env.EXNESS_ENABLED || 'false') === 'true') {
            try {
              const arr = exness.buildCandlesFromTicks(pair, 600);
              if (arr) { candles1m = arr.slice(-300); candles5m = aggregate(arr, 5); }
            } catch (e) { /* ignore */ }
          }
          // try quotex adapter
          if (!candles1m && (process.env.QUOTEX_ENABLED || 'true') === 'true') {
            try {
              const arr = await quotex.fetchRecentCandles(pair, 600).catch(() => null);
              if (arr) { candles1m = arr.slice(-300); candles5m = aggregate(arr, 5); }
            } catch (e) { /* ignore */ }
          }
          if (!candles1m || !candles5m) {
            broadcast({ type: 'log', pair, status: 'hold', reason: 'insufficient data' });
            continue;
          }
          const analysis = await compute.analyzeMarket(pair, candles1m, candles5m);
          if (!analysis || analysis.status !== 'ok') { broadcast({ type: 'pair', pair, status: 'hold' }); continue; }
          const conf = optimizer.calculateConfidence(analysis);
          if (conf < MIN_CONF) { broadcast({ type: 'pair', pair, status: 'hold', confidence: conf }); continue; }

          // prepare signal
          const direction = analysis.direction;
          const entry = analysis.entry;
          const atr = analysis.atr || 0.0001;
          const sl = direction === 'CALL' ? entry - atr * 1.2 : entry + atr * 1.2;
          const tp = direction === 'CALL' ? entry + atr * 2.2 : entry - atr * 2.2;
          const sig = {
            id: Date.now() + Math.floor(Math.random() * 9999),
            pair,
            direction,
            confidence: conf,
            entry,
            sl: +sl.toFixed(pair.includes('JPY') ? 2 : 5),
            tp: +tp.toFixed(pair.includes('JPY') ? 2 : 5),
            entry_ts: Math.floor(Date.now() / 1000),
            expiry_ts: Math.floor(Date.now() / 1000) + parseInt(process.env.BINARY_EXPIRY_SECONDS || '60', 10),
            notes: { score: analysis.score, sma5: analysis.sma5, rsi: analysis.rsi }
          };

          // save and broadcast
          db.saveSignal(sig);
          broadcast({ type: 'signal', data: sig });
          try { await notifier.sendTelegram(notifier.formatSignal(sig)); } catch (e) { logger.warn('Telegram send error: ' + e.message); }
          logger.info(`Emitted signal ${sig.pair} ${sig.direction} conf:${sig.confidence}`);

          // wait until expiry then resolve
          const waitMs = Math.max(3000, (sig.expiry_ts - Math.floor(Date.now() / 1000)) * 1000 + 1500);
          await sleep(waitMs);

          // get final price
          let finalPrice = sig.entry;
          try {
            if ((process.env.EXNESS_ENABLED || 'false') === 'true') {
              const arr = exness.buildCandlesFromTicks(pair, 10); if (arr && arr.length) finalPrice = arr[arr.length - 1].close;
            } else if ((process.env.QUOTEX_ENABLED || 'true') === 'true') {
              const arr = await quotex.fetchRecentCandles(pair, 10).catch(() => null); if (arr && arr.length) finalPrice = arr[arr.length - 1].close;
            }
          } catch (e) { logger.warn('final price fetch error: ' + e.message); }

          // resolve
          const resolved = await resultResolver.resolveSignal(sig, finalPrice).catch(e => { logger.warn('resolve failed: ' + e.message); });
          broadcast({ type: 'result', data: resolved });
        } catch (e) {
          logger.warn('pair loop error: ' + e.message);
        }
      }
    } catch (e) {
      logger.warn('scan outer error: ' + e.message);
    }
    await sleep(INTERVAL);
  }
}

function aggregate(candles, factor) {
  if (!candles) return null;
  const out = [];
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    if (chunk.length === 0) continue;
    const open = chunk[0].open, close = chunk[chunk.length - 1].close, high = Math.max(...chunk.map(c => c.high)), low = Math.min(...chunk.map(c => c.low));
    out.push({ time: chunk[0].time, open, high, low, close, volume: chunk.reduce((a, b) => a + (b.volume || 0), 0) });
  }
  return out;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { init, startScanLoop, registerWebSocketServer, registerFrontend, registerFrontendWS: registerFrontend };
