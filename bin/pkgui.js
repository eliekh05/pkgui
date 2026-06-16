#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = join(root, 'server.js')
const bundle = join(root, 'pkgui.html')

const child = spawn(process.execPath, [server, bundle, '--open'], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
})

child.on('exit', code => process.exit(code ?? 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
