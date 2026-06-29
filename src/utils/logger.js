const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || (require('../config').logLevel)] ?? LEVELS.info;

function stringify(args) {
  return args.map(a => (a instanceof Error ? a.stack : (typeof a === 'object' ? safeJson(a) : String(a)))).join(' ');
}
function safeJson(o) { try { return JSON.stringify(o); } catch { return String(o); } }
function fmt(level, msg) { return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`; }

function append(line) {
  try { fs.appendFileSync(path.join(LOG_DIR, 'app.log'), line + '\n'); } catch (_) {}
}

const logger = {
  error: (...a) => { const l = fmt('error', stringify(a)); console.error('\x1b[31m' + l + '\x1b[0m'); append(l); },
  warn:  (...a) => { const l = fmt('warn', stringify(a)); console.warn('\x1b[33m' + l + '\x1b[0m'); append(l); },
  info:  (...a) => { const l = fmt('info', stringify(a)); console.log('\x1b[36m' + l + '\x1b[0m'); append(l); },
  debug: (...a) => { if (currentLevel >= LEVELS.debug) { const l = fmt('debug', stringify(a)); console.log(l); } },
};

module.exports = logger;
