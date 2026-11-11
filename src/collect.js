'use strict'
const { collectCds, resetCache: resetCds } = require('./cds')
const { collectPaths, collectJson } = require('./files')
const { collectMarkers, resetCache: resetMarkers } = require('./markers')
const { hashJson } = require('./hash')

/** Hash of what a rule protects (not who approves): changing the scope needs a re-lock. */
function ruleScopeHash (rule) {
  const { approvers, description, ...scope } = rule
  return hashJson(scope)
}

async function collectRule (rule, root, config) {
  return {
    ...(await collectCds(rule, config)),
    ...collectMarkers(rule, root, config),
    ...collectPaths(rule, root, config),
    ...collectJson(rule, root)
  }
}

/** Caches live for one lock/check run only, so a long-lived process sees file changes. */
function newRun () { resetCds(); resetMarkers() }

module.exports = { collectRule, ruleScopeHash, newRun }
