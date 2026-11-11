'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { hashText } = require('./hash')
const { listFiles, toPosix } = require('./files')

// Works with any comment style: // # -- /* */ <!-- -->
const BEGIN = /@protected-begin\s+([A-Za-z0-9._-]+)/
const END = /@protected-end(?:\s+([A-Za-z0-9._-]+))?/
const TEXT_EXT = /\.(cds|js|mjs|cjs|ts|tsx|jsx|java|xml|json|ya?ml|html|properties|sql|hdbview|hdbtable|abap|py|sh|kt|groovy)$/i

/** Parse all marker blocks in one file. Returns { blocks: [{id, body, line}], errors: [] }. */
function parseMarkers (text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  const errors = []
  let open = null
  lines.forEach((line, i) => {
    const b = BEGIN.exec(line)
    const e = !b && END.exec(line)
    if (b) {
      if (open) errors.push({ id: open.id, line: i + 1, message: `nested @protected-begin "${b[1]}" inside "${open.id}"` })
      open = { id: b[1], start: i, line: i + 1 }
    } else if (e) {
      if (!open) { errors.push({ id: e[1] || '?', line: i + 1, message: '@protected-end without @protected-begin' }); return }
      if (e[1] && e[1] !== open.id) errors.push({ id: open.id, line: i + 1, message: `@protected-end "${e[1]}" closes "${open.id}"` })
      blocks.push({ id: open.id, line: open.line, body: lines.slice(open.start + 1, i).join('\n') })
      open = null
    }
  })
  if (open) errors.push({ id: open.id, line: open.line, message: `@protected-begin "${open.id}" is never closed` })
  return { blocks, errors }
}

const scanCache = new Map()
function scan (root, patterns, ignore) {
  const cacheKey = JSON.stringify([root, patterns, ignore])
  if (scanCache.has(cacheKey)) return scanCache.get(cacheKey)
  const files = listFiles(root, patterns, ignore).filter(f => TEXT_EXT.test(f))
  const result = []
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8')
    if (!text.includes('@protected-')) continue
    result.push({ file: toPosix(f), ...parseMarkers(text) })
  }
  scanCache.set(cacheKey, result)
  return result
}

function collectMarkers (rule, root, config) {
  const items = {}
  if (!rule.markers.length) return items
  const patterns = rule.markerFiles.length ? rule.markerFiles : ['**/*']
  const scanned = scan(root, patterns, config.ignore)
  for (const id of rule.markers) {
    let found = 0
    for (const { file, blocks, errors } of scanned) {
      for (const err of errors.filter(x => x.id === id)) items[`marker:${id}@${file}:${err.line}`] = { missing: err.message }
      const mine = blocks.filter(b => b.id === id)
      mine.forEach((b, n) => {
        found++
        const key = mine.length > 1 ? `marker:${id}@${file}#${n + 1}` : `marker:${id}@${file}`
        items[key] = { hash: hashText(b.body), line: b.line }
      })
    }
    if (!found && !Object.keys(items).some(k => k.startsWith(`marker:${id}@`))) items[`marker:${id}`] = { missing: 'no @protected-begin block with this id found' }
  }
  return items
}

function resetCache () { scanCache.clear() }

module.exports = { collectMarkers, parseMarkers, resetCache }
