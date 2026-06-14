import type { ExportData, DesignChange } from '@/types/weave'

export function compareDesigns(before: ExportData, after: ExportData): DesignChange[] {
  const changes: DesignChange[] = []

  for (const warpAfter of after.warpEnds) {
    const warpBefore = before.warpEnds.find((w) => w.id === warpAfter.id)
    if (!warpBefore) {
      changes.push({
        type: 'warp',
        id: warpAfter.id,
        changeType: 'added',
        description: `新增经线 ${warpAfter.id}`,
        after: { harnessId: warpAfter.harnessId },
      })
    } else if (warpBefore.harnessId !== warpAfter.harnessId) {
      changes.push({
        type: 'warp',
        id: warpAfter.id,
        changeType: 'modified',
        description: `经线 ${warpAfter.id}: 综框 ${warpBefore.harnessId ?? '无'} → ${warpAfter.harnessId ?? '无'}`,
        before: { harnessId: warpBefore.harnessId },
        after: { harnessId: warpAfter.harnessId },
      })
    }
  }

  for (const warpBefore of before.warpEnds) {
    if (!after.warpEnds.find((w) => w.id === warpBefore.id)) {
      changes.push({
        type: 'warp',
        id: warpBefore.id,
        changeType: 'removed',
        description: `删除经线 ${warpBefore.id}`,
        before: { harnessId: warpBefore.harnessId },
      })
    }
  }

  for (const treadAfter of after.treadles) {
    const treadBefore = before.treadles.find((t) => t.id === treadAfter.id)
    if (!treadBefore) {
      changes.push({
        type: 'treadle',
        id: treadAfter.id,
        changeType: 'added',
        description: `新增踏板 ${treadAfter.id}`,
        after: { harnessIds: treadAfter.harnessIds },
      })
    } else {
      const beforeSet = new Set(treadBefore.harnessIds)
      const afterSet = new Set(treadAfter.harnessIds)
      const added = treadAfter.harnessIds.filter((id) => !beforeSet.has(id))
      const removed = treadBefore.harnessIds.filter((id) => !afterSet.has(id))
      if (added.length > 0 || removed.length > 0) {
        let desc = `踏板 ${treadAfter.id}:`
        if (added.length > 0) desc += ` 关联综框 +${added.join(',')}`
        if (removed.length > 0) desc += ` 取消关联 -${removed.join(',')}`
        changes.push({
          type: 'treadle',
          id: treadAfter.id,
          changeType: 'modified',
          description: desc,
          before: { harnessIds: treadBefore.harnessIds },
          after: { harnessIds: treadAfter.harnessIds },
        })
      }
    }
  }

  for (const treadBefore of before.treadles) {
    if (!after.treadles.find((t) => t.id === treadBefore.id)) {
      changes.push({
        type: 'treadle',
        id: treadBefore.id,
        changeType: 'removed',
        description: `删除踏板 ${treadBefore.id}`,
        before: { harnessIds: treadBefore.harnessIds },
      })
    }
  }

  if (before.harnessCount !== after.harnessCount) {
    changes.push({
      type: 'harness',
      id: 0,
      changeType: before.harnessCount < after.harnessCount ? 'added' : 'removed',
      description: `综框数量: ${before.harnessCount} → ${after.harnessCount}`,
      before: { count: before.harnessCount },
      after: { count: after.harnessCount },
    })
  }

  return changes
}
