<template>
  <div class="password-section">
    <n-button text type="primary" size="small" @click="toggleExpand">
      {{ expanded ? '收起密码修改' : '修改密码' }}
    </n-button>

    <div v-if="expanded" class="password-fields">
      <n-form-item label="新密码" :validation-status="errors.newPassword ? 'error' : undefined" :feedback="errors.newPassword">
        <n-input
          v-model:value="passwordForm.newPassword"
          type="password"
          show-password-on="click"
          placeholder="至少 6 个字符"
          clearable
        />
      </n-form-item>
      <n-form-item label="确认密码" :validation-status="errors.confirmPassword ? 'error' : undefined" :feedback="errors.confirmPassword">
        <n-input
          v-model:value="passwordForm.confirmPassword"
          type="password"
          show-password-on="click"
          placeholder="再次输入密码"
          clearable
        />
      </n-form-item>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { NButton, NFormItem, NInput } from 'naive-ui';
import { useConfigStore } from '../../stores/config.js';

const configStore = useConfigStore();

const passwordForm = computed(() => configStore.passwordForm);
const errors = computed(() => configStore.errors);
const expanded = computed(() => configStore.showPasswordSection);

function toggleExpand() {
  configStore.showPasswordSection = !configStore.showPasswordSection;
  if (!configStore.showPasswordSection) {
    configStore.passwordForm.newPassword = '';
    configStore.passwordForm.confirmPassword = '';
  }
}
</script>

<style scoped>
.password-section {
  margin-top: 4px;
}

.password-fields {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
