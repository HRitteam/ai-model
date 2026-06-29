const { GenericCookieCollector } = require('./genericCookie');
const config = require('../config');

// MiniMax 采集器：基于通用 Cookie 采集器，配置从 .env 注入
function createMinimaxCollector(platform) {
  return new GenericCookieCollector(platform, {
    url: config.minimax.balanceUrl,
    cookie: config.minimax.cookie,
    balanceField: platform.balance_field || config.minimax.balanceField,
    currencyField: config.minimax.currencyField,
    extraHeaders: config.minimax.extraHeaders,
  });
}

module.exports = { createMinimaxCollector };
