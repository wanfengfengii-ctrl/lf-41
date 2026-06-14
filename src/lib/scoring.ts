import type {
  WeaveScore,
  DeductionItem,
  ScoreBreakdown,
  RiskHotspot,
  SortedIssue,
  OptimizationSuggestion,
  WeaveDesign,
  FloatWarning,
  ValidationResult,
  DesignStats,
  WarpEnd,
  Treadle,
} from '@/types/weave'

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function calculateWeavability(
  design: WeaveDesign,
  validation: ValidationResult,
  stats: DesignStats
): { score: number; deductions: DeductionItem[] } {
  const deductions: DeductionItem[] = []
  let score = 100

  if (validation.errors.length > 0) {
    validation.errors.forEach((err, idx) => {
      const penalty = Math.min(20, 8 + idx * 3)
      score -= penalty
      deductions.push({
        id: uid(),
        category: 'weavability',
        severity: 'critical',
        points: penalty,
        description: err,
      })
    })
  }

  if (stats.unthreadedWarps > 0) {
    const penalty = Math.min(25, stats.unthreadedWarps * 3)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'weavability',
      severity: 'critical',
      points: penalty,
      description: `${stats.unthreadedWarps} 根经线未穿线`,
      location: { type: 'warp', ids: validation.unthreadedWarps },
    })
  }

  if (validation.unlinkedHarnesses.length > 0) {
    const penalty = Math.min(15, validation.unlinkedHarnesses.length * 4)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'weavability',
      severity: 'high',
      points: penalty,
      description: `${validation.unlinkedHarnesses.length} 个综框未关联踏板`,
      location: { type: 'harness', ids: validation.unlinkedHarnesses },
    })
  }

  if (validation.warnings.length > 0) {
    const penalty = Math.min(20, validation.warnings.length * 2)
    score -= penalty
    validation.warnings.forEach((warn) => {
      deductions.push({
        id: uid(),
        category: 'weavability',
        severity: 'medium',
        points: 2,
        description: warn,
      })
    })
  }

  if (stats.maxWarpFloat > design.maxFloatLength) {
    const excess = stats.maxWarpFloat - design.maxFloatLength
    const penalty = Math.min(20, excess * 3)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'weavability',
      severity: 'high',
      points: penalty,
      description: `最大经向浮线 ${stats.maxWarpFloat} 超过限制 ${design.maxFloatLength}`,
    })
  }

  if (stats.maxWeftFloat > design.maxFloatLength) {
    const excess = stats.maxWeftFloat - design.maxFloatLength
    const penalty = Math.min(20, excess * 3)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'weavability',
      severity: 'high',
      points: penalty,
      description: `最大纬向浮线 ${stats.maxWeftFloat} 超过限制 ${design.maxFloatLength}`,
    })
  }

  return { score: Math.max(0, score), deductions }
}

function calculateComplexity(
  design: WeaveDesign,
  stats: DesignStats
): { score: number; deductions: DeductionItem[] } {
  const deductions: DeductionItem[] = []
  let score = 100

  const warpUsage = Object.values(stats.warpUsage)
  if (warpUsage.length > 0) {
    const avg = warpUsage.reduce((s, v) => s + v, 0) / warpUsage.length
    const variance = warpUsage.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / warpUsage.length
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0

    if (cv > 0.5) {
      const penalty = Math.min(30, Math.round(cv * 40))
      score -= penalty
      deductions.push({
        id: uid(),
        category: 'complexity',
        severity: cv > 1 ? 'high' : 'medium',
        points: penalty,
        description: `综框穿线不均匀，变异系数 ${cv.toFixed(2)}`,
      })
    }
  }

  const unusedHarnesses = Object.values(stats.warpUsage).filter((v) => v === 0).length
  if (unusedHarnesses > 0) {
    const penalty = unusedHarnesses * 5
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'complexity',
      severity: unusedHarnesses > 2 ? 'high' : 'medium',
      points: penalty,
      description: `${unusedHarnesses} 个综框未被使用`,
    })
  }

  const treadleCount = design.treadles.length
  if (treadleCount > design.harnessCount * 3) {
    const penalty = Math.min(25, (treadleCount - design.harnessCount * 2) * 2)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'complexity',
      severity: 'medium',
      points: penalty,
      description: `踏板数量 ${treadleCount} 过多，操作复杂度高`,
    })
  }

  if (design.maxFloatLength >= 10) {
    const penalty = Math.min(15, (design.maxFloatLength - 8) * 3)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'complexity',
      severity: 'low',
      points: penalty,
      description: `允许浮线长度 ${design.maxFloatLength} 偏大`,
    })
  }

  return { score: Math.max(0, score), deductions }
}

