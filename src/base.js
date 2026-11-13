'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

function git (cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

/** The commit for `ref`, fetching it from origin first when a shallow clone does not have it. */
function resolveCommit (root, ref) {
  const branch = ref.replace(/^refs\/heads\//, '')
  for (const name of [ref, `refs/remotes/origin/${branch}`]) {
    try { return git(root, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`]) } catch { /* try next */ }
  }
  git(root, ['fetch', '--quiet', '--depth=1', '--no-tags', 'origin', ref])
  return git(root, ['rev-parse', '--verify', 'FETCH_HEAD^{commit}'])
}

/**
 * Check out `ref` into a temporary worktree, call fn with the folder that matches `root` there,
 * and remove the worktree again. Throws with a readable message when git cannot do it.
 */
async function withBase (root, ref, fn) {
  if (!ref || ref.startsWith('-')) throw new Error(`"${ref}" is not a git ref`)
  let top, commit
  try {
    top = git(root, ['rev-parse', '--show-toplevel'])
    commit = resolveCommit(root, ref)
  } catch (e) {
    throw new Error(`cannot find base "${ref}" with git: ${String(e.stderr || e.message).trim().split('\n')[0]}`)
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cds-guard-base-'))
  try {
    git(top, ['worktree', 'add', '--quiet', '--detach', dir, commit])
    const sub = path.relative(fs.realpathSync(top), fs.realpathSync(root))
    return await fn(path.join(dir, sub))
  } finally {
    try { git(top, ['worktree', 'remove', '--force', dir]) } catch { /* removed below */ }
    fs.rmSync(dir, { recursive: true, force: true })
    try { git(top, ['worktree', 'prune']) } catch { /* nothing to prune */ }
  }
}

module.exports = { withBase }
