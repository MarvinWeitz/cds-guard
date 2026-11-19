'use strict'
const fs = require('node:fs')
const path = require('node:path')

const SOURCE = path.join(__dirname, '..', 'skills', 'cds-guard', 'SKILL.md')
const DEFAULT_DIR = '.claude/skills'

/** The agent skill shipped with this version. */
function content () { return fs.readFileSync(SOURCE, 'utf8') }

/** Write the skill to <dir>/cds-guard/SKILL.md, replacing an older copy. */
function writeSkill (root, dir = DEFAULT_DIR) {
  const file = path.resolve(root, dir, 'cds-guard', 'SKILL.md')
  const text = content()
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (old === text) return { file, status: 'unchanged' }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return { file, status: old === null ? 'created' : 'updated' }
}

module.exports = { content, writeSkill, DEFAULT_DIR }
