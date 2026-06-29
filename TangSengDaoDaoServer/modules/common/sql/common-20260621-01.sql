-- +migrate Up

ALTER TABLE `app_config` ADD COLUMN `auto_translate_on` smallint not null default 0 COMMENT '是否开启自动翻译';
