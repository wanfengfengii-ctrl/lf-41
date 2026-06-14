import type {
  ExportData,
  WeaveDesign,
  WeaveScore,
  SimulationParams,
  SimulationStep,
  CandidateScheme,
  RiskMigrationPoint,
  StructureHeatmap,
  HeatmapDiffCell,
  ExperimentReport,
  DesignChange,
  RiskHotspot,
  MaterialConfig,
} from '@/types/weave'
import { calculateWeaveScore, generateRiskHotspots } from './scoring'
import { MATERIAL_PRESETS } from '@/types/weave'
import { computeWeaveMatrix, computeFloatWarnings } from './matrix'
import { validateDesign, computeStats } from './validation'

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function cloneDesign(data: ExportData): ExportData {
  return {
    version: data.version,
    harnessCount: data.harnessCount,
    warpCount: data.warpCount,
    maxFloatLength: data.maxFloatLength,
    harnesses: data.harnesses.map((h) => ({ ...h })),
    warpEnds: data.warpEnds.map((w) => ({ ...w })),
    treadles: data.treadles.map((t) => ({ ...t, harnessIds: [...t.harnessIds] })),
  }
}

export function designToWeaveDesign(data: ExportData): WeaveDesign {
  return {
    harnessCount: data.harnessCount,
    warpCount: data.warpCount,
    maxFloatLength: data.maxFloatLength,
    harnesses: data.harnesses,
    warpEnds: data.warpEnds,
    treadles: data.treadles,
  }
}

export { computeWeaveMatrix }

export function evaluateDesign(data: ExportData): {
  score: WeaveScore
  validation: ReturnType<typeof validateDesign>
  stats: ReturnType<typeof computeStats>
  riskHotspots: RiskHotspot[]
  floatWarnings: ReturnType<typeof computeFloatWarnings>
} {
  const design = designToWeaveDesign(data)
  const matrix = computeWeaveMatrix(data.treadles, data.warpEnds)
  const floatWarnings = computeFloatWarnings(matrix, data.maxFloatLength)

  const validation = validateDesign(
    data.harnessCount,
    data.warpCount,
    data.harnesses,
    data.warpEnds,
    data.treadles,
    data.maxFloatLength
  )

  const stats = computeStats(
    data.harnesses,
    data.warpEnds,
    validation.floatWarnings,
    validation
  )

  const score = calculateWeaveScore(design, validation, stats, validation.floatWarnings)
  const riskHotspots = generateRiskHotspots(design, validation, stats, validation.floatWarnings)

  return { score, validation, stats, riskHotspots, floatWarnings }
}

type MutationStrategy =
  | 'redistributeWarps'
  | 'shuffleWarps'
  | 'balanceHarness'
  | 'modifyTreadle'
  | 'addTreadleHarness'
  | 'removeTreadleHarness'
  | 'swapTreadles'
  | 'adjustFloat'

const MUTATION_STRATEGIES: MutationStrategy[] = [
  'redistributeWarps',
  'shuffleWarps',
  'balanceHarness',
  'modifyTreadle',
  'addTreadleHarness',
  'removeTreadleHarness',
  'swapTreadles',
  'adjustFloat',
]

