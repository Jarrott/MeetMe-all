import { defineStore } from 'pinia';

export const useManagerAlertStore = defineStore({
  id: 'budou-manager-alert',
  state: () => ({
    registerAuditUnreadCount: 0,
    prohibitWordUnreadCount: 0
  }),
  getters: {
    hasRegisterAuditUnread: state => state.registerAuditUnreadCount > 0,
    hasProhibitWordUnread: state => state.prohibitWordUnreadCount > 0
  },
  actions: {
    setRegisterAuditUnreadCount(count: number) {
      this.registerAuditUnreadCount = count;
    },
    setProhibitWordUnreadCount(count: number) {
      this.prohibitWordUnreadCount = count;
    }
  }
});
