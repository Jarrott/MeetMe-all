# MeetMe 新增功能后端接口对接文档

本文档整理本地后端新增和本次对接中用到的接口，覆盖群高级功能、消息点赞、消息置顶、文件消息、聊天内容搜索等能力。

## 1. 通用约定

- API 地址用 `{API_BASE}` 表示，例如本地一般是 `http://127.0.0.1:8090/v1`，实际以部署配置为准。
- 除特别说明外，接口都需要登录态，请求头携带：

```http
token: <登录后返回的 token>
Content-Type: application/json
```

- 成功但无业务数据时，统一返回：

```json
{
  "status": 200
}
```

- 失败时一般返回 HTTP 400：

```json
{
  "status": 400,
  "msg": "错误原因"
}
```

- `channel_type` 约定：

| 值 | 含义 |
| --- | --- |
| `1` | 单聊 |
| `2` | 群聊 |

- 常用消息内容类型：

| type | 含义 |
| --- | --- |
| `1` | 文本 |
| `2` | 图片 |
| `3` | GIF |
| `4` | 语音 |
| `5` | 视频 |
| `8` | 文件 |
| `12` | 动态/贴纸类表情 |
| `13` | 图片表情 |
| `2000` | 系统提示 |

## 2. 群高级功能

### 2.1 添加群管理员

只有群主可以操作。

```http
POST {API_BASE}/groups/{group_no}/managers
```

请求体直接传 UID 数组，不是对象：

```json
["user_001", "user_002"]
```

成功返回：

```json
{
  "status": 200
}
```

失败示例：

```json
{
  "status": 400,
  "msg": "只有创建者才能设置管理员！"
}
```

### 2.2 移除群管理员

只有群主可以操作。

```http
DELETE {API_BASE}/groups/{group_no}/managers
```

请求体直接传 UID 数组：

```json
["user_001", "user_002"]
```

成功返回：

```json
{
  "status": 200
}
```

### 2.3 群全员禁言

群主或管理员可以操作。开启后，群主和管理员会被加入 IM 白名单，普通成员不能发言。

```http
POST {API_BASE}/groups/{group_no}/forbidden/{on}
```

路径参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `group_no` | string | 是 | 群编号 |
| `on` | int | 是 | `1` 开启群禁言，`0` 关闭群禁言 |

请求示例：

```http
POST {API_BASE}/groups/G001/forbidden/1
```

成功返回：

```json
{
  "status": 200
}
```

### 2.4 单个群成员禁言/解禁

群主或管理员可以操作，普通成员不能操作。管理员不能禁言群主，同级管理员之间不能互相禁言。

```http
POST {API_BASE}/groups/{group_no}/forbidden_with_member
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `member_uid` | string | 是 | 被禁言或解禁的成员 UID |
| `action` | int | 是 | `1` 禁言，`0` 解禁 |
| `key` | int | 禁言时必填 | 禁言时长枚举 |

`key` 枚举：

| key | 时长 |
| --- | --- |
| `1` | 1 分钟 |
| `2` | 10 分钟 |
| `3` | 1 小时 |
| `4` | 1 天 |
| `5` | 1 周 |
| `6` | 1 个月 |

禁言请求示例：

```json
{
  "member_uid": "user_001",
  "action": 1,
  "key": 3
}
```

解禁请求示例：

```json
{
  "member_uid": "user_001",
  "action": 0,
  "key": 0
}
```

成功返回：

```json
{
  "status": 200
}
```

禁言时长列表也可以通过下面接口读取：

```http
GET {API_BASE}/group/forbidden_times
```

### 2.5 设置群头像

只有群主可以修改群头像。

```http
POST {API_BASE}/groups/{group_no}/avatar
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | file | 是 | 图片文件 |

成功返回：

```json
{
  "status": 200
}
```

头像查看地址：

```http
GET {API_BASE}/groups/{group_no}/avatar
```

### 2.6 群成员邀请

该接口创建入群邀请申请，后端会产生邀请记录并通知群主/管理员处理。

```http
POST {API_BASE}/groups/{group_no}/member/invite
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `uids` | string[] | 是 | 被邀请用户 UID 列表 |
| `remark` | string | 否 | 邀请备注 |

请求示例：

```json
{
  "uids": ["user_001", "user_002"],
  "remark": "邀请加入项目群"
}
```

成功返回：

```json
{
  "status": 200
}
```

### 2.7 是否允许普通成员置顶消息

群主或管理员可以通过群设置开启。关闭时，只有群主/管理员可以置顶群消息；开启后，普通群成员也可以置顶。

```http
PUT {API_BASE}/groups/{group_no}/setting
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `allow_member_pinned_message` | int | 是 | `1` 允许普通成员置顶，`0` 不允许 |

