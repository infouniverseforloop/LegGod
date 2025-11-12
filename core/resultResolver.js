// core/resultResolver.js
const db = require('../utils/db');
const optimizer = require('./optimizer');
const notifier = require('../utils/notifier');
const logger = require('../utils/logger');

async function resolveSignal(signal, finalPrice) {
  const win = signal.direction === 'CALL' ? (finalPrice > signal.entry) : (finalPrice < signal.entry);
  const res = {
    id: signal.id || (Date.now() + Math.floor(Math.random() * 9999)),
    pair: signal.pair,
    direction: signal.direction,
    entry: signal.entry,
    finalPrice,
    result: win ? 'WIN' : 'LOSS',
    confidence: signal.confidence,
    settled_ts: Math.floor(Date.now() / 1000)
  };
  db.saveResult(res);
  optimizer.recordOutcome({ pair: res.pair, result: res.result, confidence: res.confidence, ts: res.settled_ts });
  try { await notifier.sendTelegram(notifier.formatResult(res)); } catch (e) { logger.warn('Notifier send failed: ' + e.message); }
  logger.info(`Resolved ${res.pair} -> ${res.result}`);
  return res;
}

module.exports = { resolveSignal };
