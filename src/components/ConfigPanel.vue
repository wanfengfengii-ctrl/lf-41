<template>
  <NCard class="config-panel" size="small">
    <template #header>
      <div class="panel-header">
        <Settings :size="18" />
        <span>参数配置</span>
      </div>
    </template>

    <NSpace vertical :size="16">
      <div class="field">
        <label class="field-label">综框数量</label>
        <NInputNumber
          :value="store.harnessCount"
          :min="1"
          :step="1"
          size="small"
          :status="store.harnessCount <= 0 ? 'error' : undefined"
          @update:value="(v: number | null) => { if (v !== null && v > 0) store.setHarnessCount(v) }"
        />
      </div>

      <div class="field">
        <label class="field-label">经线数量</label>
        <NInputNumber
          :value="store.warpCount"
          :min="1"
          :step="1"
          size="small"
          :status="store.warpCount <= 0 ? 'error' : undefined"
          @update:value="(v: number | null) => { if (v !== null && v > 0) store.setWarpCount(v) }"
        />
      </div>

      <div class="field">
        <label class="field-label">最大浮线长度</label>
        <NInputNumber
          :value="store.maxFloatLength"
          :min="1"
          :step="1"
          size="small"
          @update:value="(v: number | null) => { if (v !== null && v > 0) store.setMaxFloatLength(v) }"
        />
      </div>

      <NDivider style="margin: 4px 0" />

      <div v-if="store.validation.errors.length || store.validation.warnings.length" class="validation-section">
        <div v-if="store.validation.errors.length > 0" class="validation-group">
          <div class="validation-group-title error-title">
            <AlertCircle :size="14" />
            <span>错误 ({{ store.validation.errors.length }})</span>
          </div>
          <NTag
            v-for="(err, i) in store.validation.errors"
            :key="'e' + i"
            type="error"
            size="small"
            class="validation-tag"
          >
            {{ err }}
          </NTag>
        </div>
        <div v-if="store.validation.warnings.length > 0" class="validation-group">
          <div class="validation-group-title warning-title">
            <AlertTriangle :size="14" />
            <span>警告 ({{ store.validation.warnings.length }})</span>
          </div>
          <NTag
            v-for="(warn, i) in store.validation.warnings"
            :key="'w' + i"
            type="warning"
            size="small"
            class="validation-tag"
          >
            {{ warn }}
          </NTag>
        </div>
      </div>

      <div v-else class="all-clear">
        <CheckCircle :size="14" />
        <span>设计验证通过</span>
      </div>

      <NButton size="small" @click="handleReset" class="reset-btn">
        <template #icon>
          <RotateCcw :size="14" />
        </template>
        重置设计
      </NButton>
    </NSpace>
  </NCard>
</template>

<script setup lang="ts">
import { NCard, NInputNumber, NSpace, NDivider, NButton, NTag, useDialog, useMessage } from 'naive-ui'
import { Settings, RotateCcw, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-vue-next'
import { useWeaveStore } from '@/stores/weave'

const store = useWeaveStore()
const dialog = useDialog()
const message = useMessage()

function handleReset() {
  dialog.warning({
    title: '确认重置设计',
    content: '此操作将清空所有当前配置（穿线、踏板、参数），恢复为默认设计。该操作不可撤销，是否继续？',
    positiveText: '确认重置',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      store.resetDesign()
      message.success('设计已重置为默认值')
    },
  })
}
</script>

<style scoped>
.config-panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 14px;
}

.panel-header svg {
  color: var(--color-accent-gold);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.validation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.validation-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.validation-group-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}

.error-title {
  color: var(--color-error);
}

.warning-title {
  color: var(--color-warning);
}

.validation-tag {
  width: 100%;
  justify-content: flex-start;
}

.all-clear {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-success);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 0;
}

.all-clear svg {
  color: var(--color-success);
}

.reset-btn {
  width: 100%;
}
</style>
