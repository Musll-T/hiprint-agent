<template>
  <div class="settings-view">
    <n-spin :show="configStore.loading">
      <template v-if="configStore.config">
        <n-tabs type="line" animated>
          <!-- Tab 1: 基础服务 -->
          <n-tab-pane name="basic" tab="基础服务">
            <n-space vertical :size="16">
              <ConfigGroup title="服务端口">
                <n-form label-placement="left" label-width="140">
                  <n-form-item :validation-status="configStore.errors.port ? 'error' : undefined" :feedback="configStore.errors.port">
                    <template #label>
                      Socket.IO 端口
                      <RestartTag v-if="configStore.isRestartRequired('port')" />
                    </template>
                    <n-input-number v-model:value="configStore.config.port" :min="1024" :max="65535" style="width: 100%" />
                  </n-form-item>
                  <n-form-item :validation-status="configStore.errors.adminPort ? 'error' : undefined" :feedback="configStore.errors.adminPort">
                    <template #label>
                      Admin Web 端口
                      <RestartTag v-if="configStore.isRestartRequired('adminPort')" />
                    </template>
                    <n-input-number v-model:value="configStore.config.adminPort" :min="1024" :max="65535" style="width: 100%" />
                  </n-form-item>
                </n-form>
              </ConfigGroup>

              <ConfigGroup title="认证与安全">
                <n-form label-placement="left" label-width="140">
                  <n-form-item label="Token">
                    <n-input
                      v-model:value="configStore.config.token"
                      :type="showToken ? 'text' : 'password'"
                      placeholder="为空则跳过认证"
                      clearable
                    >
                      <template #suffix>
                        <n-button text size="tiny" @click="showToken = !showToken">
                          {{ showToken ? '隐藏' : '显示' }}
                        </n-button>
                      </template>
                    </n-input>
                  </n-form-item>
                  <n-form-item label="管理员用户名">
                    <n-input v-model:value="configStore.config.admin.username" placeholder="管理员用户名" clearable />
                  </n-form-item>
                  <n-form-item label="密码">
                    <PasswordChange />
                  </n-form-item>
                  <n-form-item label="IP 白名单">
                    <n-dynamic-tags v-model:value="configStore.config.ipWhitelist" />
                  </n-form-item>
                </n-form>
              </ConfigGroup>
            </n-space>
          </n-tab-pane>

          <!-- Tab 2: 渲染与打印 -->
          <n-tab-pane name="render" tab="渲染与打印">
            <n-space vertical :size="16">
              <ConfigGroup title="渲染与打印">
                <n-form label-placement="left" label-width="140">
                  <n-form-item label="渲染并发数" :validation-status="configStore.errors.renderConcurrency ? 'error' : undefined" :feedback="configStore.errors.renderConcurrency">
                    <n-input-number v-model:value="configStore.config.renderConcurrency" :min="1" :max="20" style="width: 100%" />
                  </n-form-item>
                  <n-form-item label="打印并发数" :validation-status="configStore.errors.printConcurrency ? 'error' : undefined" :feedback="configStore.errors.printConcurrency">
                    <n-input-number v-model:value="configStore.config.printConcurrency" :min="1" :max="20" style="width: 100%" />
                  </n-form-item>
                  <n-form-item :validation-status="configStore.errors.browserPoolSize ? 'error' : undefined" :feedback="configStore.errors.browserPoolSize">
                    <template #label>
                      浏览器池大小
                      <RestartTag v-if="configStore.isRestartRequired('browserPoolSize')" />
                    </template>
                    <n-input-number v-model:value="configStore.config.browserPoolSize" :min="1" :max="20" style="width: 100%" />
                  </n-form-item>
                  <n-form-item label="最大队列" :validation-status="configStore.errors.maxQueueSize ? 'error' : undefined" :feedback="configStore.errors.maxQueueSize">
                    <n-input-number v-model:value="configStore.config.maxQueueSize" :min="1" :max="10000" style="width: 100%" />
                  </n-form-item>
                  <n-form-item label="页面复用次数">
                    <n-input-number v-model:value="configStore.config.pageReuseLimit" :min="1" style="width: 100%" />
                  </n-form-item>
                </n-form>
              </ConfigGroup>

              <ConfigGroup title="超时设置">
                <n-form label-placement="left" label-width="140">
                  <n-form-item label="渲染超时 (ms)">
                    <n-input-number v-model:value="configStore.config.renderTimeout" :min="1000" :step="1000" style="width: 100%" />
                  </n-form-item>
                  <n-form-item label="打印超时 (ms)">
                    <n-input-number v-model:value="configStore.config.printTimeout" :min="1000" :step="1000" style="width: 100%" />
                  </n-form-item>
                </n-form>
              </ConfigGroup>
            </n-space>
          </n-tab-pane>

          <!-- Tab 3: 存储管理 -->
          <n-tab-pane name="storage" tab="存储管理">
            <ConfigGroup title="存储">
              <n-form label-placement="left" label-width="140">
                <n-form-item>
                  <template #label>
                    数据库路径
                    <RestartTag v-if="configStore.isRestartRequired('dbPath')" />
                  </template>
                  <n-input v-model:value="configStore.config.dbPath" placeholder="./data/hiprint.db" />
                </n-form-item>
                <n-form-item label="日志目录">
                  <n-input v-model:value="configStore.config.logDir" placeholder="./logs" />
                </n-form-item>
                <n-form-item label="PDF 目录">
                  <n-input v-model:value="configStore.config.pdfDir" placeholder="./data/pdf" />
                </n-form-item>
                <n-form-item label="预览目录">
                  <n-input v-model:value="configStore.config.previewDir" placeholder="./data/preview" />
                </n-form-item>
                <n-form-item label="日志级别">
                  <n-select
                    v-model:value="configStore.config.logLevel"
                    :options="logLevelOptions"
                    style="width: 100%"
                  />
                </n-form-item>
                <n-form-item label="任务保留天数">
                  <n-input-number v-model:value="configStore.config.jobRetentionDays" :min="1" style="width: 100%" />
                </n-form-item>
              </n-form>
            </ConfigGroup>
          </n-tab-pane>

          <!-- Tab 4: 中转服务 -->
          <n-tab-pane name="transit" tab="中转服务">
            <ConfigGroup title="中转服务">
              <n-form label-placement="left" label-width="140">
                <n-form-item label="启用中转">
                  <n-switch v-model:value="configStore.config.connectTransit" />
                </n-form-item>
                <n-form-item label="中转地址">
                  <n-input v-model:value="configStore.config.transitUrl" placeholder="http://transit.example.com:17521" :disabled="!configStore.config.connectTransit" />
                </n-form-item>
                <n-form-item label="中转 Token">
                  <n-input
                    v-model:value="configStore.config.transitToken"
                    :type="showTransitToken ? 'text' : 'password'"
                    placeholder="中转服务认证 Token"
                    :disabled="!configStore.config.connectTransit"
                    clearable
                  >
                    <template #suffix>
                      <n-button text size="tiny" @click="showTransitToken = !showTransitToken">
                        {{ showTransitToken ? '隐藏' : '显示' }}
                      </n-button>
                    </template>
                  </n-input>
                </n-form-item>
                <n-form-item>
                  <template #label>
                    兼容 EIO3
                    <RestartTag v-if="configStore.isRestartRequired('allowEIO3')" />
                  </template>
                  <n-switch v-model:value="configStore.config.allowEIO3" />
                </n-form-item>
                <n-form-item label="CORS Origin">
                  <n-input v-model:value="configStore.config.cors.origin" placeholder="*" />
                </n-form-item>
              </n-form>
            </ConfigGroup>
          </n-tab-pane>
        </n-tabs>

        <!-- 操作栏 - 始终在 tabs 外层 -->
        <div class="settings-actions">
          <n-space>
            <n-tag v-if="isDirty" type="warning" size="small">已修改</n-tag>
            <n-button
              type="primary"
              :loading="configStore.saving"
              :disabled="!isDirty && !configStore.showPasswordSection"
              @click="confirmSave"
            >
              保存配置
            </n-button>
            <n-button @click="reloadConfig">重置</n-button>
          </n-space>
        </div>
      </template>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue';
