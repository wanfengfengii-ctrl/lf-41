<script setup lang="ts">
import { ref, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import {
  RadarChart,
  BarChart,
  HeatmapChart,
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  NCard,
  NTag,
  NProgress,
  NScrollbar,
  NSpace,
  NButton,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NBadge,
  useMessage,
  useDialog,
  NTabs,
  NTabPane,
  NAlert,
  NEmpty,
  NDivider,
} from 'naive-ui'
import {
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Zap,
  Target,
  ShieldCheck,
  Layers,
  Wrench,
  Eye,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Info,
  Gauge,
  BarChart3,
  Plus,
  Minus,
  Edit2,
  Link,
} from 'lucide-vue-next'
import { useWeaveStore } from '@/stores/weave'
import type { OptimizationSuggestion, ExportData, WeaveScore, DesignChange } from '@/types/weave'

use([
  RadarChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const store = useWeaveStore()
const message = useMessage()
const dialog = useDialog()

const showCompareModal = ref(false)
const showApplyConfirm = ref(false)
const pendingSuggestion = ref<OptimizationSuggestion | null>(null)
const compareBeforeData = ref<ExportData | null>(null)
const compareBeforeScore = ref<WeaveScore | null>(null)
const showAllApplyConfirm = ref(false)

const gradeConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  S: { color: '#ffd700', label: '卓越', bgColor: 'rgba(255, 215, 0, 0.15)' },
  A: { color: '#52c41a', label: '优秀', bgColor: 'rgba(82, 196, 26, 0.15)' },
  B: { color: '#1890ff', label: '良好', bgColor: 'rgba(24, 144, 255, 0.15)' },
  C: { color: '#faad14', label: '一般', bgColor: 'rgba(250, 173, 20, 0.15)' },
  D: { color: '#ff7a45', label: '较差', bgColor: 'rgba(255, 122, 69, 0.15)' },
  F: { color: '#f5222d', label: '不合格', bgColor: 'rgba(245, 34, 45, 0.15)' },
}

const categoryLabels: Record<string, { label: string; icon: any; color: string }> = {
  weavability: { label: '可织性', icon: ShieldCheck, color: '#1890ff' },
  complexity: { label: '复杂度', icon: Layers, color: '#722ed1' },
  stability: { label: '稳定性', icon: Target, color: '#52c41a' },
  materialFit: { label: '材料适配', icon: Wrench, color: '#fa8c16' },
}

const radarOption = computed(() => ({
  tooltip: {
    trigger: 'item' as const,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderColor: '#2a3a5c',
    textStyle: { color: '#f5f0e8', fontSize: 12 },
  },
  radar: {
    indicator: [
      { name: '可织性', max: 100 },
      { name: '复杂度', max: 100 },
      { name: '稳定性', max: 100 },
      { name: '材料适配', max: 100 },
    ],
    radius: '65%',
    center: ['50%', '55%'],
    splitNumber: 4,
    axisName: {
      color: '#a0aec0',
      fontSize: 11,
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(74, 85, 104, 0.4)',
      },
    },
    splitArea: {
      show: true,
      areaStyle: {
        color: ['rgba(30, 42, 69, 0.3)', 'rgba(30, 42, 69, 0.5)'],
      },
    },
    axisLine: {
      lineStyle: {
        color: '#4a5568',
      },
    },
  },
  series: [
    {
      type: 'radar' as const,
      data: [
        {
          value: [
            store.score.breakdown.weavability,
            store.score.breakdown.complexity,
            store.score.breakdown.stability,
            store.score.breakdown.materialFit,
          ],
          name: '评分',
          areaStyle: {
            color: {
              type: 'radial' as const,
              x: 0.5, y: 0.5, r: 0.5,
              colorStops: [
                { offset: 0, color: 'rgba(232, 184, 75, 0.5)' },
                { offset: 1, color: 'rgba(232, 184, 75, 0.1)' },
              ],
            },
          },
          lineStyle: {
            color: '#e8b84b',
            width: 2,
          },
          itemStyle: {
            color: '#e8b84b',
          },
        },
      ],
    },
  ],
}))

const deductionBarOption = computed(() => {
  const categoryScores = [
    { name: '可织性', score: store.score.breakdown.weavability, penalty: 100 - store.score.breakdown.weavability },
    { name: '复杂度', score: store.score.breakdown.complexity, penalty: 100 - store.score.breakdown.complexity },
    { name: '稳定性', score: store.score.breakdown.stability, penalty: 100 - store.score.breakdown.stability },
    { name: '材料适配', score: store.score.breakdown.materialFit, penalty: 100 - store.score.breakdown.materialFit },
  ]
  return {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
      axisPointer: { type: 'shadow' as const },
    },
    grid: {
      top: 10,
      bottom: 24,
      left: 40,
      right: 10,
    },
    xAxis: {
      type: 'category' as const,
      data: categoryScores.map((c) => c.name),
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' as const } },
    },
    series: [
      {
        name: '得分',
        type: 'bar' as const,
        stack: 'total',
        data: categoryScores.map((c) => c.score),
        barMaxWidth: 28,
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
      },
      {
        name: '扣分项',
        type: 'bar' as const,
        stack: 'total',
        data: categoryScores.map((c) => c.penalty),
        barMaxWidth: 28,
        itemStyle: {
          color: 'rgba(245, 34, 45, 0.3)',
          borderRadius: [3, 3, 0, 0],
        },
      },
    ],
  }
})

