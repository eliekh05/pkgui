#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args) {
  const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: process.env })
  child.on('error', err => {
    console.error(`[dev] failed to start ${cmd}:`, err.message)
    shutdown(1)
  })
  return child
}

const execServer = run(process.execPath, ['server.js'])
const vite = run(process.execPath, ['node_modules/vite/bin/vite.js'])

function shutdown(code = 0) {
  execServer.kill('SIGINT')
  vite.kill('SIGINT')
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

execServer.on('exit', code => {
  if (code && code !== 0) shutdown(code)
})
vite.on('exit', code => process.exit(code ?? 0))
