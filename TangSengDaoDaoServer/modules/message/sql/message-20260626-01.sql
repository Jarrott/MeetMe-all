-- +migrate Up

CREATE TABLE IF NOT EXISTS `monitor_words`(
  id         integer      not null primary key AUTO_INCREMENT,
  content    VARCHAR(500) not null default '' COMMENT '监听词',
  is_deleted smallint     not null default 0,
  version    bigint       not null default 0,
  created_at timeStamp    not null DEFAULT CURRENT_TIMESTAMP,
  updated_at timeStamp    not null DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE UNIQUE INDEX `monitor_words_content_idx` on `monitor_words` (`content`);
CREATE INDEX `monitor_words_deleted_idx` on `monitor_words` (`is_deleted`);
