import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  Harness,
  WarpEnd,
  Treadle,
  WeaveDesign,
  FloatWarning,
  ValidationResult,
  DesignStats,
  ExportData,
  WeaveScore,
  RiskHotspot,
  SortedIssue,
  OptimizationSuggestion,
  HistorySnapshot,
  SimulationParams,
  CandidateScheme,
  SimulationStep,
  ExperimentReport,
} from '@/types/weave'
import {
  calculateWeaveScore,
  generateRiskHotspots,
  generateSortedIssues,
  generateOptimizationSuggestions,
} from '@/lib/scoring'
import {
  runSimulation,
  buildExperimentReport,
  cloneDesign,
  computeStructureHeatmap,
  evaluateDesign,
  exportReportAsJSON,
  generateReportMarkdown,
} from '@/lib/simulation'
import { DEFAULT_SIMULATION_PARAMS } from '@/types/weave'

function createHarnesses(count: number): Harness[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    label: `综框 ${i + 1}`,
  }))
}

function createWarpEnds(count: number, harnessCount: number): WarpEnd[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    harnessId: harnessCount > 0 ? (i % harnessCount) + 1 : null,
  }))
}

function createTreadles(harnessCount: number): Treadle[] {
  if (harnessCount === 0) return []
  return Array.from({ length: harnessCount }, (_, i) => ({
    id: i + 1,
    label: `踏板 ${i + 1}`,
    harnessIds: [i + 1],
  }))
}

