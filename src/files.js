'use strict'
const fs = require('node:fs')
const path = require('node:path')
const fg = require('fast-glob')
const { hashText, hashJson, normaliseText, prettyJson } = require('./hash')

const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**', 'gen/**', '**/dist/**', '.guard/**']

function listFiles (root, patterns, ignore) {
  return fg.sync(patterns, { cwd: root, dot: true, onlyFiles: true, ignore: [...DEFAULT_IGNORE, ...ignore] }).sort()
}

function toPosix (p) { return p.split(path.sep).join('/') }

function collectPaths (rule, root, config) {
  const items = {}
  for (const pattern of rule.paths) {
    const files = listFiles(root, [pattern], config.ignore)
    if (!files.length) { items[`file:${pattern}`] = { missing: 'no file matches this pattern' }; continue }
    for (const f of files) {
      const text = fs.readFileSync(path.join(root, f), 'utf8')
      items[`file:${toPosix(f)}`] = { hash: hashText(text), value: normaliseText(text), file: toPosix(f) }
    }
  }
  return items
}

/** RFC 6901 JSON pointer lookup. */
function getPointer (obj, pointer) {
  if (pointer === '' || pointer === '/') return { found: true, value: obj }
  if (!pointer.startsWith('/')) return { found: false }
  let node = obj
  for (const raw of pointer.slice(1).split('/')) {
    const part = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (node === null || typeof node !== 'object' || !(part in node)) return { found: false }
    node = node[part]
  }
  return { found: true, value: node }
}

function collectJson (rule, root) {
  const items = {}
  for (const { file, pointers } of rule.json) {
    const abs = path.join(root, file)
    let data = null
    let err = null
    try { data = JSON.parse(fs.readFileSync(abs, 'utf8')) } catch (e) { err = fs.existsSync(abs) ? `invalid JSON: ${e.message}` : 'file not found' }
    for (const p of pointers) {
      const key = `json:${toPosix(file)}#${p}`
      const where = { file: toPosix(file) }
      if (err) { items[key] = { missing: err, ...where }; continue }
      const r = getPointer(data, p)
      items[key] = r.found ? { hash: hashJson(r.value), value: prettyJson(r.value), ...where } : { missing: 'pointer not found', ...where }
    }
  }
  return items
}

module.exports = { collectPaths, collectJson, listFiles, getPointer, toPosix }
