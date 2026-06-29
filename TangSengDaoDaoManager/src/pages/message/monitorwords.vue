<template>
  <bd-page class="flex-col">
    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="monitor-title pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left">
          <p class="m-0 font-600">监听词列表</p>
        </div>
        <div class="monitor-toolbar">
          <el-form class="monitor-form" inline>
            <el-form-item class="monitor-form-item">
              <el-input v-model="queryFrom.search_key" class="monitor-search" placeholder="请输入监听词" clearable />
            </el-form-item>
            <el-form-item class="monitor-form-item monitor-actions">
              <el-button type="primary" @click="getTableList">查询</el-button>
              <el-button type="primary" @click="openAddDialog">新增监听词</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
      <div class="flex-1 overflow-hidden p-12px">
        <el-table v-loading="loadTable" :data="tableData" :border="true" style="width: 100%; height: 100%">
          <el-table-column type="index" :width="42" :align="'center'" :fixed="'left'">
            <template #header>
              <i-bd-setting class="cursor-pointer" size="16" />
            </template>
          </el-table-column>
          <el-table-column prop="content" label="监听词" min-width="220" show-overflow-tooltip />
          <el-table-column prop="is_deleted" label="是否删除" width="120">
            <template #default="scope">
              <el-text :type="scope.row.is_deleted === 1 ? 'danger' : ''">{{ scope.row.is_deleted === 1 ? '是' : '否' }}</el-text>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="220" />
          <el-table-column label="操作" align="center" fixed="right" width="120">
            <template #default="scope">
              <el-button :type="scope.row.is_deleted === 0 ? 'danger' : 'warning'" @click="onDel(scope.row)">
                {{ scope.row.is_deleted === 0 ? '删除' : '恢复' }}
              </el-button>
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

    <el-dialog v-model="addVisible" title="添加监听词" width="600px" destroy-on-close>
      <el-input v-model="monitorWordContent" :rows="6" type="textarea" placeholder="请输入监听词" />
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" @click="submitMonitorWord">确定</el-button>
      </template>
    </el-dialog>
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 监听词列表
  isAffix: false
</route>

<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus';
import { messageMonitorWordsDelete, messageMonitorWordsGet, messageMonitorWordsPost } from '@/api/message';

const tableData = ref<any[]>([]);
const loadTable = ref(false);
const total = ref(0);
const addVisible = ref(false);
const addLoading = ref(false);
const monitorWordContent = ref('');

const queryFrom = reactive({
  search_key: '',
  page_size: 15,
  page_index: 1
});

const getTableList = () => {
  loadTable.value = true;
  messageMonitorWordsGet(queryFrom)
    .then((res: any) => {
      tableData.value = res.list || [];
      total.value = res.count || 0;
    })
    .finally(() => {
      loadTable.value = false;
    });
};

const onSizeChange = (size: number) => {
  queryFrom.page_size = size;
  getTableList();
};

const onCurrentChange = (current: number) => {
  queryFrom.page_index = current;
  getTableList();
};

const openAddDialog = () => {
  monitorWordContent.value = '';
  addVisible.value = true;
};

const submitMonitorWord = () => {
  const content = monitorWordContent.value.trim();
  if (!content) return ElMessage.info('请输入监听词！');
  addLoading.value = true;
  messageMonitorWordsPost({ content })
    .then((res: any) => {
      if (res.status === 200) {
        ElMessage.success('新增监听词成功！');
        addVisible.value = false;
        getTableList();
      }
    })
    .finally(() => {
      addLoading.value = false;
    });
};

const monitorWordsDel = (item: any) => {
  const formData = {
    is_deleted: item.is_deleted === 1 ? 0 : 1,
    id: item.id
  };
  const msg = item.is_deleted === 0 ? '删除监听词成功!' : '恢复监听词成功!';
  messageMonitorWordsDelete(formData).then((res: any) => {
    if (res.status === 200) {
      getTableList();
      ElMessage.success(msg);
    }
  });
};

const onDel = (item: any) => {
  const title = item.is_deleted === 0 ? '删除监听词' : '恢复监听词';
  const content = item.is_deleted === 0 ? `确定要删除监听词[${item.content}]吗` : `确定要恢复监听词[${item.content}]吗`;
  ElMessageBox.confirm(content, title, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    closeOnClickModal: false,
    type: 'warning'
  }).then(() => {
    monitorWordsDel(item);
  });
};

onMounted(() => {
  getTableList();
});
</script>

<style lang="scss" scoped>
.bd-title {
  border-bottom: 1px solid var(--el-card-border-color);
}

.monitor-title {
  min-height: 50px;
  gap: 12px;
}

.monitor-toolbar {
  display: flex;
  flex: 0 1 auto;
  justify-content: flex-end;
  min-width: 0;
}

.monitor-form {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
}

.monitor-form-item {
  margin: 0 !important;
}

.monitor-search {
  width: 220px;
}

.monitor-actions {
  white-space: nowrap;
}
</style>
