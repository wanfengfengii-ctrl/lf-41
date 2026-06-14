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
} from '@/types/weave'

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

  const warpFloatWarningSet = computed(() => {
    const set = new Set<number>()
    for (const fw of weavePreview.value.floatWarnings) {
      for (let w = fw.startWarp; w <= fw.endWarp; w++) {
        set.add(w)
      }
    }
    return set
  })

  const validation = computed<ValidationResult>(() => {
    const errors: string[] = []
    const warnings: string[] = []
    const floatWarnings: FloatWarning[] = weavePreview.value.floatWarnings
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

    if (floatWarnings.length > 0) {
      for (const fw of floatWarnings) {
        warnings.push(
          `${fw.type === 'warp' ? '经向' : '纬向'}浮线过长：经线 ${fw.startWarp}-${fw.endWarp}，长度 ${fw.length}`
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      floatWarnings,
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

    const floatWarnings = weavePreview.value.floatWarnings
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
    if (warp) {
      warp.harnessId = harnessId
    }
  }

  function toggleTreadleHarness(treadleId: number, harnessId: number) {
    const tread = treadles.value.find((t) => t.id === treadleId)
    if (!tread) return
    const idx = tread.harnessIds.indexOf(harnessId)
    if (idx >= 0) {
      tread.harnessIds.splice(idx, 1)
    } else {
      tread.harnessIds.push(harnessId)
    }
  }

  function addTreadle() {
    const maxId = treadles.value.reduce((max, t) => Math.max(max, t.id), 0)
    treadles.value.push({
      id: maxId + 1,
      label: `踏板 ${maxId + 1}`,
      harnessIds: [],
    })
  }

  function removeTreadle(id: number) {
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
    if (!data.treadles) errors.push('缺少踏板配置')

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
    warpFloatWarningSet,
    validation,
    stats,
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

  for (let t = 0; t < rows; t++) {
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
