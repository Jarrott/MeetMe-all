<template>
  <bd-page class="flex-col">
    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="h-50px pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left">
          <p class="m-0 font-600">注册审核</p>
        </div>
        <div class="flex items-center h-50px">
          <el-form inline>
            <el-form-item class="mb-0 !mr-16px">
              <el-select v-model="queryFrom.status" class="w-130px" @change="getTableList">
                <el-option label="待审核" :value="0" />
                <el-option label="已通过" :value="1" />
                <el-option label="已拒绝" :value="2" />
              </el-select>
            </el-form-item>
            <el-form-item class="mb-0 !mr-0">
              <el-button type="primary" @click="getTableList">查询</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
      <div class="flex-1 overflow-hidden p-12px">
        <el-table v-loading="loadTable" :data="tableData" :border="true" style="width: 100%; height: 100%">
          <el-table-column type="index" width="42" align="center" fixed="left" />
          <el-table-column prop="name" label="昵称" width="140" fixed="left" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="email" label="邮箱账号" width="200" show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.email || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="username" label="用户" width="150" show-overflow-tooltip />
          <el-table-column prop="uid" label="用户ID" min-width="280" show-overflow-tooltip />
          <el-table-column prop="short_no" label="悟空号" width="160" />
          <el-table-column prop="register_audit_status" label="审核状态" width="100">
            <template #default="scope">
              <el-tag :type="auditStatusType(scope.row.register_audit_status)">
                {{ auditStatusText(scope.row.register_audit_status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="audit_remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column prop="register_time" label="注册时间" width="180" />
          <el-table-column label="操作" align="center" fixed="right" width="220">
            <template #default="scope">
              <el-space>
                <el-button v-if="scope.row.register_audit_status !== 1" type="success" @click="openAudit(scope.row, 1)">通过</el-button>
                <el-button v-if="scope.row.register_audit_status !== 2" type="danger" plain @click="openAudit(scope.row, 2)">拒绝</el-button>
                <el-button @click="openAudit(scope.row)">备注</el-button>
              </el-space>
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

    <el-dialog v-model="auditVisible" :title="auditTitle" width="520px" destroy-on-close>
      <el-form label-width="70px">
        <el-form-item label="用户">
          <span>{{ auditRow?.name || auditRow?.username || auditRow?.uid }}</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="auditRemark" :rows="4" maxlength="200" show-word-limit type="textarea" placeholder="填写审核备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditVisible = false">取消</el-button>
        <el-button type="primary" :loading="auditLoading" @click="submitAudit">确定</el-button>
      </template>
    </el-dialog>
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 注册审核
  isAffix: false
</route>

<script lang="ts" setup>
import { ElMessage } from 'element-plus';
import { userAuditlistGet, userAuditPut } from '@/api/user';
import { managerAlertsReadPost } from '@/api/setting';
import { useManagerAlertStore } from '@/stores/modules/managerAlert';

const managerAlertStore = useManagerAlertStore();

const tableData = ref<any[]>([]);
const loadTable = ref(false);
const total = ref(0);
const queryFrom = reactive({
  status: 0,
  page_size: 15,
  page_index: 1
});

const auditVisible = ref(false);
const auditLoading = ref(false);
const auditRow = ref<any>();
const auditStatus = ref<number | undefined>();
const auditRemark = ref('');
const auditTitle = computed(() => {
  if (auditStatus.value === 1) return '审核通过';
  if (auditStatus.value === 2) return '审核拒绝';
  return '编辑备注';
});

const auditStatusText = (status: number) => {
  if (status === 1) return '已通过';
  if (status === 2) return '已拒绝';
  return '待审核';
};

const auditStatusType = (status: number) => {
  if (status === 1) return 'success';
  if (status === 2) return 'danger';
  return 'warning';
};

const getTableList = () => {
  loadTable.value = true;
  userAuditlistGet(queryFrom)
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

const openAudit = (row: any, status?: number) => {
  auditRow.value = row;
  auditStatus.value = status;
  auditRemark.value = row.audit_remark || '';
  auditVisible.value = true;
};

const submitAudit = async () => {
  if (!auditRow.value?.uid) return;
  auditLoading.value = true;
  const data: any = { remark: auditRemark.value };
  if (auditStatus.value !== undefined) data.status = auditStatus.value;
  try {
    await userAuditPut(auditRow.value.uid, data);
    ElMessage.success('操作成功');
    auditVisible.value = false;
    getTableList();
  } finally {
    auditLoading.value = false;
  }
};

onMounted(() => {
  managerAlertsReadPost({ type: 'register_audit' }).finally(() => {
    managerAlertStore.setRegisterAuditUnreadCount(0);
  });
  getTableList();
});
</script>

<style lang="scss" scoped>
.bd-title {
  border-bottom: 1px solid var(--el-card-border-color);
}
</style>