function calculateStability(
  design: WeaveDesign,
  floatWarnings: FloatWarning[],
  stats: DesignStats
): { score: number; deductions: DeductionItem[] } {
  const deductions: DeductionItem[] = []
  let score = 100

  const longFloats = floatWarnings.filter((f) => f.length >= design.maxFloatLength + 2)
  if (longFloats.length > 0) {
    const penalty = Math.min(30, longFloats.length * 5)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'stability',
      severity: 'high',
      points: penalty,
      description: `${longFloats.length} 处浮线过长，结构不稳定`,
    })
  }

  const warpFloats = floatWarnings.filter((f) => f.type === 'warp')
  const weftFloats = floatWarnings.filter((f) => f.type === 'weft')
  const balance = Math.abs(warpFloats.length - weftFloats.length)
  if (balance > 5) {
    const penalty = Math.min(20, balance * 2)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'stability',
      severity: balance > 10 ? 'high' : 'medium',
      points: penalty,
      description: `经向浮线(${warpFloats.length})与纬向浮线(${weftFloats.length})分布不均衡`,
    })
  }

  if (stats.averageFloatLength > design.maxFloatLength * 0.8) {
    const penalty = Math.min(25, Math.round((stats.averageFloatLength / design.maxFloatLength - 0.8) * 50))
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'stability',
      severity: 'medium',
      points: penalty,
      description: `平均浮线长度 ${stats.averageFloatLength} 偏高`,
    })
  }

  const consecutiveEmptyTreadles: number[] = []
  for (let i = 0; i < design.treadles.length; i++) {
    if (design.treadles[i].harnessIds.length === 0) {
      consecutiveEmptyTreadles.push(design.treadles[i].id)
    }
  }
  if (consecutiveEmptyTreadles.length > 0) {
    const penalty = Math.min(20, consecutiveEmptyTreadles.length * 4)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'stability',
      severity: 'high',
      points: penalty,
      description: `踏板 ${consecutiveEmptyTreadles.join(', ')} 未关联任何综框`,
      location: { type: 'treadle', ids: consecutiveEmptyTreadles },
    })
  }

  return { score: Math.max(0, score), deductions }
}

function calculateMaterialFit(
  design: WeaveDesign,
  stats: DesignStats,
  floatWarnings: FloatWarning[]
): { score: number; deductions: DeductionItem[] } {
  const deductions: DeductionItem[] = []
  let score = 100

  if (stats.maxWarpFloat > 8) {
    const penalty = Math.min(20, (stats.maxWarpFloat - 8) * 3)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'materialFit',
      severity: 'high',
      points: penalty,
      description: `经向浮线过长(${stats.maxWarpFloat})，仅适用于粗硬纱线`,
    })
  }

  if (stats.maxWeftFloat > 8) {
    const penalty = Math.min(20, (stats.maxWeftFloat - 8) * 3)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'materialFit',
      severity: 'high',
      points: penalty,
      description: `纬向浮线过长(${stats.maxWeftFloat})，仅适用于粗硬纱线`,
    })
  }

  const density = stats.threadedWarps / Math.max(1, design.warpCount)
  if (density < 0.8) {
    const penalty = Math.min(25, Math.round((0.8 - density) * 80))
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'materialFit',
      severity: 'medium',
      points: penalty,
      description: `穿线密度 ${(density * 100).toFixed(0)}% 偏低，材料适配性差`,
    })
  }

  if (floatWarnings.length > 10) {
    const penalty = Math.min(20, floatWarnings.length)
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'materialFit',
      severity: floatWarnings.length > 20 ? 'high' : 'medium',
      points: penalty,
      description: `浮线警告 ${floatWarnings.length} 处过多，对材料强度要求高`,
    })
  }

  const warpUsage = Object.values(stats.warpUsage)
  const minUsage = Math.min(...warpUsage)
  const maxUsage = Math.max(...warpUsage)
  if (maxUsage > 0 && minUsage / maxUsage < 0.3) {
    const penalty = 10
    score -= penalty
    deductions.push({
      id: uid(),
      category: 'materialFit',
      severity: 'medium',
      points: penalty,
      description: `综框负载差异大(最大${maxUsage}/最小${minUsage})，材料磨损不均`,
    })
  }

  return { score: Math.max(0, score), deductions }
}

