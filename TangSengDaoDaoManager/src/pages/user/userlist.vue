<template>
  <bd-page class="flex-col">
    <!-- 布局 -->

    <div class="flex-1 el-card border-none flex-col box-border overflow-hidden">
      <div class="h-50px pl-12px pr-12px box-border flex items-center justify-between bd-title">
        <div class="bd-title-left">
          <p class="m-0 font-600">用户列表</p>
        </div>
        <div class="flex items-center h-50px">
          <el-form inline>
            <el-form-item class="mb-0 !mr-16px">
              <el-input v-model="queryFrom.keyword" placeholder="uid/手机号/邮箱/用户名" clearable />
            </el-form-item>
            <el-form-item class="mb-0 !mr-0">
              <el-button type="primary" @click="getUserList">查询</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
      <div class="flex-1 overflow-hidden p-12px">
        <el-table v-loading="loadTable" :data="tableData" :border="true" style="width: 100%; height: 100%">
          <el-table-column v-for="item in column" v-bind="item" :key="item.prop">
            <template #default="scope">
              <template v-if="item.render">
                <component :is="item.render" :row="scope.row"> </component>
              </template>
              <template v-else-if="item.formatter">
                <slot :name="item.prop" :row="scope.row">{{ item.formatter(scope.row) }}</slot>
              </template>
              <template v-else-if="item.prop">
                <slot :name="item.prop" :row="scope.row">{{ scope.row[item.prop!] }}</slot>
              </template>
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
    <!-- 发消息 -->
    <bd-send-msg v-model:value="sendValue" v-bind="sendInfo" />
    <!-- 查看设备 -->
    <Devices v-model:value="devicesValue" :uid="devicesUid" />
    <el-dialog v-model="profileDialogVisible" title="编辑用户资料" width="460px" append-to-body>
      <el-form label-width="86px">
        <el-form-item label="用户ID">
          <el-input v-model="profileForm.uid" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="profileForm.name" disabled />
        </el-form-item>
        <el-form-item label="登录账号">
          <el-input v-model="profileForm.username" maxlength="64" show-word-limit />
        </el-form-item>
        <el-form-item label="区号">
          <el-input v-model="profileForm.zone" maxlength="8" placeholder="例如 0086" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="profileForm.phone" maxlength="32" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="邮箱账号">
          <el-input v-model="profileForm.email" maxlength="100" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="后台备注">
          <el-input
            v-model="profileForm.admin_remark"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="仅后台可见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="profileSaving" @click="onSaveProfile">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="resetPasswordDialogVisible" title="重置用户密码" width="420px" append-to-body @closed="onResetPasswordDialogClosed">
      <el-form label-width="86px">
        <el-form-item label="用户">
          <el-input :model-value="`${resetPasswordForm.name} (${resetPasswordForm.uid})`" disabled />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="resetPasswordForm.new_password" type="password" show-password maxlength="64" placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="resetPasswordForm.new_password_confirmation"
            type="password"
            show-password
            maxlength="64"
            placeholder="请再次输入新密码"
            @keyup.enter="onSubmitResetPassword"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetPasswordSaving" @click="onSubmitResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </bd-page>
</template>

<route lang="yaml">
meta:
  title: 用户列表
  isAffix: false
</route>

<script lang="tsx" setup>
import { useRouter } from 'vue-router';
import { ElButton, ElSpace, ElAvatar, ElDropdown, ElDropdownMenu, ElDropdownItem, ElMessage, ElMessageBox, ElTag } from 'element-plus';
import Devices from '@/pages/message/components/Devices.vue';
import { useUserStore } from '@/stores/modules/user';
import { BU_DOU_CONFIG } from '@/config';
// API 接口
import { userListGet, userLiftbanPut, userProfilePut, userResetPasswordPost } from '@/api/user';

const router = useRouter();
const userStore = useUserStore();
/**
 * 表格
 */
