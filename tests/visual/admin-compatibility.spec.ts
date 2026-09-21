import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { EMBEDDED_ADMIN_PROFILES } from '../../src/constants/admin'
import { normalizeKomariVersion, supportsEmbeddedAdmin } from '../../src/services/admin-navigation.service'
import { installKomariFixture } from './fixtures/komari'

for (const profile of EMBEDDED_ADMIN_PROFILES) {
  const version = profile.versions[0]
  const entryPath = `/${profile.directory}/index.html`

  test(`embedded admin ${version} has pinned resources and guarded modules`, () => {
    const root = resolve(import.meta.dirname, '../../public', profile.directory)
    const source = JSON.parse(readFileSync(resolve(root, 'komari-admin-source.json'), 'utf8'))
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    const compiled = readdirSync(resolve(root, 'assets')).filter(name => name.endsWith('.js')).map(name => readFileSync(resolve(root, 'assets', name), 'utf8')).join('\n')
    expect(source.commit).toBe(profile.commit)
    expect(source.compatible_komari_versions).toEqual([...profile.versions])
    expect(html).toContain(`/${profile.directory}/glass-admin.css`)
    expect(html).toContain('id="glassops-admin-entry"')
    expect(html).toContain('type="application/x-glassops-module"')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('registerSW.js')
    expect(readFileSync(resolve(root, 'admin-entry.js'), 'utf8')).toBe(readFileSync(resolve(import.meta.dirname, '../../scripts/assets/admin-entry.js'), 'utf8'))
    expect(compiled).toContain('/api/admin/upload')
    expect(compiled).not.toContain('/api/admin/theme/upload')
    if (version === '1.5.0-fix1') {
      expect(compiled).not.toContain('/api/admin/notification/traffic-report')
      expect(compiled).toContain('request_id')
      expect(compiled).toContain('/file/preview-token')
    }
  })

  test(`header selects ${version} admin even when session storage is unavailable`, async ({ page }) => {
    await installKomariFixture(page, { hideEarth: true, backendVersion: version })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { get() {
        throw new Error('storage unavailable')
      } })
    })
    await page.route(`**${entryPath}*`, route => route.fulfill({ contentType: 'text/html', body: '<title>Selected admin</title>' }))
    await page.goto('/')
    await page.getByRole('button', { name: '后台管理' }).click()
    await expect(page).toHaveURL(`${entryPath}?__komari_route=%2Fadmin`)
  })

  test(`direct ${version} entry checks backend before loading modules and restores terminal route`, async ({ page }) => {
    let releaseVersion!: () => void
    const waitForVersion = new Promise<void>((resolve) => {
      releaseVersion = resolve
    })
    await page.route('**/api/version', async (route) => {
      await waitForVersion
      await route.fulfill({ json: { data: { version: `v${version}` } } })
    })
    let moduleRequests = 0
    await page.route(`**/${profile.directory}/assets/*.js`, (route) => {
      moduleRequests++
      return route.fulfill({ contentType: 'text/javascript', body: 'document.body.dataset.adminBooted = location.pathname + location.search' })
    })
    const pendingVersion = page.waitForRequest('**/api/version')
    await page.goto(`${entryPath}?__komari_route=${encodeURIComponent('/terminal?uuid=visual')}`)
    await pendingVersion
    expect(moduleRequests).toBe(0)
    releaseVersion()
    await expect(page.locator('body')).toHaveAttribute('data-admin-booted', '/terminal?uuid=visual')
    expect(moduleRequests).toBeGreaterThan(0)
  })

  test(`direct ${version} entry rejects a different backend without booting old code`, async ({ page }) => {
    const otherVersion = version === '1.4.3' ? '1.5.0-fix1' : '1.4.3'
    await page.route('**/api/version', route => route.fulfill({ json: { data: { version: otherVersion } } }))
    await page.route('**/admin/theme_managed*', route => route.fulfill({ contentType: 'text/html', body: '<title>Official admin</title>' }))
    const modules: string[] = []
    page.on('request', (request) => {
      if (request.url().includes(`/${profile.directory}/assets/`) && request.url().endsWith('.js'))
        modules.push(request.url())
    })
    await page.goto(`${entryPath}?__komari_route=${encodeURIComponent('/admin/theme_managed?tab=theme')}`)
    await expect(page).toHaveURL('/admin/theme_managed?tab=theme')
    expect(modules).toEqual([])
  })
}

test('embedded version selection is exact and unknown releases use official admin', () => {
  expect(normalizeKomariVersion(' v1.5.0-fix1 ')).toBe('1.5.0-fix1')
  for (const version of ['1.4.3', 'v1.4.3', '1.5.0-fix1', 'v1.5.0-fix1'])
    expect(supportsEmbeddedAdmin(version)).toBe(true)
  for (const version of ['1.5.0', '1.5.0-fix2', '1.4.3-beta.1', '1.5.0-fix1-beta', '1.6.0', '', null, {}, 'unknown'])
    expect(supportsEmbeddedAdmin(version)).toBe(false)
})

for (const backendVersion of ['1.5.0', '1.5.0-fix2', 'unknown']) {
  test(`header falls back to official admin for ${backendVersion}`, async ({ page }) => {
    await installKomariFixture(page, { hideEarth: true, backendVersion })
    await page.route('**/admin', route => route.fulfill({ contentType: 'text/html', body: '<title>Official admin</title>' }))
    await page.goto('/')
    await page.getByRole('button', { name: '后台管理' }).click()
    await expect(page).toHaveURL('/admin')
  })
}

for (const failure of ['network', 'invalid-json', 'http-error', 'missing-version', 'timeout']) {
  test(`direct entry fails closed on ${failure} and ignores external return routes`, async ({ page }) => {
    await page.route('**/api/version', async (route) => {
      if (failure === 'network')
        return route.abort()
      if (failure === 'timeout')
        return
      if (failure === 'invalid-json')
        return route.fulfill({ body: '<html>proxy error</html>' })
      if (failure === 'http-error')
        return route.fulfill({ status: 503, json: { data: { version: '1.5.0-fix1' } } })
      return route.fulfill({ json: { data: {} } })
    })
    await page.route('**/admin', route => route.fulfill({ contentType: 'text/html', body: '<title>Official admin</title>' }))
    const modules: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/admin-app-1.5/assets/') && request.url().endsWith('.js'))
        modules.push(request.url())
    })
    await page.goto('/admin-app-1.5/index.html?__komari_route=https%3A%2F%2Fexample.org')
    await expect(page).toHaveURL('/admin')
    expect(modules).toEqual([])
  })
}

// The editor uses its own dark palette even when the admin is in light mode.
test('admin glass sidebar styling leaves terminal editor panels readable', async ({ page }) => {
  await page.goto('/')
  await page.setContent('<div id="root"><div class="theme-root"><div><aside style="background-color:rgb(24,24,24);color:rgb(187,187,187)">Explorer</aside></div></div></div><div role="dialog"><aside style="background-color:rgb(24,24,24);color:rgb(187,187,187)">Outline</aside></div>')
  await page.addStyleTag({ content: readFileSync(resolve(import.meta.dirname, '../../scripts/assets/glass-admin.css'), 'utf8') })
  for (const panel of await page.locator('aside').all()) {
    await expect(panel).toHaveCSS('background-color', 'rgb(24, 24, 24)')
    await expect(panel).toHaveCSS('color', 'rgb(187, 187, 187)')
  }
})
