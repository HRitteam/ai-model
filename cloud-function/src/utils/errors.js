// 自定义错误类型
class AppError extends Error {
  constructor(message, code = 'APP_ERROR') { super(message); this.code = code; }
}

class CollectorError extends AppError {
  constructor(message, code = 'COLLECT_ERROR') { super(message, code); }
}

class CredentialMissingError extends CollectorError {
  constructor(platform) {
    super(`平台 ${platform} 凭证未配置`, 'CREDENTIAL_MISSING');
    this.platform = platform;
  }
}

class CookieExpiredError extends CollectorError {
  constructor(platform) {
    super(`平台 ${platform} Cookie 已过期，请更新`, 'COOKIE_EXPIRED');
    this.platform = platform;
  }
}

module.exports = { AppError, CollectorError, CredentialMissingError, CookieExpiredError };
