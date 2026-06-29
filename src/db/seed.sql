-- ============================================================
-- 初始化数据 - 六大平台 + 默认设置
-- ============================================================

-- 六大平台配置
INSERT INTO platforms (code, name, collect_type, status, display_order, currency, balance_divisor, balance_field, yellow_threshold, red_threshold) VALUES
  ('deepseek',  'DeepSeek',   'api',    1, 1, 'CNY',   1,       NULL,           NULL,    NULL),
  ('kimi',      'Kimi',       'api',    1, 2, 'CNY',   1,       NULL,           NULL,    NULL),
  ('volc',      '火山引擎',    'sdk',    1, 3, 'CNY',   1,       NULL,           NULL,    NULL),
  ('openaihub', 'OpenAI-Hub', 'api',    1, 4, 'CNY',   500000,  NULL,           NULL,    NULL),
  ('zhipu',     '智谱AI',      'cookie', 1, 5, 'CNY',   1,       'data.balance', NULL,    NULL),
  ('minimax',   'MiniMax',    'cookie', 1, 6, 'CNY',   1,       'data.balance', NULL,    NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name), collect_type = VALUES(collect_type);

-- 为每个平台初始化告警状态机
INSERT INTO alert_state (platform_id, current_level)
  SELECT id, 'normal' FROM platforms
  WHERE id NOT IN (SELECT platform_id FROM alert_state);

-- 默认系统设置
INSERT INTO settings (`key`, value, value_type, description) VALUES
  ('yellow_threshold',     '500',                'number', '全局黄色阈值(元)'),
  ('red_threshold',        '200',                'number', '全局红色阈值(元)'),
  ('collect_interval_hours','6',                 'number', '采集间隔(小时)'),
  ('collect_cron',         '0 */6 * * *',        'string', 'cron 表达式'),
  ('alert_email_enabled',  'true',               'bool',   '启用邮件告警'),
  ('alert_sms_enabled',    'true',               'bool',   '启用短信告警'),
  ('alert_email_to',       '',                   'string', '告警收件邮箱(逗号分隔,已弃用,改用 recipients 表)'),
  ('alert_sms_phones',     '',                   'string', '告警短信手机号(逗号分隔,已弃用,改用 recipients 表)'),
  ('red_repeat_hours',     '6',                  'number', '红色告警重复间隔(小时)'),
  ('dashboard_url',        'http://localhost:3000','string','前端面板地址'),
  ('record_retention_days','90',                 'number', '采集记录保留天数'),
  ('notify_mode',          'single',             'string', '通知模式: single=每平台单独发 / merged=合并所有平台一封邮件 / both=两种都发'),
  ('notify_merged_min_level','yellow',           'string', '合并模式下纳入通知的最低级别: yellow|red')
ON DUPLICATE KEY UPDATE description = VALUES(description);
