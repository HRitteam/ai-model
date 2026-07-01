const { BaseCollector } = require('./base');
const http = require('../utils/http');
const config = require('../config');

// Kimi/Moonshot 余额采集器：GET https://api.moonshot.cn/v1/users/me/balance
class KimiCollector extends BaseCollector {
  isConfigured() {
    return !!config.kimi.apiKey;
  }

  async collect() {
    this.ensureConfigured();
    const url = `${config.kimi.baseUrl}/v1/users/me/balance`;
    const resp = await http.get(url, {
      headers: { Authorization: `Bearer ${config.kimi.apiKey}` },
    });
    if (resp.status !== 200) {
      throw new Error(`Kimi 接口返回 HTTP ${resp.status}: ${JSON.stringify(resp.data).slice(0, 200)}`);
    }
    const data = resp.data || {};
    const d = data.data || {};
    const balance = this.applyDivisor(parseFloat(d.available_balance));
    return {
      balance,
      currency: 'CNY',
      consumed: d.cash_balance != null ? null : null,
      raw: data,
    };
  }
}

module.exports = KimiCollector;
