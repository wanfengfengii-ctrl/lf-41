import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HistorySnapshot, ExportData, WeaveScore } from '@/types/weave'
import { useDesignStore } from './design'

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<HistorySnapshot[]>([])
  const redoStack = ref<HistorySnapshot[]>([])
  const MAX_HISTORY = 50

  function createSnapshot(description: string, exportData: ExportData, scoreSnapshot: WeaveScore): HistorySnapshot {
    return {
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      description,
      data: exportData,
      scoreSnapshot: JSON.parse(JSON.stringify(scoreSnapshot)),
    }
  }

  function saveHistory(description: string, exportData: ExportData, scoreSnapshot: WeaveScore) {
    const snapshot = createSnapshot(description, exportData, scoreSnapshot)
    undoStack.value.push(snapshot)
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function undo(currentExportData: ExportData, currentScore: WeaveScore) {
    if (undoStack.value.length === 0) return
    const currentSnapshot = createSnapshot('撤销前', currentExportData, currentScore)
    redoStack.value.push(currentSnapshot)
    const prev = undoStack.value.pop()!
    return prev
  }

  function redo(currentExportData: ExportData, currentScore: WeaveScore) {
    if (redoStack.value.length === 0) return
    const currentSnapshot = createSnapshot('重做前', currentExportData, currentScore)
    undoStack.value.push(currentSnapshot)
    const next = redoStack.value.pop()!
    return next
  }

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    saveHistory,
    undo,
    redo,
  }
})
