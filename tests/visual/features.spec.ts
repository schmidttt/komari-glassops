import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { calculateRemainingValueCNY, DEFAULT_EXCHANGE_RATES } from '../../src/utils/financeHelper'
import { formatPriceWithCycle, getRemainingValue, isFreeNode } from '../../src/utils/tagHelper'
import { installKomariFixture } from './fixtures/komari'

async function openFixture(page: Page, path = '/'): Promise<void> {
  await installKomariFixture(page, { hideEarth: true })
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
}

test('favorite nodes persist and filter the home list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openFixture(page)

  const favoriteButton = page.getByRole('button', { name: '收藏 主控-洛杉矶', exact: true })
  await expect(favoriteButton).toHaveCount(1)
  await favoriteButton.click()
  await expect(page.getByRole('button', { name: '取消收藏 主控-洛杉矶', exact: true })).toBeVisible()

  const favoriteFilter = page.getByRole('button', { name: '切换到收藏节点，1 台' })
  await expect(favoriteFilter).toHaveCount(1)
  await favoriteFilter.click()
  await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: '查看节点 东京-高负载 详情', exact: true })).toHaveCount(0)
})

test('enhanced node search supports IPv4 wildcard and CPU model', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openFixture(page)

  const search = page.getByPlaceholder('搜索名称、地区、IP、CPU')
  await search.fill('192.0.2.10')
  await expect(page.getByText('主控-洛杉矶', { exact: true })).toBeVisible()
  await expect(page.getByText('东京-高负载', { exact: true })).toBeHidden()

  await search.fill('EPYC 7B13')
  await expect(page.getByText('东京-高负载', { exact: true })).toBeVisible()
  await expect(page.getByText('主控-洛杉矶', { exact: true })).toBeHidden()
})

test('mini card summary uses the first configured Ping task', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'mini',
    homePingTaskSelections: {
      '00000000-0000-4000-8000-000000000001': [3, 1, 2],
    },
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const firstCard = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
  const summary = firstCard.getByRole('group', { name: '节点延迟与丢包摘要' })
  const miniPingTask = summary.locator('[data-mini-ping-task]')
  await expect(miniPingTask).toContainText('TCPing: Google')
  await expect(miniPingTask).not.toContainText('测试节点')
  await expect(miniPingTask.locator('[data-node-metric="ping"]')).toBeVisible()
  await expect(summary).toContainText('47 ms')
  await expect(summary).toContainText('0.0%')
})

test('light node cards keep visible section dividers and a green online state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installKomariFixture(page, {
    dark: false,
    hideEarth: true,
    nodeCardSize: 'compact',
  })
  await page.goto('/')

  const firstCard = page.locator('.node-card').first()
  await expect(firstCard.locator('.node-card-section-divider')).toHaveCount(3)
  await expect(firstCard.locator('[data-node-online-status]')).toContainText('在线')
  await expect(firstCard.locator('[data-node-online-status]')).toHaveClass(/text-emerald-700/)

  const dividerColor = await firstCard.locator('.node-card-section-divider').first().evaluate((element) => {
    return getComputedStyle(element).borderTopColor
  })
  expect(dividerColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(dividerColor).not.toBe('transparent')
})