export const useWeaveStore = defineStore('weave', () => {
  const harnessCount = ref(4)
  const warpCount = ref(24)
  const maxFloatLength = ref(6)

  const harnesses = ref<Harness[]>(createHarnesses(4))
  const warpEnds = ref<WarpEnd[]>(createWarpEnds(24, 4))
  const treadles = ref<Treadle[]>(createTreadles(4))

  const threadingMatrix = computed(() => {
    const matrix: (0 | 1)[][] = []
    for (let h = 0; h < harnesses.value.length; h++) {
      const row: (0 | 1)[] = []
      for (let w = 0; w < warpEnds.value.length; w++) {
        row.push(warpEnds.value[w].harnessId === h + 1 ? 1 : 0)
      }
      matrix.push(row)
    }
    return matrix
  })

  const weavePreview = computed(() => {
    const treads = treadles.value
    const warps = warpEnds.value
    if (treads.length === 0 || warps.length === 0) {
      return { matrix: [], floatWarnings: [] }
    }

    const rows = treads.length
    const cols = warps.length
    const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

    for (let t = 0; t < treads.length; t++) {
      const linkedHarnessIds = new Set(treads[t].harnessIds)
      for (let w = 0; w < warps.length; w++) {
        const warpHarnessId = warps[w].harnessId
        if (warpHarnessId !== null && linkedHarnessIds.has(warpHarnessId)) {
          matrix[t][w] = 1
        }
      }
    }

    const floatWarnings = computeFloatWarnings(matrix, maxFloatLength.value)

    return { matrix, floatWarnings }
  })

  const filteredFloatWarnings = computed(() => {
    const { matrix, floatWarnings } = weavePreview.value
    if (matrix.length === 0 || !matrix[0]?.length) return floatWarnings
    const rows = matrix.length
    const cols = matrix[0].length
    return floatWarnings.filter((fw) => {
      const isFullRow =
        fw.type === 'weft' && fw.startWarp === 1 && fw.endWarp === cols
      const isFullCol = fw.type === 'warp' && fw.length === rows
      return !isFullRow && !isFullCol
    })
  })

  const warpFloatWarningSet = computed(() => {
    const set = new Set<number>()
    for (const fw of filteredFloatWarnings.value) {
      for (let w = fw.startWarp; w <= fw.endWarp; w++) {
        set.add(w)
      }
    }
    return set
  })

  const validation = computed<ValidationResult>(() => {
    const errors: string[] = []
    const warnings: string[] = []
    const rawFloatWarnings: FloatWarning[] = weavePreview.value.floatWarnings
    const unthreadedWarps: number[] = []
    const duplicateThreadedWarps: Record<number, number[]> = {}
    const unlinkedHarnesses: number[] = []

    if (harnessCount.value <= 0) {
      errors.push('综框数量必须大于零')
    }
    if (warpCount.value <= 0) {
      errors.push('经线数量必须大于零')
    }

    const harnessIds = new Set(harnesses.value.map((h) => h.id))
    const invalidHarnessWarps: number[] = []
    for (const warp of warpEnds.value) {
      if (warp.harnessId === null) {
        unthreadedWarps.push(warp.id)
      } else if (!harnessIds.has(warp.harnessId)) {
        invalidHarnessWarps.push(warp.id)
      }
    }

    if (unthreadedWarps.length > 0) {
      errors.push(
        `经线 ${unthreadedWarps.join(', ')} 未穿过任何综框`
      )
    }

    if (invalidHarnessWarps.length > 0) {
      errors.push(
        `经线 ${invalidHarnessWarps.join(', ')} 穿过了不存在的综框`
      )
    }

    for (const invalidWarpId of invalidHarnessWarps) {
      const warp = warpEnds.value.find((w) => w.id === invalidWarpId)
      if (warp && warp.harnessId !== null) {
        duplicateThreadedWarps[invalidWarpId] = [warp.harnessId]
      }
    }

    const linkedHarnessIds = new Set<number>()
    for (const tread of treadles.value) {
      tread.harnessIds.forEach((id) => linkedHarnessIds.add(id))
    }
    for (const harness of harnesses.value) {
      if (!linkedHarnessIds.has(harness.id)) {
        unlinkedHarnesses.push(harness.id)
        warnings.push(`综框 ${harness.id} (${harness.label}) 未关联任何踏板`)
      }
    }

    const { matrix } = weavePreview.value
    if (matrix.length > 0 && matrix[0]?.length > 0) {
      const rows = matrix.length
      const cols = matrix[0].length

      let hasValidInterleaving = false
      const noInterleaveRows: number[] = []
      for (let t = 0; t < rows; t++) {
        const rowSum = matrix[t].reduce((s, v) => s + v, 0)
        if (rowSum === 0 || rowSum === cols) {
          noInterleaveRows.push(t + 1)
        }
        if (rowSum > 0 && rowSum < cols) {
          hasValidInterleaving = true
        }
      }

      const warpPatterns = new Set<string>()
      for (let w = 0; w < cols; w++) {
        const pat = matrix.map((r) => r[w]).join('')
        warpPatterns.add(pat)
      }

      if (warpPatterns.size === 1 && rows > 0) {
        errors.push(
          '所有经线的提落模式完全相同，不存在交织，无法形成有效的织物结构。请将经线分配到不同综框。'
        )
      } else if (noInterleaveRows.length > 0) {
        const allRowsBad = noInterleaveRows.length === rows
        if (allRowsBad) {
          errors.push(
            `所有 ${rows} 个踏板步均无交织（经线全提起或全落下），无法形成织物。请调整穿线或踏板关联。`
          )
        } else {
          warnings.push(
            `踏板 ${noInterleaveRows.join(', ')} 步无交织（经线全提起或全落下），可能导致整行浮线过长`
          )
        }
      }

      const fullRowFloats: number[] = []
      const fullColFloats: number[] = []
      const otherWarnings: FloatWarning[] = []
      for (const fw of rawFloatWarnings) {
        if (fw.type === 'weft' && fw.startWarp === 1 && fw.endWarp === cols) {
          fullRowFloats.push(fw.length)
        } else if (fw.type === 'warp' && fw.length === rows) {
          fullColFloats.push(fw.startWarp)
        } else {
          otherWarnings.push(fw)
        }
      }

      if (fullRowFloats.length > 0) {
        warnings.push(
          `存在 ${fullRowFloats.length} 个整行纬向浮线（长度=${cols}），可能由无交织踏板步引起`
        )
      }
      if (fullColFloats.length > 0) {
        warnings.push(
          `经线 ${fullColFloats.join(', ')} 存在整列经向浮线（长度=${rows}）`
        )
      }
      for (const fw of otherWarnings) {
        warnings.push(
          `${fw.type === 'warp' ? '经向' : '纬向'}浮线过长：经线 ${fw.startWarp}-${fw.endWarp}，长度 ${fw.length}`
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      floatWarnings: filteredFloatWarnings.value,
      unthreadedWarps,
      duplicateThreadedWarps,
      unlinkedHarnesses,
    }
  })

  const stats = computed<DesignStats>(() => {
    const warpUsage: Record<number, number> = {}
    for (const harness of harnesses.value) {
      warpUsage[harness.id] = 0
    }
    let threadedCount = 0
    for (const warp of warpEnds.value) {
      if (warp.harnessId !== null && warpUsage[warp.harnessId] !== undefined) {
        warpUsage[warp.harnessId]++
        threadedCount++
      }
    }

    const floatWarnings = filteredFloatWarnings.value
    const maxWarp = floatWarnings
      .filter((f) => f.type === 'warp')
      .reduce((max, f) => Math.max(max, f.length), 0)
    const maxWeft = floatWarnings
      .filter((f) => f.type === 'weft')
      .reduce((max, f) => Math.max(max, f.length), 0)

    const totalFloat = floatWarnings.reduce((sum, f) => sum + f.length, 0)
    const avgFloat = floatWarnings.length > 0 ? totalFloat / floatWarnings.length : 0

    return {
      warpUsage,
      maxWarpFloat: maxWarp,
      maxWeftFloat: maxWeft,
      averageFloatLength: Math.round(avgFloat * 100) / 100,
      errorCount: validation.value.errors.length,
      warningCount: validation.value.warnings.length,
      totalWarps: warpEnds.value.length,
      threadedWarps: threadedCount,
      unthreadedWarps: warpEnds.value.length - threadedCount,
    }
  })

  const currentDesign = computed<WeaveDesign>(() => ({
    harnessCount: harnessCount.value,
    warpCount: warpCount.value,
    maxFloatLength: maxFloatLength.value,
    harnesses: harnesses.value,
    warpEnds: warpEnds.value,
    treadles: treadles.value,
  }))

  const score = computed<WeaveScore>(() => {
    return calculateWeaveScore(
      currentDesign.value,
      validation.value,
      stats.value,
      filteredFloatWarnings.value
    )
  })

  const riskHotspots = computed<RiskHotspot[]>(() => {
    return generateRiskHotspots(
      currentDesign.value,
      validation.value,
      stats.value,
      filteredFloatWarnings.value
    )
  })

  const sortedIssues = computed<SortedIssue[]>(() => {
    return generateSortedIssues(validation.value, score.value)
  })

  const optimizationSuggestions = computed<OptimizationSuggestion[]>(() => {
    return generateOptimizationSuggestions(
      currentDesign.value,
      validation.value,
      stats.value,
      applySuggestionChanges
    )
  })

  const undoStack = ref<HistorySnapshot[]>([])
  const redoStack = ref<HistorySnapshot[]>([])
  const MAX_HISTORY = 50

  function createSnapshot(description: string): HistorySnapshot {
    return {
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      description,
      data: exportDesign(),
      scoreSnapshot: JSON.parse(JSON.stringify(score.value)),
    }
  }

  function saveHistory(description: string) {
    const snapshot = createSnapshot(description)
    undoStack.value.push(snapshot)
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function undo() {
    if (undoStack.value.length === 0) return
    const currentSnapshot = createSnapshot('撤销前')
    redoStack.value.push(currentSnapshot)
    const prev = undoStack.value.pop()!
    restoreFromData(prev.data)
  }

  function redo() {
    if (redoStack.value.length === 0) return
    const currentSnapshot = createSnapshot('重做前')
    undoStack.value.push(currentSnapshot)
    const next = redoStack.value.pop()!
    restoreFromData(next.data)
  }

  function restoreFromData(data: ExportData) {
    harnessCount.value = data.harnessCount
    warpCount.value = data.warpCount
    maxFloatLength.value = data.maxFloatLength
    harnesses.value = data.harnesses.map((h) => ({ ...h }))
    warpEnds.value = data.warpEnds.map((w) => ({ ...w }))
    treadles.value = data.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))
  }

  function applySuggestionChanges(changes: {
    warpEnds?: WarpEnd[]
    treadles?: Treadle[]
    harnessCount?: number
  }) {
    saveHistory('应用优化建议')
    if (changes.warpEnds) {
      warpEnds.value = changes.warpEnds.map((w) => ({ ...w }))
    }
    if (changes.treadles) {
      treadles.value = changes.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))
    }
    if (changes.harnessCount !== undefined) {
      setHarnessCount(changes.harnessCount)
    }
  }

  function applyAllSuggestions() {
    saveHistory('一键应用所有优化建议')
    for (const suggestion of optimizationSuggestions.value) {
      if (suggestion.previewData?.warpEnds) {
        warpEnds.value = suggestion.previewData.warpEnds.map((w) => ({ ...w }))
      }
      if (suggestion.previewData?.treadles) {
        treadles.value = suggestion.previewData.treadles.map((t) => ({
          ...t,
          harnessIds: [...t.harnessIds],
        }))
      }
    }
  }

  function previewSuggestion(suggestion: OptimizationSuggestion): ExportData | null {
    if (!suggestion.previewData) return null
    const base = exportDesign()
    return {
      ...base,
      warpEnds: suggestion.previewData.warpEnds
        ? suggestion.previewData.warpEnds.map((w) => ({ ...w }))
        : base.warpEnds,
      treadles: suggestion.previewData.treadles
        ? suggestion.previewData.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))
        : base.treadles,
    }
  }

  function calculateScoreForData(data: ExportData): WeaveScore {
    const design: WeaveDesign = {
      harnessCount: data.harnessCount,
      warpCount: data.warpCount,
      maxFloatLength: data.maxFloatLength,
      harnesses: data.harnesses,
      warpEnds: data.warpEnds,
      treadles: data.treadles,
    }

    const linkedHarnessIds = new Set<number>()
    for (const tread of data.treadles) {
      tread.harnessIds.forEach((id) => linkedHarnessIds.add(id))
    }
    const unlinkedHarnesses: number[] = []
    for (const harness of data.harnesses) {
      if (!linkedHarnessIds.has(harness.id)) {
        unlinkedHarnesses.push(harness.id)
      }
    }

    const rows = data.treadles.length
    const cols = data.warpEnds.length
    const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
    for (let t = 0; t < data.treadles.length; t++) {
      const linkedH = new Set(data.treadles[t].harnessIds)
      for (let w = 0; w < data.warpEnds.length; w++) {
        const wh = data.warpEnds[w].harnessId
        if (wh !== null && linkedH.has(wh)) {
          matrix[t][w] = 1
        }
      }
    }

    const warpUsage: Record<number, number> = {}
    for (const harness of data.harnesses) {
      warpUsage[harness.id] = 0
    }
    let threadedCount = 0
    const unthreadedWarps: number[] = []
    for (const warp of data.warpEnds) {
      if (warp.harnessId !== null && warpUsage[warp.harnessId] !== undefined) {
        warpUsage[warp.harnessId]++
        threadedCount++
      } else if (warp.harnessId === null) {
        unthreadedWarps.push(warp.id)
      }
    }

    const tempFloatWarnings = computeFloatWarnings(matrix, data.maxFloatLength)
    const maxWarp = tempFloatWarnings
      .filter((f) => f.type === 'warp')
      .reduce((max, f) => Math.max(max, f.length), 0)
    const maxWeft = tempFloatWarnings
      .filter((f) => f.type === 'weft')
      .reduce((max, f) => Math.max(max, f.length), 0)
    const totalFloat = tempFloatWarnings.reduce((sum, f) => sum + f.length, 0)
    const avgFloat = tempFloatWarnings.length > 0 ? totalFloat / tempFloatWarnings.length : 0

    const mockValidation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      floatWarnings: tempFloatWarnings,
      unthreadedWarps,
      duplicateThreadedWarps: {},
      unlinkedHarnesses,
    }

    const mockStats: DesignStats = {
      warpUsage,
      maxWarpFloat: maxWarp,
      maxWeftFloat: maxWeft,
      averageFloatLength: Math.round(avgFloat * 100) / 100,
      errorCount: 0,
      warningCount: 0,
      totalWarps: data.warpEnds.length,
      threadedWarps: threadedCount,
      unthreadedWarps: data.warpEnds.length - threadedCount,
    }

    return calculateWeaveScore(design, mockValidation, mockStats, tempFloatWarnings)
  }

  const focusTarget = ref<{
    type: 'harness' | 'warp' | 'treadle' | null
    id: number | null
  }>({ type: null, id: null })

  function setFocus(type: 'harness' | 'warp' | 'treadle', id: number) {
    focusTarget.value = { type, id }
  }

  function clearFocus() {
    focusTarget.value = { type: null, id: null }
  }

  interface TreadleAnalysis {
    id: number
    label: string
    linkedHarnessCount: number
    linkedHarnessIds: number[]
    raisedWarps: number
    totalWarps: number
    raiseRatio: number
    hasInterleaving: boolean
    floatWarnings: number
    isEmpty: boolean
    isFull: boolean
  }

  const treadleAnalysis = computed<TreadleAnalysis[]>(() => {
    const { matrix, floatWarnings } = weavePreview.value
    return treadles.value.map((tread, tIdx) => {
      const raisedCount = matrix[tIdx]?.reduce((s, v) => s + v, 0) || 0
      const total = warpEnds.value.length
      const hasInterleaving = raisedCount > 0 && raisedCount < total
      const isEmpty = raisedCount === 0
      const isFull = raisedCount === total

      let floatCount = 0
      for (const fw of floatWarnings) {
        if (fw.type === 'weft') {
          const startIdx = fw.startWarp - 1
          const endIdx = fw.endWarp - 1
          const weftFloatMatrix: number[] = []
          for (let w = startIdx; w <= endIdx; w++) {
            weftFloatMatrix.push(matrix[tIdx]?.[w] || 0)
          }
          const allRaised = weftFloatMatrix.every((v) => v === 1)
          const allLowered = weftFloatMatrix.every((v) => v === 0)
          if (allRaised || allLowered) {
            floatCount++
          }
        }
      }

      return {
        id: tread.id,
        label: tread.label,
        linkedHarnessCount: tread.harnessIds.length,
        linkedHarnessIds: [...tread.harnessIds],
        raisedWarps: raisedCount,
        totalWarps: total,
        raiseRatio: total > 0 ? raisedCount / total : 0,
        hasInterleaving,
        floatWarnings: floatCount,
        isEmpty,
        isFull,
      }
    })
  })

  interface DesignChange {
    type: 'warp' | 'treadle' | 'harness'
    id: number
    changeType: 'added' | 'removed' | 'modified'
    description: string
    before?: any
    after?: any
  }

  function compareDesigns(before: ExportData, after: ExportData): DesignChange[] {
    const changes: DesignChange[] = []

    for (const warpAfter of after.warpEnds) {
      const warpBefore = before.warpEnds.find((w) => w.id === warpAfter.id)
      if (!warpBefore) {
        changes.push({
          type: 'warp',
          id: warpAfter.id,
          changeType: 'added',
          description: `新增经线 ${warpAfter.id}`,
          after: { harnessId: warpAfter.harnessId },
        })
      } else if (warpBefore.harnessId !== warpAfter.harnessId) {
        changes.push({
          type: 'warp',
          id: warpAfter.id,
          changeType: 'modified',
          description: `经线 ${warpAfter.id}: 综框 ${warpBefore.harnessId ?? '无'} → ${warpAfter.harnessId ?? '无'}`,
          before: { harnessId: warpBefore.harnessId },
          after: { harnessId: warpAfter.harnessId },
        })
      }
    }

    for (const warpBefore of before.warpEnds) {
      if (!after.warpEnds.find((w) => w.id === warpBefore.id)) {
        changes.push({
          type: 'warp',
          id: warpBefore.id,
          changeType: 'removed',
          description: `删除经线 ${warpBefore.id}`,
          before: { harnessId: warpBefore.harnessId },
        })
      }
    }

    for (const treadAfter of after.treadles) {
      const treadBefore = before.treadles.find((t) => t.id === treadAfter.id)
      if (!treadBefore) {
        changes.push({
          type: 'treadle',
          id: treadAfter.id,
          changeType: 'added',
          description: `新增踏板 ${treadAfter.id}`,
          after: { harnessIds: treadAfter.harnessIds },
        })
      } else {
        const beforeSet = new Set(treadBefore.harnessIds)
        const afterSet = new Set(treadAfter.harnessIds)
        const added = treadAfter.harnessIds.filter((id) => !beforeSet.has(id))
        const removed = treadBefore.harnessIds.filter((id) => !afterSet.has(id))
        if (added.length > 0 || removed.length > 0) {
          let desc = `踏板 ${treadAfter.id}:`
          if (added.length > 0) desc += ` 关联综框 +${added.join(',')}`
          if (removed.length > 0) desc += ` 取消关联 -${removed.join(',')}`
          changes.push({
            type: 'treadle',
            id: treadAfter.id,
            changeType: 'modified',
            description: desc,
            before: { harnessIds: treadBefore.harnessIds },
            after: { harnessIds: treadAfter.harnessIds },
          })
        }
      }
    }

    for (const treadBefore of before.treadles) {
      if (!after.treadles.find((t) => t.id === treadBefore.id)) {
        changes.push({
          type: 'treadle',
          id: treadBefore.id,
          changeType: 'removed',
          description: `删除踏板 ${treadBefore.id}`,
          before: { harnessIds: treadBefore.harnessIds },
        })
      }
    }

    if (before.harnessCount !== after.harnessCount) {
      changes.push({
        type: 'harness',
        id: 0,
        changeType: before.harnessCount < after.harnessCount ? 'added' : 'removed',
        description: `综框数量: ${before.harnessCount} → ${after.harnessCount}`,
        before: { count: before.harnessCount },
        after: { count: after.harnessCount },
      })
    }

    return changes
  }

  function setHarnessCount(count: number) {
    if (count <= 0) return
    harnessCount.value = count
    harnesses.value = createHarnesses(count)
    warpEnds.value = warpEnds.value.map((w) => ({
      ...w,
      harnessId:
        w.harnessId !== null && w.harnessId <= count ? w.harnessId : null,
    }))
    treadles.value = treadles.value.map((t) => ({
      ...t,
      harnessIds: t.harnessIds.filter((id) => id <= count),
    }))
    const coveredIds = new Set(treadles.value.flatMap((t) => t.harnessIds))
    for (let i = 1; i <= count; i++) {
      if (!coveredIds.has(i)) {
        const existing = treadles.value.find((t) => t.id === i)
        if (existing) {
          existing.harnessIds.push(i)
        } else {
          treadles.value.push({
            id: i,
            label: `踏板 ${i}`,
            harnessIds: [i],
          })
        }
      }
    }
  }

  function setWarpCount(count: number) {
    if (count <= 0) return
    const oldWarpEnds = warpEnds.value
    warpCount.value = count
    if (count <= oldWarpEnds.length) {
      warpEnds.value = oldWarpEnds.slice(0, count)
    } else {
      const newWarps: WarpEnd[] = []
      for (let i = oldWarpEnds.length; i < count; i++) {
        newWarps.push({
          id: i + 1,
          harnessId: harnessCount.value > 0 ? (i % harnessCount.value) + 1 : null,
        })
      }
      warpEnds.value = [...oldWarpEnds, ...newWarps]
    }
  }

  function setMaxFloatLength(length: number) {
    maxFloatLength.value = Math.max(1, length)
  }

  function setWarpHarness(warpId: number, harnessId: number | null) {
    const warp = warpEnds.value.find((w) => w.id === warpId)
    if (warp && warp.harnessId !== harnessId) {
      saveHistory(`修改经线 ${warpId} 穿线`)
      warp.harnessId = harnessId
    }
  }

  function toggleTreadleHarness(treadleId: number, harnessId: number) {
    const tread = treadles.value.find((t) => t.id === treadleId)
    if (!tread) return
    saveHistory(`修改踏板 ${treadleId} 关联`)
    const idx = tread.harnessIds.indexOf(harnessId)
    if (idx >= 0) {
      tread.harnessIds.splice(idx, 1)
    } else {
      tread.harnessIds.push(harnessId)
    }
  }

  function addTreadle() {
    saveHistory('添加踏板')
    const maxId = treadles.value.reduce((max, t) => Math.max(max, t.id), 0)
    treadles.value.push({
      id: maxId + 1,
      label: `踏板 ${maxId + 1}`,
      harnessIds: [],
    })
  }

  function removeTreadle(id: number) {
    saveHistory(`删除踏板 ${id}`)
    treadles.value = treadles.value.filter((t) => t.id !== id)
  }

  function exportDesign(): ExportData {
    return {
      version: '1.0.0',
      harnessCount: harnessCount.value,
      warpCount: warpCount.value,
      maxFloatLength: maxFloatLength.value,
      harnesses: [...harnesses.value],
      warpEnds: warpEnds.value.map((w) => ({ ...w })),
      treadles: treadles.value.map((t) => ({ ...t, harnessIds: [...t.harnessIds] })),
    }
  }

  function importDesign(data: ExportData): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.version) errors.push('缺少版本信息')
    if (!data.harnesses || data.harnessCount <= 0) errors.push('综框数量必须大于零')
    if (!data.warpEnds || data.warpCount <= 0) errors.push('经线数量必须大于零')
    if (!data.treadles) {
      errors.push('缺少踏板配置')
    } else if (data.treadles.length === 0) {
      errors.push('踏板数量必须大于零，请至少配置一个踏板')
    } else {
      const totalLinked = data.treadles.reduce((sum, t) => sum + t.harnessIds.length, 0)
      if (totalLinked === 0) {
        errors.push('所有踏板均未关联综框，无法形成织物结构。请至少将一个踏板关联到综框。')
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings }
    }

    const harnessIds = new Set(data.harnesses.map((h) => h.id))
    const unthreadedWarps: number[] = []
    const invalidHarnessWarps: number[] = []
    const duplicateHarnessWarps: number[] = []
    const warpHarnessCount: Record<number, number> = {}

    for (const warp of data.warpEnds) {
      if (warp.harnessId === null) {
        unthreadedWarps.push(warp.id)
      } else if (!harnessIds.has(warp.harnessId)) {
        invalidHarnessWarps.push(warp.id)
      } else {
        warpHarnessCount[warp.id] = (warpHarnessCount[warp.id] || 0) + 1
        if (warpHarnessCount[warp.id] > 1) {
          duplicateHarnessWarps.push(warp.id)
        }
      }
    }

    if (unthreadedWarps.length > 0) {
      errors.push(`经线 ${unthreadedWarps.join(', ')} 未穿过任何综框`)
    }
    if (invalidHarnessWarps.length > 0) {
      errors.push(`经线 ${invalidHarnessWarps.join(', ')} 穿过了不存在的综框`)
    }
    if (duplicateHarnessWarps.length > 0) {
      errors.push(`经线 ${duplicateHarnessWarps.join(', ')} 穿过了多个综框`)
    }

    if (data.harnesses.length !== data.harnessCount) {
      errors.push('综框数量与配置不匹配')
    }
    if (data.warpEnds.length !== data.warpCount) {
      errors.push('经线数量与配置不匹配')
    }

    const linkedHarnessIds = new Set<number>()
    for (const tread of data.treadles) {
      tread.harnessIds.forEach((id) => linkedHarnessIds.add(id))
    }
    const unlinkedHarnesses: number[] = []
    for (const harness of data.harnesses) {
      if (!linkedHarnessIds.has(harness.id)) {
        unlinkedHarnesses.push(harness.id)
      }
    }
    if (unlinkedHarnesses.length > 0) {
      warnings.push(`综框 ${unlinkedHarnesses.join(', ')} 未关联任何踏板`)
    }

    const treads = data.treadles
    const warps = data.warpEnds
    if (treads.length > 0 && warps.length > 0) {
      const rows = treads.length
      const cols = warps.length
      const importMatrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
      for (let t = 0; t < treads.length; t++) {
        const linkedH = new Set(treads[t].harnessIds)
        for (let w = 0; w < warps.length; w++) {
          const wh = warps[w].harnessId
          if (wh !== null && linkedH.has(wh)) {
            importMatrix[t][w] = 1
          }
        }
      }

      const warpPatterns = new Set<string>()
      for (let w = 0; w < cols; w++) {
        const pat = importMatrix.map((r) => r[w]).join('')
        warpPatterns.add(pat)
      }

      if (warpPatterns.size === 1) {
        errors.push(
          '所有经线的提落模式完全相同，不存在交织，无法形成有效的织物结构。请将经线分配到不同综框。'
        )
      } else {
        const noInterleaveRows: number[] = []
        for (let t = 0; t < rows; t++) {
          const rowSum = importMatrix[t].reduce((s, v) => s + v, 0)
          if (rowSum === 0 || rowSum === cols) {
            noInterleaveRows.push(t + 1)
          }
        }
        if (noInterleaveRows.length === rows) {
          errors.push(
            `所有 ${rows} 个踏板步均无交织（经线全提起或全落下），无法形成织物。请调整穿线或踏板关联。`
          )
        } else if (noInterleaveRows.length > 0) {
          warnings.push(
            `踏板 ${noInterleaveRows.join(', ')} 步无交织（经线全提起或全落下），可能导致整行浮线过长`
          )
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings }
    }

    harnessCount.value = data.harnessCount
    warpCount.value = data.warpCount
    maxFloatLength.value = data.maxFloatLength || 6
    harnesses.value = data.harnesses.map((h) => ({ ...h }))
    warpEnds.value = data.warpEnds.map((w) => ({ ...w }))
    treadles.value = data.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))

    return { success: true, errors: [], warnings }
  }

  function resetDesign() {
    harnessCount.value = 4
    warpCount.value = 24
    maxFloatLength.value = 6
    harnesses.value = createHarnesses(4)
    warpEnds.value = createWarpEnds(24, 4)
    treadles.value = createTreadles(4)
  }

  const simulationParams = ref<SimulationParams>({ ...DEFAULT_SIMULATION_PARAMS })
  const candidates = ref<CandidateScheme[]>([])
  const selectedCandidateId = ref<string | null>(null)
  const compareCandidateIds = ref<string[]>([])
  const isSimulating = ref(false)
  const lastSimulationMeta = ref<{
    totalIterations: number
    executionTimeMs: number
    bestCandidateId: string | null
  } | null>(null)
  const playbackState = ref<{
    candidateId: string | null
    currentStepIndex: number
    isPlaying: boolean
  } | null>(null)
  const experimentReports = ref<ExperimentReport[]>([])

  const selectedCandidate = computed<CandidateScheme | null>(() => {
    if (!selectedCandidateId.value) return null
    return candidates.value.find((c) => c.id === selectedCandidateId.value) ?? null
  })

  const compareCandidates = computed<CandidateScheme[]>(() => {
    return candidates.value.filter((c) => compareCandidateIds.value.includes(c.id))
  })

  const bestCandidate = computed<CandidateScheme | null>(() => {
    if (candidates.value.length === 0) return null
    return candidates.value.reduce((best, c) =>
      c.score.totalScore > best.score.totalScore ? c : best
    )
  })

  const playbackStep = computed<SimulationStep | null>(() => {
    if (!playbackState.value?.candidateId) return null
    const candidate = candidates.value.find((c) => c.id === playbackState.value!.candidateId)
    if (!candidate) return null
    const idx = Math.min(playbackState.value.currentStepIndex, candidate.steps.length - 1)
    return candidate.steps[idx] ?? null
  })

  function setSimulationParams(params: Partial<SimulationParams>) {
    simulationParams.value = { ...simulationParams.value, ...params }
  }

  function resetSimulationParams() {
    simulationParams.value = { ...DEFAULT_SIMULATION_PARAMS }
  }

  async function startSimulation() {
    if (isSimulating.value) return
    isSimulating.value = true
    try {
      const baseline = exportDesign()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const result = runSimulation(baseline, simulationParams.value)
      candidates.value = result.candidates
      lastSimulationMeta.value = {
        totalIterations: result.totalIterations,
        executionTimeMs: result.executionTimeMs,
        bestCandidateId: result.bestCandidate?.id ?? null,
      }
      if (result.bestCandidate) {
        selectedCandidateId.value = result.bestCandidate.id
      }
      return result
    } finally {
      isSimulating.value = false
    }
  }

  function clearSimulation() {
    candidates.value = []
    selectedCandidateId.value = null
    compareCandidateIds.value = []
    lastSimulationMeta.value = null
    playbackState.value = null
  }

  function selectCandidate(id: string | null) {
    selectedCandidateId.value = id
  }

  function toggleCandidateCompare(id: string) {
    const idx = compareCandidateIds.value.indexOf(id)
    if (idx >= 0) {
      compareCandidateIds.value.splice(idx, 1)
    } else if (compareCandidateIds.value.length < 4) {
      compareCandidateIds.value.push(id)
    }
  }

  function clearCompareCandidates() {
    compareCandidateIds.value = []
  }

  function toggleLockCandidate(id: string) {
    const candidate = candidates.value.find((c) => c.id === id)
    if (candidate) {
      candidate.isLocked = !candidate.isLocked
    }
  }

  function renameCandidate(id: string, name: string) {
    const candidate = candidates.value.find((c) => c.id === id)
    if (candidate) {
      candidate.name = name
    }
  }

  function applyCandidateToDesign(id: string) {
    const candidate = candidates.value.find((c) => c.id === id)
    if (!candidate) return
    saveHistory(`应用推演方案: ${candidate.name}`)
    const data = cloneDesign(candidate.design)
    harnessCount.value = data.harnessCount
    warpCount.value = data.warpCount
    maxFloatLength.value = data.maxFloatLength
    harnesses.value = data.harnesses.map((h) => ({ ...h }))
    warpEnds.value = data.warpEnds.map((w) => ({ ...w }))
    treadles.value = data.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))
  }

  function startPlayback(candidateId: string) {
    playbackState.value = {
      candidateId,
      currentStepIndex: 0,
      isPlaying: false,
    }
  }

  function stopPlayback() {
    playbackState.value = null
  }

  function setPlaybackStep(index: number) {
    if (!playbackState.value) return
    const candidate = candidates.value.find((c) => c.id === playbackState.value!.candidateId)
    if (!candidate) return
    playbackState.value.currentStepIndex = Math.max(0, Math.min(index, candidate.steps.length - 1))
  }

  function playbackNextStep() {
    if (!playbackState.value) return
    const candidate = candidates.value.find((c) => c.id === playbackState.value!.candidateId)
    if (!candidate) return
    if (playbackState.value.currentStepIndex < candidate.steps.length - 1) {
      playbackState.value.currentStepIndex++
    } else {
      playbackState.value.isPlaying = false
    }
  }

  function playbackPrevStep() {
    if (!playbackState.value) return
    if (playbackState.value.currentStepIndex > 0) {
      playbackState.value.currentStepIndex--
    }
  }

  function togglePlaybackPlaying() {
    if (!playbackState.value) return
    playbackState.value.isPlaying = !playbackState.value.isPlaying
  }

  function getCandidateStructureHeatmap(candidateId: string) {
    const candidate = candidates.value.find((c) => c.id === candidateId)
    if (!candidate) return null
    const baseline = exportDesign()
    return computeStructureHeatmap(baseline, candidate.design)
  }

  function generateCurrentExperimentReport(title?: string, notes?: string): ExperimentReport {
    const baseline = exportDesign()
    const baselineEval = evaluateDesign(baseline)
    return buildExperimentReport(
      title ?? `推演实验 ${new Date().toLocaleString('zh-CN')}`,
      baseline,
      baselineEval.score,
      simulationParams.value,
      candidates.value,
      bestCandidate.value,
      lastSimulationMeta.value?.totalIterations ?? 0,
      lastSimulationMeta.value?.executionTimeMs ?? 0,
      notes
    )
  }

  function saveExperimentReport(report: ExperimentReport) {
    experimentReports.value.push(report)
  }

  function exportReportToFile(report: ExperimentReport, format: 'json' | 'md'): string {
    if (format === 'json') {
      return exportReportAsJSON(report)
    }
    return generateReportMarkdown(report)
  }

  function downloadReport(report: ExperimentReport, format: 'json' | 'md') {
    const content = exportReportToFile(report, format)
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/markdown',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `weave-simulation-report-${report.id.slice(0, 8)}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    harnessCount,
    warpCount,
    maxFloatLength,
    harnesses,
    warpEnds,
    treadles,
    threadingMatrix,
    weavePreview,
    filteredFloatWarnings,
    warpFloatWarningSet,
    validation,
    stats,
    score,
    riskHotspots,
    sortedIssues,
    optimizationSuggestions,
    canUndo,
    canRedo,
    undoStack,
    redoStack,
    focusTarget,
    treadleAnalysis,
    simulationParams,
    candidates,
    selectedCandidateId,
    compareCandidateIds,
    isSimulating,
    lastSimulationMeta,
    playbackState,
    experimentReports,
    selectedCandidate,
    compareCandidates,
    bestCandidate,
    playbackStep,
    setHarnessCount,
    setWarpCount,
    setMaxFloatLength,
    setWarpHarness,
    toggleTreadleHarness,
    addTreadle,
    removeTreadle,
    exportDesign,
    importDesign,
    resetDesign,
    undo,
    redo,
    saveHistory,
    applySuggestionChanges,
    applyAllSuggestions,
    previewSuggestion,
    calculateScoreForData,
    setFocus,
    clearFocus,
    compareDesigns,
    setSimulationParams,
    resetSimulationParams,
    startSimulation,
    clearSimulation,
    selectCandidate,
    toggleCandidateCompare,
    clearCompareCandidates,
    toggleLockCandidate,
    renameCandidate,
    applyCandidateToDesign,
    startPlayback,
    stopPlayback,
    setPlaybackStep,
    playbackNextStep,
    playbackPrevStep,
    togglePlaybackPlaying,
    getCandidateStructureHeatmap,
    generateCurrentExperimentReport,
    saveExperimentReport,
    exportReportToFile,
    downloadReport,
  }
})

function computeFloatWarnings(
  matrix: number[][],
  maxFloat: number
): FloatWarning[] {
  const warnings: FloatWarning[] = []
  if (matrix.length === 0 || matrix[0].length === 0) return warnings

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
      const isRaised = w < cols && matrix[t][w] === 1
      if (isRaised) {
        if (start === -1) start = w
      } else {
        if (start !== -1) {
          const length = w - start
          if (length > maxFloat) {
            warnings.push({
              startWarp: start + 1,
              endWarp: w,
              type: 'weft',
              length,
            })
          }
          start = -1
        }
      }
    }
  }

  for (let w = 0; w < cols; w++) {
    if (fullSameCols.has(w)) continue
    let start = -1
    for (let t = 0; t <= rows; t++) {
      const isRaised = t < rows && matrix[t][w] === 1
      if (isRaised) {
        if (start === -1) start = t
      } else {
        if (start !== -1) {
          const length = t - start
          if (length > maxFloat) {
            warnings.push({
              startWarp: w + 1,
              endWarp: w + 1,
              type: 'warp',
              length,
            })
          }
          start = -1
        }
      }
    }
  }

  return warnings
}
