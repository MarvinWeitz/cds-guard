'use strict'

const CONTEXT = 2
const MAX_CELLS = 4e6
const MAX_LINES = 60

/** Line operations [type, text] turning a into b; type is ' ', '-' or '+'. */
function lineOps (a, b) {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const ops = a.slice(0, start).map(l => [' ', l])
  if (midA.length * midB.length > MAX_CELLS) {
    // Too large for a line-by-line comparison: show the changed middle as removed and added.
    for (const l of midA) ops.push(['-', l])
    for (const l of midB) ops.push(['+', l])
  } else {
    // Longest common subsequence, filled from the end so the walk below goes forward.
    const n = midA.length
    const m = midB.length
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
    let i = 0
    let j = 0
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) { ops.push([' ', midA[i]]); i++; j++ } else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) ops.push(['-', midA[i++]])
      else ops.push(['+', midB[j++]])
    }
  }
  for (const l of a.slice(endA)) ops.push([' ', l])
  return ops
}

/** A short unified diff of two texts: changed lines with a little context, hunks separated by "...". */
function diffLines (before, after) {
  const ops = lineOps(before.split('\n'), after.split('\n'))
  const keep = ops.map(() => false)
  ops.forEach(([type], k) => {
    if (type === ' ') return
    for (let c = Math.max(0, k - CONTEXT); c <= Math.min(ops.length - 1, k + CONTEXT); c++) keep[c] = true
  })
  const out = []
  let gap = false
  ops.forEach(([type, text], k) => {
    if (!keep[k]) { gap = out.length > 0; return }
    if (gap) { out.push('...'); gap = false }
    out.push(`${type} ${text}`.trimEnd())
  })
  if (out.length > MAX_LINES) return [...out.slice(0, MAX_LINES), `... ${out.length - MAX_LINES} more line(s)`]
  return out
}

module.exports = { diffLines, lineOps }
