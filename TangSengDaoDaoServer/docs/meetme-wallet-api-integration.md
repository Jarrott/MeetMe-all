# MeetMe 钱包接口对接文档

金额统一使用整数，单位为分。`amount: 100` 表示 1.00。

所有接口都需要登录 `token` 请求头。

## 用户接口

### 查询余额

`GET /v1/wallet/balance`

响应：

```json
{
  "uid": "user_uid",
  "balance": 1000,
  "frozen_amount": 0
}
```

### 查询流水

`GET /v1/wallet/transactions?page_index=1&page_size=20&trade_type=0&direction=0`

参数：

- `trade_type`: 可选，`1` 充值，`2` 提现，`3` 转账，`0` 或不传表示全部
- `direction`: 可选，`1` 收入，`2` 支出，`0` 或不传表示全部

响应：

```json
{
  "count": 1,
  "list": [
    {
      "trade_no": "wallet_transfer_out_xxx",
      "related_trade_no": "wallet_transfer_in_xxx",
      "uid": "sender_uid",
      "counterparty_uid": "receiver_uid",
      "trade_type": 3,
      "direction": 2,
      "amount": 100,
      "balance_after": 900,
      "status": 1,
      "remark": "test",
      "operator_uid": "sender_uid",
      "created_at": "2026-06-20 18:00:00"
    }
  ]
}
```

### 提现

`POST /v1/wallet/withdraw`

```json
{
  "amount": 100,
  "remark": "提现",
  "trade_no": "optional_client_trade_no"
}
```

### 转账

`POST /v1/wallet/transfer`

```json
{
  "to_uid": "receiver_uid",
  "amount": 100,
  "remark": "转账",
  "trade_no": "optional_client_trade_no"
}
```

说明：

- `trade_no` 建议客户端每次点击确认前生成并持久化，同一笔失败重试必须复用同一个 `trade_no`。
- 后端会对同一个 `trade_no` 做幂等处理：参数一致返回原成功流水，参数不一致返回错误，避免重复扣款。

### 生成收款码

`GET /v1/wallet/receive-qrcode?amount=100&remark=收款`

也支持：

`POST /v1/wallet/receive-qrcode`

```json
{
  "amount": 100,
  "remark": "收款"
}
```

- `amount` 可传 `0`，表示扫码方输入金额；大于 `0` 表示固定金额。
- 收款码有效期 24 小时。

响应：

```json
{
  "code": "qr_code_uuid",
  "qrcode": "https://api.meetme.im/qr/qr_code_uuid",
  "pay_url": "https://api.meetme.im/v1/wallet/scan-receive/qr_code_uuid",
  "type": "walletReceive",
  "amount": 100,
  "remark": "收款",
  "expire": "2026-06-29 18:00:00"
}
```

### 扫码查看收款信息

`GET /v1/wallet/scan-receive/{code}`

响应：

```json
{
  "code": "qr_code_uuid",
  "type": "walletReceive",
  "receiver_uid": "receiver_uid",
  "amount": 100,
  "remark": "收款"
}
```

### 确认扫码支付

`POST /v1/wallet/scan-pay`

```json
{
  "code": "qr_code_uuid",
  "amount": 100,
  "remark": "扫码转账",
  "trade_no": "client_unique_trade_no"
}
```

- 如果收款码本身带固定 `amount > 0`，后端以收款码金额为准，忽略客户端传入金额。
- 如果收款码金额是 `0`，客户端必须传入大于 `0` 的 `amount`。
- 该接口最终走同一套钱包转账事务，会扣扫码付款人余额，增加收款人余额，并写双方流水。

## 后台管理接口

后台接口需要管理员或超级管理员 token。

### 查询用户余额

`GET /v1/manager/wallet/{uid}/balance`

### 查询用户流水

`GET /v1/manager/wallet/{uid}/transactions?page_index=1&page_size=20`

### 给用户充值

`POST /v1/manager/wallet/{uid}/recharge`

```json
{
  "amount": 1000,
  "remark": "后台充值",
  "trade_no": "optional_admin_trade_no"
}
```

## 说明

- 余额变更和流水写入在同一个数据库事务里完成。
- 转账会同时写出账方和入账方两条流水，并通过 `related_trade_no` 关联。
- 目前没有接入第三方支付网关，充值入口放在后台管理侧，避免普通用户直接给自己加余额。
