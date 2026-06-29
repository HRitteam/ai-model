const { GenericCookieCollector } = require('./genericCookie');
const config = require('../config');
const { BaseCollector } = require('./base');
const { isUsageEstimateConfigured, collectUsageEstimate } = require('./usageEstimate');

class MinimaxCollector extends BaseCollector {
  isConfigured() {
    return !!(
      isUsageEstimateConfigured(config.minimax.estimate) ||
      (config.minimax.balanceUrl && config.minimax.cookie)
    );
  }

  async collect() {
    this.ensureConfigured();
    if (isUsageEstimateConfigured(config.minimax.estimate)) {
      return collectUsageEstimate(this.platform, config.minimax.estimate);
    }

    const fallback = new GenericCookieCollector(this.platform, {
      url: config.minimax.balanceUrl,
      cookie: config.minimax.cookie,
      balanceField: this.platform.balance_field || config.minimax.balanceField,
      currencyField: config.minimax.currencyField,
      extraHeaders: config.minimax.extraHeaders,
    });
    return fallback.collect();
  }
}

// MiniMax 采集器：基于通用 Cookie 采集器，配置从 .env 注入
function createMinimaxCollector(platform) {
  return new MinimaxCollector(platform);
}

module.exports = { createMinimaxCollector };