function applyMutation(
  data: ExportData,
  params: SimulationParams,
  materialConfig: MaterialConfig
): { newData: ExportData; changes: DesignChange[] } {
  const newData = cloneDesign(data)
  const changes: DesignChange[] = []
  const strategy = MUTATION_STRATEGIES[Math.floor(Math.random() * MUTATION_STRATEGIES.length)]
  const { harnessCount, warpCount } = newData

  switch (strategy) {
    case 'redistributeWarps': {
      const count = Math.max(1, Math.floor(warpCount * 0.15))
      for (let i = 0; i < count; i++) {
        const warpIdx = Math.floor(Math.random() * warpCount)
        const warp = newData.warpEnds[warpIdx]
        const oldHarness = warp.harnessId
        const newHarness = Math.floor(Math.random() * harnessCount) + 1
        if (oldHarness !== newHarness) {
          const before = warp.harnessId
          warp.harnessId = newHarness
          changes.push({
            type: 'warp',
            id: warp.id,
            changeType: 'modified',
            description: `经线 ${warp.id}: 综框 ${oldHarness ?? '无'} → ${newHarness}`,
            before: { harnessId: before },
            after: { harnessId: newHarness },
          })
        }
      }
      break
    }
    case 'shuffleWarps': {
      const oldWarpEnds = newData.warpEnds.map((w) => ({ ...w }))
      for (let i = newData.warpEnds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = newData.warpEnds[i].harnessId
        newData.warpEnds[i].harnessId = newData.warpEnds[j].harnessId
        newData.warpEnds[j].harnessId = temp
      }
      for (let i = 0; i < newData.warpEnds.length; i++) {
        if (oldWarpEnds[i].harnessId !== newData.warpEnds[i].harnessId) {
          changes.push({
            type: 'warp',
            id: newData.warpEnds[i].id,
            changeType: 'modified',
            description: `经线 ${newData.warpEnds[i].id}: 综框 ${oldWarpEnds[i].harnessId ?? '无'} → ${newData.warpEnds[i].harnessId ?? '无'}`,
            before: { harnessId: oldWarpEnds[i].harnessId },
            after: { harnessId: newData.warpEnds[i].harnessId },
          })
        }
      }
      break
    }
    case 'balanceHarness': {
      const warpUsage: Record<number, number> = {}
      for (const h of newData.harnesses) warpUsage[h.id] = 0
      for (const w of newData.warpEnds) {
        if (w.harnessId !== null) warpUsage[w.harnessId]++
      }
      const entries = Object.entries(warpUsage)
      const avg = entries.reduce((s, [, v]) => s + v, 0) / entries.length
      const overloaded = entries.filter(([, v]) => v > avg * 1.2)
      const underloaded = entries.filter(([, v]) => v < avg * 0.8 && v > 0)
      if (overloaded.length > 0 && underloaded.length > 0) {
        const overH = Number(overloaded[0][0])
        const underH = Number(underloaded[0][0])
        for (let i = 0; i < newData.warpEnds.length; i++) {
          if (newData.warpEnds[i].harnessId === overH) {
            const before = newData.warpEnds[i].harnessId
            newData.warpEnds[i].harnessId = underH
            changes.push({
              type: 'warp',
              id: newData.warpEnds[i].id,
              changeType: 'modified',
              description: `经线 ${newData.warpEnds[i].id}: 综框 ${overH} → ${underH}`,
              before: { harnessId: before },
              after: { harnessId: underH },
            })
            break
          }
        }
      }
      break
    }
    case 'modifyTreadle': {
      if (newData.treadles.length === 0) break
      const tIdx = Math.floor(Math.random() * newData.treadles.length)
      const treadle = newData.treadles[tIdx]
      const hId = Math.floor(Math.random() * harnessCount) + 1
      const before = [...treadle.harnessIds]
      const idx = treadle.harnessIds.indexOf(hId)
      if (idx >= 0) {
        if (treadle.harnessIds.length > 1) {
          treadle.harnessIds.splice(idx, 1)
        }
      } else {
        treadle.harnessIds.push(hId)
      }
      const added = treadle.harnessIds.filter((id) => !before.includes(id))
      const removed = before.filter((id) => !treadle.harnessIds.includes(id))
      if (added.length > 0 || removed.length > 0) {
        changes.push({
          type: 'treadle',
          id: treadle.id,
          changeType: 'modified',
          description: `踏板 ${treadle.id}: ${added.length > 0 ? `关联综框 +${added.join(',')}` : ''} ${removed.length > 0 ? `取消关联 -${removed.join(',')}` : ''}`,
          before: { harnessIds: before },
          after: { harnessIds: [...treadle.harnessIds] },
        })
      }
      break
    }
    case 'addTreadleHarness': {
      if (newData.treadles.length === 0) break
      const candidates = newData.treadles.filter((t) => t.harnessIds.length < harnessCount)
      if (candidates.length > 0) {
        const treadle = candidates[Math.floor(Math.random() * candidates.length)]
        const available = newData.harnesses.filter((h) => !treadle.harnessIds.includes(h.id))
        if (available.length > 0) {
          const harness = available[Math.floor(Math.random() * available.length)]
          const before = [...treadle.harnessIds]
          treadle.harnessIds.push(harness.id)
          changes.push({
            type: 'treadle',
            id: treadle.id,
            changeType: 'modified',
            description: `踏板 ${treadle.id}: 关联综框 +${harness.id}`,
            before: { harnessIds: before },
            after: { harnessIds: [...treadle.harnessIds] },
          })
        }
      }
      break
    }
    case 'removeTreadleHarness': {
      const candidates = newData.treadles.filter((t) => t.harnessIds.length > 1)
      if (candidates.length > 0) {
        const treadle = candidates[Math.floor(Math.random() * candidates.length)]
        const removeIdx = Math.floor(Math.random() * treadle.harnessIds.length)
        const removedId = treadle.harnessIds[removeIdx]
        const before = [...treadle.harnessIds]
        treadle.harnessIds.splice(removeIdx, 1)
        changes.push({
          type: 'treadle',
          id: treadle.id,
          changeType: 'modified',
          description: `踏板 ${treadle.id}: 取消关联 -${removedId}`,
          before: { harnessIds: before },
          after: { harnessIds: [...treadle.harnessIds] },
        })
      }
      break
    }
    case 'swapTreadles': {
      if (newData.treadles.length < 2) break
      const i = Math.floor(Math.random() * newData.treadles.length)
      let j = Math.floor(Math.random() * newData.treadles.length)
      while (j === i) j = Math.floor(Math.random() * newData.treadles.length)
      const tempIds = [...newData.treadles[i].harnessIds]
      newData.treadles[i].harnessIds = [...newData.treadles[j].harnessIds]
      newData.treadles[j].harnessIds = tempIds
      changes.push({
        type: 'treadle',
        id: newData.treadles[i].id,
        changeType: 'modified',
        description: `踏板 ${newData.treadles[i].id} 与 踏板 ${newData.treadles[j].id} 交换关联综框`,
        before: { harnessIds: newData.treadles[j].harnessIds },
        after: { harnessIds: newData.treadles[i].harnessIds },
      })
      break
    }
    case 'adjustFloat': {
      const targetFloat = Math.max(3, Math.min(materialConfig.recommendedMaxFloat, params.maxFloatLimit))
      if (newData.maxFloatLength !== targetFloat) {
        const before = newData.maxFloatLength
        newData.maxFloatLength = targetFloat
        changes.push({
          type: 'harness',
          id: 0,
          changeType: 'modified',
          description: `最大浮线长度: ${before} → ${targetFloat}`,
          before: { maxFloatLength: before },
          after: { maxFloatLength: targetFloat },
        })
      }
      break
    }
  }

  return { newData, changes }
}

