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
} from '@/types/weave'
import {
  calculateWeaveScore,
  generateRiskHotspots,
  generateSortedIssues,
  generateOptimizationSuggestions,
} from '@/lib/scoring'

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
