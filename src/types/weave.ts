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
