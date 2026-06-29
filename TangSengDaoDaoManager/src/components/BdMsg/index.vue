<template>
  <div>
    <!-- 文本 -->
    <span v-if="msg.type == 1">
      {{ msg['content'] }}
    </span>
    <!-- 图片 -->
    <img
      v-else-if="msg.type == 2"
      class="w-120px cursor-pointer"
      :src="`${url}${msg['url']}`"
      @click="previewPicture(`${url}${msg['url']}`, 'image')"
    />
    <!-- GIF -->
    <img
      v-else-if="msg.type == 3"
      class="w-120px cursor-pointer"
      :src="`${url}${msg['url']}`"
      @click="previewPicture(`${url}${msg['url']}`, 'image')"
    />
    <!-- 多图组 -->
    <div v-else-if="isImageGroupMessage(msg)" class="bd-image-group">
      <div class="bd-image-group-title">多图组 · {{ imageGroupItems(msg).length }} 张</div>
      <div class="bd-image-group-grid">
        <img
          v-for="(image, index) in imageGroupItems(msg)"
          :key="`${image.url || image.thumb || index}`"
          class="bd-image-group-item"
          :src="imageUrl(image, true)"
          @click="previewImageGroup(msg, index)"
        />
      </div>
      <div v-if="msg['caption']" class="bd-image-group-caption">{{ msg['caption'] }}</div>
    </div>
    <!-- 语音 -->
    <audio v-else-if="msg.type == 4" :src="`${url}${msg['url']}`"></audio>
    <!-- 视频 -->
    <video
      v-else-if="msg.type == 5"
      controls
      controlsList="nofullscreen nodownload noplaybackrate noremote footbar"
      disablePictureInPicture
      :src="`${url}${msg['url']}`"
      class="w-220px h-100px cursor-pointer"
      @click="previewPicture(`${url}${msg['url']}`, 'image')"
    ></video>
    <!-- 位置 -->
    <div v-else-if="msg.type == 6">
      <div>位置标题：{{ msg['title'] }}</div>
      <div>地址：{{ msg['address'] }}</div>
    </div>
    <!-- 名片 -->
    <div v-else-if="msg.type == 7">
      <div>名片UID：{{ msg['uid'] }}</div>
      <div>用户名：{{ msg['name'] }}</div>
    </div>
    <!-- 文件 -->
    <div v-else-if="msg.type == 8">
      <div>文件标题：{{ msg['title'] }}</div>
      <div>地址：{{ msg['address'] }}</div>
    </div>
    <!-- 红包 -->
    <div v-else-if="msg.type == 9">
      <div>红包编号：{{ msg['redpacket_no'] }}</div>
      <div>祝福语：{{ msg['blessing'] }}</div>
    </div>
    <!-- 转账 -->
    <div v-else-if="msg.type == 10" class="bd-msg-detail">
      <div class="bd-msg-title">转账信息</div>
      <div>金额：{{ formatAmount(msg['amount']) }}</div>
      <div v-if="firstValue(msg, ['currency', 'unit'])">币种：{{ firstValue(msg, ['currency', 'unit']) }}</div>
      <div v-if="firstValue(msg, ['from_uid', 'from'])">转出方：{{ firstValue(msg, ['from_uid', 'from']) }}</div>
      <div v-if="firstValue(msg, ['to_uid', 'to'])">收款方：{{ firstValue(msg, ['to_uid', 'to']) }}</div>
      <div v-if="msg['trade_no']">交易号：{{ msg['trade_no'] }}</div>
      <div v-if="msg['remark']">备注：{{ msg['remark'] }}</div>
      <div v-if="extraEntries(msg, ['type', 'amount', 'currency', 'unit', 'from_uid', 'from', 'to_uid', 'to', 'trade_no', 'remark']).length" class="bd-msg-extra">
        <div v-for="item in extraEntries(msg, ['type', 'amount', 'currency', 'unit', 'from_uid', 'from', 'to_uid', 'to', 'trade_no', 'remark'])" :key="item.key">
          {{ item.key }}：{{ item.value }}
        </div>
      </div>
    </div>
    <!-- 合并转发 -->
    <span v-else-if="msg.type == 11"> [合并转发] </span>
    <!-- 动态表情 -->
    <tgs-player
      v-else-if="msg.type == 12"
      :src="`${url}${msg['url']}`"
      :data-src="`${url}${msg['url']}`"
      autoplay
      loop
      mode="normal"
      style="width: 120px; height: 100px"
    ></tgs-player>
    <!-- 矢量emoji -->
    <template v-else-if="msg.type == 13">
      <tgs-player
        v-if="msg.type == 13 && msg['url']"
        :src="`${url}${msg['url']}`"
        :data-src="`${url}${msg['url']}`"
        autoplay
        loop
        mode="normal"
        style="width: 120px; height: 100px"
      ></tgs-player>
      <span v-else> {{ msg['content'] ? msg['content'] : `[矢量emoji]` }} </span>
    </template>
    <!-- 音视频通话 -->
    <div v-else-if="isRTCMessage(msg)" class="bd-msg-detail bd-rtc-msg">
      <div class="bd-msg-title bd-rtc-title">
        <span class="bd-rtc-icon">{{ rtcIcon(msg) }}</span>
        <span>{{ rtcTitle(msg) }}</span>
      </div>
      <div class="bd-rtc-summary">{{ rtcSummary(msg) }}</div>
      <div v-if="rtcDurationText(msg)">通话时长：{{ rtcDurationText(msg) }}</div>
      <div v-if="rtcCaller(msg)">发起人：{{ rtcCaller(msg) }}</div>
      <div v-if="rtcCallee(msg)">接收人：{{ rtcCallee(msg) }}</div>
      <div v-if="rtcValue(msg, ['room', 'room_id', 'roomID', 'room_name', 'roomName'])">
        房间：{{ rtcValue(msg, ['room', 'room_id', 'roomID', 'room_name', 'roomName']) }}
      </div>
      <div v-if="rtcValue(msg, ['call_id', 'callID', 'call_no', 'callNo'])">通话ID：{{ rtcValue(msg, ['call_id', 'callID', 'call_no', 'callNo']) }}</div>
      <div v-if="rtcExtraEntries(msg).length" class="bd-msg-extra">
        <div v-for="item in rtcExtraEntries(msg)" :key="item.key">{{ item.label }}：{{ item.value }}</div>
      </div>
    </div>
    <!-- 系统消息 -->
    <div v-else-if="msg.type >= 1000 && msg.type <= 2000" class="bd-msg-detail">
      <div class="bd-msg-title">{{ systemMessageTitle(msg) }}</div>
      <div v-if="systemMessageSummary(msg)">{{ systemMessageSummary(msg) }}</div>
      <div v-for="item in systemEntries(msg)" :key="item.key">{{ item.label }}：{{ item.value }}</div>
    </div>
    <!-- 未知消息类型 -->
    <span v-else> [未知消息类型] </span>
  </div>
