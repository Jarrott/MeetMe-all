-- +migrate Up

ALTER TABLE `wallet_exchange_rate` ADD COLUMN `hidden` smallint not null default 0 COMMENT '是否隐藏 1.隐藏 0.显示';
