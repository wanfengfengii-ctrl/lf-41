<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import {
  RadarChart,
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  VisualMapComponent,
  DataZoomComponent,
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
  NInput,
  NInputNumber,
  NSelect,
  NSlider,
  NIcon,
  NSpin,
  NTooltip,
  NCheckbox,
  NRate,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NTextarea,
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
  Play,
  Pause,
  SkipBack,
  SkipForward,
  StopCircle,
  Lock,
  Unlock,
  Download,
  FileJson,
  FileText,
  FlaskConical,
  GitCompare,
  Clock,
  Flame,
  CheckSquare,
  Square,
  Wand2,
  RefreshCw,
  Copy,
  Save,
  SlidersHorizontal,
  Maximize2,
  Search,
  Layers3,
  ScanSearch,
  Thermometer,
  PieChart,
  Activity,
} from 'lucide-vue-next'
import { useWeaveStore } from '@/stores/weave'
import type {
  CandidateScheme,
  SimulationParams,
  MaterialType,
  RiskMigrationPoint,
  StructureHeatmap,
  ExperimentReport,
} from '@/types/weave'
import { MATERIAL_PRESETS, DEFAULT_SIMULATION_PARAMS } from '@/types/weave'
import {
  computeStructureHeatmap,
  generateReportMarkdown,
  evaluateDesign,
} from '@/lib/simulation'

use([
  RadarChart,
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  VisualMapComponent,
  DataZoomComponent,
  CanvasRenderer,
])

const store = useWeaveStore()
const message = useMessage()
const dialog = useDialog()

const activeTab = ref('simulation')
const showReportDrawer = ref(false)
const reportTitle = ref('')
const reportNotes = ref('')
const showApplyConfirm = ref(false)
const applyCandidateId = ref<string | null>(null)
const showStructureModal = ref(false)
const structureCandidateId = ref<string | null>(null)
const showCompareModal = ref(false)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
let playbackTimer: number | null = null

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

const materialOptions = computed(() =>
  Object.entries(MATERIAL_PRESETS).map(([value, config]) => ({
    label: `${config.label} (推荐浮线≤${config.recommendedMaxFloat})`,
    value: value as MaterialType,
  }))
)

const paramsForm = computed<SimulationParams>({
  get: () => store.simulationParams,
  set: (v) => store.setSimulationParams(v),
})

const scoreCurveOption = computed(() => {
  if (store.candidates.length === 0) return {}
  const series = store.candidates.map((c, idx) => ({
    name: c.name,
    type: 'line' as const,
    data: c.scoreHistory,
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2 },
    emphasis: { focus: 'series' as const },
  }))
  const colors = ['#e8b84b', '#1890ff', '#52c41a', '#722ed1', '#eb2f96']
  return {
    color: colors,
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
    },
    legend: {
      data: store.candidates.map((c) => c.name),
      textStyle: { color: '#a0aec0', fontSize: 10 },
      top: 0,
      type: 'scroll' as const,
    },
    grid: { top: 40, bottom: 30, left: 40, right: 10 },
    xAxis: {
      type: 'category' as const,
      name: '迭代步',
      nameTextStyle: { color: '#a0aec0', fontSize: 10 },
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      axisLine: { lineStyle: { color: '#4a5568' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      name: '评分',
      nameTextStyle: { color: '#a0aec0', fontSize: 10 },
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' as const } },
    },
    series,
  }
})

const candidateCompareRadarOption = computed(() => {
  if (store.compareCandidates.length === 0) return {}
  const indicators = [
    { name: '可织性', max: 100 },
    { name: '复杂度', max: 100 },
    { name: '稳定性', max: 100 },
    { name: '材料适配', max: 100 },
  ]
  const colors = ['#e8b84b', '#1890ff', '#52c41a', '#722ed1']
  return {
    color: colors,
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
    },
    legend: {
      data: store.compareCandidates.map((c) => c.name),
      textStyle: { color: '#a0aec0', fontSize: 10 },
      bottom: 0,
    },
    radar: {
      indicator: indicators,
      radius: '60%',
      center: ['50%', '45%'],
      splitNumber: 4,
      axisName: { color: '#a0aec0', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(74, 85, 104, 0.4)' } },
      splitArea: {
        show: true,
        areaStyle: { color: ['rgba(30, 42, 69, 0.3)', 'rgba(30, 42, 69, 0.5)'] },
      },
      axisLine: { lineStyle: { color: '#4a5568' } },
    },
    series: [
      {
        type: 'radar' as const,
        data: store.compareCandidates.map((c) => ({
          value: [
            c.score.breakdown.weavability,
            c.score.breakdown.complexity,
            c.score.breakdown.stability,
            c.score.breakdown.materialFit,
          ],
          name: c.name,
          areaStyle: { opacity: 0.2 },
          lineStyle: { width: 2 },
          itemStyle: { fontSize: 8 },
        })),
      },
    ],
  }
})

