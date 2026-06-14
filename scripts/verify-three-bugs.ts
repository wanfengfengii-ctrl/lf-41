import { createPinia, setActivePinia } from 'pinia'
import { useWeaveStore } from '../src/stores/weave'

function out(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

store.resetDesign()
const beforeClick = store.warpEnds[0]?.harnessId
store.setWarpHarness(1, beforeClick)
const afterDirectSet = store.warpEnds[0]?.harnessId
const matrixSelected = store.threadingMatrix[0][0]
out('bug1-click-selected-cell', {
  beforeClick,
  afterDirectSet,
  matrixSelected,
  threadingStillSelected: afterDirectSet === beforeClick && matrixSelected === 1,
})

store.resetDesign()
const noTreadles = store.exportDesign()
noTreadles.treadles = []
const importNoTreadles = store.importDesign(noTreadles)
out('bug2-import-no-treadles', importNoTreadles)

store.resetDesign()
store.setHarnessCount(1)
store.treadles = [{ id: 1, label: '踏板 1', harnessIds: [1] }]
store.warpEnds = store.warpEnds.map((w) => ({ ...w, harnessId: 1 }))
store.setMaxFloatLength(6)
out('bug3-all-warps-one-raised-harness', {
  floatWarnings: store.weavePreview.floatWarnings,
  filteredFloatWarnings: store.filteredFloatWarnings,
  validationWarnings: store.validation.warnings,
  validationErrors: store.validation.errors,
  stats: {
    maxWarpFloat: store.stats.maxWarpFloat,
    maxWeftFloat: store.stats.maxWeftFloat,
    warningCount: store.stats.warningCount,
  },
})
