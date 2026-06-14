import type {
  Harness,
  WarpEnd,
  Treadle,
  FloatWarning,
  ValidationResult,
  DesignStats,
  ExportData,
} from '@/types/weave'
import { computeWeaveMatrix, computeFloatWarnings, filterFloatWarnings } from './matrix'

export function validateDesign(
  harnessCount: number,
  warpCount: number,
  harnesses: Harness[],
  warpEnds: WarpEnd[],
  treadles: Treadle[],
  maxFloatLength: number
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const unthreadedWarps: number[] = []
  const duplicateThreadedWarps: Record<number, number[]> = {}
  const unlinkedHarnesses: number[] = []

  if (harnessCount <= 0) {
    errors.push('综框数量必须大于零')
  }
  if (warpCount <= 0) {
    errors.push('经线数量必须大于零')
  }

  const harnessIds = new Set(harnesses.map((h) => h.id))
  const invalidHarnessWarps: number[] = []
  for (const warp of warpEnds) {
    if (warp.harnessId === null) {
      unthreadedWarps.push(warp.id)
    } else if (!harnessIds.has(warp.harnessId)) {
      invalidHarnessWarps.push(warp.id)
    }
  }

  if (unthreadedWarps.length > 0) {
    errors.push(
      `经线 ${unthreadedWarps.join(', ')} 未穿过任何综框`
    )
  }

  if (invalidHarnessWarps.length > 0) {
    errors.push(
      `经线 ${invalidHarnessWarps.join(', ')} 穿过了不存在的综框`
    )
  }

  for (const invalidWarpId of invalidHarnessWarps) {
    const warp = warpEnds.find((w) => w.id === invalidWarpId)
    if (warp && warp.harnessId !== null) {
      duplicateThreadedWarps[invalidWarpId] = [warp.harnessId]
    }
  }

  const linkedHarnessIds = new Set<number>()
  for (const tread of treadles) {
    tread.harnessIds.forEach((id) => linkedHarnessIds.add(id))
  }
  for (const harness of harnesses) {
    if (!linkedHarnessIds.has(harness.id)) {
      unlinkedHarnesses.push(harness.id)
      warnings.push(`综框 ${harness.id} (${harness.label}) 未关联任何踏板`)
    }
  }

  const matrix = computeWeaveMatrix(treadles, warpEnds)
  const rawFloatWarnings = computeFloatWarnings(matrix, maxFloatLength)

  if (matrix.length > 0 && matrix[0]?.length > 0) {
    const rows = matrix.length
    const cols = matrix[0].length

    let hasValidInterleaving = false
    const noInterleaveRows: number[] = []
    for (let t = 0; t < rows; t++) {
      const rowSum = matrix[t].reduce((s, v) => s + v, 0)
      if (rowSum === 0 || rowSum === cols) {
        noInterleaveRows.push(t + 1)
      }
      if (rowSum > 0 && rowSum < cols) {
        hasValidInterleaving = true
      }
    }

    const warpPatterns = new Set<string>()
    for (let w = 0; w < cols; w++) {
      const pat = matrix.map((r) => r[w]).join('')
      warpPatterns.add(pat)
    }

    if (warpPatterns.size === 1 && rows > 0) {
      errors.push(
        '所有经线的提落模式完全相同，不存在交织，无法形成有效的织物结构。请将经线分配到不同综框。'
      )
    } else if (noInterleaveRows.length > 0) {
      const allRowsBad = noInterleaveRows.length === rows
      if (allRowsBad) {
        errors.push(
          `所有 ${rows} 个踏板步均无交织（经线全提起或全落下），无法形成织物。请调整穿线或踏板关联。`
        )
      } else {
        warnings.push(
          `踏板 ${noInterleaveRows.join(', ')} 步无交织（经线全提起或全落下），可能导致整行浮线过长`
        )
      }
    }

    const fullRowFloats: number[] = []
    const fullColFloats: number[] = []
    const otherWarnings: FloatWarning[] = []
    for (const fw of rawFloatWarnings) {
      if (fw.type === 'weft' && fw.startWarp === 1 && fw.endWarp === cols) {
        fullRowFloats.push(fw.length)
      } else if (fw.type === 'warp' && fw.length === rows) {
        fullColFloats.push(fw.startWarp)
      } else {
        otherWarnings.push(fw)
      }
    }

    if (fullRowFloats.length > 0) {
      warnings.push(
        `存在 ${fullRowFloats.length} 个整行纬向浮线（长度=${cols}），可能由无交织踏板步引起`
      )
    }
    if (fullColFloats.length > 0) {
      warnings.push(
        `经线 ${fullColFloats.join(', ')} 存在整列经向浮线（长度=${rows}）`
      )
    }
    for (const fw of otherWarnings) {
      warnings.push(
        `${fw.type === 'warp' ? '经向' : '纬向'}浮线过长：经线 ${fw.startWarp}-${fw.endWarp}，长度 ${fw.length}`
      )
    }
  }

  const filtered = filterFloatWarnings(rawFloatWarnings, matrix)

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    floatWarnings: filtered,
    unthreadedWarps,
    duplicateThreadedWarps,
    unlinkedHarnesses,
  }
}