const structureHeatmapOption = computed(() => {
  if (!structureCandidateId.value) return {}
  const heatmap = store.getCandidateStructureHeatmap(structureCandidateId.value)
  if (!heatmap) return {}
  const { diffCells, diffSummary, targetMatrix } = heatmap
  const rows = targetMatrix.length
  const cols = targetMatrix[0]?.length || 0
  const data: [number, number, number, string][] = []
  diffCells.forEach((cell) => {
    let val = 0
    let type = 'unchanged'
    if (cell.diffType === 'added') { val = 3; type = 'added' }
    else if (cell.diffType === 'removed') { val = 2; type = 'removed' }
    else if (cell.diffType === 'modified') { val = 1; type = 'modified' }
    else { val = cell.afterValue === 1 ? 0.5 : 0; type = 'unchanged' }
    data.push([cell.col, cell.row, val, type])
  })
  return {
    tooltip: {
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
      formatter: (params: any) => {
        const d = params.data
        const typeLabel: Record<string, string> = {
          added: '新增交织',
          removed: '移除交织',
          modified: '状态改变',
          unchanged: '无变化',
        }
        return `踏板 ${d[1] + 1} / 经线 ${d[0] + 1}<br/>类型: ${typeLabel[d[3]]}<br/>原值: ${d[3] === 'added' ? 0 : d[3] === 'removed' ? 1 : params.value}<br/>新值: ${d[3] === 'removed' ? 0 : 1}`
      },
    },
    grid: { top: 20, bottom: 50, left: 50, right: 20 },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: cols }, (_, i) => `${i + 1}`),
      axisLabel: { color: '#a0aec0', fontSize: 9, interval: Math.max(0, Math.floor(cols / 20)) },
      axisLine: { lineStyle: { color: '#4a5568' } },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category' as const,
      data: Array.from({ length: rows }, (_, i) => `${i + 1}`),
      axisLabel: { color: '#a0aec0', fontSize: 9, interval: Math.max(0, Math.floor(rows / 15)) },
      axisLine: { lineStyle: { color: '#4a5568' } },
      splitArea: { show: false },
    },
    visualMap: {
      min: 0,
      max: 3,
      show: true,
      orient: 'horizontal' as const,
      bottom: 0,
      left: 'center',
      textStyle: { color: '#a0aec0', fontSize: 10 },
      pieces: [
        { min: 3, max: 3, label: '新增交织', color: '#52c41a' },
        { min: 2, max: 2, label: '移除交织', color: '#f5222d' },
        { min: 1, max: 1, label: '状态改变', color: '#faad14' },
        { min: 0.4, max: 0.6, label: '有交织(无变)', color: '#2a3a5c' },
        { min: 0, max: 0, label: '无交织(无变)', color: '#1a1a2e' },
      ],
    },
    series: [
      {
        name: '结构差异',
        type: 'heatmap' as const,
        data: data.map((d) => [d[0], d[1], d[2]]),
        itemStyle: { borderColor: '#1a1a2e', borderWidth: 1 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(232, 184, 75, 0.5)' } },
      },
    ],
  }
})

const structureHeatmapData = computed(() => {
  if (!structureCandidateId.value) return null
  return store.getCandidateStructureHeatmap(structureCandidateId.value)
})

const selectedRiskMigration = computed<RiskMigrationPoint[]>(() => {
  return store.selectedCandidate?.riskMigrationPath.slice(0, 20) ?? []
})

function getRiskTransitionColor(t: string) {
  switch (t) {
    case 'resolved': return '#52c41a'
    case 'reduced': return '#1890ff'
    case 'introduced': return '#f5222d'
    case 'persisted': return '#faad14'
    default: return '#a0aec0'
  }
}

function getRiskTransitionLabel(t: string) {
  switch (t) {
    case 'resolved': return '已解决'
    case 'reduced': return '已缓解'
    case 'introduced': return '新引入'
    case 'persisted': return '持续存在'
    default: return '未知'
  }
}

async function handleStartSimulation() {
  if (store.isSimulating) return
  message.info('开始推演，正在生成候选方案...')
  const result = await store.startSimulation()
  if (result) {
    message.success(
      `推演完成！生成 ${result.candidates.length} 套方案，耗时 ${(result.executionTimeMs / 1000).toFixed(2)} 秒，最佳方案 ${result.bestCandidate?.score.totalScore ?? 0} 分`
    )
  }
}

function handleClearSimulation() {
  dialog.warning({
    title: '确认清空推演结果',
    content: '将清除所有候选方案、对比选择和回放状态，此操作不可撤销。',
    positiveText: '确认清空',
    negativeText: '取消',
    onPositiveClick: () => {
      store.clearSimulation()
      message.info('已清空推演结果')
    },
  })
}

function handleResetParams() {
  store.resetSimulationParams()
  message.info('已重置推演参数')
}

function handleSelectCandidate(id: string) {
  store.selectCandidate(store.selectedCandidateId === id ? null : id)
}

function handleToggleCompare(id: string) {
  store.toggleCandidateCompare(id)
}

function handleToggleLock(id: string) {
  store.toggleLockCandidate(id)
  const c = store.candidates.find((x) => x.id === id)
  message.info(c?.isLocked ? '方案已锁定' : '方案已解锁')
}

function openRename(c: CandidateScheme) {
  renamingId.value = c.id
  renameValue.value = c.name
}