const column = reactive<Column.ColumnOptions[]>([
  {
    prop: 'avatar',
    label: '头像',
    align: 'center',
    fixed: 'left',
    width: 82,
    render: (scope: any) => {
      let img_url = '';
      if (scope.row['uid']) {
        img_url = `${BU_DOU_CONFIG.APP_URL}users/${scope.row['uid']}/avatar`;
      }
      return (
        <div class={'avatar-status-wrap'}>
          <ElAvatar src={img_url} size={54}>
            {scope.row['name']}
          </ElAvatar>
          {scope.row.online === 1 ? <span class={'avatar-online-dot'}></span> : null}
        </div>
      );
    }
  },
  {
    prop: 'name',
    label: '昵称',
    fixed: 'left',
    width: 140
  },
  {
    prop: 'phone',
    label: '手机号',
    fixed: 'left',
    width: 120
  },
  {
    prop: 'email',
    label: '邮箱账号',
    width: 190,
    showOverflowTooltip: true,
    formatter(row: any) {
      return row.email || '-';
    }
  },
  {
    prop: 'username',
    label: '登录账号',
    width: 120
  },
  {
    prop: 'admin_remark',
    label: '后台备注',
    width: 180,
    formatter(row: any) {
      return row.admin_remark || '-';
    }
  },
  {
    prop: 'uid',
    label: '用户ID',
    minWidth: 300
  },
  {
    prop: 'status',
    label: '用户状态',
    width: 86,
    formatter(row: any) {
      return row.status === 1 ? '正常' : '封禁';
    }
  },
  {
    prop: 'register_audit_status',
    label: '审核状态',
    width: 100,
    render: (scope: any) => {
      const status = scope.row.register_audit_status;
      const text = status === 1 ? '已通过' : status === 2 ? '已拒绝' : '待审核';
      const type = status === 1 ? 'success' : status === 2 ? 'danger' : 'warning';
      return <ElTag type={type}>{text}</ElTag>;
    }
  },
  {
    prop: 'audit_remark',
    label: '审核备注',
    width: 160
  },
  {
    prop: 'short_no',
    label: '悟空号',
    width: 180
  },
  {
    prop: 'sex',
    label: '性别',
    width: 60,
    formatter(row: any) {
      return row.sex === 1 ? '男' : '女';
    }
  },
  {
    prop: 'register_time',
    label: '注册时间',
    width: 170
  },
  {
    prop: 'device_name',
    label: '登录设备',
    width: 140
  },
  {
    prop: 'device_model',
    label: '登录设备型号',
    width: 140
  },
  {
    prop: 'online',
    label: '在线状态',
    width: 90,
    formatter(row: any) {
      return row.online === 1 ? '在线' : '离线';
    }
  },
  {
    prop: 'last_online_time',
    label: '最后离线时间',
    width: 150
  },
  {
    prop: 'operation',
    label: '操作',
    align: 'center',
    fixed: 'right',
    width: 180,
    render: (scope: any) => {
      return (
        <ElSpace>
          <ElButton type="primary" onClick={() => onSand(scope.row)}>
            发消息
          </ElButton>
          <ElDropdown
            v-slots={{
              default: () => <ElButton class={'bu-button'}>更多</ElButton>,
              dropdown: () => {
                return (
                  <ElDropdownMenu>
                    <ElDropdownItem onClick={() => onFriends(scope.row)}>
                      <i-bd-every-user class={'mr-4px'} />
                      好友列表
                    </ElDropdownItem>
                    <ElDropdownItem onClick={() => onUseBlackList(scope.row)}>
                      <i-bd-personal-privacy class={'mr-4px'} />
                      黑名单列表
                    </ElDropdownItem>
                    <ElDropdownItem onClick={() => onWallet(scope.row)}>
                      <i-bd-wallet class={'mr-4px'} />
                      用户钱包
                    </ElDropdownItem>
                    <ElDropdownItem onClick={() => onEditProfile(scope.row)}>
                      <i-bd-editor class={'mr-4px'} />
                      编辑资料
                    </ElDropdownItem>
                    {userStore.userInfo.role === 'superAdmin' ? (
                      <ElDropdownItem onClick={() => onResetPassword(scope.row)}>
                        <i-bd-lock class={'mr-4px'} />
                        重置密码
                      </ElDropdownItem>
                    ) : null}
                    <ElDropdownItem onClick={() => onUseLiftban(scope.row)}>
                      <i-bd-info class={'mr-4px'} />
                      {scope.row.status === 1 ? '封禁' : '解禁'}
                    </ElDropdownItem>
                    <ElDropdownItem onClick={() => onDevices(scope.row)}>
                      <i-bd-devices class={'mr-4px'} />
                      查看设备
                    </ElDropdownItem>
                  </ElDropdownMenu>
                );
              }
            }}
          />
        </ElSpace>
      );
    }
  }
]);
const tableData = ref<any[]>([]);
const loadTable = ref<boolean>(false);
// 分页
const total = ref(0);

// 查询
const queryFrom = reactive({
  keyword: '',
  page_size: 15,
  page_index: 1
});

const getUserList = () => {
  loadTable.value = true;
  userListGet(queryFrom).then((res: any) => {
    loadTable.value = false;
    tableData.value = res.list;
    total.value = res.count;
  });
};

const profileDialogVisible = ref(false);
const profileSaving = ref(false);
const profileForm = reactive({
  uid: '',
  name: '',
  username: '',
  zone: '',
  phone: '',
  email: '',
  admin_remark: ''
});

const onEditProfile = (item: any) => {
  profileForm.uid = item.uid;
  profileForm.name = item.name;
  profileForm.username = item.username || '';
  profileForm.zone = item.zone || '';
  profileForm.phone = item.raw_phone || item.phone || '';
  profileForm.email = item.email || '';
  profileForm.admin_remark = item.admin_remark || '';
  profileDialogVisible.value = true;
};

