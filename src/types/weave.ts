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
