import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const build = () => execFileSync(command, ['build'], { stdio: 'inherit', shell: process.platform === 'win32' })
async function fingerprint(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const parts = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) parts.push(...await fingerprint(path, root))
    else parts.push(`${path.slice(root.length)}:${createHash('sha256').update(await readFile(path)).digest('hex')}`)
  }
  return parts.sort()
}
async function files(dir) {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else if (entry.name.endsWith('.ts')) result.push(path)
  }
  return result
}
if (!process.argv.includes('--write')) {
  execFileSync(process.execPath, ['scripts/normalize-typescript.mjs'], { stdio: 'inherit' })
} else {
  build()
  const before = JSON.stringify(await fingerprint('dist'))
  const originals = new Map(await Promise.all((await files('src')).map(async path => [path, await readFile(path)])))
  try {
    execFileSync(process.execPath, ['scripts/normalize-typescript.mjs', '--write'], { stdio: 'inherit' })
    build()
    if (JSON.stringify(await fingerprint('dist')) !== before) throw new Error('Build output changed')
    console.log('Build output matches the original.')
  } catch (error) {
    await Promise.all([...originals].map(([path, data]) => writeFile(path, data)))
    console.error('Changes restored:', error.message)
    try { build() } catch { console.error('Could not rebuild restored sources.') }
    process.exitCode = 1
  }
}
