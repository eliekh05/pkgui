/**
 * pkgui — Cloudflare Worker
 *
 * Serves the compiled SPA and exposes optional API routes:
 *   GET  /api/managers          — JSON list of all package managers
 *   GET  /api/managers/:id      — Single manager metadata
 *   GET  /api/detect            — Returns OS hint from User-Agent
 *   GET  /api/command           — Build a command: ?manager=apt&action=install&pkg=curl
 *   GET  /health                — Health check
 *
 * Deploy: wrangler deploy
 */

// ─── Inline manager data (subset for API; full list in managers.js) ──────────
// In production this is bundled from src/managers.js via build:worker script.
// For standalone worker mode we duplicate the minimal set needed for the API.

import { PACKAGE_MANAGERS, detectOS as detectOSServer } from '../src/managers.js'

// ─── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function notFound(msg = 'Not found') {
  return json({ error: msg }, 404)
}

// ─── OS Detection from User-Agent ────────────────────────────────────────────
function detectOSFromUA(ua) {
  if (!ua) return 'unknown'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'linux'
  if (/FreeBSD|OpenBSD|NetBSD/i.test(ua)) return 'bsd'
  return 'cross'
}

// ─── Router ──────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // ── API routes ────────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
      return handleAPI(request, url, pathname)
    }

    // ── Health check ─────────────────────────────────────────────────────────
    if (pathname === '/health') {
      return json({ status: 'ok', version: '1.0.0', managers: PACKAGE_MANAGERS.length })
    }

    // ── Static assets (served from KV or __STATIC_CONTENT) ───────────────────
    // When deployed with `wrangler pages deploy dist/` or with static assets binding,
    // the worker falls through to the static asset handler.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    // Fallback: return minimal HTML shell for development
    return new Response(FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  },
}

// ─── API Handler ─────────────────────────────────────────────────────────────
function handleAPI(request, url, pathname) {
  const ua = request.headers.get('user-agent') || ''
  const segments = pathname.replace('/api/', '').split('/')

  // GET /api/managers
  if (segments[0] === 'managers' && !segments[1]) {
    const os = url.searchParams.get('os')
    let managers = PACKAGE_MANAGERS

    if (os) {
      managers = managers.filter((m) => m.os.includes(os))
    }

    // Strip command functions for JSON (they aren't serializable)
    const safe = managers.map(serializeManager)
    return json({ count: safe.length, managers: safe })
  }

  // GET /api/managers/:id
  if (segments[0] === 'managers' && segments[1]) {
    const id = segments[1]
    const manager = PACKAGE_MANAGERS.find((m) => m.id === id)
    if (!manager) return notFound(`Manager '${id}' not found`)
    return json(serializeManager(manager))
  }

  // GET /api/detect
  if (segments[0] === 'detect') {
    const os = detectOSFromUA(ua)
    const managers = PACKAGE_MANAGERS.filter((m) => m.os.includes(os)).map((m) => m.id)
    return json({ os, ua: ua.slice(0, 120), recommended: managers.slice(0, 6) })
  }

  // GET /api/command?manager=apt&action=install&pkg=curl
  if (segments[0] === 'command') {
    const managerId = url.searchParams.get('manager')
    const action = url.searchParams.get('action')
    const pkg = url.searchParams.get('pkg') || ''

    if (!managerId || !action) {
      return json({ error: 'Required: ?manager=<id>&action=<action>&pkg=<name>' }, 400)
    }

    const manager = PACKAGE_MANAGERS.find((m) => m.id === managerId)
    if (!manager) return notFound(`Manager '${managerId}' not found`)

    const cmdFn = manager.commands[action]
    if (!cmdFn) {
      return json({ error: `Manager '${managerId}' doesn't support action '${action}'` }, 400)
    }

    const cmd = cmdFn(pkg)
    return json({
      manager: managerId,
      action,
      pkg,
      command: cmd,
      lines: cmd.split('\n'),
    })
  }

  // GET /api/compare?pkg=curl
  if (segments[0] === 'compare') {
    const pkg = url.searchParams.get('pkg') || 'curl'
    const results = PACKAGE_MANAGERS.filter((m) => m.commands.install).map((m) => ({
      id: m.id,
      name: m.name,
      icon: m.icon,
      command: m.commands.install(pkg),
    }))
    return json({ pkg, results })
  }

  return notFound('Unknown API endpoint')
}

// ─── Serialize manager (remove functions) ─────────────────────────────────────
function serializeManager(m) {
  return {
    id: m.id,
    name: m.name,
    fullName: m.fullName,
    os: m.os,
    distros: m.distros,
    icon: m.icon,
    color: m.color,
    homepage: m.homepage,
    supportedActions: Object.keys(m.commands),
  }
}

// ─── Fallback HTML (dev/preview only) ────────────────────────────────────────
const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>pkgui</title>
<style>
  body{font-family:monospace;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .box{text-align:center;padding:40px}
  h1{color:#58a6ff;font-size:2rem}
  p{color:#8b949e}
  a{color:#3fb950}
</style>
</head>
<body>
<div class="box">
  <h1>📦 pkgui</h1>
  <p>Worker is running. Static assets not bound yet.</p>
  <p>Run <code style="color:#f0883e">npm run build</code> then <code style="color:#f0883e">wrangler pages deploy dist/</code></p>
  <p>API: <a href="/api/managers">/api/managers</a> · <a href="/health">/health</a></p>
</div>
</body>
</html>`
