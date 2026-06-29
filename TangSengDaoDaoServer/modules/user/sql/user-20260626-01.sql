-- +migrate Up

ALTER TABLE `user` ADD COLUMN `register_audit_status` smallint not null DEFAULT 1 COMMENT '注册审核状态 0.待审核 1.通过 2.拒绝';
ALTER TABLE `user` ADD COLUMN `audit_remark` VARCHAR(200) not null DEFAULT '' COMMENT '注册审核备注';

CREATE INDEX `user_register_audit_status_idx` on `user` (`register_audit_status`);
