import type { Page } from '@playwright/test'
import type { VisualFixtureOptions } from './fixtures/komari'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

interface MatrixCase {
  name: string
  viewport: { width: number, height: number }
  options: VisualFixtureOptions
}

const CONFIG_MATRIX: MatrixCase[] = [
  {
    name: 'desktop dark compact realistic',
    viewport: { width: 1280, height: 720 },
    options: { dark: true, nodeCardSize: 'compact', earthRenderer: 'realistic', glassColorPreset: '翡翠' },
  },
  {
    name: 'desktop light mini cobe',
    viewport: { width: 1024, height: 768 },
    options: { nodeCardSize: 'mini', earthRenderer: 'cobe', glassColorPreset: '柔和' },
  },
  {
    name: 'wide dark comfortable tiled',
    viewport: { width: 1440, height: 900 },
    options: { dark: true, nodeCardSize: 'comfortable', earthRenderer: 'tiled', glassColorPreset: '高对比' },
  },
  {
    name: 'full hd dark compact realistic',
    viewport: { width: 1920, height: 1080 },
    options: { dark: true, nodeCardSize: 'compact', earthRenderer: 'realistic', glassColorPreset: '翡翠' },
  },
  {
    name: 'ultrawide light mini realistic',
    viewport: { width: 2560, height: 1080 },
    options: { nodeCardSize: 'mini', earthRenderer: 'realistic', glassColorPreset: '柔和' },
  },
  {
    name: 'wide light large without earth',
    viewport: { width: 1440, height: 900 },
    options: { nodeCardSize: 'large', hideEarth: true, glassColorPreset: '午夜' },
  },
  {
    name: 'accessible list without earth',
    viewport: { width: 1280, height: 800 },
    options: { viewMode: 'list', hideEarth: true, colorVisionFriendly: true, glassColorPreset: '高对比' },
  },
  {
    name: 'small mobile dark mini cobe',
    viewport: { width: 320, height: 720 },
    options: { dark: true, nodeCardSize: 'mini', earthRenderer: 'cobe', visitorInfoEnabled: false },
  },
  {
    name: 'mobile light comfortable realistic',
    viewport: { width: 390, height: 844 },
    options: { nodeCardSize: 'comfortable', earthRenderer: 'realistic', glassColorPreset: '柔和' },
  },
  {
    name: 'desktop dark large hidden header',
    viewport: { width: 1280, height: 800 },
    options: { dark: true, nodeCardSize: 'large', hideGeneralCard: true, visitorInfoEnabled: false },
  },
]

async function openMatrixPage(page: Page, matrixCase: MatrixCase): Promise<string[]> {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleErrors.push(message.text())
  })
  page.on('pageerror', error => consoleErrors.push(error.message))

  await page.setViewportSize(matrixCase.viewport)
  await installKomariFixture(page, matrixCase.options)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await page.waitForTimeout(500)
  return consoleErrors
}

for (const matrixCase of CONFIG_MATRIX) {
  test(`configuration matrix: ${matrixCase.name}`, async ({ page }) => {
    const consoleErrors = await openMatrixPage(page, matrixCase)
    const viewportMetrics = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))

    expect(viewportMetrics.scrollWidth).toBe(viewportMetrics.clientWidth)
    if (matrixCase.options.viewMode === 'list') {
      await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })).toBeVisible()
    }
    else {
      const cardSize = matrixCase.options.nodeCardSize ?? 'compact'
      await expect(page.locator(`.node-card--${cardSize}`).first()).toBeVisible()
    }
    expect(consoleErrors).toEqual([])
  })
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function parseHexColor(value: string): [number, number, number, number] {
  const normalized = value.trim().replace('#', '')
  if (!/^[\da-f]{6}(?:[\da-f]{2})?$/i.test(normalized))
    throw new Error(`Unsupported color token: ${value}`)
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    normalized.length === 8 ? Number.parseInt(normalized.slice(6, 8), 16) / 255 : 1,
  ]
}

function compositeColor(
  foreground: [number, number, number, number],
  background: [number, number, number],
): [number, number, number] {
  const [red, green, blue, alpha] = foreground
  return [
    red * alpha + background[0] * (1 - alpha),
    green * alpha + background[1] * (1 - alpha),
    blue * alpha + background[2] * (1 - alpha),
  ]
}

test('glass presets keep primary and muted text readable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { dark: true, glassColorPreset: '翡翠' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const tokens = await page.locator('html').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      card: style.getPropertyValue('--glass-dark-card'),
      text: style.getPropertyValue('--glass-dark-text'),
      muted: style.getPropertyValue('--glass-dark-muted-text'),
    }
  })
  const pageBackground: [number, number, number] = [5, 10, 18]
  const cardBackground = compositeColor(parseHexColor(tokens.card), pageBackground)
  const text = parseHexColor(tokens.text).slice(0, 3) as [number, number, number]
  const mutedText = parseHexColor(tokens.muted).slice(0, 3) as [number, number, number]

  expect(contrastRatio(text, cardBackground)).toBeGreaterThanOrEqual(7)
  expect(contrastRatio(mutedText, cardBackground)).toBeGreaterThanOrEqual(4.5)
})

