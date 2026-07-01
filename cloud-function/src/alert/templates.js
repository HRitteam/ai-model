const config = require('../config');

function fmtTime(d) {
  return new Date(d).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
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

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function getMonitorLabel() {
  return `${config.brandName}「${config.appName}」`;
}

function getAlertLevelText(level) {
  if (level === 'red') return '红色';
  if (level === 'yellow') return '黄色';
  if (level === 'normal') return '绿色';
  return String(level || '未知');
}

function getDashboardUrl(overrideUrl) {
  return overrideUrl || config.dashboardUrl;
}

function ensureHttps(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url.replace(/^http:\/\//i, 'https://');
  return `https://${url}`;
}

function getHostText(url) {
  try {
    return new URL(url).host;
  } catch (_) {
    return url || '';
  }
}

function getLevelStyle(level) {
  if (level === 'red') {
    return {
      accent: '#ff5f57',
      accentSoft: 'rgba(255,95,87,0.12)',
      glow: 'rgba(255,95,87,0.22)',
      title: '余额不足提醒',
      summary: '已触发红色余额告警，请及时处理，避免服务中断。',
      badge: '红色告警',
    };
  }
  if (level === 'yellow') {
    return {
      accent: '#ffb020',
      accentSoft: 'rgba(255,176,32,0.14)',
      glow: 'rgba(255,176,32,0.18)',
      title: '余额不足提醒',
      summary: '已触发黄色余额告警，请尽快关注余额变化。',
      badge: '黄色告警',
    };
  }
  return {
    accent: '#3fb950',
    accentSoft: 'rgba(63,185,80,0.14)',
    glow: 'rgba(63,185,80,0.18)',
    title: '当前余额通知',
    summary: '当前余额充足，现将最新余额情况同步给你。',
    badge: '绿色通知',
  };
}

function buildMailVars(platform, level, balance, threshold, checkTime, dashboardUrl) {
  const resolvedUrl = ensureHttps(getDashboardUrl(dashboardUrl));
  const style = getLevelStyle(level);
  return {
    platform_name: platform.name,
    threshold: formatAmount(threshold),
    balance: formatAmount(balance),
    currency: platform.currency || 'CNY',
    level,
    alert_level: getAlertLevelText(level),
    check_time: checkTime || fmtTime(new Date()),
    dashboard_url: resolvedUrl,
    dashboard_host: resolvedUrl,
    send_time: fmtTime(new Date()),
    brand_name: config.brandName,
    app_name: config.appName,
    monitor_label: getMonitorLabel(),
    repeat_hint: level === 'red'
      ? `红色告警会按 ${config.alert.redRepeatHours} 小时间隔重复提醒，直到余额恢复。`
      : level === 'yellow'
        ? '黄色告警仅提醒一次，余额恢复后会重新进入监控。'
        : '这是一次手动发送的当前余额通知，可用于同步平台最新余额状态。',
    headline_title: style.title,
    headline_summary: `${platform.name} ${style.summary}`,
    badge_text: style.badge,
    accent: style.accent,
    accent_soft: style.accentSoft,
    glow: style.glow,
  };
}

function buildSmsVars(platform, level, balance, threshold, dashboardUrl) {
  const displayName = platform && platform.name ? platform.name : platform && platform.code ? platform.code : '';
  const platformName = String(displayName).slice(0, 16);
  const balanceText = formatAmount(balance).slice(0, 16);

  return {
    var1: platformName,
    var3: balanceText,
    '%var1%': platformName,
    '%var3%': balanceText,
  };
}

function buildAlertSubject(vars) {
  if (vars.level === 'normal') {
    return `【${vars.brand_name}】「${vars.app_name}」${vars.platform_name}当前余额${vars.balance}元`;
  }
  return `【${vars.brand_name}】「${vars.app_name}」${vars.platform_name}余额不足${vars.threshold}元，当前余额${vars.balance}元`;
}

function buildMergedAlertSubject(alertItems) {
  const hasRed = alertItems.some(it => it.level === 'red');
  const titleLevel = hasRed ? '红色/黄色' : '黄色';
  return `【${config.brandName}】「${config.appName}」${alertItems.length}个平台触发${titleLevel}余额告警`;
}

function buildAlertHtml(vars) {
  const gap = (Number(vars.balance) - Number(vars.threshold)).toFixed(2);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(vars.monitor_label)} ${escapeHtml(vars.headline_title)}</title>
</head>
<body style="margin:0;padding:0;background:#07111f;font-family:'Microsoft YaHei','PingFang SC','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at top,#16345f 0%,#07111f 58%,#040a14 100%);padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#0b1628;border:1px solid rgba(110,168,255,0.18);border-radius:18px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,0.42);">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#102a4f 0%,#0a1830 100%);border-bottom:1px solid rgba(110,168,255,0.16);">
              <div style="font-size:12px;line-height:1;color:#8cb8ff;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(vars.brand_name)}</div>
              <div style="margin-top:10px;font-size:24px;line-height:1.35;color:#f4f8ff;font-weight:700;">${escapeHtml(vars.monitor_label)}</div>
              <div style="margin-top:10px;font-size:14px;line-height:1.7;color:#9db4d3;">${escapeHtml(vars.headline_summary)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,rgba(18,32,56,0.96) 0%,rgba(9,18,33,0.96) 100%);border:1px solid rgba(110,168,255,0.14);border-radius:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02),0 10px 30px ${vars.glow};">
                <tr>
                  <td style="padding:24px 24px 18px;">
                    <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${vars.accent_soft};border:1px solid ${vars.accent};font-size:12px;line-height:1.2;color:${vars.accent};font-weight:700;">${escapeHtml(vars.badge_text)}</div>
                    <div style="margin-top:18px;font-size:14px;color:#8fa7c8;">当前余额</div>
                    <div style="margin-top:8px;font-size:34px;line-height:1.1;color:${vars.accent};font-weight:800;text-shadow:0 0 24px ${vars.glow};">${escapeHtml(vars.balance)} <span style="font-size:16px;color:#c8d8f0;font-weight:600;">${escapeHtml(vars.currency)}</span></div>
                    <div style="margin-top:18px;height:1px;background:linear-gradient(90deg,rgba(110,168,255,0.22),rgba(110,168,255,0));"></div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8fa7c8;">参考阈值</td>
                        <td align="right" style="padding:8px 0;font-size:14px;color:#eef4ff;font-weight:600;">${escapeHtml(vars.threshold)} ${escapeHtml(vars.currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8fa7c8;">差额</td>
                        <td align="right" style="padding:8px 0;font-size:14px;color:#eef4ff;font-weight:600;">${escapeHtml(gap)} ${escapeHtml(vars.currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8fa7c8;">检测时间</td>
                        <td align="right" style="padding:8px 0;font-size:14px;color:#eef4ff;font-weight:600;">${escapeHtml(vars.check_time)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8fa7c8;">监控地址</td>
                        <td align="right" style="padding:8px 0;font-size:14px;color:#6ea8ff;font-weight:600;">${escapeHtml(vars.dashboard_host)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="margin-top:18px;padding:14px 16px;border-radius:14px;background:rgba(110,168,255,0.08);border:1px solid rgba(110,168,255,0.12);font-size:13px;line-height:1.8;color:#c2d2ea;">
                ${escapeHtml(vars.repeat_hint)}
              </div>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#4a90d9 0%,#67b5ff 100%);box-shadow:0 10px 24px rgba(74,144,217,0.28);">
                    <a href="${escapeHtml(vars.dashboard_url)}" target="_blank" style="display:inline-block;padding:13px 24px;color:#04111f;text-decoration:none;font-size:14px;font-weight:800;">进入监控面板</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(110,168,255,0.12);font-size:12px;line-height:1.8;color:#7e95b5;">
                本邮件由 ${escapeHtml(vars.monitor_label)} 自动发送。<br/>
                发送时间：${escapeHtml(vars.send_time)}<br/>
                请勿直接回复此邮件。
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildMergedAlertHtml(alertItems, dashboardUrl) {
  const now = fmtTime(new Date());
  const hasRed = alertItems.some(it => it.level === 'red');
  const headline = hasRed ? '存在红色告警，请优先处理' : '存在黄色告警，请关注余额变化';
  const rows = alertItems.map((it, i) => {
    const levelText = getAlertLevelText(it.level);
    const levelColor = it.level === 'red' ? '#ff7a70' : '#ffc04d';
    const currency = it.platform.currency || 'CNY';
    const balance = formatAmount(it.balance);
    const threshold = formatAmount(it.threshold);
    const gap = (Number(it.balance) - Number(it.threshold)).toFixed(2);
    const bg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
    return `<tr style="background:${bg};">
      <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.08);font-size:13px;color:#eef4ff;font-weight:700;">${escapeHtml(it.platform.name)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.08);font-size:13px;color:${levelColor};font-weight:700;">${escapeHtml(levelText)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.08);font-size:13px;color:#eef4ff;">${escapeHtml(balance)} ${escapeHtml(currency)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.08);font-size:13px;color:#c2d2ea;">${escapeHtml(threshold)} ${escapeHtml(currency)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.08);font-size:13px;color:#9db4d3;">${escapeHtml(gap)} ${escapeHtml(currency)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(getMonitorLabel())} 合并告警</title>
</head>
<body style="margin:0;padding:0;background:#07111f;font-family:'Microsoft YaHei','PingFang SC','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at top,#16345f 0%,#07111f 58%,#040a14 100%);padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="700" cellpadding="0" cellspacing="0" style="width:700px;max-width:100%;background:#0b1628;border:1px solid rgba(110,168,255,0.18);border-radius:18px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,0.42);">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#102a4f 0%,#0a1830 100%);border-bottom:1px solid rgba(110,168,255,0.16);">
              <div style="font-size:12px;line-height:1;color:#8cb8ff;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(config.brandName)}</div>
              <div style="margin-top:10px;font-size:24px;line-height:1.35;color:#f4f8ff;font-weight:700;">${escapeHtml(getMonitorLabel())}</div>
              <div style="margin-top:10px;font-size:14px;line-height:1.7;color:#9db4d3;">本轮共有 ${alertItems.length} 个平台触发余额告警。${escapeHtml(headline)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(74,144,217,0.12);border:1px solid rgba(74,144,217,0.34);font-size:12px;line-height:1.2;color:#7cb5ff;font-weight:700;">告警汇总</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border:1px solid rgba(110,168,255,0.12);border-radius:16px;overflow:hidden;background:linear-gradient(180deg,rgba(18,32,56,0.96) 0%,rgba(9,18,33,0.96) 100%);box-shadow:0 10px 30px rgba(0,0,0,0.24);">
                <tr style="background:rgba(74,144,217,0.12);">
                  <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.12);font-size:12px;color:#8fa7c8;font-weight:700;">平台名称</td>
                  <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.12);font-size:12px;color:#8fa7c8;font-weight:700;">告警级别</td>
                  <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.12);font-size:12px;color:#8fa7c8;font-weight:700;">当前余额</td>
                  <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.12);font-size:12px;color:#8fa7c8;font-weight:700;">告警阈值</td>
                  <td style="padding:12px 14px;border-bottom:1px solid rgba(110,168,255,0.12);font-size:12px;color:#8fa7c8;font-weight:700;">差额</td>
                </tr>
                ${rows}
              </table>

              <div style="margin-top:18px;padding:14px 16px;border-radius:14px;background:rgba(110,168,255,0.08);border:1px solid rgba(110,168,255,0.12);font-size:13px;line-height:1.8;color:#c2d2ea;">
                红色告警会按 ${config.alert.redRepeatHours} 小时间隔重复提醒；黄色告警仅提醒一次。你也可以直接进入监控面板查看全部平台趋势和最新采集时间。
              </div>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#4a90d9 0%,#67b5ff 100%);box-shadow:0 10px 24px rgba(74,144,217,0.28);">
                    <a href="${escapeHtml(ensureHttps(getDashboardUrl(dashboardUrl)))}" target="_blank" style="display:inline-block;padding:13px 24px;color:#04111f;text-decoration:none;font-size:14px;font-weight:800;">进入监控面板</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(110,168,255,0.12);font-size:12px;line-height:1.8;color:#7e95b5;">
                本邮件由 ${escapeHtml(getMonitorLabel())} 自动发送。<br/>
                发送时间：${escapeHtml(now)}<br/>
                请勿直接回复此邮件。
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  buildMailVars,
  buildSmsVars,
  buildAlertSubject,
  buildMergedAlertSubject,
  buildAlertHtml,
  buildMergedAlertHtml,
  fmtTime,
  escapeHtml,
  ensureHttps,
};