请求示例：

```json
{
  "allow_member_pinned_message": 1
}
```

成功返回：

```json
{
  "status": 200
}
```

## 3. 消息点赞/回应

### 3.1 添加、取消或切换点赞

```http
POST {API_BASE}/reactions
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `message_id` | string | 是 | 服务端消息 ID，使用字符串 |
| `channel_id` | string | 是 | 单聊用户 UID 或群编号 |
| `channel_type` | int | 是 | `1` 单聊，`2` 群聊 |
| `emoji` | string | 是 | 回应内容，如 `👍`、`❤️` |

请求示例：

```json
{
  "message_id": "742339112233445566",
  "channel_id": "G001",
  "channel_type": 2,
  "emoji": "👍"
}
```

行为说明：

- 当前用户第一次对该消息发送 `emoji`：新增点赞。
- 当前用户再次发送相同 `emoji`：取消点赞，返回 `is_deleted=1` 的同步记录。
- 当前用户发送不同 `emoji`：切换点赞内容。
- 接口成功后，后端会发送 `CMDSyncMessageReaction`，客户端收到后调用同步接口。

成功返回：

```json
{
  "status": 200
}
```

### 3.2 同步点赞数据

```http
POST {API_BASE}/reaction/sync
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `channel_id` | string | 是 | 单聊用户 UID 或群编号 |
| `channel_type` | int | 是 | `1` 单聊，`2` 群聊 |
| `seq` | int64 | 是 | 本地已同步的最大点赞序列号，首次传 `0` |
| `limit` | int | 否 | 默认 `100`，最大 `1000` |

请求示例：

```json
{
  "channel_id": "G001",
  "channel_type": 2,
  "seq": 0,
  "limit": 100
}
```

返回示例：

```json
[
  {
    "message_id": "742339112233445566",
    "channel_id": "G001",
    "channel_type": 2,
    "seq": 12,
    "uid": "user_001",
    "name": "Pedro",
    "emoji": "👍",
    "is_deleted": 0,
    "created_at": "2026-06-19 18:00:00"
  }
]
```

客户端处理建议：

- 按 `message_id + uid` 做本地唯一键。
- `is_deleted=0` 表示展示该用户的点赞。
- `is_deleted=1` 表示移除该用户对该消息的点赞。
- 本地保存返回数据中的最大 `seq`，下次同步传入。
- 点赞接口返回 `uid/name/emoji`，头像不直接返回；头像展示走现有用户头像地址：`GET {API_BASE}/users/{uid}/avatar`，或使用客户端本地用户缓存。

### 3.3 消息同步中携带的点赞字段

`/message/sync`、`/message/pinned/sync` 返回的消息对象中会带：

```json
{
  "message_idstr": "742339112233445566",
  "reactions": [
    {
      "seq": 12,
      "uid": "user_001",
      "name": "Pedro",
      "emoji": "👍",
      "is_deleted": 0,
      "created_at": "2026-06-19 18:00:00"
    }
  ]
}
```

前端展示时建议先过滤 `is_deleted=1`，再按 `emoji` 聚合数量和用户列表。

## 4. 消息置顶

### 4.1 置顶或取消置顶

同一个接口用于置顶和取消置顶：未置顶时调用会置顶，已置顶时调用会取消。

```http
POST {API_BASE}/message/pinned
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `message_id` | string | 是 | 服务端消息 ID，必须和 `message_seq` 对应 |
| `message_seq` | uint32 | 是 | 消息在当前频道内的序号 |
| `channel_id` | string | 是 | 单聊用户 UID 或群编号 |
| `channel_type` | int | 是 | `1` 单聊，`2` 群聊 |

请求示例：

```json
{
  "message_id": "742339112233445566",
  "message_seq": 18,
  "channel_id": "G001",
  "channel_type": 2
}
```

权限说明：

- 单聊：当前登录用户可操作。
- 群聊：群主/管理员可操作。
- 群聊普通成员：只有群设置 `allow_member_pinned_message=1` 时可操作。
- 默认置顶上限为 10 条；如果后台应用配置了 `ChannelPinnedMessageMaxCount`，以配置为准。

成功返回：

```json
{
  "status": 200
}
```

常见失败：

| msg | 说明 |
| --- | --- |
| `普通成员不允许置顶消息` | 群设置不允许普通成员置顶 |
| `置顶数量已达到上限` | 已达到频道置顶上限 |
| `消息ID和消息seq不匹配` | 前端传错 `message_id` 或 `message_seq` |
| `该消息不存在或已删除` | 消息被删除或不可见 |

### 4.2 同步置顶消息

客户端进入会话、收到 `CMDSyncPinnedMessage`，或本地版本落后时调用。

```http
POST {API_BASE}/message/pinned/sync
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | int64 | 是 | 本地已同步的最大置顶版本，首次传 `0` |
| `channel_id` | string | 是 | 单聊用户 UID 或群编号 |
| `channel_type` | int | 是 | `1` 单聊，`2` 群聊 |

