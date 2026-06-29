const { BaseCollector } = require('./base');
const http = require('../utils/http');
const config = require('../config');
const { CredentialMissingError, CookieExpiredError } = require('../utils/errors');
const { getJsonPath } = require('../utils/crypto');
const { UA } = require('./genericCookie');

// 智谱AI 采集器：优先 Cookie 抓包现金余额，备选 Coding Plan 配额百分比
class ZhipuCollector extends BaseCollector {
  isConfigured() {
    return !!((config.zhipu.balanceUrl && config.zhipu.cookie) || config.zhipu.token);
  }

  async collect() {
    this.ensureConfigured();
    if (config.zhipu.balanceUrl && config.zhipu.cookie) return this._byCookie();
    if (config.zhipu.token) return this._byQuota();
    throw new CredentialMissingError('zhipu');
  }

  // 现金余额模式（抓包网页接口 + Cookie）
  async _byCookie() {
    const headers = {
      Cookie: config.zhipu.cookie,
      'User-Agent': UA,
      Referer: config.zhipu.balanceUrl,
    };
    if (config.zhipu.extraHeaders) {
      try { Object.assign(headers, JSON.parse(config.zhipu.extraHeaders)); } catch (_) {}
    }
    const resp = await http.get(config.zhipu.balanceUrl, { headers });
    if (resp.status === 401 || resp.status === 403) throw new CookieExpiredError('zhipu');
    if ((resp.headers['content-type'] || '').includes('text/html')) throw new CookieExpiredError('zhipu');
    const bal = getJsonPath(resp.data, config.zhipu.balanceField);
    if (bal == null) {
      throw new Error(`智谱未取到余额字段 ${config.zhipu.balanceField}，响应: ${JSON.stringify(resp.data).slice(0, 200)}`);
    }
    return { balance: this.applyDivisor(parseFloat(bal)), currency: 'CNY', consumed: null, raw: resp.data };
  }

  // Coding Plan 配额模式（备选）：返回剩余百分比
  async _byQuota() {
    const resp = await http.get(config.zhipu.quotaUrl, {
      headers: { Authorization: config.zhipu.token },
    });
    if (resp.status !== 200) throw new Error(`智谱配额接口 HTTP ${resp.status}`);
    const limits = resp.data && resp.data.data && resp.data.data.limits;
    if (!limits || !limits.length) throw new Error('智谱配额接口无 limits');
    const usedPct = parseFloat(limits[0].percentage || 0);
    const remainPct = 100 - usedPct;
    return { balance: remainPct, currency: '%', consumed: usedPct, raw: resp.data };
  }
}

module.exports = ZhipuCollector;