const riskHeatmapOption = computed(() => {
  const harnessRisk: Record<number, number> = {}
  const warpRisk: Record<number, number> = {}
  const treadleRisk: Record<number, number> = {}

  store.harnesses.forEach((h) => (harnessRisk[h.id] = 0))
  store.warpEnds.forEach((w) => (warpRisk[w.id] = 0))
  store.treadles.forEach((t) => (treadleRisk[t.id] = 0))

  for (const hotspot of store.riskHotspots) {
    if (hotspot.type === 'harness' && harnessRisk[hotspot.targetId] !== undefined) {
      harnessRisk[hotspot.targetId] = Math.max(harnessRisk[hotspot.targetId], hotspot.riskLevel)
    } else if (hotspot.type === 'warp' && warpRisk[hotspot.targetId] !== undefined) {
      warpRisk[hotspot.targetId] = Math.max(warpRisk[hotspot.targetId], hotspot.riskLevel)
    } else if (hotspot.type === 'treadle' && treadleRisk[hotspot.targetId] !== undefined) {
      treadleRisk[hotspot.targetId] = Math.max(treadleRisk[hotspot.targetId], hotspot.riskLevel)
    }
  }

  const maxLen = Math.max(store.harnessCount, store.warpCount, store.treadles.length)
  const rows = ['综框风险', '经线风险', '踏板风险']
  const data: [number, number, number][] = []

  for (let col = 0; col < maxLen; col++) {
    const hId = col + 1
    if (harnessRisk[hId] !== undefined) {
      data.push([col, 0, Math.round(harnessRisk[hId] * 100)])
    }
    if (warpRisk[hId] !== undefined) {
      data.push([col, 1, Math.round(warpRisk[hId] * 100)])
    }
    if (treadleRisk[hId] !== undefined) {
      data.push([col, 2, Math.round(treadleRisk[hId] * 100)])
    }
  }

  return {
    tooltip: {
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
      formatter: (params: any) => {
        const rowName = rows[params.value[1]]
        const idx = params.value[0] + 1
        const val = params.value[2]
        return `${rowName} ${idx}<br/>风险等级: ${val}%`
      },
    },
    grid: {
      top: 10,
      bottom: 30,
      left: 60,
      right: 20,
    },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: maxLen }, (_, i) => `${i + 1}`),
      axisLabel: { color: '#a0aec0', fontSize: 9, interval: Math.max(0, Math.floor(maxLen / 15)) },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category' as const,
      data: rows,
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: 100,
      show: false,
      inRange: {
        color: ['#1e2a45', '#2d3748', '#e67e22', '#c0392b'],
      },
    },
    series: [
      {
        name: '风险热区',
        type: 'heatmap' as const,
        data,
        itemStyle: {
          borderColor: '#1a1a2e',
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(232, 184, 75, 0.5)',
          },
        },
      },
    ],
  }
})

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return '#f5222d'
    case 'high': return '#ff7a45'
    case 'medium': return '#faad14'
    case 'low': return '#1890ff'
    default: return '#a0aec0'
  }
}

function getSeverityLabel(severity: string) {
  switch (severity) {
    case 'critical': return '严重'
    case 'high': return '高'
    case 'medium': return '中'
    case 'low': return '低'
    default: return '未知'
  }
}

function getImpactColor(impact: string) {
  switch (impact) {
    case 'significant': return '#52c41a'
    case 'moderate': return '#1890ff'
    case 'minor': return '#a0aec0'
    default: return '#a0aec0'
  }
}

function getImpactLabel(impact: string) {
  switch (impact) {
    case 'significant': return '显著'
    case 'moderate': return '中等'
    case 'minor': return '轻微'
    default: return '未知'
  }
}

function handlePreviewSuggestion(suggestion: OptimizationSuggestion) {
  const preview = store.previewSuggestion(suggestion)
  if (preview) {
    compareBeforeData.value = store.exportDesign()
    compareBeforeScore.value = JSON.parse(JSON.stringify(store.score))
    showCompareModal.value = true
    setTimeout(() => {
      pendingSuggestion.value = suggestion
    }, 50)
  }
}

function openApplyConfirm(suggestion: OptimizationSuggestion) {
  pendingSuggestion.value = suggestion
  showApplyConfirm.value = true
}

function confirmApplySuggestion() {
  if (pendingSuggestion.value) {
    pendingSuggestion.value.applyFn()
    message.success(`已应用优化建议：${pendingSuggestion.value.title}`)
    showApplyConfirm.value = false
    pendingSuggestion.value = null
  }
}

function openApplyAllConfirm() {
  if (store.optimizationSuggestions.length === 0) {
    message.warning('暂无可应用的优化建议')
    return
  }
  showAllApplyConfirm.value = true
}

function confirmApplyAll() {
  store.applyAllSuggestions()
  message.success(`已应用全部 ${store.optimizationSuggestions.length} 条优化建议`)
  showAllApplyConfirm.value = false
}

function handleUndo() {
  if (store.canUndo) {
    store.undo()
    message.info('已撤销上一步操作')
  }
}

function handleRedo() {
  if (store.canRedo) {
    store.redo()
    message.info('已重做')
  }
}

const previewScore = computed(() => {
  if (!pendingSuggestion.value?.previewData) return null
  const previewData = store.previewSuggestion(pendingSuggestion.value)
  if (!previewData) return null
  return store.calculateScoreForData(previewData)
})

const totalExpectedGain = computed(() => {
  return store.optimizationSuggestions.reduce((sum, s) => sum + s.expectedScoreGain, 0)
})

function navigateToIssue(issue: any) {
  if (!issue.location) return
  const loc = issue.location
  if (loc.type === 'warp' && loc.ids && loc.ids.length > 0) {
    store.setFocus('warp', loc.ids[0])
    message.info(`已定位到经线 ${loc.ids[0]}`)
  } else if (loc.type === 'harness' && loc.ids && loc.ids.length > 0) {
    store.setFocus('harness', loc.ids[0])
    message.info(`已定位到综框 ${loc.ids[0]}`)
  } else if (loc.type === 'treadle' && loc.ids && loc.ids.length > 0) {
    store.setFocus('treadle', loc.ids[0])
    message.info(`已定位到踏板 ${loc.ids[0]}`)
  }
}

function navigateToHotspot(hotspot: any) {
  store.setFocus(hotspot.type, hotspot.targetId)
  message.info(`已定位到${hotspot.type === 'harness' ? '综框' : hotspot.type === 'warp' ? '经线' : '踏板'} ${hotspot.targetId}`)
}

function navigateToTreadle(treadleId: number) {
  store.setFocus('treadle', treadleId)
}

function navigateToHarness(harnessId: number) {
  store.setFocus('harness', harnessId)
}

const designChanges = computed<DesignChange[]>(() => {
  if (!pendingSuggestion.value || !compareBeforeData.value) return []
  const previewData = store.previewSuggestion(pendingSuggestion.value)
  if (!previewData) return []
  return store.compareDesigns(compareBeforeData.value, previewData)
})