请求示例：

```json
{
  "version": 0,
  "channel_id": "G001",
  "channel_type": 2
}
```

返回示例：

```json
{
  "pinned_messages": [
    {
      "message_id": "742339112233445566",
      "message_seq": 18,
      "channel_id": "G001",
      "channel_type": 2,
      "is_deleted": 0,
      "version": 1781872800000,
      "created_at": "2026-06-19 18:00:00",
      "updated_at": "2026-06-19 18:00:00"
    }
  ],
  "messages": [
    {
      "message_id": 742339112233445566,
      "message_idstr": "742339112233445566",
      "message_seq": 18,
      "from_uid": "user_001",
      "channel_id": "G001",
      "channel_type": 2,
      "timestamp": 1781872800,
      "payload": {
        "type": 1,
        "content": "这条消息被置顶"
      },
      "message_extra": {
        "message_id": 742339112233445566,
        "message_id_str": "742339112233445566",
        "is_pinned": 1,
        "extra_version": 10001
      },
      "reactions": []
    }
  ]
}
```

客户端处理建议：

- `pinned_messages` 是置顶状态变更列表。
- `messages` 是对应的消息详情，用于渲染 Telegram 风格顶部置顶条。
- `is_deleted=0`：新增或恢复置顶。
- `is_deleted=1`：取消置顶，本地需要移除。
- 本地保存 `pinned_messages` 中最大 `version`，下次同步传入。
- UI 顶部置顶条建议展示最新一条未删除置顶消息；如果需要多条，可按 `updated_at` 或 `version` 排序。

### 4.3 清空频道置顶

群聊只有群主/管理员可操作。

```http
POST {API_BASE}/message/pinned/clear
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `channel_id` | string | 是 | 单聊用户 UID 或群编号 |
| `channel_type` | int | 是 | `1` 单聊，`2` 群聊 |

请求示例：

```json
{
  "channel_id": "G001",
  "channel_type": 2
}
```

成功返回：

```json
{
  "status": 200
}
```

### 4.4 普通消息同步中的置顶标记

消息同步返回的 `message_extra` 中新增：

```json
{
  "message_extra": {
    "is_pinned": 1,
    "extra_version": 10001
  }
}
```

`is_pinned=1` 表示该消息当前是置顶消息，`is_pinned=0` 或字段不存在表示未置顶。

## 5. 文件上传与文件消息

### 5.1 获取上传地址

```http
GET {API_BASE}/file/upload?type=chat&path=/{channel_type}/{channel_id}/{uuid}.{ext}
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 聊天文件固定传 `chat` |
| `path` | string | 是 | 文件存储路径，建议带频道和 UUID |

请求示例：

```http
GET {API_BASE}/file/upload?type=chat&path=/2/G001/4f8d9a.pdf
```

返回示例：

```json
{
  "url": "http://127.0.0.1:8090/v1/file/upload?type=chat&path=/2/G001/4f8d9a.pdf"
}
```

### 5.2 上传文件

使用上一步返回的 `url` 直接上传。

```http
POST <上一步返回的 url>
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | file | 是 | 要发送的文件 |
| `contenttype` | string | 否 | 文件 MIME，默认 `application/octet-stream` |

返回示例：

```json
{
  "path": "file/preview/chat/2/G001/4f8d9a.pdf"
}
```

如果上传 URL 带 `signature=1`，会额外返回 `sha512`：

```json
{
  "path": "file/preview/chat/2/G001/4f8d9a.pdf",
  "sha512": "base64-sha512"
}
```

### 5.3 查看或下载文件

上传返回的 `path` 可以作为文件 URL 使用。

```http
GET {API_BASE}/file/preview/chat/2/G001/4f8d9a.pdf?filename=report.pdf
```

说明：

- 该接口会重定向到实际存储服务地址。
- `filename` 可选，用于浏览器下载时显示文件名。

### 5.4 发送文件消息 payload

上传成功后，用消息 SDK 发送文件消息，或者用服务端代发接口发送。文件消息内容固定使用 `type=8`。

文件消息 payload：

```json
{
  "type": 8,
  "name": "report.pdf",
  "size": 238899,
  "url": "file/preview/chat/2/G001/4f8d9a.pdf"
}
```

如果使用服务端代发接口：

```http
POST {API_BASE}/message/send
```

注意：这个接口不走请求头登录态，而是在请求体里传发送者 `token`。

请求示例：

```json
{
  "token": "<发送者 token>",
  "receive_channel_id": "G001",
  "receive_channel_type": 2,
  "payload": {
    "type": 8,
    "name": "report.pdf",
    "size": 238899,
    "url": "file/preview/chat/2/G001/4f8d9a.pdf"
  }
}
```

成功返回：

```json
{
  "status": 200
}
```

## 6. 聊天内容搜索

### 6.1 全局搜索

```http
POST {API_BASE}/search/global
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `keyword` | string | 否 | 搜索关键字 |
| `only_message` | int | 否 | `1` 只查消息，`0` 同时查好友、群、消息 |
| `content_type` | int[] | 否 | 消息类型过滤，如 `[1]` 文本、`[8]` 文件 |
| `from_uid` | string | 否 | 只搜索某个发送者 |
| `channel_id` | string | 否 | 只搜索某个会话 |
| `channel_type` | int | 否 | 配合 `channel_id` 使用 |
| `topic` | string | 否 | 按 topic 搜索 |
| `limit` | int | 否 | 默认 `20`，最大 `100` |
| `page` | int | 否 | 默认 `1` |
| `start_time` | int64 | 否 | 开始时间戳，秒 |
| `end_time` | int64 | 否 | 结束时间戳，秒，结果不包含该时间 |