const onSaveProfile = () => {
  const username = profileForm.username.trim();
  if (!username) {
    ElMessage.error('登录账号不能为空');
    return;
  }
  profileSaving.value = true;
  userProfilePut(profileForm.uid, {
    username,
    zone: profileForm.zone.trim(),
    phone: profileForm.phone.trim(),
    email: profileForm.email.trim(),
    admin_remark: profileForm.admin_remark
  })
    .then(() => {
      profileDialogVisible.value = false;
      ElMessage.success('用户资料已更新');
      getUserList();
    })
    .catch(err => {
      ElMessage.error(err?.msg || '更新用户资料失败');
    })
    .finally(() => {
      profileSaving.value = false;
    });
};

const resetPasswordDialogVisible = ref(false);
const resetPasswordSaving = ref(false);
const resetPasswordForm = reactive({
  uid: '',
  name: '',
  new_password: '',
  new_password_confirmation: ''
});

const onResetPassword = (item: any) => {
  resetPasswordForm.uid = item.uid;
  resetPasswordForm.name = item.name || item.username || item.uid;
  resetPasswordForm.new_password = '';
  resetPasswordForm.new_password_confirmation = '';
  resetPasswordDialogVisible.value = true;
};

const onResetPasswordDialogClosed = () => {
  resetPasswordForm.uid = '';
  resetPasswordForm.name = '';
  resetPasswordForm.new_password = '';
  resetPasswordForm.new_password_confirmation = '';
};

const onSubmitResetPassword = () => {
  if (!resetPasswordForm.uid) {
    ElMessage.error('用户ID不能为空');
    return;
  }
  if (resetPasswordForm.new_password.length < 6) {
    ElMessage.error('密码长度至少 6 位');
    return;
  }
  if (resetPasswordForm.new_password !== resetPasswordForm.new_password_confirmation) {
    ElMessage.error('两次密码不一致');
    return;
  }

  resetPasswordSaving.value = true;
  userResetPasswordPost({
    uid: resetPasswordForm.uid,
    new_password: resetPasswordForm.new_password,
    new_password_confirmation: resetPasswordForm.new_password_confirmation
  })
    .then(() => {
      resetPasswordDialogVisible.value = false;
      ElMessage.success('用户密码已重置');
    })
    .catch(err => {
      ElMessage.error(err?.msg || '重置用户密码失败');
    })
    .finally(() => {
      resetPasswordSaving.value = false;
    });
};

// 分页page-size
const onSizeChange = (size: number) => {
  queryFrom.page_size = size;
  getUserList();
};

// 分页page-size
const onCurrentChange = (current: number) => {
  queryFrom.page_index = current;
  getUserList();
};

// 发送信息
const sendValue = ref<boolean>(false);
const sendInfo = ref({
  receivederChannelType: 1,
  receiveder: '',
  receivederName: '',
  sender: '',
  senderName: ''
});
const onSand = (item: any) => {
  sendValue.value = true;
  sendInfo.value = {
    receivederChannelType: 1,
    receiveder: item.uid,
    receivederName: item.name,
    sender: userStore.userInfo.uid,
    senderName: userStore.userInfo.name
  };
};

// 好友列表
const onFriends = (item: any) => {
  router.push({
    path: '/user/friends',
    query: {
      uid: item.uid,
      name: item.name
    }
  });
};

// 黑名单列表
const onUseBlackList = (item: any) => {
  router.push({
    path: '/user/userblacklist',
    query: {
      uid: item.uid,
      name: item.name
    }
  });
};

// 用户钱包
const onWallet = (item: any) => {
  router.push({
    path: '/wallet/user',
    query: {
      uid: item.uid,
      name: item.name,
      username: item.username
    }
  });
};

// 用户封禁/解封操作
const onUseLiftban = (item: any) => {
  const text = item.status == 1 ? '封禁' : '解禁';
  ElMessageBox.confirm(`确定要${text}用户${item.name} 吗`, `${text}用户`, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    closeOnClickModal: false,
    type: 'warning'
  })
    .then(() => {
      const fromLiftban = {
        uid: item.uid,
        status: item.status == 1 ? 0 : 1
      };
      userLiftbanPut(fromLiftban)
        .then((_res: any) => {
          getUserList();
          ElMessage({
            type: 'success',
            message: `${text}用户成功！`
          });
        })
        .catch(err => {
          if (err.status == 400) {
            ElMessage.error(err.msg);
          }
        });
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '取消成功！'
      });
    });
};

// 查看设备
const devicesValue = ref(false);
const devicesUid = ref('');

const onDevices = (item: any) => {
  devicesUid.value = item.uid;
  devicesValue.value = true;
};

// 初始化
onMounted(() => {
  getUserList();
});
</script>

<style lang="scss" scoped>
// 样式
.bd-title {
  border-bottom: 1px solid var(--el-card-border-color);
}
:deep(.avatar-status-wrap) {
  position: relative;
  display: inline-flex;
  width: 54px;
  height: 54px;
}
:deep(.avatar-online-dot) {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 12px;
  height: 12px;
  background: #20c76f;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(32, 199, 111, 0.2);
}
</style>