function confirmRename() {
  if (renamingId.value && renameValue.value.trim()) {
    store.renameCandidate(renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
  renameValue.value = ''
}

function openApplyConfirm(id: string) {
  applyCandidateId.value = id
  showApplyConfirm.value = true
}

function confirmApply() {
  if (applyCandidateId.value) {
    store.applyCandidateToDesign(applyCandidateId.value)
    const c = store.candidates.find((x) => x.id === applyCandidateId.value)
    message.success(`已应用方案: ${c?.name ?? ''}`)
  }
  showApplyConfirm.value = false
  applyCandidateId.value = null
}

function openStructureModal(id: string) {
  structureCandidateId.value = id
  showStructureModal.value = true
}

function handleStartPlayback(id: string) {
  store.startPlayback(id)
}

function handleStopPlayback() {
  if (playbackTimer) {
    clearInterval(playbackTimer)
    playbackTimer = null
  }
  store.stopPlayback()
}

function handleTogglePlaybackPlaying() {
  store.togglePlaybackPlaying()
  if (store.playbackState?.isPlaying) {
    playbackTimer = window.setInterval(() => {
      store.playbackNextStep()
      if (!store.playbackState?.isPlaying) {
        if (playbackTimer) {
          clearInterval(playbackTimer)
          playbackTimer = null
        }
      }
    }, 800)
  } else {
    if (playbackTimer) {
      clearInterval(playbackTimer)
      playbackTimer = null
    }
  }
}

watch(
  () => store.playbackState?.isPlaying,
  (playing) => {
    if (!playing && playbackTimer) {
      clearInterval(playbackTimer)
      playbackTimer = null
    }
  }
)

onUnmounted(() => {
  if (playbackTimer) {
    clearInterval(playbackTimer)
    playbackTimer = null
  }
})

function handleGenerateReport() {
  reportTitle.value = `推演实验报告 ${new Date().toLocaleString('zh-CN')}`
  reportNotes.value = ''
  showReportDrawer.value = true
}

function confirmExportReport(format: 'json' | 'md') {
  const report = store.generateCurrentExperimentReport(reportTitle.value, reportNotes.value)
  store.downloadReport(report, format)
  message.success(`已导出${format === 'json' ? 'JSON' : 'Markdown'}报告`)
  showReportDrawer.value = false
}

function openCompareModal() {
  if (store.compareCandidates.length < 2) {
    message.warning('请至少选择2个方案进行对比')
    return
  }
  showCompareModal.value = true
}

function getScoreGain(c: CandidateScheme) {
  return c.score.totalScore - store.score.totalScore
}
</script>

<template>
  <NCard class="lab-center" size="small">
    <template #header>
      <div class="panel-header">
        <FlaskConical :size="18" />
        <span>智能工艺推演与方案实验室</span>
        <div class="header-actions">
          <NButton size="tiny" quaternary @click="handleGenerateReport" :disabled="store.candidates.length === 0">
            <template #icon><FileText :size="14" /></template>
            导出报告
          </NButton>
          <NButton size="tiny" quaternary @click="handleClearSimulation" :disabled="store.candidates.length === 0">
            <template #icon><RefreshCw :size="14" /></template>
            清空
          </NButton>
        </div>
      </div>
    </template>

    <NScrollbar style="max-height: 100%">
      <NTabs v-model:value="activeTab" type="line" size="small" animated>
        <NTabPane name="simulation" tab="推演控制">
          <NSpace vertical :size="16">
            <div class="params-section">
              <div class="section-title">
                <SlidersHorizontal :size="14" style="color: var(--color-accent-gold)" />
                推演参数配置
                <NButton size="tiny" text @click="handleResetParams" style="margin-left: auto">
                  <template #icon><RotateCcw :size="12" /></template>
                  重置
                </NButton>
              </div>
              <NForm label-placement="left" label-width="110" size="small">
                <NFormItem label="目标评分">
                  <NSpace align="center">
                    <NSlider
                      :value="paramsForm.targetScore"
                      @update:value="(v) => store.setSimulationParams({ targetScore: v })"
                      :min="60"
                      :max="100"
                      :tooltip="true"
                      style="flex: 1"
                      fill-color="var(--color-accent-gold)"
                    />
                    <span class="param-value">{{ paramsForm.targetScore }}</span>
                  </NSpace>
                </NFormItem>
                <NFormItem label="浮线上限">
                  <NSpace align="center">
                    <NSlider
                      :value="paramsForm.maxFloatLimit"
                      @update:value="(v) => store.setSimulationParams({ maxFloatLimit: v })"
                      :min="3"
                      :max="16"
                      :tooltip="true"
                      style="flex: 1"
                      fill-color="#1890ff"
                    />
                    <span class="param-value">{{ paramsForm.maxFloatLimit }}</span>
                  </NSpace>
                </NFormItem>
                <NFormItem label="综框利用率">
                  <NSpace align="center">
                    <NSlider
                      :value="Math.round(paramsForm.harnessUtilizationMin * 100)"
                      @update:value="(v) => store.setSimulationParams({ harnessUtilizationMin: v / 100 })"
                      :min="30"
                      :max="100"
                      :tooltip="true"
                      style="flex: 1"
                      fill-color="#52c41a"
                      format-tooltip="(v) => v + '%'"
                    />
                    <span class="param-value">{{ Math.round(paramsForm.harnessUtilizationMin * 100) }}%</span>
                  </NSpace>
                </NFormItem>
                <NFormItem label="材料类型">
                  <NSelect
                    :value="paramsForm.materialType"
                    @update:value="(v) => store.setSimulationParams({ materialType: v as MaterialType })"
                    :options="materialOptions"
                    size="small"
                    style="width: 100%"
                  />
                </NFormItem>
                <NFormItem label="候选方案数">
                  <NSpace align="center">
                    <NSlider
                      :value="paramsForm.candidateCount"
                      @update:value="(v) => store.setSimulationParams({ candidateCount: v })"
                      :min="2"
                      :max="10"
                      :tooltip="true"
                      style="flex: 1"
                      fill-color="#722ed1"
                    />
                    <span class="param-value">{{ paramsForm.candidateCount }}</span>
                  </NSpace>
                </NFormItem>
                <NFormItem label="最大迭代">
                  <NSpace align="center">
                    <NSlider
                      :value="paramsForm.maxIterations"
                      @update:value="(v) => store.setSimulationParams({ maxIterations: v })"
                      :min="5"
                      :max="50"
                      :tooltip="true"
                      style="flex: 1"
                      fill-color="#eb2f96"
                    />
                    <span class="param-value">{{ paramsForm.maxIterations }}</span>
                  </NSpace>
                </NFormItem>
              </NForm>
              <div class="current-baseline">
                <div class="baseline-label">
                  <Target :size="12" />
                  当前基准评分
                </div>
                <div class="baseline-score" :style="{ color: gradeConfig[store.score.grade].color }">
                  {{ store.score.totalScore }}
                  <span class="baseline-grade">/ {{ store.score.grade }}</span>
                </div>
              </div>
              <NButton
                type="primary"
                size="medium"
                block
                :loading="store.isSimulating"
                @click="handleStartSimulation"
                class="simulate-btn"
              >
                <template #icon>
                  <Wand2 :size="16" />
                </template>
                {{ store.isSimulating ? '推演中...' : '开始自动推演' }}
              </NButton>
            </div>

            <div v-if="store.lastSimulationMeta" class="sim-meta">
              <NSpace :size="16">
                <div class="meta-item">
                  <Clock :size="12" />
                  <span>耗时: {{ (store.lastSimulationMeta.executionTimeMs / 1000).toFixed(2) }}s</span>
                </div>
                <div class="meta-item">
                  <Activity :size="12" />
                  <span>迭代: {{ store.lastSimulationMeta.totalIterations }}</span>
                </div>
                <div class="meta-item">
                  <Award :size="12" />
                  <span>最佳: {{ store.bestCandidate?.score.totalScore ?? 0 }} 分</span>
                </div>
              </NSpace>
            </div>

            <div v-if="store.candidates.length > 0" class="score-curve-section">
              <div class="section-title">
                <TrendingUp :size="14" style="color: var(--color-accent-gold)" />
                评分演进曲线
              </div>
              <VChart class="score-curve-chart" :option="scoreCurveOption" autoresize />
            </div>

            <div v-if="store.candidates.length === 0" class="empty-lab">
              <NSpin v-if="store.isSimulating">
                <template #description>正在推演中，请稍候...</template>
              </NSpin>
              <div v-else class="empty-inner">
                <FlaskConical :size="40" style="color: var(--color-text-muted)" />
                <span>配置参数后点击开始推演，系统将自动生成多套优化方案</span>
              </div>
            </div>
          </NSpace>
        </NTabPane>

        <NTabPane name="candidates" tab="候选方案">
          <NSpace vertical :size="12">
            <div v-if="store.candidates.length > 0" class="candidates-toolbar">
              <NButton size="tiny" type="primary" @click="openCompareModal" :disabled="store.compareCandidates.length < 2">
                <template #icon><GitCompare :size="12" /></template>
                批量对比 ({{ store.compareCandidates.length }})
              </NButton>
              <NButton size="tiny" quaternary @click="store.clearCompareCandidates" :disabled="store.compareCandidates.length === 0">
                <template #icon><XCircle :size="12" /></template>
                清空对比
              </NButton>
              <span class="toolbar-hint">勾选方案进行批量对比（最多4个）</span>
            </div>
            <div v-if="store.candidates.length === 0" class="empty-lab">
              <div class="empty-inner">
                <Layers3 :size="40" style="color: var(--color-text-muted)" />
                <span>暂无候选方案，请先执行推演</span>
              </div>
            </div>
            <div v-else class="candidate-list">
              <div
                v-for="c in store.candidates"
                :key="c.id"
                class="candidate-card"
                :class="{
                  'candidate-card--selected': store.selectedCandidateId === c.id,
                  'candidate-card--best': store.bestCandidate?.id === c.id,
                  'candidate-card--locked': c.isLocked,
                }"
                @click="handleSelectCandidate(c.id)"
              >
                <div class="candidate-header">
                  <div class="candidate-left">
                    <NCheckbox
                      :checked="store.compareCandidateIds.includes(c.id)"
                      @update:checked="() => handleToggleCompare(c.id)"
                      @click.stop
                    />
                    <div v-if="renamingId === c.id" class="rename-input" @click.stop>
                      <NInput v-model:value="renameValue" size="tiny" @keyup.enter="confirmRename" @blur="confirmRename" autofocus />
                    </div>
                    <div v-else class="candidate-name" @dblclick.stop="openRename(c)">
                      {{ c.name }}
                      <Edit2 v-if="store.selectedCandidateId === c.id" :size="10" class="edit-icon" @click.stop="openRename(c)" />
                    </div>
                    <NTag v-if="store.bestCandidate?.id === c.id" size="tiny" type="success" round>
                      <Award :size="10" /> 推荐
                    </NTag>
                    <NTooltip>
                      <template #trigger>
                        <div class="candidate-lock" @click.stop="handleToggleLock(c.id)">
                          <Lock v-if="c.isLocked" :size="12" style="color: #f5222d" />
                          <Unlock v-else :size="12" style="color: var(--color-text-muted)" />
                        </div>
                      </template>
                      {{ c.isLocked ? '点击解锁' : '点击锁定，防止意外修改' }}
                    </NTooltip>
                  </div>
                  <div class="candidate-score-wrap">
                    <span class="candidate-score" :style="{ color: gradeConfig[c.score.grade].color }">
                      {{ c.score.totalScore }}
                    </span>
                    <span class="score-gain" :class="getScoreGain(c) >= 0 ? 'gain' : 'loss'">
                      {{ getScoreGain(c) >= 0 ? '+' : '' }}{{ getScoreGain(c) }}
                    </span>
                  </div>
                </div>
                <div class="candidate-grade-row">
                  <span class="candidate-grade" :style="{ background: gradeConfig[c.score.grade].bgColor, color: gradeConfig[c.score.grade].color }">
                    {{ c.score.grade }} · {{ gradeConfig[c.score.grade].label }}
                  </span>
                  <span class="candidate-steps">
                    <Activity :size="10" />
                    {{ c.steps.length }} 步迭代
                  </span>
                </div>
                <div class="candidate-breakdown">
                  <div v-for="(cfg, key) in categoryLabels" :key="key" class="breakdown-item">
                    <component :is="cfg.icon" :size="10" :style="{ color: cfg.color }" />
                    <span class="breakdown-label">{{ cfg.label }}</span>
                    <NProgress
                      type="line"
                      :percentage="(c.score.breakdown as any)[key]"
                      :show-indicator="false"
                      :height="4"
                      :border-radius="2"
                      :color="cfg.color"
                      :rail-color="'var(--color-bg-deep)'"
                      style="width: 50px"
                    />
                    <span class="breakdown-value">{{ (c.score.breakdown as any)[key] }}</span>
                  </div>
                </div>
                <div class="candidate-tags">
                  <NTag v-for="tag in c.tags.slice(0, 4)" :key="tag" size="tiny" round :bordered="false" type="info">
                    {{ tag }}
                  </NTag>
                </div>
                <div class="candidate-actions" @click.stop>
                  <NTooltip>
                    <template #trigger>
                      <NButton size="tiny" quaternary @click="openStructureModal(c.id)">
                        <template #icon><ScanSearch :size="12" /></template>
                        差异热图
                      </NButton>
                    </template>
                    查看与基准方案的结构差异热图
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton size="tiny" quaternary @click="handleStartPlayback(c.id)">
                        <template #icon><Play :size="12" /></template>
                        分步回放
                      </NButton>
                    </template>
                    分步查看方案的迭代优化过程
                  </NTooltip>
                  <NButton size="tiny" type="primary" @click="openApplyConfirm(c.id)">
                    <template #icon><CheckCircle :size="12" /></template>
                    应用方案
                  </NButton>
                </div>
              </div>
            </div>
          </NSpace>
        </NTabPane>

        <NTabPane name="detail" tab="方案详情" :disabled="!store.selectedCandidate">
          <NSpace vertical :size="16" v-if="store.selectedCandidate">
            <div class="detail-hero">
              <div class="detail-grade" :style="{ background: gradeConfig[store.selectedCandidate.score.grade].bgColor }">
                <span class="grade-letter" :style="{ color: gradeConfig[store.selectedCandidate.score.grade].color }">
                  {{ store.selectedCandidate.score.grade }}
                </span>
                <span class="grade-label" :style="{ color: gradeConfig[store.selectedCandidate.score.grade].color }">
                  {{ gradeConfig[store.selectedCandidate.score.grade].label }}
                </span>
              </div>
              <div class="detail-info">
                <div class="detail-title-row">
                  <span class="detail-name">{{ store.selectedCandidate.name }}</span>
                  <NTag v-if="store.bestCandidate?.id === store.selectedCandidate.id" size="small" type="success">
                    <Award :size="12" /> 最佳推荐方案
                  </NTag>
                </div>
                <div class="detail-score-row">
                  <span class="detail-score">{{ store.selectedCandidate.score.totalScore }}</span>
                  <span class="detail-max">/ 100</span>
                  <span class="score-gain large" :class="getScoreGain(store.selectedCandidate) >= 0 ? 'gain' : 'loss'">
                    <TrendingUp v-if="getScoreGain(store.selectedCandidate) >= 0" :size="14" />
                    <TrendingDown v-else :size="14" />
                    {{ getScoreGain(store.selectedCandidate) >= 0 ? '+' : '' }}{{ getScoreGain(store.selectedCandidate) }} 分
                  </span>
                </div>
                <NProgress
                  type="line"
                  :percentage="store.selectedCandidate.score.totalScore"
                  :show-indicator="false"
                  :height="8"
                  :border-radius="4"
                  :color="gradeConfig[store.selectedCandidate.score.grade].color"
                  :rail-color="'var(--color-bg-deep)'"
                />
              </div>
            </div>

            <div class="detail-penalties">
              <div class="penalty-item">
                <XCircle :size="12" style="color: var(--color-error)" />
                <span>错误扣分 {{ store.selectedCandidate.score.errorPenalty }}</span>
              </div>
              <div class="penalty-item">
                <AlertTriangle :size="12" style="color: var(--color-warning)" />
                <span>警告扣分 {{ store.selectedCandidate.score.warningPenalty }}</span>
              </div>
              <div class="penalty-item">
                <Flame :size="12" style="color: #e67e22" />
                <span>浮线扣分 {{ store.selectedCandidate.score.maxFloatPenalty }}</span>
              </div>
              <div class="penalty-item">
                <Layers :size="12" style="color: #722ed1" />
                <span>均衡扣分 {{ store.selectedCandidate.score.harnessBalancePenalty }}</span>
              </div>
            </div>

            <div class="risk-migration-section">
              <div class="section-title">
                <Thermometer :size="14" style="color: var(--color-accent-gold)" />
                风险迁移路径
                <span class="section-sub">方案迭代过程中风险的演化轨迹</span>
              </div>
              <div v-if="selectedRiskMigration.length > 0" class="risk-migration-list">
                <div
                  v-for="(rp, idx) in selectedRiskMigration.slice(0, 10)"
                  :key="`${rp.step}-${rp.type}-${rp.targetId}-${idx}`"
                  class="risk-migration-row"
                >
                  <span class="risk-step">S{{ rp.step }}</span>
                  <span class="risk-type-tag" :style="{ borderColor: getRiskTransitionColor(rp.transition), color: getRiskTransitionColor(rp.transition) }">
                    {{ getRiskTransitionLabel(rp.transition) }}
                  </span>
                  <span class="risk-target">
                    {{ rp.type === 'harness' ? '综框' : rp.type === 'warp' ? '经线' : '踏板' }} {{ rp.targetId }}
                  </span>
                  <NProgress
                    type="line"
                    :percentage="Math.round(rp.riskLevel * 100)"
                    :show-indicator="false"
                    :height="4"
                    :border-radius="2"
                    :color="rp.riskLevel > 0.7 ? '#f5222d' : rp.riskLevel > 0.4 ? '#e67e22' : '#1890ff'"
                    :rail-color="'var(--color-bg-deep)'"
                    style="width: 60px"
                  />
                  <span class="risk-desc">{{ rp.description }}</span>
                </div>
              </div>
              <div v-else class="empty-sub">
                <CheckCircle :size="16" style="color: var(--color-success)" />
                该方案迭代过程中无显著风险迁移
              </div>
            </div>

            <div v-if="store.playbackState && store.playbackState.candidateId === store.selectedCandidate.id" class="playback-section">
              <div class="section-title">
                <Play :size="14" style="color: var(--color-accent-gold)" />
                分步回放 - 第 {{ store.playbackState.currentStepIndex + 1 }} / {{ store.selectedCandidate.steps.length }} 步
              </div>
              <div class="playback-controls">
                <NButton size="tiny" quaternary @click="store.playbackPrevStep()" :disabled="store.playbackState.currentStepIndex === 0">
                  <template #icon><SkipBack :size="14" /></template>
                  上一步
                </NButton>
                <NButton size="tiny" type="primary" @click="handleTogglePlaybackPlaying">
                  <template #icon>
                    <Pause v-if="store.playbackState.isPlaying" :size="14" />
                    <Play v-else :size="14" />
                  </template>
                  {{ store.playbackState.isPlaying ? '暂停' : '播放' }}
                </NButton>
                <NButton size="tiny" quaternary @click="store.playbackNextStep()" :disabled="store.playbackState.currentStepIndex >= store.selectedCandidate.steps.length - 1">
                  <template #icon><SkipForward :size="14" /></template>
                  下一步
                </NButton>
                <NSlider
                  :value="store.playbackState.currentStepIndex"
                  @update:value="(v) => store.setPlaybackStep(v)"
                  :min="0"
                  :max="store.selectedCandidate.steps.length - 1"
                  style="flex: 1; margin: 0 12px"
                  fill-color="var(--color-accent-gold)"
                />
                <NButton size="tiny" quaternary @click="handleStopPlayback">
                  <template #icon><StopCircle :size="14" /></template>
                  停止
                </NButton>
              </div>
              <div v-if="store.playbackStep" class="playback-step-info">
                <div class="step-score-row">
                  <span>迭代 {{ store.playbackStep.iteration }}</span>
                  <span class="step-score" :style="{ color: gradeConfig[store.playbackStep.score.grade].color }">
                    {{ store.playbackStep.score.totalScore }} 分 ({{ store.playbackStep.score.grade }})
                  </span>
                </div>
                <div v-if="store.playbackStep.appliedChanges.length > 0" class="step-changes">
                  <div class="section-subtitle">
                    <Edit2 :size="11" />
                    本步变更 ({{ store.playbackStep.appliedChanges.length }})
                  </div>
                  <div class="change-list">
                    <div v-for="(ch, idx) in store.playbackStep.appliedChanges.slice(0, 5)" :key="idx" class="change-row-mini">
                      <span class="change-type-badge" :class="ch.changeType">{{ ch.changeType === 'added' ? '新增' : ch.changeType === 'removed' ? '删除' : '修改' }}</span>
                      <span>{{ ch.description }}</span>
                    </div>
                    <div v-if="store.playbackStep.appliedChanges.length > 5" class="change-more">
                      ...以及 {{ store.playbackStep.appliedChanges.length - 5 }} 处其他变更
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="playback-empty">
              <NButton size="small" type="primary" @click="handleStartPlayback(store.selectedCandidate.id)">
                <template #icon><Play :size="14" /></template>
                启动分步回放，查看优化过程
              </NButton>
            </div>
          </NSpace>
          <div v-else class="empty-lab">
            <div class="empty-inner">
              <Search :size="40" style="color: var(--color-text-muted)" />
              <span>请在"候选方案"中选择一个方案查看详情</span>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="compare" tab="批量对比" :disabled="store.compareCandidates.length < 2">
          <NSpace vertical :size="16" v-if="store.compareCandidates.length >= 2">
            <div class="section-title">
              <GitCompare :size="14" style="color: var(--color-accent-gold)" />
              多维对比分析
              <span class="section-sub">对比 {{ store.compareCandidates.length }} 个方案</span>
            </div>
            <VChart class="compare-radar-chart" :option="candidateCompareRadarOption" autoresize />
            <div class="compare-table-wrap">
              <NScrollbar>
                <table class="compare-table">
                  <thead>
                    <tr>
                      <th>指标</th>
                      <th v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        {{ c.name }}
                        <NTag v-if="store.bestCandidate?.id === c.id" size="tiny" type="success" style="margin-left: 4px">最佳</NTag>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="row-label">综合评分</td>
                      <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        <span class="big-score" :style="{ color: gradeConfig[c.score.grade].color }">{{ c.score.totalScore }}</span>
                        <span class="score-gain small" :class="getScoreGain(c) >= 0 ? 'gain' : 'loss'">
                          {{ getScoreGain(c) >= 0 ? '+' : '' }}{{ getScoreGain(c) }}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td class="row-label">等级</td>
                      <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        <span class="grade-badge" :style="{ background: gradeConfig[c.score.grade].bgColor, color: gradeConfig[c.score.grade].color }">
                          {{ c.score.grade }} {{ gradeConfig[c.score.grade].label }}
                        </span>
                      </td>
                    </tr>
                    <tr v-for="(cfg, key) in categoryLabels" :key="key">
                      <td class="row-label">
                        <component :is="cfg.icon" :size="12" :style="{ color: cfg.color }" />
                        {{ cfg.label }}
                      </td>
                      <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        <NSpace align="center">
                          <NProgress
                            type="line"
                            :percentage="(c.score.breakdown as any)[key]"
                            :show-indicator="false"
                            :height="5"
                            :border-radius="3"
                            :color="cfg.color"
                            :rail-color="'var(--color-bg-deep)'"
                            style="width: 80px"
                          />
                          <span>{{ (c.score.breakdown as any)[key] }}</span>
                        </NSpace>
                      </td>
                    </tr>
                    <tr>
                      <td class="row-label">迭代步数</td>
                      <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        {{ c.steps.length }} 步
                      </td>
                    </tr>
                    <tr>
                      <td class="row-label">标签</td>
                      <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        <span v-for="t in c.tags.slice(0, 3)" :key="t" class="inline-tag">{{ t }}</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="row-label">操作</td>
                      <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                        <NButton size="tiny" type="primary" @click="openApplyConfirm(c.id)">
                          <template #icon><CheckCircle :size="12" /></template>
                          应用
                        </NButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </NScrollbar>
            </div>
          </NSpace>
          <div v-else class="empty-lab">
            <div class="empty-inner">
              <GitCompare :size="40" style="color: var(--color-text-muted)" />
              <span>在"候选方案"中勾选至少2个方案以进行批量对比</span>
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </NScrollbar>

    <NModal v-model:show="showApplyConfirm" preset="card" title="确认应用方案" style="max-width: 520px" :mask-closable="false">
      <div class="confirm-content">
        <NAlert type="warning" :show-icon="true" style="margin-bottom: 12px">
          此操作将替换当前工艺设计，可通过撤销按钮恢复。
        </NAlert>
        <div v-if="applyCandidateId" class="confirm-info">
          <p><strong>将应用方案：</strong>{{ store.candidates.find(c => c.id === applyCandidateId)?.name }}</p>
          <p>
            <strong>评分变化：</strong>
            {{ store.score.totalScore }}
            →
            <span class="gain-text">
              {{ store.candidates.find(c => c.id === applyCandidateId)?.score.totalScore }}
              (+{{ (store.candidates.find(c => c.id === applyCandidateId)?.score.totalScore ?? 0) - store.score.totalScore }} 分)
            </span>
          </p>
        </div>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="showApplyConfirm = false">取消</NButton>
          <NButton size="small" type="primary" @click="confirmApply">确认应用</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showStructureModal" preset="card" title="结构差异热图" style="max-width: 820px" :mask-closable="false">
      <div v-if="structureHeatmapData" class="structure-modal">
        <div class="structure-summary">
          <NSpace :size="16" wrap>
            <div class="summary-card added">
              <span class="summary-num">{{ structureHeatmapData.diffSummary.added }}</span>
              <span class="summary-label">新增交织</span>
            </div>
            <div class="summary-card removed">
              <span class="summary-num">{{ structureHeatmapData.diffSummary.removed }}</span>
              <span class="summary-label">移除交织</span>
            </div>
            <div class="summary-card modified">
              <span class="summary-num">{{ structureHeatmapData.diffSummary.modified }}</span>
              <span class="summary-label">状态改变</span>
            </div>
            <div class="summary-card unchanged">
              <span class="summary-num">{{ structureHeatmapData.diffSummary.unchanged }}</span>
              <span class="summary-label">无变化</span>
            </div>
          </NSpace>
        </div>
        <VChart class="structure-heatmap" :option="structureHeatmapOption" autoresize />
        <div class="heatmap-hint">
          <Info :size="12" />
          对比当前基准方案（行=踏板步，列=经线），颜色表示交织状态变化
        </div>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="showStructureModal = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showCompareModal" preset="card" title="批量对比" style="max-width: 900px" :mask-closable="false">
      <NSpace vertical :size="16">
        <VChart class="compare-radar-chart-large" :option="candidateCompareRadarOption" autoresize />
        <div class="compare-table-wrap">
          <NScrollbar>
            <table class="compare-table">
              <thead>
                <tr>
                  <th>指标</th>
                  <th v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                    {{ c.name }}
                    <NTag v-if="store.bestCandidate?.id === c.id" size="tiny" type="success" style="margin-left: 4px">最佳</NTag>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="row-label">综合评分</td>
                  <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                    <span class="big-score" :style="{ color: gradeConfig[c.score.grade].color }">{{ c.score.totalScore }}</span>
                  </td>
                </tr>
                <tr v-for="(cfg, key) in categoryLabels" :key="key">
                  <td class="row-label">{{ cfg.label }}</td>
                  <td v-for="c in store.compareCandidates" :key="c.id" :class="{ 'col-best': store.bestCandidate?.id === c.id }">
                    {{ (c.score.breakdown as any)[key] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </NScrollbar>
        </div>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="showCompareModal = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>

    <NDrawer v-model:show="showReportDrawer" :width="480" placement="right">
      <NDrawerContent title="导出实验报告" :native-scrollbar="false">
        <NSpace vertical :size="16">
          <NForm label-placement="top" size="small">
            <NFormItem label="报告标题">
              <NInput v-model:value="reportTitle" />
            </NFormItem>
            <NFormItem label="备注说明（可选）">
              <NTextarea v-model:value="reportNotes" :rows="4" placeholder="输入实验备注、观察结论等..." />
            </NFormItem>
          </NForm>
          <NAlert type="info" :show-icon="true">
            <template #header>报告内容预览</template>
            <ul class="report-preview-list">
              <li>实验参数配置</li>
              <li>基准方案评分（{{ store.score.totalScore }} 分）</li>
              <li>{{ store.candidates.length }} 套候选方案对比表</li>
              <li>最佳方案推荐与评分提升</li>
              <li>风险迁移路径分析</li>
            </ul>
          </NAlert>
          <NDivider />
          <NSpace justify="end">
            <NButton @click="showReportDrawer = false">取消</NButton>
            <NButton @click="confirmExportReport('md')" type="default">
              <template #icon><FileText :size="14" /></template>
              导出 Markdown
            </NButton>
            <NButton @click="confirmExportReport('json')" type="primary">
              <template #icon><FileJson :size="14" /></template>
              导出 JSON
            </NButton>
          </NSpace>
        </NSpace>
      </NDrawerContent>
    </NDrawer>
  </NCard>
</template>

<script lang="ts">
import { TrendingDown } from 'lucide-vue-next'
export default {
  components: { TrendingDown }
}
</script>

<style scoped>
.lab-center {
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

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}

.section-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-left: 4px;
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.params-section {
  background: var(--color-bg-deep);
  border-radius: 8px;
  padding: 14px;
}

.param-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent-gold);
  min-width: 36px;
  text-align: right;
}

.current-baseline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px 12px;
  background: linear-gradient(90deg, rgba(232, 184, 75, 0.08), transparent);
  border-left: 3px solid var(--color-accent-gold);
  border-radius: 4px;
}