export function buildRiskMigrationPath(
  steps: SimulationStep[]
): RiskMigrationPoint[] {
  const path: RiskMigrationPoint[] = []
  if (steps.length < 2) return path

  for (let s = 1; s < steps.length; s++) {
    const prevHotspots = steps[s - 1].riskHotspots
    const currHotspots = steps[s].riskHotspots

    const prevMap = new Map<string, RiskHotspot>()
    prevHotspots.forEach((h) => prevMap.set(`${h.type}-${h.targetId}`, h))
    const currMap = new Map<string, RiskHotspot>()
    currHotspots.forEach((h) => currMap.set(`${h.type}-${h.targetId}`, h))

    for (const [key, prev] of prevMap) {
      const curr = currMap.get(key)
      if (!curr) {
        path.push({
          step: s,
          type: prev.type,
          targetId: prev.targetId,
          riskLevel: prev.riskLevel,
          description: prev.description,
          transition: 'resolved',
        })
      } else if (curr.riskLevel < prev.riskLevel - 0.1) {
        path.push({
          step: s,
          type: curr.type,
          targetId: curr.targetId,
          riskLevel: curr.riskLevel,
          description: curr.description,
          transition: 'reduced',
        })
      } else {
        path.push({
          step: s,
          type: curr.type,
          targetId: curr.targetId,
          riskLevel: curr.riskLevel,
          description: curr.description,
          transition: 'persisted',
        })
      }
    }

    for (const [key, curr] of currMap) {
      if (!prevMap.has(key)) {
        path.push({
          step: s,
          type: curr.type,
          targetId: curr.targetId,
          riskLevel: curr.riskLevel,
          description: curr.description,
          transition: 'introduced',
        })
      }
    }
  }

  return path.sort((a, b) => b.riskLevel - a.riskLevel)
}

