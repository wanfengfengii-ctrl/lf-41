import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { TreadleAnalysis } from '@/types/weave'
import { useDesignStore } from './design'
import { validateDesign, computeStats } from '@/lib/validation'
import { filterFloatWarnings, computeWarpFloatWarningSet } from '@/lib/matrix'

export const useValidationStore = defineStore('validation', () => {
  const designStore = useDesignStore()

  const validation = computed(() => {
    return validateDesign(
      designStore.harnessCount,
      designStore.warpCount,
      designStore.harnesses,
      designStore.warpEnds,
      designStore.treadles,
      designStore.maxFloatLength
    )
  })

  const filteredFloatWarnings = computed(() => {
    const { matrix, floatWarnings } = designStore.weavePreview
    return filterFloatWarnings(floatWarnings, matrix)
  })

  const warpFloatWarningSet = computed(() => {
    return computeWarpFloatWarningSet(filteredFloatWarnings.value)
  })

  const stats = computed(() => {
    return computeStats(
      designStore.harnesses,
      designStore.warpEnds,
      filteredFloatWarnings.value,
      validation.value
    )
  })

  const treadleAnalysis = computed<TreadleAnalysis[]>(() => {
    const { matrix, floatWarnings } = designStore.weavePreview
    return designStore.treadles.map((tread, tIdx) => {
      const raisedCount = matrix[tIdx]?.reduce((s, v) => s + v, 0) || 0
      const total = designStore.warpEnds.length
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

  return {
    validation,
    filteredFloatWarnings,
    warpFloatWarningSet,
    stats,
    treadleAnalysis,
  }
})
