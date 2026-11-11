'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FIXTURE = path.join(__dirname, 'fixtures', 'bookshop')

/** Copy the fixture project to a fresh temporary folder. */
function project (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cds-guard-'))
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: src => !src.includes(`${path.sep}locks`) })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return {
    dir,
    read: f => fs.readFileSync(path.join(dir, f), 'utf8'),
    write: (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s) },
    edit: (f, from, to) => {
      const p = path.join(dir, f)
      const s = fs.readFileSync(p, 'utf8')
      if (!s.includes(from)) throw new Error(`"${from}" not in ${f}`)
      fs.writeFileSync(p, s.replace(from, to))
    }
  }
}

/** Run the CLI in-process and capture its output. */
async function run (args) {
  const { main } = require('../src/cli')
  const out = []
  const err = []
  const code = await main(args, { out: s => out.push(s), err: s => err.push(s) })
  return { code, out: out.join('\n'), err: err.join('\n') }
}

module.exports = { project, run }
