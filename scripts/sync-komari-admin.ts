import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { EMBEDDED_ADMIN_PROFILES } from '../src/constants/admin.ts'

const projectRoot = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(process.argv[2] || process.env.KOMARI_WEB_DIR || resolve(projectRoot, '..', 'komari-web'))
const sourceDist = resolve(sourceRoot, 'dist')
const profile = EMBEDDED_ADMIN_PROFILES.find(profile => profile.versions.includes((process.argv[3] || '1.5.0-fix1')))
if (!profile)
  throw new Error('No verified admin profile for the requested version')
const assetBase = `/${profile.directory}/`
const targetDir = resolve(projectRoot, 'public', profile.directory)
const overrideCss = resolve(projectRoot, 'scripts', 'assets', 'glass-admin.css')
const charsetMarker = '<meta charset="UTF-8" />'
const pwaRegisterPattern = /<script[^>]+id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g
const workboxFilenamePattern = /^workbox-[\w-]+\.js$/
const runtimeAssetPathRewrites = [
  ['/assets/flags/', `${assetBase}assets/flags/`],
  ['/assets/logo/', `${assetBase}assets/logo/`],
] as const
const runtimeAssetReferencePattern = /assets\/(?:flags|logo)\//g
const adminCssVersion = createHash('sha256').update(readFileSync(overrideCss)).digest('hex').slice(0, 12)
const compatibleKomariVersions = profile.versions
const skipBuild = process.env.KOMARI_WEB_SKIP_BUILD === '1'

function rewriteRuntimeAssetPaths(directory: string): number {
  let replacements = 0

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      replacements += rewriteRuntimeAssetPaths(entryPath)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.js'))
      continue

    const source = readFileSync(entryPath, 'utf8')
    let rewritten = source
    let fileReplacements = 0

    for (const [runtimePath, embeddedPath] of runtimeAssetPathRewrites) {
      const occurrences = rewritten.split(runtimePath).length - 1
      rewritten = rewritten.replaceAll(runtimePath, embeddedPath)
      fileReplacements += occurrences
    }

    if (fileReplacements === 0)
      continue

    writeFileSync(entryPath, rewritten)
    replacements += fileReplacements
  }

  return replacements
}

function countRuntimeAssetReferences(directory: string): number {
  let references = 0

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      references += countRuntimeAssetReferences(entryPath)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.js'))
      continue

    references += readFileSync(entryPath, 'utf8').match(runtimeAssetReferencePattern)?.length ?? 0
  }

  return references
}

if (!existsSync(resolve(sourceRoot, 'package.json')))
  throw new Error(`komari-web source not found: ${sourceRoot}`)

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
if (commit !== profile.commit)
  throw new Error(`Expected verified komari-web commit ${profile.commit}, received ${commit}`)

if (!skipBuild) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npmCommand, ['run', 'build', '--', `--base=${assetBase}`], {
    cwd: sourceRoot,
    stdio: 'inherit',
  })
}

if (!existsSync(resolve(sourceDist, 'index.html')))
  throw new Error(`komari-web dist not found: ${sourceDist}`)

rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDist, targetDir, { recursive: true })

const rewrittenRuntimeAssetPaths = rewriteRuntimeAssetPaths(targetDir)
const runtimeAssetReferences = countRuntimeAssetReferences(targetDir)
if (runtimeAssetReferences === 0)
  throw new Error('komari-web build output no longer contains runtime flag or OS logo asset references')

const indexPath = resolve(targetDir, 'index.html')
let html = readFileSync(indexPath, 'utf8')
if (!html.includes(charsetMarker))
  throw new Error('komari-web index.html no longer contains the expected charset marker')

const bridge = `<link rel="stylesheet" href="${assetBase}glass-admin.css?v=${adminCssVersion}">`
html = html.replace(charsetMarker, `${charsetMarker}${bridge}`)

// The official PWA only controls /admin-app/, while the bridge restores /admin and
// /terminal before React boots. Keeping that worker adds stale-cache risk without
// providing working offline navigation for the real routes.
html = html.replace(pwaRegisterPattern, '')
for (const filename of ['registerSW.js', 'sw.js'])
  rmSync(resolve(targetDir, filename), { force: true })
for (const filename of readdirSync(targetDir).filter(filename => workboxFilenamePattern.test(filename)))
  rmSync(resolve(targetDir, filename), { force: true })

if (
  !html.includes(`${assetBase}glass-admin.css?v=${adminCssVersion}`)
  || !html.includes(`${assetBase}assets/`)
) {
  throw new Error('komari-web build output is missing the admin bridge stylesheet or /admin-app/ asset base')
}

writeFileSync(indexPath, `${html.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()}\n`)
cpSync(overrideCss, resolve(targetDir, 'glass-admin.css'))

const compiledScripts = readdirSync(resolve(targetDir, 'assets'))
  .filter(filename => filename.endsWith('.js'))
  .map(filename => readFileSync(resolve(targetDir, 'assets', filename), 'utf8'))
  .join('\n')
if (!compiledScripts.includes('/api/admin/upload') || !compiledScripts.includes('/init'))
  throw new Error('komari-web build does not contain the Komari 1.4.3 chunk upload contract')
if (profile.directory === 'admin-app-1.5' && compiledScripts.includes('/api/admin/notification/traffic-report'))
  throw new Error('komari-web build still contains removed traffic-report endpoints')
if (compiledScripts.includes('/api/admin/theme/upload'))
  throw new Error('komari-web build still contains the removed legacy theme upload endpoint')

writeFileSync(resolve(targetDir, 'komari-admin-source.json'), `${JSON.stringify({
  repository: 'https://github.com/komari-monitor/komari-web',
  commit,
  compatible_komari_versions: compatibleKomariVersions,
  synced_at: new Date().toISOString(),
}, null, 2)}\n`)

await import('./guard-komari-admin.ts')

console.log(`[sync-komari-admin] Synced complete admin app from ${sourceRoot} (${runtimeAssetReferences} runtime asset paths found, ${rewrittenRuntimeAssetPaths} rewritten)`)
