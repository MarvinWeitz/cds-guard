'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { project, run } = require('./helpers')
const { parseMarkers } = require('../src/markers')
const { getPointer } = require('../src/files')

test('exit codes: 0 ok, 1 changed, 2 config error', async t => {
  const p = project(t)
  assert.equal((await run(['lock', '--root', p.dir])).code, 0)
  assert.equal((await run(['check', '--root', p.dir])).code, 0)
  p.edit('srv/tax.js', '0.19', '0.2')
  const r = await run(['check', '--root', p.dir])
  assert.equal(r.code, 1)
  assert.match(r.err, /npx @cbs-consulting\/cds-guard lock --rule tax-formula/)
  assert.match(r.err, /bob@example.com/)
  assert.equal((await run(['check', '--root', path.join(p.dir, 'nope')])).code, 2)
  assert.equal((await run(['bogus'])).code, 2)
})

test('check --format json and junit', async t => {
  const p = project(t)
  await run(['lock', '--root', p.dir])
  p.edit('srv/tax.js', '0.19', '0.2')
  const json = JSON.parse((await run(['check', '--root', p.dir, '--format', 'json'])).out)
  assert.equal(json.ok, false)
  assert.equal(json.violations[0].rule, 'tax-formula')
  const junit = (await run(['check', '--root', p.dir, '--format', 'junit'])).out
  assert.match(junit, /<testsuite name="cds-guard" tests="1" failures="1">/)
  const file = path.join(p.dir, 'out', 'guard.xml')
  const text = await run(['check', '--root', p.dir, '--junit', file])
  assert.match(text.err, /tax-formula/)
  assert.match(fs.readFileSync(file, 'utf8'), /failures="1"/)
})

test('init creates a config that loads once rules are added', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cds-guard-init-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  assert.equal((await run(['init', '--root', dir])).code, 0)
  assert.ok(fs.existsSync(path.join(dir, '.guard', 'locks')))
  assert.match((await run(['init', '--root', dir])).out, /already exists/)
  assert.equal((await run(['check', '--root', dir])).code, 0, 'no rules is fine')
})

test('codeowners for GitHub is written once and updated in place', async t => {
  const p = project(t)
  p.write('.github/CODEOWNERS', '* @org/everyone\n')
  await run(['codeowners', '--root', p.dir, '--write'])
  await run(['codeowners', '--root', p.dir, '--write'])
  const file = p.read('.github/CODEOWNERS')
  assert.equal(file.split('# BEGIN cds-guard').length, 2)
  assert.match(file, /^\* @org\/everyone\n/)
  assert.match(file, /^\/\.guard\/ @org\/leads$/m)
  assert.match(file, /^\/\.github\/workflows\/cds-guard\.yml @org\/leads$/m)
  assert.match(file, /^\/\.guard\/locks\/pricing-model\.lock @org\/team-pricing @alice$/m)
  assert.match(file, /^\/\.guard\/locks\/tax-formula\.lock bob@example\.com$/m)
  assert.match(file, /^\/\.guard\/locks\/frozen-ui\.lock @org\/leads$/m)
})

test('codeowners for GitLab uses a section, Azure gets a policy script', async t => {
  const p = project(t)
  assert.match((await run(['codeowners', '--root', p.dir, '--platform', 'gitlab'])).out, /^\[cds-guard\]$/m)
  const az = (await run(['codeowners', '--root', p.dir, '--platform', 'azure', '--branch', 'develop'])).out
  assert.match(az, /BRANCH=\$\{BRANCH:-develop\}/)
  assert.match(az, /--path-filter '\/\.guard\/locks\/tax-formula\.lock' --required-reviewer-ids 'bob@example\.com'/)
  assert.equal((await run(['codeowners', '--root', p.dir, '--platform', 'svn'])).code, 2)
})

test('marker parser reports structure errors', () => {
  const r = parseMarkers('a\n# @protected-begin x\nb\n<!-- @protected-end y -->\n/* @protected-end */')
  assert.equal(r.blocks.length, 1)
  assert.deepEqual(r.errors.map(e => e.line), [4, 5])
})

