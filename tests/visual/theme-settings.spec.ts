import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

test('theme manifest exposes a native managed settings entry', () => {
  const themeManifest = JSON.parse(readFileSync(new URL('../../komari-theme.json', import.meta.url), 'utf8'))
  expect(themeManifest.configuration.type).toBe('managed')
  expect(themeManifest.configuration.name).toBe('主题设置')
  expect(Array.isArray(themeManifest.configuration.data)).toBe(true)
  expect(themeManifest.configuration.data.filter(item => item.type === 'title')).toHaveLength(7)
  expect(themeManifest.configuration.data.filter(item => item.type !== 'title' && item.key)).toHaveLength(46)
  expect(themeManifest.configuration).not.toHaveProperty('schema')
})

test('theme settings keeps category navigation and save action visible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installKomariFixture(page, { dark: true, loggedIn: true })
  await page.goto('/?glassops-settings=1&embedded=1')

  await expect(page.getByRole('heading', { name: '主题设置' })).toBeVisible()
  await expect(page.getByRole('button', { name: '返回首页' })).toHaveCount(0)
  const navigation = page.getByRole('navigation', { name: '主题设置分类' })
  const stickyHeader = page.locator('.theme-settings-sticky')
  await expect(navigation.getByRole('button')).toHaveCount(8)
  await expect(navigation.getByRole('button', { name: '全部设置' })).toHaveClass(/is-active/)
  await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(1)
  await expect(page.locator('.settings-section').first().locator('.settings-section-card')).toHaveCount(1)
  expect((await stickyHeader.boundingBox())?.y).toBeLessThanOrEqual(1)

  await navigation.getByRole('button', { name: '首页布局' }).click()
  await expect(navigation.getByRole('button', { name: '首页布局' })).toHaveClass(/is-active/)
  const sectionHeading = page.getByRole('heading', { name: '首页布局', exact: true })
  await expect(sectionHeading).toBeInViewport()
  await expect.poll(async () => {
    const stickyBox = await stickyHeader.boundingBox()
    const headingBox = await sectionHeading.boundingBox()
    return headingBox!.y - stickyBox!.y - stickyBox!.height
  }).toBeGreaterThanOrEqual(0)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(navigation.getByRole('button', { name: '自定义背景' })).toHaveClass(/is-active/)
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible()
  expect((await stickyHeader.boundingBox())?.y).toBeLessThanOrEqual(1)
  await testInfo.attach('theme-settings-embedded-sticky.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})

test('theme settings merges values and posts the complete theme settings payload', async ({ page }) => {
  await installKomariFixture(page, { loggedIn: true })
  await page.goto('/?glassops-settings=1')

  const interval = page.locator('#setting-dataUpdateInterval')
  await expect(interval).toHaveValue('60')
  await interval.fill('5')

  const requestPromise = page.waitForRequest(request =>
    request.method() === 'POST'
    && request.url().includes('/api/admin/theme/settings?theme=GlassOps'))
  await page.getByRole('button', { name: '保存', exact: true }).click()
  const request = await requestPromise
  const payload = request.postDataJSON() as Record<string, unknown>

  expect(payload.dataUpdateInterval).toBe(5)
  expect(payload.earthRenderer).toBe('realistic')
  expect(payload.homeQuickControlsEnabled).toBe(true)
  await expect(page.getByRole('status')).toContainText('主题设置已保存并生效')
})
