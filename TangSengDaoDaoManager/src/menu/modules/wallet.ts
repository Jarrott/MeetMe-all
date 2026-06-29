const wallet: Menu.MenuOptions = {
  component: '/wallet/user',
  name: 'wallet',
  path: '/wallet',
  meta: {
    icon: 'i-bd-wallet',
    isAffix: false,
    isFull: false,
    isHide: false,
    isKeepAlive: true,
    isLink: '',
    index: 5,
    title: '钱包'
  },
  children: [
    {
      component: '/wallet/user',
      name: 'walletUser',
      path: '/wallet/user',
      meta: {
        icon: 'i-bd-bill',
        isAffix: false,
        isFull: false,
        isHide: false,
        isKeepAlive: true,
        isLink: '',
        title: '用户钱包'
      }
    },
    {
      component: '/wallet/rates',
      name: 'walletRates',
      path: '/wallet/rates',
      meta: {
        icon: 'i-bd-setting',
        isAffix: false,
        isFull: false,
        isHide: false,
        isKeepAlive: true,
        isLink: '',
        title: '汇率配置'
      }
    }
  ]
};

export default wallet;
