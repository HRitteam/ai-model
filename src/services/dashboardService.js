const { pool } = require('../db/pool');
const config = require('../config');
const { createCollector } = require('../collectors/registry');

function levelOf(balance, yellowTh, redTh) {
  if (balance == null) return 'unknown';
  if (balance >= yellowTh) return 'normal';
  if (balance >= redTh) return 'yellow';
  return 'red';
}

// 近似计算下次采集时间（支持 "m */n * * *" 形式）
function computeNextCollect(cronExpr) {
  const m = String(cronExpr).match(/^\d+\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (!m) return null;
  const n = parseInt(m[1]);
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(Math.floor(now.getHours() / n) * n + n);
  if (next <= now) next.setHours(next.getHours() + n);
  return next;
}

async function getDashboard() {
  const [platforms] = await pool.query("SELECT * FROM platforms WHERE status=1 ORDER BY display_order");
  const [sets] = await pool.query("SELECT * FROM settings");
  const settings = {};
  for (const s of sets) settings[s.key] = s.value;
  const gYellow = parseFloat(settings.yellow_threshold || 500);
  const gRed = parseFloat(settings.red_threshold || 200);

  const platformList = [];
  let okCount = 0, warnCount = 0, dangerCount = 0, unconfigCount = 0;
  let lastCollectAt = null;

  for (const p of platforms) {
    const yellowTh = p.yellow_threshold != null ? parseFloat(p.yellow_threshold) : gYellow;
    const redTh = p.red_threshold != null ? parseFloat(p.red_threshold) : gRed;
    const balance = p.last_balance != null ? parseFloat(p.last_balance) : null;
    const level = levelOf(balance, yellowTh, redTh);

    if (p.last_status === 'unconfigured' || p.last_status === 'cookie_expired') unconfigCount++;
    else if (p.last_status === 'ok') {
      if (level === 'normal') okCount++;
      else if (level === 'yellow') warnCount++;
      else if (level === 'red') dangerCount++;
    }

    if (p.last_collected_at && (!lastCollectAt || new Date(p.last_collected_at) > new Date(lastCollectAt))) {
      lastCollectAt = p.last_collected_at;
    }

    const [trend] = await pool.query(
      "SELECT balance, collected_at FROM balance_records WHERE platform_id=? AND status='ok' AND collected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY collected_at",
      [p.id]
    );

    const collector = createCollector(p);
    const isConfigured = collector ? collector.isConfigured() : false;

    platformList.push({
      id: p.id,
      code: p.code,
      name: p.name,
      currency: p.currency,
      balance,
      status: p.last_status,
      level,
      last_collected_at: p.last_collected_at,
      last_error: p.last_error,
      is_configured: isConfigured,
      yellow_threshold: yellowTh,
      red_threshold: redTh,
      trend7d: trend,
    });
  }

  const [alertsRecent] = await pool.query(
    "SELECT a.id, a.platform_id, a.alert_level, a.threshold, a.balance, a.channel, a.status, a.is_test, a.error_msg, a.sent_at, p.code, p.name FROM alert_log a LEFT JOIN platforms p ON a.platform_id=p.id ORDER BY a.sent_at DESC LIMIT 10"
  );

  const cronExpr = settings.collect_cron || config.collect.cron;

  return {
    platforms: platformList,
    summary: {
      total: platformList.length,
      ok_count: okCount,
      warning_count: warnCount,
      danger_count: dangerCount,
      unconfigured_count: unconfigCount,
      last_collect_at: lastCollectAt,
      next_collect_at: computeNextCollect(cronExpr),
    },
    alerts_recent: alertsRecent,
    settings: {
      yellow_threshold: gYellow,
      red_threshold: gRed,
      red_repeat_hours: parseInt(settings.red_repeat_hours || 6),
      collect_cron: cronExpr,
    },
  };
}

module.exports = { getDashboard, levelOf, computeNextCollect };
