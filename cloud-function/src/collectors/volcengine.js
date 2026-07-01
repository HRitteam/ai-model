const { BaseCollector } = require('./base');
const http = require('../utils/http');
const config = require('../config');
const { CredentialMissingError } = require('../utils/errors');
const { hmacSha256Hex, hmacSha256Buf, sha256Hex } = require('../utils/crypto');

// 火山引擎余额采集器：QueryBalanceAcct（手动实现 V4 签名）
const HOST = 'open.volcengineapi.com';
const SERVICE = 'billing';
const ACTION = 'QueryBalanceAcct';
const VERSION = '2022-01-01';

function utcDateTime(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}

class VolcEngineCollector extends BaseCollector {
  isConfigured() {
    return !!(config.volc.ak && config.volc.sk);
  }

  async collect() {
    this.ensureConfigured();
    const { ak, sk } = config.volc;
    const region = config.volc.region;

    const now = new Date();
    const xDate = utcDateTime(now);
    const shortDate = xDate.slice(0, 8);

    // 1. CanonicalQueryString（参数按名排序，值 URL 编码）
    const queryParams = { Action: ACTION, Version: VERSION };
    const canonicalQuery = Object.keys(queryParams).sort()
      .map(k => `${k}=${encodeURIComponent(queryParams[k])}`).join('&');

    // 2. 请求体哈希（GET 无 body）
    const payloadHash = sha256Hex('');

    // 3. CanonicalHeaders（按 header 名小写排序）
    const headersForSign = {
      'content-type': 'application/x-www-form-urlencoded',
      'host': HOST,
      'x-content-sha256': payloadHash,
      'x-date': xDate,
    };
    const signedHeaders = Object.keys(headersForSign).sort().join(';');
    const canonicalHeaders = Object.keys(headersForSign).sort()
      .map(k => `${k}:${headersForSign[k]}\n`).join('');

    // 4. CanonicalRequest
    const canonicalRequest = ['GET', '/', canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');

    // 5. StringToSign
    const credentialScope = `${shortDate}/${region}/${SERVICE}/request`;
    const stringToSign = ['HMAC-SHA256', xDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

    // 6. 派生签名密钥 + 签名（每步用 Buffer 作为 key，不能用 hex 字符串）
    const kDate = hmacSha256Buf(sk, shortDate);
    const kRegion = hmacSha256Buf(kDate, region);
    const kService = hmacSha256Buf(kRegion, SERVICE);
    const kSigning = hmacSha256Buf(kService, 'request');
    const signature = hmacSha256Hex(kSigning, stringToSign);

    const authorization = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // 7. 发起请求
    const url = `https://${HOST}/?${canonicalQuery}`;
    const resp = await http.get(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Date': xDate,
        'X-Content-Sha256': payloadHash,
        Authorization: authorization,
      },
    });

    const data = resp.data || {};
    if (data.ResponseMetadata && data.ResponseMetadata.Error) {
      throw new Error(`火山引擎 API 错误: ${JSON.stringify(data.ResponseMetadata.Error)}`);
    }
    if (resp.status !== 200 || !data.Result) {
      throw new Error(`火山引擎接口返回 HTTP ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    const balance = this.applyDivisor(parseFloat(data.Result.AvailableBalance));
    return { balance, currency: 'CNY', consumed: null, raw: data };
  }
}

module.exports = VolcEngineCollector;
