import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useWeaveStore } from '../src/stores/weave'

function log(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

const scoreCenter = readFileSync('src/components/ScoreCenter.vue', 'utf8')
log('location-interaction-check', {
  hasLocationText: scoreCenter.includes('定位:'),
  hasScrollIntoView: scoreCenter.includes('scrollIntoView'),
  hasLocationClickHandler: scoreCenter.includes('@click') && scoreCenter.includes('issue.location'),
  hasFocusOrHighlightMethod: scoreCenter.includes('highlight') || scoreCenter.includes('focus'),
})

store.resetDesign()
store.treadles = [
  { id: 1, label: '踏板 1', harnessIds: [1] },
  { id: 2, label: '踏板 2', harnessIds: [2] },
  { id: 3, label: '踏板 3', harnessIds: [] },
  { id: 4, label: '踏板 4', harnessIds: [] },
]
const suggestion = store.optimizationSuggestions.find((s) => s.title.includes('配置空踏板关联'))
if (suggestion) {
  const preview = store.previewSuggestion(suggestion)
  const previewScore = preview ? store.calculateScoreForData(preview) : null
  suggestion.applyFn()
  const appliedScore = JSON.parse(JSON.stringify(store.score))
  log('preview-vs-applied-score', {
    suggestion: suggestion.title,
    previewScore,
    appliedScore,
    sameTotalScore: previewScore?.totalScore === appliedScore.totalScore,
    sameBreakdown: JSON.stringify(previewScore?.breakdown) === JSON.stringify(appliedScore.breakdown),
  })
} else {
  log('preview-vs-applied-score', { suggestionFound: false })
}

const weaveStoreSource = readFileSync('src/stores/weave.ts', 'utf8')
log('apply-all-harness-count-check', {
  applyAllHandlesHarnessCount: weaveStoreSource.includes('suggestion.previewData?.harnessCount'),
  singleApplyHandlesHarnessCount: weaveStoreSource.includes('if (changes.harnessCount !== undefined)')
})
