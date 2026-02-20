<template>
  <n-config-provider :theme="theme">
    <div class="login-container">
      <div class="login-card">
        <!-- Logo -->
        <div class="login-header">
          <div class="login-logo">
            <Printer :size="24" />
          </div>
          <h1>HiPrint Agent</h1>
          <p>请登录管理面板</p>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="login-error">
          {{ errorMsg }}
        </div>

        <!-- 登录表单 -->
        <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleSubmit">
          <n-form-item label="用户名" path="username">
            <n-input
              v-model:value="form.username"
              placeholder="请输入用户名"
              :disabled="loading"
              @input="clearError"
            />
          </n-form-item>

          <n-form-item label="密码" path="password">
            <n-input
              v-model:value="form.password"
              type="password"
              show-password-on="click"
              placeholder="请输入密码"
              :disabled="loading"
              @input="clearError"
              @keyup.enter="handleSubmit"
            />
          </n-form-item>

          <n-button
            type="primary"
            block
            :loading="loading"
            :disabled="loading"
            attr-type="submit"
            @click="handleSubmit"
          >
            {{ loading ? '登录中...' : '登录' }}
          </n-button>
        </n-form>

        <!-- 页脚 -->
        <div class="login-footer">
          HiPrint Agent Admin Panel
        </div>
      </div>
    </div>
  </n-config-provider>
</template>

<script setup>
/**
 * Login - 登录页
 *
 * 独立于主应用的登录视图，使用 Naive UI 组件。
 * 成功后通过 window.location.href 跳转到主面板。
 */
import { ref } from 'vue';
import {
  NConfigProvider,
  NForm,
  NFormItem,
  NInput,
  NButton,
} from 'naive-ui';
import { Printer } from 'lucide-vue-next';
import { useTheme } from './composables/useTheme.js';

const { theme } = useTheme();

const formRef = ref(null);
const loading = ref(false);
const errorMsg = ref('');

const form = ref({
  username: '',
  password: '',
});

const rules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
};

function clearError() {
  errorMsg.value = '';
}

async function handleSubmit() {
  // 表单验证
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const username = form.value.username.trim();
  const password = form.value.password;

  if (!username || !password) {
    errorMsg.value = '请输入用户名和密码';
    return;
  }

  loading.value = true;
  errorMsg.value = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      // 登录成功，跳转主面板
      window.location.href = '/';
    } else {
      errorMsg.value = data.error || '登录失败';
    }
  } catch {
    errorMsg.value = '网络异常，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  background-color: var(--bg-base);
}

.login-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 40px 32px;
  width: 100%;
  max-width: 400px;
}

/* Logo / 标题 */
.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background-color: var(--accent-soft);
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  color: var(--accent);
}

.login-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.login-header p {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 错误提示 */
.login-error {
  padding: 10px 12px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-sm);
  color: var(--color-failed);
  font-size: 13px;
  margin-bottom: 20px;
}

/* 页脚 */
.login-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