搜索当前群聊天内容示例：

```json
{
  "only_message": 1,
  "keyword": "项目",
  "channel_id": "G001",
  "channel_type": 2,
  "limit": 20,
  "page": 1
}
```

搜索文件消息示例：

```json
{
  "only_message": 1,
  "content_type": [8],
  "channel_id": "G001",
  "channel_type": 2,
  "limit": 20,
  "page": 1
}
```

返回示例：

```json
{
  "friends": [],
  "groups": [
    {
      "channel_id": "G001",
      "channel_type": 2,
      "channel_remark": "",
      "channel_name": "项目群"
    }
  ],
  "messages": [
    {
      "setting": 0,
      "message_id": 742339112233445566,
      "message_idstr": "742339112233445566",
      "message_seq": 18,
      "client_msg_no": "client-message-no",
      "from_uid": "user_001",
      "timestamp": 1781872800,
      "payload": {
        "type": 1,
        "content": "项目资料已上传"
      },
      "is_deleted": 0,
      "channel": {
        "channel_id": "G001",
        "channel_type": 2,
        "channel_remark": "",
        "channel_name": "项目群"
      },
      "from_channel": {
        "channel_id": "user_001",
        "channel_type": 1,
        "channel_remark": "",
        "channel_name": "Pedro"
      }
    }
  ]
}
```

说明：

- 后端优先调用 IM 搜索；如果 IM 搜索失败，会回退到本地消息表搜索。
- 搜索结果会过滤用户不可见、已删除、已撤回或偏移之前的消息。
- `keyword` 为空但传了 `content_type` 时，可以按类型搜索消息，比如只查文件消息。

## 7. 客户端同步流程建议

### 7.1 点赞同步

1. 用户点击点赞按钮，调用 `POST /reactions`。
2. 所有在线端收到 `CMDSyncMessageReaction`。
3. 客户端调用 `POST /reaction/sync`，传入本地最大 `seq`。
4. 按 `message_id + uid` 更新本地点赞状态。
5. UI 聚合展示点赞数量、点赞用户头像和动画效果。

### 7.2 置顶同步

1. 用户长按消息选择置顶，调用 `POST /message/pinned`。
2. 所有在线端收到 `CMDSyncPinnedMessage`。
3. 客户端调用 `POST /message/pinned/sync`，传入本地最大 `version`。
4. 根据 `pinned_messages` 更新本地置顶列表。
5. 用 `messages` 渲染聊天顶部置顶条，取消置顶时移除。

### 7.3 文件消息发送

1. 调用 `GET /file/upload` 获取上传地址。
2. `multipart/form-data` 上传文件，拿到 `path`。
3. 构造 `type=8` 文件消息 payload。
4. 通过 IM SDK 发送，或用 `/message/send` 代发。
5. 接收端根据 `payload.url` 打开 `/file/preview/...` 查看或下载。

## 8. 对接检查清单

- 点赞列表展示前过滤 `is_deleted=1`。
- 点赞头像用 `uid` 走用户头像接口或本地用户缓存。
- 置顶消息必须同时保存 `message_id` 和 `message_seq`，否则后端会校验失败。
- 群普通成员置顶前，先确认群设置 `allow_member_pinned_message`。
- 文件消息上传返回的是 `path`，发送消息时放到 payload 的 `url` 字段。
- 搜索聊天内容推荐当前会话内传 `only_message=1 + channel_id + channel_type`。