import {
  NSpin, NSpace, NForm, NFormItem, NInput, NInputNumber,
  NSwitch, NSelect, NButton, NTag, NDynamicTags,
  NTabs, NTabPane,
  useMessage, useDialog,
} from 'naive-ui';
import { useConfigStore } from '../stores/config.js';
import ConfigGroup from '../components/settings/ConfigGroup.vue';
import PasswordChange from '../components/settings/PasswordChange.vue';

/** 需重启标记小组件 */
const RestartTag = {
  render() {
    return h(NTag, { type: 'warning', size: 'tiny', round: true, style: 'margin-left: 6px; vertical-align: middle;' }, () => '需重启');
  },
};

const configStore = useConfigStore();
const message = useMessage();
const dialog = useDialog();

const showToken = ref(false);
const showTransitToken = ref(false);

const logLevelOptions = [
  { label: 'trace', value: 'trace' },
  { label: 'debug', value: 'debug' },
  { label: 'info', value: 'info' },
  { label: 'warn', value: 'warn' },
  { label: 'error', value: 'error' },
  { label: 'fatal', value: 'fatal' },
];

const isDirty = computed(() => {
  if (!configStore.config || !configStore.original) return false;
  return JSON.stringify(configStore.config) !== JSON.stringify(configStore.original);
});

function confirmSave() {
  dialog.warning({
    title: '确认保存',
    content: '确认要保存配置更改吗？部分参数修改后需要重启服务才能生效。',
    positiveText: '保存',
    negativeText: '取消',
    onPositiveClick: doSave,
  });
}

async function doSave() {
  if (!configStore.validateConfig()) {
    message.error('配置校验未通过，请检查标红的字段');
    return;
  }

  try {
    const result = await configStore.saveConfig();
    if (result && result.needRestart) {
      message.warning('配置已保存，部分参数需要重启服务才能生效', { duration: 5000 });
    } else {
      message.success('配置保存成功');
    }
  } catch (err) {
    message.error('保存失败: ' + (err.message || '未知错误'));
  }
}

async function reloadConfig() {
  try {
    await configStore.loadConfig();
    message.info('配置已重置');
  } catch (err) {
    message.error('加载配置失败: ' + (err.message || '未知错误'));
  }
}

onMounted(() => {
  if (!configStore.config) {
    configStore.loadConfig().catch((err) => {
      message.error('加载配置失败: ' + (err.message || '未知错误'));
    });
  }
});
</script>

<style scoped>
.settings-view {
  max-width: 720px;
}

.settings-actions {
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: var(--bg-base);
  border-top: 1px solid var(--border-subtle);
  z-index: 10;
}
</style>