</template>

<script lang="tsx" name="BdMsg" setup>
import { Fancybox } from '@fancyapps/ui';
import '@lottiefiles/lottie-player/dist/tgs-player';
import { BU_DOU_CONFIG } from '@/config';
interface IProps {
  msg: any;
}
defineProps<IProps>();
const url = BU_DOU_CONFIG.APP_URL;

const fieldLabels: Record<string, string> = {
  type: '消息类型',
  content: '内容',
  text: '文本',
  title: '标题',
  from_uid: '发送者',
  from_name: '发送者名称',
  to_uid: '接收者',
  to_name: '接收者名称',
  uid: '用户UID',
  name: '用户名称',
  group_no: '群编号',
  group_name: '群名称',
  channel_id: '频道ID',
  channel_type: '频道类型',
  operator_uid: '操作人',
  operator_name: '操作人名称',
  revoker: '撤回者',
  message_id: '消息ID',
  message_seq: '消息序号',
  call_id: '通话ID',
  callID: '通话ID',
  call_no: '通话编号',
  callNo: '通话编号',
  call_type: '通话类型',
  callType: '通话类型',
  call_type_value: '通话类型值',
  callTypeValue: '通话类型值',
  rtc_call_type: '通话类型',
  rtcCallType: '通话类型',
  media_type: '媒体类型',
  mediaType: '媒体类型',
  caller_uid: '发起人',
  callerUID: '发起人',
  callee_uid: '接收人',
  calleeUID: '接收人',
  target_uid: '接收人',
  targetUID: '接收人',
  peer_uid: '对端用户',
  peerUID: '对端用户',
  result_type: '通话结果',
  resultType: '通话结果',
  operation: '操作',
  action: '动作',
  cmd: '命令',
  param: '参数',
  room: '房间',
  room_id: '房间ID',
  roomID: '房间ID',
  room_name: '房间',
  roomName: '房间',
  duration: '时长',
  elapsed: '时长',
  time_length: '时长',
  timeLength: '时长',
  status: '状态',
  reason: '原因',
  platform: '平台',
  timestamp: '时间戳',
  remark: '备注',
  amount: '金额',
  trade_no: '交易号'
};

