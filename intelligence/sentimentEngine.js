// intelligence/sentimentEngine.js
// lightweight stub — can be wired to news APIs for real sentiment
async function getMarketSentiment(pair) {
  // return neutral by default
  return { pair, sentiment: 'neutral', score: 0 };
}
module.exports = { getMarketSentiment };
