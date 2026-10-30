#!/usr/bin/env node
// Generates the tool-specific copies of the agent harness from its single source:
//   .agents/rules/*.md       -> .cursor/rules/*.mdc (Cursor) + .claude/rules/*.md (Claude Code)
//   .agents/skills/<name>/   -> .claude/skills/<name>/ (Claude Code)
//                            -> .agents/workflows/<name>.md (Antigravity slash commands)
// Cursor and Antigravity read AGENTS.md, .agents/rules and .agents/skills natively.
//
// Usage: node scripts/harness/sync.mjs [--check]
//   --check  exit 1 if any generated file is missing, stale or edited by hand (used by pre-commit)

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MARKER = 'GERADO por scripts/harness/sync.mjs'
const RULES_SRC = '.agents/rules'
const SKILLS_SRC = '.agents/skills'
const TARGETS = {
  cursorRules: '.cursor/rules',
  claudeRules: '.claude/rules',
  claudeSkills: '.claude/skills',
  workflows: '.agents/workflows'
}

const check = process.argv.includes('--check')

const abs = (p) => join(ROOT, p)
const posix = (p) => p.split(sep).join('/')
const normalize = (text) => text.replace(/\r\n/g, '\n')
const read = (p) => normalize(readFileSync(abs(p), 'utf8'))

const banner = (source) =>
  `<!-- ${MARKER} a partir de ${source}. Não edite: altere a fonte e rode \`npm run harness:sync\`. -->`

