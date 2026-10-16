import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, expect, request } from '@playwright/test'
import { EMBEDDED_ADMIN_PROFILES } from '../src/constants/admin.ts'

// This check creates a disposable local account/database; it never uses a live site.
const binary = process.argv[2]
if (!binary)
  throw new Error('Usage: node scripts/verify-komari-admin.mjs /path/to/komari [1.6.0|1.5.0-fix1|1.4.3]')
const expectedVersion = process.argv[3] || '1.6.0'
const profile = EMBEDDED_ADMIN_PROFILES.find(item => item.versions.includes(expectedVersion))
if (!profile)
  throw new Error('The requested backend has no verified admin profile')
const modern = expectedVersion === '1.6.0'
const hasWorkbench = expectedVersion !== '1.4.3'
const adminRoute = modern ? '/admin/dashboard' : '/admin'
const entry = `/${profile.directory}/index.html?__komari_route=`
const root = resolve(import.meta.dirname, '..')
const artifacts = resolve(root, 'test-results/live-admin', expectedVersion)
mkdirSync(artifacts, { recursive: true })
const temporary = mkdtempSync(resolve(tmpdir(), 'glassops-admin-test-'))
const listener = createServer()
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise(resolve => listener.close(resolve))
const baseURL = `http://127.0.0.1:${port}`
const server = spawn(resolve(binary), ['server', '--listen', `127.0.0.1:${port}`], { cwd: temporary, stdio: 'ignore' })
let browser
let page
const api = await request.newContext({ baseURL })
const checks = []
function passed(name) {
  checks.push(name)
  console.log(`PASS ${name}`)
}
async function checked(method, path, options = {}) {
  const response = await api[method](path, options)
  if (!response.ok())
    throw new Error(`${method} ${path.split('?')[0]}: HTTP ${response.status()}`)
  return response
}
async function rpc(method, params) {
  const result = await (await checked('post', '/api/rpc2', { data: { jsonrpc: '2.0', id: 1, method, params } })).json()
  if (result.error)
    throw new Error(`${method} returned RPC error ${result.error.code}`)
  return result.result
}
try {
  await expect.poll(async () => {
    try {
      return (await api.get('/api/install/status')).status()
    }
    catch { return 0 }
  }, { timeout: 20000 }).toBe(200)
  const password = `Aa1${randomBytes(24).toString('hex')}`
  await checked('post', '/api/install/complete', { data: { username: 'glassops-test', password, sitename: 'GlassOps Compatibility Lab', description: 'Isolated synthetic test', metric_dsn: 'sqlite:./data/metrics.db' } })
  await expect.poll(async () => {
    try {
      return (await api.get('/api/version')).status()
    }
    catch { return 0 }
  }, { timeout: 20000 }).toBe(200)
  await checked('post', '/api/login', { data: { username: 'glassops-test', password } })
  // Seed the disposable fixture so the first-run modal does not obscure controls.
  await checked('post', '/api/admin/settings/', { data: { eula_accepted: true } })
  const version = (await (await checked('get', '/api/version')).json()).data.version
  expect(version).toBe(expectedVersion)
  passed('isolated backend initialization and login')

  const manifest = JSON.parse(readFileSync(resolve(root, 'komari-theme.json'), 'utf8'))
  const zip = readdirSync(root)
    .filter(name => name.startsWith(`komari-glassops-v${manifest.version}-build-`) && name.endsWith('.zip'))
    .sort((a, b) => statSync(resolve(root, b)).mtimeMs - statSync(resolve(root, a)).mtimeMs)[0]
  if (!zip)
    throw new Error('Build the current theme ZIP before running this check')
  const data = readFileSync(resolve(root, zip))
  const upload = (await (await checked('post', '/api/admin/upload/init', { data: { purpose: 'theme', size: data.length, filename: zip } })).json()).data
  for (let start = 0, index = 0; start < data.length; start += upload.chunk_size, index++) {
    await checked('post', '/api/admin/upload/chunk', { multipart: { upload_id: upload.upload_id, chunk_index: String(index), chunk_data: { name: 'chunk.bin', mimeType: 'application/octet-stream', buffer: data.subarray(start, start + upload.chunk_size) } } })
  }
  await checked('post', '/api/admin/upload/merge', { data: { upload_id: upload.upload_id } })
  await checked('get', `/api/admin/theme/set?theme=${encodeURIComponent(manifest.short)}`)
  const initialSettings = {
    hideEarth: true,
    visitorInfoEnabled: false,
    themeMode: 'dark',
    dataUpdateInterval: 1,
    compatibilitySentinel: { keep: true },
    _komari_onboarding_v1: { seen: ['install', 'workbench', 'notifications', 'markets', 'terminal'], workbenchOpened: true },
  }
  await checked('post', `/api/admin/theme/settings?theme=${encodeURIComponent(manifest.short)}`, { data: initialSettings })
  passed('real chunk upload and theme activation')
  const created = await (await checked('post', '/api/admin/client/add', { data: { name: 'Synthetic validation node' } })).json()
  const uuid = created.uuid || created.data?.uuid
  if (!uuid)
    throw new Error('Synthetic node creation returned no UUID')
  await checked('post', `/api/admin/client/${uuid}/edit`, { data: { name: 'Synthetic validation node', cpu_name: 'Test CPU', cpu_cores: 2, arch: 'aarch64', os: 'Debian 12', region: 'US', mem_total: 1073741824, disk_total: 10737418240 } })
  const credentials = await (await checked('get', `/api/admin/client/${uuid}/token`)).json()
  const token = credentials.token || credentials.data?.token
  if (!token)
    throw new Error('Synthetic node token was unavailable')
  async function report(usage) {
    // Credentials stay in memory; never include this URL or response in logs.
    let response
    try {
      response = await api.post(`/api/clients/v2/rpc?token=${encodeURIComponent(token)}`, { data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'agent.report',
        params: { report: {
          cpu: { usage },
          ram: { total: 1073741824, used: 268435456 },
          swap: { total: 0, used: 0 },
          disk: { total: 10737418240, used: 1073741824 },
          load: { load1: 0.2, load5: 0.1, load15: 0.1 },
          network: { up: 1024, down: 2048, totalUp: 1048576, totalDown: 2097152 },
          connections: { tcp: 3, udp: 1 },
          uptime: 3600,
          process: 32,
          updated_at: new Date().toISOString(),
        } },
      } })
    }
    catch { throw new Error('Synthetic agent report transport failed') }
    if (!response.ok() || (await response.json()).error)
      throw new Error('Synthetic agent report was rejected')
  }
  await report(12.3)
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  const context = await browser.newContext({ baseURL, storageState: await api.storageState(), locale: 'zh-CN', viewport: { width: 1440, height: 1000 } })
  context.setDefaultTimeout(15000)
  page = await context.newPage()
  const errors = []
  const missing = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', (response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 400 && !new URL(response.url()).pathname.startsWith('/api/'))
      missing.push(`${new URL(response.url()).pathname}: ${response.status()}`)
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'GlassOps Compatibility Lab' })).toBeVisible()
  await expect(page.getByText('Synthetic validation node', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('12.3%', { exact: true }).first()).toBeVisible()
  await report(67.8)
  await expect(page.getByText('67.8%', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  passed('public theme renders real backend nodes')
  passed('synthetic v2 reports update CPU without page refresh')
  await expect.poll(async () => {
    const metrics = await rpc('public:queryMetrics', { metric_key: 'cpu.usage', entity_id: uuid, hours: 1 / 60, downsample: false })
    // Reports are persisted in batches; an empty query can return a null series.
    return metrics.series?.some(series => series.points?.some(point => point.value === 67.8)) ?? false
  }, { timeout: 15000 }).toBe(true)
  passed('real metric store returns reported CPU history')
  await page.getByRole('button', { name: '后台管理' }).click()
  await expect(page).toHaveURL(`${baseURL}${adminRoute}`)
  await expect(page.locator(`link[href*="/${profile.directory}/glass-admin.css"]`)).toHaveCount(1)
  await expect(page.locator(`script[type="module"][src*="/${profile.directory}/"]`)).toHaveCount(1)
  await expect(page.locator('body')).toContainText(/Dashboard|仪表板|仪表盘/)
  await page.screenshot({ path: resolve(artifacts, 'admin.png'), fullPage: true })
  passed('version selection and new embedded admin boot')
  await page.goto(`${entry}%2Fadmin%2Ftheme_managed`)
  await expect(page).toHaveURL(`${baseURL}/admin/theme_managed`)
  await expect(page.locator('body')).toContainText('基础与外观')
  const saved = page.waitForResponse(response => response.url().includes('/api/admin/theme/settings') && response.request().method() === 'POST')
  await page.getByRole('button', { name: /^保存$|^Save$/ }).first().click()
  expect((await saved).ok()).toBe(true)
  const settings = (await (await checked('get', '/api/public')).json()).data.theme_settings
  expect(settings.hideEarth).toBe(true)
  expect(settings.themeMode).toBe('dark')
  if (modern) {
    expect(settings.compatibilitySentinel).toEqual({ keep: true })
    expect(settings._komari_onboarding_v1).toEqual(initialSettings._komari_onboarding_v1)
  }
  await page.screenshot({ path: resolve(artifacts, 'settings.png'), fullPage: true })
  passed('managed settings UI save and backend readback')
  if (modern) {
    const publicSettings = (await (await checked('get', '/api/public')).json()).data
    expect(publicSettings).not.toHaveProperty('visitor_audit_enabled')
    const channels = await rpc('admin:listNotificationChannels')
    expect(channels.map(channel => channel.id)).toEqual(expect.arrayContaining(['webhook', 'Javascript']))
    const config = await rpc('admin:getNotificationChannelConfiguration', { id: 'webhook' })
    await rpc('admin:setNotificationChannelConfiguration', { id: 'webhook', data: config.data })
    expect((await rpc('admin:getNotificationChannelConfiguration', { id: 'webhook' })).data).toEqual(config.data)
    await page.goto(`${entry}${encodeURIComponent('/admin/notification/channels')}`)
    await expect(page).toHaveURL(`${baseURL}/admin/notification/channels`)
    await page.getByRole('button', { name: /^无$|^None$/ }).click()
    await expect(page.getByRole('menuitem', { name: /Webhook/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.screenshot({ path: resolve(artifacts, 'notifications.png'), fullPage: true })
    passed('notification channels load and configuration round-trips without sending notifications')
  }
  if (hasWorkbench) {
    await page.goto(`${entry}%2Fterminal`)
    await expect(page).toHaveURL(`${baseURL}/terminal`)
    // Nodes live inside this dropdown, not on the empty workspace itself.
    await page.getByRole('button', { name: /^打开终端$|^Open terminal$/ }).and(page.locator('[aria-haspopup="menu"]')).click()
    await expect(page.getByRole('menuitem', { name: /Synthetic validation node/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^打开工作台$|^Open workbench$/ }).and(page.locator('[aria-haspopup="menu"]')).click()
    await page.getByRole('menuitem', { name: /Synthetic validation node/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Synthetic validation node')
    for (const sidebar of await page.getByRole('dialog').locator('aside').all())
      await expect(sidebar).toHaveCSS('background-color', 'rgb(24, 24, 24)')
    await page.screenshot({ path: resolve(artifacts, 'workbench.png'), fullPage: true })
    passed('terminal node menu and lazy file workbench load')
  }
  const incompatible = EMBEDDED_ADMIN_PROFILES.find(item => item.directory !== profile.directory)
  await page.goto(`/${incompatible.directory}/index.html?__komari_route=%2Fadmin`)
  await expect(page).toHaveURL(`${baseURL}${adminRoute}`)
  await expect(page.locator('link[href*="glass-admin.css"]')).toHaveCount(0)
  await expect(page.locator('body')).toContainText(/Dashboard|仪表板|仪表盘/)
  expect(errors, 'uncaught browser errors').toEqual([])
  expect(missing, 'missing static assets').toEqual([])
  passed('legacy entry fallback; no missing assets or uncaught browser errors')
  const guest = await browser.newContext({ baseURL })
  guest.setDefaultTimeout(15000)
  const guestPage = await guest.newPage()
  await guestPage.goto('/')
  await expect(guestPage.getByText('Synthetic validation node', { exact: true }).first()).toBeVisible()
  await guestPage.goto(`${entry}%2Fadmin`)
  await expect(guestPage.locator('input[type="password"]')).toBeVisible()
  await guest.close()
  passed('public guest monitoring and protected admin login')
  console.log(JSON.stringify({ backend: version, theme: manifest.version, checks: checks.length, remoteAgentOperationsTested: false }))
}
catch (error) {
  if (page)
    await page.screenshot({ path: resolve(artifacts, 'failure.png'), fullPage: true }).catch(() => {})
  console.error(error.message)
  process.exitCode = 1
}
finally {
  await browser?.close()
  await api.dispose()
  const stopped = new Promise(resolve => server.once('exit', resolve))
  server.kill()
  await Promise.race([stopped, delay(3000)])
  if (server.exitCode === null)
    server.kill('SIGKILL')
  rmSync(temporary, { recursive: true, force: true })
}
