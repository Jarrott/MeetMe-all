import request from '@/utils/axios';

export function managerWalletBalanceGet(uid: string) {
  return request({
    url: `/manager/wallet/${uid}/balance`,
    method: 'get'
  });
}

export function managerWalletTransactionsGet(uid: string, params: any) {
  return request({
    url: `/manager/wallet/${uid}/transactions`,
    method: 'get',
    params
  });
}

export function managerWalletRechargePost(uid: string, data: any) {
  return request({
    url: `/manager/wallet/${uid}/recharge`,
    method: 'post',
    data
  });
}

export function managerWalletDeductPost(uid: string, data: any) {
  return request({
    url: `/manager/wallet/${uid}/deduct`,
    method: 'post',
    data
  });
}

export function managerWalletWithdrawsGet(params: any) {
  return request({
    url: '/manager/wallet/withdraws',
    method: 'get',
    params
  });
}

export function managerWalletWithdrawApprovePost(tradeNo: string) {
  return request({
    url: `/manager/wallet/withdraws/${tradeNo}/approve`,
    method: 'post'
  });
}

export function managerWalletWithdrawRejectPost(tradeNo: string) {
  return request({
    url: `/manager/wallet/withdraws/${tradeNo}/reject`,
    method: 'post'
  });
}

export function managerWalletExchangeRatesGet(params: any) {
  return request({
    url: '/manager/wallet/exchange-rates',
    method: 'get',
    params
  });
}

export function managerWalletExchangeRatesPost(data: any) {
  return request({
    url: '/manager/wallet/exchange-rates',
    method: 'post',
    data
  });
}
