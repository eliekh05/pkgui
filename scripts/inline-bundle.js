#!/usr/bin/env node
/**
 * scripts/inline-bundle.js
 *
 * Post-processes dist-bundle/ to produce a truly standalone single-file HTML.
 * Inlines all <script src> and <link rel="stylesheet"> references.
 * Result: one .html file you can open directly in a browser — no server needed.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { resolve, join, extname } from 'path'

const distDir = resolve('dist-bundle')
const outDir = distDir  // overwrite in same dir

if (!existsSync(distDir)) {
  console.warn('dist-bundle/ not found. Run BUNDLE_SINGLE=1 vite build first.')
  process.exit(0)
}

let html = readFileSync(join(distDir, 'index.html'), 'utf8')

// ─── Inline CSS ───────────────────────────────────────────────────────────────
html = html.replace(
  /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
  (match, href) => {
    // Skip external (CDN) stylesheets — keep them as-is
    if (href.startsWith('http')) return match
    const filepath = join(distDir, href.replace(/^\//, ''))
    if (!existsSync(filepath)) return match
    const css = readFileSync(filepath, 'utf8')
    return `<style>${css}</style>`
  }
)

// ─── Inline JS ───────────────────────────────────────────────────────────────
html = html.replace(
  /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,
  (match, src) => {
    // Skip external scripts
    if (src.startsWith('http')) return match
    // Skip module preloads (handled by bundler)
    if (match.includes('modulepreload')) return ''
    const filepath = join(distDir, src.replace(/^\//, ''))
    if (!existsSync(filepath)) return match
    const js = readFileSync(filepath, 'utf8')
    // Preserve type="module" if present
    const isModule = /type=["']module["']/.test(match)
    return `<script${isModule ? ' type="module"' : ''}>${js}</script>`
  }
)

// ─── Remove modulepreload links ───────────────────────────────────────────────
html = html.replace(/<link[^>]+rel=["']modulepreload["'][^>]*\/?>/gi, '')

// ─── Embed xterm.css from CDN (already external, keep it) ────────────────────
// It stays as external link — acceptable for offline fallback.
// For truly offline bundles, you'd fetch and inline it here.

// ─── Add offline/standalone meta ─────────────────────────────────────────────
html = html.replace(
  '</head>',
  `  <meta name="standalone" content="true" />
  <meta name="pkgui-bundle-date" content="${new Date().toISOString()}" />
</head>`
)

writeFileSync(join(outDir, 'index.html'), html, 'utf8')
console.log(`✅ Inlined bundle written to dist-bundle/index.html (${(html.length / 1024).toFixed(1)} KB)`)
