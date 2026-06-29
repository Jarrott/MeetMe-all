-- +migrate Up

ALTER TABLE `user` ADD COLUMN `admin_remark` varchar(500) NOT NULL DEFAULT '' COMMENT '后台备注';

-- +migrate Down

ALTER TABLE `user` DROP COLUMN `admin_remark`;
