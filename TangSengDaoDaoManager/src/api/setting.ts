import request from '@/utils/axios';

// 更新密码
export function userUpdatepasswordPost(data: any) {
  return request({
    url: '/manager/user/updatepassword',
    method: 'post',
    data
  });
}

// 获取通用设置
export function getAppconfigGet(params?: any) {
  return request({
    url: '/manager/common/appconfig',
    method: 'get',
    params
  });
}

// 更新通用设置
export function updateAppconfigPost(data: any) {
  return request({
    url: '/manager/common/appconfig',
    method: 'post',
    data
  });
}

// 后台提醒汇总
export function managerAlertsSummaryGet() {
  return request({
    url: '/manager/common/alerts/summary',
    method: 'get'
  });
}

// 后台提醒列表
export function managerAlertsGet(params: any) {
  return request({
    url: '/manager/common/alerts',
    method: 'get',
    params
  });
}

// 标记后台提醒已读
export function managerAlertsReadPost(data: any) {
  return request({
    url: '/manager/common/alerts/read',
    method: 'post',
    data
  });
}