.baseline-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.baseline-score {
  font-size: 22px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
}

.baseline-grade {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.8;
}

.simulate-btn {
  margin-top: 14px;
}

.sim-meta {
  display: flex;
  justify-content: center;
  padding: 10px;
  background: var(--color-bg-deep);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.score-curve-section {
  background: var(--color-bg-deep);
  border-radius: 8px;
  padding: 14px;
}

.score-curve-chart {
  width: 100%;
  height: 200px;
}

.empty-lab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  background: var(--color-bg-deep);
  border-radius: 8px;
}

.empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
  padding: 20px;
}

.empty-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  background: var(--color-bg-deep);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  justify-content: center;
}

.candidates-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-left: auto;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.candidate-card {
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.candidate-card:hover {
  border-color: var(--color-accent-gold);
  box-shadow: 0 2px 12px rgba(232, 184, 75, 0.1);
}

.candidate-card--selected {
  border-color: var(--color-accent-gold);
  background: rgba(232, 184, 75, 0.05);
}

.candidate-card--best {
  border-color: var(--color-success);
}

.candidate-card--locked {
  border-style: dashed;
}

.candidate-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.candidate-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.candidate-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-icon {
  opacity: 0;
  transition: opacity 0.2s;
  color: var(--color-text-muted);
}

.candidate-name:hover .edit-icon {
  opacity: 1;
}

.rename-input {
  width: 140px;
}

.candidate-lock {
  display: flex;
  align-items: center;
  padding: 2px;
}

.candidate-score-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.candidate-score {
  font-size: 22px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
  line-height: 1;
}

.score-gain {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}

.score-gain.gain {
  color: var(--color-success);
  background: rgba(82, 196, 26, 0.1);
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.score-gain.loss {
  color: var(--color-error);
  background: rgba(245, 34, 45, 0.1);
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.score-gain.small {
  font-size: 10px;
}

.score-gain.large {
  font-size: 14px;
  padding: 3px 10px;
}

.candidate-grade-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.candidate-grade {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 10px;
}

.candidate-steps {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.candidate-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.breakdown-label {
  width: 50px;
  color: var(--color-text-secondary);
}

.breakdown-value {
  width: 24px;
  text-align: right;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 11px;
}

.candidate-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.candidate-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inline-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(232, 184, 75, 0.1);
  color: var(--color-accent-gold);
  margin-right: 3px;
}

.detail-section {
  background: var(--color-bg-deep);
  border-radius: 8px;
  padding: 14px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.detail-score-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.big-score {
  font-size: 26px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
  line-height: 1;
}

.grade-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 10px;
}

.scheme-radar-chart {
  width: 100%;
  height: 260px;
}

.penalty-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  padding: 10px;
  background: rgba(245, 34, 45, 0.04);
  border-radius: 6px;
  border: 1px solid rgba(245, 34, 45, 0.1);
}

.penalty-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.risk-migration-section {
  margin-top: 14px;
}

.risk-migration-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.risk-migration-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-bg-deep);
  border-radius: 6px;
  font-size: 12px;
}

