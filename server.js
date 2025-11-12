// server.js — Main backend controller
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const logger = require('./utils/logger');
const master = require('./core/masterOverseer');
const telegram = require('./telegram/telegramBot');
const autoTimeSync = require('./utils/autoTimeSync');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

// simple health and data endpoints used by frontend
app.get('/health', (req, res) => res.json({ ok: true, server_time: new Date().toISOString() }));
app.get('/data', (req, res) => {
  const db = require('./utils/db');
  res.json(db.readAll());
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  logger.info('WS client connected');
  master.registerFrontend(ws);
  ws.on('close', () => logger.info('WS client disconnected'));
});

async function init() {
  logger.info('Starting Quantum Apex...');
  // start Telegram
  if ((process.env.TELEGRAM_ENABLED || 'true') === 'true') {
    try {
      telegram.init();
    } catch (e) { logger.warn('Telegram init failed: ' + e.message); }
  }
  // start time sync
  autoTimeSync.start();
  // start master overseer
  await master.init();
  master.registerWebSocketServer(wss);
  master.startScanLoop();
}

const PORT = parseInt(process.env.PORT || '5000', 10);
server.listen(PORT, () => {
  logger.info(`Quantum Apex listening on ${PORT}`);
  init().catch(e => logger.error('Init error: ' + e.message));
});