for (const cardSize of ['mini', 'compact', 'comfortable', 'large'] as const) {
  test(`${cardSize} card exposes all custom node tags from the title icon`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await installKomariFixture(page, {
      dark: cardSize === 'mini' || cardSize === 'large',
      hideEarth: true,
      nodeCardSize: cardSize,
      nodeCustomTagsVisible: true,
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

    const firstCard = page.locator('.node-card').first()
    const tagTrigger = firstCard.locator('[data-node-tag-trigger]')
    await expect(tagTrigger).toHaveCount(1)
    await expect(tagTrigger).toHaveAttribute('aria-label', /查看主控-洛杉矶 的自定义标签（2 个）/)
    await expect(firstCard.locator('[data-node-tag-chip]')).toHaveCount(0)

    const titleOrder = await firstCard.locator('.node-card-title').evaluate((title) => {
      const trigger = title.parentElement?.querySelector<HTMLElement>('[data-node-tag-trigger]')
      const triggerWrapper = trigger?.closest<HTMLElement>('[data-slot="data-tooltip"]')
      if (!triggerWrapper || triggerWrapper.parentElement !== title.parentElement)
        return false
      return Boolean(title.compareDocumentPosition(triggerWrapper) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(titleOrder).toBe(true)

    await tagTrigger.hover()
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible({ timeout: 500 })
    const tagChips = tooltip.locator('[data-node-tag-chip]')
    await expect(tagChips).toHaveCount(2)
    await expect(tagChips.nth(0)).toContainText('核心节点')
    await expect(tagChips.nth(1)).toContainText('视觉回归长标签')
    await expect(tagChips.nth(0)).toHaveAttribute('data-tag-tone', '0')
    await expect(tagChips.nth(1)).toHaveAttribute('data-tag-tone', '1')
    const chipColors = await tagChips.evaluateAll(elements => elements.map((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color }
    }))
    for (const chipColor of chipColors) {
      expect(chipColor.background).not.toBe('transparent')
      expect(chipColor.background).not.toBe('rgba(0, 0, 0, 0)')
      expect(chipColor.color).not.toBe('rgba(0, 0, 0, 0)')
    }
    expect(chipColors[0].background).not.toBe(chipColors[1].background)

    const placement = await tooltip.getAttribute('data-placement')
    expect(placement).toBe('top')
    const geometry = await Promise.all([firstCard.boundingBox(), tooltip.boundingBox()])
    const [cardBounds, tooltipBounds] = geometry
    expect(cardBounds).not.toBeNull()
    expect(tooltipBounds).not.toBeNull()
    if (cardBounds && tooltipBounds) {
      expect(tooltipBounds.width).toBeLessThanOrEqual(cardBounds.width + 1)
      expect(tooltipBounds.x).toBeGreaterThanOrEqual(cardBounds.x - 1)
      expect(tooltipBounds.x + tooltipBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width + 1)
      expect(tooltipBounds.y + tooltipBounds.height).toBeLessThanOrEqual(cardBounds.y - 6)
    }

    if (cardSize === 'compact') {
      await testInfo.attach('compact-card-tag-tooltip.png', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    }
  })
}

test('custom node tag tooltip follows the responsive card boundary', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'mini',
    nodeCustomTagsVisible: true,
    firstNodeTags: '搬瓦工三网优化<red>',
  })
  await page.goto('/')

  const firstCard = page.locator('.node-card').first()
  const tagTrigger = firstCard.locator('[data-node-tag-trigger]')
  await tagTrigger.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()

  const desktopCardBounds = await firstCard.boundingBox()
  const desktopTooltipBounds = await tooltip.boundingBox()
  expect(desktopCardBounds).not.toBeNull()
  expect(desktopTooltipBounds).not.toBeNull()
  if (desktopCardBounds && desktopTooltipBounds) {
    const tooltipRatio = desktopTooltipBounds.width / desktopCardBounds.width
    expect(tooltipRatio).toBeGreaterThanOrEqual(0.54)
    expect(tooltipRatio).toBeLessThanOrEqual(0.58)
  }

  async function expectAlignedAboveCard() {
    const [cardBounds, tooltipBounds] = await Promise.all([firstCard.boundingBox(), tooltip.boundingBox()])
    expect(cardBounds).not.toBeNull()
    expect(tooltipBounds).not.toBeNull()
    if (!cardBounds || !tooltipBounds)
      return
    expect(tooltipBounds.width).toBeLessThanOrEqual(cardBounds.width + 1)
    expect(Math.abs((tooltipBounds.x + tooltipBounds.width / 2) - (cardBounds.x + cardBounds.width / 2))).toBeLessThanOrEqual(2)
    expect(tooltipBounds.y + tooltipBounds.height).toBeLessThanOrEqual(cardBounds.y - 6)
  }

  await expectAlignedAboveCard()
  await page.setViewportSize({ width: 820, height: 900 })
  await tagTrigger.hover()
  await expect(tooltip).toBeVisible()
  await expectAlignedAboveCard()
})

test('many custom tags stay highlighted, wrap within the card, and keep positional colors', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
    nodeCustomTagsVisible: true,
    firstNodeTags: [
      '搬瓦工三网优化<red>',
      '第二个较长标签<gray>',
      '第三个标签<yellow>',
      '第四个标签<orange>',
      '第五个标签<brown>',
      '第六个较长标签<yellow>',
    ].join(';'),
  })
  await page.goto('/')

  const firstCard = page.locator('.node-card').first()
  await firstCard.locator('[data-node-tag-trigger]').hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible({ timeout: 500 })
  const chips = tooltip.locator('[data-node-tag-chip]')
  await expect(chips).toHaveCount(6)

  const [cardBounds, tooltipBounds, chipLayout] = await Promise.all([
    firstCard.boundingBox(),
    tooltip.boundingBox(),
    chips.evaluateAll(elements => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        top: Math.round(rect.top),
        tone: element.getAttribute('data-tag-tone'),
        background: style.backgroundColor,
        color: style.color,
      }
    })),
  ])
  expect(cardBounds).not.toBeNull()
  expect(tooltipBounds).not.toBeNull()
  if (cardBounds && tooltipBounds) {
    expect(tooltipBounds.width).toBeGreaterThanOrEqual(cardBounds.width - 2)
    expect(tooltipBounds.width).toBeLessThanOrEqual(cardBounds.width + 1)
  }
  expect(new Set(chipLayout.map(chip => chip.top)).size).toBeGreaterThan(1)
  expect(chipLayout.map(chip => chip.tone)).toEqual(['0', '1', '2', '3', '4', '5'])
  for (const chip of chipLayout) {
    expect(chip.background).not.toBe('transparent')
    expect(chip.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(chip.color).not.toBe('rgba(0, 0, 0, 0)')
  }

  const firstPositionColor = chipLayout[0].background
  const secondCard = page.locator('.node-card').nth(1)
  await secondCard.locator('[data-node-tag-trigger]').hover()
  await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 500 })
  const secondCardFirstChip = page.getByRole('tooltip').locator('[data-node-tag-chip]').first()
  await expect(secondCardFirstChip).toHaveAttribute('data-tag-tone', '0')
  await expect.poll(async () => secondCardFirstChip.evaluate(element => getComputedStyle(element).backgroundColor))
    .toBe(firstPositionColor)
})

