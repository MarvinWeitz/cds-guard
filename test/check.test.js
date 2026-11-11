'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { project } = require('./helpers')
const { loadConfig } = require('../src/config')
const { lock } = require('../src/lock')
const { check } = require('../src/check')

async function lockedProject (t) {
  const p = project(t)
  const r = await lock(p.dir, loadConfig(p.dir))
  assert.deepEqual(r.problems, [])
  return p
}

async function problems (p) {
  const result = await check(p.dir, loadConfig(p.dir))
  return result.violations.flatMap(v => v.problems.map(x => `${v.rule} ${x.kind} ${x.item}`))
}

test('a freshly locked project passes', async t => {
  const p = await lockedProject(t)
  assert.deepEqual(await problems(p), [])
})

test('a rule without lock file fails', async t => {
  const p = project(t)
  const list = await problems(p)
  assert.ok(list.includes('pricing-model unlocked .guard/locks/pricing-model.lock'))
})

test('changing a protected element fails', async t => {
  const p = await lockedProject(t)
  p.edit('db/schema.cds', 'netAmount : Decimal(9, 2)', 'netAmount : Decimal(11, 2)')
  assert.deepEqual(await problems(p), ['pricing-model changed cds:my.app.Orders.netAmount'])
})

test('changing an unprotected element of the same entity passes', async t => {
  const p = await lockedProject(t)
  p.edit('db/schema.cds', 'note      : String;', 'note      : String(500);\n      extra : Integer;')
  assert.deepEqual(await problems(p), [])
})

test('reformatting CDS source passes', async t => {
  const p = await lockedProject(t)
  p.edit('db/schema.cds', 'entity Prices {\n  key ID     : UUID;', '// a comment\nentity Prices\n{\n  key   ID : UUID ;')
  assert.deepEqual(await problems(p), [])
})

test('an annotation added from another file fails', async t => {
  const p = await lockedProject(t)
  p.write('srv/extra.cds', "using my.app from '../db/schema';\nannotate app.Orders with @UI.LineItem #Compact: [{ Value: note }];\n")
  assert.deepEqual(await problems(p), ['pricing-model changed annotation:my.app.Orders:@UI.LineItem'])
})

test('a flattened sub-annotation change is detected', async t => {
  const p = await lockedProject(t)
  p.edit('app/orders/annotations.cds', "TypeNamePlural: 'Orders'", "TypeNamePlural: 'Purchase orders'")
  assert.deepEqual(await problems(p), ['pricing-model changed annotation:my.app.Orders:@UI.HeaderInfo'])
})

test('a renamed entity is reported as missing', async t => {
  const p = await lockedProject(t)
  p.edit('db/schema.cds', 'entity Prices', 'entity PriceList')
  assert.deepEqual(await problems(p), ['pricing-model missing cds:my.app.Prices'])
})

test('editing a marker block fails, editing around it passes', async t => {
  const p = await lockedProject(t)
  p.edit('srv/tax.js', 'module.exports = function tax (net) {', '// new header\nmodule.exports = function tax (net) {')
  assert.deepEqual(await problems(p), [])
  p.edit('srv/tax.js', 'const rate = 0.19', 'const rate = 0.07')
  assert.deepEqual(await problems(p), ['tax-formula changed marker:tax-calc@srv/tax.js'])
})

test('line endings and trailing spaces inside a marker block do not count', async t => {
  const p = await lockedProject(t)
  p.write('srv/tax.js', p.read('srv/tax.js').replace(/\n/g, '   \r\n'))
  assert.deepEqual(await problems(p), [])
})

test('removing the end marker fails', async t => {
  const p = await lockedProject(t)
  p.edit('srv/tax.js', '  // @protected-end\n', '')
  const list = await problems(p)
  assert.ok(list.some(x => x.startsWith('tax-formula missing marker:tax-calc@srv/tax.js')), list.join('\n'))
  assert.ok(list.includes('tax-formula removed marker:tax-calc@srv/tax.js'))
})

