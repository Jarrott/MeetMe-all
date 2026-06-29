-- +migrate Up

CREATE TABLE IF NOT EXISTS `conversation_team` (
  id bigint not null primary key AUTO_INCREMENT,
  uid varchar(40) not null default '' comment '所属用户',
  name varchar(60) not null default '' comment '团队名称',
  sort_no integer not null default 0 comment '团队排序',
  is_deleted smallint not null default 0 comment '是否删除',
  version bigint not null default 0 comment '数据版本',
  created_at timestamp not null DEFAULT CURRENT_TIMESTAMP comment '创建时间',
  updated_at timestamp not null DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP comment '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX conversation_team_uid_idx on `conversation_team` (`uid`, `is_deleted`, `sort_no`);

CREATE TABLE IF NOT EXISTS `conversation_team_item` (
  id bigint not null primary key AUTO_INCREMENT,
  uid varchar(40) not null default '' comment '所属用户',
  team_id bigint not null default 0 comment '团队ID',
  channel_id varchar(100) not null default '' comment '频道ID',
  channel_type smallint not null default 0 comment '频道类型',
  top_order bigint not null default 0 comment '团队内置顶稳定排序',
  is_deleted smallint not null default 0 comment '是否删除',
  version bigint not null default 0 comment '数据版本',
  created_at timestamp not null DEFAULT CURRENT_TIMESTAMP comment '创建时间',
  updated_at timestamp not null DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP comment '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE UNIQUE INDEX conversation_team_item_uid_channel_idx on `conversation_team_item` (`uid`, `channel_id`, `channel_type`);
CREATE INDEX conversation_team_item_uid_team_idx on `conversation_team_item` (`uid`, `team_id`, `is_deleted`);
