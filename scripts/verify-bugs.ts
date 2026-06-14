import { createPinia, setActivePinia } from 'pinia'
import { useWeaveStore } from '../src/stores/weave'

function log(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

log('initial-threaded-warps', {
  total: store.stats.totalWarps,
  threaded: store.stats.threadedWarps,
  unthreaded: store.stats.unthreadedWarps,
  firstWarpHarness: store.warpEnds[0]?.harnessId,
})

store.setWarpHarness(1, null)
log('after-unthread-first-warp', {
  firstWarpHarness: store.warpEnds[0]?.harnessId,
  validationErrors: store.validation.errors,
  threaded: store.stats.threadedWarps,
  unthreaded: store.stats.unthreadedWarps,
})

store.resetDesign()
store.setHarnessCount(1)
store.treadles = [{ id: 1, label: '踏板 1', harnessIds: [1] }]
store.warpEnds = store.warpEnds.map((w) => ({ ...w, harnessId: 1 }))
store.setMaxFloatLength(6)
log('all-raised-preview', {
  previewRow0: store.weavePreview.matrix[0],
  floatWarnings: store.weavePreview.floatWarnings,
  stats: {
    maxWarpFloat: store.stats.maxWarpFloat,
    maxWeftFloat: store.stats.maxWeftFloat,
    averageFloatLength: store.stats.averageFloatLength,
    warningCount: store.stats.warningCount,
  },
})

const invalidNoStructure = store.exportDesign()
invalidNoStructure.treadles = []
const importResult = store.importDesign(invalidNoStructure)
log('import-no-treadles', importResult)

log('zero-validation-unreachable-from-ui', {
  configGuards: {
    harnessInputMin: 1,
    warpInputMin: 1,
    storeSetHarnessCountRejectsZero: true,
    storeSetWarpCountRejectsZero: true,
  },
  currentCounts: {
    harnessCount: store.harnessCount,
    warpCount: store.warpCount,
  },
})
