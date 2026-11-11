'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { loadConfig, ConfigError } = require('./config')
const { lock, TOOL_VERSION } = require('./lock')
const { check, formatText, formatJunit } = require('./check')
const codeowners = require('./codeowners')
const { init } = require('./init')
const { collectRule, newRun } = require('./collect')
const { toPosix } = require('./files')

const HELP = `cds-guard ${TOOL_VERSION}
Stops accidental changes to protected CDS entities, annotations, code blocks and files.

Usage: cds-guard <command> [options]

Commands:
  init                     Create .guard/protected.yml
  lock [--rule ID]...      Write the lock files for all rules, or the given ones
  check [--format F] [--junit FILE]
                           Compare against the lock files; exit code 1 on changes
                           F: text (default), json, junit. --junit also writes a
                           JUnit report to FILE for the pipeline's test view
  codeowners [--platform P] [--write [FILE]] [--branch B]
                           Print (or write) the approver block for P:
                           github (default), gitlab, bitbucket, azure
  list                     Show every protected item and its rule

Options:
  --root DIR               Repository root (default: current directory)
  -h, --help               Show this help
  -v, --version            Show the version

Exit codes: 0 ok, 1 protected items changed, 2 usage or configuration error.`

function parseArgs (argv) {
  const opts = { _: [], rule: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new ConfigError(`${a} needs a value`); return v }
    if (a === '-h' || a === '--help') opts.help = true
    else if (a === '-v' || a === '--version') opts.version = true
    else if (a === '--root') opts.root = next()
    else if (a === '--rule') opts.rule.push(next())
    else if (a === '--format') opts.format = next()
    else if (a === '--junit') opts.junit = next()
    else if (a === '--platform') opts.platform = next()
    else if (a === '--branch') opts.branch = next()
    else if (a === '--force') opts.force = true
    else if (a === '--write') opts.write = (argv[i + 1] && !argv[i + 1].startsWith('-')) ? argv[++i] : true
    else if (a.startsWith('-')) throw new ConfigError(`unknown option ${a}`)
    else opts._.push(a)
  }
  return opts
}

async function main (argv, io = { out: s => process.stdout.write(s + '\n'), err: s => process.stderr.write(s + '\n') }) {
  let opts
  try { opts = parseArgs(argv) } catch (e) { io.err(`cds-guard: ${e.message}`); return 2 }
  if (opts.version) { io.out(TOOL_VERSION); return 0 }
  const cmd = opts._[0]
  if (opts.help || !cmd) { io.out(HELP); return opts.help ? 0 : 2 }
  const root = path.resolve(opts.root || process.cwd())
  try {
    switch (cmd) {
      case 'init': {
        const r = init(root, { force: opts.force })
        io.out(r.created
          ? `Created ${toPosix(path.relative(root, r.file))}. Add rules, then run "cds-guard lock" and "cds-guard codeowners --write".`
          : `${toPosix(path.relative(root, r.file))} already exists (use --force to overwrite).`)
        return 0
      }
      case 'lock': {
        const config = loadConfig(root)
        const { written, problems } = await lock(root, config, { rules: opts.rule })
        for (const w of written) io.out(`locked ${w.rule}: ${w.items} item(s) -> ${w.file.split(path.sep).join('/')}`)
        for (const p of problems) {
          io.err(`cannot lock rule "${p.rule}":`)
          for (const m of p.missing) io.err(`    ${m}`)
        }
        return problems.length ? 2 : 0
      }
      case 'check': {
        const config = loadConfig(root)
        const result = await check(root, config)
        const format = opts.format || 'text'
        if (format === 'json') io.out(JSON.stringify(result, null, 2))
        else if (format === 'junit') io.out(formatJunit(result))
        else if (format === 'text') (result.ok ? io.out : io.err)(formatText(result))
        else throw new ConfigError(`unknown format "${format}"`)
        if (opts.junit) {
          const file = path.resolve(process.cwd(), opts.junit)
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, formatJunit(result))
        }
        return result.ok ? 0 : 1
      }
      case 'codeowners': {
        const config = loadConfig(root)
        const platform = opts.platform || 'github'
        if (!codeowners.PLATFORMS.includes(platform)) throw new ConfigError(`unknown platform "${platform}" (${codeowners.PLATFORMS.join(', ')})`)
        if (platform === 'azure') {
          const script = codeowners.azureScript(config, { branch: opts.branch })
          if (opts.write) {
            const file = path.resolve(root, opts.write === true ? '.guard/azure-policies.sh' : opts.write)
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, script, { mode: 0o755 })
            io.out(`wrote ${toPosix(path.relative(root, file))}`)
          } else io.out(script.trimEnd())
          return 0
        }
        const content = codeowners.block(config, platform)
        if (opts.write) {
          const file = path.resolve(root, opts.write === true ? codeowners.DEFAULT_FILE[platform] : opts.write)
          codeowners.writeBlock(file, content)
          io.out(`updated ${toPosix(path.relative(root, file))}`)
        } else io.out(content.trimEnd())
        return 0
      }
      case 'list': {
        const config = loadConfig(root)
        newRun()
        for (const rule of config.rules) {
          io.out(`${rule.id}  (approvers: ${rule.approvers.join(', ') || 'guard owners'})`)
          const items = await collectRule(rule, root, config)
          for (const [k, v] of Object.entries(items)) io.out(`    ${k}${v.missing ? `  !! ${v.missing}` : ''}`)
        }
        return 0
      }
      default:
        io.err(`cds-guard: unknown command "${cmd}". Run "cds-guard --help".`)
        return 2
    }
  } catch (e) {
    io.err(`cds-guard: ${e.message}`)
    return 2
  }
}

module.exports = { main, parseArgs }