export function computeStructureHeatmap(
  base: ExportData,
  target: ExportData
): StructureHeatmap {
  const baseMatrix = computeWeaveMatrix(base.treadles, base.warpEnds)
  const targetMatrix = computeWeaveMatrix(target.treadles, target.warpEnds)

  const rows = Math.max(baseMatrix.length, targetMatrix.length)
  const cols = Math.max(baseMatrix[0]?.length || 0, targetMatrix[0]?.length || 0)

  const diffCells: HeatmapDiffCell[] = []
  let added = 0, removed = 0, modified = 0, unchanged = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bv = baseMatrix[r]?.[c] ?? 0
      const tv = targetMatrix[r]?.[c] ?? 0
      let diffType: HeatmapDiffCell['diffType']
      if (bv === 0 && tv === 1) {
        diffType = 'added'
        added++
      } else if (bv === 1 && tv === 0) {
        diffType = 'removed'
        removed++
      } else if (bv !== tv) {
        diffType = 'modified'
        modified++
      } else {
        diffType = 'unchanged'
        unchanged++
      }
      diffCells.push({ row: r, col: c, diffType, beforeValue: bv, afterValue: tv })
    }
  }

  return {
    baseMatrix,
    targetMatrix,
    diffCells,
    diffSummary: { added, removed, modified, unchanged },
  }
}

export function generateSchemeTags(score: WeaveScore, params: SimulationParams): string[] {
  const tags: string[] = []
  if (score.totalScore >= params.targetScore) tags.push('达成目标')
  if (score.grade === 'S' || score.grade === 'A') tags.push('优质')
  if (score.breakdown.weavability >= 90) tags.push('高可织性')
  if (score.breakdown.stability >= 90) tags.push('高稳定性')
  if (score.maxFloatPenalty === 0) tags.push('无浮线问题')
  if (score.harnessBalancePenalty === 0) tags.push('综框均衡')
  if (score.errorPenalty === 0) tags.push('无错误')
  if (tags.length === 0) tags.push('待优化')
  return tags
}

