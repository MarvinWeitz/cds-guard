'use strict'
const path = require('node:path')
const crypto = require('node:crypto')
const { collectRule, ruleScopeHash, newRun } = require('./collect')
const { readLock, listLockIds, cdsVersionFor, LOCK_DIR } = require('./lock')
const { GUARD_DIR, CONFIG_FILE } = require('./config')
const codeowners = require('./codeowners')
const { withBase } = require('./base')
const { diffLines } = require('./diff')

const CONFIG = `${GUARD_DIR}/${CONFIG_FILE}`

/**
 * Compare the working tree against the lock files.
 * Returns { ok, violations: [{rule, approvers, problems: [{item, kind, detail, file, line, diff}]}], owners: [], warnings: [] }.
 * With `base` (a git ref), changed items also get `diff`: their content at base against now.
 */
async function check (root, config, { base } = {}) {
  newRun()
  const violations = []
  const warnings = []
  const current = {}
  for (const rule of config.rules) {
    const problems = []
    const lockFile = `${LOCK_DIR}/${rule.id}.lock`
    const lockData = readLock(root, rule.id)
    const items = await collectRule(rule, root, config)
    current[rule.id] = items
    const at = key => {
      const v = items[key] || {}
      return v.file ? { file: v.file, ...(v.line ? { line: v.line } : {}) } : { file: CONFIG }
    }
    if (!lockData) {
      problems.push({ item: lockFile, kind: 'unlocked', detail: 'rule has no lock file yet', file: CONFIG })
    } else if (lockData.corrupt) {
      problems.push({ item: lockFile, kind: 'corrupt', detail: lockData.corrupt, file: lockFile })
    } else {
      if (lockData.scope !== ruleScopeHash(rule)) problems.push({ item: '(rule definition)', kind: 'scope-changed', detail: 'what this rule protects was changed in protected.yml', file: CONFIG })
      const locked = lockData.items || {}
      for (const [key, v] of Object.entries(items)) {
        if (v.missing) problems.push({ item: key, kind: 'missing', detail: v.missing, ...at(key) })
        else if (!(key in locked)) problems.push({ item: key, kind: 'added', detail: 'new protected item, not in lock', ...at(key) })
        else if (locked[key] !== v.hash) problems.push({ item: key, kind: 'changed', detail: v.line && key.startsWith('marker:') ? `block starting at line ${v.line} changed` : 'content changed', ...at(key) })
      }
      for (const key of Object.keys(locked)) {
        if (!(key in items)) problems.push({ item: key, kind: 'removed', detail: 'locked item no longer exists', file: lockFile })
      }
      const cdsNow = await cdsVersionFor(rule, config)
      if (lockData.cds && cdsNow && lockData.cds !== cdsNow) {
        warnings.push(`rule "${rule.id}": locked with @sap/cds ${lockData.cds}, now ${cdsNow}. If only CDS items changed, the upgrade may be the cause.`)
      }
    }
    if (problems.length) violations.push({ rule: rule.id, description: rule.description, approvers: rule.approvers, problems })
  }
  const known = new Set(config.rules.map(r => r.id))
  for (const id of listLockIds(root)) if (!known.has(id)) warnings.push(`orphan lock file ${LOCK_DIR}/${id}.lock (rule no longer in protected.yml)`)

  const owners = codeowners.verify(root, config).filter(o => !o.ok).map(({ file, hint }) => ({ file, hint }))

  if (base && violations.some(v => v.problems.some(p => p.kind === 'changed'))) {
    try { await addDiffs(root, config, base, violations, current) } catch (e) { warnings.push(`cannot show what changed: ${e.message}`) }
  }
  return { ok: violations.length === 0 && owners.length === 0, violations, owners, warnings }
}

/** Collect the rules with changed items again at `base` and attach the differences. */
async function addDiffs (root, config, base, violations, current) {
  newRun()
  try {
    await withBase(root, base, async dir => {
      const baseConfig = { ...config, cdsRoot: path.join(dir, path.relative(root, config.cdsRoot)), cdsFrom: config.cdsRoot }
      for (const v of violations) {
        const changed = v.problems.filter(p => p.kind === 'changed')
        if (!changed.length) continue
        const before = await collectRule(config.rules.find(r => r.id === v.rule), dir, baseConfig)
        for (const p of changed) {
          const was = before[p.item]
          const now = current[v.rule][p.item]
          if (was && was.value !== undefined && now && now.value !== undefined && was.value !== now.value) p.diff = diffLines(was.value, now.value)
        }
      }
    })
  } finally {
    newRun()
  }
}