const warpChanges = computed(() => designChanges.value.filter((c) => c.type === 'warp'))
const treadleChanges = computed(() => designChanges.value.filter((c) => c.type === 'treadle'))
const harnessChanges = computed(() => designChanges.value.filter((c) => c.type === 'harness'))

const treadleRatioChartOption = computed(() => {
  const analysis = store.treadleAnalysis
  return {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
      formatter: (params: any) => {
        const item = analysis[params[0].dataIndex]
        return `${item.label}<br/>
          提升经线: ${item.raisedWarps}/${item.totalWarps}<br/>
          提升比例: ${(item.raiseRatio * 100).toFixed(1)}%<br/>
          关联综框: ${item.linkedHarnessCount}个`
      },
    },
    grid: {
      top: 10,
      bottom: 30,
      left: 40,
      right: 10,
    },
    xAxis: {
      type: 'category' as const,
      data: analysis.map((a) => a.label),
      axisLabel: { color: '#a0aec0', fontSize: 9, rotate: analysis.length > 8 ? 30 : 0 },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { color: '#a0aec0', fontSize: 10, formatter: '{value}%' },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' as const } },
    },
    series: [
      {
        name: '提升比例',
        type: 'bar' as const,
        data: analysis.map((a) => Math.round(a.raiseRatio * 100)),
        barMaxWidth: 32,
        itemStyle: {
          color: (params: any) => {
            const item = analysis[params.dataIndex]
            if (item.isEmpty) return '#f5222d'
            if (item.isFull) return '#faad14'
            return {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#52c41a' },
                { offset: 1, color: '#237804' },
              ],
            }
          },
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }
})

function getTreadleStatusType(analysisItem: any) {
  if (analysisItem.isEmpty) return 'error'
  if (analysisItem.isFull) return 'warning'
  return 'success'
}

function getTreadleStatusText(analysisItem: any) {
  if (analysisItem.isEmpty) return '空踏序'
  if (analysisItem.isFull) return '全提升'
  return '正常交织'
}
</script>

<template>
  <NCard class="score-center" size="small">
    <template #header>
      <div class="panel-header">
        <Gauge :size="18" />
        <span>织造工艺评分与优化建议中心</span>
        <div class="header-actions">
          <NButton size="tiny" quaternary :disabled="!store.canUndo" @click="handleUndo">
            <template #icon><ArrowLeft :size="14" /></template>
            撤销
          </NButton>
          <NButton size="tiny" quaternary :disabled="!store.canRedo" @click="handleRedo">
            <template #icon><ArrowRight :size="14" /></template>
            重做
          </NButton>
        </div>
      </div>
    </template>

    <NScrollbar style="max-height: 100%">
      <NSpace vertical :size="16">
        <div class="score-hero">
          <div class="grade-display" :style="{ background: gradeConfig[store.score.grade].bgColor }">
            <span class="grade-letter" :style="{ color: gradeConfig[store.score.grade].color }">
              {{ store.score.grade }}
            </span>
            <span class="grade-label" :style="{ color: gradeConfig[store.score.grade].color }">
              {{ gradeConfig[store.score.grade].label }}
            </span>
          </div>
          <div class="score-detail">
            <div class="total-score-row">
              <span class="total-label">综合评分</span>
              <span class="total-value">{{ store.score.totalScore }}</span>
              <span class="total-max">/ 100</span>
            </div>
            <NProgress
              type="line"
              :percentage="store.score.totalScore"
              :show-indicator="false"
              :height="8"
              :border-radius="4"
              :color="gradeConfig[store.score.grade].color"
              :rail-color="'var(--color-bg-deep)'"
            />
            <div class="penalty-summary">
              <div class="penalty-item">
                <XCircle :size="12" style="color: var(--color-error)" />
                <span>错误扣分 {{ store.score.errorPenalty }}</span>
              </div>
              <div class="penalty-item">
                <AlertTriangle :size="12" style="color: var(--color-warning)" />
                <span>警告扣分 {{ store.score.warningPenalty }}</span>
              </div>
              <div class="penalty-item">
                <TrendingUp :size="12" style="color: #e67e22" />
                <span>浮线扣分 {{ store.score.maxFloatPenalty }}</span>
              </div>
              <div class="penalty-item">
                <Layers :size="12" style="color: #722ed1" />
                <span>均衡扣分 {{ store.score.harnessBalancePenalty }}</span>
              </div>
            </div>
          </div>
        </div>

        <NTabs type="line" size="small" animated>
          <NTabPane name="radar" tab="分项雷达">
            <div class="chart-section">
              <VChart class="radar-chart" :option="radarOption" autoresize />
              <div class="score-list">
                <div
                  v-for="(config, key) in categoryLabels"
                  :key="key"
                  class="score-item"
                >
                  <component :is="config.icon" :size="14" :style="{ color: config.color }" />
                  <span class="score-item-label">{{ config.label }}</span>
                  <div class="score-item-bar-wrap">
                    <NProgress
                      type="line"
                      :percentage="(store.score.breakdown as any)[key]"
                      :show-indicator="false"
                      :height="6"
                      :border-radius="3"
                      :color="config.color"
                      :rail-color="'var(--color-bg-deep)'"
                    />
                  </div>
                  <span class="score-item-value">{{ (store.score.breakdown as any)[key] }}</span>
                </div>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="deductions" tab="扣分项">
            <div class="chart-section">
              <VChart class="bar-chart" :option="deductionBarOption" autoresize />
              <div class="deduction-list" v-if="store.score.deductions.length > 0">
                <NScrollbar style="max-height: 220px">
                  <div
                    v-for="d in store.score.deductions.slice(0, 15)"
                    :key="d.id"
                    class="deduction-row"
                  >
                    <NTag
                      size="tiny"
                      round
                      :style="{ backgroundColor: getSeverityColor(d.severity) + '30', borderColor: getSeverityColor(d.severity) + '60' }"
                    >
                      <span :style="{ color: getSeverityColor(d.severity) }">
                        {{ getSeverityLabel(d.severity) }}
                      </span>
                    </NTag>
                    <span class="deduction-text">{{ d.description }}</span>
                    <span class="deduction-points">-{{ d.points }}</span>
                  </div>
                </NScrollbar>
              </div>
              <div v-else class="empty-state">
                <CheckCircle :size="20" style="color: var(--color-success)" />
                <span>暂无扣分项，表现优秀！</span>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="heatmap" tab="风险热区">
            <div class="chart-section">
              <div class="heatmap-header">
                <div class="heatmap-legend">
                  <div class="legend-item"><span class="legend-block risk-low"></span>低风险</div>
                  <div class="legend-item"><span class="legend-block risk-medium"></span>中风险</div>
                  <div class="legend-item"><span class="legend-block risk-high"></span>高风险</div>
                </div>
              </div>
              <VChart class="heatmap-chart" :option="riskHeatmapOption" autoresize />
              <div class="hotspot-list" v-if="store.riskHotspots.length > 0">
                <div class="hotspot-title">
                  <AlertTriangle :size="14" style="color: var(--color-warning)" />
                  高风险热点 TOP 5
                  <span class="hotspot-hint">点击可跳转定位</span>
                </div>
                <div
                  v-for="(hs, idx) in store.riskHotspots.slice(0, 5)"
                  :key="hs.id"
                  class="hotspot-row clickable"
                  @click="navigateToHotspot(hs)"
                >
                  <span class="hotspot-rank">{{ idx + 1 }}</span>
                  <span class="hotspot-type">
                    {{ hs.type === 'harness' ? '综框' : hs.type === 'warp' ? '经线' : '踏板' }} {{ hs.targetId }}
                  </span>
                  <span class="hotspot-desc">{{ hs.description }}</span>
                  <div class="hotspot-risk">
                    <NProgress
                      type="line"
                      :percentage="Math.round(hs.riskLevel * 100)"
                      :show-indicator="false"
                      :height="4"
                      :border-radius="2"
                      :color="hs.riskLevel > 0.7 ? '#f5222d' : hs.riskLevel > 0.4 ? '#e67e22' : '#1890ff'"
                      :rail-color="'var(--color-bg-deep)'"
                      style="width: 50px"
                    />
                  </div>
                  <ChevronRight :size="12" class="hotspot-arrow" />
                </div>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="issues" tab="问题排序">
            <div class="issues-section">
              <div v-if="store.sortedIssues.length > 0" class="issues-list">
                <NScrollbar style="max-height: 340px">
                  <div
                    v-for="(issue, idx) in store.sortedIssues"
                    :key="issue.id"
                    class="issue-card"
                    :class="{ 'issue-card--clickable': issue.location }"
                    @click="issue.location && navigateToIssue(issue)"
                  >
                    <div class="issue-rank" :class="issue.type">
                      {{ idx + 1 }}
                    </div>
                    <div class="issue-content">
                      <div class="issue-title-row">
                        <NTag
                          size="tiny"
                          :type="issue.type === 'error' ? 'error' : issue.type === 'warning' ? 'warning' : 'info'"
                          round
                        >
                          {{ issue.type === 'error' ? '错误' : issue.type === 'warning' ? '警告' : '风险' }}
                        </NTag>
                        <span class="issue-title">{{ issue.title }}</span>
                        <span class="issue-priority">优先级 {{ issue.priority }}</span>
                      </div>
                      <div class="issue-desc">{{ issue.description }}</div>
                      <div v-if="issue.location" class="issue-location clickable">
                        <Target :size="11" />
                        <span>点击定位:</span>
                        <span class="location-text">
                          {{ issue.location.type === 'harness' ? '综框' : issue.location.type === 'warp' ? '经线' : issue.location.type === 'treadle' ? '踏板' : '范围' }}
                          <span v-if="issue.location.ids">
                            {{ issue.location.ids.join(', ') }}
                          </span>
                          <span v-else-if="issue.location.startId !== undefined && issue.location.endId !== undefined">
                            {{ issue.location.startId }} - {{ issue.location.endId }}
                          </span>
                        </span>
                        <ChevronRight :size="12" class="location-arrow" />
                      </div>
                    </div>
                  </div>
                </NScrollbar>
              </div>
              <div v-else class="empty-state">
                <CheckCircle :size="20" style="color: var(--color-success)" />
                <span>没有发现问题，工艺设计良好！</span>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="treadle" tab="踏序分析">
            <div class="treadle-analysis-section">
              <div class="analysis-chart-wrap">
                <VChart class="treadle-chart" :option="treadleRatioChartOption" autoresize />
              </div>
              <div class="treadle-analysis-stats">
                <div class="stat-item">
                  <span class="stat-label">总踏序步</span>
                  <span class="stat-value">{{ store.treadleAnalysis.length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">正常交织</span>
                  <span class="stat-value success">
                    {{ store.treadleAnalysis.filter((t: any) => t.hasInterleaving).length }}
                  </span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">空踏序</span>
                  <span class="stat-value error">
                    {{ store.treadleAnalysis.filter((t: any) => t.isEmpty).length }}
                  </span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">全提升</span>
                  <span class="stat-value warning">
                    {{ store.treadleAnalysis.filter((t: any) => t.isFull).length }}
                  </span>
                </div>
              </div>
              <NDivider style="margin: 10px 0" />
              <div class="treadle-detail-list">
                <div class="section-subtitle">
                  <BarChart3 :size="13" style="color: var(--color-accent-gold)" />
                  踏序步详情（点击可定位）
                </div>
                <NScrollbar style="max-height: 260px">
                  <NSpace vertical :size="6">
                    <div
                      v-for="(item, idx) in store.treadleAnalysis"
                      :key="item.id"
                      class="treadle-detail-card"
                      @click="navigateToTreadle(item.id)"
                    >
                      <div class="treadle-detail-header">
                        <span class="treadle-detail-title">{{ item.label }}</span>
                        <NTag size="tiny" :type="getTreadleStatusType(item)" round>
                          {{ getTreadleStatusText(item) }}
                        </NTag>
                      </div>
                      <div class="treadle-detail-body">
                        <div class="detail-metric">
                          <span class="metric-label">提升经线</span>
                          <span class="metric-value">{{ item.raisedWarps }}/{{ item.totalWarps }}</span>
                        </div>
                        <div class="detail-metric">
                          <span class="metric-label">提升比例</span>
                          <span class="metric-value">{{ (item.raiseRatio * 100).toFixed(1) }}%</span>
                        </div>
                        <div class="detail-metric">
                          <span class="metric-label">关联综框</span>
                          <span class="metric-value">{{ item.linkedHarnessCount }} 个</span>
                        </div>
                        <div class="detail-metric">
                          <span class="metric-label">浮线警告</span>
                          <span class="metric-value" :class="{ 'text-warning': item.floatWarnings > 0 }">
                            {{ item.floatWarnings }}
                          </span>
                        </div>
                      </div>
                      <div class="treadle-detail-harnesses" v-if="item.linkedHarnessIds.length > 0">
                        <span class="harness-label">关联综框：</span>
                        <span
                          v-for="hId in item.linkedHarnessIds.slice(0, 8)"
                          :key="hId"
                          class="harness-tag"
                          @click.stop="navigateToHarness(hId)"
                        >
                          {{ hId }}
                        </span>
                        <span v-if="item.linkedHarnessIds.length > 8" class="harness-more">
                          +{{ item.linkedHarnessIds.length - 8 }}
                        </span>
                      </div>
                      <ChevronRight :size="12" class="treadle-detail-arrow" />
                    </div>
                  </NSpace>
                </NScrollbar>
              </div>
            </div>
          </NTabPane>

          <NTabPane name="suggestions" tab="优化建议">
            <div class="suggestions-section">
              <div v-if="store.optimizationSuggestions.length > 0" class="suggestions-header">
                <NAlert
                  type="info"
                  :show-icon="true"
                  style="margin-bottom: 12px"
                >
                  <template #header>
                    <div class="suggestion-alert-header">
                      <Sparkles :size="14" />
                      <span>共 {{ store.optimizationSuggestions.length }} 条优化建议，预计可提升评分 {{ totalExpectedGain }} 分</span>
                    </div>
                  </template>
                </NAlert>
                <NButton
                  size="small"
                  type="primary"
                  @click="openApplyAllConfirm"
                  style="margin-bottom: 12px"
                >
                  <template #icon><Zap :size="14" /></template>
                  一键应用全部建议
                </NButton>
              </div>

              <div v-if="store.optimizationSuggestions.length > 0" class="suggestions-list">
                <NScrollbar style="max-height: 400px">
                  <div
                    v-for="suggestion in store.optimizationSuggestions"
                    :key="suggestion.id"
                    class="suggestion-card"
                  >
                    <div class="suggestion-header">
                      <div class="suggestion-icon">
                        <Lightbulb :size="16" />
                      </div>
                      <div class="suggestion-main">
                        <div class="suggestion-title-row">
                          <span class="suggestion-title">{{ suggestion.title }}</span>
                          <NBadge :value="`+${suggestion.expectedScoreGain}`" type="success" />
                        </div>
                        <div class="suggestion-meta">
                          <NTag
                            size="tiny"
                            round
                            :style="{ backgroundColor: getImpactColor(suggestion.impact) + '20', borderColor: getImpactColor(suggestion.impact) + '50' }"
                          >
                            <span :style="{ color: getImpactColor(suggestion.impact) }">
                              {{ getImpactLabel(suggestion.impact) }}影响
                            </span>
                          </NTag>
                          <span v-if="suggestion.affectedAreas.harnesses?.length" class="affected-tag">
                            综框 {{ suggestion.affectedAreas.harnesses.slice(0, 3).join(',') }}
                            {{ suggestion.affectedAreas.harnesses.length > 3 ? '...' : '' }}
                          </span>
                          <span v-if="suggestion.affectedAreas.warps?.length" class="affected-tag">
                            经线 {{ suggestion.affectedAreas.warps.slice(0, 3).join(',') }}
                            {{ suggestion.affectedAreas.warps.length > 3 ? '...' : '' }}
                          </span>
                          <span v-if="suggestion.affectedAreas.treadles?.length" class="affected-tag">
                            踏板 {{ suggestion.affectedAreas.treadles.slice(0, 3).join(',') }}
                            {{ suggestion.affectedAreas.treadles.length > 3 ? '...' : '' }}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="suggestion-body">
                      <p class="suggestion-desc">{{ suggestion.description }}</p>
                      <div class="suggestion-detail">
                        <div class="detail-item">
                          <Target :size="12" />
                          <span class="detail-label">调整方向:</span>
                          <span>{{ suggestion.adjustmentDirection }}</span>
                        </div>
                        <div class="detail-item">
                          <TrendingUp :size="12" />
                          <span class="detail-label">预期收益:</span>
                          <span class="gain-text">+{{ suggestion.expectedScoreGain }} 评分</span>
                        </div>
                      </div>
                    </div>
                    <div class="suggestion-actions">
                      <NButton size="tiny" quaternary @click="handlePreviewSuggestion(suggestion)">
                        <template #icon><Eye :size="12" /></template>
                        前后对比
                      </NButton>
                      <NButton size="tiny" type="primary" @click="openApplyConfirm(suggestion)">
                        <template #icon><ChevronRight :size="12" /></template>
                        应用建议
                      </NButton>
                    </div>
                  </div>
                </NScrollbar>
              </div>
              <div v-else class="empty-state">
                <Sparkles :size="20" style="color: var(--color-accent-gold)" />
                <span>暂无优化建议，工艺设计已较完善</span>
              </div>
            </div>
          </NTabPane>
        </NTabs>
      </NSpace>
    </NScrollbar>

    <NModal v-model:show="showApplyConfirm" preset="card" title="确认应用优化建议" style="max-width: 520px" :mask-closable="false">
      <div v-if="pendingSuggestion" class="confirm-content">
        <div class="confirm-header-row">
          <Lightbulb :size="20" style="color: var(--color-accent-gold)" />
          <span class="confirm-title">{{ pendingSuggestion.title }}</span>
        </div>
        <NAlert type="warning" :show-icon="true" style="margin: 12px 0">
          此操作将修改您的工艺设计，建议先使用"前后对比"预览效果。
        </NAlert>
        <div class="confirm-info">
          <p><strong>说明：</strong>{{ pendingSuggestion.description }}</p>
          <p><strong>调整方向：</strong>{{ pendingSuggestion.adjustmentDirection }}</p>
          <p><strong>预期收益：</strong><span class="gain-text">+{{ pendingSuggestion.expectedScoreGain }} 分</span></p>
          <p v-if="pendingSuggestion.affectedAreas.harnesses?.length">
            <strong>影响综框：</strong>{{ pendingSuggestion.affectedAreas.harnesses.join(', ') }}
          </p>
          <p v-if="pendingSuggestion.affectedAreas.warps?.length">
            <strong>影响经线：</strong>{{ pendingSuggestion.affectedAreas.warps.join(', ') }}
          </p>
          <p v-if="pendingSuggestion.affectedAreas.treadles?.length">
            <strong>影响踏板：</strong>{{ pendingSuggestion.affectedAreas.treadles.join(', ') }}
          </p>
        </div>
        <p class="confirm-note">
          <Info :size="12" />
          应用后可通过撤销按钮恢复。
        </p>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="showApplyConfirm = false">取消</NButton>
          <NButton size="small" type="primary" @click="confirmApplySuggestion">确认应用</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showAllApplyConfirm" preset="card" title="确认一键应用全部建议" style="max-width: 520px" :mask-closable="false">
      <div class="confirm-content">
        <div class="confirm-header-row">
          <Zap :size="20" style="color: var(--color-accent-gold)" />
          <span class="confirm-title">应用全部 {{ store.optimizationSuggestions.length }} 条优化建议</span>
        </div>
        <NAlert type="warning" :show-icon="true" style="margin: 12px 0">
          将批量应用所有优化建议，可能大幅改变当前设计。
        </NAlert>
        <div class="confirm-info">
          <p><strong>建议数量：</strong>{{ store.optimizationSuggestions.length }} 条</p>
          <p><strong>预计提升：</strong><span class="gain-text">+{{ totalExpectedGain }} 分</span></p>
          <ul class="suggestion-brief-list">
            <li v-for="s in store.optimizationSuggestions.slice(0, 5)" :key="s.id">
              {{ s.title }} <span class="gain-text">(+{{ s.expectedScoreGain }})</span>
            </li>
            <li v-if="store.optimizationSuggestions.length > 5">
              ...以及 {{ store.optimizationSuggestions.length - 5 }} 条其他建议
            </li>
          </ul>
        </div>
        <p class="confirm-note">
          <Info :size="12" />
          应用后可通过撤销按钮恢复。
        </p>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="showAllApplyConfirm = false">取消</NButton>
          <NButton size="small" type="primary" @click="confirmApplyAll">确认应用</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showCompareModal" preset="card" title="优化前后对比" style="max-width: 720px" :mask-closable="false">
      <div v-if="pendingSuggestion && compareBeforeScore && previewScore" class="compare-content">
        <div class="compare-header">
          <div class="compare-title-row">
            <BarChart3 :size="18" style="color: var(--color-accent-gold)" />
            <span>{{ pendingSuggestion.title }} - 效果对比</span>
          </div>
        </div>
        <div class="compare-grid">
          <div class="compare-col">
            <div class="compare-col-header current">
              <span>优化前</span>
            </div>
            <div class="compare-score-display" :style="{ background: gradeConfig[compareBeforeScore.grade].bgColor }">
              <span class="grade-letter" :style="{ color: gradeConfig[compareBeforeScore.grade].color }">
                {{ compareBeforeScore.grade }}
              </span>
              <span class="score-value">{{ compareBeforeScore.totalScore }}</span>
            </div>
            <NDescriptions label-placement="left" :column="1" size="small" bordered>
              <NDescriptionsItem label="可织性">{{ compareBeforeScore.breakdown.weavability }}</NDescriptionsItem>
              <NDescriptionsItem label="复杂度">{{ compareBeforeScore.breakdown.complexity }}</NDescriptionsItem>
              <NDescriptionsItem label="稳定性">{{ compareBeforeScore.breakdown.stability }}</NDescriptionsItem>
              <NDescriptionsItem label="材料适配">{{ compareBeforeScore.breakdown.materialFit }}</NDescriptionsItem>
              <NDescriptionsItem label="扣分项">{{ compareBeforeScore.deductions.length }} 项</NDescriptionsItem>
            </NDescriptions>
          </div>
          <div class="compare-arrow">
            <ChevronRight :size="28" style="color: var(--color-accent-gold)" />
          </div>
          <div class="compare-col">
            <div class="compare-col-header optimized">
              <span>优化后（预览）</span>
              <NTag type="success" size="tiny">+{{ previewScore.totalScore - compareBeforeScore.totalScore }}</NTag>
            </div>
            <div class="compare-score-display" :style="{ background: gradeConfig[previewScore.grade].bgColor }">
              <span class="grade-letter" :style="{ color: gradeConfig[previewScore.grade].color }">
                {{ previewScore.grade }}
              </span>
              <span class="score-value">{{ previewScore.totalScore }}</span>
            </div>
            <NDescriptions label-placement="left" :column="1" size="small" bordered>
              <NDescriptionsItem label="可织性">
                <span :class="previewScore.breakdown.weavability > compareBeforeScore.breakdown.weavability ? 'gain-text' : ''">
                  {{ previewScore.breakdown.weavability }}
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="复杂度">
                <span :class="previewScore.breakdown.complexity > compareBeforeScore.breakdown.complexity ? 'gain-text' : ''">
                  {{ previewScore.breakdown.complexity }}
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="稳定性">
                <span :class="previewScore.breakdown.stability > compareBeforeScore.breakdown.stability ? 'gain-text' : ''">
                  {{ previewScore.breakdown.stability }}
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="材料适配">
                <span :class="previewScore.breakdown.materialFit > compareBeforeScore.breakdown.materialFit ? 'gain-text' : ''">
                  {{ previewScore.breakdown.materialFit }}
                </span>
              </NDescriptionsItem>
              <NDescriptionsItem label="扣分项">
                <span :class="previewScore.deductions.length < compareBeforeScore.deductions.length ? 'gain-text' : ''">
                  {{ previewScore.deductions.length }} 项
                </span>
              </NDescriptionsItem>
            </NDescriptions>
          </div>
        </div>
        <NDivider style="margin: 16px 0" />
        <div class="compare-summary">
          <div class="summary-row">
            <Award :size="16" style="color: var(--color-accent-gold)" />
            <span><strong>评分变化：</strong>{{ compareBeforeScore.totalScore }} → {{ previewScore.totalScore }}
              <span class="gain-text">（+{{ previewScore.totalScore - compareBeforeScore.totalScore }} 分）</span>
            </span>
          </div>
          <div class="summary-row">
            <TrendingUp :size="16" style="color: #52c41a" />
            <span><strong>等级变化：</strong>{{ gradeConfig[compareBeforeScore.grade].label }} → {{ gradeConfig[previewScore.grade].label }}</span>
          </div>
        </div>
        <NDivider style="margin: 12px 0" />
        <div class="compare-changes">
          <div class="changes-header">
            <BarChart3 :size="14" style="color: var(--color-accent-gold)" />
            <span><strong>结构变化详情</strong></span>
            <span class="changes-count">共 {{ designChanges.length }} 处变更</span>
          </div>
          <div v-if="designChanges.length > 0" class="changes-list">
            <NScrollbar style="max-height: 240px">
              <NSpace vertical :size="8">
                <div v-if="warpChanges.length > 0" class="change-group">
                  <div class="change-group-title">
                    <Layers :size="12" />
                    经线穿线变化 ({{ warpChanges.length }})
                  </div>
                  <div
                    v-for="change in warpChanges"
                    :key="`warp-${change.id}`"
                    class="change-row"
                    :class="change.changeType"
                  >
                    <span class="change-icon">
                      <Plus v-if="change.changeType === 'added'" :size="12" />
                      <Minus v-else-if="change.changeType === 'removed'" :size="12" />
                      <Edit2 v-else :size="12" />
                    </span>
                    <span class="change-type-label">
                      {{ change.changeType === 'added' ? '新增' : change.changeType === 'removed' ? '删除' : '修改' }}
                    </span>
                    <span class="change-desc">{{ change.description }}</span>
                  </div>
                </div>
                <div v-if="treadleChanges.length > 0" class="change-group">
                  <div class="change-group-title">
                    <Link :size="12" />
                    踏板关联变化 ({{ treadleChanges.length }})
                  </div>
                  <div
                    v-for="change in treadleChanges"
                    :key="`treadle-${change.id}`"
                    class="change-row"
                    :class="change.changeType"
                  >
                    <span class="change-icon">
                      <Plus v-if="change.changeType === 'added'" :size="12" />
                      <Minus v-else-if="change.changeType === 'removed'" :size="12" />
                      <Edit2 v-else :size="12" />
                    </span>
                    <span class="change-type-label">
                      {{ change.changeType === 'added' ? '新增' : change.changeType === 'removed' ? '删除' : '修改' }}
                    </span>
                    <span class="change-desc">{{ change.description }}</span>
                  </div>
                </div>
                <div v-if="harnessChanges.length > 0" class="change-group">
                  <div class="change-group-title">
                    <Layers :size="12" />
                    综框数量变化 ({{ harnessChanges.length }})
                  </div>
                  <div
                    v-for="change in harnessChanges"
                    :key="`harness-${change.id}`"
                    class="change-row"
                    :class="change.changeType"
                  >
                    <span class="change-icon">
                      <Plus v-if="change.changeType === 'added'" :size="12" />
                      <Minus v-else-if="change.changeType === 'removed'" :size="12" />
                      <Edit2 v-else :size="12" />
                    </span>
                    <span class="change-type-label">
                      {{ change.changeType === 'added' ? '增加' : change.changeType === 'removed' ? '减少' : '修改' }}
                    </span>
                    <span class="change-desc">{{ change.description }}</span>
                  </div>
                </div>
              </NSpace>
            </NScrollbar>
          </div>
          <div v-else class="no-changes">
            <CheckCircle :size="18" style="color: var(--color-success)" />
            <span>无具体结构变化</span>
          </div>
        </div>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="showCompareModal = false">关闭</NButton>
          <NButton size="small" type="primary" @click="showCompareModal = false; openApplyConfirm(pendingSuggestion!)">
            <template #icon><Zap :size="14" /></template>
            应用此优化
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </NCard>
</template>

<style scoped>
.score-center {
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

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.score-hero {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.grade-display {
  width: 110px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px solid var(--color-border-accent);
}

.grade-letter {
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
  font-family: 'Noto Serif SC', serif;
}

.grade-label {
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
}

.score-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.total-score-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.total-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.total-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-accent-gold);
  line-height: 1;
}

.total-max {
  font-size: 14px;
  color: var(--color-text-muted);
}

.penalty-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.penalty-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.chart-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radar-chart {
  width: 100%;
  height: 220px;
}

.bar-chart {
  width: 100%;
  height: 160px;
}

.heatmap-chart {
  width: 100%;
  height: 140px;
}

.score-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.score-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.score-item-label {
  color: var(--color-text-secondary);
  width: 56px;
}

.score-item-bar-wrap {
  flex: 1;
}

.score-item-value {
  color: var(--color-text-primary);
  font-weight: 600;
  width: 28px;
  text-align: right;
}

.deduction-list {
  max-height: 220px;
}

.deduction-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  border-bottom: 1px solid var(--color-bg-deep);
}

.deduction-row:hover {
  background: var(--color-bg-hover);
}

.deduction-text {
  flex: 1;
  color: var(--color-text-primary);
}

.deduction-points {
  color: var(--color-error);
  font-weight: 600;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--color-text-secondary);
  font-size: 13px;
  flex-direction: column;
}

.heatmap-header {
  display: flex;
  justify-content: flex-end;
}

.heatmap-legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.legend-block {
  width: 16px;
  height: 10px;
  border-radius: 2px;
}

.legend-block.risk-low {
  background: #1e2a45;
}

.legend-block.risk-medium {
  background: #e67e22;
}

.legend-block.risk-high {
  background: #c0392b;
}

.hotspot-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hotspot-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.hotspot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 4px;
}

