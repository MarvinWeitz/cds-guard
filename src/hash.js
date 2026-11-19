'use strict'
const crypto = require('node:crypto')

/** Deterministic JSON: sorted object keys, `$`-prefixed metadata removed. */
function canonical (value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      if (key.startsWith('$')) continue
      out[key] = canonical(value[key])
    }
    return out
  }
  return value
}

function sha256 (text) {
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex')
}

function hashJson (value) {
  return sha256(JSON.stringify(canonical(value)))
}

/** Readable form of what hashJson hashes, for showing differences. Never hashed. */
function prettyJson (value) {
  return JSON.stringify(canonical(value), null, 2)
}

/** Normalise line endings and trailing whitespace so formatting noise does not count. */
function normaliseText (text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '')
}

function hashText (text) {
  return sha256(normaliseText(text))
}

module.exports = { canonical, hashJson, prettyJson, hashText, normaliseText, sha256 }
