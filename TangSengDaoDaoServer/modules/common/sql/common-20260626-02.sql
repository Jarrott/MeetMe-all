-- +migrate Up

CREATE TABLE IF NOT EXISTS `manager_alert` (
  id            BIGINT       NOT NULL PRIMARY KEY AUTO_INCREMENT,
  alert_type    VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '提醒类型 prohibit_word/register_audit',
  title         VARCHAR(100) NOT NULL DEFAULT '' COMMENT '提醒标题',
  content       TEXT COMMENT '提醒内容',
  actor_uid     VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '触发用户uid',
  actor_name    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '触发用户名称',
  target_id     VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '业务目标id',
  target_type   VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '业务目标类型',
  channel_id    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '频道id',
  channel_type  SMALLINT     NOT NULL DEFAULT 0 COMMENT '频道类型',
  message_id    VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '消息id',
  message_seq   BIGINT       NOT NULL DEFAULT 0 COMMENT '消息序号',
  trigger_word  VARCHAR(200) NOT NULL DEFAULT '' COMMENT '触发词',
  payload       TEXT COMMENT '原始负载快照',
  is_read       SMALLINT     NOT NULL DEFAULT 0 COMMENT '是否已读 0.未读 1.已读',
  read_at       TIMESTAMP    NULL DEFAULT NULL COMMENT '已读时间',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间'
) CHARACTER SET utf8mb4;

CREATE INDEX `manager_alert_type_read_idx` ON `manager_alert` (`alert_type`, `is_read`, `created_at`);
CREATE INDEX `manager_alert_created_at_idx` ON `manager_alert` (`created_at`);
CREATE INDEX `manager_alert_msg_word_idx` ON `manager_alert` (`message_id`, `trigger_word`, `alert_type`);
