import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SimulationParams,
  CandidateScheme,
  SimulationStep,
  ExperimentReport,
} from '@/types/weave'
import { DEFAULT_SIMULATION_PARAMS } from '@/types/weave'
import { useDesignStore } from './design'
import { useScoringStore } from './scoring'
import { useHistoryStore } from './history'
import {
  runSimulation,
  buildExperimentReport,
  cloneDesign,
  computeStructureHeatmap,
  evaluateDesign,
  exportReportAsJSON,
  generateReportMarkdown,
} from '@/lib/simulation'

export const useSimulationStore = defineStore('simulation', () => {
  const designStore = useDesignStore()
  const scoringStore = useScoringStore()
  const historyStore = useHistoryStore()

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
      const baseline = designStore.exportDesign()
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
    historyStore.saveHistory(`应用推演方案: ${candidate.name}`, designStore.exportDesign(), scoringStore.score)
    const data = cloneDesign(candidate.design)
    designStore.restoreFromData(data)
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
    const baseline = designStore.exportDesign()
    return computeStructureHeatmap(baseline, candidate.design)
  }

  function generateCurrentExperimentReport(title?: string, notes?: string): ExperimentReport {
    const baseline = designStore.exportDesign()
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
