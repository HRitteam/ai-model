const config = require('../config');

function fmtTime(d) {
  return new Date(d).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

// 构造邮件模板变量（对应 model_api_balance_warning 模板的 {{xxx}}）
function buildMailVars(platform, level, balance, threshold, checkTime) {
  const isRed = level === 'red';
  return {
    platform_name: platform.name,
    threshold: String(threshold),
    balance: String(balance),
    currency: platform.currency || 'CNY',
    // 红色: alert_class 空(默认danger样式); 黄色: warning
    alert_class: isRed ? '' : 'warning',
    alert_level: isRed ? '红色' : '黄色',
    balance_class: isRed ? 'danger' : 'warning',
    check_time: checkTime || fmtTime(new Date()),
    dashboard_url: config.dashboardUrl,
    send_time: fmtTime(new Date()),
  };
}

// 构造短信模板变量
function buildSmsVars(platform, level, balance, threshold) {
  return {
    platform_name: platform.name,
    threshold: String(threshold),
    balance: String(balance),
    url: config.dashboardUrl,
  };
}

module.exports = { buildMailVars, buildSmsVars, fmtTime };
