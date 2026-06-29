<template>
  <bd-page class="flex-col">
    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="record-title pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left">
          <p class="m-0 font-600">
            <el-text type="primary">{{ $route.query.name }}</el-text>
            的聊天记录
          </p>
        </div>
        <div class="flex items-center">
          <el-form inline @submit.prevent>
            <el-form-item class="mb-0 !mr-16px">
              <el-input v-model="queryFrom.keyword" placeholder="发送者名字/消息内容" clearable @keyup.enter="onSearch" />
            </el-form-item>
            <el-form-item class="mb-0 !mr-0">
              <el-button type="primary" @click="onSearch">查询</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="flex-1 overflow-hidden p-12px">
        <div class="record-chat-panel">
          <div class="record-chat-toolbar">
            <div>
              <div class="record-chat-title">{{ $route.query.name }}</div>
              <div class="record-chat-subtitle">群聊消息记录 · 共 {{ total }} 条</div>
            </div>
            <el-tag type="info" effect="plain">群聊</el-tag>
          </div>

          <div ref="chatListRef" v-loading="loadTable" class="record-chat-list">
            <el-empty v-if="!loadTable && tableData.length === 0" description="暂无聊天记录" />

            <div
              v-for="item in tableData"
              :key="item.message_id"
              class="record-chat-item"
              :class="{ 'is-outgoing': isOutgoing(item) }"
            >
              <el-avatar class="record-avatar" :src="avatarUrl(item)" :size="42">
                {{ senderInitial(item) }}
              </el-avatar>

              <div class="record-message">
                <div class="record-meta">
                  <span class="record-name">{{ senderName(item) }}</span>
                  <span class="record-uid">{{ item.sender }}</span>
                  <span class="record-time">{{ item.created_at }}</span>
                </div>

                <div class="record-bubble">
                  <template v-if="isEncrypted(item)">[加密消息，无法查看]</template>
                  <template v-else-if="messagePayload(displayPayload(item))">
                    <BdMsg :msg="messagePayload(displayPayload(item))" />
                  </template>
                  <template v-else-if="isRevoked(item)">[已撤回]</template>
                  <template v-else-if="isDeleted(item)">[已删除]</template>
                  <template v-else>[空消息]</template>
                </div>

                <div v-if="reactionText(item)" class="record-reactions">点赞：{{ reactionText(item) }}</div>

                <div class="record-tags">
                  <el-tag v-if="isRevoked(item)" size="small" type="warning" effect="plain">已撤回</el-tag>
                  <el-tag v-if="isDeleted(item)" size="small" type="danger" effect="plain">已删除</el-tag>
                  <span v-if="item.revoker">撤回者：{{ item.revoker }}</span>
                  <span>消息ID：{{ item.message_id }}</span>
                  <span v-if="item.device_name || item.device_model">
                    设备：{{ item.device_name || '-' }} {{ item.device_model || '' }}
                  </span>
                </div>

                <div class="record-actions">
                  <el-button size="small" link type="primary" @click="onDevices(item)">查看设备</el-button>
                  <el-button v-if="!isDeleted(item)" size="small" link type="danger" @click="onDel(item)">删除</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bd-card-footer pl-12px pr-12px mb-12px flex items-center justify-between">
        <div></div>
        <el-pagination
          v-model:current-page="queryFrom.page_index"
          v-model:page-size="queryFrom.page_size"
          :page-sizes="[15, 20, 30, 50, 100]"
          :background="true"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="onSizeChange"
          @current-change="onCurrentChange"
        />
      </div>
    </div>

    <Devices v-model:value="devicesValue" :uid="devicesUid" />
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 聊天记录
  isAffix: false
</route>

<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import BdMsg from '@/components/BdMsg/index.vue';
import Devices from './components/Devices.vue';

import { BU_DOU_CONFIG } from '@/config';
import { messageRecordGet, messageDelete } from '@/api/message';

const route = useRoute();
const tableData = ref<any[]>([]);
const loadTable = ref<boolean>(false);
const total = ref(0);
const chatListRef = ref<HTMLElement>();

const queryFrom = reactive({
  keyword: '',
  channel_id: route.query.groupNo,
  page_size: 15,
  page_index: 1,
  view_password: ''
});
const recordPasswordKey = 'meetme-manager-message-record-view-password';

const queryText = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value ? String(value) : '';
};

const avatarUrl = (item: any) => {
  return item?.sender ? `${BU_DOU_CONFIG.APP_URL}users/${item.sender}/avatar` : '';
};

const senderName = (item: any) => {
  return item?.sender_name || item?.sender || '未知用户';
};

const senderInitial = (item: any) => {
  return String(senderName(item)).slice(0, 1);
};

const isEncrypted = (item: any) => Number(item?.is_encrypt) === 1;
const isRevoked = (item: any) => Number(item?.revoke) === 1;
const isDeleted = (item: any) => Number(item?.is_deleted) === 1;

const displayPayload = (item: any) => {
  if (isRevoked(item) && item?.original_payload) {
    return item.original_payload;
  }
  return item?.payload;
};

const reactionText = (item: any) => {
  const list = Array.isArray(item?.reactions) ? item.reactions : [];
  if (list.length === 0) {
    return '';
  }
  return list
    .map((reaction: any) => `${reaction.emoji || '点赞'} ${reaction.name || reaction.uid || '-'}${Number(reaction.is_deleted) === 1 ? '(已取消)' : ''}`)
    .join('，');
};

