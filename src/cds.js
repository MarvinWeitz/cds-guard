'use strict'
const path = require('node:path')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const { hashJson } = require('./hash')

/** Prefer the project's own @sap/cds so hashes match what the app compiles with. */
function resolveCds (cdsRoot) {
  const candidates = [path.join(cdsRoot, 'package.json'), __filename]
  for (const from of candidates) {
    try { return createRequire(from)('@sap/cds') } catch { /* try next */ }
  }
  throw new Error('@sap/cds not found. Install it in the project (npm i -D @sap/cds).')
}

let cached = null
async function loadModel (cdsRoot, model = []) {
  if (cached && cached.root === cdsRoot) return cached
  if (!fs.existsSync(cdsRoot)) throw new Error(`cds.root "${cdsRoot}" does not exist`)
  const cds = resolveCds(cdsRoot)
  cds.root = cdsRoot
  // A fresh resolve cache per run, so files added since the last run are found.
  const files = cds.resolve(model.length ? model.map(m => path.resolve(cdsRoot, m)) : '*', { cache: {} })
  const csn = files && files.length ? await cds.load(files, { silent: true }) : null
  if (!csn) throw new Error(`No CDS model found under ${cdsRoot}`)
  cached = { root: cdsRoot, csn, version: cds.version }
  return cached
}

/** Resolve "ns.Entity" or "ns.Entity.element" (element path may be nested: Entity.struct.field). */
function resolveTarget (csn, name) {
  const defs = csn.definitions || {}
  if (defs[name]) return { def: defs[name], kind: 'definition' }
  const parts = name.split('.')
  for (let i = parts.length - 1; i > 0; i--) {
    const defName = parts.slice(0, i).join('.')
    if (!defs[defName]) continue
    let node = defs[defName]
    for (const el of parts.slice(i)) {
      node = node && node.elements && node.elements[el]
      if (!node) return null
    }
    return { def: node, kind: 'element' }
  }
  return null
}

function stripAnnotations (node) {
  if (Array.isArray(node)) return node.map(stripAnnotations)
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('@') && k !== 'doc') out[k] = stripAnnotations(v)
    return out
  }
  return node
}

/**
 * "@UI.LineItem" matches the key itself, qualified variants (@UI.LineItem#Q) and
 * flattened sub-keys (@UI.HeaderInfo.TypeName for "@UI.HeaderInfo").
 */
function pickAnnotation (node, anno) {
  const out = {}
  for (const k of Object.keys(node)) {
    if (k === anno || k.startsWith(anno + '.') || k.startsWith(anno + '#')) out[k] = node[k]
  }
  return out
}

async function collectCds (rule, config) {
  const items = {}
  if (!rule.cds.length && !rule.annotations.length) return items
  const { csn } = await loadModel(config.cdsRoot, config.cdsModel)
  for (const name of rule.cds) {
    const key = `cds:${name}`
    const t = resolveTarget(csn, name)
    if (!t) { items[key] = { missing: 'not found in CDS model (deleted or renamed?)' }; continue }
    items[key] = { hash: hashJson(rule.ignoreAnnotations ? stripAnnotations(t.def) : t.def) }
  }
  for (const spec of rule.annotations) {
    const key = `annotation:${spec}`
    const m = /^(.+?):(@.+)$/.exec(spec)
    if (!m) throw new Error(`rule "${rule.id}": annotation "${spec}" must look like "ns.Entity[.element]:@Term"`)
    const t = resolveTarget(csn, m[1])
    if (!t) { items[key] = { missing: `target "${m[1]}" not found in CDS model` }; continue }
    const picked = pickAnnotation(t.def, m[2])
    if (!Object.keys(picked).length) { items[key] = { missing: `annotation ${m[2]} not present on ${m[1]}` }; continue }
    items[key] = { hash: hashJson(picked) }
  }
  return items
}

function resetCache () { cached = null }

module.exports = { collectCds, loadModel, resolveTarget, pickAnnotation, resetCache }
