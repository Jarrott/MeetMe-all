-- +migrate Up

create table `wallet_exchange_rate` (
  id             bigint         not null primary key AUTO_INCREMENT,
  rate_date      date           not null,                             -- 汇率日期
  base_currency  varchar(16)    not null default 'USD',               -- 基准币种
  quote_currency varchar(16)    not null default '',                  -- 目标币种
  rate           decimal(20, 8) not null default 0,                   -- 1 基准币种兑换目标币种数量
  remark         varchar(255)   not null default '',                  -- 备注
  operator_uid   varchar(40)    not null default '',                  -- 操作人uid
  created_at     timeStamp      not null DEFAULT CURRENT_TIMESTAMP,   -- 创建时间
  updated_at     timeStamp      not null DEFAULT CURRENT_TIMESTAMP    -- 更新时间
);

CREATE UNIQUE INDEX wallet_exchange_rate_date_currency_uidx on `wallet_exchange_rate` (`rate_date`, `base_currency`, `quote_currency`);