test('traffic and renewal summaries keep readable text while states stay subtle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
  })
  await page.goto('/')

  const normalCard = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
  const warningCard = page.getByRole('button', { name: '查看节点 台北-流量预警 详情', exact: true })
  const normalTraffic = normalCard.locator('[data-node-traffic-summary]')
  const normalRenewal = normalCard.locator('[data-node-renewal-summary]')
  const warningTraffic = warningCard.locator('[data-node-traffic-summary]')
  const warningRenewal = warningCard.locator('[data-node-renewal-summary]')

  await expect(normalTraffic).toHaveAttribute('data-status', 'success')
  await expect(normalRenewal).toHaveAttribute('data-status', 'success')
  await expect(warningTraffic).toHaveAttribute('data-status', 'danger')
  await expect(warningRenewal).toHaveAttribute('data-status', 'warning')

  const normalBackground = await normalTraffic.evaluate(element => getComputedStyle(element).backgroundColor)
  const warningBackground = await warningTraffic.evaluate(element => getComputedStyle(element).backgroundColor)
  const normalText = await normalRenewal.locator('.node-card-status-panel__value').evaluate(element => getComputedStyle(element).color)
  const warningText = await warningRenewal.locator('.node-card-status-panel__value').evaluate(element => getComputedStyle(element).color)
  const dangerText = await warningTraffic.locator('.node-card-status-panel__value').evaluate(element => getComputedStyle(element).color)
  const normalTrafficLabel = await normalTraffic.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
  const warningTrafficLabel = await warningTraffic.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
  const normalRenewalLabel = await normalRenewal.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
  const warningRenewalLabel = await warningRenewal.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
  const renewalPrice = await normalRenewal.locator('.node-card-renewal-price').evaluate(element => getComputedStyle(element).color)
  const trafficLabelBackground = await normalTraffic.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).backgroundColor)
  const renewalLabelBackground = await normalRenewal.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).backgroundColor)
  const cpuLabel = await normalCard.locator('[data-node-metric="cpu"]').evaluate(element => getComputedStyle(element).color)
  expect(normalBackground).not.toBe(warningBackground)
  expect(warningText).not.toBe(normalText)
  expect(dangerText).not.toBe(normalText)
  expect(dangerText).not.toBe(warningText)
  expect(normalTrafficLabel).toBe(warningTrafficLabel)
  expect(normalRenewalLabel).toBe(warningRenewalLabel)
  expect(normalTrafficLabel).toBe(normalRenewalLabel)
  expect(normalTrafficLabel).toBe(cpuLabel)
  expect(normalText).not.toBe(normalRenewalLabel)
  expect(renewalPrice).toBe(normalText)
  expect(trafficLabelBackground).toBe('rgba(0, 0, 0, 0)')
  expect(renewalLabelBackground).toBe('rgba(0, 0, 0, 0)')
})

