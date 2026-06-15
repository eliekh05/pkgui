#!/usr/bin/env node
/**
 * pkgui — Local Execution Server
 * Listens on http://127.0.0.1:7274 (localhost only, never exposed to network)
 *
 * Routes:
 *   GET  /health              — liveness check
 *   POST /exec                — spawn a command → { id, cmd }
 *   GET  /exec/:id/stream     — SSE: stdout / stderr / exit events
 *   POST /exec/:id/stdin      — pipe text into the running process
 *   POST /exec/:id/kill       — send SIGINT to the process
 *
 * Start: node server.js
 */

import { createServer }  from 'node:http'
import { spawn }         from 'node:child_process'
import { randomUUID }    from 'node:crypto'

const PORT   = 7274
const HOST   = 'https://pkgui.eliekh05.workers.dev'
const ORIGIN = 'https://pkgui.eliekh05.workers.dev:5173'

// id → { cmd, proc, sseClients: Set<res> }
const sessions = new Map()

// ── Helpers ───────────────────────────────────────────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function jsonRes(res, data, status = 200) {
  setCORS(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => (raw += c))
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function broadcast(session, type, data) {
  const line = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of session.sseClients) client.write(line)
}

// ── Request router ────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  setCORS(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const { pathname } = new URL(req.url, `http://${HOST}`)
  const parts = pathname.split('/').filter(Boolean) // e.g. ['exec','<id>','stream']

  try {

    // ── GET /health ────────────────────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/health') {
      return jsonRes(res, { ok: true, sessions: sessions.size })
    }

    // ── POST /exec ─────────────────────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/exec') {
      const { cmd, cwd } = await readBody(req)
      if (!cmd || typeof cmd !== 'string') {
        return jsonRes(res, { error: 'cmd (string) required' }, 400)
      }

      const id  = randomUUID()
      const env = {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        COLORTERM: 'truecolor',
      }

      const proc = spawn('sh', ['-c', cmd], {
        cwd: cwd || process.env.HOME || '/',
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const session = { cmd, proc, sseClients: new Set() }
      sessions.set(id, session)

      proc.stdout.on('data', d => broadcast(session, 'stdout', { text: d.toString() }))
      proc.stderr.on('data', d => broadcast(session, 'stderr', { text: d.toString() }))

      proc.on('close', code => {
        broadcast(session, 'exit', { code: code ?? -1 })
        // Let clients drain, then clean up
        setTimeout(() => {
          for (const c of session.sseClients) c.end()
          sessions.delete(id)
        }, 800)
      })

      proc.on('error', err => {
        broadcast(session, 'error', { message: err.message })
        sessions.delete(id)
      })

      log(id, 'start', cmd)
      return jsonRes(res, { id, cmd })
    }

    // ── GET /exec/:id/stream ───────────────────────────────────────────────────
    if (req.method === 'GET' && parts[0] === 'exec' && parts[2] === 'stream') {
      const session = sessions.get(parts[1])
      if (!session) return jsonRes(res, { error: 'Session not found' }, 404)

      setCORS(res)
      res.writeHead(200, {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',       // disable nginx buffering if proxied
      })
      res.write(':\n\n')                  // initial flush / comment ping

      session.sseClients.add(res)
      req.on('close', () => session.sseClients.delete(res))
      return                              // keep alive — do NOT end
    }

    // ── POST /exec/:id/stdin ───────────────────────────────────────────────────
    if (req.method === 'POST' && parts[0] === 'exec' && parts[2] === 'stdin') {
      const session = sessions.get(parts[1])
      if (!session) return jsonRes(res, { error: 'Session not found' }, 404)

      const { text } = await readBody(req)
      if (text && session.proc.stdin?.writable) {
        session.proc.stdin.write(text)
      }
      return jsonRes(res, { ok: true })
    }

    // ── POST /exec/:id/kill ────────────────────────────────────────────────────
    if (req.method === 'POST' && parts[0] === 'exec' && parts[2] === 'kill') {
      const session = sessions.get(parts[1])
      if (session?.proc) {
        session.proc.kill('SIGINT')
        log(parts[1], 'kill', session.cmd)
      }
      return jsonRes(res, { ok: true })
    }

    jsonRes(res, { error: 'Not found' }, 404)

  } catch (err) {
    console.error(err)
    jsonRes(res, { error: err.message }, 500)
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`\x1b[32m✓\x1b[0m \x1b[1mpkgui exec server\x1b[0m  →  http://${HOST}:${PORT}`)
  console.log(`  \x1b[2mListening on localhost only · Ctrl+C to stop\x1b[0m\n`)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n\x1b[33m⚡ Shutting down — killing active sessions…\x1b[0m')
  for (const { proc } of sessions.values()) proc?.kill()
  process.exit(0)
})

function log(id, action, cmd) {
  const short = id.slice(0, 8)
  const ts    = new Date().toTimeString().slice(0, 8)
  console.log(`  \x1b[2m${ts}\x1b[0m  \x1b[36m[${short}]\x1b[0m  ${action}  \x1b[2m${cmd.slice(0, 80)}\x1b[0m`)
}
