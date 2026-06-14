<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { NCard, NTag, NProgress, NScrollbar, NSpace, NStatistic } from 'naive-ui'
import { BarChart3, AlertTriangle, CheckCircle } from 'lucide-vue-next'
import { useWeaveStore } from '@/stores/weave'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const store = useWeaveStore()

const threadingPercent = computed(() => {
  if (store.stats.totalWarps === 0) return 0
  return Math.round((store.stats.threadedWarps / store.stats.totalWarps) * 100)
})

const barChartOption = computed(() => {
  const labels = store.harnesses.map((h) => h.label)
  const values = store.harnesses.map((h) => store.stats.warpUsage[h.id] ?? 0)
  return {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        return `${p.name}<br/>穿线数：${p.value}`
      },
    },
    grid: {
      top: 10,
      bottom: 24,
      left: 36,
      right: 10,
    },
    xAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: { color: '#a0aec0', fontSize: 10, interval: 0, rotate: labels.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' as const } },
    },
    series: [
      {
        type: 'bar' as const,
        data: values,
        barMaxWidth: 24,
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#e8b84b' },
              { offset: 1, color: '#b8860b' },
            ],
          },
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: {
          itemStyle: { color: '#f0c860' },
        },
      },
    ],
  }
})
</script>

<template>
  <NCard class="stats-panel" size="small">
    <template #header>
      <div class="panel-header">
        <BarChart3 :size="18" />
        <span>统计面板</span>
      </div>
    </template>

    <NScrollbar style="max-height: 100%">
      <NSpace vertical :size="16">
        <div class="section">
          <div class="section-title">概览统计</div>
          <div class="stats-grid">
            <NStatistic label="总经线" :value="store.stats.totalWarps" />
            <NStatistic label="已穿线" :value="store.stats.threadedWarps" />
            <NStatistic label="未穿线" :value="store.stats.unthreadedWarps" />
          </div>
          <NProgress
            type="line"
            :percentage="threadingPercent"
            :show-indicator="true"
            :height="6"
            :border-radius="3"
            :color="'var(--color-accent-gold)'"
            :rail-color="'var(--color-bg-deep)'"
            style="margin-top: 8px"
          />
          <div class="stats-row">
            <div class="stat-item">
              <NTag v-if="store.stats.errorCount > 0" type="error" size="small" round>
                <template #icon><AlertTriangle :size="12" /></template>
                错误 {{ store.stats.errorCount }}
              </NTag>
              <NTag v-else size="small" round type="success">
                <template #icon><CheckCircle :size="12" /></template>
                无错误
              </NTag>
            </div>
            <div class="stat-item">
              <NTag v-if="store.stats.warningCount > 0" type="warning" size="small" round>
                <template #icon><AlertTriangle :size="12" /></template>
                警告 {{ store.stats.warningCount }}
              </NTag>
              <NTag v-else size="small" round type="success">
                <template #icon><CheckCircle :size="12" /></template>
                无警告
              </NTag>
            </div>
          </div>
          <div class="stats-row">
            <div class="float-stat">
              <span class="float-label">最大经向浮线</span>
              <span class="float-value" :class="{ 'float-value--warn': store.stats.maxWarpFloat > store.maxFloatLength }">{{ store.stats.maxWarpFloat }}</span>
            </div>
            <div class="float-stat">
              <span class="float-label">最大纬向浮线</span>
              <span class="float-value" :class="{ 'float-value--warn': store.stats.maxWeftFloat > store.maxFloatLength }">{{ store.stats.maxWeftFloat }}</span>
            </div>
          </div>
          <div class="stats-row">
            <div class="float-stat">
              <span class="float-label">平均浮线长度</span>
              <span class="float-value">{{ store.stats.averageFloatLength }}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">综框穿线分布</div>
          <VChart class="usage-chart" :option="barChartOption" autoresize />
        </div>

        <div class="section">
          <div class="section-title">问题列表</div>
          <div v-if="store.validation.errors.length === 0 && store.validation.warnings.length === 0" class="no-issues">
            <CheckCircle :size="16" />
            <span>暂无问题</span>
          </div>
          <div v-else class="issues-list">
            <div v-for="(err, i) in store.validation.errors" :key="'e' + i" class="issue-row error">
              <span class="issue-dot" />
              <span class="issue-text">{{ err }}</span>
            </div>
            <div v-for="(warn, i) in store.validation.warnings" :key="'w' + i" class="issue-row warning">
              <span class="issue-dot" />
              <span class="issue-text">{{ warn }}</span>
            </div>
          </div>
        </div>
      </NSpace>
    </NScrollbar>
  </NCard>
</template>

<style scoped>
.stats-panel {
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

.section-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stats-grid :deep(.n-statistic) {
  --n-label-text-color: var(--color-text-secondary);
  --n-value-text-color: var(--color-text-primary);
}

.stats-grid :deep(.n-statistic-value__content) {
  font-size: 20px;
}

.stats-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
}

.float-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.float-label {
  color: var(--color-text-secondary);
}

.float-value {
  color: var(--color-text-primary);
  font-weight: 600;
}

.float-value--warn {
  color: var(--color-error);
}

.usage-chart {
  width: 100%;
  height: 140px;
}

.no-issues {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
  padding: 4px 0;
}

.no-issues svg {
  color: #52c41a;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.4;
}

.issue-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.issue-row.error .issue-dot {
  background: var(--color-error);
}

.issue-row.warning .issue-dot {
  background: var(--color-warning);
}

.issue-row.error .issue-text {
  color: var(--color-error);
}

.issue-row.warning .issue-text {
  color: var(--color-warning);
}
</style>