test('wide layout expands the content frame without letting controls cover the globe', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await installKomariFixture(page, { dark: true, earthRenderer: 'realistic', generalCardPreset: '资产' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect(page.getByText('Ubuntu…', { exact: true })).toBeVisible()

  const layout = await page.evaluate(() => {
    const home = document.querySelector<HTMLElement>('.home-view')
    const cards = document.querySelector<HTMLElement>('.overview-card-grid')
    const earth = document.querySelector<HTMLElement>('.overview-earth')
    const controls = document.querySelector<HTMLElement>('.home-controls-scroll')
    const controlRow = document.querySelector<HTMLElement>('.home-controls-row')
    const searchControls = document.querySelector<HTMLElement>('.home-controls-row .search')
    const firstCard = document.querySelector<HTMLElement>('.general-metric-card')
    const status = document.querySelector<HTMLElement>('.realistic-earth-shell > div:nth-child(2)')
    const nodeCards = Array.from(document.querySelectorAll<HTMLElement>('.node-card--compact'))
    if (!home || !cards || !earth || !controls || !controlRow || !searchControls || !firstCard || !status || nodeCards.length < 2)
      throw new Error('Wide layout anchors are missing')

    const firstNodeCardTop = nodeCards[0]!.getBoundingClientRect().top
    const controlRowRect = controlRow.getBoundingClientRect()
    const searchRect = searchControls.getBoundingClientRect()
    return {
      homeWidth: home.getBoundingClientRect().width,
      cardRight: cards.getBoundingClientRect().right,
      controlRight: controls.getBoundingClientRect().right,
      controlRowRight: controlRowRect.right,
      controlTop: controls.getBoundingClientRect().top,
      controlsToCardsGap: firstNodeCardTop - controlRowRect.bottom,
      earthWidth: earth.getBoundingClientRect().width,
      nodeCardWidth: nodeCards[0]!.getBoundingClientRect().width,
      firstRowNodeCards: nodeCards.filter(card => Math.abs(card.getBoundingClientRect().top - firstNodeCardTop) <= 2).length,
      searchTop: searchRect.top,
      cardTop: firstCard.getBoundingClientRect().top,
      statusTop: status.getBoundingClientRect().top,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })

  expect(layout.homeWidth).toBeGreaterThan(1280)
  expect(layout.earthWidth).toBeGreaterThan(600)
  expect(layout.nodeCardWidth).toBeGreaterThanOrEqual(440)
  expect(layout.nodeCardWidth).toBeLessThanOrEqual(480)
  expect(layout.firstRowNodeCards).toBe(4)
  expect(layout.controlRight).toBeLessThan(layout.controlRowRight)
  expect(Math.abs(layout.controlTop - layout.searchTop)).toBeLessThanOrEqual(2)
  expect(layout.controlsToCardsGap).toBeGreaterThanOrEqual(0)
  expect(layout.controlsToCardsGap).toBeLessThanOrEqual(12)
  expect(Math.abs(layout.statusTop - layout.cardTop)).toBeLessThanOrEqual(4)
  expect(layout.scrollWidth).toBe(layout.clientWidth)
})

test('narrow desktop condenses quick controls into an aligned dropdown', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await installKomariFixture(page, {
    homeQuickControlPreset: '基础',
    earthRenderer: 'realistic',
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const quickSelect = page.getByRole('combobox', { name: '主页快捷筛选' })
  await expect(quickSelect).toBeVisible()
  await expect(page.locator('.quick-controls-wide')).toBeHidden()
  await expect(quickSelect.locator('option')).toHaveCount(5)

  await quickSelect.selectOption('monthlyCost')
  await expect(quickSelect).toHaveValue('monthlyCost')

  const layout = await page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>('.home-controls-scroll')
    const search = document.querySelector<HTMLElement>('.home-controls-row .search')
    const row = document.querySelector<HTMLElement>('.home-controls-row')
    const firstCard = document.querySelector<HTMLElement>('.node-card-grid > div')
    if (!controls || !search || !row || !firstCard)
      throw new Error('Narrow desktop anchors are missing')
    return {
      controlsTop: controls.getBoundingClientRect().top,
      searchTop: search.getBoundingClientRect().top,
      cardGap: firstCard.getBoundingClientRect().top - row.getBoundingClientRect().bottom,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })

  expect(Math.abs(layout.controlsTop - layout.searchTop)).toBeLessThanOrEqual(2)
  expect(layout.cardGap).toBeGreaterThanOrEqual(0)
  expect(layout.cardGap).toBeLessThanOrEqual(12)
  expect(layout.scrollWidth).toBe(layout.clientWidth)
})

test('basic quick-control preset keeps every configured action including monthly cost', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installKomariFixture(page, { homeQuickControlPreset: '基础' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const controls = page.locator('button[aria-label^="切换到"]')
  await expect(controls).toHaveCount(4)
  await expect(page.getByRole('button', { name: /^切换到月成本节点/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^切换到收藏节点/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^切换到峰值节点/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^切换到离线节点/ })).toBeVisible()
})

test('tiled renderer honors the configured general-card preset and keeps map proportions', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await installKomariFixture(page, {
    earthRenderer: 'tiled',
    generalCardPreset: '自定义',
    generalCardKeys: 'onlineNodes\nmonthlyCost',
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  await expect(page.locator('.general-metric-card')).toHaveCount(2)
  await expect(page.getByText('在线节点', { exact: true })).toBeVisible()
  await expect(page.getByText('月费用估算', { exact: true })).toBeVisible()
  await expect(page.locator('.overview-card-grid').getByText('累计流量', { exact: true })).toHaveCount(0)

  const dimensions = await page.locator('.map-stage').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, ratio: rect.width / rect.height, width: rect.width }
  })
  expect(dimensions.width).toBeGreaterThan(1150)
  expect(dimensions.ratio).toBeGreaterThan(2.08)
  expect(dimensions.ratio).toBeLessThan(2.16)
  await expect(page.locator('.map-region-panel')).toBeVisible()
})

test('tiled renderer balances six configured cards into two full rows of three', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await installKomariFixture(page, {
    earthRenderer: 'tiled',
    generalCardPreset: '基础',
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const cards = page.locator('.overview-card-grid .general-metric-card')
  await expect(cards).toHaveCount(6)
  const positions = await cards.evaluateAll(elements => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
  }))

  expect(new Set(positions.slice(0, 3).map(position => position.top)).size).toBe(1)
  expect(new Set(positions.slice(3).map(position => position.top)).size).toBe(1)
  expect(positions[3]!.top).toBeGreaterThan(positions[0]!.top)
  expect(positions[0]!.width).toBeGreaterThan(580)
  expect(positions[0]!.left).toBeLessThan(positions[1]!.left)
  expect(positions[1]!.left).toBeLessThan(positions[2]!.left)
})

