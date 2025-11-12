// utils/db.js
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'signals.json');

function ensure() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ signals: [], results: [] }, null, 2));
}
function saveSignal(sig) { ensure(); const o = JSON.parse(fs.readFileSync(FILE)); o.signals.unshift(sig); if (o.signals.length > 2000) o.signals = o.signals.slice(0, 2000); fs.writeFileSync(FILE, JSON.stringify(o, null, 2)); }
function saveResult(res) { ensure(); const o = JSON.parse(fs.readFileSync(FILE)); o.results.unshift(res); if (o.results.length > 2000) o.results = o.results.slice(0, 2000); fs.writeFileSync(FILE, JSON.stringify(o, null, 2)); }
function readAll() { ensure(); return JSON.parse(fs.readFileSync(FILE)); }
module.exports = { saveSignal, saveResult, readAll };
