import { describe, it, expect } from 'vitest'
import { validateDesign, computeStats, validateImportData } from '@/lib/validation'
import type { Harness, WarpEnd, Treadle, ExportData, FloatWarning, ValidationResult } from '@/types/weave'

const harnesses: Harness[] = [
  { id: 1, label: '综框 1' },
  { id: 2, label: '综框 2' },
  { id: 3, label: '综框 3' },
  { id: 4, label: '综框 4' },
]

const warpEnds: WarpEnd[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  harnessId: (i % 4) + 1,
}))

const treadles: Treadle[] = [
  { id: 1, label: '踏板 1', harnessIds: [1, 2] },
  { id: 2, label: '踏板 2', harnessIds: [3, 4] },
]

describe('validateDesign', () => {
  it('validates a correct design', () => {
    const result = validateDesign(4, 12, harnesses, warpEnds, treadles, 6)
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('detects zero harness count', () => {
    const result = validateDesign(0, 12, [], warpEnds, treadles, 6)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('综框数量必须大于零')
  })

  it('detects zero warp count', () => {
    const result = validateDesign(4, 0, harnesses, [], treadles, 6)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('经线数量必须大于零')
  })

  it('detects unthreaded warps', () => {
    const warpsWithUnthreaded: WarpEnd[] = [
      { id: 1, harnessId: 1 },
      { id: 2, harnessId: null },
      { id: 3, harnessId: null },
    ]
    const result = validateDesign(4, 3, harnesses, warpsWithUnthreaded, treadles, 6)
    expect(result.isValid).toBe(false)
    expect(result.unthreadedWarps).toContain(2)
    expect(result.unthreadedWarps).toContain(3)
  })

  it('detects unlinked harnesses', () => {
    const treadlesPartial: Treadle[] = [
      { id: 1, label: '踏板 1', harnessIds: [1] },
    ]
    const result = validateDesign(4, 12, harnesses, warpEnds, treadlesPartial, 6)
    expect(result.unlinkedHarnesses).toContain(2)
    expect(result.unlinkedHarnesses).toContain(3)
    expect(result.unlinkedHarnesses).toContain(4)
  })

  it('detects all same warp patterns', () => {
    const samePatternWarps: WarpEnd[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      harnessId: 1,
    }))
    const singleTreadle: Treadle[] = [
      { id: 1, label: '踏板 1', harnessIds: [1] },
    ]
    const result = validateDesign(1, 8, [harnesses[0]], samePatternWarps, singleTreadle, 6)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('提落模式完全相同'))).toBe(true)
  })
})

describe('computeStats', () => {
  it('computes correct stats', () => {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      floatWarnings: [],
      unthreadedWarps: [],
      duplicateThreadedWarps: {},
      unlinkedHarnesses: [],
    }
    const result = computeStats(harnesses, warpEnds, [], validation)
    expect(result.totalWarps).toBe(12)
    expect(result.threadedWarps).toBe(12)
    expect(result.unthreadedWarps).toBe(0)
    expect(result.maxWarpFloat).toBe(0)
    expect(result.maxWeftFloat).toBe(0)
  })

  it('counts unthreaded warps', () => {
    const warps: WarpEnd[] = [
      { id: 1, harnessId: 1 },
      { id: 2, harnessId: null },
      { id: 3, harnessId: null },
    ]
    const validation: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      floatWarnings: [],
      unthreadedWarps: [2, 3],
      duplicateThreadedWarps: {},
      unlinkedHarnesses: [],
    }
    const result = computeStats(harnesses.slice(0, 2), warps, [], validation)
    expect(result.unthreadedWarps).toBe(2)
    expect(result.threadedWarps).toBe(1)
  })
})

describe('validateImportData', () => {
  const validData: ExportData = {
    version: '1.0.0',
    harnessCount: 4,
    warpCount: 12,
    maxFloatLength: 6,
    harnesses,
    warpEnds,
    treadles,
  }

  it('accepts valid data', () => {
    const result = validateImportData(validData)
    expect(result.errors).toEqual([])
  })

  it('rejects missing version', () => {
    const data = { ...validData, version: '' }
    const result = validateImportData(data)
    expect(result.errors).toContain('缺少版本信息')
  })

  it('rejects zero harness count', () => {
    const data = { ...validData, harnessCount: 0 }
    const result = validateImportData(data)
    expect(result.errors.some(e => e.includes('综框'))).toBe(true)
  })

  it('rejects empty treadles', () => {
    const data = { ...validData, treadles: [] }
    const result = validateImportData(data)
    expect(result.errors.some(e => e.includes('踏板'))).toBe(true)
  })

  it('rejects all unlinked treadles', () => {
    const data: ExportData = {
      ...validData,
      treadles: [{ id: 1, label: '踏板 1', harnessIds: [] }],
    }
    const result = validateImportData(data)
    expect(result.errors.some(e => e.includes('未关联综框'))).toBe(true)
  })

  it('warns about unlinked harnesses', () => {
    const data: ExportData = {
      ...validData,
      treadles: [{ id: 1, label: '踏板 1', harnessIds: [1] }],
    }
    const result = validateImportData(data)
    expect(result.warnings.some(w => w.includes('未关联任何踏板'))).toBe(true)
  })
})