.hotspot-row:hover {
  background: var(--color-bg-hover);
}

.hotspot-rank {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.hotspot-type {
  width: 56px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.hotspot-desc {
  flex: 1;
  color: var(--color-text-secondary);
}

.hotspot-risk {
  width: 50px;
}

.issues-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
}

.issue-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
}

.issue-card:hover {
  border-color: var(--color-border-accent);
}

.issue-rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.issue-rank.error {
  background: rgba(245, 34, 45, 0.2);
  color: #f5222d;
}

.issue-rank.warning {
  background: rgba(250, 173, 20, 0.2);
  color: #faad14;
}

.issue-rank.risk {
  background: rgba(24, 144, 255, 0.2);
  color: #1890ff;
}

.issue-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.issue-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.issue-priority {
  margin-left: auto;
  font-size: 10px;
  color: var(--color-text-muted);
}

.issue-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.issue-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-accent-gold);
}

.suggestions-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-alert-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
}

.suggestion-card {
  padding: 12px;
  border-radius: 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.suggestion-card:hover {
  border-color: var(--color-accent-gold);
  box-shadow: 0 0 0 1px rgba(232, 184, 75, 0.2);
}

.suggestion-header {
  display: flex;
  gap: 10px;
}

.suggestion-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(232, 184, 75, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-gold);
  flex-shrink: 0;
}

