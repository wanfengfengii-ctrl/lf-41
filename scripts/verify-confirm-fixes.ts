import { readFileSync } from 'node:fs'

const treadle = readFileSync('src/components/TreadleConfig.vue', 'utf8')
const config = readFileSync('src/components/ConfigPanel.vue', 'utf8')
const imp = readFileSync('src/components/ImportExport.vue', 'utf8')

function has(text: string, marker: string) {
  return text.includes(marker)
}

console.log(JSON.stringify({
  deleteHasConfirmHandler: has(treadle, '@click="handleRemoveTreadle(treadle.id)"') && has(treadle, 'dialog.warning({') && has(treadle, 'onPositiveClick: () => {') && has(treadle, 'store.removeTreadle(treadleId)'),
  resetHasConfirmHandler: has(config, '@click="handleReset"') && has(config, 'dialog.warning({') && has(config, 'onPositiveClick: () => {') && has(config, 'store.resetDesign()'),
  importHasConfirmModal: has(imp, 'showImportConfirm') && has(imp, 'title="确认导入方案"') && has(imp, 'confirmImport()') && has(imp, 'cancelImport()') && has(imp, '导入新方案将覆盖当前设计'),
  importAppliesOnlyOnConfirm: has(imp, 'pendingImportData.value = parsed') && has(imp, 'showImportConfirm.value = true') && has(imp, 'const result = store.importDesign(pendingImportData.value)'),
}, null, 2))
