import { describe, it, expect } from 'vitest'
import { calculateWeaveScore, generateRiskHotspots, generateSortedIssues } from '@/lib/scoring'
import type { WeaveDesign, ValidationResult, DesignStats, FloatWarning } from '@/types/weave'

const design: WeaveDesign = {
  harnessCount: 4,
  warpCount: 12,
  maxFloatLength: 6,
  harnesses: [
    { id: 1, label: '综框 1' },
    { id: 2, label: '综框 2' },
    { id: 3, label: '综框 3' },
    { id: 4, label: '综框 4' },
  ],
  warpEnds: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    harnessId: (i % 4) + 1,
  })),
  treadles: [
    { id: 1, label: '踏板 1', harnessIds: [1, 2] },
    { id: 2, label: '踏板 2', harnessIds: [3, 4] },
  ],
}

const validValidation: ValidationResult = {
  isValid: true,
  errors: [],
  warnings: [],
  floatWarnings: [],
  unthreadedWarps: [],
  duplicateThreadedWarps: {},
  unlinkedHarnesses: [],
}

const validStats: DesignStats = {
  warpUsage: { 1: 3, 2: 3, 3: 3, 4: 3 },
  maxWarpFloat: 0,
  maxWeftFloat: 0,
  averageFloatLength: 0,
  errorCount: 0,
  warningCount: 0,
  totalWarps: 12,
  threadedWarps: 12,
  unthreadedWarps: 0,
}

describe('calculateWeaveScore', () => {
  it('returns a score for a valid design', () => {
    const result = calculateWeaveScore(design, validValidation, validStats, [])
    expect(result.totalScore).toBeGreaterThan(0)
    expect(result.totalScore).toBeLessThanOrEqual(100)
    expect(result.grade).toBeDefined()
    expect(result.breakdown.weavability).toBeGreaterThan(0)
    expect(result.breakdown.complexity).toBeGreaterThan(0)
    expect(result.breakdown.stability).toBeGreaterThan(0)
    expect(result.breakdown.materialFit).toBeGreaterThan(0)
  })

  it('penalizes errors', () => {
    const errorValidation: ValidationResult = {
      ...validValidation,
      isValid: false,
      errors: ['严重错误1'],
    }
    const errorStats: DesignStats = { ...validStats, errorCount: 1 }
    const result = calculateWeaveScore(design, errorValidation, errorStats, [])
    expect(result.errorPenalty).toBeGreaterThan(0)
    expect(result.totalScore).toBeLessThan(calculateWeaveScore(design, validValidation, validStats, []).totalScore)
  })

  it('penalizes float warnings exceeding max', () => {
    const floatWarnings: FloatWarning[] = [
      { startWarp: 1, endWarp: 1, type: 'warp', length: 10 },
      { startWarp: 1, endWarp: 3, type: 'weft', length: 8 },
    ]
    const floatStats: DesignStats = { ...validStats, maxWarpFloat: 10, maxWeftFloat: 8 }
    const result = calculateWeaveScore(design, validValidation, floatStats, floatWarnings)
    expect(result.maxFloatPenalty).toBeGreaterThan(0)
  })

  it('gives S grade for near-perfect score', () => {
    const result = calculateWeaveScore(design, validValidation, validStats, [])
    if (result.totalScore >= 90) {
      expect(result.grade).toBe('S')
    }
  })

  it('gives F grade for very low score', () => {
    const badValidation: ValidationResult = {
      isValid: false,
      errors: ['错误1', '错误2', '错误3', '错误4', '错误5'],
      warnings: [],
      floatWarnings: [],
      unthreadedWarps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      duplicateThreadedWarps: {},
      unlinkedHarnesses: [1, 2, 3, 4],
    }
    const badStats: DesignStats = {
      warpUsage: { 1: 0, 2: 0, 3: 0, 4: 0 },
      maxWarpFloat: 15,
      maxWeftFloat: 12,
      averageFloatLength: 10,
      errorCount: 5,
      warningCount: 0,
      totalWarps: 12,
      threadedWarps: 2,
      unthreadedWarps: 10,
    }
    const floatWarnings: FloatWarning[] = Array.from({ length: 10 }, (_, i) => ({
      startWarp: i + 1,
      endWarp: i + 1,
      type: 'warp' as const,
      length: 10,
    }))
    const result = calculateWeaveScore(design, badValidation, badStats, floatWarnings)
    expect(result.totalScore).toBeLessThan(40)
  })
})

describe('generateRiskHotspots', () => {
  it('generates hotspots for unthreaded warps', () => {
    const validation: ValidationResult = {
      ...validValidation,
      unthreadedWarps: [1, 3],
    }
    const hotspots = generateRiskHotspots(design, validation, validStats, [])
    const warpHotspots = hotspots.filter(h => h.type === 'warp' && (h.targetId === 1 || h.targetId === 3))
    expect(warpHotspots.length).toBeGreaterThan(0)
  })

  it('generates hotspots for unlinked harnesses', () => {
    const validation: ValidationResult = {
      ...validValidation,
      unlinkedHarnesses: [2, 4],
    }
    const hotspots = generateRiskHotspots(design, validation, validStats, [])
    const harnessHotspots = hotspots.filter(h => h.type === 'harness')
    expect(harnessHotspots.length).toBeGreaterThan(0)
  })

  it('returns empty for clean design', () => {
    const hotspots = generateRiskHotspots(design, validValidation, validStats, [])
    expect(hotspots).toEqual([])
  })
})

describe('generateSortedIssues', () => {
  it('sorts errors before warnings', () => {
    const validation: ValidationResult = {
      isValid: false,
      errors: ['错误1'],
      warnings: ['警告1'],
      floatWarnings: [],
      unthreadedWarps: [],
      duplicateThreadedWarps: {},
      unlinkedHarnesses: [],
    }
    const score = calculateWeaveScore(design, validation, validStats, [])
    const issues = generateSortedIssues(validation, score)
    const errorIssue = issues.find(i => i.type === 'error')
    const warningIssue = issues.find(i => i.type === 'warning')
    if (errorIssue && warningIssue) {
      expect(errorIssue.priority).toBeGreaterThan(warningIssue.priority)
    }
  })
})
