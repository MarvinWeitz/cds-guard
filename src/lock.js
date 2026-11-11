'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { GUARD_DIR } = require('./config')
const { collectRule, ruleScopeHash, newRun } = require('./collect')
const { loadModel } = require('./cds')
const { toPosix } = require('./files')
const TOOL_VERSION = require('../package.json').version

// Always with "/": it appears in messages and CODEOWNERS; path.join accepts it on Windows too.
const LOCK_DIR = `${GUARD_DIR}/locks`
function lockPath (root, id) { return path.join(root, LOCK_DIR, `${id}.lock`) }

function readLock (root, id) {
  const file = lockPath(root, id)
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return { corrupt: e.message } }
}

function listLockIds (root) {
  const dir = path.join(root, LOCK_DIR)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.lock')).map(f => f.slice(0, -5))
}

async function cdsVersionFor (rule, config) {
  if (!rule.cds.length && !rule.annotations.length) return undefined
  return (await loadModel(config.cdsRoot, config.cdsModel)).version
}

/** Write lock files. Refuses to lock a rule whose items cannot be resolved. */
async function lock (root, config, { rules: only = [] } = {}) {
  newRun()
  const unknown = only.filter(id => !config.rules.some(r => r.id === id))
  if (unknown.length) throw new Error(`unknown rule(s): ${unknown.join(', ')}`)
  const selected = only.length ? config.rules.filter(r => only.includes(r.id)) : config.rules
  const written = []
  const problems = []
  for (const rule of selected) {
    const items = await collectRule(rule, root, config)
    const missing = Object.entries(items).filter(([, v]) => v.missing)
    if (missing.length) { problems.push({ rule: rule.id, missing: missing.map(([k, v]) => `${k}: ${v.missing}`) }); continue }
    const data = {
      rule: rule.id,
      scope: ruleScopeHash(rule),
      tool: TOOL_VERSION,
      cds: await cdsVersionFor(rule, config),
      items: Object.fromEntries(Object.keys(items).sort().map(k => [k, items[k].hash]))
    }
    const file = lockPath(root, rule.id)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    written.push({ rule: rule.id, file: toPosix(path.relative(root, file)), items: Object.keys(items).length })
  }
  return { written, problems }
}

module.exports = { lock, readLock, listLockIds, lockPath, cdsVersionFor, LOCK_DIR, TOOL_VERSION }