export function calculateWeaveScore(
  design: WeaveDesign,
  validation: ValidationResult,
  stats: DesignStats,
  floatWarnings: FloatWarning[]
): WeaveScore {
  const weavabilityResult = calculateWeavability(design, validation, stats)
  const complexityResult = calculateComplexity(design, stats)
  const stabilityResult = calculateStability(design, floatWarnings, stats)
  const materialFitResult = calculateMaterialFit(design, stats, floatWarnings)

  const breakdown: ScoreBreakdown = {
    weavability: weavabilityResult.score,
    complexity: complexityResult.score,
    stability: stabilityResult.score,
    materialFit: materialFitResult.score,
  }

  const weights = {
    weavability: 0.35,
    complexity: 0.2,
    stability: 0.3,
    materialFit: 0.15,
  }

  const totalScore = Math.round(
    breakdown.weavability * weights.weavability +
      breakdown.complexity * weights.complexity +
      breakdown.stability * weights.stability +
      breakdown.materialFit * weights.materialFit
  )

  const deductions = [
    ...weavabilityResult.deductions,
    ...complexityResult.deductions,
    ...stabilityResult.deductions,
    ...materialFitResult.deductions,
  ].sort((a, b) => b.points - a.points)

  let grade: WeaveScore['grade']
  if (totalScore >= 90) grade = 'S'
  else if (totalScore >= 80) grade = 'A'
  else if (totalScore >= 70) grade = 'B'
  else if (totalScore >= 60) grade = 'C'
  else if (totalScore >= 40) grade = 'D'
  else grade = 'F'

  const errorPenalty = weavabilityResult.deductions
    .filter((d) => d.severity === 'critical')
    .reduce((s, d) => s + d.points, 0)
  const warningPenalty = weavabilityResult.deductions
    .filter((d) => d.severity === 'medium' || d.severity === 'low')
    .reduce((s, d) => s + d.points, 0)
  const maxFloatPenalty = weavabilityResult.deductions
    .filter((d) => d.description.includes('浮线'))
    .reduce((s, d) => s + d.points, 0)
  const harnessBalancePenalty = complexityResult.deductions
    .filter((d) => d.description.includes('不均') || d.description.includes('未被使用'))
    .reduce((s, d) => s + d.points, 0)

  return {
    totalScore,
    grade,
    breakdown,
    deductions,
    maxFloatPenalty,
    harnessBalancePenalty,
    errorPenalty,
    warningPenalty,
  }
}

