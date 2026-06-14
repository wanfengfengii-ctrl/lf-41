import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useWeaveStore } from '../src/stores/weave'
import { runSimulation } from '../src/lib/simulation'

function log(title: string, value: unknown) {
  console.log(`\n[${title}]`)
  console.log(JSON.stringify(value, null, 2))
}

setActivePinia(createPinia())
const store = useWeaveStore()
const simSource = readFileSync('src/lib/simulation.ts', 'utf8')
const scoringSource = readFileSync('src/lib/scoring.ts', 'utf8')
const labSource = readFileSync('src/components/LabCenter.vue', 'utf8')

log('harness-utilization-check', {
  hasParamInTypesAndUI: labSource.includes('harnessUtilizationMin'),
  usedInSimulationSource: simSource.includes('harnessUtilizationMin'),
  usedInScoringSource: scoringSource.includes('harnessUtilizationMin'),
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
const lockedCountBefore = store.candidates.filter((c) => c.isLocked).length
store.clearSimulation()
log('locked-clear-check', {
  lockedCountBefore,
  candidatesAfterClear: store.candidates.length,
  lockedStillExists: store.candidates.some((c) => c.isLocked),
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
log('heatmap-drift-check', {
  beforeSummary: heatmapBefore?.diffSummary,
  afterSummary: heatmapAfter?.diffSummary,
  changedAfterEditingCurrentDesign: JSON.stringify(heatmapBefore?.diffSummary) !== JSON.stringify(heatmapAfter?.diffSummary),
})

log('report-format-check', {
  exportJsonExists: simSource.includes('export function exportReportAsJSON'),
  exportMarkdownExists: simSource.includes('export function generateReportMarkdown'),
  markdownHasImageEmbed: simSource.includes('![') || simSource.includes('<img') || simSource.includes('data:image'),
  uiHasOnlyJsonMdButtons: labSource.includes('FileJson') && labSource.includes('FileText') && !labSource.includes('FilePdf'),
})