function formatText (result) {
  const out = []
  for (const w of result.warnings) out.push(`warning: ${w}`)
  if (result.ok) { out.push('cds-guard: all protected items match their lock files.'); return out.join('\n') }
  out.push('cds-guard: protected items changed.\n')
  for (const v of result.violations) {
    out.push(`✗ rule "${v.rule}"${v.description ? ` (${v.description})` : ''}`)
    for (const p of v.problems) {
      out.push(`    ${p.kind.padEnd(13)} ${p.item}  ${p.detail}`)
      for (const line of p.diff || []) out.push(`        ${line}`)
    }
    const who = v.approvers.length ? v.approvers.join(', ') : 'the guard owners'
    out.push(`  If this change is intended: run "npx @cbs-consulting/cds-guard lock --rule ${v.rule}", commit the lock file and get approval from ${who}.\n`)
  }
  for (const o of result.owners || []) {
    out.push(`✗ ${o.file} does not match protected.yml: the approvers there are out of date.`)
    out.push(`  Run "${o.hint}" and commit the result.\n`)
  }
  return out.join('\n')
}

function formatJunit (result) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const cases = result.violations.map(v => `  <testcase classname="cds-guard" name="${esc(v.rule)}"><failure message="${esc(v.problems.length + ' protected item(s) changed')}">${esc(v.problems.map(p => [`${p.kind} ${p.item}: ${p.detail}`, ...(p.diff || []).map(l => `    ${l}`)].join('\n')).join('\n'))}</failure></testcase>`)
  for (const o of result.owners || []) cases.push(`  <testcase classname="cds-guard" name="${esc(o.file)}"><failure message="approvers out of date">${esc(`Run "${o.hint}" and commit the result.`)}</failure></testcase>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="cds-guard" tests="${Math.max(cases.length, 1)}" failures="${cases.length}">\n${cases.join('\n') || '  <testcase classname="cds-guard" name="all-rules"/>'}\n</testsuite>\n`
}

/** Every finding with a file and line, paths relative to the current directory. */
function findings (result, root, cwd = process.cwd()) {
  const rel = f => path.relative(cwd, path.join(root, f)).split(path.sep).join('/')
  const list = []
  for (const v of result.violations) {
    for (const p of v.problems) {
      const who = v.approvers.length ? v.approvers.join(', ') : 'the guard owners'
      list.push({
        file: rel(p.file || CONFIG),
        line: p.line || 1,
        title: `cds-guard: rule "${v.rule}" ${p.kind}`,
        message: `${p.item}: ${p.detail}. If intended, run "npx @cbs-consulting/cds-guard lock --rule ${v.rule}" and get approval from ${who}.`,
        check: `${v.rule}/${p.kind}`,
        id: `${v.rule}|${p.kind}|${p.item}`
      })
    }
  }
  for (const o of result.owners || []) list.push({ file: rel(o.file), line: 1, title: 'cds-guard: approvers out of date', message: `Run "${o.hint}" and commit the result.`, check: 'approvers/outdated', id: `owners|${o.file}` })
  return list
}

/** GitHub Actions workflow commands, shown on the changed lines of the pull request. */
function formatGithub (result, root, cwd) {
  const data = s => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  const prop = s => data(s).replace(/:/g, '%3A').replace(/,/g, '%2C')
  const lines = result.warnings.map(w => `::warning title=cds-guard::${data(w)}`)
  for (const f of findings(result, root, cwd)) lines.push(`::error file=${prop(f.file)},line=${f.line},title=${prop(f.title)}::${data(f.message)}`)
  return lines.join('\n')
}

/** Azure Pipelines logging commands, shown on the build summary and the pull request. */
function formatAzure (result, root, cwd) {
  const esc = s => String(s).replace(/%/g, '%AZP25').replace(/;/g, '%3B').replace(/\]/g, '%5D').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  const lines = result.warnings.map(w => `##vso[task.logissue type=warning]${esc(w)}`)
  for (const f of findings(result, root, cwd)) lines.push(`##vso[task.logissue type=error;sourcepath=${esc(f.file)};linenumber=${f.line}]${esc(`${f.title}: ${f.message}`)}`)
  return lines.join('\n')
}

/** GitLab Code Quality report, shown in the merge request widget and diff. */
function formatCodeQuality (result, root, cwd) {
  return JSON.stringify(findings(result, root, cwd).map(f => ({
    description: `${f.title}: ${f.message}`,
    check_name: f.check,
    fingerprint: crypto.createHash('sha256').update(f.id).digest('hex'),
    severity: 'blocker',
    location: { path: f.file, lines: { begin: f.line } }
  })), null, 2) + '\n'
}

module.exports = { check, formatText, formatJunit, formatGithub, formatAzure, formatCodeQuality, findings }
