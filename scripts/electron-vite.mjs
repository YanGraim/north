import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Cursor and VS Code set this when launching Node, which makes Electron exit
// immediately instead of opening the desktop window.
delete process.env.ELECTRON_RUN_AS_NODE

const bin = join(
  dirname(fileURLToPath(import.meta.url)),
  '../node_modules/electron-vite/bin/electron-vite.js'
)
const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