.suggestion-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.suggestion-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestion-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.suggestion-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.affected-tag {
  font-size: 10px;
  color: var(--color-text-secondary);
  background: var(--color-bg-deep);
  padding: 2px 6px;
  border-radius: 4px;
}

.suggestion-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.suggestion-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
}

.suggestion-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.detail-item svg {
  color: var(--color-accent-gold);
  flex-shrink: 0;
}

.detail-label {
  color: var(--color-text-muted);
}

.gain-text {
  color: #52c41a;
  font-weight: 600;
}

.suggestion-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirm-content {
  display: flex;
  flex-direction: column;
}

.confirm-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.confirm-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.confirm-info {
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-secondary);
}

.confirm-info p {
  margin: 4px 0;
}

.confirm-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.suggestion-brief-list {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.compare-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compare-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: 14px;
}

.compare-grid {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.compare-col {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.compare-col-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.compare-col-header.current {
  background: rgba(24, 144, 255, 0.15);
  color: #1890ff;
}

.compare-col-header.optimized {
  background: rgba(82, 196, 26, 0.15);
  color: #52c41a;
}

.compare-score-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.compare-score-display .grade-letter {
  font-size: 32px;
}

.compare-score-display .score-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.compare-col :deep(.n-descriptions) {
  flex: 1;
}

.compare-col :deep(.n-descriptions .n-descriptions--bordered) {
  border: none;
}

.compare-arrow {
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.compare-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-primary);
}

:deep(.n-tabs-tab) {
  font-size: 12px !important;
  padding: 8px 10px !important;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  opacity: 0.9;
}

.issue-card--clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.issue-card--clickable:hover {
  border-color: var(--color-accent-gold);
  transform: translateX(2px);
}

.issue-location.clickable {
  color: var(--color-accent-gold);
  font-weight: 500;
}

.location-text {
  flex: 1;
}

.location-arrow {
  opacity: 0.6;
  transition: transform 0.2s;
}

.issue-card--clickable:hover .location-arrow {
  transform: translateX(2px);
  opacity: 1;
}

.hotspot-hint {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: var(--color-text-muted);
}

.hotspot-row.clickable {
  transition: all 0.2s;
}

.hotspot-row.clickable:hover {
  background: var(--color-bg-hover);
  transform: translateX(2px);
}

.hotspot-arrow {
  opacity: 0;
  transition: all 0.2s;
  color: var(--color-text-muted);
}

.hotspot-row.clickable:hover .hotspot-arrow {
  opacity: 1;
}

.treadle-analysis-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.analysis-chart-wrap {
  width: 100%;
}

.treadle-chart {
  width: 100%;
  height: 140px;
}

.treadle-analysis-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: var(--color-bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.stat-label {
  font-size: 10px;
  color: var(--color-text-muted);
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-value.success {
  color: #52c41a;
}

.stat-value.warning {
  color: #faad14;
}

.stat-value.error {
  color: #f5222d;
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.treadle-detail-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.treadle-detail-card {
  position: relative;
  padding: 10px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.treadle-detail-card:hover {
  border-color: var(--color-accent-gold);
  transform: translateX(2px);
}

.treadle-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.treadle-detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent-gold);
}

.treadle-detail-body {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 12px;
  margin-bottom: 6px;
}

.detail-metric {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.metric-label {
  color: var(--color-text-muted);
}

.metric-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.text-warning {
  color: var(--color-warning) !important;
}

.treadle-detail-harnesses {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
}

.harness-label {
  color: var(--color-text-muted);
}

.harness-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  background: rgba(24, 144, 255, 0.15);
  color: #1890ff;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.harness-tag:hover {
  background: rgba(24, 144, 255, 0.3);
}

.harness-more {
  font-size: 10px;
  color: var(--color-text-muted);
}

.treadle-detail-arrow {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: all 0.2s;
  color: var(--color-text-muted);
}

.treadle-detail-card:hover .treadle-detail-arrow {
  opacity: 1;
  right: 6px;
}

.compare-changes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.changes-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-primary);
}

.changes-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  padding: 2px 8px;
  border-radius: 10px;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.change-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.change-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 2px;
}

.change-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--color-bg-secondary);
  border-left: 3px solid var(--color-border);
}

.change-row.added {
  border-left-color: #52c41a;
  background: rgba(82, 196, 26, 0.08);
}

.change-row.removed {
  border-left-color: #f5222d;
  background: rgba(245, 34, 45, 0.08);
}

.change-row.modified {
  border-left-color: #1890ff;
  background: rgba(24, 144, 255, 0.08);
}

.change-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}

.change-row.added .change-icon {
  color: #52c41a;
  background: rgba(82, 196, 26, 0.2);
}

.change-row.removed .change-icon {
  color: #f5222d;
  background: rgba(245, 34, 45, 0.2);
}

.change-row.modified .change-icon {
  color: #1890ff;
  background: rgba(24, 144, 255, 0.2);
}

.change-type-label {
  font-size: 10px;
  font-weight: 600;
  width: 32px;
  flex-shrink: 0;
}

.change-row.added .change-type-label {
  color: #52c41a;
}

.change-row.removed .change-type-label {
  color: #f5222d;
}

.change-row.modified .change-type-label {
  color: #1890ff;
}

.change-desc {
  flex: 1;
  color: var(--color-text-primary);
}

.no-changes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--color-text-secondary);
  font-size: 13px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}
</style>
