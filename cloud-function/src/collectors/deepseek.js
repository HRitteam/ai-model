const { BaseCollector } = require('./base');
const http = require('../utils/http');
const config = require('../config');

// DeepSeek 余额采集器：GET https://api.deepseek.com/user/balance
class DeepSeekCollector extends BaseCollector {
  isConfigured() {
    return !!config.deepseek.apiKey;
  }

  async collect() {
    this.ensureConfigured();
    const url = `${config.deepseek.baseUrl}/user/balance`;
    const resp = await http.get(url, {
      headers: { Authorization: `Bearer ${config.deepseek.apiKey}` },
    });
    if (resp.status !== 200) {
      throw new Error(`DeepSeek 接口返回 HTTP ${resp.status}: ${JSON.stringify(resp.data).slice(0, 200)}`);
    }
    const data = resp.data || {};
    const info = data.balance_infos && data.balance_infos[0];
    if (!info || info.total_balance === undefined) {
      throw new Error('DeepSeek 返回缺少 balance_infos[0].total_balance');
    }
    const balance = this.applyDivisor(parseFloat(info.total_balance));
    const currency = info.currency || 'CNY';
    return { balance, currency, consumed: null, raw: data };
  }
}

module.exports = DeepSeekCollector;
