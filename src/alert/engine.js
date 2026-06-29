const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const { notify } = require('./notifier');
const { getState, buildAlertKey, isAlertKeySent } = require('./dedup');

// 读取 settings 表为 KV 对象
async function getSettings() {
  const [rows] = await pool.query("SELECT * FROM settings");
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

// 评估所有采集成功的平台
// collectedResults: [{ platform, balance, status }]
async function evaluateAll(collectedResults) {
  const settings = await getSettings();
  for (const item of collectedResults) {
    try {
      await evaluate(item.platform, item.balance, settings);
    } catch (e) {
      logger.error(`告警评估异常 ${item.platform.code}:`, e.message);
    }
  }
}

// 评估单平台：算出新等级并走状态机
async function evaluate(platform, balance, settings) {
  const yellowTh = platform.yellow_threshold != null
    ? parseFloat(platform.yellow_threshold)
    : parseFloat(settings.yellow_threshold || 500);
  const redTh = platform.red_threshold != null
    ? parseFloat(platform.red_threshold)
    : parseFloat(settings.red_threshold || 200);
  const redRepeatHours = parseInt(settings.red_repeat_hours || 6);

  let newLevel;
  if (balance >= yellowTh) newLevel = 'normal';
  else if (balance >= redTh) newLevel = 'yellow';
  else newLevel = 'red';

  const state = await getState(platform.id);
  await transition(platform, state, newLevel, balance, yellowTh, redTh, redRepeatHours, settings);
}

// 状态转换 + 去重决策（核心逻辑）
// 先发送、成功后才更新状态标志位；alert_key 双保险兜底并发/抖动重复
async function transition(platform, state, newLevel, balance, yellowTh, redTh, redRepeatHours, settings) {
  const now = new Date();

  // 回升正常区：重置整个状态机
  if (newLevel === 'normal') {
    await pool.query(
      "UPDATE alert_state SET current_level='normal', yellow_sent=0, yellow_sent_at=NULL, red_last_sent_at=NULL, red_sent_count=0, last_eval_at=? WHERE platform_id=?",
      [now, platform.id]
    );
    logger.info(`⊙ ${platform.code} 余额回升正常(${balance})，状态机已重置`);
    return;
  }

  // 黄色告警：一次性（yellow_sent 标志位）
  if (newLevel === 'yellow') {
    if (Number(state.yellow_sent) === 1) {
      await pool.query("UPDATE alert_state SET current_level='yellow', last_eval_at=? WHERE platform_id=?", [now, platform.id]);
      return; // 已发过，不重复
    }
    const alertKey = buildAlertKey(platform.code, 'yellow', redRepeatHours);
    if (await isAlertKeySent(alertKey)) {
      // 双保险：历史上已成功发过此 key，同步状态
      await pool.query("UPDATE alert_state SET current_level='yellow', yellow_sent=1, last_eval_at=? WHERE platform_id=?", [now, platform.id]);
      return;
    }
    logger.info(`⚡ ${platform.code} 触发黄色告警: 余额 ${balance} < ${yellowTh}`);
    const results = await notify(platform, 'yellow', balance, yellowTh, alertKey, settings);
    if (results.some(r => r.status === 'success')) {
      await pool.query("UPDATE alert_state SET current_level='yellow', yellow_sent=1, yellow_sent_at=?, last_eval_at=? WHERE platform_id=?", [now, now, platform.id]);
    } else {
      // 全部失败：不置 yellow_sent，下次采集重试
      await pool.query("UPDATE alert_state SET current_level='yellow', last_eval_at=? WHERE platform_id=?", [now, platform.id]);
    }
    return;
  }

  // 红色告警：每 redRepeatHours 小时重复（red_last_sent_at 间隔判断）
  if (newLevel === 'red') {
    const lastSent = state.red_last_sent_at ? new Date(state.red_last_sent_at) : null;
    const needRepeat = !lastSent || (now - lastSent) >= redRepeatHours * 3600 * 1000;
    if (!needRepeat) {
      await pool.query("UPDATE alert_state SET current_level='red', last_eval_at=? WHERE platform_id=?", [now, platform.id]);
      return; // 未满间隔，不重复
    }
    const alertKey = buildAlertKey(platform.code, 'red', redRepeatHours);
    if (await isAlertKeySent(alertKey)) {
      // 同窗口已成功发过，跳过
      await pool.query("UPDATE alert_state SET current_level='red', last_eval_at=? WHERE platform_id=?", [now, platform.id]);
      return;
    }
    logger.info(`⚡ ${platform.code} 触发红色告警: 余额 ${balance} < ${redTh}`);
    const results = await notify(platform, 'red', balance, redTh, alertKey, settings);
    if (results.some(r => r.status === 'success')) {
      await pool.query("UPDATE alert_state SET current_level='red', red_last_sent_at=?, red_sent_count=red_sent_count+1, last_eval_at=? WHERE platform_id=?", [now, now, platform.id]);
    } else {
      await pool.query("UPDATE alert_state SET current_level='red', last_eval_at=? WHERE platform_id=?", [now, platform.id]);
    }
    return;
  }
}

module.exports = { evaluateAll, evaluate, getSettings, transition };