export function generateRiskHotspots(
  design: WeaveDesign,
  validation: ValidationResult,
  stats: DesignStats,
  floatWarnings: FloatWarning[]
): RiskHotspot[] {
  const hotspots: RiskHotspot[] = []

  validation.unthreadedWarps.forEach((warpId) => {
    hotspots.push({
      id: uid(),
      type: 'warp',
      targetId: warpId,
      riskLevel: 0.95,
      description: '经线未穿线',
    })
  })

  validation.unlinkedHarnesses.forEach((hId) => {
    hotspots.push({
      id: uid(),
      type: 'harness',
      targetId: hId,
      riskLevel: 0.85,
      description: '综框未关联踏板',
    })
  })

  floatWarnings.forEach((fw) => {
    const riskLevel = Math.min(0.9, 0.4 + (fw.length - design.maxFloatLength) * 0.08)
    for (let w = fw.startWarp; w <= fw.endWarp; w++) {
      hotspots.push({
        id: uid(),
        type: 'warp',
        targetId: w,
        riskLevel,
        description: `${fw.type === 'warp' ? '经向' : '纬向'}浮线过长(${fw.length})`,
      })
    }
  })

  const warpUsage = Object.entries(stats.warpUsage)
  if (warpUsage.length > 0) {
    const avg = warpUsage.reduce((s, [, v]) => s + v, 0) / warpUsage.length
    warpUsage.forEach(([hIdStr, count]) => {
      const hId = Number(hIdStr)
      if (avg > 0) {
        const ratio = count / avg
        if (ratio > 1.5 || ratio < 0.5) {
          hotspots.push({
            id: uid(),
            type: 'harness',
            targetId: hId,
            riskLevel: Math.min(0.75, Math.abs(1 - ratio) * 0.5 + 0.3),
            description: `综框穿线${ratio > 1 ? '过载' : '不足'}：${count}根(均值${avg.toFixed(1)})`,
          })
        }
      }
    })
  }

  design.treadles.forEach((t) => {
    if (t.harnessIds.length === 0) {
      hotspots.push({
        id: uid(),
        type: 'treadle',
        targetId: t.id,
        riskLevel: 0.8,
        description: '踏板未关联任何综框',
      })
    } else if (t.harnessIds.length === design.harnessCount) {
      hotspots.push({
        id: uid(),
        type: 'treadle',
        targetId: t.id,
        riskLevel: 0.6,
        description: '踏板关联所有综框，可能导致无交织',
      })
    }
  })

  return hotspots.sort((a, b) => b.riskLevel - a.riskLevel).slice(0, 50)
}

export function generateSortedIssues(
  validation: ValidationResult,
  score: WeaveScore
): SortedIssue[] {
  const issues: SortedIssue[] = []

  validation.errors.forEach((err, idx) => {
    issues.push({
      id: uid(),
      type: 'error',
      priority: 1000 - idx,
      title: '严重错误',
      description: err,
    })
  })

  score.deductions
    .filter((d) => d.severity === 'high')
    .forEach((d) => {
      issues.push({
        id: d.id,
        type: 'risk',
        priority: 500 + d.points,
        title: '高风险项',
        description: d.description,
        location: d.location,
      })
    })

  validation.warnings.forEach((warn, idx) => {
    issues.push({
      id: uid(),
      type: 'warning',
      priority: 200 - idx,
      title: '警告',
      description: warn,
    })
  })

  score.deductions
    .filter((d) => d.severity === 'medium')
    .forEach((d) => {
      issues.push({
        id: d.id,
        type: 'risk',
        priority: 100 + d.points,
        title: '中风险项',
        description: d.description,
        location: d.location,
      })
    })

  return issues.sort((a, b) => b.priority - a.priority)
}

