const { BaseCollector } = require('./base');
const http = require('../utils/http');
const config = require('../config');

// OpenAI-Hub 余额采集器：GET https://api.openai-hub.com/api/user/self
// 认证：Authorization=<token>(不带Bearer) + New-Api-User=<userId>
// 返回 data.quota(总额度) / data.used_quota(已用)，剩余 = quota - used_quota
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
    const quota = Number(d.quota || 0);
    const used = Number(d.used_quota || 0);
    const remain = quota - used;
    const balance = this.applyDivisor(remain);
    return {
      balance,
      currency: this.platform.currency || 'quota',
      consumed: used,
      raw: resp.data,
    };
  }
}

module.exports = OpenAIHubCollector;
