import type { Harness, WarpEnd, Treadle, FloatWarning } from '@/types/weave'

export function computeThreadingMatrix(harnesses: Harness[], warpEnds: WarpEnd[]): (0 | 1)[][] {
  const matrix: (0 | 1)[][] = []
  for (let h = 0; h < harnesses.length; h++) {
    const row: (0 | 1)[] = []
    for (let w = 0; w < warpEnds.length; w++) {
      row.push(warpEnds[w].harnessId === h + 1 ? 1 : 0)
    }
    matrix.push(row)
  }
  return matrix
}

export function computeWeaveMatrix(treadles: Treadle[], warpEnds: WarpEnd[]): number[][] {
  if (treadles.length === 0 || warpEnds.length === 0) return []
  const rows = treadles.length
  const cols = warpEnds.length
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let t = 0; t < treadles.length; t++) {
    const linkedHarnessIds = new Set(treadles[t].harnessIds)
    for (let w = 0; w < warpEnds.length; w++) {
      const warpHarnessId = warpEnds[w].harnessId
      if (warpHarnessId !== null && linkedHarnessIds.has(warpHarnessId)) {
        matrix[t][w] = 1
      }
    }
  }
  return matrix
}

export function computeFloatWarnings(matrix: number[][], maxFloat: number): FloatWarning[] {
  const warnings: FloatWarning[] = []
  if (matrix.length === 0 || matrix[0].length === 0) return warnings

  const rows = matrix.length
  const cols = matrix[0].length

  const fullSameRows = new Set<number>()
  for (let t = 0; t < rows; t++) {
    const first = matrix[t][0]
    let allSame = true
    for (let w = 1; w < cols; w++) {
      if (matrix[t][w] !== first) {
        allSame = false
        break
      }
    }
    if (allSame) fullSameRows.add(t)
  }

  const fullSameCols = new Set<number>()
  for (let w = 0; w < cols; w++) {
    const first = matrix[0][w]
    let allSame = true
    for (let t = 1; t < rows; t++) {
      if (matrix[t][w] !== first) {
        allSame = false
        break
      }
    }
    if (allSame) fullSameCols.add(w)
  }

  for (let t = 0; t < rows; t++) {
    if (fullSameRows.has(t)) continue
    let start = -1
    for (let w = 0; w <= cols; w++) {
      const isRaised = w < cols && matrix[t][w] === 1
      if (isRaised) {
        if (start === -1) start = w
      } else {
        if (start !== -1) {
          const length = w - start
          if (length > maxFloat) {
            warnings.push({
              startWarp: start + 1,
              endWarp: w,
              type: 'weft',
              length,
            })
          }
          start = -1
        }
      }
    }
  }

  for (let w = 0; w < cols; w++) {
    if (fullSameCols.has(w)) continue
    let start = -1
    for (let t = 0; t <= rows; t++) {
      const isRaised = t < rows && matrix[t][w] === 1
      if (isRaised) {
        if (start === -1) start = t
      } else {
        if (start !== -1) {
          const length = t - start
          if (length > maxFloat) {
            warnings.push({
              startWarp: w + 1,
              endWarp: w + 1,
              type: 'warp',
              length,
            })
          }
          start = -1
        }
      }
    }
  }

  return warnings
}

export function filterFloatWarnings(
  floatWarnings: FloatWarning[],
  matrix: number[][]
): FloatWarning[] {
  if (matrix.length === 0 || !matrix[0]?.length) return floatWarnings
  const rows = matrix.length
  const cols = matrix[0].length
  return floatWarnings.filter((fw) => {
    const isFullRow =
      fw.type === 'weft' && fw.startWarp === 1 && fw.endWarp === cols
    const isFullCol = fw.type === 'warp' && fw.length === rows
    return !isFullRow && !isFullCol
  })
}

export function computeWarpFloatWarningSet(filteredWarnings: FloatWarning[]): Set<number> {
  const set = new Set<number>()
  for (const fw of filteredWarnings) {
    for (let w = fw.startWarp; w <= fw.endWarp; w++) {
      set.add(w)
    }
  }
  return set
}
