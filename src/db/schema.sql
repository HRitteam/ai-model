-- ============================================================
-- 大模型API费用统一监控预警系统 - 数据库表结构 (MySQL 8.0, utf8mb4)
-- ============================================================

-- 平台配置表
CREATE TABLE IF NOT EXISTS platforms (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code            VARCHAR(32)  NOT NULL COMMENT '平台代码',
  name            VARCHAR(64)  NOT NULL COMMENT '显示名称',
  collect_type    ENUM('api','cookie','sdk') NOT NULL COMMENT '采集方式',
  status          TINYINT      NOT NULL DEFAULT 1 COMMENT '0=禁用 1=启用',
  display_order   INT          NOT NULL DEFAULT 0 COMMENT '六宫格排序',
  currency        VARCHAR(8)   NOT NULL DEFAULT 'CNY' COMMENT '余额单位',
  balance_divisor DECIMAL(12,6) NOT NULL DEFAULT 1 COMMENT '余额换算系数',
  balance_field   VARCHAR(128) DEFAULT NULL COMMENT '余额字段JSON路径(cookie类型)',
  yellow_threshold DECIMAL(12,2) DEFAULT NULL COMMENT '平台级黄色阈值(覆盖全局)',
  red_threshold    DECIMAL(12,2) DEFAULT NULL COMMENT '平台级红色阈值(覆盖全局)',
  last_balance    DECIMAL(14,4) DEFAULT NULL COMMENT '最新余额(冗余加速展示)',
  last_collected_at DATETIME    DEFAULT NULL COMMENT '最近采集时间',
  last_status     VARCHAR(16)  DEFAULT NULL COMMENT 'ok/error/unconfigured/disabled/cookie_expired',
  last_error      TEXT         DEFAULT NULL COMMENT '最近错误信息',
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  KEY idx_status_order (status, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台配置表';

-- 采集记录表
CREATE TABLE IF NOT EXISTS balance_records (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  platform_id   INT UNSIGNED NOT NULL,
  balance       DECIMAL(14,4) DEFAULT NULL COMMENT '采集余额(已按divisor换算)',
  currency      VARCHAR(8)   NOT NULL,
  consumed      DECIMAL(14,4) DEFAULT NULL COMMENT '累计消耗',
  raw_response  MEDIUMTEXT   DEFAULT NULL COMMENT '原始响应JSON',
  collected_at  DATETIME     NOT NULL,
  status        VARCHAR(16)  NOT NULL COMMENT 'ok/error',
  error_msg     TEXT         DEFAULT NULL,
  KEY idx_platform_time (platform_id, collected_at),
  KEY idx_collected (collected_at),
  CONSTRAINT fk_records_platform FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集记录表';

-- 告警日志表(每次发送一条)
CREATE TABLE IF NOT EXISTS alert_log (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  platform_id   INT UNSIGNED NOT NULL,
  alert_level   ENUM('yellow','red') NOT NULL,
  threshold     DECIMAL(12,2) NOT NULL,
  balance       DECIMAL(14,4) NOT NULL,
  channel       ENUM('email','sms') NOT NULL,
  alert_key     VARCHAR(128) NOT NULL COMMENT '去重键',
  status        VARCHAR(16)  NOT NULL COMMENT 'success/failed',
  provider_msgid VARCHAR(128) DEFAULT NULL,
  is_test       TINYINT      NOT NULL DEFAULT 0 COMMENT '0=正式 1=测试',
  error_msg     TEXT         DEFAULT NULL,
  sent_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_platform_sent (platform_id, sent_at),
  KEY idx_alert_key (alert_key),
  KEY idx_level_sent (alert_level, sent_at),
  CONSTRAINT fk_log_platform FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警日志表';

-- 告警状态机表(去重核心, 每平台一行)
CREATE TABLE IF NOT EXISTS alert_state (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  platform_id     INT UNSIGNED NOT NULL,
  current_level   ENUM('normal','yellow','red') NOT NULL DEFAULT 'normal',
  yellow_sent     TINYINT      NOT NULL DEFAULT 0 COMMENT '黄色告警是否已发(一次性去重)',
  yellow_sent_at  DATETIME     DEFAULT NULL,
  red_last_sent_at DATETIME    DEFAULT NULL COMMENT '红色告警上次发送时间',
  red_sent_count  INT UNSIGNED NOT NULL DEFAULT 0,
  last_eval_at    DATETIME     DEFAULT NULL,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform (platform_id),
  CONSTRAINT fk_state_platform FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警状态机表';

-- 系统设置表(KV结构)
CREATE TABLE IF NOT EXISTS settings (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `key`       VARCHAR(64)  NOT NULL,
  value       TEXT,
  value_type  ENUM('string','number','json','bool') NOT NULL DEFAULT 'string',
  description VARCHAR(255) DEFAULT NULL,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表';
