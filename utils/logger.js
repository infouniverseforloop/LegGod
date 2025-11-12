// utils/logger.js
const chalk = require('chalk');
function ts() { return new Date().toISOString().replace('T', ' ').split('.')[0]; }
function info(m) { console.log(chalk.cyan(`[${ts()}] [INFO] ${m}`)); }
function warn(m) { console.log(chalk.yellow(`[${ts()}] [WARN] ${m}`)); }
function error(m) { console.error(chalk.red(`[${ts()}] [ERROR] ${m}`)); }
function debug(m) { if ((process.env.DEBUG || 'false') === 'true') console.log(chalk.gray(`[${ts()}] [DEBUG] ${m}`)); }
module.exports = { info, warn, error, debug };
