const config = require('../config');

function fmtTime(d) {
  return new Date(d).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

// 构造邮件模板变量（对应 SendCloud model_api_balance_warning 模板的 {{xxx}}）
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

// 构造阿里云 DirectMail 用的完整 HTML 邮件正文
// vars: buildMailVars 的返回值
function buildAlertHtml(vars) {
  const isRed = vars.alert_level === '红色';
  const mainColor = isRed ? '#dc3545' : '#ffc107';
  const bg = isRed ? '#fff5f5' : '#fffbea';
  const levelText = vars.alert_level + '告警';
  const balanceNum = parseFloat(vars.balance) || 0;
  const thresholdNum = parseFloat(vars.threshold) || 0;
  const gap = (balanceNum - thresholdNum).toFixed(2);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${levelText}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Microsoft YaHei','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- 顶部色条 -->
          <tr>
            <td style="background:${mainColor};padding:18px 28px;">
              <span style="color:#ffffff;font-size:18px;font-weight:bold;">⚠️ AI 费用监控 · ${levelText}</span>
            </td>
          </tr>
          <!-- 正文 -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333;">您好，以下平台的 API 余额已触发告警阈值，请及时处理：</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid ${mainColor};border-radius:6px;margin:16px 0;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;width:100px;">平台名称</td>
                        <td style="padding:6px 0;font-size:14px;color:#222;font-weight:bold;">${escapeHtml(vars.platform_name)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">当前余额</td>
                        <td style="padding:6px 0;font-size:22px;color:${mainColor};font-weight:bold;">${escapeHtml(vars.balance)} ${escapeHtml(vars.currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">告警阈值</td>
                        <td style="padding:6px 0;font-size:14px;color:#222;">${escapeHtml(vars.threshold)} ${escapeHtml(vars.currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">告警级别</td>
                        <td style="padding:6px 0;font-size:14px;color:${mainColor};font-weight:bold;">${escapeHtml(vars.alert_level)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">差额</td>
                        <td style="padding:6px 0;font-size:14px;color:#222;">${gap} ${escapeHtml(vars.currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">检测时间</td>
                        <td style="padding:6px 0;font-size:14px;color:#222;">${escapeHtml(vars.check_time)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 8px;font-size:14px;color:#333;">${isRed ? '🔴 红色告警将每 6 小时重复提醒，直至余额回升。' : '🟡 黄色告警仅提醒一次，余额回升后可再次触发。'}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="background:${mainColor};border-radius:4px;">
                    <a href="${escapeHtml(vars.dashboard_url)}" target="_blank" style="display:inline-block;padding:10px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">查看监控面板</a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;">本邮件由 AI 费用监控系统自动发送 · 发送时间：${escapeHtml(vars.send_time)}<br/>请勿直接回复此邮件。</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 构造合并告警邮件 HTML（多个平台汇总到一封邮件）
// alertItems: [{ platform, level, balance, threshold }]
function buildMergedAlertHtml(alertItems, dashboardUrl) {
  const now = fmtTime(new Date());
  const hasRed = alertItems.some(it => it.level === 'red');
  const hasYellow = alertItems.some(it => it.level === 'yellow');
  const mainColor = hasRed ? '#dc3545' : '#ffc107';
  const bg = hasRed ? '#fff5f5' : '#fffbea';
  const titleLevel = hasRed ? (hasYellow ? '红色+黄色' : '红色') : '黄色';

  // 表格行
  const rows = alertItems.map((it, i) => {
    const lvColor = it.level === 'red' ? '#dc3545' : '#ffc107';
    const lvText = it.level === 'red' ? '红色' : '黄色';
    const balance = parseFloat(it.balance) || 0;
    const threshold = parseFloat(it.threshold) || 0;
    const gap = (balance - threshold).toFixed(2);
    const cur = it.platform.currency || 'CNY';
    return `<tr style="background:${i % 2 === 0 ? '#fafbfc' : '#ffffff'};">
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:bold;color:#222;">${escapeHtml(it.platform.name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:${lvColor};font-weight:bold;">${lvText}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:${lvColor};font-size:16px;font-weight:bold;">${escapeHtml(String(it.balance))} ${escapeHtml(cur)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;">${escapeHtml(String(it.threshold))} ${escapeHtml(cur)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;">${gap} ${escapeHtml(cur)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI费用监控 · 合并告警(${titleLevel})</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Microsoft YaHei','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${mainColor};padding:18px 28px;">
              <span style="color:#ffffff;font-size:18px;font-weight:bold;">⚠️ AI 费用监控 · 合并告警（${escapeHtml(titleLevel)}）</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333;">您好，本轮采集共 <b>${alertItems.length}</b> 个平台触发告警，汇总如下：</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${mainColor};border-radius:6px;overflow:hidden;margin:16px 0;">
                <tr style="background:${bg};">
                  <td style="padding:10px 12px;font-size:13px;color:#555;font-weight:bold;border-bottom:1px solid ${mainColor};">平台名称</td>
                  <td style="padding:10px 12px;font-size:13px;color:#555;font-weight:bold;border-bottom:1px solid ${mainColor};">告警级别</td>
                  <td style="padding:10px 12px;font-size:13px;color:#555;font-weight:bold;border-bottom:1px solid ${mainColor};">当前余额</td>
                  <td style="padding:10px 12px;font-size:13px;color:#555;font-weight:bold;border-bottom:1px solid ${mainColor};">告警阈值</td>
                  <td style="padding:10px 12px;font-size:13px;color:#555;font-weight:bold;border-bottom:1px solid ${mainColor};">差额</td>
                </tr>
                ${rows}
              </table>

              <p style="margin:18px 0 8px;font-size:13px;color:#666;">${hasRed ? '🔴 含红色告警平台，将按设定间隔重复提醒。' : '🟡 均为黄色告警，仅提醒一次。'}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="background:${mainColor};border-radius:4px;">
                    <a href="${escapeHtml(dashboardUrl)}" target="_blank" style="display:inline-block;padding:10px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">查看监控面板</a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;">本邮件由 AI 费用监控系统自动发送 · 发送时间：${escapeHtml(now)}<br/>合并告警：每 6 小时最多发送一次。请勿直接回复此邮件。</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 构造合并短信内容（SendCloud 短信模板变量，把多平台拼成一段文字）
// 返回 vars 对象：{ platform_list, count, worst_level, url }
function buildMergedSmsContent(alertItems, dashboardUrl) {
  const count = alertItems.length;
  const hasRed = alertItems.some(it => it.level === 'red');
  const worstLevel = hasRed ? '红色' : '黄色';
  const list = alertItems.map(it =>
    `${it.platform.name}(${it.balance})`
  ).join('、').slice(0, 120); // 短信长度限制
  return {
    platform_list: list,
    count: String(count),
    worst_level: worstLevel,
    url: dashboardUrl,
  };
}

module.exports = { buildMailVars, buildSmsVars, buildAlertHtml, buildMergedAlertHtml, buildMergedSmsContent, fmtTime, escapeHtml };