const messagePayload = (payload: any) => {
  if (!payload) {
    return null;
  }
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (_err) {
      return { type: 1, content: payload };
    }
  }
  return payload;
};

const isOutgoing = (item: any) => {
  const focusUid = queryText(route.query.uid || route.query.sender || route.query.creator);
  return Boolean(focusUid && item?.sender === focusUid);
};

const ensureRecordPassword = async () => {
  if (queryFrom.view_password) {
    return true;
  }
  const cached = window.sessionStorage.getItem(recordPasswordKey) || '';
  if (cached) {
    queryFrom.view_password = cached;
    return true;
  }
  try {
    const password = await ElMessageBox.prompt('请输入聊天记录查看密码', '查看权限验证', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'password',
      closeOnClickModal: false,
      inputValidator(value) {
        return value.trim() !== '' || '请输入查看密码';
      }
    });
    queryFrom.view_password = password.value;
    window.sessionStorage.setItem(recordPasswordKey, password.value);
    return true;
  } catch (_err) {
    return false;
  }
};

const getUserList = async () => {
  if (!(await ensureRecordPassword())) {
    return;
  }
  loadTable.value = true;
  messageRecordGet(queryFrom)
    .then((res: any) => {
      tableData.value = res?.list || [];
      total.value = res?.count || 0;
      scrollChatToTop();
    })
    .catch((err: any) => {
      if (String(err?.msg || '').includes('密码')) {
        window.sessionStorage.removeItem(recordPasswordKey);
        queryFrom.view_password = '';
        ElMessage.error(err.msg || '聊天记录查看密码错误');
      }
    })
    .finally(() => {
      loadTable.value = false;
    });
};

const scrollChatToTop = () => {
  nextTick(() => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = 0;
    }
  });
};

const onSearch = () => {
  queryFrom.keyword = queryFrom.keyword.trim();
  queryFrom.page_index = 1;
  getUserList();
};

const onSizeChange = (size: number) => {
  queryFrom.page_size = size;
  queryFrom.page_index = 1;
  getUserList();
};

const onCurrentChange = (current: number) => {
  queryFrom.page_index = current;
  getUserList();
};

const msgDel = (data: any) => {
  const formData = {
    channel_id: route.query.groupNo,
    channel_type: 2,
    list: [
      {
        message_id: data.message_id,
        message_seq: data.message_seq
      }
    ]
  };
  messageDelete(formData).then((res: any) => {
    if (res.status == 200) {
      getUserList();
      ElMessage({
        type: 'success',
        message: '删除成功！'
      });
    }
  });
};

const onDel = (item: any) => {
  ElMessageBox.confirm('确定，是否删除此消息?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    closeOnClickModal: false,
    type: 'warning'
  })
    .then(() => {
      msgDel(item);
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '取消成功！'
      });
    });
};

const devicesValue = ref(false);
const devicesUid = ref('');

const onDevices = (item: any) => {
  if (item.sender) {
    devicesUid.value = item.sender;
    devicesValue.value = true;
  } else {
    ElMessage({
      type: 'warning',
      message: '无用户，不能查看设备！'
    });
  }
};

onMounted(() => {
  getUserList();
});
</script>

<style lang="scss" scoped>
.bd-title {
  border-bottom: 1px solid var(--el-card-border-color);
}

.record-title {
  min-height: 50px;
}

.record-chat-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #edf3f8;
}

.record-chat-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #dfe7ef;
  background: rgba(255, 255, 255, 0.88);
}

.record-chat-title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.record-chat-subtitle {
  margin-top: 4px;
  color: #7b8794;
  font-size: 12px;
}

.record-chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 24px 10px;
}

.record-chat-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;
}

.record-chat-item.is-outgoing {
  flex-direction: row-reverse;
}

.record-avatar {
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 12px rgba(31, 41, 55, 0.08);
}

.record-message {
  display: flex;
  max-width: 68%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}

.record-chat-item.is-outgoing .record-message {
  align-items: flex-end;
}

.record-meta {
  display: flex;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-bottom: 6px;
  color: #7b8794;
  font-size: 12px;
}

.record-name {
  max-width: 180px;
  overflow: hidden;
  color: #344054;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-uid,
.record-time {
  color: #98a2b3;
}

.record-bubble {
  max-width: 100%;
  padding: 12px 14px;
  border-radius: 8px 16px 16px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.08);
  color: #1f2937;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.record-chat-item.is-outgoing .record-bubble {
  border-radius: 16px 8px 16px 16px;
  background: #2f6df6;
  color: #fff;
}

.record-reactions {
  max-width: 100%;
  margin-top: 7px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.record-chat-item.is-outgoing .record-reactions {
  text-align: right;
}

.record-tags {
  display: flex;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
  color: #8a95a5;
  font-size: 12px;
}

.record-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

:deep(.record-bubble img) {
  max-width: 220px;
  border-radius: 8px;
}

:deep(.record-bubble video) {
  max-width: 260px;
  border-radius: 8px;
}

@media (max-width: 960px) {
  .record-title {
    height: auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .record-chat-list {
    padding-right: 14px;
    padding-left: 14px;
  }

  .record-message {
    max-width: calc(100% - 54px);
  }
}
</style>
