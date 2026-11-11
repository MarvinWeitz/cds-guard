'use strict'
// Programmatic API: the same operations the CLI runs.
const { loadConfig } = require('./src/config')
const { lock } = require('./src/lock')
const { check, formatText } = require('./src/check')
const codeowners = require('./src/codeowners')
module.exports = { loadConfig, lock, check, formatText, codeowners }
