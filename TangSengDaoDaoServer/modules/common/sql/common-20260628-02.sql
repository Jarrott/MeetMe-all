-- +migrate Up

ALTER TABLE `app_config` ADD COLUMN `conversation_team_enabled` smallint not null default 1 COMMENT '是否允许会话分组管理';
ALTER TABLE `app_config` ADD COLUMN `group_member_private_chat_enabled` smallint not null default 1 COMMENT '是否允许群成员不加好友私聊';
