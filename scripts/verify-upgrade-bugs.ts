import { createPinia, setActivePinia } from 'pinia'
import { useWeaveStore } from '../src/stores/weave'

function print(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

print('missing-upgrade-features', {
  hasWeftCount: 'weftCount' in store,
  hasTreadlingSteps: 'treadlingSteps' in store,
  hasColorConfig: 'colorConfig' in store,
  hasUndo: 'undo' in store,
  hasRedo: 'redo' in store,
  hasSavedSchemes: 'savedSchemes' in store,
  hasCompareState: 'compareSchemeId' in store,
})

store.resetDesign()
const beforeDelete = store.treadles.map((t) => t.id)
store.removeTreadle(store.treadles[0].id)
print('delete-treadle-immediate', {
  beforeDelete,
  afterDelete: store.treadles.map((t) => t.id),
  deletedImmediately: store.treadles.length === beforeDelete.length - 1,
})

store.resetDesign()
store.setWarpHarness(1, 2)
const beforeReset = store.warpEnds[0]?.harnessId
store.resetDesign()
print('reset-immediate', {
  beforeReset,
  afterReset: store.warpEnds[0]?.harnessId,
  resetAppliedImmediately: store.warpEnds[0]?.harnessId === 1,
})

store.resetDesign()
const currentBeforeImport = JSON.stringify(store.exportDesign())
const imported = {
  version: '1.0.0',
  harnessCount: 2,
  warpCount: 2,
  maxFloatLength: 6,
  harnesses: [
    { id: 1, label: '综框 1' },
    { id: 2, label: '综框 2' },
  ],
  warpEnds: [
    { id: 1, harnessId: 1 },
    { id: 2, harnessId: 2 },
  ],
  treadles: [
    { id: 1, label: '踏板 1', harnessIds: [1] },
    { id: 2, label: '踏板 2', harnessIds: [2] },
  ],
}
const importResult = store.importDesign(imported)
print('import-overwrites-directly', {
  importResult,
  beforeImport: JSON.parse(currentBeforeImport),
  afterImport: store.exportDesign(),
  overwrittenImmediately: store.harnessCount === 2 && store.warpCount === 2,
})

print('export-version-fixed', {
  exportedVersion: store.exportDesign().version,
})
