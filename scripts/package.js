#!/usr/bin/env node
/**
 * scripts/package.js
 * Creates release artifacts:
 *   release/pkgui-{version}-bundle.html    ← single compiled file
 *   release/pkgui-{version}-dist.zip       ← full build for self-hosting
 *   release/pkgui-{version}-source.tar.gz  ← source tarball
 */

import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join } from 'path'
import archiver from 'archiver'

const version = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf8')).version
const releaseDir = resolve('release')

mkdirSync(releaseDir, { recursive: true })
console.log(`\n📦 Packaging pkgui v${version}...\n`)

async function zipDist() {
  return new Promise((res, rej) => {
    const output = createWriteStream(join(releaseDir, `pkgui-${version}-dist.zip`))
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => { console.log(`  ✅ dist.zip — ${(archive.pointer() / 1024).toFixed(0)} KB`); res() })
    archive.on('error', rej)
    archive.pipe(output)
    archive.directory('dist/', false)
    archive.finalize()
  })
}

function copyBundle() {
  const src = resolve('dist-bundle/index.html')
  const dst = join(releaseDir, `pkgui-${version}-bundle.html`)
  if (existsSync(src)) {
    const content = readFileSync(src)
    writeFileSync(dst, content)
    console.log(`  ✅ bundle.html — ${(content.length / 1024).toFixed(0)} KB`)
  } else {
    console.warn(`  ⚠️  dist-bundle/index.html not found — skipping`)
  }
}

function sourceTarball() {
  const dst = join(releaseDir, `pkgui-${version}-source.tar.gz`)
  try {
    execSync(`git archive --format=tar.gz --prefix=pkgui-${version}/ HEAD -o "${dst}"`, { stdio: 'pipe' })
    const stat = readFileSync(dst)
    console.log(`  ✅ source.tar.gz — ${(stat.length / 1024).toFixed(0)} KB`)
  } catch {
    console.warn(`  ⚠️  git archive failed — skipping`)
  }
}

async function zipStandalone() {
  const bundleSrc = join(releaseDir, `pkgui-${version}-bundle.html`)
  const serverSrc = resolve('server.js')
  if (!existsSync(bundleSrc) || !existsSync(serverSrc)) {
    console.warn('  ⚠️  bundle or server.js missing — skipping standalone.zip')
    return
  }

  const startScript = `#!/bin/sh
cd "$(dirname "$0")"
exec node server.js --open
`

  return new Promise((res, rej) => {
    const output = createWriteStream(join(releaseDir, `pkgui-${version}-standalone.zip`))
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => {
      console.log(`  ✅ standalone.zip — ${(archive.pointer() / 1024).toFixed(0)} KB`)
      res()
    })
    archive.on('error', rej)
    archive.pipe(output)
    archive.file(serverSrc, { name: 'server.js' })
    archive.file(bundleSrc, { name: 'pkgui.html' })
    archive.append(startScript, { name: 'start', mode: 0o755 })
    archive.finalize()
  })
}

async function main() {
  await zipDist()
  copyBundle()
  await zipStandalone()
  sourceTarball()
  console.log(`\n🎉 Done — artifacts in ./release/\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