for (const dark of [false, true]) {
  test(`mini summaries use one readable text treatment in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await installKomariFixture(page, {
      dark,
      hideEarth: true,
      nodeCardSize: 'mini',
    })
    await page.goto('/')

    const firstCard = page.locator('.node-card').first()
    const traffic = firstCard.locator('[data-node-traffic-summary]')
    const renewal = firstCard.locator('[data-node-renewal-summary]')
    const realtime = firstCard.locator('[data-node-realtime-summary]')
    await expect(traffic).toHaveAttribute('data-summary-kind', 'traffic')
    await expect(renewal).toHaveAttribute('data-summary-kind', 'renewal')
    await expect(realtime).toHaveAttribute('data-summary-kind', 'realtime')

    const trafficLabel = await traffic.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
    const renewalLabel = await renewal.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
    const realtimeLabel = await realtime.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
    const trafficValue = await traffic.locator('.node-card-status-panel__value').evaluate(element => getComputedStyle(element).color)
    const renewalValue = await renewal.locator('.node-card-status-panel__value').evaluate(element => getComputedStyle(element).color)
    const renewalPrice = await renewal.locator('.node-card-renewal-price').evaluate(element => getComputedStyle(element).color)
    const trafficLabelBackground = await traffic.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).backgroundColor)
    const renewalLabelBackground = await renewal.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).backgroundColor)
    const panelStyles = await Promise.all([realtime, traffic, renewal].map(panel => panel.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        borderStyle: style.borderStyle,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      }
    })))
    expect(trafficLabel).toBe(renewalLabel)
    expect(trafficLabel).toBe(realtimeLabel)
    expect(trafficValue).toBe(renewalValue)
    expect(renewalPrice).toBe(renewalValue)
    expect(trafficValue).not.toBe(trafficLabel)
    expect(trafficLabelBackground).toBe('rgba(0, 0, 0, 0)')
    expect(renewalLabelBackground).toBe('rgba(0, 0, 0, 0)')
    for (const style of panelStyles) {
      expect(style.borderStyle).toBe('solid')
      expect(style.borderColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(style.boxShadow).toBe('none')
    }
  })
}

test('unlimited traffic keeps a readable neutral treatment in compact dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
    firstNodeTrafficLimit: 0,
  })
  await page.goto('/')

  const firstCard = page.locator('.node-card').first()
  const traffic = firstCard.locator('[data-node-traffic-summary]')
  await expect(traffic).toHaveAttribute('data-status', 'neutral')
  const labelColor = await traffic.locator('.node-card-status-panel__label').evaluate(element => getComputedStyle(element).color)
  const valueColor = await traffic.locator('.node-card-status-panel__value').evaluate(element => getComputedStyle(element).color)
  const cpuLabelColor = await firstCard.locator('[data-node-metric="cpu"]').evaluate(element => getComputedStyle(element).color)
  expect(labelColor).toBe(cpuLabelColor)
  expect(valueColor).not.toBe(labelColor)
  expect(valueColor).not.toBe('rgb(71, 85, 105)')
})

test('custom node tag switch hides card tags without leaving empty placeholders', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
    nodeCustomTagsVisible: false,
  })
  await page.goto('/')

  await expect(page.locator('.node-card').first().locator('[data-node-tag-trigger]')).toHaveCount(0)
  await expect(page.getByLabel('节点自定义标签')).toHaveCount(0)
})

test('free node compatibility follows the upstream 3.3.3 price and tag contract', () => {
  expect(formatPriceWithCycle(-1, 365, '￥', 'zh-CN')).toBe('免费')
  expect(formatPriceWithCycle(-1, 365, '$', 'en-US')).toBe('Free')
  expect(isFreeNode(-1, undefined)).toBe(true)
  expect(isFreeNode(149, '白嫖中<green>')).toBe(true)
  expect(isFreeNode(149, '生产环境<blue>')).toBe(false)
})

test('list metadata chip shows its full value on the first hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    viewMode: 'list',
    geoByNode: true,
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const metadataChip = page.locator('[data-node-metadata-chip]').first()
  await expect(metadataChip).toBeVisible()
  await metadataChip.hover()
  await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 500 })
  await expect(page.getByRole('tooltip')).not.toBeEmpty()
})

test('home Ping settings explains the mini first-task rule', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    loggedIn: true,
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const settingsButton = page.getByRole('button', { name: '首页延迟监控', exact: true })
  await expect(settingsButton).toHaveCount(1)
  await settingsButton.click()

  const miniRule = page.getByText('mini 卡片仅显示第 1 个任务的延迟与丢包', { exact: true })
  await expect(miniRule).toBeVisible()
  await expect(miniRule).toHaveCSS('color', 'oklch(0.879 0.169 91.605)')
})

test('home Ping settings can pin any selected task to the first position', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    loggedIn: true,
  })
  await page.goto('/')
  await page.getByRole('button', { name: '首页延迟监控', exact: true }).click()

  const selectedTasks = page.getByTestId('selected-home-ping-task')
  await expect(selectedTasks).toHaveCount(3)
  const firstPin = selectedTasks.nth(0).getByRole('button', { name: /^置顶任务 / })
  const thirdPin = selectedTasks.nth(2).getByRole('button', { name: /^置顶任务 / })
  const thirdPinLabel = (await thirdPin.getAttribute('aria-label')) ?? ''

  await expect(firstPin).toBeDisabled()
  await thirdPin.click()

  await expect(selectedTasks.nth(0).getByRole('button', { name: thirdPinLabel })).toBeDisabled()
})

test('detail favorite and adjacent-node controls remain compact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openFixture(page, '/instance/00000000-0000-4000-8000-000000000001')

  await page.getByRole('button', { name: '收藏当前节点' }).click()
  await expect(page.getByRole('button', { name: '取消收藏当前节点' })).toBeVisible()
  await page.getByRole('button', { name: '下一个节点' }).click()
  await expect(page.getByRole('heading', { name: '香港边缘节点-超长名称布局测试' })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.locator('html').evaluate(element => element.clientWidth))
})

test('historical load view falls back to compatible records when CPU metrics are missing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const rpcCalls: Array<{ method: string, params: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().includes('/rpc2'))
      return
    const payload = request.postDataJSON() as { method?: string, params?: Record<string, unknown> } | null
    if (payload?.method)
      rpcCalls.push({ method: payload.method, params: payload.params ?? {} })
  })

  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    missingCpuMetricHistory: true,
  })
  await page.goto('/instance/00000000-0000-4000-8000-000000000001')
  await page.getByRole('tab', { name: '负载', exact: true }).click()
  await page.locator('[data-load-chart-range]').getByRole('tab', { name: '4 小时', exact: true }).click()

  await expect(page.locator('[data-load-chart-card="cpu"] [data-latest-cpu]')).toBeVisible()
  await expect.poll(() => rpcCalls.some(call =>
    call.method === 'common:getRecords'
    && call.params.type === 'load'
    && call.params.uuid === '00000000-0000-4000-8000-000000000001',
  )).toBe(true)
})

test('detail Ping cards follow the backend task order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    pingTaskOrdering: true,
  })
  await page.goto('/instance/00000000-0000-4000-8000-000000000001')

  const taskCards = page.locator('[data-ping-task-id]')
  await expect(taskCards).toHaveCount(8)
  await expect(taskCards.nth(0)).toHaveAttribute('data-ping-task-id', '3')
  await expect(taskCards.nth(1)).toHaveAttribute('data-ping-task-id', '1')
  await expect(taskCards.nth(2)).toHaveAttribute('data-ping-task-id', '2')
  await expect(taskCards.nth(0)).toContainText('Google')
  await expect(taskCards.nth(1)).toContainText('洛杉矶')
  await expect(taskCards.nth(2)).toContainText('法兰克福')
})

test('clicking outside a pinned Ping tooltip releases it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openFixture(page, '/instance/00000000-0000-4000-8000-000000000001')

  const chartSurface = page.getByTestId('ping-chart-surface')
  await expect(chartSurface).toBeVisible()
  await chartSurface.click({ position: { x: 640, y: 210 } })
  await expect(page.getByText('已固定 · 解除', { exact: true })).toBeVisible()

  await page.getByRole('heading', { name: 'Komari Visual Lab' }).click()
  await expect(page.getByText('已固定 · 解除', { exact: true })).toBeHidden()
})

test('Ping tooltip stays responsive during rapid pointer movement', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openFixture(page, '/instance/00000000-0000-4000-8000-000000000001')

  const chartSurface = page.getByTestId('ping-chart-surface')
  await expect(chartSurface).toBeVisible()
  await chartSurface.scrollIntoViewIfNeeded()
  const bounds = await chartSurface.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds)
    return

  const y = bounds.y + bounds.height * 0.58
  for (let index = 0; index < 36; index++) {
    const ratio = index % 2 === 0 ? index / 36 : 1 - index / 36
    await page.mouse.move(bounds.x + 56 + (bounds.width - 92) * ratio, y)
  }
  await page.mouse.move(bounds.x + bounds.width * 0.5, y)

  const hoverHint = page.getByText('单击图表固定后滚动', { exact: true })
  await expect(hoverHint).toBeVisible()
  const tooltipSurface = await hoverHint.evaluate((element) => {
    const surface = element.closest<HTMLElement>('div[style*="contain: layout style paint"]')
    if (!surface)
      return null
    const style = getComputedStyle(surface)
    return {
      backdropFilter: style.backdropFilter,
      contain: surface.style.contain,
      transitionDuration: style.transitionDuration,
      willChange: style.willChange,
    }
  })

  expect(tooltipSurface).not.toBeNull()
  expect(tooltipSurface?.backdropFilter === 'none' || tooltipSurface?.backdropFilter === '').toBe(true)
  expect(tooltipSurface?.contain).toContain('paint')
  expect(tooltipSurface?.transitionDuration).toBe('0s')
  expect(tooltipSurface?.willChange).toContain('transform')
})

const PING_TOOLTIP_MODES = [
  { name: 'mini card', options: { nodeCardSize: 'mini' as const } },
  { name: 'compact card', options: { nodeCardSize: 'compact' as const } },
  { name: 'comfortable card', options: { nodeCardSize: 'comfortable' as const } },
  { name: 'large card', options: { nodeCardSize: 'large' as const } },
  { name: 'list', options: { viewMode: 'list' as const } },
]

for (const mode of PING_TOOLTIP_MODES) {
  test(`${mode.name} Ping history uses one unified RTT and Loss tooltip`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await installKomariFixture(page, {
      dark: true,
      hideEarth: true,
      ...mode.options,
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

    const latencyStrip = page.getByRole('img', { name: /延迟历史/ }).first()
    const lossStrip = page.getByRole('img', { name: /丢包历史/ }).first()
    await expect(latencyStrip).toBeVisible()
    await expect(lossStrip).toBeVisible()

    const latencyBar = latencyStrip.locator('[data-ping-history-index]').first()
    await expect(latencyBar).not.toHaveAttribute('title', /.+/)
    await expect(latencyBar).toHaveAttribute('aria-label', /RTT: \d+ ms/)
    await latencyBar.hover()

    const tooltip = page.locator('.ping-history-tooltip')
    await expect(tooltip).toBeVisible()
    await expect(page.getByRole('tooltip')).toHaveCount(1)
    await expect(tooltip).toHaveText(/^\d{2}:\d{2}:\d{2}RTT: \d+ ms$/)
    const tooltipStyle = await tooltip.evaluate((element) => {
      const lines = Array.from(element.children, child => getComputedStyle(child))
      const style = getComputedStyle(element)
      return {
        textAlign: style.textAlign,
        paddingTop: style.paddingTop,
        paddingLeft: style.paddingLeft,
        lineFontSizes: lines.map(line => line.fontSize),
        lineFontWeights: lines.map(line => line.fontWeight),
      }
    })
    expect(tooltipStyle.textAlign).toBe('left')
    expect(tooltipStyle.paddingTop).toBe('6px')
    expect(tooltipStyle.paddingLeft).toBe('8px')
    expect(new Set(tooltipStyle.lineFontSizes).size).toBe(1)
    expect(new Set(tooltipStyle.lineFontWeights).size).toBe(1)

    const lossBar = lossStrip.locator('[data-ping-history-index]').first()
    await expect(lossBar).not.toHaveAttribute('title', /.+/)
    await expect(lossBar).toHaveAttribute('aria-label', /Loss: \d+\.\d%/)
    await lossBar.hover()
    await expect(page.getByRole('tooltip')).toHaveCount(1)
    await expect(tooltip).toHaveText(/^\d{2}:\d{2}:\d{2}Loss: \d+\.\d%$/)

    const bounds = await tooltip.boundingBox()
    expect(bounds).not.toBeNull()
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.y).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(800)
    }
  })
}

test('stationary pointer receives the first asynchronous Ping history sample', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
    pingMetricDelayMs: 1800,
  })
  await page.goto('/')

  const latencyStrip = page.getByRole('img', { name: /延迟历史/ }).first()
  await expect(latencyStrip).toBeVisible()
  const stripBounds = await latencyStrip.boundingBox()
  expect(stripBounds).not.toBeNull()
  await page.mouse.move(
    stripBounds!.x + stripBounds!.width * 0.42,
    stripBounds!.y + stripBounds!.height / 2,
  )

  const tooltip = page.locator('.ping-history-tooltip')
  await expect(tooltip).toContainText('RTT: 加载中')
  await expect(tooltip).toHaveText(/^\d{2}:\d{2}:\d{2}RTT: \d+ ms$/, { timeout: 5_000 })
})

test('first Ping strip hover after reload uses the enlarged hit target and restores async data', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
    pingMetricDelayMs: 1_200,
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await page.reload()

  const latencyStrip = page.getByRole('img', { name: /延迟历史/ }).first()
  await expect(latencyStrip).toBeVisible()
  const stripBounds = await latencyStrip.boundingBox()
  expect(stripBounds).not.toBeNull()
  await page.mouse.move(
    stripBounds!.x + stripBounds!.width * 0.56,
    stripBounds!.y - 12,
  )

  const tooltip = page.locator('.ping-history-tooltip')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('RTT: 加载中')
  await expect(tooltip).toHaveText(/^\d{2}:\d{2}:\d{2}RTT: \d+ ms$/, { timeout: 5_000 })
})

test('first chart hover after reload is replayed when asynchronous records arrive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    pingMetricDelayMs: 1_200,
  })
  await page.goto('/instance/00000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await page.reload()

  const chartSurface = page.getByTestId('ping-chart-surface')
  await expect(chartSurface).toBeVisible()
  await chartSurface.scrollIntoViewIfNeeded()
  const bounds = await chartSurface.boundingBox()
  expect(bounds).not.toBeNull()
  const visibleChartTop = Math.max(bounds!.y, 0)
  const visibleChartBottom = Math.min(bounds!.y + bounds!.height, 800)
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.5,
    visibleChartTop + (visibleChartBottom - visibleChartTop) * 0.58,
  )

  const hoverHint = page.getByText('单击图表固定后滚动', { exact: true })
  await expect(hoverHint).toBeVisible({ timeout: 5_000 })

  const taskRows = page.locator('[data-ping-tooltip-scroll] > div')
  await expect.poll(() => taskRows.count()).toBeGreaterThan(0)
  const numericAlignment = await taskRows.evaluateAll(rows => rows.map((row) => {
    const cells = Array.from(row.children) as HTMLElement[]
    const latency = cells.at(-2)
    const loss = cells.at(-1)
    const rowRect = (row as HTMLElement).getBoundingClientRect()
    return {
      latencyAlign: latency ? getComputedStyle(latency).textAlign : '',
      lossAlign: loss ? getComputedStyle(loss).textAlign : '',
      lossRightGap: loss ? Math.abs(rowRect.right - loss.getBoundingClientRect().right) : Number.POSITIVE_INFINITY,
    }
  }))
  expect(numericAlignment.every(item => item.latencyAlign === 'right')).toBe(true)
  expect(numericAlignment.every(item => item.lossAlign === 'right')).toBe(true)
  expect(numericAlignment.every(item => item.lossRightGap <= 1)).toBe(true)
})

test('90-day Ping view keeps the full metric range instead of falling back to capped legacy records', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const rpcCalls: Array<{ method: string, params: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().includes('/rpc2'))
      return
    const payload = request.postDataJSON() as { method?: string, params?: Record<string, unknown> } | null
    if (!payload?.method)
      return
    rpcCalls.push({ method: payload.method, params: payload.params ?? {} })
  })

  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    pingRecordPreserveHours: 90 * 24,
    approximatePingMetricStats: true,
    metricRangeAware: true,
  })
  await page.goto('/instance/00000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  await page.getByRole('tab', { name: '90 天', exact: true }).click()
  const chartSurface = page.getByTestId('ping-chart-surface')
  await expect(chartSurface).toHaveAttribute('data-ping-source', 'metrics')
  await expect.poll(() => rpcCalls.some(call =>
    call.method === 'public:queryMetrics'
    && call.params.hours === 90 * 24
    && call.params.max_points === 6000,
  )).toBe(true)

  await expect.poll(async () => {
    const [rangeStart, rangeEnd] = await Promise.all([
      chartSurface.getAttribute('data-ping-range-start'),
      chartSurface.getAttribute('data-ping-range-end'),
    ])
    if (!rangeStart || !rangeEnd)
      return 0
    return (Date.parse(rangeEnd) - Date.parse(rangeStart)) / 3_600_000
  }).toBeGreaterThanOrEqual(90 * 24 - 1)
  expect(rpcCalls.some(call => call.method === 'common:getRecords' && call.params.type === 'ping')).toBe(false)
})

test('daily metric aggregates show their interval and UTC bucket date instead of a misleading local 08:00', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    pingRecordPreserveHours: 90 * 24,
    metricAggregationIntervalSeconds: 86_400,
  })
  await page.goto('/instance/00000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  await page.getByRole('tab', { name: '负载', exact: true }).click()
  await page.locator('[data-load-chart-range]').getByRole('tab', { name: '30 天', exact: true }).click()
  const loadAggregationHint = page.getByTestId('load-aggregation-hint')
  await expect(loadAggregationHint).toContainText('按日聚合')
  await expect(loadAggregationHint).toContainText('每个点表示该统计区间的平均值')

  await page.getByRole('tab', { name: '延迟', exact: true }).click()
  await page.getByRole('tab', { name: '90 天', exact: true }).click()
  const aggregationHint = page.getByTestId('ping-aggregation-hint')
  await expect(aggregationHint).toContainText('按日聚合')
  await expect(aggregationHint).toContainText('每个点表示该统计区间的平均值')

  const chartSurface = page.getByTestId('ping-chart-surface')
  await expect(chartSurface).toHaveAttribute('data-ping-aggregation-interval', '86400')
  await expect.poll(() => chartSurface.getAttribute('data-ping-range-start')).toMatch(/T00:00:00\.000Z$/)
  await chartSurface.click({ position: { x: 720, y: 210 } })

  const tooltipRows = page.locator('[data-ping-tooltip-scroll]').first()
  await expect(tooltipRows).toBeVisible()
  await expect.poll(() => tooltipRows.evaluate(element => element.parentElement?.textContent ?? ''))
    .toMatch(/2026\/\d{2}\/\d{2} · 日聚合/)
  const tooltipText = await tooltipRows.evaluate(element => element.parentElement?.textContent ?? '')
  expect(tooltipText).not.toContain('08:00')
})

test('overview card details appear on whole-card hover without a click', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    generalCardPreset: '完整',
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const systemCard = page.locator('[data-general-card-key="systemDistribution"]')
  await expect(systemCard).toBeVisible()
  await systemCard.hover({ position: { x: 18, y: 18 } })

  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('系统分布')
  await expect(tooltip).toContainText(/Debian|Ubuntu/)
})

test('node cards use theme-aware vector icons for their primary metrics', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installKomariFixture(page, {
    dark: false,
    hideEarth: true,
    nodeCardSize: 'compact',
  })
  await page.goto('/')

  const card = page.locator('.node-card').first()
  await expect(card).toBeVisible()
  for (const metric of ['cpu', 'memory', 'disk', 'traffic', 'ping']) {
    const label = card.locator(`[data-node-metric="${metric}"]`)
    await expect(label).toBeVisible()
    await expect(label.locator('svg')).toHaveCount(1)
  }

  const lightColors = await card.locator('[data-node-metric]').evaluateAll(labels =>
    labels.map(label => getComputedStyle(label.firstElementChild as HTMLElement).color))

  await page.getByRole('button', { name: /自动主题（当前浅色）|浅色主题/ }).click()
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  const darkColors = await card.locator('[data-node-metric]').evaluateAll(labels =>
    labels.map(label => getComputedStyle(label.firstElementChild as HTMLElement).color))

  expect(new Set(lightColors).size).toBeGreaterThanOrEqual(4)
  expect(new Set(darkColors).size).toBeGreaterThanOrEqual(4)
  expect(darkColors).not.toEqual(lightColors)
})

test('home Ping summaries batch visible nodes and cap metric history at 150 points', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const pingRequests: Array<Record<string, unknown>> = []
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('rpc2'))
      return

    const payload = request.postDataJSON() as {
      method?: string
      params?: Record<string, unknown>
    } | null
    const metricKeys = Array.isArray(payload?.params?.metric_keys)
      ? payload.params.metric_keys
      : []
    const isPingRequest = payload?.method === 'public:getPingMetricStats'
      || (
        payload?.method === 'public:queryMetrics'
        && metricKeys.includes('ping.latency_ms')
      )
    if (isPingRequest && payload?.params)
      pingRequests.push(payload.params)
  })

  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect.poll(() => pingRequests.length).toBeGreaterThan(0)

  expect(pingRequests.every(params => params.max_points === 150)).toBe(true)
  expect(pingRequests.some(params => Array.isArray(params.entity_ids) && params.entity_ids.length === 12)).toBe(true)
  expect(pingRequests.some(params => typeof params.entity_id === 'string')).toBe(false)
})

test('leaving home discards delayed batched Ping results without legacy fallbacks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const legacyPingCalls: Record<string, unknown>[] = []
  page.on('request', (request) => {
    if (!request.url().includes('/rpc2'))
      return
    const payload = request.postDataJSON() as { method?: string, params?: Record<string, unknown> } | null
    if (payload?.method === 'common:getRecords' && payload.params?.type === 'ping')
      legacyPingCalls.push(payload.params)
  })
  await installKomariFixture(page, {
    dark: true,
    hideEarth: true,
    nodeCardSize: 'compact',
    pingMetricDelayMs: 2_500,
  })
  await page.goto('/')
  const firstCard = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
  await expect(firstCard).toBeVisible()
  await firstCard.click()
  await expect(page.getByRole('heading', { name: '主控-洛杉矶' })).toBeVisible()
  await page.waitForTimeout(2_700)
  expect(legacyPingCalls).toHaveLength(0)
})

test('remaining value keeps all complete billing cycles', () => {
  const now = new Date('2026-07-30T00:00:00.000Z')
  const expiredAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const node = {
    price: 100,
    currency: 'CNY',
    billing_cycle: 30,
    expired_at: expiredAt,
    tags: '',
  }
  const values = {
    finance: calculateRemainingValueCNY(
      node as Parameters<typeof calculateRemainingValueCNY>[0],
      DEFAULT_EXCHANGE_RATES,
      now,
    ),
    tags: getRemainingValue(100, 30, Date.now() + 90 * 24 * 60 * 60 * 1000),
  }

  expect(values.finance).toBe(300)
  expect(values.tags).toBeGreaterThan(290)
})
