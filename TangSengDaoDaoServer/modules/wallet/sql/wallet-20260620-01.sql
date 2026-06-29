-- +migrate Up

create table `wallet_account` (
  id             bigint        not null primary key AUTO_INCREMENT,
  uid            varchar(40)   not null default '',                    -- 用户uid
  balance        bigint        not null default 0,                     -- 可用余额，单位：分
  frozen_amount  bigint        not null default 0,                     -- 冻结金额，单位：分
  `version`      bigint        not null default 0,                     -- 版本号
  created_at     timeStamp     not null DEFAULT CURRENT_TIMESTAMP,     -- 创建时间
  updated_at     timeStamp     not null DEFAULT CURRENT_TIMESTAMP      -- 更新时间
);

CREATE UNIQUE INDEX wallet_account_uid_uidx on `wallet_account` (`uid`);

create table `wallet_transaction` (
  id               bigint        not null primary key AUTO_INCREMENT,
  trade_no         varchar(80)   not null default '',                  -- 交易流水号
  related_trade_no varchar(80)   not null default '',                  -- 关联流水号，例如转账对端流水
  uid              varchar(40)   not null default '',                  -- 用户uid
  counterparty_uid varchar(40)   not null default '',                  -- 对方uid
  trade_type       smallint      not null default 0,                   -- 1充值 2提现 3转账 4后台扣款
  direction        smallint      not null default 0,                   -- 1收入 2支出
  amount           bigint        not null default 0,                   -- 交易金额，单位：分
  balance_after    bigint        not null default 0,                   -- 交易后余额，单位：分
  status           smallint      not null default 1,                   -- 0待审核 1成功 2拒绝
  remark           varchar(255)  not null default '',                  -- 备注
  operator_uid     varchar(40)   not null default '',                  -- 操作人uid
  created_at       timeStamp     not null DEFAULT CURRENT_TIMESTAMP,   -- 创建时间
  updated_at       timeStamp     not null DEFAULT CURRENT_TIMESTAMP    -- 更新时间
);

CREATE UNIQUE INDEX wallet_transaction_trade_no_uidx on `wallet_transaction` (`trade_no`);
CREATE INDEX wallet_transaction_uid_created_idx on `wallet_transaction` (`uid`, `created_at`);
CREATE INDEX wallet_transaction_uid_type_idx on `wallet_transaction` (`uid`, `trade_type`);
CREATE INDEX wallet_transaction_related_trade_idx on `wallet_transaction` (`related_trade_no`);
