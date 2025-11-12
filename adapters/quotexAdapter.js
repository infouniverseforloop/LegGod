// adapters/quotexAdapter.js
// Provides fallback-safe access to Quotex market data.
// Two modes:
//  - external feed: set QUOTEX_WS_URL in .env (preferred for Replit)
//  - puppeteer scraping: tries to login and read in-page chart structures (may need host libs)

const WebSocket = require('ws');
const puppeteer = require('puppeteer-core');
const logger = require('../utils/logger');

let wsFeed = null;
let puppBrowser = null;
let puppPage = null;
let connected = false;
let ticks = {}; // simple tick store for external feed

async function init() {
  // If external websocket feed provided — listen to it and fill ticks
  const wsUrl = (process.env.QUOTEX_WS_URL || '').trim();
  if (wsUrl) {
    try {
      logger.info('Connecting to external QUOTEX_WS_URL...');
      wsFeed = new WebSocket(wsUrl);
      wsFeed.on('open', () => { logger.info('QUOTEX external WS open'); connected = true; });
      wsFeed.on('message', m => {
        try {
          const d = JSON.parse(m.toString());
          if (d.symbol && d.price) {
            ticks[d.symbol] = ticks[d.symbol] || [];
            ticks[d.symbol].push({ ts: Math.floor(Date.now() / 1000), price: parseFloat(d.price) });
            if (ticks[d.symbol].length > 5000) ticks[d.symbol].shift();
          }
        } catch (e) { /* ignore parse errors */ }
      });
      wsFeed.on('error', e => logger.warn('Quotex WS error: ' + e.message));
      wsFeed.on('close', () => { logger.warn('Quotex WS closed'); connected = false; });
      return true;
    } catch (e) {
      logger.warn('Quotex external WS failed: ' + e.message);
    }
  }

  // fallback: attempt Puppeteer (may fail on Replit)
  const user = process.env.QUOTEX_USER;
  const pass = process.env.QUOTEX_PASS;
  if (!user || !pass) {
    logger.warn('Quotex credentials not provided; quotexAdapter disabled');
    return false;
  }

  try {
    logger.info('Starting Puppeteer for Quotex (headless)...');
    const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
    if (process.env.PUPPETEER_EXEC_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXEC_PATH;
    puppBrowser = await puppeteer.launch(launchOpts);
    puppPage = await puppBrowser.newPage();
    await puppPage.setViewport({ width: 1280, height: 800 });
    await puppPage.goto('https://quotex.io/en/sign-in', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
    // try to fill login if selectors exist
    try {
      await puppPage.waitForSelector('input[name="email"]', { timeout: 8000 });
      await puppPage.type('input[name="email"]', user, { delay: 40 });
      await puppPage.type('input[name="password"]', pass, { delay: 40 });
      await puppPage.click('button[type="submit"]');
      await puppPage.waitForTimeout(4000);
      logger.info('Quotex puppeteer login attempted');
    } catch (e) {
      logger.debug('Quotex puppeteer login selectors may differ: ' + e.message);
    }
    connected = true;
    return true;
  } catch (e) {
    logger.error('Quotex adapter puppeteer init failed: ' + e.message);
    try { if (puppBrowser) await puppBrowser.close(); } catch (_) { }
    connected = false;
    return false;
  }
}

async function fetchRecentCandles(pair = 'EUR/USD', count = 600) {
  // If external feed present, build candles from ticks
  if (wsFeed) {
    const arr = (ticks[pair] || []).slice(-count);
    // convert tick array into 1s pseudo-candle array
    const res = [];
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i];
      res.push({ time: t.ts, open: t.price, high: t.price, low: t.price, close: t.price, volume: 1 });
    }
    if (res.length === 0) throw new Error('No external feed data for ' + pair);
    return res;
  }
  // Puppeteer mode - attempt to read in-page chart data
  if (!puppPage) throw new Error('Quotex not connected (puppeteer not available)');
  try {
    const data = await puppPage.evaluate((pairStr, cnt) => {
      try {
        // site internals vary — this is a best-effort
        if (window.__chartData && window.__chartData[pairStr]) {
          const arr = window.__chartData[pairStr].slice(-cnt);
          return arr.map(x => ({ time: x.t || Date.now(), open: x.o || x.open, high: x.h || x.high, low: x.l || x.low, close: x.c || x.close, volume: x.v || 1 }));
        }
        // fallback: attempt to read series from global Chart widget
        if (window.chart && window.chart.series && window.chart.series[0] && window.chart.series[0].data) {
          const arr = window.chart.series[0].data.slice(-cnt);
          return arr.map(x => ({ time: x[0] || Date.now(), open: x[1], high: x[2], low: x[3], close: x[4], volume: 1 }));
        }
      } catch (e) { }
      return null;
    }, pair, count);
    if (!data) throw new Error('DOM chart data not found for ' + pair);
    return data;
  } catch (e) {
    throw new Error('fetchRecentCandles error: ' + e.message);
  }
}

async function close() {
  if (wsFeed) try { wsFeed.close(); } catch (_) { }
  if (puppBrowser) try { await puppBrowser.close(); } catch (_) { }
  connected = false;
}

module.exports = { init, fetchRecentCandles, close, isConnected: () => connected };
