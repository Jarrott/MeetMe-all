-- +migrate Up

create table `translation_cache` (
  id              bigint        not null primary key AUTO_INCREMENT,
  message_id      varchar(80)   not null default '',                 -- 消息ID
  content_hash    varchar(64)   not null default '',                 -- 原文hash
  source_lang     varchar(32)   not null default 'auto',             -- 源语言
  target_lang     varchar(32)   not null default '',                 -- 目标语言
  model           varchar(80)   not null default '',                 -- 翻译模型
  translated_text text          not null,                            -- 翻译结果
  created_at      timeStamp     not null DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
  updated_at      timeStamp     not null DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);

CREATE UNIQUE INDEX translation_cache_content_uidx on `translation_cache` (`content_hash`, `source_lang`, `target_lang`, `model`);
CREATE INDEX translation_cache_message_idx on `translation_cache` (`message_id`);