export function computeStats(
  harnesses: Harness[],
  warpEnds: WarpEnd[],
  filteredFloatWarnings: FloatWarning[],
  validation: ValidationResult
): DesignStats {
  const warpUsage: Record<number, number> = {}
  for (const harness of harnesses) {
    warpUsage[harness.id] = 0
  }
  let threadedCount = 0
  for (const warp of warpEnds) {
    if (warp.harnessId !== null && warpUsage[warp.harnessId] !== undefined) {
      warpUsage[warp.harnessId]++
      threadedCount++
    }
  }

  const maxWarp = filteredFloatWarnings
    .filter((f) => f.type === 'warp')
    .reduce((max, f) => Math.max(max, f.length), 0)
  const maxWeft = filteredFloatWarnings
    .filter((f) => f.type === 'weft')
    .reduce((max, f) => Math.max(max, f.length), 0)

  const totalFloat = filteredFloatWarnings.reduce((sum, f) => sum + f.length, 0)
  const avgFloat = filteredFloatWarnings.length > 0 ? totalFloat / filteredFloatWarnings.length : 0

  return {
    warpUsage,
    maxWarpFloat: maxWarp,
    maxWeftFloat: maxWeft,
    averageFloatLength: Math.round(avgFloat * 100) / 100,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
    totalWarps: warpEnds.length,
    threadedWarps: threadedCount,
    unthreadedWarps: warpEnds.length - threadedCount,
  }
}

export function validateImportData(data: ExportData): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data.version) errors.push('缺少版本信息')
  if (!data.harnesses || data.harnessCount <= 0) errors.push('综框数量必须大于零')
  if (!data.warpEnds || data.warpCount <= 0) errors.push('经线数量必须大于零')
  if (!data.treadles) {
    errors.push('缺少踏板配置')
  } else if (data.treadles.length === 0) {
    errors.push('踏板数量必须大于零，请至少配置一个踏板')
  } else {
    const totalLinked = data.treadles.reduce((sum, t) => sum + t.harnessIds.length, 0)
    if (totalLinked === 0) {
      errors.push('所有踏板均未关联综框，无法形成织物结构。请至少将一个踏板关联到综框。')
    }
  }

  if (errors.length > 0) {
    return { errors, warnings }
  }

  const harnessIds = new Set(data.harnesses.map((h) => h.id))
  const unthreadedWarps: number[] = []
  const invalidHarnessWarps: number[] = []
  const duplicateHarnessWarps: number[] = []
  const warpHarnessCount: Record<number, number> = {}

  for (const warp of data.warpEnds) {
    if (warp.harnessId === null) {
      unthreadedWarps.push(warp.id)
    } else if (!harnessIds.has(warp.harnessId)) {
      invalidHarnessWarps.push(warp.id)
    } else {
      warpHarnessCount[warp.id] = (warpHarnessCount[warp.id] || 0) + 1
      if (warpHarnessCount[warp.id] > 1) {
        duplicateHarnessWarps.push(warp.id)
      }
    }
  }

  if (unthreadedWarps.length > 0) {
    errors.push(`经线 ${unthreadedWarps.join(', ')} 未穿过任何综框`)
  }
  if (invalidHarnessWarps.length > 0) {
    errors.push(`经线 ${invalidHarnessWarps.join(', ')} 穿过了不存在的综框`)
  }
  if (duplicateHarnessWarps.length > 0) {
    errors.push(`经线 ${duplicateHarnessWarps.join(', ')} 穿过了多个综框`)
  }

  if (data.harnesses.length !== data.harnessCount) {
    errors.push('综框数量与配置不匹配')
  }
  if (data.warpEnds.length !== data.warpCount) {
    errors.push('经线数量与配置不匹配')
  }

  const linkedHarnessIds = new Set<number>()
  for (const tread of data.treadles) {
    tread.harnessIds.forEach((id) => linkedHarnessIds.add(id))
  }
  const unlinkedHarnesses: number[] = []
  for (const harness of data.harnesses) {
    if (!linkedHarnessIds.has(harness.id)) {
      unlinkedHarnesses.push(harness.id)
    }
  }
  if (unlinkedHarnesses.length > 0) {
    warnings.push(`综框 ${unlinkedHarnesses.join(', ')} 未关联任何踏板`)
  }

  const treads = data.treadles
  const warps = data.warpEnds
  if (treads.length > 0 && warps.length > 0) {
    const matrix = computeWeaveMatrix(treads, warps)
    const rows = matrix.length
    const cols = matrix[0]?.length ?? 0

    const warpPatterns = new Set<string>()
    for (let w = 0; w < cols; w++) {
      const pat = matrix.map((r) => r[w]).join('')
      warpPatterns.add(pat)
    }

    if (warpPatterns.size === 1) {
      errors.push(
        '所有经线的提落模式完全相同，不存在交织，无法形成有效的织物结构。请将经线分配到不同综框。'
      )
    } else {
      const noInterleaveRows: number[] = []
      for (let t = 0; t < rows; t++) {
        const rowSum = matrix[t].reduce((s, v) => s + v, 0)
        if (rowSum === 0 || rowSum === cols) {
          noInterleaveRows.push(t + 1)
        }
      }
      if (noInterleaveRows.length === rows) {
        errors.push(
          `所有 ${rows} 个踏板步均无交织（经线全提起或全落下），无法形成织物。请调整穿线或踏板关联。`
        )
      } else if (noInterleaveRows.length > 0) {
        warnings.push(
          `踏板 ${noInterleaveRows.join(', ')} 步无交织（经线全提起或全落下），可能导致整行浮线过长`
        )
      }
    }
  }

  return { errors, warnings }
}