const systemTitles: Record<number, string> = {
  1014: '截屏消息'
};

const rtcMessageTypes = new Set([9989, 9990, 9991, 9992, 9993, 9994, 9995, 9996, 9997, 9998, 9999]);

const rtcTypeTitles: Record<number, string> = {
  9989: '通话结果',
  9990: '切换到视频通话',
  9991: '切换到视频回复',
  9992: '已取消通话',
  9993: '切换到语音通话',
  9994: '通话信令',
  9995: '未接听通话',
  9996: '收到来电',
  9997: '已拒绝通话',
  9998: '已接通通话',
  9999: '通话已结束'
};

const rtcResultTitles: Record<string, string> = {
  '0': '已取消通话',
  cancel: '已取消通话',
  canceled: '已取消通话',
  cancelled: '已取消通话',
  cancel_call: '已取消通话',
  cancelled_call: '已取消通话',
  '1': '通话已结束',
  hangup: '通话已结束',
  hungup: '通话已结束',
  hang_up: '通话已结束',
  hangup_call: '通话已结束',
  finish: '通话已结束',
  finished: '通话已结束',
  finish_call: '通话已结束',
  complete: '通话已结束',
  completed: '通话已结束',
  complete_call: '通话已结束',
  end: '通话已结束',
  ended: '通话已结束',
  '2': '未接听通话',
  missed: '未接听通话',
  timeout: '未接听通话',
  no_answer: '未接听通话',
  noanswer: '未接听通话',
  noAnswer: '未接听通话',
  '3': '已拒绝通话',
  refuse: '已拒绝通话',
  refused: '已拒绝通话',
  refuse_call: '已拒绝通话',
  reject: '已拒绝通话',
  rejected: '已拒绝通话',
  reject_call: '已拒绝通话',
  busy: '已拒绝通话',
  invite: '发起通话',
  invited: '发起通话',
  invite_call: '发起通话',
  call: '发起通话',
  calling: '呼叫中',
  accept: '已接通通话',
  accepted: '已接通通话',
  accept_call: '已接通通话',
  answer: '已接通通话',
  answered: '已接通通话',
  answer_call: '已接通通话',
  connect: '已接通通话',
  connected: '已接通通话',
  connect_call: '已接通通话'
};

const rtcCallTypeTitles: Record<string, string> = {
  '0': '语音通话',
  audio: '语音通话',
  voice: '语音通话',
  '1': '视频通话',
  video: '视频通话'
};

