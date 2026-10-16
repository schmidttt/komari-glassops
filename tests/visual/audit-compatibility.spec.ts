import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

async function openAudit(page: Page, visitorAuditEnabled: boolean | null) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await installKomariFixture(page, { hideEarth: true, loggedIn: true, visitorAuditEnabled })
  const calls: string[] = []
  await page.route('**/api/rpc2', async (route) => {
    const body = route.request().postDataJSON()
    calls.push(body.method)
    if (body.method === 'admin:getLogs')
      return route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result: { logs: [], total: 0 } } })
    if (body.method === 'public:recordVisitorEvent')
      return route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result: { status: 'success' } } })
    if (body.method === 'admin:editSettings')
      return route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result: null } })
    return route.fallback()
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  const showTools = page.getByRole('button', { name: '显示高级工具' })
  if (await showTools.count())
    await showTools.click()
  await page.getByRole('button', { name: '日志：管理员操作审计日志' }).click()
  await expect(page.getByText('暂无审计日志。', { exact: true })).toBeVisible()
  return calls
}

test('removed visitor audit remains disabled while administrator logs work', async ({ page }) => {
  const calls = await openAudit(page, null)
  await expect(page.getByText('当前核心未提供访客审计能力（Komari 1.6.0 已移除）；管理员操作日志仍可查看。')).toBeVisible()
  await expect(page.getByRole('tab', { name: '访客安全' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /启用采集|暂停采集/ })).toHaveCount(0)
  expect(calls).toContain('admin:getLogs')
  expect(calls).not.toContain('public:recordVisitorEvent')
  expect(calls).not.toContain('admin:editSettings')
})

test('older backends keep the visitor audit enable switch', async ({ page }) => {
  const calls = await openAudit(page, false)
  await expect(page.getByRole('tab', { name: '访客安全' })).toBeEnabled()
  expect(calls).not.toContain('public:recordVisitorEvent')
  await page.getByRole('button', { name: '启用采集' }).click()
  await expect(page.getByRole('button', { name: '暂停采集' })).toBeVisible()
  expect(calls).toContain('admin:editSettings')
  await expect.poll(() => calls.includes('public:recordVisitorEvent')).toBe(true)
})

test('older backends keep enabled visitor event collection', async ({ page }) => {
  const calls = await openAudit(page, true)
  await expect(page.getByRole('button', { name: '暂停采集' })).toBeVisible()
  await expect.poll(() => calls.includes('public:recordVisitorEvent')).toBe(true)
  await expect(page.getByRole('tab', { name: '访客安全' })).toBeEnabled()
})