test('a second block with the same id is reported', async t => {
  const p = await lockedProject(t)
  p.write('srv/other.js', '// @protected-begin tax-calc\nconst x = 1\n// @protected-end tax-calc\n')
  assert.deepEqual(await problems(p), ['tax-formula added marker:tax-calc@srv/other.js'])
})

test('protected files and JSON pointers', async t => {
  const p = await lockedProject(t)
  p.edit('app/orders/webapp/manifest.json', '"title": "Orders"', '"title": "All orders"')
  assert.deepEqual(await problems(p), [], 'unprotected JSON value')
  p.edit('app/orders/webapp/manifest.json', '"id": "my.app.orders"', '"id": "my.app.orders2"')
  p.edit('app/orders/webapp/annotations.xml', '</edmx:Edmx>', '<x/></edmx:Edmx>')
  assert.deepEqual((await problems(p)).sort(), [
    'frozen-ui changed file:app/orders/webapp/annotations.xml',
    'frozen-ui changed json:app/orders/webapp/manifest.json#/sap.app/id'
  ])
})

test('a new file matching a protected glob is reported', async t => {
  const p = await lockedProject(t)
  p.write('app/orders/webapp/more.xml', '<a/>')
  assert.deepEqual(await problems(p), ['frozen-ui added file:app/orders/webapp/more.xml'])
})

test('changing what a rule protects needs a re-lock, changing approvers does not', async t => {
  const p = await lockedProject(t)
  p.edit('.guard/protected.yml', 'approvers: [ bob@example.com ]', 'approvers: [ carol@example.com ]')
  assert.deepEqual(await problems(p), [])
  p.edit('.guard/protected.yml', 'markerFiles: [ "srv/**/*.js" ]', 'markerFiles: [ "**/*.js" ]')
  assert.deepEqual(await problems(p), ['tax-formula scope-changed (rule definition)'])
})

test('ignoreAnnotations protects the structure only', async t => {
  const p = project(t)
  p.edit('.guard/protected.yml', 'cds: [ my.app.Prices, my.app.Orders.netAmount ]', 'cds: [ my.app.Prices, my.app.Orders.netAmount ]\n    ignoreAnnotations: true')
  p.edit('.guard/protected.yml', '    annotations: [ "my.app.Orders:@UI.LineItem", "my.app.Orders:@UI.HeaderInfo" ]\n', '')
  await lock(p.dir, loadConfig(p.dir))
  p.edit('db/schema.cds', "@title: 'Net amount'", "@title: 'Net'")
  assert.deepEqual(await problems(p), [])
  p.edit('db/schema.cds', 'Decimal(9, 2) @title', 'Decimal(10, 2) @title')
  assert.deepEqual(await problems(p), ['pricing-model changed cds:my.app.Orders.netAmount'])
})

test('lock refuses items that do not exist', async t => {
  const p = project(t)
  p.edit('.guard/protected.yml', 'my.app.Prices,', 'my.app.Nope,')
  const r = await lock(p.dir, loadConfig(p.dir), { rules: ['pricing-model'] })
  assert.equal(r.written.length, 0)
  assert.match(r.problems[0].missing[0], /cds:my.app.Nope/)
})

test('an orphan lock file is a warning', async t => {
  const p = await lockedProject(t)
  p.write('.guard/locks/old-rule.lock', '{}')
  const result = await check(p.dir, loadConfig(p.dir))
  assert.equal(result.ok, true)
  assert.match(result.warnings.join(), /orphan lock file .guard\/locks\/old-rule.lock/)
})

test('cds.model limits which CDS files are loaded', async t => {
  const p = project(t)
  p.edit('.guard/protected.yml', 'version: 1\n', 'version: 1\ncds:\n  model: [ db ]\n')
  const r = await lock(p.dir, loadConfig(p.dir), { rules: ['pricing-model'] })
  assert.match(r.problems[0].missing.join(), /@UI.LineItem not present/)
})