export function runSingleCandidate(
  baseline: ExportData,
  baselineScore: WeaveScore,
  baselineRiskHotspots: RiskHotspot[],
  params: SimulationParams,
  candidateIndex: number
): CandidateScheme {
  const materialConfig = MATERIAL_PRESETS[params.materialType]
  const steps: SimulationStep[] = []
  const scoreHistory: number[] = []
  let currentData = cloneDesign(baseline)
  let currentEval = evaluateDesign(currentData)

  steps.push({
    iteration: 0,
    design: cloneDesign(currentData),
    score: JSON.parse(JSON.stringify(currentEval.score)),
    appliedChanges: [],
    riskHotspots: JSON.parse(JSON.stringify(baselineRiskHotspots)),
    timestamp: Date.now(),
  })
  scoreHistory.push(currentEval.score.totalScore)

  let noImproveStreak = 0
  const maxNoImprove = Math.max(5, Math.floor(params.maxIterations / 3))

  for (let i = 1; i <= params.maxIterations; i++) {
    if (currentEval.score.totalScore >= params.targetScore && noImproveStreak >= 3) break

    const { newData, changes } = applyMutation(currentData, params, materialConfig)

    if (changes.length === 0) {
      noImproveStreak++
      continue
    }

    const newEval = evaluateDesign(newData)
    const scoreDiff = newEval.score.totalScore - currentEval.score.totalScore
    const acceptProbability = scoreDiff >= 0 ? 1 : Math.exp(scoreDiff / Math.max(1, params.mutationRate * 20))

    if (scoreDiff >= 0 || Math.random() < acceptProbability) {
      currentData = newData
      currentEval = newEval
      noImproveStreak = 0
      steps.push({
        iteration: i,
        design: cloneDesign(currentData),
        score: JSON.parse(JSON.stringify(currentEval.score)),
        appliedChanges: changes,
        riskHotspots: JSON.parse(JSON.stringify(newEval.riskHotspots)),
        timestamp: Date.now(),
      })
      scoreHistory.push(currentEval.score.totalScore)
    } else {
      noImproveStreak++
      if (noImproveStreak >= maxNoImprove) break
    }
  }

  const finalDesign = cloneDesign(currentData)
  const finalEval = evaluateDesign(finalDesign)
  const riskMigrationPath = buildRiskMigrationPath(steps)
  const tags = generateSchemeTags(finalEval.score, params)

  return {
    id: uid(),
    name: `候选方案 ${candidateIndex + 1}`,
    design: finalDesign,
    score: finalEval.score,
    steps,
    scoreHistory,
    isLocked: false,
    riskMigrationPath,
    tags,
    createdAt: Date.now(),
  }
}

export function runSimulation(
  baseline: ExportData,
  params: SimulationParams
): {
  candidates: CandidateScheme[]
  bestCandidate: CandidateScheme | null
  totalIterations: number
  executionTimeMs: number
} {
  const startTime = Date.now()
  const baselineEval = evaluateDesign(baseline)

  const candidates: CandidateScheme[] = []
  for (let i = 0; i < params.candidateCount; i++) {
    const candidate = runSingleCandidate(
      baseline,
      baselineEval.score,
      baselineEval.riskHotspots,
      params,
      i
    )
    candidates.push(candidate)
  }

  candidates.sort((a, b) => b.score.totalScore - a.score.totalScore)

  const bestCandidate = candidates.length > 0 ? candidates[0] : null
  const totalIterations = candidates.reduce((sum, c) => sum + c.steps.length, 0)
  const executionTimeMs = Date.now() - startTime

  return { candidates, bestCandidate, totalIterations, executionTimeMs }
}

export function buildExperimentReport(
  title: string,
  baseline: ExportData,
  baselineScore: WeaveScore,
  params: SimulationParams,
  candidates: CandidateScheme[],
  bestCandidate: CandidateScheme | null,
  totalIterations: number,
  executionTimeMs: number,
  notes?: string
): ExperimentReport {
  return {
    id: uid(),
    title,
    createdAt: Date.now(),
    params: JSON.parse(JSON.stringify(params)),
    baselineDesign: cloneDesign(baseline),
    baselineScore: JSON.parse(JSON.stringify(baselineScore)),
    candidates: candidates.map((c) => ({
      ...c,
      steps: c.steps.map((s) => ({
        ...s,
        design: cloneDesign(s.design),
        score: JSON.parse(JSON.stringify(s.score)),
        riskHotspots: JSON.parse(JSON.stringify(s.riskHotspots)),
      })),
      design: cloneDesign(c.design),
      score: JSON.parse(JSON.stringify(c.score)),
    })),
    bestCandidateId: bestCandidate?.id ?? null,
    totalIterations,
    executionTimeMs,
    notes,
  }
}

export function exportReportAsJSON(report: ExperimentReport): string {
  return JSON.stringify(
    {
      ...report,
      candidates: report.candidates.map((c) => ({
        ...c,
        steps: c.steps.map((s) => ({
          ...s,
          appliedChanges: s.appliedChanges.map((ch) => ({
            ...ch,
            applyFn: undefined,
          })),
        })),
      })),
    },
    null,
    2
  )
}

