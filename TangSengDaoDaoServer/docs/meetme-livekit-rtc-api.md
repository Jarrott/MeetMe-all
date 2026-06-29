# MeetMe LiveKit RTC 对接

## 服务端配置

在后端容器环境变量中配置：

```bash
LIVEKIT_API_KEY=你的 LiveKit API Key
LIVEKIT_API_SECRET=你的 LiveKit API Secret
LIVEKIT_WS_URL=wss://rtc.meetme.im
LIVEKIT_TOKEN_TTL_SECONDS=3600
```

`LIVEKIT_API_SECRET` 只允许放在后端环境变量，Web、iOS、Android 不要保存。

## 查询 RTC 配置

```http
GET /v1/rtc/config
token: 用户登录 token
```

响应：

```json
{
  "enabled": true,
  "ws_url": "wss://rtc.meetme.im",
  "token_ttl": 3600,
  "api_key_config": true
}
```

## 获取入会 Token

```http
POST /v1/rtc/token
Content-Type: application/json
token: 用户登录 token
```

请求：

```json
{
  "room": "test-room",
  "name": "Pedro",
  "metadata": "",
  "ttl": 3600,
  "attributes": {
    "scene": "chat-call"
  },
  "permissions": {
    "can_publish": true,
    "can_subscribe": true,
    "can_publish_data": true,
    "can_update_own_metadata": true
  }
}
```

字段说明：

- `room`：必填，LiveKit 房间名。单聊建议使用固定会话 ID，群聊建议使用群 ID。
- `name`：可选，显示名；不传则使用当前登录用户名。
- `metadata`：可选，LiveKit participant metadata。
- `ttl`：可选，token 有效秒数；服务端限制为 60 秒到 24 小时。
- `attributes`：可选，LiveKit participant attributes。
- `permissions`：可选，不传时默认允许发布、订阅、发送 data channel、更新自己的 metadata。

响应：

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "ws_url": "wss://rtc.meetme.im",
  "room": "test-room",
  "identity": "user_1001",
  "name": "Pedro",
  "expires_at": 1782050000,
  "expires_in": 3600,
  "permissions": {
    "can_publish": true,
    "can_subscribe": true,
    "can_publish_data": true,
    "can_update_own_metadata": true
  }
}
```

客户端连接 LiveKit 时使用：

- URL：响应里的 `ws_url`
- Token：响应里的 `token`

用户身份 `identity` 由后端登录态生成，客户端不能指定，避免伪造他人身份。
