const { BaseCollector } = require('./base');
const http = require('../utils/http');
const { CredentialMissingError, CookieExpiredError } = require('../utils/errors');
const { getJsonPath } = require('../utils/crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 通用 Cookie 抓包采集器（智谱/MiniMax 共用）
// 配置：{ url, cookie, balanceField, currencyField, extraHeaders }
class GenericCookieCollector extends BaseCollector {
  constructor(platform, opts = {}) {
    super(platform);
    this.opts = opts;
    this.balanceField = opts.balanceField || platform.balance_field || 'data.balance';
  }

  isConfigured() {
    return !!(this.opts.url && this.opts.cookie);
  }

  async collect() {
    if (!this.isConfigured()) throw new CredentialMissingError(this.platform.code);

    const headers = {
      Cookie: this.opts.cookie,
      'User-Agent': UA,
      Referer: this.opts.url,
    };
    if (this.opts.extraHeaders) {
      try { Object.assign(headers, JSON.parse(this.opts.extraHeaders)); } catch (_) {}
    }

    const resp = await http.get(this.opts.url, { headers });

    // Cookie 过期检测：401/403 或返回 HTML 登录页
    if (resp.status === 401 || resp.status === 403) {
      throw new CookieExpiredError(this.platform.code);
    }
    const ct = resp.headers['content-type'] || '';
    if (ct.includes('text/html')) {
      throw new CookieExpiredError(this.platform.code);
    }

    const raw = resp.data;
    const bal = getJsonPath(raw, this.balanceField);
    if (bal === undefined || bal === null) {
      throw new Error(`${this.platform.code} 未取到余额字段 ${this.balanceField}，响应: ${JSON.stringify(raw).slice(0, 200)}`);
    }
    const balance = this.applyDivisor(parseFloat(bal));
    const currency =
      (this.opts.currencyField && getJsonPath(raw, this.opts.currencyField)) ||
      this.platform.currency ||
      'CNY';
    return { balance, currency, consumed: null, raw };
  }
}

module.exports = { GenericCookieCollector, UA };
