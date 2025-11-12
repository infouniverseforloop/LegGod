// intelligence/liquidityDetector.js
function detectLiquiditySweep(candles) {
  if (!candles || candles.length < 6) return false;
  const last = candles.slice(-3);
  const atr = last.reduce((a, b) => a + Math.abs(b.high - b.low), 0) / last.length;
  return last.some(c => Math.abs(c.high - c.low) > atr * 1.5);
}
module.exports = { detectLiquiditySweep };
