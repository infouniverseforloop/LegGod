// core/technicalHelpers.js
function sma(arr, n) { if (!arr || arr.length < n) return null; const s = arr.slice(-n).reduce((a, b) => a + b, 0); return +(s / n); }
function rsi(closes, p = 14) {
  if (!closes || closes.length < p + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - p; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgG = gains / p || 1e-8, avgL = losses / p || 1e-8;
  const rs = avgG / avgL; return +(100 - (100 / (1 + rs)));
}
function atrLike(candles) {
  if (!candles || candles.length < 14) return 0.0001;
  const arr = candles.slice(-14).map(c => Math.abs(c.high - c.low));
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function detectOrderBlock(candles) {
  if (!candles || candles.length < 4) return null;
  const last = candles[candles.length - 2], prev = candles[candles.length - 3];
  if (!last || !prev) return null;
  if ((last.close > last.open) && (prev.close < prev.open) && (Math.abs(last.close - last.open) > Math.abs(prev.close - prev.open) * 1.2))
    return { type: 'bull', level: last.open };
  if ((last.close < last.open) && (prev.close > prev.open) && (Math.abs(last.open - last.close) > Math.abs(prev.open - prev.close) * 1.2))
    return { type: 'bear', level: last.open };
  return null;
}
function detectFVG(candles) {
  if (!candles || candles.length < 3) return null;
  const a = candles[candles.length - 3], b = candles[candles.length - 2];
  if (b.low > a.high) return { type: 'bull', gapTop: a.high, gapBottom: b.low };
  if (b.high < a.low) return { type: 'bear', gapTop: b.high, gapBottom: a.low };
  return null;
}
module.exports = { sma, rsi, atrLike, detectOrderBlock, detectFVG };
