import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useDesignStore } from './design'
import { useHistoryStore } from './history'
import { useValidationStore } from './validation'
import { useScoringStore } from './scoring'
import { useSimulationStore } from './simulation'
import type { ExportData, DesignChange } from '@/types/weave'
import { compareDesigns } from '@/lib/comparison'

export const useWeaveStore = defineStore('weave', () => {
  const design = useDesignStore()
  const history = useHistoryStore()
  const validation = useValidationStore()
  const scoring = useScoringStore()
  const simulation = useSimulationStore()

  const harnessCount = computed(() => design.harnessCount)
  const warpCount = computed(() => design.warpCount)
  const maxFloatLength = computed(() => design.maxFloatLength)
  const harnesses = computed(() => design.harnesses)
  const warpEnds = computed(() => design.warpEnds)
  const treadles = computed(() => design.treadles)
  const threadingMatrix = computed(() => design.threadingMatrix)
  const weavePreview = computed(() => design.weavePreview)
  const filteredFloatWarnings = computed(() => validation.filteredFloatWarnings)
  const warpFloatWarningSet = computed(() => validation.warpFloatWarningSet)
  const focusTarget = computed(() => design.focusTarget)
  const currentDesign = computed(() => design.currentDesign)

  function saveHistory(description: string) {
    history.saveHistory(description, design.exportDesign(), scoring.score)
  }

  function setWarpHarness(warpId: number, harnessId: number | null) {
    const warp = design.warpEnds.find((w) => w.id === warpId)
    if (warp && warp.harnessId !== harnessId) {
      saveHistory(`修改经线 ${warpId} 穿线`)
      design.setWarpHarness(warpId, harnessId)
    }
  }

  function toggleTreadleHarness(treadleId: number, harnessId: number) {
    const tread = design.treadles.find((t) => t.id === treadleId)
    if (!tread) return
    saveHistory(`修改踏板 ${treadleId} 关联`)
    design.toggleTreadleHarness(treadleId, harnessId)
  }

  function addTreadle() {
    saveHistory('添加踏板')
    design.addTreadle()
  }

  function removeTreadle(id: number) {
    saveHistory(`删除踏板 ${id}`)
    design.removeTreadle(id)
  }

  function undo() {
    const snapshot = history.undo(design.exportDesign(), scoring.score)
    if (snapshot) {
      design.restoreFromData(snapshot.data)
    }
  }

  function redo() {
    const snapshot = history.redo(design.exportDesign(), scoring.score)
    if (snapshot) {
      design.restoreFromData(snapshot.data)
    }
  }

  function resetDesign() {
    design.resetDesign()
  }

  function compareDesignsFacade(before: ExportData, after: ExportData): DesignChange[] {
    return compareDesigns(before, after)
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
    validation: computed(() => validation.validation),
    stats: computed(() => validation.stats),
    score: computed(() => scoring.score),
    riskHotspots: computed(() => scoring.riskHotspots),
    sortedIssues: computed(() => scoring.sortedIssues),
    optimizationSuggestions: computed(() => scoring.optimizationSuggestions),
    canUndo: computed(() => history.canUndo),
    canRedo: computed(() => history.canRedo),
    undoStack: computed(() => history.undoStack),
    redoStack: computed(() => history.redoStack),
    focusTarget,
    treadleAnalysis: computed(() => validation.treadleAnalysis),
    simulationParams: computed(() => simulation.simulationParams),
    candidates: computed(() => simulation.candidates),
    selectedCandidateId: computed(() => simulation.selectedCandidateId),
    compareCandidateIds: computed(() => simulation.compareCandidateIds),
    isSimulating: computed(() => simulation.isSimulating),
    lastSimulationMeta: computed(() => simulation.lastSimulationMeta),
    playbackState: computed(() => simulation.playbackState),
    experimentReports: computed(() => simulation.experimentReports),
    selectedCandidate: computed(() => simulation.selectedCandidate),
    compareCandidates: computed(() => simulation.compareCandidates),
    bestCandidate: computed(() => simulation.bestCandidate),
    playbackStep: computed(() => simulation.playbackStep),
    setHarnessCount: design.setHarnessCount,
    setWarpCount: design.setWarpCount,
    setMaxFloatLength: design.setMaxFloatLength,
    setWarpHarness,
    toggleTreadleHarness,
    addTreadle,
    removeTreadle,
    exportDesign: design.exportDesign,
    importDesign: design.importDesign,
    resetDesign,
    undo,
    redo,
    saveHistory,
    applySuggestionChanges: scoring.applySuggestionChanges,
    applyAllSuggestions: scoring.applyAllSuggestions,
    previewSuggestion: scoring.previewSuggestion,
    calculateScoreForData: scoring.calculateScoreForData,
    setFocus: design.setFocus,
    clearFocus: design.clearFocus,
    compareDesigns: compareDesignsFacade,
    setSimulationParams: simulation.setSimulationParams,
    resetSimulationParams: simulation.resetSimulationParams,
    startSimulation: simulation.startSimulation,
    clearSimulation: simulation.clearSimulation,
    selectCandidate: simulation.selectCandidate,
    toggleCandidateCompare: simulation.toggleCandidateCompare,
    clearCompareCandidates: simulation.clearCompareCandidates,
    toggleLockCandidate: simulation.toggleLockCandidate,
    renameCandidate: simulation.renameCandidate,
    applyCandidateToDesign: simulation.applyCandidateToDesign,
    startPlayback: simulation.startPlayback,
    stopPlayback: simulation.stopPlayback,
    setPlaybackStep: simulation.setPlaybackStep,
    playbackNextStep: simulation.playbackNextStep,
    playbackPrevStep: simulation.playbackPrevStep,
    togglePlaybackPlaying: simulation.togglePlaybackPlaying,
    getCandidateStructureHeatmap: simulation.getCandidateStructureHeatmap,
    generateCurrentExperimentReport: simulation.generateCurrentExperimentReport,
    saveExperimentReport: simulation.saveExperimentReport,
    exportReportToFile: simulation.exportReportToFile,
    downloadReport: simulation.downloadReport,
  }
})
