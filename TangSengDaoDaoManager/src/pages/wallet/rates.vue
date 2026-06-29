<template>
  <bd-page class="wallet-rates-page flex-col">
    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="h-50px pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left">
          <p class="m-0 font-600">汇率配置</p>
        </div>
        <div class="flex items-center h-50px">
          <el-date-picker
            v-model="rateDate"
            class="mr-12px"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            :clearable="false"
            @change="getRates"
          />
          <el-button @click="getRates">刷新</el-button>
          <el-button type="success" @click="openCurrencyDialog">添加币种</el-button>
          <el-button type="primary" :loading="saving" @click="saveRates">保存配置</el-button>
        </div>
      </div>

      <div v-loading="loading" class="flex-1 overflow-auto p-16px">
        <div class="rate-summary">
          <div>
            <div class="rate-label">基准币种</div>
            <div class="rate-value">{{ form.base }}</div>
          </div>
          <div>
            <div class="rate-label">配置日期</div>
            <div class="rate-value">{{ form.rate_date || '-' }}</div>
          </div>
          <div>
            <div class="rate-label">最近操作人</div>
            <div class="rate-value">{{ form.operator_uid || '-' }}</div>
          </div>
          <div>
            <div class="rate-label">更新时间</div>
            <div class="rate-value">{{ formatDate(form.updated_at) }}</div>
          </div>
        </div>

        <el-form label-width="96px" class="rate-form">
          <el-form-item label="备注">
            <el-input v-model="remark" maxlength="200" show-word-limit placeholder="当天汇率备注" />
          </el-form-item>
        </el-form>

        <el-table :data="rates" :border="true" class="rate-table">
          <el-table-column prop="currency" label="币种" width="160" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.hidden ? 'info' : 'success'">{{ scope.row.hidden ? '隐藏' : '显示' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="USD → 币种" min-width="280">
            <template #default="scope">
              <el-input-number
                v-model="scope.row.rate"
                :min="0.00000001"
                :precision="8"
                :step="1"
                :controls="false"
                class="rate-input"
              />
              <span class="rate-unit">1 {{ form.base }} = {{ formatRate(scope.row.rate) }} {{ scope.row.currency }}</span>
            </template>
          </el-table-column>
          <el-table-column label="币种 → USD" min-width="280">
            <template #default="scope">
              <el-input-number
                v-model="scope.row.reverse_rate"
                :min="0.00000001"
                :precision="8"
                :step="0.0001"
                :controls="false"
                class="rate-input"
              />
              <span class="rate-unit">1 {{ scope.row.currency }} = {{ formatRate(scope.row.reverse_rate) }} {{ form.base }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="updated_at" label="更新时间" width="190">
            <template #default="scope">{{ formatDate(scope.row.updated_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="scope">
              <el-button text :type="scope.row.hidden ? 'success' : 'warning'" @click="toggleHidden(scope.row)">
                {{ scope.row.hidden ? '显示' : '隐藏' }}
              </el-button>
              <el-button
                text
                type="danger"
                :disabled="isDefaultCurrency(scope.row.currency)"
                @click="removeCurrency(scope.$index)"
              >删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-dialog v-model="currencyDialogVisible" title="添加币种" width="420px">
          <el-form label-width="80px">
            <el-form-item label="币种">
              <el-input v-model="newCurrency" maxlength="10" placeholder="例如 EUR" @input="normalizeNewCurrency" />
            </el-form-item>
            <el-form-item label="汇率">
              <el-input-number
                v-model="newRate"
                :min="0.00000001"
                :precision="8"
                :step="1"
                :controls="false"
                class="dialog-rate-input"
              />
              <div class="dialog-rate-tip">1 {{ form.base }} 兑换多少 {{ newCurrency || '币种' }}</div>
            </el-form-item>
            <el-form-item label="反向汇率">
              <el-input-number
                v-model="newReverseRate"
                :min="0.00000001"
                :precision="8"
                :step="0.0001"
                :controls="false"
                class="dialog-rate-input"
              />
              <div class="dialog-rate-tip">1 {{ newCurrency || '币种' }} 兑换多少 {{ form.base }}</div>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="currencyDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="addCurrency">确定</el-button>
          </template>
        </el-dialog>
      </div>
    </div>
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 汇率配置
  isAffix: false
</route>

<script lang="ts" setup>
import { ElMessage } from 'element-plus';
import { managerWalletExchangeRatesGet, managerWalletExchangeRatesPost } from '@/api/wallet';

const loading = ref(false);
const saving = ref(false);
const rateDate = ref('');
const remark = ref('');
const form = reactive({
  base: 'USD',
  rate_date: '',
  updated_at: '',
  operator_uid: '',
  remark: ''
});
const rates = ref<any[]>([]);
const defaultCurrencies = ['THB', 'CNY', 'VND'];
const currencyDialogVisible = ref(false);
const newCurrency = ref('');
const newRate = ref<number | undefined>();
const newReverseRate = ref<number | undefined>();

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value?: string) => {
  if (!value) {
    return '-';
  }
  return String(value).replace('T', ' ').slice(0, 19);
};

