export interface Harness {
  id: number
  label: string
}

export interface WarpEnd {
  id: number
  harnessId: number | null
}

export interface Treadle {
  id: number
  label: string
  harnessIds: number[]
}

export interface WeaveDesign {
  harnessCount: number
  warpCount: number
  maxFloatLength: number
  harnesses: Harness[]
  warpEnds: WarpEnd[]
  treadles: Treadle[]
}

export interface FloatWarning {
  startWarp: number
  endWarp: number
  type: 'warp' | 'weft'
  length: number
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  floatWarnings: FloatWarning[]
  unthreadedWarps: number[]
  duplicateThreadedWarps: Record<number, number[]>
  unlinkedHarnesses: number[]
}

export interface DesignStats {
  warpUsage: Record<number, number>
  maxWarpFloat: number
  maxWeftFloat: number
  averageFloatLength: number
  errorCount: number
  warningCount: number
  totalWarps: number
  threadedWarps: number
  unthreadedWarps: number
}

export interface ExportData {
  version: string
  harnessCount: number
  warpCount: number
  maxFloatLength: number
  harnesses: Harness[]
  warpEnds: WarpEnd[]
  treadles: Treadle[]
}

export interface DeductionItem {
  id: string
  category: 'weavability' | 'complexity' | 'stability' | 'materialFit'
  severity: 'critical' | 'high' | 'medium' | 'low'
  points: number
  description: string
  location?: {
    type: 'harness' | 'warp' | 'treadle' | 'range'
    ids?: number[]
    startId?: number
    endId?: number
  }
}

export interface ScoreBreakdown {
  weavability: number
  complexity: number
  stability: number
  materialFit: number
}

export interface WeaveScore {
  totalScore: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: ScoreBreakdown
  deductions: DeductionItem[]
  maxFloatPenalty: number
  harnessBalancePenalty: number
  errorPenalty: number
  warningPenalty: number
}

export interface RiskHotspot {
  id: string
  type: 'harness' | 'warp' | 'treadle'
  targetId: number
  riskLevel: number
  description: string
}

export type SuggestionImpact = 'minor' | 'moderate' | 'significant'

export interface OptimizationSuggestion {
  id: string
  title: string
  description: string
  impact: SuggestionImpact
  expectedScoreGain: number
  affectedAreas: {
    harnesses?: number[]
    warps?: number[]
    treadles?: number[]
  }
  adjustmentDirection: string
  applyFn: () => void
  previewData?: {
    warpEnds?: WarpEnd[]
    treadles?: Treadle[]
    harnessCount?: number
  }
}

export interface SortedIssue {
  id: string
  type: 'error' | 'warning' | 'risk'
  priority: number
  title: string
  description: string
  location?: {
    type: 'harness' | 'warp' | 'treadle' | 'range'
    ids?: number[]
    startId?: number
    endId?: number
  }
}

export interface HistorySnapshot {
  id: string
  timestamp: number
  description: string
  data: ExportData
  scoreSnapshot?: WeaveScore
}

export interface CompareViewData {
  before: {
    score: WeaveScore
    data: ExportData
  }
  after: {
    score: WeaveScore
    data: ExportData
  }
  changes: string[]
}

export interface TreadleAnalysis {
  id: number
  label: string
  linkedHarnessCount: number
  linkedHarnessIds: number[]
  raisedWarps: number
  totalWarps: number
  raiseRatio: number
  hasInterleaving: boolean
  floatWarnings: number
  isEmpty: boolean
  isFull: boolean
}

export interface DesignChange {
  type: 'warp' | 'treadle' | 'harness'
  id: number
  changeType: 'added' | 'removed' | 'modified'
  description: string
  before?: any
  after?: any
}

export type MaterialType = 'cotton' | 'silk' | 'wool' | 'linen' | 'synthetic' | 'blend'

export interface MaterialConfig {
  type: MaterialType
  label: string
  recommendedMaxFloat: number
  stiffness: number
  strength: number
  description: string
}

export interface SimulationParams {
  targetScore: number
  maxFloatLimit: number
  harnessUtilizationMin: number
  materialType: MaterialType
  candidateCount: number
  maxIterations: number
  mutationRate: number
}

export interface SimulationStep {
  iteration: number
  design: ExportData
  score: WeaveScore
  appliedChanges: DesignChange[]
  riskHotspots: RiskHotspot[]
  timestamp: number
}

export interface CandidateScheme {
  id: string
  name: string
  design: ExportData
  score: WeaveScore
  steps: SimulationStep[]
  scoreHistory: number[]
  isLocked: boolean
  riskMigrationPath: RiskMigrationPoint[]
  tags: string[]
  createdAt: number
}

export interface RiskMigrationPoint {
  step: number
  type: 'harness' | 'warp' | 'treadle'
  targetId: number
  riskLevel: number
  description: string
  transition: 'resolved' | 'reduced' | 'introduced' | 'persisted'
}

export interface HeatmapDiffCell {
  row: number
  col: number
  diffType: 'added' | 'removed' | 'modified' | 'unchanged'
  beforeValue: number
  afterValue: number
}

export interface StructureHeatmap {
  baseMatrix: number[][]
  targetMatrix: number[][]
  diffCells: HeatmapDiffCell[]
  diffSummary: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
}

export interface ExperimentReport {
  id: string
  title: string
  createdAt: number
  params: SimulationParams
  baselineDesign: ExportData
  baselineScore: WeaveScore
  candidates: CandidateScheme[]
  bestCandidateId: string | null
  totalIterations: number
  executionTimeMs: number
  notes?: string
}

export const MATERIAL_PRESETS: Record<MaterialType, MaterialConfig> = {
  cotton: {
    type: 'cotton',
    label: '棉',
    recommendedMaxFloat: 8,
    stiffness: 0.5,
    strength: 0.7,
    description: '通用性强，适合中长浮线'
  },
  silk: {
    type: 'silk',
    label: '丝绸',
    recommendedMaxFloat: 6,
    stiffness: 0.3,
    strength: 0.5,
    description: '细腻柔软，适合短浮线精细组织'
  },
  wool: {
    type: 'wool',
    label: '羊毛',
    recommendedMaxFloat: 10,
    stiffness: 0.6,
    strength: 0.6,
    description: '蓬松有弹性，可承受较长浮线'
  },
  linen: {
    type: 'linen',
    label: '亚麻',
    recommendedMaxFloat: 7,
    stiffness: 0.8,
    strength: 0.8,
    description: '挺括硬挺，适合中等浮线'
  },
  synthetic: {
    type: 'synthetic',
    label: '化纤',
    recommendedMaxFloat: 12,
    stiffness: 0.4,
    strength: 0.9,
    description: '强度高，适合长浮线复杂组织'
  },
  blend: {
    type: 'blend',
    label: '混纺',
    recommendedMaxFloat: 9,
    stiffness: 0.55,
    strength: 0.75,
    description: '综合性能均衡，适用范围广'
  }
}

export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  targetScore: 85,
  maxFloatLimit: 6,
  harnessUtilizationMin: 0.7,
  materialType: 'cotton',
  candidateCount: 5,
  maxIterations: 20,
  mutationRate: 0.3
}