export function generateReportMarkdown(report: ExperimentReport): string {
  const lines: string[] = []
  lines.push(`# 织造工艺推演实验报告`)
  lines.push('')
  lines.push(`**标题：** ${report.title}`)
  lines.push(`**生成时间：** ${new Date(report.createdAt).toLocaleString('zh-CN')}`)
  lines.push(`**总迭代次数：** ${report.totalIterations}`)
  lines.push(`**执行耗时：** ${(report.executionTimeMs / 1000).toFixed(2)} 秒`)
  lines.push('')
  lines.push(`## 实验参数`)
  lines.push('')
  lines.push(`- 目标评分：${report.params.targetScore}`)
  lines.push(`- 浮线上限：${report.params.maxFloatLimit}`)
  lines.push(`- 综框利用率下限：${(report.params.harnessUtilizationMin * 100).toFixed(0)}%`)
  lines.push(`- 材料类型：${MATERIAL_PRESETS[report.params.materialType].label}`)
  lines.push(`- 候选方案数：${report.params.candidateCount}`)
  lines.push(`- 最大迭代：${report.params.maxIterations}`)
  lines.push('')
  lines.push(`## 基准方案`)
  lines.push('')
  lines.push(`- 综合评分：${report.baselineScore.totalScore} / 100 (等级 ${report.baselineScore.grade})`)
  lines.push(`- 可织性：${report.baselineScore.breakdown.weavability}`)
  lines.push(`- 复杂度：${report.baselineScore.breakdown.complexity}`)
  lines.push(`- 稳定性：${report.baselineScore.breakdown.stability}`)
  lines.push(`- 材料适配：${report.baselineScore.breakdown.materialFit}`)
  lines.push('')
  lines.push(`## 候选方案对比`)
  lines.push('')
  lines.push(`| 方案 | 总分 | 等级 | 可织性 | 复杂度 | 稳定性 | 材料适配 | 标签 |`)
  lines.push(`|------|------|------|--------|--------|--------|----------|------|`)
  report.candidates.forEach((c, idx) => {
    lines.push(
      `| ${idx + 1}. ${c.name} | ${c.score.totalScore} | ${c.score.grade} | ${c.score.breakdown.weavability} | ${c.score.breakdown.complexity} | ${c.score.breakdown.stability} | ${c.score.breakdown.materialFit} | ${c.tags.join(', ')} |`
    )
  })
  lines.push('')
  if (report.bestCandidateId) {
    const best = report.candidates.find((c) => c.id === report.bestCandidateId)
    if (best) {
      lines.push(`## 推荐最佳方案：${best.name}`)
      lines.push('')
      lines.push(`- 综合评分：${best.score.totalScore} / 100 (等级 ${best.score.grade})`)
      lines.push(`- 评分提升：+${best.score.totalScore - report.baselineScore.totalScore} 分`)
      lines.push(`- 迭代步数：${best.steps.length}`)
      lines.push(`- 标签：${best.tags.join(', ')}`)
      lines.push('')
      if (best.riskMigrationPath.length > 0) {
        lines.push(`### 风险迁移路径 TOP 5`)
        lines.push('')
        best.riskMigrationPath.slice(0, 5).forEach((rp) => {
          const typeLabel = rp.type === 'harness' ? '综框' : rp.type === 'warp' ? '经线' : '踏板'
          const transLabel = {
            resolved: '已解决',
            reduced: '已缓解',
            introduced: '新引入',
            persisted: '持续存在',
          }[rp.transition]
          lines.push(`- 步骤${rp.step} | ${typeLabel}${rp.targetId} | ${transLabel} | ${rp.description}`)
        })
        lines.push('')
      }
    }
  }
  if (report.notes) {
    lines.push(`## 备注`)
    lines.push('')
    lines.push(report.notes)
  }
  return lines.join('\n')
}
