const { pool } = require('../db/pool');
const logger = require('../utils/logger');
const { notify, notifyMerged } = require('./notifier');
const { getState, buildAlertKey, isAlertKeySent } = require('./dedup');

// 读取 settings 表为 KV 对象
async function getSettings() {
  const { rows } = await pool.query("SELECT * FROM settings");
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

// 评估所有采集成功的平台，根据 notify_mode 决定单发/合并发/两者都发
// collectedResults: [{ platform, balance, status }]
async function evaluateAll(collectedResults) {
  const settings = await getSettings();
  const mode = (settings.notify_mode || 'single').toLowerCase(); // single | merged | both
  const redRepeatHours = parseInt(settings.red_repeat_hours || 6);

  const okResults = collectedResults.filter(r => r.status === 'ok' && r.balance != null);
  if (!okResults.length) return;

  logger.info(`===== 告警评估开始 (模式: ${mode}) =====`);

  // single / both 模式：逐平台发送（merged 待收集）
  const mergedPending = []; // 仅 merged/both 模式收集

  for (const item of okResults) {
    try {
      const decision = await evaluateAndDecide(item.platform, item.balance, settings, redRepeatHours);

      if (decision.action === 'reset') {
        await applyReset(item.platform.id);
        logger.info(`⊙ ${item.platform.code} 余额回升正常(${item.balance})，状态机已重置`);
        continue;
      }
      if (decision.action === 'skip') {
        await applySkip(item.platform.id, decision.newLevel);
        continue;
      }

      // action === 'notify'
      if (mode === 'single' || mode === 'both') {
        // 单平台发送
        logger.info(`⚡ ${item.platform.code} 触发${decision.level === 'red' ? '红色' : '黄色'}告警: 余额 ${item.balance} < ${decision.threshold}`);
        const results = await notify(item.platform, decision.level, item.balance, decision.threshold, decision.alertKey, settings);
        if (results.some(r => r.status === 'success')) {
          await applySent(item.platform.id, decision.level, redRepeatHours);
        } else {
          await applySkip(item.platform.id, decision.newLevel);
        }
      }
      if (mode === 'merged' || mode === 'both') {
        // 收集到合并列表（merged 模式不发单条；both 模式已发单条，这里再收集用于合并）
        mergedPending.push({
          platform: item.platform,
          level: decision.level,
          balance: item.balance,
          threshold: decision.threshold,
          alertKey: decision.alertKey,
        });
      }
    } catch (e) {
      logger.error(`告警评估异常 ${item.platform.code}:`, e.message);
    }
  }

  // 合并发送
  if ((mode === 'merged' || mode === 'both') && mergedPending.length) {
    await sendMerged(mergedPending, settings, redRepeatHours);
  }

  logger.info(`===== 告警评估结束 =====`);
}

// 合并发送（带去重）
async function sendMerged(alertItems, settings, redRepeatHours) {
  // 合并去重 key：按 redRepeatHours 窗口
  const windowMs = (redRepeatHours || 6) * 3600 * 1000;
  const ws = Math.floor(Date.now() / windowMs) * windowMs;
  const d = new Date(ws);
  const p = n => String(n).padStart(2, '0');
  const mergedKey = `merged:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;

  // 检查本窗口是否已发过合并告警
  if (await isAlertKeySent(mergedKey)) {
    logger.info(`⊘ 合并告警本窗口已发送过(${mergedKey})，跳过`);
    // 仍需更新各平台状态机标志位（视为已发送）
    for (const it of alertItems) {
      await applySent(it.platform.id, it.level, redRepeatHours);
    }
    return;
  }

  logger.info(`⚡ 触发合并告警: 共 ${alertItems.length} 个平台 (${mergedKey})`);
  const results = await notifyMerged(alertItems, mergedKey, settings);

  // 合并发送成功后更新各平台状态机
  const emailOk = results.email && results.email.status === 'success';
  const smsOk = results.sms && results.sms.status === 'success';
  const anyOk = emailOk || smsOk;
  for (const it of alertItems) {
    if (anyOk) {
      await applySent(it.platform.id, it.level, redRepeatHours);
    } else {
      await applySkip(it.platform.id, it.level);
    }
  }
}

// 评估单平台：算出新等级并做去重决策（不发送，不更新状态机）
// 返回 { action: 'reset'|'skip'|'notify', newLevel, level?, threshold?, alertKey? }
async function evaluateAndDecide(platform, balance, settings, redRepeatHours) {
  const yellowTh = platform.yellow_threshold != null
    ? parseFloat(platform.yellow_threshold)
    : parseFloat(settings.yellow_threshold || 500);
  const redTh = platform.red_threshold != null
    ? parseFloat(platform.red_threshold)
    : parseFloat(settings.red_threshold || 200);

  let newLevel;
  if (balance >= yellowTh) newLevel = 'normal';
  else if (balance >= redTh) newLevel = 'yellow';
  else newLevel = 'red';

  const state = await getState(platform.id);

  // 回升正常区
  if (newLevel === 'normal') {
    return { action: 'reset', newLevel };
  }

  // 黄色告警：一次性去重
  if (newLevel === 'yellow') {
    if (Number(state.yellow_sent) === 1) {
      return { action: 'skip', newLevel };
    }
    const alertKey = buildAlertKey(platform.code, 'yellow', redRepeatHours);
    if (await isAlertKeySent(alertKey)) {
      return { action: 'skip', newLevel };
    }
    return { action: 'notify', newLevel, level: 'yellow', threshold: yellowTh, alertKey };
  }

  // 红色告警：按 redRepeatHours 间隔去重
  if (newLevel === 'red') {
    const now = new Date();
    const lastSent = state.red_last_sent_at ? new Date(state.red_last_sent_at) : null;
    const needRepeat = !lastSent || (now - lastSent) >= redRepeatHours * 3600 * 1000;
    if (!needRepeat) {
      return { action: 'skip', newLevel };
    }
    const alertKey = buildAlertKey(platform.code, 'red', redRepeatHours);
    if (await isAlertKeySent(alertKey)) {
      return { action: 'skip', newLevel };
    }
    return { action: 'notify', newLevel, level: 'red', threshold: redTh, alertKey };
  }

  return { action: 'skip', newLevel };
}

// 状态机更新：发送成功
async function applySent(platformId, level, redRepeatHours) {
  const now = new Date();
  if (level === 'yellow') {
    await pool.query(
      "UPDATE alert_state SET current_level='yellow', yellow_sent=1, yellow_sent_at=$1, last_eval_at=$2 WHERE platform_id=$3",
      [now, now, platformId]
    );
  } else if (level === 'red') {
    await pool.query(
      "UPDATE alert_state SET current_level='red', red_last_sent_at=$1, red_sent_count=red_sent_count+1, last_eval_at=$2 WHERE platform_id=$3",
      [now, now, platformId]
    );
  }
}

async function applyReset(platformId) {
  const now = new Date();
  await pool.query(
    "UPDATE alert_state SET current_level='normal', yellow_sent=0, yellow_sent_at=NULL, red_last_sent_at=NULL, red_sent_count=0, last_eval_at=$1 WHERE platform_id=$2",
    [now, platformId]
  );
}

async function applySkip(platformId, newLevel) {
  const now = new Date();
  await pool.query(
    "UPDATE alert_state SET current_level=$1, last_eval_at=$2 WHERE platform_id=$3",
    [newLevel, now, platformId]
  );
}

// 评估单平台（兼容旧接口，单发模式）
async function evaluate(platform, balance, settings) {
  const redRepeatHours = parseInt(settings.red_repeat_hours || 6);
  const decision = await evaluateAndDecide(platform, balance, settings, redRepeatHours);
  if (decision.action === 'reset') {
    await applyReset(platform.id);
    return;
  }
  if (decision.action === 'skip') {
    await applySkip(platform.id, decision.newLevel);
    return;
  }
  // notify
  const results = await notify(platform, decision.level, balance, decision.threshold, decision.alertKey, settings);
  if (results.some(r => r.status === 'success')) {
    await applySent(platform.id, decision.level, redRepeatHours);
  } else {
    await applySkip(platform.id, decision.newLevel);
  }
}

module.exports = { evaluateAll, evaluate, getSettings, evaluateAndDecide, applySent, applyReset, applySkip };