function listFiles(dir) {
  if (!existsSync(abs(dir))) return []
  return readdirSync(abs(dir), { withFileTypes: true }).flatMap((entry) => {
    const path = posix(join(dir, entry.name))
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function listDirs(dir) {
  if (!existsSync(abs(dir))) return []
  return readdirSync(abs(dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

// Minimal YAML frontmatter reader: `key: value` lines plus folded/literal (`>` / `|`) blocks.
function parseFrontmatter(text, source) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) throw new Error(`${source}: frontmatter ausente`)
  const data = {}
  const lines = match[1].split('\n')
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value === '>' || value === '|') {
      const block = []
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim())
      value = block.join(value === '>' ? ' ' : '\n')
    }
    data[kv[1]] = value
  }
  return { data, raw: match[0], body: text.slice(match[0].length).replace(/^\n+/, '') }
}

function insertAfterFrontmatter(text, source) {
  const { raw, body } = parseFrontmatter(text, source)
  return `${raw.trimEnd()}\n\n${banner(source)}\n\n${body}`
}

/** @returns {Map<string, string>} generated path -> expected content */
function buildExpected() {
  const expected = new Map()

  for (const file of listFiles(RULES_SRC).filter((f) => f.endsWith('.md'))) {
    const name = file.slice(RULES_SRC.length + 1, -'.md'.length)
    const { data, body } = parseFrontmatter(read(file), file)
    const trigger = data.trigger ?? 'always_on'
    if (!['always_on', 'glob', 'model_decision', 'manual'].includes(trigger)) {
      throw new Error(`${file}: trigger inválido "${trigger}"`)
    }
    if (!data.description) throw new Error(`${file}: description obrigatória`)
    const globs = (data.globs ?? '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
    if (trigger === 'glob' && globs.length === 0) throw new Error(`${file}: trigger glob sem globs`)

    const cursorFm = [`description: ${data.description}`]
    if (globs.length) cursorFm.push(`globs: ${globs.join(',')}`)
    cursorFm.push(`alwaysApply: ${trigger === 'always_on'}`)
    expected.set(
      `${TARGETS.cursorRules}/${name}.mdc`,
      `---\n${cursorFm.join('\n')}\n---\n\n${banner(file)}\n\n${body}`
    )

    // Claude Code: no frontmatter = always loaded; `paths` = loaded for matching files only.
    const claudeFm = globs.length
      ? `---\npaths:\n${globs.map((g) => `  - "${g}"`).join('\n')}\n---\n\n`
      : ''
    expected.set(`${TARGETS.claudeRules}/${name}.md`, `${claudeFm}${banner(file)}\n\n${body}`)
  }

  for (const skill of listDirs(SKILLS_SRC)) {
    const skillDir = `${SKILLS_SRC}/${skill}`
    const skillFile = `${skillDir}/SKILL.md`
    if (!existsSync(abs(skillFile))) throw new Error(`${skillDir}: SKILL.md ausente`)
    const { data } = parseFrontmatter(read(skillFile), skillFile)
    if (data.name !== skill)
      throw new Error(`${skillFile}: name "${data.name}" ≠ diretório "${skill}"`)
    if (!data.description) throw new Error(`${skillFile}: description obrigatória`)

    for (const file of listFiles(skillDir)) {
      const target = `${TARGETS.claudeSkills}/${skill}/${file.slice(skillDir.length + 1)}`
      const content = file === skillFile ? insertAfterFrontmatter(read(file), file) : read(file)
      expected.set(target, content)
    }

    const summary = data.description.split(/(?<=\.)\s/)[0].slice(0, 250)
    expected.set(
      `${TARGETS.workflows}/${skill}.md`,
      `---\ndescription: ${summary}\n---\n\n${banner(skillFile)}\n\n` +
        `Siga integralmente as instruções da skill \`${skill}\` em \`${skillFile}\`.\n` +
        'Trate o texto que acompanhou o comando como entrada da skill.\n'
    )
  }

  return expected
}

// A file is ours if it carries the marker, or lives inside a .claude/skills/<name>/ whose
// SKILL.md carries it (auxiliary files are copied verbatim, without a banner).
function isGenerated(path) {
  const content = read(path)
  if (content.includes(MARKER)) return true
  const skillRoot = path.match(new RegExp(`^${TARGETS.claudeSkills}/([^/]+)/`))
  if (!skillRoot) return false
  const skillFile = `${TARGETS.claudeSkills}/${skillRoot[1]}/SKILL.md`
  return existsSync(abs(skillFile)) && read(skillFile).includes(MARKER)
}

function main() {
  const expected = buildExpected()
  const existing = Object.values(TARGETS).flatMap(listFiles)
  const stale = existing.filter((p) => !expected.has(p) && isGenerated(p))
  const conflicts = []
  const changes = []

  for (const [path, content] of expected) {
    if (!existsSync(abs(path))) {
      changes.push(['criar', path])
    } else if (read(path) !== content) {
      if (!isGenerated(path)) conflicts.push(path)
      else changes.push(['atualizar', path])
    }
  }
  for (const path of stale) changes.push(['remover', path])

  if (conflicts.length) {
    console.error(
      'Arquivos manuais ocupam caminhos gerados pelo harness (mova o conteúdo para a fonte):'
    )
    for (const path of conflicts) console.error(`  ${path}`)
    process.exit(1)
  }

  if (check) {
    if (changes.length) {
      console.error('Harness fora de sincronia com .agents/. Rode `npm run harness:sync`:')
      for (const [action, path] of changes) console.error(`  ${action}: ${path}`)
      process.exit(1)
    }
    console.log(`Harness sincronizado (${expected.size} arquivos gerados).`)
    return
  }

  for (const [action, path] of changes) {
    if (action === 'remover') {
      rmSync(abs(path))
    } else {
      mkdirSync(dirname(abs(path)), { recursive: true })
      writeFileSync(abs(path), expected.get(path))
    }
    console.log(`${action}: ${path}`)
  }
  pruneEmptyDirs(abs(TARGETS.claudeSkills))
  console.log(
    changes.length
      ? `${changes.length} alteração(ões) aplicada(s).`
      : 'Nada a fazer: harness já sincronizado.'
  )
}

function pruneEmptyDirs(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = join(dir, entry.name)
    pruneEmptyDirs(child)
    if (readdirSync(child).length === 0) {
      rmSync(child, { recursive: true })
      console.log(`remover: ${posix(relative(ROOT, child))}/`)
    }
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
