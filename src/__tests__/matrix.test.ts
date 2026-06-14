import { describe, it, expect } from 'vitest'
import {
  computeThreadingMatrix,
  computeWeaveMatrix,
  computeFloatWarnings,
  filterFloatWarnings,
  computeWarpFloatWarningSet,
} from '@/lib/matrix'
import type { Harness, WarpEnd, Treadle } from '@/types/weave'

const harnesses: Harness[] = [
  { id: 1, label: '综框 1' },
  { id: 2, label: '综框 2' },
  { id: 3, label: '综框 3' },
  { id: 4, label: '综框 4' },
]

const warpEnds: WarpEnd[] = [
  { id: 1, harnessId: 1 },
  { id: 2, harnessId: 2 },
  { id: 3, harnessId: 3 },
  { id: 4, harnessId: 4 },
  { id: 5, harnessId: 1 },
  { id: 6, harnessId: 2 },
]

const unthreadedWarps: WarpEnd[] = [
  { id: 1, harnessId: null },
  { id: 2, harnessId: 1 },
  { id: 3, harnessId: null },
]

const treadles: Treadle[] = [
  { id: 1, label: '踏板 1', harnessIds: [1, 2] },
  { id: 2, label: '踏板 2', harnessIds: [3, 4] },
  { id: 3, label: '踏板 3', harnessIds: [1, 3] },
  { id: 4, label: '踏板 4', harnessIds: [2, 4] },
]

describe('computeThreadingMatrix', () => {
  it('computes correct threading matrix', () => {
    const result = computeThreadingMatrix(harnesses, warpEnds)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual([1, 0, 0, 0, 1, 0])
    expect(result[1]).toEqual([0, 1, 0, 0, 0, 1])
    expect(result[2]).toEqual([0, 0, 1, 0, 0, 0])
    expect(result[3]).toEqual([0, 0, 0, 1, 0, 0])
  })

  it('handles unthreaded warps as all zeros in column', () => {
    const result = computeThreadingMatrix(harnesses.slice(0, 2), unthreadedWarps)
    expect(result[0]).toEqual([0, 1, 0])
    expect(result[1]).toEqual([0, 0, 0])
  })

  it('returns empty matrix for empty inputs', () => {
    const result = computeThreadingMatrix([], [])
    expect(result).toEqual([])
  })
})

describe('computeWeaveMatrix', () => {
  it('computes correct weave matrix', () => {
    const result = computeWeaveMatrix(treadles, warpEnds)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual([1, 1, 0, 0, 1, 1])
    expect(result[1]).toEqual([0, 0, 1, 1, 0, 0])
    expect(result[2]).toEqual([1, 0, 1, 0, 1, 0])
    expect(result[3]).toEqual([0, 1, 0, 1, 0, 1])
  })

  it('returns empty for empty inputs', () => {
    expect(computeWeaveMatrix([], warpEnds)).toEqual([])
    expect(computeWeaveMatrix(treadles, [])).toEqual([])
  })
})

describe('computeFloatWarnings', () => {
  it('detects weft float warnings', () => {
    const matrix = [
      [1, 1, 1, 1, 1, 1, 1, 0],
    ]
    const warnings = computeFloatWarnings(matrix, 4)
    const weftWarnings = warnings.filter(w => w.type === 'weft')
    expect(weftWarnings.length).toBeGreaterThan(0)
  })

  it('detects warp float warnings', () => {
    const matrix = [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [0, 1],
      [0, 1],
      [0, 1],
    ]
    const warnings = computeFloatWarnings(matrix, 4)
    const warpWarnings = warnings.filter(w => w.type === 'warp')
    expect(warpWarnings.length).toBeGreaterThan(0)
  })

  it('returns empty for empty matrix', () => {
    expect(computeFloatWarnings([], 6)).toEqual([])
    expect(computeFloatWarnings([[]], 6)).toEqual([])
  })

  it('does not warn on floats within limit', () => {
    const matrix = [
      [1, 1, 0, 1, 1],
    ]
    const warnings = computeFloatWarnings(matrix, 6)
    expect(warnings).toEqual([])
  })
})

describe('filterFloatWarnings', () => {
  it('filters out full-row weft warnings', () => {
    const warnings = [
      { startWarp: 1, endWarp: 4, type: 'weft' as const, length: 7 },
      { startWarp: 1, endWarp: 3, type: 'weft' as const, length: 3 },
    ]
    const matrix = [[1, 1, 1]]
    const result = filterFloatWarnings(warnings, matrix)
    expect(result.every(w => !(w.type === 'weft' && w.startWarp === 1 && w.endWarp === 3))).toBe(true)
  })

  it('passes through warnings when matrix is empty', () => {
    const warnings = [
      { startWarp: 1, endWarp: 2, type: 'weft' as const, length: 7 },
    ]
    const result = filterFloatWarnings(warnings, [])
    expect(result).toEqual(warnings)
  })
})

describe('computeWarpFloatWarningSet', () => {
  it('computes correct set of warp IDs with warnings', () => {
    const warnings = [
      { startWarp: 2, endWarp: 4, type: 'warp' as const, length: 3 },
      { startWarp: 7, endWarp: 7, type: 'warp' as const, length: 5 },
    ]
    const result = computeWarpFloatWarningSet(warnings)
    expect(result.has(2)).toBe(true)
    expect(result.has(3)).toBe(true)
    expect(result.has(4)).toBe(true)
    expect(result.has(7)).toBe(true)
    expect(result.has(1)).toBe(false)
    expect(result.has(5)).toBe(false)
  })

  it('returns empty set for no warnings', () => {
    const result = computeWarpFloatWarningSet([])
    expect(result.size).toBe(0)
  })
})
