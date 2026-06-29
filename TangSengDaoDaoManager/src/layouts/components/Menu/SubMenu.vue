<template>
  <template v-for="subItem in menuList" :key="subItem.path">
    <el-sub-menu v-if="subItem.children?.length" :index="subItem.path">
      <template #title>
        <el-icon>
          <component :is="subItem.meta.icon"></component>
        </el-icon>
        <span class="sle">{{ subItem.meta.title }}</span>
      </template>
      <SubMenu :menu-list="subItem.children" />
    </el-sub-menu>
    <el-menu-item v-else :index="subItem.path" @click="handleClickMenu(subItem)">
      <el-icon>
        <component :is="subItem.meta.icon"></component>
      </el-icon>
      <template #title>
          <span class="sle menu-title-with-dot">
            {{ subItem.meta.title }}
            <span v-if="showAlertDot(subItem)" class="menu-red-dot"></span>
          </span>
      </template>
    </el-menu-item>
  </template>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useManagerAlertStore } from '@/stores/modules/managerAlert';

defineProps<{ menuList: Menu.MenuOptions[] }>();

const router = useRouter();
const managerAlertStore = useManagerAlertStore();
const handleClickMenu = (subItem: Menu.MenuOptions) => {
  if (subItem.meta.isLink) return window.open(subItem.meta.isLink, '_blank');
  router.push(subItem.path);
};
const showAlertDot = (subItem: Menu.MenuOptions) => {
  if (subItem.path === '/user/audit') return managerAlertStore.hasRegisterAuditUnread;
  if (subItem.path === '/message/alerts') return managerAlertStore.hasProhibitWordUnread;
  return false;
};
</script>

<style lang="scss">
.el-sub-menu .el-sub-menu__title:hover {
  color: var(--el-menu-hover-text-color) !important;
  background-color: transparent !important;
}
.el-menu--collapse {
  .is-active {
    .el-sub-menu__title {
      color: #ffffff !important;
      background-color: var(--el-color-primary) !important;
    }
  }
}
.el-menu-item {
  &:hover {
    color: var(--el-menu-hover-text-color);
  }
  &.is-active {
    color: var(--el-menu-active-color) !important;
    background-color: var(--el-menu-active-bg-color) !important;
    &::before {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 4px;
      content: '';
      background-color: var(--el-color-primary);
    }
  }
}
.menu-title-with-dot {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}
.menu-red-dot {
  width: 8px;
  height: 8px;
  margin-left: 6px;
  background: var(--el-color-danger);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--el-menu-bg-color);
}
.vertical,
.classic,
.transverse {
  .el-menu-item {
    &.is-active {
      &::before {
        left: 0;
      }
    }
  }
}
.columns {
  .el-menu-item {
    &.is-active {
      &::before {
        right: 0;
      }
    }
  }
}
.classic,
.transverse {
  #driver-highlighted-element-stage {
    background-color: #606266 !important;
  }
}
</style>
