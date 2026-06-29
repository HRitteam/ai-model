const { BaseCollector } = require('./base');
const http = require('../utils/http');
const config = require('../config');

// OpenAI-Hub 余额采集器：GET https://api.openai-hub.com/api/user/self
// 认证：Authorization=<token>(不带Bearer) + New-Api-User=<userId>
// 返回 data.quota(剩余余额原始值) / data.used_quota(历史累计消耗)
// 注意：quota 本身就是"剩余可用额度"，不需要再减去 used_quota
class OpenAIHubCollector extends BaseCollector {
  isConfigured() {
    return !!(config.openaihub.token && config.openaihub.userId);
  }

  async collect() {
    this.ensureConfigured();
    const url = `${config.openaihub.baseUrl}/api/user/self`;
    const resp = await http.get(url, {
      headers: {
        Authorization: config.openaihub.token,
        'New-Api-User': config.openaihub.userId,
      },
    });
    if (resp.status !== 200 || !resp.data || !resp.data.success) {
      throw new Error(`OpenAI-Hub 接口返回 HTTP ${resp.status}: ${JSON.stringify(resp.data).slice(0, 200)}`);
    }
    const d = resp.data.data || {};
    // quota = 剩余余额（原始单位），直接使用，不扣减 used_quota
    const remain = Number(d.quota || 0);
    const used = Number(d.used_quota || 0);
    const balance = this.applyDivisor(remain);
    return {
      balance,
      currency: 'CNY',
      consumed: this.applyDivisor(used),
      raw: resp.data,
    };
  }
}

module.exports = OpenAIHubCollector;
