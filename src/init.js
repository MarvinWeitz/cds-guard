'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { configPath } = require('./config')

const TEMPLATE = `# cds-guard configuration. Docs: https://github.com/cbs-consulting/cds-guard#configuration
version: 1

# Where the CDS model lives (cds.load runs here). Default: the repository root.
cds:
  root: .
  # model: [ db, srv, app ]   # optional: folders or files to load instead of the CAP defaults

# Who must approve changes to the guard itself (.guard/**). Use the same names as in CODEOWNERS,
# or e-mail addresses / group names for Azure DevOps.
guardOwners: []

# Further files only the guard owners may change, such as the pipeline that runs cds-guard.
guardPaths: []

rules:
  # - id: pricing-model
  #   description: Prices and order amounts
  #   cds: [ my.app.Prices, my.app.Orders.netAmount ]       # entities or entity.element
  #   annotations: [ "my.app.Orders:@UI.LineItem" ]          # target:@Term
  #   approvers: [ "@my-org/team-pricing" ]
  #
  # - id: tax-formula
  #   markers: [ tax-calc ]        # code between "@protected-begin tax-calc" and "@protected-end"
  #   markerFiles: [ "srv/**/*.js" ]
  #   approvers: [ alice ]
  #
  # - id: frozen-ui
  #   paths: [ "app/orders/webapp/annotations/*.xml" ]
  #   json:
  #     - file: app/orders/webapp/manifest.json
  #       pointers: [ /sap.app/id, /sap.ui5/routing ]
  #   approvers: [ "@my-org/leads" ]
`

function init (root, { force = false } = {}) {
  const file = configPath(root)
  if (fs.existsSync(file) && !force) return { created: false, file }
  fs.mkdirSync(path.join(path.dirname(file), 'locks'), { recursive: true })
  fs.writeFileSync(file, TEMPLATE)
  return { created: true, file }
}

module.exports = { init, TEMPLATE }
