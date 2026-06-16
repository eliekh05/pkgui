#!/usr/bin/env node
/**
 * Build the single-file bundle and copy it to pkgui.html for npm publish.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npx', ['vite', 'build', '--outDir', 'dist-bundle'], {
  BUNDLE_SINGLE: '1',
  NODE_ENV: 'production',
})
run('node', ['scripts/inline-bundle.js'])

const built = resolve(root, 'dist-bundle/index.html')
const out = resolve(root, 'pkgui.html')
if (!existsSync(built)) {
  console.error('dist-bundle/index.html not found after build')
  process.exit(1)
}

copyFileSync(built, out)
console.log(`✅ ${out} ready for npm publish`)
