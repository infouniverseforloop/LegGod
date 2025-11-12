// core/optimizer.js
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'optimizer.json');

function ensure() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ weight: 1.0, history: [] }, null, 2));
}
function load() { ensure(); return JSON.parse(fs.readFileSync(FILE)); }
function save(o) { fs.writeFileSync(FILE, JSON.stringify(o, null, 2)); }

function calculateConfidence(signal) {
  const d = load();
  const weight = d.weight || 1.0;
  const base = signal.score || 50;
  let conf = Math.round(Math.max(10, Math.min(99, base * weight)));
  return conf;
}

function recordOutcome(out) {
  const d = load();
  d.history = d.history || [];
  d.history.unshift(out);
  if (d.history.length > 1000) d.history = d.history.slice(0, 1000);
  const recent = d.history.slice(0, 100);
  const wins = recent.filter(r => r.result === 'WIN').length;
  const losses = recent.filter(r => r.result === 'LOSS').length;
  if (losses > wins + 6) d.weight = Math.max(0.5, (d.weight || 1.0) * 0.96);
  else if (wins > losses + 6) d.weight = Math.min(1.6, (d.weight || 1.0) * 1.02);
  save(d);
}

module.exports = { calculateConfidence, recordOutcome };
