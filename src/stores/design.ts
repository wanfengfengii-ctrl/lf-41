import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Harness, WarpEnd, Treadle, ExportData } from '@/types/weave'
import { computeThreadingMatrix, computeWeaveMatrix, computeFloatWarnings } from '@/lib/matrix'
import { validateDesign, computeStats, validateImportData } from '@/lib/validation'

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

export const useDesignStore = defineStore('design', () => {
  const harnessCount = ref(4)
  const warpCount = ref(24)
  const maxFloatLength = ref(6)

  const harnesses = ref<Harness[]>(createHarnesses(4))
  const warpEnds = ref<WarpEnd[]>(createWarpEnds(24, 4))
  const treadles = ref<Treadle[]>(createTreadles(4))

  const focusTarget = ref<{
    type: 'harness' | 'warp' | 'treadle' | null
    id: number | null
  }>({ type: null, id: null })

  const threadingMatrix = computed(() => {
    return computeThreadingMatrix(harnesses.value, warpEnds.value)
  })

  const weavePreview = computed(() => {
    const matrix = computeWeaveMatrix(treadles.value, warpEnds.value)
    if (matrix.length === 0) {
      return { matrix: [], floatWarnings: [] }
    }
    const floatWarnings = computeFloatWarnings(matrix, maxFloatLength.value)
    return { matrix, floatWarnings }
  })

  const currentDesign = computed(() => ({
    harnessCount: harnessCount.value,
    warpCount: warpCount.value,
    maxFloatLength: maxFloatLength.value,
    harnesses: harnesses.value,
    warpEnds: warpEnds.value,
    treadles: treadles.value,
  }))

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
    const { errors, warnings } = validateImportData(data)

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

  function restoreFromData(data: ExportData) {
    harnessCount.value = data.harnessCount
    warpCount.value = data.warpCount
    maxFloatLength.value = data.maxFloatLength
    harnesses.value = data.harnesses.map((h) => ({ ...h }))
    warpEnds.value = data.warpEnds.map((w) => ({ ...w }))
    treadles.value = data.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))
  }

  function resetDesign() {
    harnessCount.value = 4
    warpCount.value = 24
    maxFloatLength.value = 6
    harnesses.value = createHarnesses(4)
    warpEnds.value = createWarpEnds(24, 4)
    treadles.value = createTreadles(4)
  }

  function setFocus(type: 'harness' | 'warp' | 'treadle', id: number) {
    focusTarget.value = { type, id }
  }

  function clearFocus() {
    focusTarget.value = { type: null, id: null }
  }

  return {
    harnessCount,
    warpCount,
    maxFloatLength,
    harnesses,
    warpEnds,
    treadles,
    focusTarget,
    threadingMatrix,
    weavePreview,
    currentDesign,
    setHarnessCount,
    setWarpCount,
    setMaxFloatLength,
    setWarpHarness,
    toggleTreadleHarness,
    addTreadle,
    removeTreadle,
    exportDesign,
    importDesign,
    restoreFromData,
    resetDesign,
    setFocus,
    clearFocus,
  }
})
