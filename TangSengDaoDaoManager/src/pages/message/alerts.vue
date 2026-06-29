<template>
  <bd-page class="flex-col">
    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="alerts-title pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left flex items-center">
          <p class="m-0 font-600">违禁词触发记录</p>
          <el-tag v-if="unreadCount > 0" class="ml-8px" type="danger">{{ unreadCount }} 未读</el-tag>
        </div>
        <div class="alerts-toolbar">
          <el-form class="alerts-form" inline>
            <el-form-item class="alerts-form-item">
              <el-checkbox v-model="unreadOnly" class="unread-checkbox" @change="reload">只看未读</el-checkbox>
            </el-form-item>
            <el-form-item class="alerts-form-item alerts-actions">
              <el-button type="primary" @click="reload">查询</el-button>
              <el-button :disabled="!selectedIds.length && unreadCount === 0" @click="markRead">标记已读</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
      <div class="flex-1 overflow-hidden p-12px">
        <el-table
          v-loading="loadTable"
          :data="tableData"
          :border="true"
          style="width: 100%; height: 100%"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="45" fixed="left" />
          <el-table-column prop="is_read" label="状态" width="80">
            <template #default="scope">
              <el-tag :type="scope.row.is_read === 1 ? 'info' : 'danger'">{{ scope.row.is_read === 1 ? '已读' : '未读' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="actor_name" label="触发用户" width="130" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.actor_name || scope.row.actor_uid || '-' }}</template>
          </el-table-column>
          <el-table-column prop="actor_uid" label="用户ID" width="220" show-overflow-tooltip />
          <el-table-column prop="trigger_word" label="触发词" width="140" show-overflow-tooltip />
          <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
          <el-table-column prop="channel_id" label="频道" width="180" show-overflow-tooltip />
          <el-table-column prop="message_id" label="消息ID" width="160" show-overflow-tooltip />
          <el-table-column prop="created_at" label="时间" width="180" />
          <el-table-column label="操作" fixed="right" width="130" align="center">
            <template #default="scope">
              <el-button @click="openDetail(scope.row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
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

    <el-dialog v-model="detailVisible" title="提醒详情" width="720px" destroy-on-close>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="类型">违禁词触发</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detailRow.is_read === 1 ? '已读' : '未读' }}</el-descriptions-item>
        <el-descriptions-item label="触发用户">{{ detailRow.actor_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户ID">{{ detailRow.actor_uid || '-' }}</el-descriptions-item>
        <el-descriptions-item label="触发词">{{ detailRow.trigger_word || '-' }}</el-descriptions-item>
        <el-descriptions-item label="时间">{{ detailRow.created_at }}</el-descriptions-item>
        <el-descriptions-item label="频道">{{ detailRow.channel_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="消息ID">{{ detailRow.message_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="内容" :span="2">{{ detailRow.content || '-' }}</el-descriptions-item>
        <el-descriptions-item label="原始数据" :span="2">
          <pre class="payload-pre">{{ formatPayload(detailRow.payload) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detailRow.is_read !== 1" type="primary" @click="markOneRead(detailRow)">标记已读</el-button>
      </template>
    </el-dialog>
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 违禁词触发记录
  isAffix: false
</route>

<script lang="ts" setup>
import { ElMessage } from 'element-plus';
import { managerAlertsGet, managerAlertsReadPost, managerAlertsSummaryGet } from '@/api/setting';

const tableData = ref<any[]>([]);
const loadTable = ref(false);
const total = ref(0);
const unreadCount = ref(0);
const unreadOnly = ref(false);
const selectedIds = ref<number[]>([]);
const detailVisible = ref(false);
const detailRow = ref<any>({});

const queryFrom = reactive({
  type: 'prohibit_word',
  unread: 0,
  page_size: 15,
  page_index: 1
});

const getSummary = async () => {
  const res: any = await managerAlertsSummaryGet();
  unreadCount.value = getUnreadCountByType(res?.by_type, 'prohibit_word');
};

const getTableList = () => {
  loadTable.value = true;
  const params = {
    ...queryFrom,
    type: 'prohibit_word',
    unread: unreadOnly.value ? 1 : 0
  };
  managerAlertsGet(params)
    .then((res: any) => {
      tableData.value = res.list || [];
      total.value = res.count || 0;
    })
    .finally(() => {
      loadTable.value = false;
    });
};

const reload = () => {
  queryFrom.page_index = 1;
  getSummary();
  getTableList();
};

const onSizeChange = (size: number) => {
  queryFrom.page_size = size;
  getTableList();
};

const onCurrentChange = (current: number) => {
  queryFrom.page_index = current;
  getTableList();
};

const onSelectionChange = (rows: any[]) => {
  selectedIds.value = rows.map(row => row.id);
};

const markRead = async () => {
  await managerAlertsReadPost({
    ids: selectedIds.value,
    type: selectedIds.value.length ? '' : 'prohibit_word'
  });
  ElMessage.success('已标记');
  selectedIds.value = [];
  reload();
};

const markOneRead = async (row: any) => {
  await managerAlertsReadPost({ ids: [row.id] });
  ElMessage.success('已标记');
  detailVisible.value = false;
  reload();
};

const openDetail = (row: any) => {
  detailRow.value = row;
  detailVisible.value = true;
};

const formatPayload = (payload: string) => {
  if (!payload) return '-';
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
};

const getUnreadCountByType = (items: any, type: string) => {
  if (items && !Array.isArray(items)) return Number(items[type] || 0);
  if (!Array.isArray(items)) return 0;
  const item = items.find((v: any) => v?.alert_type === type);
  return Number(item?.unread_count || item?.count || 0);
};

onMounted(() => {
  reload();
});
</script>

<style lang="scss" scoped>
.bd-title {
  border-bottom: 1px solid var(--el-card-border-color);
}

.alerts-title {
  min-height: 50px;
  gap: 12px;
}

.bd-title-left {
  min-width: 0;
}

.alerts-toolbar {
  display: flex;
  flex: 0 1 auto;
  justify-content: flex-end;
  min-width: 0;
}

.alerts-form {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
}

.alerts-form-item {
  margin: 0 !important;
}

.unread-checkbox {
  min-width: 78px;
  white-space: nowrap;
}

.alerts-actions {
  white-space: nowrap;
}

.payload-pre {
  max-height: 260px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
