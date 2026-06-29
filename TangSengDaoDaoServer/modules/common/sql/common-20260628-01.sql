-- +migrate Up

CREATE TABLE IF NOT EXISTS `user_sticker` (
  id          BIGINT       NOT NULL PRIMARY KEY AUTO_INCREMENT,
  uid         VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '用户UID',
  category    VARCHAR(64)  NOT NULL DEFAULT 'custom' COMMENT '贴图分类',
  path        VARCHAR(500) NOT NULL DEFAULT '' COMMENT '贴图文件地址',
  placeholder VARCHAR(500) NOT NULL DEFAULT '' COMMENT '占位图地址',
  format      VARCHAR(20)  NOT NULL DEFAULT 'image' COMMENT '贴图格式 image/lottie',
  name        VARCHAR(100) NOT NULL DEFAULT '' COMMENT '贴图名称',
  is_deleted  SMALLINT     NOT NULL DEFAULT 0 COMMENT '是否删除',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间'
) CHARACTER SET utf8mb4;

CREATE INDEX `user_sticker_uid_category_idx` ON `user_sticker` (`uid`, `category`, `is_deleted`, `created_at`);
