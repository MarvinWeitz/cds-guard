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
  assert.match(r.err, /npx cds-guard lock --rule tax-formula/)
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

test('skill prints the agent skill and writes it once', async t => {
  const p = project(t)
  const printed = await run(['skill'])
  assert.equal(printed.code, 0)
  assert.match(printed.out, /^---\nname: cds-guard\n/)
  assert.match((await run(['skill', '--root', p.dir, '--write'])).out, /^created \.claude\/skills\/cds-guard\/SKILL\.md$/)
  assert.equal(p.read('.claude/skills/cds-guard/SKILL.md').trimEnd(), printed.out)
  assert.match((await run(['skill', '--root', p.dir, '--write'])).out, /^unchanged /)
  p.write('.claude/skills/cds-guard/SKILL.md', 'old\n')
  assert.match((await run(['skill', '--root', p.dir, '--write'])).out, /^updated /)
  assert.match((await run(['skill', '--root', p.dir, '--write', '.agents/skills'])).out, /^created \.agents\/skills\/cds-guard\/SKILL\.md$/)
})

test('the agent skill has valid frontmatter and only names real commands', async () => {
  const text = require('../src/skill').content()
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  assert.ok(front, 'frontmatter')
  const meta = require('yaml').parse(front[1])
  assert.equal(meta.name, 'cds-guard')
  assert.ok(meta.description.length <= 1024)
  assert.doesNotMatch(meta.description, /[<>]/)
  const help = (await run(['--help'])).out
  const used = [...text.matchAll(/npx @cbs-consulting\/cds-guard (\w+)/g)].map(m => m[1])
  assert.ok(used.length > 3)
  for (const cmd of new Set(used)) assert.match(help, new RegExp(`^  ${cmd}\\b`, 'm'), `unknown command "${cmd}" in SKILL.md`)
})

test('both plugin manifests match the package and point at the skill', () => {
  const pkg = require('../package.json')
  const root = path.join(__dirname, '..')
  for (const file of ['plugin.json', path.join('.claude-plugin', 'plugin.json')]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
    assert.equal(manifest.name, 'cds-guard', file)
    assert.equal(manifest.version, pkg.version, `${file}: raise "version" with package.json`)
    assert.equal(manifest.license, pkg.license, file)
  }
  assert.match(JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8')).$schema, /^https:\/\/agent-plugins\.org\/schemas\/1\.\d+\.\d+\/plugin\.schema\.json$/)
  assert.ok(fs.existsSync(path.join(root, 'skills', 'cds-guard', 'SKILL.md')))
})
