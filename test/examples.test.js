'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { project, run } = require('./helpers')

const EXAMPLES = path.join(__dirname, '..', 'examples')
const GENERATED = { github: 'CODEOWNERS', gitlab: 'CODEOWNERS', bitbucket: 'CODEOWNERS', 'azure-devops': 'azure-policies.sh' }
const PLATFORM = { github: 'github', gitlab: 'gitlab', bitbucket: 'bitbucket', 'azure-devops': 'azure' }

for (const name of Object.keys(GENERATED)) {
  test(`example for ${name} locks against the fixture and matches its generated owners`, async t => {
    const p = project(t)
    p.write('.guard/protected.yml', fs.readFileSync(path.join(EXAMPLES, name, 'protected.yml'), 'utf8'))
    const lock = await run(['lock', '--root', p.dir])
    assert.equal(lock.code, 0, lock.err)
    assert.equal((await run(['check', '--root', p.dir])).code, 0)
    const owners = await run(['codeowners', '--root', p.dir, '--platform', PLATFORM[name]])
    const expected = fs.readFileSync(path.join(EXAMPLES, name, GENERATED[name]), 'utf8')
    assert.equal(owners.out + '\n', expected, `regenerate examples/${name}/${GENERATED[name]}`)
  })
}
