import { createPinia, setActivePinia } from 'pinia'
import { useWeaveStore } from '../src/stores/weave'

function section(title: string, data: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(data, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

section('feature-state-shape', {
  hasWeftCount: 'weftCount' in store,
  hasColorConfig: 'colorConfig' in store,
  hasTreadlingSteps: 'treadlingSteps' in store,
  hasUndo: 'undo' in store,
  hasRedo: 'redo' in store,
  hasSchemes: 'savedSchemes' in store,
  hasDiff: 'diffResult' in store,
})

section('route-shape', {
  onlyHomeRouteExpectedFromCodeReview: true,
})

store.resetDesign()
const firstHarnessBefore = store.warpEnds[0]?.harnessId
store.setWarpHarness(1, firstHarnessBefore)
const firstHarnessAfterSameClick = store.warpEnds[0]?.harnessId
section('matrix-click-behavior', {
  firstHarnessBefore,
  firstHarnessAfterSameClick,
  unchangedWhenClickSameCell: firstHarnessBefore === firstHarnessAfterSameClick,
})

store.resetDesign()
const treadleCountBeforeDelete = store.treadles.length
store.removeTreadle(store.treadles[0].id)
section('delete-treadle-directly', {
  before: treadleCountBeforeDelete,
  after: store.treadles.length,
  deletedImmediately: store.treadles.length === treadleCountBeforeDelete - 1,
})

store.resetDesign()
store.setWarpHarness(1, 2)
const changedBeforeReset = store.warpEnds[0]?.harnessId
store.resetDesign()
section('reset-design-directly', {
  changedBeforeReset,
  afterReset: store.warpEnds[0]?.harnessId,
  resetAppliedImmediately: store.warpEnds[0]?.harnessId === 1,
})

store.resetDesign()
const exported = store.exportDesign()
section('export-version', exported)
