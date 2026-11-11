'use strict'
const { collectRule, ruleScopeHash, newRun } = require('./collect')
const { readLock, listLockIds, cdsVersionFor, LOCK_DIR } = require('./lock')

/**
 * Compare the working tree against the lock files.
 * Returns { ok, violations: [{rule, approvers, problems: [{item, kind, detail}]}], warnings: [] }
 */
async function check (root, config) {
  newRun()
  const violations = []
  const warnings = []
  for (const rule of config.rules) {
    const problems = []
    const lockData = readLock(root, rule.id)
    const items = await collectRule(rule, root, config)
    if (!lockData) {
      problems.push({ item: `${LOCK_DIR}/${rule.id}.lock`, kind: 'unlocked', detail: 'rule has no lock file yet' })
    } else if (lockData.corrupt) {
      problems.push({ item: `${LOCK_DIR}/${rule.id}.lock`, kind: 'corrupt', detail: lockData.corrupt })
    } else {
      if (lockData.scope !== ruleScopeHash(rule)) problems.push({ item: '(rule definition)', kind: 'scope-changed', detail: 'what this rule protects was changed in protected.yml' })
      const locked = lockData.items || {}
      for (const [key, v] of Object.entries(items)) {
        if (v.missing) problems.push({ item: key, kind: 'missing', detail: v.missing })
        else if (!(key in locked)) problems.push({ item: key, kind: 'added', detail: 'new protected item, not in lock' })
        else if (locked[key] !== v.hash) problems.push({ item: key, kind: 'changed', detail: v.line ? `block starting at line ${v.line} changed` : 'content changed' })
      }
      for (const key of Object.keys(locked)) {
        if (!(key in items)) problems.push({ item: key, kind: 'removed', detail: 'locked item no longer exists' })
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
  return { ok: violations.length === 0, violations, warnings }
}

function formatText (result) {
  const out = []
  for (const w of result.warnings) out.push(`warning: ${w}`)
  if (result.ok) { out.push('cds-guard: all protected items match their lock files.'); return out.join('\n') }
  out.push('cds-guard: protected items changed.\n')
  for (const v of result.violations) {
    out.push(`✗ rule "${v.rule}"${v.description ? ` (${v.description})` : ''}`)
    for (const p of v.problems) out.push(`    ${p.kind.padEnd(13)} ${p.item}  ${p.detail}`)
    const who = v.approvers.length ? v.approvers.join(', ') : 'the guard owners'
    out.push(`  If this change is intended: run "npx cds-guard lock --rule ${v.rule}", commit the lock file and get approval from ${who}.\n`)
  }
  return out.join('\n')
}

function formatJunit (result) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const cases = result.violations.map(v => `  <testcase classname="cds-guard" name="${esc(v.rule)}"><failure message="${esc(v.problems.length + ' protected item(s) changed')}">${esc(v.problems.map(p => `${p.kind} ${p.item}: ${p.detail}`).join('\n'))}</failure></testcase>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="cds-guard" tests="${Math.max(cases.length, 1)}" failures="${cases.length}">\n${cases.join('\n') || '  <testcase classname="cds-guard" name="all-rules"/>'}\n</testsuite>\n`
}

module.exports = { check, formatText, formatJunit }
