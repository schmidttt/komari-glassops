import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const EARTH_RENDERERS = [
  { renderer: 'realistic', selector: '.realistic-earth-shell', dark: true, label: 'realistic-dark' },
  { renderer: 'realistic', selector: '.realistic-earth-shell', dark: false, label: 'realistic-light' },
  { renderer: 'cobe', selector: '.earth-globe-canvas', dark: true, label: 'cobe-dark' },
  { renderer: 'cobe', selector: '.earth-globe-canvas', dark: false, label: 'cobe-light' },
  { renderer: 'tiled', selector: '.earth-map-shell', dark: true, label: 'tiled-dark' },
  { renderer: 'tiled', selector: '.earth-map-shell', dark: false, label: 'tiled-light' },
] as const

async function openEarthPage(page: Page, renderer: 'realistic' | 'cobe' | 'tiled', dark: boolean): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, { dark, earthRenderer: renderer })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
}

async function readCentralGlobePixels(page: Page, sampleCenter = { x: 0.5, y: 0.5 }) {
  const canvas = page.locator('.earth-globe-host canvas')
  await expect(canvas).toBeVisible()
  return canvas.evaluate((element, center) => {
    const canvasElement = element as HTMLCanvasElement
    const context = canvasElement.getContext('webgl2') || canvasElement.getContext('webgl')
    if (!context) {
      return {
        alphaPixels: 0,
        averageLuminance: 0,
        brightWarmLightPixels: 0,
        hotWarmSurfacePixels: 0,
        luminanceDeviation: 0,
        saturatedWarmLightPixels: 0,
        softWarmLightPixels: 0,
        warmLightPixels: 0,
      }
    }

    const sampleSize = Math.min(canvasElement.width, canvasElement.height, 220)
    const startX = Math.max(0, Math.min(
      canvasElement.width - sampleSize,
      Math.floor(canvasElement.width * center.x - sampleSize / 2),
    ))
    const startY = Math.max(0, Math.min(
      canvasElement.height - sampleSize,
      Math.floor(canvasElement.height * center.y - sampleSize / 2),
    ))
    const pixels = new Uint8Array(sampleSize * sampleSize * 4)
    context.readPixels(startX, startY, sampleSize, sampleSize, context.RGBA, context.UNSIGNED_BYTE, pixels)
    let alphaPixels = 0
    let luminanceSum = 0
    let luminanceSquaredSum = 0
    let brightWarmLightPixels = 0
    let hotWarmSurfacePixels = 0
    let saturatedWarmLightPixels = 0
    let softWarmLightPixels = 0
    let warmLightPixels = 0
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] <= 16)
        continue
      const red = pixels[index - 3]!
      const green = pixels[index - 2]!
      const blue = pixels[index - 1]!
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
      alphaPixels += 1
      luminanceSum += luminance
      luminanceSquaredSum += luminance * luminance
      if (luminance > 175 && red > blue * 1.32 && green > blue * 1.16)
        hotWarmSurfacePixels += 1
      if (luminance > 48 && red > blue * 1.18 && green > blue * 1.08) {
        warmLightPixels += 1
        if (luminance < 112)
          softWarmLightPixels += 1
        if (luminance > 170)
          brightWarmLightPixels += 1
        if (red > 235 && green > 205)
          saturatedWarmLightPixels += 1
      }
    }
    const averageLuminance = alphaPixels ? luminanceSum / alphaPixels : 0
    const luminanceVariance = alphaPixels
      ? Math.max(0, luminanceSquaredSum / alphaPixels - averageLuminance * averageLuminance)
      : 0
    return {
      alphaPixels,
      averageLuminance,
      brightWarmLightPixels,
      hotWarmSurfacePixels,
      luminanceDeviation: Math.sqrt(luminanceVariance),
      saturatedWarmLightPixels,
      softWarmLightPixels,
      warmLightPixels,
    }
  }, sampleCenter)
}

