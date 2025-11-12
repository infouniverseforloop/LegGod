// core/computeStrategy.js
// Single function to analyze a pair given 1m & 5m candles
const tech = require('./technicalHelpers');

async function analyzeMarket(pair, candles1m, candles5m) {
  if (!candles1m || candles1m.length < 30) return { status: 'hold', reason: 'insufficient' };
  // compute indicators
  const closes = candles1m.map(c => c.close);
  const sma5 = tech.sma(closes, 5), sma20 = tech.sma(closes, 20);
  const rsi = tech.rsi(closes, 14);
  const ob = tech.detectOrderBlock(candles1m);
  const fvg = tech.detectFVG(candles1m);
  const atr = tech.atrLike(candles1m);

  // score model
  let score = 50;
  if (sma5 && sma20 && sma5 > sma20) score += 12; else score -= 8;
  if (rsi < 35) score += 8;
  if (rsi > 70) score -= 8;
  if (ob) score += 14;
  if (fvg) score += 10;

  const entry = closes[closes.length - 1];
  const direction = score >= 60 ? 'CALL' : 'PUT';
  return {
    status: 'ok',
    pair,
    score,
    direction,
    entry,
    sma5, sma20, rsi, ob, fvg, atr,
    ts: Math.floor(Date.now() / 1000)
  };
}

module.exports = { analyzeMarket };
