<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NButton, NModal, NList, NListItem, NTag, NSpace, useMessage } from 'naive-ui'
import { Download, Upload, FileWarning, AlertTriangle } from 'lucide-vue-next'
import { useWeaveStore } from '@/stores/weave'
import type { ExportData } from '@/types/weave'

const store = useWeaveStore()
const message = useMessage()

const showErrors = ref(false)
const showWarnings = ref(false)
const importErrors = ref<string[]>([])
const importWarnings = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

function handleExport() {
  const data = store.exportDesign()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `weave-design-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  message.success('方案导出成功')
}

function triggerImport() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target?.result as string)
      const result = store.importDesign(parsed as ExportData)
      if (result.success) {
        if (result.warnings && result.warnings.length > 0) {
          importWarnings.value = result.warnings
          showWarnings.value = true
          message.warning('方案导入成功，但存在警告')
        } else {
          message.success('方案导入成功')
        }
      } else {
        importErrors.value = result.errors
        importWarnings.value = result.warnings || []
        showErrors.value = true
      }
    } catch {
      importErrors.value = ['文件格式错误，无法解析 JSON']
      importWarnings.value = []
      showErrors.value = true
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function closeErrors() {
  showErrors.value = false
  importErrors.value = []
  importWarnings.value = []
}

function closeWarnings() {
  showWarnings.value = false
  importWarnings.value = []
}
</script>

<template>
  <NCard class="import-export-panel" size="small">
    <NSpace vertical :size="12">
      <div class="panel-header">
        <Download :size="16" />
        <span>导入 / 导出</span>
      </div>
      <NSpace :size="8">
        <NButton size="small" @click="handleExport">
          <template #icon>
            <Download :size="14" />
          </template>
          导出方案
        </NButton>
        <NButton size="small" @click="triggerImport">
          <template #icon>
            <Upload :size="14" />
          </template>
          导入方案
        </NButton>
      </NSpace>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleFileChange"
      />
    </NSpace>
  </NCard>

  <NModal
    v-model:show="showErrors"
    preset="card"
    title="导入失败"
    style="max-width: 480px"
    :mask-closable="false"
  >
    <div class="error-modal-content">
      <div class="error-header">
        <FileWarning :size="20" class="error-icon" />
        <span>文件验证未通过，无法导入</span>
      </div>
      <NList bordered size="small">
        <NListItem v-for="(err, index) in importErrors" :key="index">
          <NTag type="error" size="small">{{ err }}</NTag>
        </NListItem>
      </NList>
      <div v-if="importWarnings.length > 0" class="warning-section">
        <div class="warning-header">
          <AlertTriangle :size="16" class="warning-icon" />
          <span>同时存在以下警告：</span>
        </div>
        <NList bordered size="small">
          <NListItem v-for="(warn, index) in importWarnings" :key="'w' + index">
            <NTag type="warning" size="small">{{ warn }}</NTag>
          </NListItem>
        </NList>
      </div>
      <div class="modal-note">
        当前设计方案未被修改。
      </div>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton size="small" @click="closeErrors">知道了</NButton>
      </NSpace>
    </template>
  </NModal>

  <NModal
    v-model:show="showWarnings"
    preset="card"
    title="导入成功（含警告）"
    style="max-width: 480px"
    :mask-closable="false"
  >
    <div class="warning-modal-content">
      <div class="warning-header-large">
        <AlertTriangle :size="20" class="warning-icon" />
        <span>方案已导入，但存在以下问题：</span>
      </div>
      <NList bordered size="small">
        <NListItem v-for="(warn, index) in importWarnings" :key="index">
          <NTag type="warning" size="small">{{ warn }}</NTag>
        </NListItem>
      </NList>
      <div class="modal-note">
        设计方案已成功导入，警告项建议尽快修正。
      </div>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton size="small" type="primary" @click="closeWarnings">确认</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.import-export-panel {
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

.error-modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 14px;
}

.error-icon {
  color: var(--color-error, #c0392b);
}

.warning-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-warning);
  font-size: 13px;
  font-weight: 500;
}

.warning-header-large {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.warning-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.warning-modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-note {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
