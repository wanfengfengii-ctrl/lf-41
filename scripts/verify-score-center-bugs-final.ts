import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useWeaveStore } from '../src/stores/weave'

function log(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

const homePage = readFileSync('src/pages/HomePage.vue', 'utf8')
const scoreCenter = readFileSync('src/components/ScoreCenter.vue', 'utf8')
const types = readFileSync('src/types/weave.ts', 'utf8')
const weaveStore = readFileSync('src/stores/weave.ts', 'utf8')

log('issue-location-no-jump', {
  hasLocationText: scoreCenter.includes('定位:'),
  hasIssueLocationBlock: scoreCenter.includes('class="issue-location"'),
  hasScrollIntoView: scoreCenter.includes('scrollIntoView'),
  hasLocateHandler: /issue-location[\s\S]*@click/.test(scoreCenter),
  hasFocusMethod: scoreCenter.includes('focus(') || scoreCenter.includes('highlight'),
})

log('no-treadling-model-or-editor', {
  hasTreadlingType: types.includes('TreadlingStep') || types.includes('treadling'),
  homeHasTreadlingEditor: homePage.includes('Treadling') || homePage.includes('踏序'),
  scoreCenterHasTreadlingStepLocation: scoreCenter.includes('踏序步'),
})

log('compare-only-score-no-structural-diff', {
  hasCompareModal: scoreCenter.includes('优化前后对比'),
  hasScoreFields: scoreCenter.includes('综合评分') && scoreCenter.includes('可织性') && scoreCenter.includes('复杂度') && scoreCenter.includes('稳定性') && scoreCenter.includes('材料适配'),
  hasThreadingMatrixInCompare: scoreCenter.includes('穿线矩阵'),
  hasPreviewMatrixDiff: scoreCenter.includes('差异高亮') || scoreCenter.includes('结构差异') || scoreCenter.includes('变更位置'),
})

log('apply-all-misses-harness-count', {
  applyAllHandlesHarnessCount: weaveStore.includes('suggestion.previewData?.harnessCount'),
  singleApplyHandlesHarnessCount: weaveStore.includes('if (changes.harnessCount !== undefined)'),
})

store.resetDesign()
const exported = store.exportDesign()
log('export-version-still-1-0-0', {
  version: exported.version,
})
