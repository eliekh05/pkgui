#!/usr/bin/env node
/**
 * scripts/package.js
 * Packages build artifacts for GitHub Release.
 *
 * Produces:
 *   release/pkgui-{version}-bundle.html   ← single-file, no server needed
 *   release/pkgui-{version}-dist.zip      ← full dist for self-hosting / CF Pages
 *   release/pkgui-{version}-worker.js     ← Cloudflare Worker script
 *   release/pkgui-{version}-source.tar.gz ← source tarball
 */

import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join } from 'path'
import archiver from 'archiver'

const version = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf8')).version
const releaseDir = resolve('release')

// Ensure release directory exists before any operations
mkdirSync(releaseDir, { recursive: true })

// Validate version
if (!version || version.includes('/')) {
  console.error(`❌ Invalid version: "${version}"`)
  console.error('   Ensure tag is in format: v1.0.0, v1.2.3, etc.')
  process.exit(1)
}

console.log(`\n📦 Packaging pkgui v${version}...\n`)

// ─── 1. Zip the dist/ folder ──────────────────────────────────────────────────
async function zipDist() {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(join(releaseDir, `pkgui-${version}-dist.zip`))
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`  ✅ dist.zip — ${(archive.pointer() / 1024).toFixed(0)} KB`)
      resolve()
    })
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory('dist/', false)
    archive.finalize()
  })
}

// ─── 2. Copy worker.js ───────────────────────────────────────────────────────
function copyWorker() {
  const src = resolve('dist/worker.js')
  const dst = join(releaseDir, `pkgui-${version}-worker.js`)
  if (existsSync(src)) {
    const content = readFileSync(src)
    writeFileSync(dst, content)
    console.log(`  ✅ worker.js — ${(content.length / 1024).toFixed(0)} KB`)
  } else {
    console.warn(`  ⚠️  dist/worker.js not found — skipping`)
  }
}

// ─── 3. Copy single-file bundle ──────────────────────────────────────────────
function copyBundle() {
  const src = resolve('dist-bundle/index.html')
  const dst = join(releaseDir, `pkgui-${version}-bundle.html`)
  if (existsSync(src)) {
    const content = readFileSync(src)
    writeFileSync(dst, content)
    console.log(`  ✅ bundle.html — ${(content.length / 1024).toFixed(0)} KB`)
  } else {
    // Fallback: copy whatever is in dist/index.html
    const fallback = resolve('dist/index.html')
    if (existsSync(fallback)) {
      const content = readFileSync(fallback)
      writeFileSync(dst, content)
      console.log(`  ✅ bundle.html (fallback) — ${(content.length / 1024).toFixed(0)} KB`)
    } else {
      console.warn(`  ⚠️  No bundle HTML found — skipping`)
    }
  }
}

// ─── 4. Source tarball ───────────────────────────────────────────────────────
function sourceTarball() {
  const dst = join(releaseDir, `pkgui-${version}-source.tar.gz`)
  try {
    execSync(
      `git archive --format=tar.gz --prefix=pkgui-${version}/ HEAD -o "${dst}"`,
      { stdio: 'pipe' }
    )
    const stat = readFileSync(dst)
    console.log(`  ✅ source.tar.gz — ${(stat.length / 1024).toFixed(0)} KB`)
  } catch (e) {
    console.warn(`  ⚠️  git archive failed (not a git repo?) — skipping`)
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  await zipDist()
  copyWorker()
  copyBundle()
  sourceTarball()

  console.log(`\n🎉 Release artifacts in ./release/\n`)
  console.log(`Files:`)
  try {
    const files = execSync(`ls -lh ${releaseDir}`, { encoding: 'utf8' })
    console.log(files)
  } catch {}
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
