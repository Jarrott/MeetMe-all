<template>
  <bd-page class="wallet-page flex-col">
    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="h-50px pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left">
          <p class="m-0 font-600">用户钱包</p>
        </div>
        <div class="flex items-center h-50px">
          <el-button class="mr-12px" type="warning" plain @click="openWithdrawAudit">提现审核</el-button>
          <el-form inline>
            <el-form-item class="mb-0 !mr-16px">
              <el-input v-model="queryFrom.keyword" placeholder="uid/手机号/用户名" clearable @keyup.enter="getUserList" />
            </el-form-item>
            <el-form-item class="mb-0 !mr-0">
              <el-button type="primary" @click="getUserList">查询</el-button>
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
          <el-table-column prop="name" label="昵称" fixed="left" width="150" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="username" label="用户" width="130" />
          <el-table-column prop="avatar" label="头像" align="center" width="86">
            <template #default="scope">
              <el-avatar :src="avatarUrl(scope.row)" :size="48">{{ scope.row.name }}</el-avatar>
            </template>
          </el-table-column>
          <el-table-column prop="uid" label="用户ID" min-width="300" />
          <el-table-column prop="status" label="用户状态" width="90">
            <template #default="scope">{{ scope.row.status === 1 ? '正常' : '封禁' }}</template>
          </el-table-column>
          <el-table-column prop="register_time" label="注册时间" width="170" />
          <el-table-column prop="operation" label="操作" align="center" fixed="right" width="120">
            <template #default="scope">
              <el-button type="primary" @click="openWallet(scope.row)">钱包</el-button>
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

    <el-dialog v-model="walletVisible" :title="walletTitle" width="1120px" destroy-on-close>
      <div v-loading="walletLoading" class="wallet-dialog">
        <div class="wallet-summary">
          <div>
            <div class="wallet-label">当前余额</div>
            <div class="wallet-balance">{{ formatUSD(walletBalance.balance) }} USD</div>
          </div>
          <div>
            <div class="wallet-label">冻结金额</div>
            <div class="wallet-frozen">{{ formatUSD(walletBalance.frozen_amount) }} USD</div>
          </div>
          <div class="wallet-meta">
            <span>用户ID</span>
            <strong>{{ currentUser?.uid }}</strong>
          </div>
        </div>

        <el-form class="wallet-adjust" inline>
          <el-form-item label="操作">
            <el-radio-group v-model="adjustForm.type">
              <el-radio-button label="recharge">充值</el-radio-button>
              <el-radio-button label="deduct">扣款</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="金额（USD）">
            <el-input-number v-model="adjustForm.amount" :min="0.01" :step="1" :precision="2" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="adjustForm.remark" class="wallet-remark" :placeholder="adjustForm.type === 'deduct' ? '后台扣款' : '后台充值'" clearable />
          </el-form-item>
          <el-form-item>
            <el-button :type="adjustForm.type === 'deduct' ? 'danger' : 'primary'" :loading="adjusting" @click="submitAdjust">
              {{ adjustForm.type === 'deduct' ? '确认扣款' : '确认充值' }}
            </el-button>
            <el-button @click="refreshWallet">刷新</el-button>
          </el-form-item>
        </el-form>

        <div class="wallet-table-title">钱包流水</div>
        <el-table v-loading="transactionsLoading" :data="transactionData" :border="true" height="360px">
          <el-table-column prop="created_at" label="日期" width="170">
            <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
          </el-table-column>
          <el-table-column prop="trade_type" label="类型" width="96">
            <template #default="scope">{{ tradeTypeText(scope.row.trade_type) }}</template>
          </el-table-column>
          <el-table-column prop="direction" label="方向" width="86">
            <template #default="scope">{{ directionText(scope.row.direction) }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="金额（USD）" width="130">
            <template #default="scope">
              <span :class="amountClass(scope.row.direction)">{{ signedAmount(scope.row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="balance_after" label="变动后余额" width="130">
            <template #default="scope">{{ formatUSD(scope.row.balance_after) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" size="small">{{ statusText(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="counterparty_uid" label="对方用户" min-width="160" show-overflow-tooltip />
          <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        </el-table>

        <div class="wallet-footer">
          <el-pagination
            v-model:current-page="transactionQuery.page_index"
            v-model:page-size="transactionQuery.page_size"
            :page-sizes="[10, 20, 50]"
            :background="true"
            layout="total, sizes, prev, pager, next"
            :total="transactionTotal"
            @size-change="onTransactionSizeChange"
            @current-change="onTransactionCurrentChange"
          />
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="withdrawVisible" title="提现审核" width="1040px" destroy-on-close>
      <div class="withdraw-toolbar">
        <el-select v-model="withdrawQuery.status" class="withdraw-status" @change="onWithdrawFilterChange">
          <el-option label="全部订单" :value="-1" />
          <el-option label="待审核" :value="0" />
          <el-option label="已通过" :value="1" />
          <el-option label="已拒绝" :value="2" />
        </el-select>
        <el-button @click="getWithdraws">刷新</el-button>
      </div>
      <el-table v-loading="withdrawLoading" :data="withdrawData" :border="true" height="480px">
        <el-table-column prop="created_at" label="日期" width="170">
          <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="uid" label="用户ID" min-width="240" show-overflow-tooltip />
        <el-table-column prop="amount" label="提现金额（USD）" width="150">
          <template #default="scope">
            <span class="wallet-amount-expense">-{{ formatUSD(scope.row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="balance_after" label="提交后余额" width="130">
          <template #default="scope">{{ formatUSD(scope.row.balance_after) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="96">
          <template #default="scope">
            <el-tag :type="statusTagType(scope.row.status)" size="small">{{ statusText(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column prop="operator_uid" label="操作人" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" fixed="right" width="160" align="center">
          <template #default="scope">
            <template v-if="Number(scope.row.status) === 0">
              <el-button size="small" type="success" @click="auditWithdraw(scope.row, true)">通过</el-button>
              <el-button size="small" type="danger" plain @click="auditWithdraw(scope.row, false)">拒绝</el-button>
            </template>
            <span v-else class="wallet-muted">已处理</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="wallet-footer">
        <el-pagination
          v-model:current-page="withdrawQuery.page_index"
          v-model:page-size="withdrawQuery.page_size"
          :page-sizes="[10, 20, 50]"
          :background="true"
          layout="total, sizes, prev, pager, next"
          :total="withdrawTotal"
          @size-change="onWithdrawSizeChange"
          @current-change="onWithdrawCurrentChange"
        />
      </div>
    </el-dialog>
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 用户钱包
  isAffix: false
</route>

<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { BU_DOU_CONFIG } from '@/config';
import { userListGet } from '@/api/user';
import {
  managerWalletBalanceGet,
  managerWalletDeductPost,
  managerWalletRechargePost,
  managerWalletTransactionsGet,
  managerWalletWithdrawApprovePost,
  managerWalletWithdrawRejectPost,
  managerWalletWithdrawsGet
} from '@/api/wallet';

const route = useRoute();
const tableData = ref<any[]>([]);
const loadTable = ref<boolean>(false);
const total = ref(0);

const queryFrom = reactive({
  keyword: '',
  page_size: 15,
  page_index: 1
});

const currentUser = ref<any>();
const walletVisible = ref(false);
const walletLoading = ref(false);
const transactionsLoading = ref(false);
const adjusting = ref(false);
const withdrawVisible = ref(false);
const withdrawLoading = ref(false);
const transactionData = ref<any[]>([]);
const transactionTotal = ref(0);
const withdrawData = ref<any[]>([]);
const withdrawTotal = ref(0);
const walletBalance = reactive({
  uid: '',
  balance: 0,
  frozen_amount: 0,
  available_amount: 0
});
const adjustForm = reactive({
  type: 'recharge',
  amount: 100,
  remark: '后台充值'
});
const transactionQuery = reactive({
  page_size: 10,
  page_index: 1
});
const withdrawQuery = reactive({
  page_size: 10,
  page_index: 1,
  status: 0
});

const walletTitle = computed(() => {
  const name = currentUser.value?.name || currentUser.value?.username || '';
  return name ? `${name} 的钱包` : '用户钱包';
});

const avatarUrl = (row: any) => {
  if (!row?.uid) {
    return '';
  }
  return `${BU_DOU_CONFIG.APP_URL}users/${row.uid}/avatar`;
};

const formatUSD = (amount?: number) => {
  return ((amount || 0) / 100).toFixed(2);
};

const usdToCents = (amount?: number) => {
  return Math.round(Number(amount || 0) * 100);
};

const formatDate = (value?: string) => {
  if (!value) {
    return '-';
  }
  return String(value).replace('T', ' ').slice(0, 19);
};

const tradeTypeText = (value: number | string) => {
  const map: Record<string, string> = {
    '1': '充值',
    '2': '提现',
    '3': '转账',
    '4': '扣款',
    recharge: '充值',
    withdraw: '提现',
    deduct: '扣款',
    transfer_in: '转入',
    transfer_out: '转出',
    transfer: '转账'
  };
  return map[String(value)] || String(value || '-');
};

const statusText = (value: number | string) => {
  const map: Record<string, string> = {
    '0': '待审核',
    '1': '已完成',
    '2': '已拒绝'
  };
  return map[String(value)] || String(value || '-');
};

const statusTagType = (value: number | string) => {
  const map: Record<string, '' | 'success' | 'warning' | 'danger'> = {
    '0': 'warning',
    '1': 'success',
    '2': 'danger'
  };
  return map[String(value)] || '';
};

const amountClass = (direction: number | string) => {
  return Number(direction) === 1 ? 'wallet-amount-income' : 'wallet-amount-expense';
};

const signedAmount = (row: any) => {
  const prefix = Number(row?.direction) === 1 ? '+' : '-';
  return `${prefix}${formatUSD(row?.amount)}`;
};

watch(
  () => adjustForm.type,
  (type) => {
    if (type === 'deduct' && adjustForm.remark === '后台充值') {
      adjustForm.remark = '后台扣款';
    }
    if (type === 'recharge' && adjustForm.remark === '后台扣款') {
      adjustForm.remark = '后台充值';
    }
  }
);

const directionText = (value: number | string) => {
  const map: Record<string, string> = {
    '1': '收入',
    '2': '支出',
    in: '收入',
    out: '支出'
  };
  return map[String(value)] || String(value || '-');
};

const routeQueryString = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value ? String(value) : '';
};

const getUserList = () => {
  loadTable.value = true;
  return userListGet(queryFrom)
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
  getUserList();
};

const onCurrentChange = (current: number) => {
  queryFrom.page_index = current;
  getUserList();
};

const openWallet = async (row: any) => {
  currentUser.value = row;
  walletVisible.value = true;
  transactionQuery.page_index = 1;
  await refreshWallet();
};

const refreshWallet = async () => {
  if (!currentUser.value?.uid) {
    return;
  }
  walletLoading.value = true;
  try {
    await Promise.all([getWalletBalance(), getTransactions()]);
  } finally {
    walletLoading.value = false;
  }
};

const getWalletBalance = async () => {
  const res: any = await managerWalletBalanceGet(currentUser.value.uid);
  walletBalance.uid = res.uid || currentUser.value.uid;
  walletBalance.balance = res.balance || 0;
  walletBalance.frozen_amount = res.frozen_amount || 0;
  walletBalance.available_amount = res.available_amount || 0;
};

const getTransactions = async () => {
  transactionsLoading.value = true;
  try {
    const res: any = await managerWalletTransactionsGet(currentUser.value.uid, transactionQuery);
    transactionData.value = res.list || [];
    transactionTotal.value = res.count || 0;
  } finally {
    transactionsLoading.value = false;
  }
};

const submitAdjust = async () => {
  if (!currentUser.value?.uid) {
    return;
  }
  const amount = usdToCents(adjustForm.amount);
  if (!amount || amount <= 0) {
    ElMessage.error('金额必须大于 0 USD');
    return;
  }
  const isDeduct = adjustForm.type === 'deduct';
  adjusting.value = true;
  try {
    const action = isDeduct ? managerWalletDeductPost : managerWalletRechargePost;
    await action(currentUser.value.uid, {
      amount,
      remark: adjustForm.remark || (isDeduct ? '后台扣款' : '后台充值')
    });
    ElMessage.success(isDeduct ? '扣款成功' : '充值成功');
    transactionQuery.page_index = 1;
    await refreshWallet();
  } catch (err: any) {
    ElMessage.error(err?.msg || (isDeduct ? '扣款失败' : '充值失败'));
  } finally {
    adjusting.value = false;
  }
};

const openWithdrawAudit = async () => {
  withdrawVisible.value = true;
  withdrawQuery.page_index = 1;
  await getWithdraws();
};

const getWithdraws = async () => {
  withdrawLoading.value = true;
  try {
    const params = {
      page_size: withdrawQuery.page_size,
      page_index: withdrawQuery.page_index,
      status: withdrawQuery.status >= 0 ? withdrawQuery.status : undefined
    };
    const res: any = await managerWalletWithdrawsGet(params);
    withdrawData.value = res.list || [];
    withdrawTotal.value = res.count || 0;
  } finally {
    withdrawLoading.value = false;
  }
};

const auditWithdraw = async (row: any, approved: boolean) => {
  const actionText = approved ? '通过' : '拒绝';
  await ElMessageBox.confirm(`确认${actionText}这笔提现申请？`, '提现审核', {
    type: approved ? 'success' : 'warning'
  });
  try {
    if (approved) {
      await managerWalletWithdrawApprovePost(row.trade_no);
    } else {
      await managerWalletWithdrawRejectPost(row.trade_no);
    }
    ElMessage.success(`已${actionText}`);
    await getWithdraws();
    if (walletVisible.value) {
      await refreshWallet();
    }
  } catch (err: any) {
    ElMessage.error(err?.msg || `${actionText}失败`);
  }
};

const onTransactionSizeChange = (size: number) => {
  transactionQuery.page_size = size;
  getTransactions();
};

const onTransactionCurrentChange = (current: number) => {
  transactionQuery.page_index = current;
  getTransactions();
};

const onWithdrawFilterChange = () => {
  withdrawQuery.page_index = 1;
  getWithdraws();
};

const onWithdrawSizeChange = (size: number) => {
  withdrawQuery.page_size = size;
  getWithdraws();
};

const onWithdrawCurrentChange = (current: number) => {
  withdrawQuery.page_index = current;
  getWithdraws();
};

onMounted(() => {
  const uid = routeQueryString(route.query.uid);
  if (uid) {
    queryFrom.keyword = uid;
    getUserList();
    openWallet({
      uid,
      name: routeQueryString(route.query.name) || uid,
      username: routeQueryString(route.query.username)
    });
    return;
  }
  getUserList();
});
</script>

<style lang="scss" scoped>
.bd-title {
  border-bottom: 1px solid var(--el-card-border-color);
}

.wallet-dialog {
  min-height: 540px;
}

.wallet-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.wallet-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.wallet-balance {
  margin-top: 4px;
  color: var(--el-color-primary);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
}

.wallet-frozen {
  margin-top: 4px;
  color: var(--el-color-warning);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
}

.wallet-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;

  strong {
    max-width: 360px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.wallet-adjust {
  padding: 12px 0 4px;
}

.wallet-remark {
  width: 240px;
}

.wallet-table-title {
  margin: 8px 0 10px;
  font-weight: 600;
}

.wallet-amount-income {
  color: var(--el-color-success);
  font-weight: 700;
}

.wallet-amount-expense {
  color: var(--el-color-danger);
  font-weight: 700;
}

.wallet-muted {
  color: var(--el-text-color-secondary);
}

.withdraw-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 12px;
}

.withdraw-status {
  width: 140px;
}

.wallet-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
</style>
