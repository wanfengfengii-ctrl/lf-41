import { describe, it, expect } from 'vitest'
import { compareDesigns } from '@/lib/comparison'
import type { ExportData } from '@/types/weave'

const baseData: ExportData = {
  version: '1.0.0',
  harnessCount: 4,
  warpCount: 8,
  maxFloatLength: 6,
  harnesses: [
    { id: 1, label: '综框 1' },
    { id: 2, label: '综框 2' },
    { id: 3, label: '综框 3' },
    { id: 4, label: '综框 4' },
  ],
  warpEnds: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    harnessId: (i % 4) + 1,
  })),
  treadles: [
    { id: 1, label: '踏板 1', harnessIds: [1, 2] },
    { id: 2, label: '踏板 2', harnessIds: [3, 4] },
  ],
}

describe('compareDesigns', () => {
  it('returns no changes for identical designs', () => {
    const changes = compareDesigns(baseData, baseData)
    expect(changes).toEqual([])
  })

  it('detects warp harness modifications', () => {
    const modified: ExportData = {
      ...baseData,
      warpEnds: baseData.warpEnds.map((w, i) =>
        i === 0 ? { ...w, harnessId: 3 } : w
      ),
    }
    const changes = compareDesigns(baseData, modified)
    expect(changes.length).toBeGreaterThan(0)
    const warpChange = changes.find(c => c.type === 'warp' && c.id === 1)
    expect(warpChange).toBeDefined()
    expect(warpChange!.changeType).toBe('modified')
  })

  it('detects added warps', () => {
    const extended: ExportData = {
      ...baseData,
      warpCount: 9,
      warpEnds: [...baseData.warpEnds, { id: 9, harnessId: 1 }],
    }
    const changes = compareDesigns(baseData, extended)
    const added = changes.find(c => c.type === 'warp' && c.changeType === 'added')
    expect(added).toBeDefined()
  })

  it('detects removed warps', () => {
    const reduced: ExportData = {
      ...baseData,
      warpCount: 7,
      warpEnds: baseData.warpEnds.slice(0, 7),
    }
    const changes = compareDesigns(baseData, reduced)
    const removed = changes.find(c => c.type === 'warp' && c.changeType === 'removed')
    expect(removed).toBeDefined()
  })

  it('detects treadle harness changes', () => {
    const modified: ExportData = {
      ...baseData,
      treadles: [
        { id: 1, label: '踏板 1', harnessIds: [1, 2, 3] },
        { id: 2, label: '踏板 2', harnessIds: [4] },
      ],
    }
    const changes = compareDesigns(baseData, modified)
    const treadleChange = changes.find(c => c.type === 'treadle')
    expect(treadleChange).toBeDefined()
  })

  it('detects harness count change', () => {
    const modified: ExportData = {
      ...baseData,
      harnessCount: 6,
      harnesses: [
        ...baseData.harnesses,
        { id: 5, label: '综框 5' },
        { id: 6, label: '综框 6' },
      ],
    }
    const changes = compareDesigns(baseData, modified)
    const harnessChange = changes.find(c => c.type === 'harness')
    expect(harnessChange).toBeDefined()
    expect(harnessChange!.changeType).toBe('added')
  })
})
