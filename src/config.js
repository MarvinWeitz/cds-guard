'use strict'
const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')

const GUARD_DIR = '.guard'
const CONFIG_FILE = 'protected.yml'

class ConfigError extends Error {}

function configPath (root) { return path.join(root, GUARD_DIR, CONFIG_FILE) }

function asList (v, field, id) {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ConfigError(`rule "${id}": "${field}" must be a list`)
  return v
}

function loadConfig (root) {
  const file = configPath(root)
  if (!fs.existsSync(file)) throw new ConfigError(`No config found at ${path.relative(process.cwd(), file) || file}. Run "cds-guard init".`)
  let raw
  try { raw = YAML.parse(fs.readFileSync(file, 'utf8')) || {} } catch (e) { throw new ConfigError(`Cannot parse ${CONFIG_FILE}: ${e.message}`) }
  if (raw.version !== 1) throw new ConfigError(`${CONFIG_FILE}: "version: 1" is required`)
  const rules = asList(raw.rules, 'rules', '(root)')
  const ids = new Set()
  const parsed = rules.map((r, i) => {
    if (!r || typeof r !== 'object') throw new ConfigError(`rules[${i}] must be an object`)
    const id = r.id
    if (!id || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new ConfigError(`rules[${i}]: "id" is required (letters, digits, . _ -)`)
    if (ids.has(id)) throw new ConfigError(`duplicate rule id "${id}"`)
    ids.add(id)
    const rule = {
      id,
      description: r.description || '',
      cds: asList(r.cds, 'cds', id).map(String),
      annotations: asList(r.annotations, 'annotations', id).map(String),
      ignoreAnnotations: !!r.ignoreAnnotations,
      markers: asList(r.markers ?? (r.marker ? [r.marker] : []), 'markers', id).map(String),
      markerFiles: asList(r.markerFiles, 'markerFiles', id).map(String),
      paths: asList(r.paths, 'paths', id).map(String),
      json: asList(r.json, 'json', id).map((j, k) => {
        if (!j || !j.file || !Array.isArray(j.pointers)) throw new ConfigError(`rule "${id}": json[${k}] needs "file" and "pointers"`)
        return { file: String(j.file), pointers: j.pointers.map(String) }
      }),
      approvers: asList(r.approvers, 'approvers', id).map(String)
    }
    const total = rule.cds.length + rule.annotations.length + rule.markers.length + rule.paths.length + rule.json.length
    if (!total) throw new ConfigError(`rule "${id}" protects nothing (add cds, annotations, markers, paths or json)`)
    return rule
  })
  return {
    version: 1,
    cdsRoot: path.resolve(root, (raw.cds && raw.cds.root) || '.'),
    cdsModel: asList(raw.cds && raw.cds.model, 'cds.model', '(root)').map(String),
    guardOwners: asList(raw.guardOwners, 'guardOwners', '(root)').map(String),
    guardPaths: asList(raw.guardPaths, 'guardPaths', '(root)').map(String),
    ignore: asList(raw.ignore, 'ignore', '(root)').map(String),
    rules: parsed
  }
}

module.exports = { loadConfig, configPath, ConfigError, GUARD_DIR, CONFIG_FILE }
