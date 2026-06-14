import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { WeaveScore, RiskHotspot, SortedIssue, OptimizationSuggestion, WarpEnd, Treadle, ExportData } from '@/types/weave'
import { useDesignStore } from './design'
import { useValidationStore } from './validation'
import { useHistoryStore } from './history'
import { calculateWeaveScore, generateRiskHotspots, generateSortedIssues, generateOptimizationSuggestions } from '@/lib/scoring'
import { evaluateDesign } from '@/lib/simulation'

export const useScoringStore = defineStore('scoring', () => {
  const designStore = useDesignStore()
  const validationStore = useValidationStore()
  const historyStore = useHistoryStore()

  const score = computed<WeaveScore>(() => {
    return calculateWeaveScore(
      designStore.currentDesign,
      validationStore.validation,
      validationStore.stats,
      validationStore.filteredFloatWarnings
    )
  })

  const riskHotspots = computed<RiskHotspot[]>(() => {
    return generateRiskHotspots(
      designStore.currentDesign,
      validationStore.validation,
      validationStore.stats,
      validationStore.filteredFloatWarnings
    )
  })

  const sortedIssues = computed<SortedIssue[]>(() => {
    return generateSortedIssues(validationStore.validation, score.value)
  })

  const optimizationSuggestions = computed<OptimizationSuggestion[]>(() => {
    return generateOptimizationSuggestions(
      designStore.currentDesign,
      validationStore.validation,
      validationStore.stats,
      applySuggestionChanges
    )
  })

  function applySuggestionChanges(changes: {
    warpEnds?: WarpEnd[]
    treadles?: Treadle[]
    harnessCount?: number
  }) {
    historyStore.saveHistory('应用优化建议', designStore.exportDesign(), score.value)
    if (changes.warpEnds) {
      designStore.warpEnds = changes.warpEnds.map((w) => ({ ...w }))
    }
    if (changes.treadles) {
      designStore.treadles = changes.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] }))
    }
    if (changes.harnessCount !== undefined) {
      designStore.setHarnessCount(changes.harnessCount)
    }
  }

  function applyAllSuggestions() {
    historyStore.saveHistory('一键应用所有优化建议', designStore.exportDesign(), score.value)
    for (const suggestion of optimizationSuggestions.value) {
      if (suggestion.previewData?.warpEnds) {
        designStore.warpEnds = suggestion.previewData.warpEnds.map((w) => ({ ...w }))
      }
      if (suggestion.previewData?.treadles) {
        designStore.treadles = suggestion.previewData.treadles.map((t) => ({
          ...t,
          harnessIds: [...t.harnessIds],
        }))
      }
    }
  }

  function previewSuggestion(suggestion: OptimizationSuggestion): ExportData | null {
    if (!suggestion.previewData) return null
    const base = designStore.exportDesign()
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
    return evaluateDesign(data).score
  }

  return {
    score,
    riskHotspots,
    sortedIssues,
    optimizationSuggestions,
    applySuggestionChanges,
    applyAllSuggestions,
    previewSuggestion,
    calculateScoreForData,
  }
})