const stringifyValue = (value: any) => {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const firstValue = (data: any, keys: string[]) => {
  for (const key of keys) {
    if (data?.[key] !== undefined && data?.[key] !== null && data?.[key] !== '') {
      return data[key];
    }
  }
  return '';
};

const extraEntries = (data: any, excludes: string[] = []) => {
  return Object.keys(data || {})
    .filter(key => !excludes.includes(key))
    .map(key => ({ key, label: fieldLabels[key] || key, value: stringifyValue(data[key]) }));
};

const objectValue = (value: any) => {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_err) {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const rtcParam = (data: any) => objectValue(data?.param);

const rtcValue = (data: any, keys: string[]) => {
  return firstValue(data, keys) || firstValue(rtcParam(data), keys);
};

const rtcDetailData = (data: any) => {
  const { param: _param, ...rest } = data || {};
  return {
    ...rtcParam(data),
    ...rest
  };
};

const normalizedText = (value: any) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

const normalizedKey = (value: any) => normalizedText(value).replace(/[\s-]/g, '_');

const firstNormalizedValue = (data: any, keys: string[]) => {
  const value = firstValue(data, keys);
  return normalizedText(value);
};

const isRTCMessage = (data: any) => {
  const type = Number(data?.type);
  const cmd = firstNormalizedValue(data, ['cmd']).toLowerCase();
  return rtcMessageTypes.has(type) || cmd === 'room.invoke' || cmd.startsWith('rtc.') || Boolean(rtcValue(data, ['call_id', 'callID']) && rtcValue(data, ['call_type', 'callType']));
};

const rtcCallTypeText = (data: any) => {
  const raw = normalizedText(rtcValue(data, ['call_type', 'callType', 'rtc_call_type', 'rtcCallType', 'media_type', 'mediaType']));
  if (!raw) {
    return Number(data?.type) === 9990 ? '视频通话' : '通话';
  }
  return rtcCallTypeTitles[raw] || rtcCallTypeTitles[raw.toLowerCase()] || raw;
};

const rtcResultText = (data: any) => {
  const type = Number(data?.type);
  const cmd = firstNormalizedValue(data, ['cmd']).toLowerCase();
  const candidates = [
    normalizedText(rtcValue(data, ['result_type', 'resultType', 'result'])),
    normalizedText(rtcValue(data, ['operation', 'action', 'status', 'event'])),
    cmd ? cmd.split('.').pop() || '' : ''
  ].filter(Boolean);

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const direct = rtcResultTitles[candidate] || rtcResultTitles[lower] || rtcResultTitles[normalizedKey(lower)];
    if (direct) {
      return direct;
    }
  }
  return rtcTypeTitles[type] || '通话消息';
};

const rtcTitle = (data: any) => {
  const callType = rtcCallTypeText(data);
  const result = rtcResultText(data);
  if (result.includes(callType) || callType === '通话') {
    return result;
  }
  return `${callType} · ${result}`;
};

const rtcIcon = (data: any) => {
  const callType = rtcCallTypeText(data);
  if (callType.includes('视频')) {
    return '视';
  }
  return '音';
};

const rtcSummary = (data: any) => {
  const result = rtcResultText(data);
  const callType = rtcCallTypeText(data);
  if (result === '已接通通话') {
    return `${callType}已接通`;
  }
  if (result === '通话已结束') {
    return `${callType}已完成`;
  }
  if (result === '已拒绝通话') {
    return `${callType}已拒绝`;
  }
  if (result === '已取消通话') {
    return `${callType}已取消`;
  }
  if (result === '未接听通话') {
    return `${callType}未接听`;
  }
  if (result === '发起通话' || result === '收到来电') {
    return `${callType}${result}`;
  }
  return `${callType}${result}`;
};

const formatDuration = (value: any) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (num: number) => String(num).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const rtcDurationText = (data: any) => {
  return formatDuration(rtcValue(data, ['duration', 'elapsed', 'time_length', 'timeLength', 'seconds']));
};

const rtcCaller = (data: any) => {
  return rtcValue(data, ['from_uid', 'fromUID', 'from', 'caller_uid', 'callerUID', 'caller', 'inviter_uid', 'inviterUID', 'inviter']);
};

const rtcCallee = (data: any) => {
  return rtcValue(data, ['to_uid', 'toUID', 'to', 'callee_uid', 'calleeUID', 'callee', 'target_uid', 'targetUID', 'target', 'invitee_uid', 'inviteeUID', 'invitee']);
};

const rtcExtraEntries = (data: any) => {
  return extraEntries(rtcDetailData(data), [
    'type',
    'cmd',
    'param',
    'call_type',
    'callType',
    'call_type_value',
    'callTypeValue',
    'rtc_call_type',
    'rtcCallType',
    'media_type',
    'mediaType',
    'result_type',
    'resultType',
    'result',
    'operation',
    'action',
    'status',
    'event',
    'duration',
    'elapsed',
    'time_length',
    'timeLength',
    'seconds',
    'from_uid',
    'fromUID',
    'from',
    'caller_uid',
    'callerUID',
    'caller',
    'inviter_uid',
    'inviterUID',
    'inviter',
    'to_uid',
    'toUID',
    'to',
    'callee_uid',
    'calleeUID',
    'callee',
    'target_uid',
    'targetUID',
    'target',
    'invitee_uid',
    'inviteeUID',
    'invitee',
    'peer_uid',
    'peerUID',
    'room',
    'room_id',
    'roomID',
    'room_name',
    'roomName',
    'call_id',
    'callID',
    'call_no',
    'callNo'
  ]);
};

const formatAmount = (value: any) => {
  const amount = Number(value);
  if (Number.isFinite(amount)) {
    return amount.toFixed(2).replace(/\.00$/, '');
  }
  return stringifyValue(value);
};

const systemMessageTitle = (data: any) => {
  return systemTitles[Number(data?.type)] || `系统消息 ${data?.type || ''}`.trim();
};

const systemMessageSummary = (data: any) => {
  return firstValue(data, ['content', 'text', 'title']);
};

const systemEntries = (data: any) => {
  return extraEntries(data, ['type', 'content', 'text', 'title']).map(item => ({
    ...item,
    key: item.key,
    label: item.label
  }));
};

const messageType = (data: any) => {
  const type = Number(data?.type);
  return Number.isFinite(type) ? type : 0;
};

const isImageGroupMessage = (data: any) => {
  return messageType(data) === 21 || Array.isArray(data?.images);
};

const imageGroupItems = (data: any) => {
  return Array.isArray(data?.images) ? data.images.filter((item: any) => item && (item.url || item.thumb)) : [];
};

const imageUrl = (image: any, thumbnail = false) => {
  const imagePath = thumbnail ? image?.thumb || image?.url : image?.url || image?.thumb;
  if (!imagePath) {
    return '';
  }
  if (/^https?:\/\//.test(imagePath) || imagePath.startsWith('data:') || imagePath.startsWith('blob:')) {
    return imagePath;
  }
  return `${url}${imagePath}`;
};

// 图片预览
const previewPicture = (url: string, type: string) => {
  const imgList = [];
  imgList.push({ src: url, defaultType: type });
  Fancybox.show(imgList, {
    Toolbar: {
      display: {
        left: ['infobar'],
        middle: ['zoomIn', 'zoomOut', 'toggle1to1', 'rotateCCW', 'rotateCW', 'flipX', 'flipY'],
        right: ['slideshow', 'thumbs', 'close']
      }
    }
  });
};

const previewImageGroup = (data: any, startIndex = 0) => {
  const imgList = imageGroupItems(data).map((image: any) => ({
    src: imageUrl(image, false),
    thumb: imageUrl(image, true),
    defaultType: 'image'
  }));
  if (imgList.length === 0) {
    return;
  }
  Fancybox.show(imgList, {
    startIndex,
    Toolbar: {
      display: {
        left: ['infobar'],
        middle: ['zoomIn', 'zoomOut', 'toggle1to1', 'rotateCCW', 'rotateCW', 'flipX', 'flipY'],
        right: ['slideshow', 'thumbs', 'close']
      }
    }
  });
};
</script>

<style scoped>
.bd-msg-detail {
  display: grid;
  gap: 4px;
}

.bd-msg-title {
  font-weight: 600;
}

.bd-msg-extra {
  margin-top: 4px;
  opacity: 0.88;
}

.bd-rtc-msg {
  min-width: 180px;
  padding: 10px 12px;
  border: 1px solid #d9e7ff;
  border-radius: 8px;
  background: #f5f9ff;
  color: #27364f;
}

.bd-rtc-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1d4ed8;
}

.bd-rtc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2f6fed;
  color: #fff;
  font-size: 12px;
}

.bd-rtc-summary {
  color: #334155;
}

.bd-image-group {
  display: grid;
  gap: 6px;
  max-width: 260px;
}

.bd-image-group-title {
  color: #606266;
  font-size: 12px;
}

.bd-image-group-grid {
  display: grid;
  grid-template-columns: repeat(2, 86px);
  gap: 4px;
}

.bd-image-group-item {
  width: 86px;
  height: 86px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  background: #f2f3f5;
}

.bd-image-group-caption {
  max-width: 220px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 20px;
}

video::-webkit-media-controls-timeline {
  display: none;
}
video::-webkit-media-controls-mute-button {
  display: none;
}
video::-webkit-media-controls-toggle-closed-captions-button {
  display: none;
}
video::-webkit-media-controls-volume-slider {
  display: none;
}
video::-webkit-media-controls-fullscreen-button {
  display: none;
}
</style>
