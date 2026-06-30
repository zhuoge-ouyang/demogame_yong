export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

/**
 * 字符级文本差异对比
 * 使用简化的 Myers diff 算法，基于最长公共子序列(LCS)
 * 针对中文文本优化，按字符分割
 */
export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  // 边界处理：空文本
  if (!oldText && !newText) return []
  if (!oldText) return [{ type: 'insert', text: newText }]
  if (!newText) return [{ type: 'delete', text: oldText }]

  // 大文本优化：超过5000字符时按行分割处理
  if (oldText.length > 5000 || newText.length > 5000) {
    return computeDiffLarge(oldText, newText)
  }

  // 字符级分割（支持中文）
  const oldChars = Array.from(oldText)
  const newChars = Array.from(newText)

  // 计算LCS
  const lcsMatrix = computeLCSMatrix(oldChars, newChars)

  // 回溯生成diff
  const segments = backtrackDiff(oldChars, newChars, lcsMatrix)

  // 合并连续相同类型的segment
  return mergeSegments(segments)
}

/**
 * 计算LCS矩阵
 */
function computeLCSMatrix(oldChars: string[], newChars: string[]): number[][] {
  const m = oldChars.length
  const n = newChars.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

/**
 * 回溯生成diff segments
 */
function backtrackDiff(
  oldChars: string[],
  newChars: string[],
  dp: number[][]
): DiffSegment[] {
  const segments: DiffSegment[] = []
  let i = oldChars.length
  let j = newChars.length

  // 临时存储，用于收集连续字符
  const temp: { type: DiffSegment['type']; chars: string[] }[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      // 字符相同，属于equal
      temp.push({ type: 'equal', chars: [oldChars[i - 1]] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // 新增字符
      temp.push({ type: 'insert', chars: [newChars[j - 1]] })
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      // 删除字符
      temp.push({ type: 'delete', chars: [oldChars[i - 1]] })
      i--
    } else {
      break
    }
  }

  // 反转并构建segments
  for (let k = temp.length - 1; k >= 0; k--) {
    const item = temp[k]
    segments.push({
      type: item.type,
      text: item.chars.join('')
    })
  }

  return segments
}

/**
 * 合并连续相同类型的segment
 */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return []

  const merged: DiffSegment[] = []
  let current = segments[0]

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.type === current.type) {
      current = {
        ...current,
        text: current.text + seg.text
      }
    } else {
      merged.push(current)
      current = seg
    }
  }
  merged.push(current)

  return merged
}

/**
 * 大文本处理：按行分割后逐行diff
 */
function computeDiffLarge(oldText: string, newText: string): DiffSegment[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  // 先对行进行diff
  const lineSegments = computeLineDiff(oldLines, newLines)

  // 对每一行内的变化进行字符级diff
  const result: DiffSegment[] = []

  for (const seg of lineSegments) {
    if (seg.type === 'equal') {
      result.push(seg)
    } else if (seg.type === 'delete') {
      // 删除的行，按字符级处理
      const lines = seg.text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) result.push({ type: 'delete', text: '\n' })
        if (lines[i]) result.push({ type: 'delete', text: lines[i] })
      }
    } else if (seg.type === 'insert') {
      // 新增的行，按字符级处理
      const lines = seg.text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) result.push({ type: 'insert', text: '\n' })
        if (lines[i]) result.push({ type: 'insert', text: lines[i] })
      }
    }
  }

  return mergeSegments(result)
}

/**
 * 行级diff
 */
function computeLineDiff(oldLines: string[], newLines: string[]): DiffSegment[] {
  const dp: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0))

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const segments: DiffSegment[] = []
  let i = oldLines.length
  let j = newLines.length

  const temp: { type: DiffSegment['type']; lines: string[] }[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: 'equal', lines: [oldLines[i - 1]] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'insert', lines: [newLines[j - 1]] })
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      temp.push({ type: 'delete', lines: [oldLines[i - 1]] })
      i--
    } else {
      break
    }
  }

  for (let k = temp.length - 1; k >= 0; k--) {
    const item = temp[k]
    segments.push({
      type: item.type,
      text: item.lines.join('\n')
    })
  }

  return mergeSegments(segments)
}
