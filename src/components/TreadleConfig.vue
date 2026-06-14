<template>
  <NCard class="treadle-config" :bordered="true">
    <template #header>
      <div class="card-header">
        <Link :size="18" />
        <span>踏板关联配置</span>
      </div>
    </template>
    <template #header-extra>
      <NButton size="small" type="primary" @click="store.addTreadle()">
        <template #icon>
          <Plus :size="14" />
        </template>
        添加踏板
      </NButton>
    </template>
    <NScrollbar style="max-height: 420px" ref="scrollRef">
      <NSpace vertical :size="8">
        <div
          v-for="treadle in store.treadles"
          :key="treadle.id"
          :id="`treadle-row-${treadle.id}`"
          class="treadle-row"
          :class="treadleRowClass(treadle.id)"
        >
          <div class="treadle-label-col">
            <span class="treadle-label">{{ treadle.label }}</span>
            <NButton
              size="tiny"
              quaternary
              type="error"
              @click="handleRemoveTreadle(treadle.id)"
            >
              <template #icon>
                <Trash2 :size="12" />
              </template>
            </NButton>
          </div>
          <div class="treadle-harnesses">
            <NCheckboxGroup
              :value="treadle.harnessIds"
              @update:value="(ids: number[]) => onCheckboxChange(treadle.id, ids)"
            >
              <div class="harness-grid">
                <div
                  v-for="harness in store.harnesses"
                  :key="harness.id"
                  class="harness-check-item"
                >
                  <NCheckbox :value="harness.id">
                    <template #default>
                      <span class="harness-check-label">{{ harness.id }}</span>
                    </template>
                  </NCheckbox>
                </div>
              </div>
            </NCheckboxGroup>
          </div>
          <div v-if="treadle.harnessIds.length === 0" class="treadle-empty-warning">
            未关联任何综框
          </div>
        </div>
      </NSpace>
    </NScrollbar>
    <div v-if="store.validation.unlinkedHarnesses.length > 0" class="unlinked-summary">
      <AlertTriangle :size="14" class="warning-icon" />
      <span>综框 {{ store.validation.unlinkedHarnesses.join(', ') }} 未关联踏板</span>
    </div>
  </NCard>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useWeaveStore } from '@/stores/weave'
import { NCard, NCheckbox, NCheckboxGroup, NSpace, NButton, NScrollbar, useDialog, useMessage } from 'naive-ui'
import { Link, Plus, Trash2, AlertTriangle } from 'lucide-vue-next'

const store = useWeaveStore()
const dialog = useDialog()
const message = useMessage()
const scrollRef = ref<HTMLElement | null>(null)

function onCheckboxChange(treadleId: number, newIds: number[]): void {
  const treadle = store.treadles.find((t) => t.id === treadleId)
  if (!treadle) return
  const oldIds = new Set(treadle.harnessIds)
  for (const id of newIds) {
    if (!oldIds.has(id)) {
      store.toggleTreadleHarness(treadleId, id)
    }
  }
  const newIdsSet = new Set(newIds)
  for (const id of treadle.harnessIds) {
    if (!newIdsSet.has(id)) {
      store.toggleTreadleHarness(treadleId, id)
    }
  }
}

function handleRemoveTreadle(treadleId: number) {
  const treadle = store.treadles.find((t) => t.id === treadleId)
  if (!treadle) return
  const linkedCount = treadle.harnessIds.length
  dialog.warning({
    title: '确认删除踏板',
    content: linkedCount > 0
      ? `确定要删除「${treadle.label}」吗？该踏板关联了 ${linkedCount} 个综框，删除后将无法恢复。`
      : `确定要删除「${treadle.label}」吗？删除后将无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      store.removeTreadle(treadleId)
      message.success(`已删除 ${treadle.label}`)
    },
  })
}

function treadleRowClass(treadleId: number) {
  return {
    'treadle-row--focused': store.focusTarget.type === 'treadle' && store.focusTarget.id === treadleId,
  }
}

watch(
  () => store.focusTarget,
  (target) => {
    if (target.type === 'treadle' && target.id !== null) {
      nextTick(() => {
        const row = document.getElementById(`treadle-row-${target.id}`)
        if (row && scrollRef.value) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    }
  },
  { deep: true }
)
</script>

<style scoped>
.treadle-config {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.card-header svg {
  color: var(--color-accent-gold);
}

.treadle-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  transition: border-color 0.3s, box-shadow 0.3s;
}

.treadle-row--focused {
  border-color: #ffd700 !important;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
  animation: pulse-focus-treadle 1.5s ease-in-out infinite;
}

@keyframes pulse-focus-treadle {
  0%, 100% {
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 18px rgba(255, 215, 0, 0.7);
  }
}

.treadle-label-col {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.treadle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent-gold);
}

.treadle-harnesses {
  padding-left: 4px;
}

.harness-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 2px 8px;
}

.harness-check-item {
  display: flex;
  align-items: center;
}

.harness-check-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.treadle-empty-warning {
  font-size: 11px;
  color: var(--color-warning);
  background: var(--color-warning-bg);
  padding: 2px 8px;
  border-radius: 4px;
}

.unlinked-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--color-warning-bg);
  border: 1px solid rgba(230, 126, 34, 0.3);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-warning);
}

.warning-icon {
  flex-shrink: 0;
}
</style>
