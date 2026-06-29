<template>
  <span class="hidden"></span>
</template>

<script setup lang="ts">
import { ElNotification } from 'element-plus';
import { useRouter } from 'vue-router';
import { managerAlertsSummaryGet } from '@/api/setting';
import { useManagerAlertStore } from '@/stores/modules/managerAlert';

let timer: ReturnType<typeof setInterval> | undefined;
let lastUnreadCount: number | undefined;
let lastRegisterAuditUnreadCount: number | undefined;
const router = useRouter();
const managerAlertStore = useManagerAlertStore();

const playNoticeSound = () => {
  try {
    const audio = new Audio('/audio/register.mp3');
    audio.volume = 1;
    audio.play().catch(() => {});
  } catch {
    // 浏览器可能在没有用户交互前阻止声音，忽略即可。
  }
};

const pollAlerts = async () => {
  try {
    const res: any = await managerAlertsSummaryGet();
    const unreadCount = Number(res?.unread_count || 0);
    const registerAuditUnreadCount = getUnreadCountByType(res?.by_type, 'register_audit');
    const prohibitWordUnreadCount = getUnreadCountByType(res?.by_type, 'prohibit_word');
    managerAlertStore.setRegisterAuditUnreadCount(registerAuditUnreadCount);
    managerAlertStore.setProhibitWordUnreadCount(prohibitWordUnreadCount);
    if (lastRegisterAuditUnreadCount !== undefined && registerAuditUnreadCount > lastRegisterAuditUnreadCount) {
      playNoticeSound();
      ElNotification({
        title: '新注册用户待审核',
        message: '有新用户注册进来，请及时审核',
        type: 'info',
        duration: 7000,
        onClick: () => router.push('/user/audit')
      });
    }
    const latest = Array.isArray(res.latest) ? res.latest[0] : undefined;
    if (lastUnreadCount !== undefined && unreadCount > lastUnreadCount && latest?.alert_type !== 'register_audit') {
      playNoticeSound();
      ElNotification({
        title: latest?.title || '后台提醒',
        message: latest?.content || '有新的后台提醒',
        type: latest?.alert_type === 'prohibit_word' ? 'warning' : 'info',
        duration: 6000,
        onClick: () => router.push('/message/alerts')
      });
    }
    lastUnreadCount = unreadCount;
    lastRegisterAuditUnreadCount = registerAuditUnreadCount;
  } catch {
    // 登录过期或网络抖动时不打扰当前页面。
  }
};

const getUnreadCountByType = (items: any, type: string) => {
  if (items && !Array.isArray(items)) return Number(items[type] || 0);
  if (!Array.isArray(items)) return 0;
  const item = items.find((v: any) => v?.alert_type === type);
  return Number(item?.unread_count || item?.count || 0);
};

onMounted(() => {
  pollAlerts();
  timer = setInterval(pollAlerts, 15000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>
