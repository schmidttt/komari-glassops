import { createHash } from 'node:crypto'
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EMBEDDED_ADMIN_PROFILES } from '../src/constants/admin.ts'

const root = resolve(import.meta.dirname, '..')
const guardPath = resolve(root, 'scripts/assets/admin-entry.js')
const guardHash = createHash('sha256').update(readFileSync(guardPath)).digest('hex').slice(0, 12)

for (const profile of EMBEDDED_ADMIN_PROFILES) {
  const directory = resolve(root, 'public', profile.directory)
  const indexPath = resolve(directory, 'index.html')
  if (!existsSync(indexPath))
    continue

  let html = readFileSync(indexPath, 'utf8')
  // Replace the old, unconditional route bridge before any app module loads.
  html = html.replace(/<script>;\(\(\)=>\{let t='';[\s\S]*?<\/script>/, '')
  html = html.replace(/<script[^>]+id="glassops-admin-entry"[^>]*><\/script>/g, '')
  html = html.replace(/<script type="module" crossorigin src="([^"]+)"[^>]*><\/script>/g, '<script type="application/x-glassops-module" data-src="$1"></script>')
  if (!html.includes('type="application/x-glassops-module"'))
    throw new Error(`No guarded entry module in ${profile.directory}`)

  const guard = `<script id="glassops-admin-entry" defer src="/${profile.directory}/admin-entry.js?v=${guardHash}" data-versions='${JSON.stringify(profile.versions)}'></script>`
  html = html.replace('</head>', `${guard}</head>`)
  writeFileSync(indexPath, html)
  cpSync(guardPath, resolve(directory, 'admin-entry.js'))
}