test('overview cards fill even rows and keep an odd final row at the same width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await installKomariFixture(page, {
    hideEarth: true,
    generalCardPreset: '自定义',
    generalCardKeys: [
      'currentTime',
      'memory',
      'disk',
      'remainingValue',
      'totalTraffic',
      'uploadSpeed',
      'downloadSpeed',
      'onlineNodes',
      'avgCpu',
      'avgGpu',
    ].join('\n'),
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const evenCards = page.locator('.overview-card-grid .general-metric-card')
  await expect(evenCards).toHaveCount(10)
  const evenPositions = await evenCards.evaluateAll(elements => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { top: Math.round(rect.top), width: Math.round(rect.width) }
  }))
  expect(new Set(evenPositions.slice(0, 5).map(position => position.top)).size).toBe(1)
  expect(new Set(evenPositions.slice(5).map(position => position.top)).size).toBe(1)
  expect(new Set(evenPositions.map(position => position.width)).size).toBe(1)

  await page.setViewportSize({ width: 1280, height: 800 })
  await installKomariFixture(page, {
    hideEarth: true,
    generalCardPreset: '自定义',
    generalCardKeys: [
      'currentTime',
      'memory',
      'disk',
      'remainingValue',
      'totalTraffic',
      'uploadSpeed',
      'downloadSpeed',
    ].join('\n'),
  })
  await page.reload()

  const oddCards = page.locator('.overview-card-grid .general-metric-card')
  await expect(oddCards).toHaveCount(7)
  const oddPositions = await oddCards.evaluateAll(elements => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { top: Math.round(rect.top), width: Math.round(rect.width) }
  }))
  expect(new Set(oddPositions.slice(0, 4).map(position => position.top)).size).toBe(1)
  expect(new Set(oddPositions.slice(4).map(position => position.top)).size).toBe(1)
  expect(new Set(oddPositions.map(position => position.width)).size).toBe(1)
})

test('ultrawide layout respects its readable maximum width', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 })
  await installKomariFixture(page, { earthRenderer: 'realistic' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const width = await page.locator('.home-view').evaluate(element => element.getBoundingClientRect().width)
  expect(width).toBeGreaterThanOrEqual(2198)
  expect(width).toBeLessThanOrEqual(2202)
})