const formatRate = (value?: number) => {
  return Number(value || 0).toFixed(8).replace(/\.?0+$/, '');
};

const reverseRateFrom = (rate?: number) => {
  const value = Number(rate || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Number((1 / value).toFixed(8));
};

const isDefaultCurrency = (currency: string) => defaultCurrencies.includes(currency);

const normalizeNewCurrency = () => {
  newCurrency.value = newCurrency.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
};

const openCurrencyDialog = () => {
  newCurrency.value = '';
  newRate.value = undefined;
  newReverseRate.value = undefined;
  currencyDialogVisible.value = true;
};

const addCurrency = () => {
  const currency = newCurrency.value.trim().toUpperCase();
  if (!/^[A-Z]{3,10}$/.test(currency)) {
    ElMessage.error('币种格式必须为 3-10 位英文字母');
    return;
  }
  if (currency === form.base) {
    ElMessage.error('不能添加基准币种');
    return;
  }
  if (rates.value.some(item => item.currency === currency)) {
    ElMessage.error(`${currency} 已存在`);
    return;
  }
  if (!newRate.value || Number(newRate.value) <= 0) {
    ElMessage.error('USD 兑换外币汇率必须大于 0');
    return;
  }
  if (!newReverseRate.value || Number(newReverseRate.value) <= 0) {
    ElMessage.error('外币兑换 USD 汇率必须大于 0');
    return;
  }
  rates.value.push({
    currency,
    rate: Number(newRate.value),
    reverse_rate: Number(newReverseRate.value),
    hidden: false,
    updated_at: ''
  });
  rates.value.sort((a, b) => a.currency.localeCompare(b.currency));
  currencyDialogVisible.value = false;
};

const toggleHidden = (row: any) => {
  row.hidden = !row.hidden;
};

const removeCurrency = (index: number) => {
  const item = rates.value[index];
  if (!item || isDefaultCurrency(item.currency)) {
    return;
  }
  rates.value.splice(index, 1);
};

const getRates = async () => {
  loading.value = true;
  try {
    const res: any = await managerWalletExchangeRatesGet({ rate_date: rateDate.value });
    form.base = res.base || 'USD';
    form.rate_date = res.rate_date || rateDate.value;
    form.updated_at = res.updated_at || '';
    form.operator_uid = res.operator_uid || '';
    form.remark = res.remark || '';
    remark.value = form.remark;
    rates.value = (res.rates || []).map((item: any) => ({
      currency: item.currency,
      rate: Number(item.rate || 0),
      reverse_rate: Number(item.reverse_rate || reverseRateFrom(item.rate)),
      hidden: !!item.hidden,
      updated_at: item.updated_at || ''
    }));
  } finally {
    loading.value = false;
  }
};

const saveRates = async () => {
  const duplicated = rates.value.find((item, index) => rates.value.findIndex(rate => rate.currency === item.currency) !== index);
  if (duplicated) {
    ElMessage.error(`${duplicated.currency} 重复配置`);
    return;
  }
  const invalidCurrency = rates.value.find(item => !/^[A-Z]{3,10}$/.test(item.currency));
  if (invalidCurrency) {
    ElMessage.error(`${invalidCurrency.currency || '币种'} 格式不正确`);
    return;
  }
  const invalid = rates.value.find(item => !item.rate || Number(item.rate) <= 0);
  if (invalid) {
    ElMessage.error(`${invalid.currency} USD 兑换外币汇率必须大于 0`);
    return;
  }
  const invalidReverse = rates.value.find(item => !item.reverse_rate || Number(item.reverse_rate) <= 0);
  if (invalidReverse) {
    ElMessage.error(`${invalidReverse.currency} 外币兑换 USD 汇率必须大于 0`);
    return;
  }
  saving.value = true;
  try {
    await managerWalletExchangeRatesPost({
      rate_date: rateDate.value,
      remark: remark.value,
      rates: rates.value.map(item => ({
        currency: item.currency,
        rate: Number(item.rate),
        reverse_rate: Number(item.reverse_rate || reverseRateFrom(item.rate)),
        hidden: !!item.hidden
      }))
    });
    ElMessage.success('保存成功');
    await getRates();
  } catch (err: any) {
    ElMessage.error(err?.msg || '保存失败');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  rateDate.value = today();
  getRates();
});
</script>

<style scoped lang="scss">
.wallet-rates-page {
  height: 100%;
}

.rate-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.rate-summary > div {
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.rate-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.rate-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.rate-form {
  max-width: 760px;
}

.rate-table {
  width: 100%;
  max-width: 1100px;
}

.rate-input {
  width: 180px;
  margin-right: 12px;
}

.dialog-rate-input {
  width: 100%;
}

.dialog-rate-tip {
  width: 100%;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.rate-unit {
  color: var(--el-text-color-secondary);
}

@media (max-width: 960px) {
  .rate-summary {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }
}
</style>
