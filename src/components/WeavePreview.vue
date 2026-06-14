<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { HeatmapChart, ScatterChart } from 'echarts/charts'
import { GridComponent, VisualMapComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useWeaveStore } from '@/stores/weave'

use([HeatmapChart, ScatterChart, GridComponent, VisualMapComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const store = useWeaveStore()

const heatmapData = computed(() => {
  const { matrix } = store.weavePreview
  const data: [number, number, number][] = []
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      data.push([col, row, matrix[row][col]])
    }
  }
  return data
})

const warningCells = computed(() => {
  const { matrix } = store.weavePreview
  const cells = new Set<string>()
  if (matrix.length === 0 || !matrix[0]?.length) return cells
  const maxFloat = store.maxFloatLength
  const rows = matrix.length
  const cols = matrix[0].length

  const fullSameRows = new Set<number>()
  for (let t = 0; t < rows; t++) {
    const first = matrix[t][0]
    let allSame = true
    for (let w = 1; w < cols; w++) {
      if (matrix[t][w] !== first) {
        allSame = false
        break
      }
    }
    if (allSame) fullSameRows.add(t)
  }

  const fullSameCols = new Set<number>()
  for (let w = 0; w < cols; w++) {
    const first = matrix[0][w]
    let allSame = true
    for (let t = 1; t < rows; t++) {
      if (matrix[t][w] !== first) {
        allSame = false
        break
      }
    }
    if (allSame) fullSameCols.add(w)
  }

  for (let t = 0; t < rows; t++) {
    if (fullSameRows.has(t)) continue
    let start = -1
    for (let w = 0; w <= cols; w++) {
      const raised = w < cols && matrix[t][w] === 1
      if (raised) {
        if (start === -1) start = w
      } else if (start !== -1) {
        if (w - start > maxFloat) {
          for (let c = start; c < w; c++) cells.add(`${t},${c}`)
        }
        start = -1
      }
    }
  }
  for (let w = 0; w < cols; w++) {
    if (fullSameCols.has(w)) continue
    let start = -1
    for (let t = 0; t <= rows; t++) {
      const raised = t < rows && matrix[t][w] === 1
      if (raised) {
        if (start === -1) start = t
      } else if (start !== -1) {
        if (t - start > maxFloat) {
          for (let r = start; r < t; r++) cells.add(`${r},${w}`)
        }
        start = -1
      }
    }
  }
  return cells
})

const scatterWarningData = computed(() => {
  const data: [number, number][] = []
  for (const key of warningCells.value) {
    const [row, col] = key.split(',').map(Number)
    data.push([col, row])
  }
  return data
})

const chartOption = computed(() => {
  const { matrix } = store.weavePreview
  const treadleCount = matrix.length
  const warpCount = matrix[0]?.length ?? 0
  const yAxisData = Array.from({ length: treadleCount }, (_, i) => `踏板${i + 1}`)
  const xAxisData = Array.from({ length: warpCount }, (_, i) => `${i + 1}`)
  return {
    tooltip: {
      formatter: (params: any) => {
        if (params.seriesType === 'heatmap') {
          const [col, row, value] = params.data
          const warn = warningCells.value.has(`${row},${col}`) ? ' ⚠ 浮线过长' : ''
          return `经线 ${col + 1} / 踏板${row + 1}<br/>状态：${value === 1 ? '提起' : '落下'}${warn}`
        }
        if (params.seriesType === 'scatter') {
          const [col, row] = params.data
          return `经线 ${col + 1} / 踏板${row + 1}<br/>⚠ 浮线过长`
        }
        return ''
      },
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#2a3a5c',
      textStyle: { color: '#f5f0e8', fontSize: 12 },
    },
    grid: {
      top: 20,
      bottom: 60,
      left: 65,
      right: 20,
      containLabel: false,
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
      },
    ],
    xAxis: {
      type: 'category',
      data: xAxisData,
      name: '经线编号',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: {
        color: '#a0aec0',
        fontSize: 10,
        interval: warpCount > 30 ? Math.ceil(warpCount / 20) : 0,
      },
      nameTextStyle: { color: '#a0aec0', fontSize: 11 },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { lineStyle: { color: '#4a5568' } },
    },
    yAxis: {
      type: 'category',
      data: yAxisData,
      name: '踏板编号',
      nameLocation: 'middle',
      nameGap: 45,
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      nameTextStyle: { color: '#a0aec0', fontSize: 11 },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisTick: { lineStyle: { color: '#4a5568' } },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      pieces: [
        { value: 0, color: '#1e2a45' },
        { value: 1, color: '#e8b84b' },
      ],
    },
    series: [
      {
        name: '织物结构',
        type: 'heatmap',
        data: heatmapData.value,
        itemStyle: { borderWidth: 1, borderColor: '#2d3748' },
        emphasis: {
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
        },
      },
      {
        name: '浮线警告',
        type: 'scatter',
        data: scatterWarningData.value,
        symbol: 'rect',
        symbolSize: [12, 12],
        itemStyle: {
          color: 'rgba(192, 57, 43, 0.7)',
          borderColor: '#c0392b',
          borderWidth: 1,
        },
        z: 10,
        silent: true,
      },
    ],
  }
})
</script>

<template>
  <div class="weave-preview">
    <div class="preview-header">
      <span class="preview-title">织物结构预览</span>
      <span v-if="warningCells.size > 0" class="warning-badge">
        浮线警告 ×{{ warningCells.size }}
      </span>
    </div>
    <VChart class="preview-chart" :option="chartOption" autoresize />
  </div>
</template>

<style scoped>
.weave-preview {
  background: #1a202c;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.preview-title {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
}
.warning-badge {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  animation: badge-pulse 2s ease-in-out infinite;
}
.preview-chart {
  flex: 1;
  min-height: 0;
}

@keyframes badge-pulse {
  0%, 100% {
    background: rgba(231, 76, 60, 0.15);
  }
  50% {
    background: rgba(231, 76, 60, 0.3);
  }
}
</style>