.risk-step {
  font-weight: 600;
  color: var(--color-accent-gold);
  min-width: 32px;
}

.risk-type-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid;
  font-weight: 600;
  min-width: 48px;
  text-align: center;
}

.risk-target {
  color: var(--color-text-secondary);
  min-width: 70px;
}

.risk-desc {
  color: var(--color-text-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playback-section {
  margin-top: 14px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(232, 184, 75, 0.06), rgba(82, 196, 26, 0.04));
  border-radius: 8px;
  border: 1px solid rgba(232, 184, 75, 0.15);
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.playback-step-info {
  padding: 10px;
  background: var(--color-bg-card);
  border-radius: 6px;
}

.step-score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.step-score {
  font-size: 16px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
}

.step-changes {
  margin-top: 10px;
}

.change-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.change-row-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 4px 6px;
  background: var(--color-bg-deep);
  border-radius: 4px;
}

.change-type-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.change-type-badge.added {
  background: rgba(82, 196, 26, 0.15);
  color: var(--color-success);
}

.change-type-badge.removed {
  background: rgba(245, 34, 45, 0.15);
  color: var(--color-error);
}

.change-type-badge.modified {
  background: rgba(24, 144, 255, 0.15);
  color: var(--color-info);
}

.change-more {
  font-size: 11px;
  color: var(--color-text-muted);
  padding-left: 6px;
}

.playback-empty {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  padding: 20px;
  background: var(--color-bg-deep);
  border-radius: 8px;
}

.compare-radar-chart {
  width: 100%;
  height: 300px;
  background: var(--color-bg-deep);
  border-radius: 8px;
  padding: 8px;
}

.compare-radar-chart-large {
  width: 100%;
  height: 380px;
  background: var(--color-bg-deep);
  border-radius: 8px;
  padding: 8px;
}

.compare-table-wrap {
  background: var(--color-bg-deep);
  border-radius: 8px;
  padding: 8px;
  max-height: 360px;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.compare-table th,
.compare-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.compare-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(232, 184, 75, 0.03);
  position: sticky;
  top: 0;
  z-index: 1;
}

.compare-table td.col-best,
.compare-table th.col-best {
  background: rgba(82, 196, 26, 0.05);
}

.row-label {
  color: var(--color-text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.confirm-content {
  padding: 4px 0;
}

.confirm-info {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 2;
}

.gain-text {
  color: var(--color-success);
  font-weight: 600;
}

.structure-modal {
  padding: 4px 0;
}

.structure-summary {
  margin-bottom: 14px;
}

.summary-card {
  padding: 10px 16px;
  border-radius: 8px;
  text-align: center;
  min-width: 100px;
}

.summary-card.added {
  background: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.2);
}

.summary-card.removed {
  background: rgba(245, 34, 45, 0.1);
  border: 1px solid rgba(245, 34, 45, 0.2);
}

.summary-card.modified {
  background: rgba(24, 144, 255, 0.1);
  border: 1px solid rgba(24, 144, 255, 0.2);
}

.summary-card.unchanged {
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border);
}

.summary-num {
  display: block;
  font-size: 22px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
  color: var(--color-text-primary);
}

.summary-card.added .summary-num {
  color: var(--color-success);
}

.summary-card.removed .summary-num {
  color: var(--color-error);
}

.summary-card.modified .summary-num {
  color: var(--color-info);
}

.summary-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.structure-heatmap {
  width: 100%;
  height: 360px;
}

.heatmap-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 10px;
  padding: 8px;
  background: var(--color-bg-deep);
  border-radius: 4px;
}

.report-preview-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}
</style>