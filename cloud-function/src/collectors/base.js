const { CredentialMissingError } = require('../utils/errors');

// 采集器抽象基类：统一接口与换算逻辑
class BaseCollector {
  constructor(platform) {
    // platform = platforms 表行 {id, code, name, collect_type, currency, balance_divisor, balance_field, ...}
    this.platform = platform;
  }

  // 子类实现：凭证是否齐全
  isConfigured() {
    return false;
  }

  // 子类实现：执行采集，返回 { balance, currency, consumed, raw }
  async collect() {
    throw new Error(`${this.platform.code} 采集器未实现 collect()`);
  }

  // 应用 platforms.balance_divisor 换算系数
  applyDivisor(value) {
    const d = parseFloat(this.platform.balance_divisor) || 1;
    return Number(value) / d;
  }

  // 凭证缺失快捷抛错
  ensureConfigured() {
    if (!this.isConfigured()) throw new CredentialMissingError(this.platform.code);
  }
}

module.exports = { BaseCollector };