export function generateOptimizationSuggestions(
  design: WeaveDesign,
  validation: ValidationResult,
  stats: DesignStats,
  applyFn: (changes: {
    warpEnds?: WarpEnd[]
    treadles?: Treadle[]
    harnessCount?: number
  }) => void
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []

  if (validation.unthreadedWarps.length > 0) {
    const newWarpEnds = design.warpEnds.map((w) => {
      if (w.harnessId === null) {
        return { ...w, harnessId: (w.id % design.harnessCount) + 1 }
      }
      return w
    })
    suggestions.push({
      id: uid(),
      title: '自动穿线未穿经线',
      description: `将 ${validation.unthreadedWarps.length} 根未穿线的经线按循环方式分配到各综框`,
      impact: 'significant',
      expectedScoreGain: Math.min(25, validation.unthreadedWarps.length * 3),
      affectedAreas: { warps: validation.unthreadedWarps, harnesses: design.harnesses.map((h) => h.id) },
      adjustmentDirection: '分配未穿线经线到综框，提高可织性',
      applyFn: () => applyFn({ warpEnds: newWarpEnds }),
      previewData: { warpEnds: newWarpEnds },
    })
  }

  if (validation.unlinkedHarnesses.length > 0) {
    const newTreadles = design.treadles.map((t, idx) => {
      if (idx < validation.unlinkedHarnesses.length) {
        return { ...t, harnessIds: [...t.harnessIds, validation.unlinkedHarnesses[idx]] }
      }
      return t
    })
    suggestions.push({
      id: uid(),
      title: '关联未连接综框',
      description: `将 ${validation.unlinkedHarnesses.length} 个未关联踏板的综框连接到对应踏板`,
      impact: 'significant',
      expectedScoreGain: Math.min(15, validation.unlinkedHarnesses.length * 4),
      affectedAreas: { harnesses: validation.unlinkedHarnesses, treadles: design.treadles.map((t) => t.id) },
      adjustmentDirection: '为闲置综框添加踏板关联，提高结构完整性',
      applyFn: () => applyFn({ treadles: newTreadles }),
      previewData: { treadles: newTreadles },
    })
  }

  const warpUsageEntries = Object.entries(stats.warpUsage)
  if (warpUsageEntries.length > 1) {
    const avg = warpUsageEntries.reduce((s, [, v]) => s + v, 0) / warpUsageEntries.length
    const overloaded = warpUsageEntries.filter(([, v]) => v > avg * 1.3)
    const underloaded = warpUsageEntries.filter(([, v]) => v < avg * 0.7 && v > 0)

    if (overloaded.length > 0 || underloaded.length > 0) {
      const newWarpEnds = design.warpEnds.map((w, idx) => ({
        ...w,
        harnessId: (idx % design.harnessCount) + 1,
      }))
      suggestions.push({
        id: uid(),
        title: '均衡综框穿线分布',
        description: '重新分配经线使各综框负载更均衡',
        impact: 'moderate',
        expectedScoreGain: Math.min(20, (overloaded.length + underloaded.length) * 3),
        affectedAreas: {
          harnesses: [...overloaded.map(([id]) => Number(id)), ...underloaded.map(([id]) => Number(id))],
        },
        adjustmentDirection: '按顺序循环分配经线，减少综框负载差异',
        applyFn: () => applyFn({ warpEnds: newWarpEnds }),
        previewData: { warpEnds: newWarpEnds },
      })
    }
  }

  const emptyTreadles = design.treadles.filter((t) => t.harnessIds.length === 0)
  if (emptyTreadles.length > 0) {
    const newTreadles = design.treadles.map((t) => {
      if (t.harnessIds.length === 0 && t.id <= design.harnessCount) {
        return { ...t, harnessIds: [t.id] }
      }
      return t
    })
    suggestions.push({
      id: uid(),
      title: '配置空踏板关联',
      description: `为 ${emptyTreadles.length} 个空踏板添加综框关联`,
      impact: 'moderate',
      expectedScoreGain: Math.min(20, emptyTreadles.length * 4),
      affectedAreas: { treadles: emptyTreadles.map((t) => t.id) },
      adjustmentDirection: '为无关联踏板分配对应综框',
      applyFn: () => applyFn({ treadles: newTreadles }),
      previewData: { treadles: newTreadles },
    })
  }

  const unusedHarnesses = warpUsageEntries.filter(([, v]) => v === 0)
  if (unusedHarnesses.length > 0 && unusedHarnesses.length < design.harnessCount) {
    const newWarpEnds = design.warpEnds.map((w, idx) => ({
      ...w,
      harnessId: (idx % design.harnessCount) + 1,
    }))
    suggestions.push({
      id: uid(),
      title: '启用闲置综框',
      description: `重新分配经线以利用 ${unusedHarnesses.length} 个闲置综框`,
      impact: 'moderate',
      expectedScoreGain: unusedHarnesses.length * 5,
      affectedAreas: { harnesses: unusedHarnesses.map(([id]) => Number(id)) },
      adjustmentDirection: '循环分配经线确保所有综框被使用',
      applyFn: () => applyFn({ warpEnds: newWarpEnds }),
      previewData: { warpEnds: newWarpEnds },
    })
  }

  return suggestions.sort((a, b) => b.expectedScoreGain - a.expectedScoreGain)
}