test('JSON pointer escapes', () => {
  assert.deepEqual(getPointer({ 'a/b': { '~c': 1 } }, '/a~1b/~0c'), { found: true, value: 1 })
  assert.equal(getPointer({ a: 1 }, '/b').found, false)
})

test('check marks findings for GitHub, Azure Pipelines and GitLab', async t => {
  const p = project(t)
  await run(['lock', '--root', p.dir])
  p.edit('srv/tax.js', '0.19', '0.2')
  const cwd = process.cwd()
  const file = path.relative(cwd, path.join(p.dir, 'srv', 'tax.js')).split(path.sep).join('/')
  const gh = await run(['check', '--root', p.dir, '--format', 'github'])
  assert.equal(gh.code, 1)
  assert.ok(gh.out.includes(`::error file=${file.replace(/:/g, '%3A')},line=2,title=cds-guard%3A rule "tax-formula" changed::`))
  const az = await run(['check', '--root', p.dir, '--format', 'azure'])
  assert.ok(az.out.includes(`##vso[task.logissue type=error;sourcepath=${file};linenumber=2]`))
  const report = path.join(p.dir, 'out', 'quality.json')
  await run(['check', '--root', p.dir, '--codequality', report])
  const quality = JSON.parse(fs.readFileSync(report, 'utf8'))
  assert.equal(quality.length, 1)
  assert.deepEqual(quality[0].location, { path: file, lines: { begin: 2 } })
  assert.equal(quality[0].severity, 'blocker')
})

test('lock reports what changed and leaves unchanged lock files alone', async t => {
  const p = project(t)
  await run(['lock', '--root', p.dir])
  const before = fs.statSync(path.join(p.dir, '.guard', 'locks', 'frozen-ui.lock')).mtimeMs
  p.edit('srv/tax.js', '0.19', '0.2')
  const r = await run(['lock', '--root', p.dir])
  assert.match(r.out, /^locked tax-formula: 1 item\(s\) -> \.guard\/locks\/tax-formula\.lock\n {4}changed {7}marker:tax-calc@srv\/tax\.js$/m)
  assert.match(r.out, /^unchanged frozen-ui: 2 item\(s\) in \.guard\/locks\/frozen-ui\.lock$/m)
  assert.equal(fs.statSync(path.join(p.dir, '.guard', 'locks', 'frozen-ui.lock')).mtimeMs, before)
})

test('codeowners --check, and Bitbucket writes .bitbucket/CODEOWNERS', async t => {
  const p = project(t)
  assert.equal((await run(['codeowners', '--root', p.dir, '--check'])).code, 1, 'nothing written yet')
  await run(['codeowners', '--root', p.dir, '--platform', 'bitbucket', '--write'])
  assert.match(p.read('.bitbucket/CODEOWNERS'), /^\/\.bitbucket\/CODEOWNERS @org\/leads$/m)
  assert.equal((await run(['codeowners', '--root', p.dir, '--check'])).code, 0)
  p.edit('.guard/protected.yml', 'approvers: [ bob@example.com ]', 'approvers: [ carol@example.com ]')
  const r = await run(['codeowners', '--root', p.dir, '--check'])
  assert.equal(r.code, 1)
  assert.match(r.err, /out of date: \.bitbucket\/CODEOWNERS/)
})

test('the Azure script replaces the policies of earlier runs', async t => {
  const p = project(t)
  await run(['codeowners', '--root', p.dir, '--platform', 'azure', '--write', '--branch', 'develop'])
  const script = p.read('.guard/azure-policies.sh')
  assert.match(script, /^OLD=\$\(az repos policy list .*starts_with\(settings\.message, 'cds-guard:'\)/m)
  assert.match(script, /^for id in \$OLD; do az repos policy delete --id "\$id" --yes --output none; done$/m)
  assert.equal((await run(['codeowners', '--root', p.dir, '--check'])).code, 0, 'the branch is read back from the script')
})
