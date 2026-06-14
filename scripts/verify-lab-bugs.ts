import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useWeaveStore } from '../src/stores/weave'
import { runSimulation, buildExperimentReport, generateReportMarkdown } from '../src/lib/simulation'

function log(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()

const labCenter = readFileSync('src/components/LabCenter.vue', 'utf8')
const simSource = readFileSync('src/lib/simulation.ts', 'utf8')
const storeSource = readFileSync('src/stores/weave.ts', 'utf8')

log('harness-utilization-param-usage', {
  hasParamType: simSource.includes('harnessUtilizationMin'),
  mutationUsesIt: /harnessUtilizationMin[\s\S]{0,120}(>|<|===|!==|\*|\+|-|\/|Math\.)/.test(simSource),
  scoringUsesIt: false,
})

const baseline = store.exportDesign()
const result = runSimulation(baseline, {
  targetScore: 85,
  maxFloatLimit: 6,
  harnessUtilizationMin: 0.7,
  materialType: 'cotton',
  candidateCount: 2,
  maxIterations: 3,
  mutationRate: 0.3,
})
store.candidates = result.candidates
store.toggleLockCandidate(result.candidates[0].id)
const lockedBeforeClear = store.candidates.filter((c) => c.isLocked).length
store.clearSimulation()
log('locked-candidate-cleared', {
  lockedBeforeClear,
  candidatesAfterClear: store.candidates.length,
  lockedCandidatesPreserved: store.candidates.some((c) => c.isLocked),
})

const result2 = runSimulation(store.exportDesign(), {
  targetScore: 85,
  maxFloatLimit: 6,
  harnessUtilizationMin: 0.7,
  materialType: 'cotton',
  candidateCount: 1,
  maxIterations: 3,
  mutationRate: 0.3,
})
store.candidates = result2.candidates
const candidateId = result2.candidates[0].id
const heatmapBefore = store.getCandidateStructureHeatmap(candidateId)
store.setWarpHarness(1, store.warpEnds[0]?.harnessId === 1 ? 2 : 1)
const heatmapAfter = store.getCandidateStructureHeatmap(candidateId)
log('heatmap-baseline-drift', {
  beforeSummary: heatmapBefore?.diffSummary,
  afterSummary: heatmapAfter?.diffSummary,
  changedAfterEditingCurrentDesign: JSON.stringify(heatmapBefore?.diffSummary) !== JSON.stringify(heatmapAfter?.diffSummary),
})

const report = buildExperimentReport({
  params: {
    targetScore: 85,
    maxFloatLimit: 6,
    harnessUtilizationMin: 0.7,
    materialType: 'cotton',
    candidateCount: 1,
    maxIterations: 3,
    mutationRate: 0.3,
  },
  baselineDesign: store.exportDesign(),
  baselineScore: store.score,
  candidates: result2.candidates,
  bestCandidateId: result2.bestCandidate?.id ?? null,
  totalIterations: result2.totalIterations,
  executionTimeMs: result2.executionTimeMs,
  notes: 'test',
})
const markdown = generateReportMarkdown(report)
log('report-format-check', {
  markdownHasTable: markdown.includes('| 候选方案 |') || markdown.includes('| 方案 |'),
  markdownHasImage: markdown.includes('!['),
  markdownHasChartEmbed: markdown.includes('<img') || markdown.includes('data:image'),
  reportExportButtons: labCenter.includes('Markdown') || labCenter.includes('JSON'),
})
