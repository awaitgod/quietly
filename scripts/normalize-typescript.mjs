import ts from 'typescript'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const apply = process.argv.includes('--write')
const root = 'src'
let changed = 0

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await visit(path)
    else if (entry.isFile() && /\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts')) await processFile(path)
  }
}

async function processFile(path) {
  const original = await readFile(path, 'utf8')
  const source = ts.createSourceFile(path, original, ts.ScriptTarget.Latest, true)
  if (source.parseDiagnostics.length) throw new Error(`Cannot parse ${path}`)
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
  // Compiler directives and license comments can change tooling behavior; leave such files intact.
  if (/\/[/\*]\s*(?:@__PURE__|#__PURE__|@__NO_SIDE_EFFECTS__|@ts-|@vite-|@license|!|eslint|prettier|istanbul|# source)/i.test(original)) {
    console.log(`Skipped directives: ${path}`)
    return
  }
  const output = printer.printFile(source)
  if (output !== original) {
    changed++
    console.log(`${apply ? 'Writing' : 'Would change'}: ${path}`)
    if (apply) await writeFile(path, output)
  }
}

await visit(root)
console.log(`${changed} file(s); ${apply ? 'written' : 'dry run'}.`)

