import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  EMBEDDED_ADMIN_COMPATIBLE_VERSIONS,
  normalizeKomariVersion,
  supportsEmbeddedAdmin,
} from '../../src/services/admin-navigation.service'
import { installKomariFixture } from './fixtures/komari'

const adminRoot = resolve(import.meta.dirname, '../../public/admin-app')

test('embedded admin is pinned to the verified Komari 1.4.3 frontend contract', () => {
  const source = JSON.parse(readFileSync(resolve(adminRoot, 'komari-admin-source.json'), 'utf8')) as {
    commit?: string
    compatible_komari_versions?: string[]
  }
  const indexHtml = readFileSync(resolve(adminRoot, 'index.html'), 'utf8')
  const compiledScripts = readdirSync(resolve(adminRoot, 'assets'))
    .filter(filename => filename.endsWith('.js'))
    .map(filename => readFileSync(resolve(adminRoot, 'assets', filename), 'utf8'))
    .join('\n')

  expect(source.commit).toBe('4a74e8a81e2e4b1c3da8ad795f9523151efb6b56')
  expect(source.compatible_komari_versions).toEqual([...EMBEDDED_ADMIN_COMPATIBLE_VERSIONS])
  expect(indexHtml).toContain('/admin-app/glass-admin.css')
  expect(indexHtml).not.toContain('glass-admin-enhancements.js')
  expect(indexHtml).not.toContain('registerSW.js')
  expect(compiledScripts).toContain('/api/admin/upload')
  expect(compiledScripts).toContain('/init')
  expect(compiledScripts).not.toContain('/api/admin/theme/upload')
})

test('embedded admin version matching is exact and fails closed', () => {
  expect(normalizeKomariVersion('1.4.3')).toBe('1.4.3')
  expect(normalizeKomariVersion('v1.4.3')).toBe('1.4.3')
  expect(supportsEmbeddedAdmin('1.4.3')).toBe(true)
  expect(supportsEmbeddedAdmin('1.4.2')).toBe(false)
  expect(supportsEmbeddedAdmin('1.4.4')).toBe(false)
  expect(supportsEmbeddedAdmin('1.4.3-beta.1')).toBe(false)
  expect(supportsEmbeddedAdmin('unknown')).toBe(false)
})

test('header opens the styled admin only on Komari 1.4.3', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, backendVersion: '1.4.3' })
  await page.route('**/admin-app/index.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Embedded admin</title>',
  }))
  await page.goto('/')

  await page.getByRole('button', { name: '后台管理' }).click()
  await expect(page).toHaveURL(/\/admin-app\/index\.html$/)
})

test('header falls back to the official admin for an unverified Komari version', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, backendVersion: '1.4.4' })
  await page.route('**/admin', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Official admin</title>',
  }))
  await page.goto('/')

  await page.getByRole('button', { name: '后台管理' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})
