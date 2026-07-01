const axios = require('axios');
const config = require('../config');

const http = axios.create({
  timeout: config.collect.timeoutMs,
  headers: { 'User-Agent': 'AI-Cost-Monitor/1.0 (+https://localhost)' },
  // 不因 4xx/5xx 抛错以便自定义处理
  validateStatus: () => true,
});

module.exports = http;
