import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { getQueryMetricsRequestKey } from '../../src/services/metrics.service'
import { installKomariFixture } from './fixtures/komari'

const losAngeles = '主控-洛杉矶'
const tokyo = '东京-高负载'
const initialNodeId = '00000000-0000-4000-8000-000000000001'
const tokyoId = '00000000-0000-4000-8000-000000000003'

async function openComparison(page: Page, nodes = [losAngeles, tokyo]) {
  await page.goto('/')
  await page.getByRole('button', { name: '节点对比', exact: true }).click()
  for (const name of nodes)
    await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('tab', { name: '线路对比' }).click()
  return page.getByRole('region', { name: '线路历史对比' })
}

test('guest comparison uses one common task and the same explicit time window for all nodes', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, dark: true, backendVersion: '1.6.2', metricRangeAware: true })
  const calls: { method: string, params: Record<string, unknown> }[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/rpc2') && request.method() === 'POST')
      calls.push(request.postDataJSON())
  })
  const panel = await openComparison(page)
  await expect(panel.getByRole('heading', { name: '丢包时间分布' })).toBeVisible()
  await expect(panel.getByLabel('共同探测任务')).toHaveValue('1')
  await expect(panel.getByRole('heading', { name: tokyo, exact: true })).toBeVisible()
  const requests = calls.filter(call => Array.isArray(call.params?.entity_ids) && typeof call.params?.start === 'string')
  const chart = requests.find(call => call.method === 'public:queryMetrics')
  const stats = requests.find(call => call.method === 'public:getPingMetricStats')
  expect(chart?.params).toMatchObject({ entity_ids: [initialNodeId, tokyoId], tags: { task_id: '1' }, fill_empty: true })
  expect(stats?.params).toMatchObject({ entity_ids: [initialNodeId, tokyoId], task_id: '1', start: chart?.params.start, end: chart?.params.end })
  await expect(panel.getByText('48 / 48', { exact: true })).toHaveCount(2)
  await panel.screenshot({ path: test.info().outputPath('network-comparison-desktop.png') })

  await panel.getByLabel('共同探测任务').selectOption('3')
  await panel.getByRole('button', { name: '近 1 小时' }).click()
  await expect.poll(() => calls.some(call => call.method === 'public:getPingMetricStats'
    && call.params?.task_id === '3'
    && Date.parse(String(call.params.end)) - Date.parse(String(call.params.start)) === 3_600_000)).toBe(true)

  await page.getByRole('tab', { name: '实时快照' }).click()
  await expect(page.getByRole('tabpanel', { name: '实时快照' }).getByText('CPU 型号')).toBeVisible()
})

test('four nodes and custom dates fit the mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installKomariFixture(page, { hideEarth: true, dark: true, backendVersion: '1.6.2', metricRangeAware: true })
  const panel = await openComparison(page, [losAngeles, tokyo, '新加坡-A100', '法兰克福-2680'])
  await expect(panel.getByRole('heading', { name: '丢包时间分布' })).toBeVisible()
  await expect(panel.getByRole('list', { name: '节点图例' }).getByRole('listitem')).toHaveCount(4)
  await panel.getByRole('button', { name: '自定义' }).click()
  await panel.getByLabel('开始时间').fill('2026-07-25T14:00')
  await panel.getByLabel('结束时间').fill('2026-07-25T17:00')
  await panel.getByRole('button', { name: '应用时段' }).click()
  await expect(panel.getByText('7/25 14:00 – 7/25 17:00')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await expect(panel).toHaveCSS('min-width', '0px')
  await panel.screenshot({ path: test.info().outputPath('network-comparison-mobile.png') })
})

test('old Ping records backfill history when Metric methods are unavailable', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, backendVersion: '1.4.3' })
  await page.route('**/api/rpc2**', async (route) => {
    const call = route.request().postDataJSON()
    if (call.method !== 'public:queryMetrics' && call.method !== 'public:getPingMetricStats')
      return route.fallback()
    return route.fulfill({ json: { jsonrpc: '2.0', id: call.id, error: { code: -32601, message: 'Method not found' } } })
  })
  const panel = await openComparison(page)
  await expect(panel.getByRole('heading', { name: '丢包时间分布' })).toBeVisible()
  await expect(panel.getByText(/45 \/ 48/, { exact: true })).toHaveCount(2)
  await expect(panel.getByRole('button', { name: /无样本/ }).first()).toBeVisible()
  await expect(panel.getByRole('button', { name: /[1-9]\d*\.\d+% 丢包/ }).first()).toBeVisible()
})

test('no common task gives a clear empty state', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true })
  await page.route('**/api/rpc2**', async (route) => {
    const call = route.request().postDataJSON()
    if (call.method !== 'public:getPublicPingTasks')
      return route.fallback()
    await route.fulfill({ json: {
      jsonrpc: '2.0',
      id: call.id,
      result: [{ id: 1, name: 'Only Los Angeles', clients: [initialNodeId], interval: 60 }],
    } })
  })
  const panel = await openComparison(page)
  await expect(panel.getByText(/没有共同的探测任务/)).toBeVisible()
})

test('latest Ping status reports the final loss rather than the previous successful latency', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, backendVersion: '1.6.2' })
  await page.route('**/api/rpc2**', async (route) => {
    const call = route.request().postDataJSON()
    if (call.method !== 'public:queryMetrics' || !call.params?.metric_keys?.includes('ping.loss'))
      return route.fallback()
    const time = '2026-07-25T11:59:00Z'
    const earlier = '2026-07-25T11:58:00Z'
    const attributes = { entity_id: initialNodeId, tags: { task_id: '1' }, downsampled: false, count: 2 }
    await route.fulfill({ json: {
      jsonrpc: '2.0',
      id: call.id,
      result: { series: [
        { ...attributes, metric_key: 'ping.latency_ms', points: [{ time: earlier, value: 48 }, { time, value: null }] },
        { ...attributes, metric_key: 'ping.loss', points: [{ time: earlier, value: 0 }, { time, value: 1 }] },
      ] },
    } })
  })
  await page.goto(`/instance/${initialNodeId}`)
  await page.getByRole('tab', { name: '延迟', exact: true }).click()
  const task = page.locator('[data-ping-task-id="1"]')
  await expect(task.getByText('丢包', { exact: true })).toBeVisible()
  await task.getByRole('button', { name: /任务详细统计/ }).hover()
  await expect(page.getByText(/48 ms ·/)).toBeVisible()
})

test('resource and quota sorting place missing or unlimited values last', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, viewMode: 'list', firstNodeTrafficLimit: 0 })
  await page.goto('/')
  const rows = page.getByRole('button', { name: /查看节点 .* 详情/ })
  const quota = page.getByRole('button', { name: /按流量配额使用率排序/ })
  await quota.click()
  await expect(quota).toHaveAttribute('aria-pressed', 'true')
  await expect(rows.first()).toHaveAttribute('aria-label', /台北-流量预警/)
  await quota.click()
  await expect(quota).toHaveAccessibleName(/升序/)
  await page.getByRole('button', { name: /按CPU排序/ }).click()
  await expect(page.getByRole('button', { name: /按CPU排序（降序）/ })).toBeVisible()
})

test('aggregation cache keys distinguish average from per-metric peak requests', () => {
  expect(getQueryMetricsRequestKey({ metric_keys: ['net.in.rate'], aggregation: 'avg' })).not.toBe(
    getQueryMetricsRequestKey({ metric_keys: ['net.in.rate'], aggregation: 'avg', aggregation_by_metric: { 'net.in.rate': 'max' } }),
  )
})