for (const { renderer, selector, dark, label } of EARTH_RENDERERS) {
  test(`earth renderer initializes without layout overflow: ${label}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error')
        errors.push(message.text())
    })

    await openEarthPage(page, renderer, dark)
    const earthSurface = page.locator(selector)
    await expect(earthSurface).toBeVisible({ timeout: 15_000 })
    if (renderer === 'realistic') {
      const globeHost = earthSurface.locator('.earth-globe-host')
      await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
      await expect(globeHost).toHaveAttribute('data-earth-phase', dark ? 'night' : 'day')
    }
    else {
      await page.waitForTimeout(renderer === 'tiled' ? 800 : 350)
    }
    const dimensions = await earthSurface.evaluate(element => ({
      height: element.getBoundingClientRect().height,
      width: element.getBoundingClientRect().width,
    }))
    expect(dimensions.width).toBeGreaterThan(240)
    expect(dimensions.height).toBeGreaterThan(240)
    await testInfo.attach(`earth-${label}.png`, {
      // Capture the compositor output. Direct WebGL canvas screenshots can be blank
      // when preserveDrawingBuffer is disabled even though the page renders correctly.
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await testInfo.attach(`earth-surface-${label}.png`, {
      body: await earthSurface.screenshot(),
      contentType: 'image/png',
    })
    if (renderer === 'realistic') {
      const canvas = earthSurface.locator('canvas')
      await expect(canvas).toBeVisible()
      await expect(earthSurface.locator('.earth-static-fallback')).toHaveCount(0)
      const renderedPixels = await canvas.evaluate((element) => {
        const canvasElement = element as HTMLCanvasElement
        const context = canvasElement.getContext('webgl2') || canvasElement.getContext('webgl')
        if (!context)
          return { alphaPixels: 0, averageLuminance: 0, height: canvasElement.height, width: canvasElement.width }

        const sampleWidth = Math.min(canvasElement.width, 96)
        const sampleHeight = Math.min(canvasElement.height, 96)
        const startX = Math.floor((canvasElement.width - sampleWidth) / 2)
        const startY = Math.floor((canvasElement.height - sampleHeight) / 2)
        const pixels = new Uint8Array(sampleWidth * sampleHeight * 4)
        context.readPixels(startX, startY, sampleWidth, sampleHeight, context.RGBA, context.UNSIGNED_BYTE, pixels)
        let alphaPixels = 0
        let luminanceSum = 0
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 0) {
            alphaPixels += 1
            luminanceSum += pixels[index - 3]! * 0.2126 + pixels[index - 2]! * 0.7152 + pixels[index - 1]! * 0.0722
          }
        }
        return {
          alphaPixels,
          averageLuminance: alphaPixels ? luminanceSum / alphaPixels : 0,
          height: canvasElement.height,
          width: canvasElement.width,
        }
      })
      expect(renderedPixels.width).toBeGreaterThan(0)
      expect(renderedPixels.height).toBeGreaterThan(0)
      expect(renderedPixels.alphaPixels).toBeGreaterThan(500)
      expect(renderedPixels.averageLuminance).toBeGreaterThan(dark ? 12 : 30)
    }

    const viewportMetrics = await page.locator('html').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(viewportMetrics.scrollWidth).toBe(viewportMetrics.clientWidth)
    expect(errors).toEqual([])
  })
}

test('realistic globe combines a solar terminator, Black Marble lights, and transparent atmosphere', async ({ context }) => {
  test.slow()
  const darkPage = await context.newPage()
  const lightPage = await context.newPage()
  await Promise.all([
    openEarthPage(darkPage, 'realistic', true),
    openEarthPage(lightPage, 'realistic', false),
  ])

  const darkHost = darkPage.locator('.earth-globe-host')
  const lightHost = lightPage.locator('.earth-globe-host')
  await Promise.all([
    expect(darkHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 }),
    expect(lightHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 }),
  ])

  for (const host of [darkHost, lightHost]) {
    await expect(host).toHaveAttribute('data-lighting-model', 'solar-terminator')
    await expect(host).toHaveAttribute('data-city-lights', 'nasa-black-marble-2016')
    await expect(host).toHaveAttribute('data-city-light-density', 'black-marble-weighted')
    await expect(host).toHaveAttribute('data-atmosphere-model', 'solar-dual-tone-gradient')
    await expect(host).toHaveAttribute('data-atmosphere-transmission', 'meteor-visible')
    await expect(host).toHaveAttribute('data-city-twinkle', 'static')
    await expect(host).toHaveAttribute('data-solar-refresh-ms', '60000')
    expect(Number(await host.getAttribute('data-night-geography-strength'))).toBeGreaterThanOrEqual(0.7)
    expect(Number(await host.getAttribute('data-day-surface-strength'))).toBeGreaterThan(1)
    expect(await host.getAttribute('data-atmosphere-day-color')).not.toBe(
      await host.getAttribute('data-atmosphere-night-color'),
    )
    const solarPoint = {
      lat: Number(await host.getAttribute('data-subsolar-lat')),
      lng: Number(await host.getAttribute('data-subsolar-lng')),
    }
    expect(solarPoint.lat).toBeGreaterThanOrEqual(-23.5)
    expect(solarPoint.lat).toBeLessThanOrEqual(23.5)
    expect(solarPoint.lng).toBeGreaterThanOrEqual(-180)
    expect(solarPoint.lng).toBeLessThanOrEqual(180)
  }

  expect(Number(await darkHost.getAttribute('data-city-light-strength'))).toBeGreaterThan(
    Number(await lightHost.getAttribute('data-city-light-strength')),
  )

  const layerContract = await darkPage.locator('.realistic-earth-shell').evaluate((shell) => {
    const globeHost = shell.querySelector<HTMLElement>('.earth-globe-host')
    const meteorOverlay = shell.querySelector<HTMLElement>('.earth-meteor-overlay')
    if (!globeHost || !meteorOverlay)
      throw new Error('Realistic globe visual layers are missing')
    const darkHalo = getComputedStyle(shell, '::after')
    return {
      globeZ: Number(getComputedStyle(globeHost).zIndex),
      haloBackgroundImage: darkHalo.backgroundImage,
      haloFilter: darkHalo.filter,
      haloInnerRadius: Number.parseFloat(darkHalo.getPropertyValue('--earth-halo-inner-radius')),
      haloMaskImage: darkHalo.maskImage,
      haloOpacity: Number(darkHalo.opacity),
      haloOuterRadius: Number.parseFloat(darkHalo.getPropertyValue('--earth-halo-outer-radius')),
      haloVisibleRadius: Number.parseFloat(darkHalo.getPropertyValue('--earth-visible-radius')),
      haloZ: Number(darkHalo.zIndex),
      meteorZ: Number(getComputedStyle(meteorOverlay).zIndex),
    }
  })
  const lightHaloOpacity = await lightPage.locator('.realistic-earth-shell').evaluate(shell => (
    Number(getComputedStyle(shell, '::after').opacity)
  ))
  await expect(darkHost).toHaveAttribute('data-dark-atmosphere-halo', 'enhanced')
  await expect(lightHost).toHaveAttribute('data-dark-atmosphere-halo', 'minimal')
  await expect(darkHost).toHaveAttribute('data-atmosphere-day-color', '#93daff')
  await expect(darkHost).toHaveAttribute('data-atmosphere-night-color', '#60a5fa')
  expect(Number(await darkHost.getAttribute('data-visible-earth-radius'))).toBeGreaterThan(200)
  expect(Number(await darkHost.getAttribute('data-atmosphere-halo-width'))).toBeGreaterThanOrEqual(48)
  expect(layerContract.haloBackgroundImage).toContain('linear-gradient')
  expect(layerContract.haloFilter).toContain('blur(10px)')
  expect(layerContract.haloMaskImage).toContain('radial-gradient')
  expect(layerContract.haloOpacity).toBe(1)
  expect(layerContract.haloInnerRadius).toBeLessThan(layerContract.haloVisibleRadius)
  expect(layerContract.haloOuterRadius - layerContract.haloVisibleRadius).toBeGreaterThanOrEqual(48)
  expect(lightHaloOpacity).toBe(0)
  expect(layerContract.globeZ).toBeLessThan(layerContract.haloZ)
  expect(layerContract.haloZ).toBeLessThan(layerContract.meteorZ)
})

test('realistic day and night stay visibly distinct while both retain terrain detail', async ({ context }, testInfo) => {
  const dayPage = await context.newPage()
  const nightPage = await context.newPage()
  await Promise.all([
    installKomariFixture(dayPage, {
      dark: true,
      earthRenderer: 'realistic',
      fixedNow: '2026-07-25T05:00:00.000Z',
    }),
    installKomariFixture(nightPage, {
      dark: true,
      earthRenderer: 'realistic',
      fixedNow: '2026-07-25T17:00:00.000Z',
    }),
  ])
  await Promise.all([dayPage.goto('/'), nightPage.goto('/')])

  const dayHost = dayPage.locator('.earth-globe-host')
  const nightHost = nightPage.locator('.earth-globe-host')
  await Promise.all([
    expect(dayHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 }),
    expect(nightHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 }),
  ])
  await dayPage.waitForTimeout(500)
  await nightPage.waitForTimeout(500)

  const [dayPixels, nightPixels] = await Promise.all([
    readCentralGlobePixels(dayPage),
    readCentralGlobePixels(nightPage),
  ])
  expect(dayPixels.alphaPixels).toBeGreaterThan(10_000)
  expect(nightPixels.alphaPixels).toBeGreaterThan(10_000)
  const dayNightRatio = dayPixels.averageLuminance / nightPixels.averageLuminance
  await testInfo.attach('realistic-day-night-pixels.json', {
    body: Buffer.from(JSON.stringify({ dayPixels, nightPixels, dayNightRatio }, null, 2)),
    contentType: 'application/json',
  })
  expect(dayNightRatio).toBeGreaterThan(1.5)
  expect(nightPixels.averageLuminance).toBeGreaterThan(18)
  expect(nightPixels.luminanceDeviation).toBeGreaterThan(10)
  expect(nightPixels.warmLightPixels).toBeGreaterThan(120)
})

test('realistic East Asia night lights preserve dense coastal and sparse inland tiers', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'realistic',
    fixedNow: '2026-07-25T17:00:00.000Z',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  await page.waitForTimeout(600)

  const nightPixels = await readCentralGlobePixels(page)
  expect(nightPixels.warmLightPixels).toBeGreaterThan(300)
  expect(nightPixels.softWarmLightPixels).toBeGreaterThan(nightPixels.brightWarmLightPixels)
  expect(nightPixels.saturatedWarmLightPixels).toBeLessThanOrEqual(
    Math.ceil(nightPixels.warmLightPixels * 0.3),
  )
  await testInfo.attach('realistic-east-asia-night-pixels.json', {
    body: Buffer.from(JSON.stringify(nightPixels, null, 2)),
    contentType: 'application/json',
  })
  const screenshotPath = testInfo.outputPath('realistic-east-asia-night.png')
  await page.locator('.realistic-earth-shell').screenshot({ path: screenshotPath })
  await testInfo.attach('realistic-east-asia-night.png', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('realistic light mode suppresses the artificial ocean spotlight', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: false,
    earthRenderer: 'realistic',
    fixedNow: '2026-07-25T12:00:00.000Z',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  await expect(globeHost).toHaveAttribute('data-light-ocean-specular', 'suppressed')
  await expect(globeHost).toHaveAttribute('data-day-warm-compression', '1.00')
  const canvasBox = await globeHost.locator('canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  for (let index = 0; index < 2; index += 1) {
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.30, canvasBox!.y + canvasBox!.height * 0.18)
    await page.mouse.down()
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.70, canvasBox!.y + canvasBox!.height * 0.18, { steps: 16 })
    await page.mouse.up()
    await page.waitForTimeout(220)
  }
  await page.waitForTimeout(400)

  const screenshotPath = testInfo.outputPath('realistic-light-ocean-without-spotlight.png')
  await page.locator('.realistic-earth-shell').screenshot({ path: screenshotPath })
  await testInfo.attach('realistic-light-ocean-without-spotlight.png', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('realistic light mode keeps sunlit desert terrain comfortable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: false,
    earthRenderer: 'realistic',
    fixedNow: '2026-07-25T12:00:00.000Z',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const canvasBox = await globeHost.locator('canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.30, canvasBox!.y + canvasBox!.height * 0.18)
  await page.mouse.down()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.70, canvasBox!.y + canvasBox!.height * 0.18, { steps: 16 })
  await page.mouse.up()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.30, canvasBox!.y + canvasBox!.height * 0.18)
  await page.mouse.down()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.50, canvasBox!.y + canvasBox!.height * 0.18, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)

  const lightPixels = await readCentralGlobePixels(page, { x: 0.56, y: 0.48 })
  expect(lightPixels.averageLuminance).toBeGreaterThan(42)
  expect(lightPixels.hotWarmSurfacePixels).toBeLessThan(lightPixels.alphaPixels * 0.22)
  await testInfo.attach('realistic-light-desert-pixels.json', {
    body: Buffer.from(JSON.stringify(lightPixels, null, 2)),
    contentType: 'application/json',
  })
  const screenshotPath = testInfo.outputPath('realistic-light-desert-comfortable.png')
  await page.locator('.realistic-earth-shell').screenshot({ path: screenshotPath })
  await testInfo.attach('realistic-light-desert-comfortable.png', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('realistic North America night lights retain settlement-weighted detail after rotation', async ({ page }, testInfo) => {
  test.slow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'realistic',
    fixedNow: '2026-07-25T05:00:00.000Z',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const canvasBox = await globeHost.locator('canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.30, canvasBox!.y + canvasBox!.height * 0.18)
    await page.mouse.down()
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.70, canvasBox!.y + canvasBox!.height * 0.18, { steps: 16 })
    await page.mouse.up()
    await page.waitForTimeout(220)
  }

  const nightPixels = await readCentralGlobePixels(page)
  expect(nightPixels.warmLightPixels).toBeGreaterThan(120)
  expect(nightPixels.saturatedWarmLightPixels).toBeLessThanOrEqual(
    Math.ceil(nightPixels.warmLightPixels * 0.3),
  )
  await testInfo.attach('realistic-north-america-night-pixels.json', {
    body: Buffer.from(JSON.stringify(nightPixels, null, 2)),
    contentType: 'application/json',
  })
  const screenshotPath = testInfo.outputPath('realistic-north-america-night.png')
  await page.locator('.realistic-earth-shell').screenshot({ path: screenshotPath })
  await testInfo.attach('realistic-north-america-night.png', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('realistic Australia night lights keep populated coasts visible without urban bloom', async ({ page }, testInfo) => {
  test.slow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'realistic',
    fixedNow: '2026-07-25T17:00:00.000Z',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const canvasBox = await globeHost.locator('canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.60, canvasBox!.y + canvasBox!.height * 0.18)
    await page.mouse.down()
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.60, canvasBox!.y + canvasBox!.height * 0.08, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(180)
  }
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.76, canvasBox!.y + canvasBox!.height * 0.18)
  await page.mouse.down()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.61, canvasBox!.y + canvasBox!.height * 0.18, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(400)

  const nightPixels = await readCentralGlobePixels(page, { x: 0.24, y: 0.80 })
  expect(nightPixels.warmLightPixels).toBeGreaterThan(20)
  expect(nightPixels.saturatedWarmLightPixels).toBeLessThanOrEqual(
    Math.ceil(nightPixels.warmLightPixels * 0.3),
  )
  await testInfo.attach('realistic-australia-night-pixels.json', {
    body: Buffer.from(JSON.stringify(nightPixels, null, 2)),
    contentType: 'application/json',
  })
  const screenshotPath = testInfo.outputPath('realistic-australia-night.png')
  await page.locator('.realistic-earth-shell').screenshot({ path: screenshotPath })
  await testInfo.attach('realistic-australia-night.png', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('realistic dark halo remains visible in the wide low-height production composition', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1630, height: 574 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'realistic',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const halo = await page.locator('.realistic-earth-shell').evaluate((shell) => {
    const style = getComputedStyle(shell, '::after')
    return {
      backgroundImage: style.backgroundImage,
      filter: style.filter,
      maskImage: style.maskImage,
      opacity: Number(style.opacity),
    }
  })
  expect(halo.backgroundImage).toContain('linear-gradient')
  expect(halo.filter).toContain('blur(10px)')
  expect(halo.maskImage).toContain('radial-gradient')
  expect(halo.opacity).toBe(1)

  const screenshotPath = testInfo.outputPath('realistic-wide-dark.png')
  await page.screenshot({ path: screenshotPath })
  await testInfo.attach('realistic-wide-dark.png', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('realistic solar lighting follows manual globe rotation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    disablePageAnimation: false,
    earthRenderer: 'realistic',
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  await expect(globeHost).toHaveAttribute('data-city-twinkle', 'animated')
  const initialSunDirection = (await globeHost.getAttribute('data-sun-view'))
    ?.split(',')
    .map(Number) ?? []
  expect(initialSunDirection).toHaveLength(3)

  const canvasBox = await globeHost.locator('canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.58, canvasBox!.y + canvasBox!.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.78, canvasBox!.y + canvasBox!.height * 0.25, { steps: 12 })
  await page.mouse.up()

  await expect.poll(async () => {
    const current = (await globeHost.getAttribute('data-sun-view'))?.split(',').map(Number) ?? []
    return Math.hypot(
      (current[0] ?? 0) - (initialSunDirection[0] ?? 0),
      (current[1] ?? 0) - (initialSunDirection[1] ?? 0),
      (current[2] ?? 0) - (initialSunDirection[2] ?? 0),
    )
  }).toBeGreaterThan(0.05)

  await testInfo.attach('realistic-solar-lighting-after-drag.png', {
    body: await page.locator('.realistic-earth-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('realistic globe accepts drag gestures through uncovered node-grid space while cards stay interactive', async ({ page }) => {
  await page.setViewportSize({ width: 1630, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    disablePageAnimation: false,
    earthRenderer: 'realistic',
    nodeLimit: 2,
    stopEarth: true,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const exposedDrag = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.earth-globe-host')
    if (!host)
      return null

    const rect = host.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const radius = Math.min(rect.width, rect.height) * 0.46
    for (let y = centerY + radius * 0.72; y >= centerY + radius * 0.08; y -= 18) {
      for (let x = centerX + radius * 0.78; x >= centerX + radius * 0.08; x -= 18) {
        const endX = x - 72
        const endY = y + 8
        const startTarget = document.elementFromPoint(x, y)
        const endTarget = document.elementFromPoint(endX, endY)
        if (startTarget?.closest('.earth-globe-host') && endTarget?.closest('.earth-globe-host'))
          return { endX, endY, startX: x, startY: y }
      }
    }
    return null
  })
  expect(exposedDrag).not.toBeNull()

  const cardStillBlocksEarth = await page.locator('.node-card').first().evaluate((card) => {
    const rect = card.getBoundingClientRect()
    return Boolean(document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + Math.min(32, rect.height / 2),
    )?.closest('.node-card'))
  })
  expect(cardStillBlocksEarth).toBe(true)

  const initialSunDirection = (await globeHost.getAttribute('data-sun-view'))
    ?.split(',')
    .map(Number) ?? []
  expect(initialSunDirection).toHaveLength(3)
  await page.mouse.move(exposedDrag!.startX, exposedDrag!.startY)
  await page.mouse.down()
  await page.mouse.move(exposedDrag!.endX, exposedDrag!.endY, { steps: 12 })
  await page.mouse.up()

  await expect.poll(async () => {
    const current = (await globeHost.getAttribute('data-sun-view'))?.split(',').map(Number) ?? []
    return Math.hypot(
      (current[0] ?? 0) - (initialSunDirection[0] ?? 0),
      (current[1] ?? 0) - (initialSunDirection[1] ?? 0),
      (current[2] ?? 0) - (initialSunDirection[2] ?? 0),
    )
  }).toBeGreaterThan(0.03)
})

test('tiled light ocean keeps visible depth while the dark palette stays unchanged', async ({ context }) => {
  const lightPage = await context.newPage()
  const darkPage = await context.newPage()
  await Promise.all([
    openEarthPage(lightPage, 'tiled', false),
    openEarthPage(darkPage, 'tiled', true),
  ])

  const readPalette = async (page: Page) => page.locator('.earth-map-shell').evaluate((shell) => {
    const readColor = (selector: string, property: string): number[] => {
      const element = shell.querySelector<SVGElement>(selector)
      if (!element)
        throw new Error(`Missing tiled-map layer: ${selector}`)
      return getComputedStyle(element)
        .getPropertyValue(property)
        .match(/[\d.]+/g)
        ?.map(Number) ?? []
    }
    const overlay = shell.querySelector<SVGElement>('.paper-overlay')
    if (!overlay)
      throw new Error('Missing tiled-map paper overlay')

    return {
      bottom: readColor('.ocean-stop-bottom', 'stop-color'),
      graticule: readColor('.graticule line', 'stroke'),
      middle: readColor('.ocean-stop-middle', 'stop-color'),
      paper: readColor('.paper-line', 'stroke'),
      paperOpacity: Number(getComputedStyle(overlay).opacity),
      top: readColor('.ocean-stop-top', 'stop-color'),
    }
  })

  const lightPalette = await readPalette(lightPage)
  expect(lightPalette.top.slice(0, 3)).toEqual([232, 244, 248])
  expect(lightPalette.middle.slice(0, 3)).toEqual([215, 234, 241])
  expect(lightPalette.bottom.slice(0, 3)).toEqual([198, 223, 232])
  expect(lightPalette.paper.at(3)).toBeGreaterThanOrEqual(0.1)
  expect(lightPalette.graticule.at(3)).toBeGreaterThanOrEqual(0.1)
  expect(lightPalette.paperOpacity).toBeGreaterThanOrEqual(0.8)

  const darkPalette = await readPalette(darkPage)
  expect(darkPalette.top.slice(0, 3)).toEqual([10, 31, 43])
  expect(darkPalette.bottom.slice(0, 3)).toEqual([5, 20, 30])
  expect(darkPalette.paper.at(3)).toBeLessThanOrEqual(0.05)
  expect(darkPalette.graticule.at(3)).toBeCloseTo(0.13, 2)
})

test('realistic and cobe share the same short-wide globe geometry', async ({ context }, testInfo) => {
  const realisticPage = await context.newPage()
  const cobePage = await context.newPage()
  await realisticPage.setViewportSize({ width: 1920, height: 900 })
  await cobePage.setViewportSize({ width: 1920, height: 900 })
  await installKomariFixture(realisticPage, { dark: true, earthRenderer: 'realistic' })
  await installKomariFixture(cobePage, { dark: true, earthRenderer: 'cobe' })
  await Promise.all([realisticPage.goto('/'), cobePage.goto('/')])

  await expect(realisticPage.locator('.earth-globe-host')).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  await expect(cobePage.locator('.cobe-globe-stage')).toBeVisible()

  const realisticGeometry = await realisticPage.locator('.realistic-earth-shell').evaluate((shell) => {
    const stage = shell.querySelector<HTMLElement>('.earth-globe-host')
    if (!stage)
      throw new Error('Realistic globe stage is missing')
    const shellRect = shell.getBoundingClientRect()
    return {
      height: shellRect.height,
      top: shellRect.top,
      transform: getComputedStyle(stage).transform,
      width: shellRect.width,
    }
  })
  const cobeGeometry = await cobePage.locator('.cobe-earth-shell').evaluate((shell) => {
    const stage = shell.querySelector<HTMLElement>('.cobe-globe-stage')
    if (!stage)
      throw new Error('Cobe globe stage is missing')
    const shellRect = shell.getBoundingClientRect()
    return {
      height: shellRect.height,
      top: shellRect.top,
      transform: getComputedStyle(stage).transform,
      width: shellRect.width,
    }
  })

  expect(Math.abs(realisticGeometry.width - cobeGeometry.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(realisticGeometry.height - cobeGeometry.height)).toBeLessThanOrEqual(1)
  expect(Math.abs(realisticGeometry.top - cobeGeometry.top)).toBeLessThanOrEqual(1)
  expect(realisticGeometry.transform).toBe(cobeGeometry.transform)
  await testInfo.attach('realistic-short-wide.png', {
    body: await realisticPage.screenshot(),
    contentType: 'image/png',
  })
  await testInfo.attach('cobe-short-wide.png', {
    body: await cobePage.screenshot(),
    contentType: 'image/png',
  })
})

test('realistic globe diameter is constrained by both viewport width and usable height', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1114 })
  await installKomariFixture(page, { dark: true, earthRenderer: 'realistic' })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const geometry = await page.locator('.realistic-earth-shell').evaluate((shell) => {
    const stage = shell.querySelector<HTMLElement>('.earth-globe-host')
    if (!stage)
      throw new Error('Realistic globe stage is missing')
    const shellRect = shell.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    return {
      shellHeight: shellRect.height,
      shellTop: shellRect.top,
      shellWidth: shellRect.width,
      stageTop: stageRect.top,
      transform: getComputedStyle(stage).transform,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })

  const expectedDiameterCeiling = Math.min(
    geometry.viewportWidth * 0.44,
    geometry.viewportHeight - 8.5 * 16,
    49 * 16,
  )
  expect(geometry.shellWidth).toBeLessThanOrEqual(expectedDiameterCeiling + 1)
  expect(Math.abs(geometry.shellHeight - geometry.shellWidth)).toBeLessThanOrEqual(1)
  expect(geometry.shellTop).toBeGreaterThanOrEqual(0)
  expect(geometry.stageTop).toBeGreaterThanOrEqual(geometry.shellTop - 1)
  expect(geometry.transform).toBe('none')
  await testInfo.attach('realistic-height-constrained-2048x1114.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})

test('realistic globe emits a staggered group through the shared meteor renderer', async ({ page }, testInfo) => {
  test.slow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'realistic',
    disablePageAnimation: false,
  })
  await page.goto('/')

  const globeHost = page.locator('.earth-globe-host')
  await expect(globeHost).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  const overlay = page.locator('.realistic-earth-shell .earth-meteor-overlay')
  await expect(overlay).toHaveAttribute('data-meteor-renderer', 'shared-svg')
  await expect(overlay).toHaveAttribute('data-meteor-count', '3')
  await expect(overlay).toHaveAttribute('data-meteor-interval-ms', '5000')
  await expect(overlay).toHaveAttribute('data-meteor-flight-ms', '3200')
  await expect(overlay).toHaveAttribute('data-meteor-phase', 'flying')
  await expect(overlay).toHaveAttribute('data-meteor-completed-count', '0')
  await expect(overlay.locator('.earth-meteor-stroke')).toHaveCount(3)
  await expect(overlay.locator('.earth-meteor-aura')).toHaveCount(3)
  await expect(overlay.locator('.earth-meteor-core')).toHaveCount(3)
  const batchContract = await overlay.locator('.earth-meteor-beam').evaluateAll(beams => ({
    launchOrders: beams.map(beam => Number((beam as HTMLElement).dataset.launchOrder)).sort(),
    targetIds: beams.map(beam => beam.querySelector<SVGPathElement>('.earth-meteor-stroke')?.dataset.targetId),
  }))
  expect(batchContract.launchOrders).toEqual([0, 1, 2])
  expect(new Set(batchContract.targetIds).size).toBe(1)
  const readLongArcGeometry = () => overlay.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const radiusReference = Math.min(rect.width, rect.height)
    const paths = Array.from(element.querySelectorAll<SVGPathElement>('.earth-meteor-stroke'))
    const measurements = paths.map((path) => {
      const values = (path.dataset.fullPathD ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
      const startX = values[0] ?? 0
      const startY = values[1] ?? 0
      const targetX = values.at(-2) ?? 0
      const targetY = values.at(-1) ?? 0
      const radialX = targetX - rect.width / 2
      const radialY = targetY - rect.height / 2
      const approachX = targetX - startX
      const approachY = targetY - startY
      const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      measure.setAttribute('d', path.dataset.fullPathD ?? 'M 0 0')
      return {
        approachSide: Math.sign(radialX * approachY - radialY * approachX),
        length: measure.getTotalLength(),
        startX,
        startY,
      }
    })
    const startDistances = measurements.flatMap((current, index) =>
      measurements.slice(index + 1).map(next =>
        Math.hypot(current.startX - next.startX, current.startY - next.startY),
      ),
    )
    return {
      approachSides: measurements.map(item => item.approachSide),
      minimumStartDistance: Math.min(...startDistances),
      minimumLength: Math.min(...measurements.map(item => item.length)),
      radiusReference,
    }
  })
  const firstSequence = Number(await overlay.getAttribute('data-meteor-sequence'))
  const drillingTransition = await overlay.evaluate(async (element) => {
    const readState = () => {
      const path = element.querySelector<SVGPathElement>(
        '.earth-meteor-beam[data-launch-order="0"] .earth-meteor-stroke',
      )
      if (!path)
        return null
      const targetX = Number(path.dataset.targetX)
      const targetY = Number(path.dataset.targetY)
      const headX = Number(path.dataset.headX)
      const headY = Number(path.dataset.headY)
      const tailX = Number(path.dataset.tailX)
      const tailY = Number(path.dataset.tailY)
      return {
        headDistance: Math.hypot(headX - targetX, headY - targetY),
        opacity: Number(getComputedStyle(path).opacity),
        pathLength: path.getTotalLength(),
        phase: path.dataset.motionPhase,
        tailDistance: Math.hypot(tailX - targetX, tailY - targetY),
        tailProgress: Number(path.dataset.tailProgress),
        visibility: getComputedStyle(path).visibility,
      }
    }
    type DrillingState = NonNullable<ReturnType<typeof readState>>
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const deadline = performance.now() + 10_000
    let drillingStart: DrillingState | null = null
    let drillingLater: DrillingState | null = null
    let landed: DrillingState | null = null

    while (performance.now() < deadline) {
      const state = readState()
      if (state?.phase === 'drilling' && state.tailProgress < 0.62) {
        drillingStart = state
        break
      }
      await nextFrame()
    }
    while (performance.now() < deadline) {
      if (!drillingStart)
        break
      const state = readState()
      if (
        state?.phase === 'drilling'
        && state.tailProgress > drillingStart.tailProgress
        && state.tailDistance < drillingStart.tailDistance - 0.01
        && state.pathLength < drillingStart.pathLength - 0.01
      ) {
        drillingLater = state
        break
      }
      await nextFrame()
    }
    while (performance.now() < deadline) {
      if (!drillingLater)
        break
      const state = readState()
      if (state?.phase === 'landed') {
        landed = state
        break
      }
      await nextFrame()
    }

    return { drillingLater, drillingStart, landed }
  })
  expect(drillingTransition.drillingStart).not.toBeNull()
  expect(drillingTransition.drillingLater).not.toBeNull()
  expect(drillingTransition.landed).not.toBeNull()
  const drillingStart = drillingTransition.drillingStart!
  expect(drillingStart.phase).toBe('drilling')
  expect(drillingStart.headDistance).toBeLessThanOrEqual(0.2)
  expect(drillingStart.tailDistance).toBeGreaterThan(8)
  expect(drillingStart.pathLength).toBeGreaterThan(8)
  expect(drillingStart.opacity).toBeGreaterThan(0.95)
  expect(drillingStart.visibility).toBe('visible')

  const drillingLater = drillingTransition.drillingLater!
  expect(drillingLater.phase).toBe('drilling')
  expect(drillingLater.headDistance).toBeLessThanOrEqual(0.2)
  expect(drillingLater.tailProgress).toBeGreaterThan(drillingStart.tailProgress)
  expect(drillingLater.tailDistance).toBeLessThan(drillingStart.tailDistance)
  expect(drillingLater.pathLength).toBeLessThan(drillingStart.pathLength)
  expect(drillingLater.visibility).toBe('visible')

  const landed = drillingTransition.landed!
  expect(landed.headDistance).toBeLessThanOrEqual(0.2)
  expect(landed.tailDistance).toBeLessThanOrEqual(0.2)
  expect(landed.visibility).toBe('hidden')

  const longArcSamples: Awaited<ReturnType<typeof readLongArcGeometry>>[] = []
  await expect.poll(async () => {
    const geometry = await readLongArcGeometry()
    if (
      Number.isFinite(geometry.minimumLength)
      && Number.isFinite(geometry.minimumStartDistance)
      && geometry.approachSides.length === 3
    ) {
      longArcSamples.push(geometry)
      return true
    }
    return false
  }, { intervals: [40], timeout: 10_000 }).toBe(true)
  const longArcGeometry = longArcSamples.at(-1)!
  expect(longArcGeometry.minimumLength).toBeGreaterThan(longArcGeometry.radiusReference * 0.32)
  expect(longArcGeometry.minimumLength).toBeLessThan(longArcGeometry.radiusReference * 0.76)
  expect(longArcGeometry.minimumStartDistance).toBeGreaterThan(longArcGeometry.radiusReference * 0.15)
  expect(new Set(longArcGeometry.approachSides).size).toBeGreaterThanOrEqual(2)

  await expect.poll(async () => Number(await overlay.getAttribute('data-meteor-sequence')), {
    timeout: 12_000,
  }).toBeGreaterThan(firstSequence)
  await expect(overlay).toHaveAttribute('data-meteor-count', '3')
  await page.waitForTimeout(1_200)
  await testInfo.attach('earth-meteor-group.png', {
    body: await page.locator('.realistic-earth-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('meteor batch advances only after all three tails drill into the shared target', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'realistic',
    disablePageAnimation: false,
  })
  await page.goto('/')

  const overlay = page.locator('.realistic-earth-shell .earth-meteor-overlay')
  await expect(overlay).toHaveAttribute('data-meteor-count', '3', { timeout: 15_000 })
  const firstSequence = Number(await overlay.getAttribute('data-meteor-sequence'))
  await expect.poll(
    () => overlay.evaluate((element, initialSequence) => {
      const currentSequence = Number((element as HTMLElement).dataset.meteorSequence)
      const completedCount = Number((element as HTMLElement).dataset.meteorCompletedCount)
      const meteorCount = element.querySelectorAll('.earth-meteor-stroke').length
      const phase = (element as HTMLElement).dataset.meteorPhase
      return currentSequence > initialSequence
        || (
          currentSequence === initialSequence
          && completedCount === 3
          && meteorCount === 0
          && phase === 'cooldown'
        )
    }, firstSequence),
    { timeout: 5_200 },
  ).toBe(true)

  await expect.poll(
    async () => Number(await overlay.getAttribute('data-meteor-sequence')),
    { timeout: 6_800 },
  ).toBeGreaterThan(firstSequence)
  await expect(overlay).toHaveAttribute('data-meteor-count', '3')
})

test('cobe globe uses the same transient meteor renderer and keeps it attached to projected flags', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'cobe',
    disablePageAnimation: false,
    stopEarth: true,
  })
  await page.goto('/')

  const stage = page.locator('.cobe-globe-stage')
  const overlay = stage.locator('.earth-meteor-overlay')
  await expect(overlay).toHaveAttribute('data-meteor-renderer', 'shared-svg')
  await expect(overlay).toHaveAttribute('data-meteor-count', '3')
  await expect(overlay).toHaveAttribute('data-meteor-interval-ms', '5000')
  await expect(overlay).toHaveAttribute('data-meteor-flight-ms', '3200')
  await expect(overlay.locator('.earth-meteor-stroke')).toHaveCount(3)
  const meteorVisual = await overlay.locator('.earth-meteor-stroke').first().evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animationName: style.animationName,
      linecap: style.strokeLinecap,
      opacity: Number(style.opacity),
      width: Number.parseFloat(style.strokeWidth),
    }
  })
  expect(meteorVisual.animationName).toBe('none')
  expect(meteorVisual.linecap).toBe('round')
  expect(meteorVisual.opacity).toBe(1)
  expect(meteorVisual.width).toBeCloseTo(1.6, 2)
  const readAlignment = () => stage.evaluate((element) => {
    const paths = Array.from(element.querySelectorAll<SVGPathElement>('.earth-meteor-stroke'))
    const labels = Array.from(element.querySelectorAll<HTMLElement>('[data-cluster-id]'))
    const targetDistances = paths.map((path) => {
      const label = labels.find(item => item.dataset.clusterId === path.dataset.targetId)
      if (!label)
        return Number.POSITIVE_INFINITY
      const targetX = Number(path.dataset.targetX)
      const targetY = Number(path.dataset.targetY)
      const projectedX = Number(label.dataset.projectedX)
      const projectedY = Number(label.dataset.projectedY)
      if (![targetX, targetY, projectedX, projectedY].every(Number.isFinite))
        return Number.POSITIVE_INFINITY
      return Math.hypot(projectedX - targetX, projectedY - targetY)
    })
    const markerDistances = labels.map((label) => {
      const anchorName = `--cobe-cdn-${label.dataset.clusterId?.toLowerCase()}`
      const anchor = Array.from(element.querySelectorAll<HTMLElement>('div[style]'))
        .find(item => item.style.cssText.includes(anchorName))
      if (!anchor)
        return Number.POSITIVE_INFINITY
      const stageRect = element.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      return Math.hypot(
        anchorRect.left - stageRect.left - Number(label.dataset.projectedX),
        anchorRect.top - stageRect.top - Number(label.dataset.projectedY),
      )
    })
    return {
      markerDistances,
      targetDistances,
    }
  })
  const readArrivalTangency = () => overlay.evaluate((element) => {
    const path = element.querySelector<SVGPathElement>('.earth-meteor-stroke')
    if (!path)
      return Number.POSITIVE_INFINITY
    const values = (path.dataset.fullPathD ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    if (values.length < 8)
      return Number.POSITIVE_INFINITY
    const targetX = values.at(-2)!
    const targetY = values.at(-1)!
    const controlX = values.at(-4)!
    const controlY = values.at(-3)!
    const stageRect = element.getBoundingClientRect()
    const radialX = targetX - stageRect.width / 2
    const radialY = targetY - stageRect.height / 2
    const arrivalX = targetX - controlX
    const arrivalY = targetY - controlY
    const divisor = Math.hypot(radialX, radialY) * Math.hypot(arrivalX, arrivalY)
    return divisor > 0 ? Math.abs((radialX * arrivalX + radialY * arrivalY) / divisor) : 1
  })
  await expect.poll(
    async () => {
      const alignment = await readAlignment()
      const aligned = Math.max(...alignment.markerDistances) <= 1
        && Math.max(...alignment.targetDistances) <= 1
      return aligned
    },
    { intervals: [40, 60, 80], timeout: 5_200 },
  ).toBe(true)
  await expect.poll(
    readArrivalTangency,
    { intervals: [40, 60, 80], timeout: 5_200 },
  ).toBeLessThan(0.35)
  await expect(overlay.locator('linearGradient').first().locator('stop')).toHaveCount(5)
  const firstSequence = Number(await overlay.getAttribute('data-meteor-sequence'))
  await expect.poll(async () => Number(await overlay.getAttribute('data-meteor-sequence')), {
    timeout: 6_800,
  }).toBeGreaterThan(firstSequence)
  await expect(overlay.locator('.earth-meteor-stroke')).toHaveCount(3)
  await testInfo.attach('cobe-meteor-group.png', {
    body: await page.locator('.cobe-earth-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('shared meteor renderer lets the globe occlude a target rotating onto the rear hemisphere', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'cobe',
    disablePageAnimation: false,
    stopEarth: true,
  })
  await page.goto('/')

  const stage = page.locator('.cobe-globe-stage')
  const overlay = stage.locator('.earth-meteor-overlay')
  await expect(overlay).toHaveAttribute('data-meteor-count', '3', { timeout: 15_000 })
  await expect(stage.locator('[data-cluster-id]').first()).toBeVisible()
  // The initial batch can be created before the asynchronous geolocation
  // metadata settles. Wait for a fresh batch whose target still exists in the
  // rendered cluster set so this assertion covers real rear-hemisphere
  // occlusion rather than only stale-target invalidation.
  await expect.poll(async () => {
    const targetId = await overlay.getAttribute('data-meteor-target-id')
    if (!targetId)
      return false
    return stage.locator('[data-cluster-id]').evaluateAll(
      (elements, id) => elements.some(element => (element as HTMLElement).dataset.clusterId === id),
      targetId,
    )
  }, { timeout: 8_000 }).toBe(true)
  await expect(overlay).toHaveAttribute('data-meteor-target-visible', 'true')

  // Keyboard rotation uses the same update path as pointer dragging, but avoids
  // viewport-dependent hit testing from making rear-hemisphere coverage flaky.
  let targetMovedBehind = false
  for (let attempt = 0; attempt < 28; attempt += 1) {
    await stage.dispatchEvent('keydown', { key: 'ArrowRight' })
    await page.waitForTimeout(20)
    if (await overlay.getAttribute('data-meteor-target-visible') === 'false') {
      targetMovedBehind = true
      break
    }
  }

  expect(targetMovedBehind).toBe(true)
  await expect(overlay).toHaveAttribute('data-meteor-target-visible', 'false')
  await expect(overlay).toHaveAttribute('data-meteor-occluded', 'true')
  await expect(overlay.locator('mask circle')).toHaveCount(1)
  const maskGeometry = await overlay.locator('mask circle').evaluate(element => ({
    cx: Number(element.getAttribute('cx')),
    cy: Number(element.getAttribute('cy')),
    radius: Number(element.getAttribute('r')),
  }))
  const overlayGeometry = await overlay.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
  }))
  expect(maskGeometry.cx).toBeCloseTo(overlayGeometry.width / 2, 0)
  expect(maskGeometry.cy).toBeCloseTo(overlayGeometry.height / 2, 0)
  expect(maskGeometry.radius).toBeGreaterThan(Math.min(overlayGeometry.width, overlayGeometry.height) * 0.45)
  await expect(overlay.locator('.earth-meteor-beam')).toHaveCount(3)
  await expect(overlay.locator('.earth-meteor-beam').first()).toHaveAttribute('data-occluded', 'true')
  await expect(overlay.locator('.earth-meteor-beam').first()).toHaveAttribute('mask', /earth-meteor-occlusion/)
  await testInfo.attach('cobe-rear-hemisphere-meteor-occlusion.png', {
    body: await page.locator('.cobe-earth-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('realistic and cobe expose an identical shared meteor visual contract', async ({ context }) => {
  const realisticPage = await context.newPage()
  const cobePage = await context.newPage()
  await Promise.all([
    installKomariFixture(realisticPage, {
      dark: true,
      earthRenderer: 'realistic',
      disablePageAnimation: false,
    }),
    installKomariFixture(cobePage, {
      dark: true,
      earthRenderer: 'cobe',
      disablePageAnimation: false,
      stopEarth: false,
    }),
  ])
  await Promise.all([realisticPage.goto('/'), cobePage.goto('/')])

  const realisticOverlay = realisticPage.locator('.realistic-earth-shell .earth-meteor-overlay')
  const cobeOverlay = cobePage.locator('.cobe-earth-shell .earth-meteor-overlay')
  await expect(realisticOverlay).toHaveAttribute('data-meteor-count', '3', { timeout: 15_000 })
  await expect(cobeOverlay).toHaveAttribute('data-meteor-count', '3', { timeout: 15_000 })

  const visualContract = async (overlay: typeof realisticOverlay) => overlay.locator('.earth-meteor-stroke').first().evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animationName: style.animationName,
      linecap: style.strokeLinecap,
      opacity: style.opacity,
      pathLength: element.getAttribute('pathLength'),
      strokeWidth: style.strokeWidth,
      vectorEffect: style.vectorEffect,
    }
  })

  expect(await visualContract(cobeOverlay)).toEqual(await visualContract(realisticOverlay))
})

test('cobe switches to its light palette without replacing or blanking the canvas', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'cobe',
    disablePageAnimation: false,
    stopEarth: false,
  })
  await page.goto('/')

  const stage = page.locator('.cobe-globe-stage')
  const canvas = stage.locator('canvas')
  await expect(stage).toHaveAttribute('data-cobe-theme', 'dark')
  await expect(stage).toHaveAttribute('data-cobe-palette', 'orbital-ice')
  await expect(stage).toHaveAttribute('data-cobe-visual', 'orbital-grid')
  await expect(stage).toHaveAttribute('data-ambient-light-count', '32')
  await expect(stage.locator('.cobe-grid-line')).toHaveCount(9)
  await expect(stage.locator('.cobe-orbit-track')).toHaveCount(3)
  await expect(stage.locator('.cobe-orbit-particle')).toHaveCount(3)
  await expect(stage.locator('.cobe-orbit-spark-cross')).toHaveCount(6)
  await expect(stage.locator('.cobe-starbursts i')).toHaveCount(7)
  await expect(canvas).toBeVisible()
  const meteorOverlay = stage.locator('.earth-meteor-overlay')
  await expect(meteorOverlay).toHaveAttribute('data-meteor-count', '3')
  const darkMeteorColors = await meteorOverlay.locator('linearGradient').evaluateAll(gradients =>
    gradients.map(gradient => gradient.querySelector('stop:last-child')?.getAttribute('stop-color')),
  )
  await canvas.evaluate((element) => {
    element.dataset.themeSwitchProbe = 'same-canvas'
  })

  await page.getByRole('button', { name: /自动主题（当前深色）|深色主题/ }).click()

  await expect(stage).toHaveAttribute('data-cobe-theme', 'light')
  await expect(canvas).toHaveAttribute('data-theme-switch-probe', 'same-canvas')
  await expect(canvas).toBeVisible()
  await expect(stage.locator('canvas')).toHaveCount(1)
  await expect(page.locator('html')).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  const lightMeteorColors = await meteorOverlay.locator('linearGradient').evaluateAll(gradients =>
    gradients.map(gradient => gradient.querySelector('stop:last-child')?.getAttribute('stop-color')),
  )
  expect(new Set(lightMeteorColors).size).toBe(3)
  expect(lightMeteorColors).not.toEqual(darkMeteorColors)
  await expect.poll(
    () => canvas.evaluate(element => getComputedStyle(element).filter),
  ).toContain('brightness(1.08)')

  const atmosphere = stage.locator('.cobe-atmosphere')
  const atmosphereVisual = await atmosphere.evaluate((element) => {
    const own = element.getBoundingClientRect()
    const parent = element.parentElement!.getBoundingClientRect()
    return {
      widthRatio: own.width / parent.width,
      background: getComputedStyle(element).backgroundImage,
    }
  })
  expect(atmosphereVisual.widthRatio).toBeGreaterThan(0.93)
  expect(atmosphereVisual.widthRatio).toBeLessThan(0.96)
  expect(atmosphereVisual.background).toContain('radial-gradient')

  await page.waitForTimeout(500)
  await testInfo.attach('cobe-live-theme-switch-light.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })

  await page.getByRole('button', { name: '浅色主题' }).click()
  await expect(stage).toHaveAttribute('data-cobe-theme', 'dark')
  await expect(canvas).toHaveAttribute('data-theme-switch-probe', 'same-canvas')
  await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  await expect.poll(
    () => canvas.evaluate(element => getComputedStyle(element).filter),
  ).toContain('brightness(0.98)')
})

test('cobe planets follow fixed globe-space orbits with rear-side occlusion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'cobe',
    disablePageAnimation: false,
    stopEarth: true,
  })
  await page.goto('/')

  const stage = page.locator('.cobe-globe-stage')
  const orbitLayer = stage.locator('.cobe-orbit-layer')
  const tracks = orbitLayer.locator('.cobe-orbit-track')
  const planets = orbitLayer.locator('.cobe-orbit-spark')
  const canvas = stage.locator('canvas')

  await expect(orbitLayer).toHaveAttribute('data-orbit-space', 'globe')
  await expect(orbitLayer).toHaveAttribute('data-orbit-occlusion', 'front-hemisphere')
  await expect(tracks).toHaveCount(3)
  await expect(planets).toHaveCount(3)
  await expect.poll(async () => tracks.evaluateAll(elements => elements.map((element) => {
    const path = element.getAttribute('d') || ''
    const visibleRatio = Number((element as SVGPathElement).dataset.visibleRatio)
    return path.includes('M') && path.includes('L') && visibleRatio > 0.45 && visibleRatio < 0.55
  }).every(Boolean))).toBe(true)

  const initialPlanetTransforms = await planets.evaluateAll(elements =>
    elements.map(element => element.getAttribute('transform')),
  )
  await page.waitForTimeout(320)
  const movedPlanetTransforms = await planets.evaluateAll(elements =>
    elements.map(element => element.getAttribute('transform')),
  )
  expect(movedPlanetTransforms).not.toEqual(initialPlanetTransforms)

  const assertOcclusionContract = async () => {
    const states = await planets.evaluateAll(elements => elements.map((element) => {
      const depth = Number((element as SVGGElement).dataset.orbitDepth)
      const visible = (element as SVGGElement).dataset.orbitVisible === 'true'
      const style = getComputedStyle(element)
      return { depth, visible, visibility: style.visibility, opacity: Number(style.opacity) }
    }))
    expect(states.every(state => Number.isFinite(state.depth))).toBe(true)
    expect(states.every(state => state.depth >= 0
      ? state.visible && state.visibility === 'visible' && state.opacity >= 0
      : !state.visible && state.visibility === 'hidden' && state.opacity === 0)).toBe(true)
    return states
  }

  const beforeDragStates = await assertOcclusionContract()
  const beforeDragPath = await tracks.first().getAttribute('d')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width * 0.68, box!.y + box!.height * 0.18)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.24, box!.y + box!.height * 0.3, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => tracks.first().getAttribute('d')).not.toBe(beforeDragPath)
  const afterDragStates = await assertOcclusionContract()
  expect(afterDragStates.map(state => state.depth)).not.toEqual(beforeDragStates.map(state => state.depth))

  await testInfo.attach('cobe-fixed-orbit-planets.png', {
    body: await page.locator('.cobe-earth-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('tiled map uses legible region indexes and exposes server status on map and list hover', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await installKomariFixture(page, {
    dark: true,
    earthRenderer: 'tiled',
    geoByNode: true,
  })
  await page.goto('/')

  const mapMarkers = page.locator('.node-marker-group')
  await expect(mapMarkers).toHaveCount(12)
  await expect(mapMarkers.nth(0).locator('.cluster-index text')).toHaveText('1')
  await expect(mapMarkers.nth(1).locator('.cluster-index text')).toHaveText('2')

  const firstIndexStyle = await mapMarkers.nth(0).locator('.cluster-index').evaluate((element) => {
    const circle = element.querySelector('circle')
    const text = element.querySelector('text')
    if (!circle || !text)
      throw new Error('Tiled index is incomplete')
    return {
      fill: getComputedStyle(circle).fill,
      fontWeight: Number.parseInt(getComputedStyle(text).fontWeight),
      textFill: getComputedStyle(text).fill,
    }
  })
  expect(firstIndexStyle.fill).toBe('rgb(250, 204, 21)')
  expect(firstIndexStyle.fontWeight).toBeGreaterThanOrEqual(800)
  expect(firstIndexStyle.textFill).toBe('rgb(44, 22, 4)')
  const flagCount = await page.locator('.node-marker-group .map-flag').count()
  expect(flagCount).toBeGreaterThan(0)
  await expect(page.locator('.flag-stem-halo')).toHaveCount(flagCount)
  const stemVisual = await page.locator('.flag-stem').first().evaluate(element => ({
    width: Number.parseFloat(getComputedStyle(element).strokeWidth),
    stroke: getComputedStyle(element).stroke,
    filter: getComputedStyle(element).filter,
  }))
  expect(stemVisual.width).toBeGreaterThanOrEqual(1.8)
  expect(stemVisual.stroke).not.toBe('none')
  expect(stemVisual.filter).not.toBe('none')

  const tooltip = page.getByTestId('tiled-cluster-tooltip')
  await mapMarkers.nth(0).locator('.node-dot').hover({ force: true })
  await expect(tooltip).toBeHidden()

  await mapMarkers.nth(0).locator('.map-flag').hover()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('主控-洛杉矶')
  await expect(tooltip).toContainText('在线')

  await mapMarkers.nth(0).locator('.cluster-index').hover()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('主控-洛杉矶')
  await testInfo.attach('tiled-flag-index-hover.png', {
    body: await page.locator('.earth-map-shell').screenshot(),
    contentType: 'image/png',
  })

  const firstRegionCard = page.locator('.map-region-list article').first()
  await firstRegionCard.hover()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('主控-洛杉矶')
  await expect(firstRegionCard.locator('em')).toHaveText('×1')
})

test('realistic and cobe visual spheres rise close to the shell top without clipping', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await installKomariFixture(page, { dark: true, earthRenderer: 'realistic' })
  await page.goto('/')
  await expect(page.locator('.earth-globe-host')).toHaveAttribute('data-render-ready', 'true', { timeout: 15_000 })
  await page.waitForTimeout(500)

  await expect.poll(async () => {
    const topRatio = await page.locator('.earth-globe-host canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (!context)
        return 1
      const width = context.drawingBufferWidth
      const height = context.drawingBufferHeight
      const pixels = new Uint8Array(width * height * 4)
      context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
      const minimumOpaquePixels = Math.max(4, Math.floor(width * 0.006))
      for (let row = height - 1; row >= 0; row -= 1) {
        let opaquePixels = 0
        for (let column = 0; column < width; column += 2) {
          if (pixels[(row * width + column) * 4 + 3]! > 16)
            opaquePixels += 1
        }
        if (opaquePixels >= minimumOpaquePixels)
          return (height - 1 - row) / height
      }
      return 1
    })
    return topRatio > 0.005 && topRatio < 0.05
  }, {
    message: 'wait for a complete WebGL frame before measuring the globe top edge',
    timeout: 5_000,
  }).toBe(true)

  await installKomariFixture(page, { dark: true, earthRenderer: 'cobe' })
  await page.reload()
  const cobeStage = page.locator('.cobe-globe-stage')
  await expect(cobeStage).toBeVisible()
  await expect(cobeStage).toHaveAttribute('data-visual-scale', '1.18')
  await testInfo.attach('earth-cobe-top-alignment.png', {
    body: await page.locator('.cobe-earth-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('tiled map condenses a distributed high-density node set', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installKomariFixture(page, {
    dark: false,
    earthRenderer: 'tiled',
    disablePageAnimation: false,
    geoByNode: true,
  })
  await page.goto('/')

  const map = page.locator('.earth-map-shell')
  await expect(map).toBeVisible()
  await expect(map.locator('.node-markers .map-flag')).toHaveCount(12)
  await expect(map.locator('.map-region-list article')).toHaveCount(12)
  await expect(map.locator('.map-region-list article').first()).toContainText('在线')
  await expect(map.locator('.map-region-panel')).toContainText('节点分布')
  await expect(map.locator('.map-region-panel')).toContainText('92% 在线')
  await expect(map.locator('.map-region-list article').filter({ hasText: '1 在线' }).first()).toContainText('×1')
  await expect(map.locator('.cluster-count')).toHaveCount(0)
  const onlinePulse = await map.locator('.node-pulse.is-online').first().evaluate(element => ({
    animationDuration: getComputedStyle(element).animationDuration,
    animationName: getComputedStyle(element).animationName,
  }))
  const offlinePulse = await map.locator('.node-pulse.is-offline').first().evaluate(element => ({
    animationDuration: getComputedStyle(element).animationDuration,
    animationName: getComputedStyle(element).animationName,
  }))
  expect(onlinePulse.animationName).toContain('map-node-breathe')
  expect(onlinePulse.animationDuration).toBe('3.15s')
  expect(offlinePulse.animationName).toContain('map-node-offline-breathe')
  expect(offlinePulse.animationDuration).toBe('1.7s')
  const overlapCount = await map.locator('.node-markers').evaluate((element) => {
    const markers = Array.from(element.querySelectorAll<SVGGElement>('.node-marker-group'))
    const dots = markers.map(marker => marker.querySelector<SVGCircleElement>('.node-dot')!.getBoundingClientRect())
    return markers.reduce((total, marker) => {
      const flag = marker.querySelector<SVGImageElement>('.map-flag')!.getBoundingClientRect()
      const index = marker.querySelector<SVGGElement>('.cluster-index')!.getBoundingClientRect()
      const target = {
        left: Math.min(flag.left, index.left),
        right: Math.max(flag.right, index.right),
        top: Math.min(flag.top, index.top),
        bottom: Math.max(flag.bottom, index.bottom),
      }
      return total + dots.filter(dot =>
        dot.left < target.right + 2
        && dot.right > target.left - 2
        && dot.top < target.bottom + 2
        && dot.bottom > target.top - 2,
      ).length
    }, 0)
  })
  expect(overlapCount).toBe(0)
  const connectorInterferenceCount = await map.locator('.node-markers').evaluate((element) => {
    interface Point {
      x: number
      y: number
    }
    interface Segment {
      start: Point
      end: Point
    }
    interface Box {
      left: number
      right: number
      top: number
      bottom: number
    }
    const orientation = (first: Point, second: Point, third: Point) =>
      (second.y - first.y) * (third.x - second.x)
      - (second.x - first.x) * (third.y - second.y)
    const intersects = (first: Segment, second: Segment) =>
      orientation(first.start, first.end, second.start)
      * orientation(first.start, first.end, second.end) < 0
      && orientation(second.start, second.end, first.start)
      * orientation(second.start, second.end, first.end) < 0
    const segmentHitsBox = (segment: Segment, box: Box) => {
      const corners = [
        { x: box.left, y: box.top },
        { x: box.right, y: box.top },
        { x: box.right, y: box.bottom },
        { x: box.left, y: box.bottom },
      ]
      return corners.some((corner, index) => intersects(segment, {
        start: corner,
        end: corners[(index + 1) % corners.length]!,
      }))
    }
    const svg = element.closest('svg')
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix)
      throw new Error('Tiled map SVG matrix is unavailable')
    const toScreenPoint = (x: number, y: number) => {
      const point = svg.createSVGPoint()
      point.x = x
      point.y = y
      const screen = point.matrixTransform(matrix)
      return { x: screen.x, y: screen.y }
    }
    const groups = Array.from(element.querySelectorAll<SVGGElement>('.node-marker-group'))
    const targets = groups.map((group) => {
      const flag = group.querySelector<SVGImageElement>('.map-flag')!.getBoundingClientRect()
      const index = group.querySelector<SVGGElement>('.cluster-index')!.getBoundingClientRect()
      return {
        id: group.dataset.markerId,
        box: {
          left: Math.min(flag.left, index.left) - 2,
          right: Math.max(flag.right, index.right) + 2,
          top: Math.min(flag.top, index.top) - 2,
          bottom: Math.max(flag.bottom, index.bottom) + 2,
        },
      }
    })
    return groups.reduce((total, group) => {
      const line = group.querySelector<SVGLineElement>('.flag-stem')!
      const segment = {
        start: toScreenPoint(Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))),
        end: toScreenPoint(Number(line.getAttribute('x2')), Number(line.getAttribute('y2'))),
      }
      return total + targets.filter(target =>
        target.id !== group.dataset.markerId && segmentHitsBox(segment, target.box),
      ).length
    }, 0)
  })
  expect(connectorInterferenceCount).toBe(0)
  await testInfo.attach('earth-tiled-dense-light.png', {
    body: await map.screenshot(),
    contentType: 'image/png',
  })
})
