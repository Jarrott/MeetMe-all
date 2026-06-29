import request from '@/utils/axios';

// 消息记录
export function messageGet(params: any) {
  return request({
    url: '/manager/message',
    method: 'get',
    params
  });
}

// 发消息
export function messageSendPost(data: any) {
  return request({
    url: '/manager/message/send',
    method: 'post',
    data
  });
}

// 删除消息
export function messageDelete(data: any) {
  return request({
    url: '/manager/message',
    method: 'delete',
    data
  });
}

// 发全员消息
export function messageSendAllPost(data: any) {
  return request({
    url: '/manager/message/sendall',
    method: 'post',
    data
  });
}

// 违禁词列表
export function messageProhibitWordsGet(params: any) {
  return request({
    url: '/manager/message/prohibit_words',
    method: 'get',
    params
  });
}
// 新增违禁词
export function messageProhibitWordsPost(params: any) {
  return request({
    url: '/manager/message/prohibit_words',
    method: 'post',
    params
  });
}
// 删除违禁词
export function messageProhibitWordsDelete(params: any) {
  return request({
    url: '/manager/message/prohibit_words',
    method: 'delete',
    params
  });
}

// 监听词列表，只用于服务端后台记录，不下发客户端
export function messageMonitorWordsGet(params: any) {
  return request({
    url: '/manager/message/monitor_words',
    method: 'get',
    params
  });
}

// 新增监听词
export function messageMonitorWordsPost(params: any) {
  return request({
    url: '/manager/message/monitor_words',
    method: 'post',
    params
  });
}

// 删除监听词
export function messageMonitorWordsDelete(params: any) {
  return request({
    url: '/manager/message/monitor_words',
    method: 'delete',
    params
  });
}

// 单聊天消息
export function messageRecordpersonalGet(params: any) {
  const { view_password, ...query } = params || {};
  return request({
    url: '/manager/message/recordpersonal',
    method: 'get',
    params: query,
    headers: view_password
      ? {
          'X-Message-Record-Password': view_password
        }
      : undefined
  });
}

// 群聊天消息
export function messageRecordGet(params: any) {
  const { view_password, ...query } = params || {};
  return request({
    url: '/manager/message/record',
    method: 'get',
    params: query,
    headers: view_password
      ? {
          'X-Message-Record-Password': view_password
        }
      : undefined
  });
}

// 查看设备
export function messageUserDevices(params: any) {
  return request({
    url: '/manager/user/devices',
    method: 'get',
    params
  });
}
