import { expect, test } from '@playwright/test'

const SECTION_NAMES = [
  '基础与外观',
  '首页布局',
  '首页总览卡片',
  '节点卡片、列表与快捷控制',
  '详情页与图表',
  '隐私与显示',
  '高级与兼容',
]

test('managed theme page adds sticky category tabs, scrollspy and one save action', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/admin/theme_managed', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html>
      <html class="dark">
        <head>
          <meta charset="UTF-8">
          <link rel="stylesheet" href="/admin-app/glass-admin.css">
        </head>
        <body>
          <div id="root">
            <div class="admin-scroll" style="height: 900px; overflow-y: auto;">
            <main class="rt-Flex p-2 md:p-4">
              <div class="rt-Flex">
                <h1 class="rt-Heading">GlassOps 主题管理</h1>
                <button type="button">保存</button>
              </div>
              <hr>
              <div class="rt-Flex settings">
                ${SECTION_NAMES.map((name, index) => `
                  <h2 class="rt-Heading mt-4">${String(index + 1).padStart(2, '0')} · ${name}</h2>
                  <section style="height: 310px;">${name}设置内容</section>
                `).join('')}
              </div>
              <footer><button type="button">保存</button></footer>
            </main>
            </div>
          </div>
          <script src="/admin-app/glass-admin-enhancements.js"></script>
        </body>
      </html>`,
  }))

  await page.goto('/admin/theme_managed')

  const nav = page.getByRole('tablist', { name: '主题设置分类' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('tab')).toHaveCount(SECTION_NAMES.length + 1)
  await expect(nav.getByRole('tab', { name: '全部设置' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.glass-theme-managed-header')).toHaveCSS('position', 'sticky')
  await expect(page.locator('.glass-theme-managed-bottom-save')).toBeHidden()

  for (const [index, name] of SECTION_NAMES.entries()) {
    const heading = page.getByRole('heading', { name: new RegExp(name) })
    await expect(heading).toHaveClass(new RegExp(`glass-theme-managed-section-tone-${index % 7 + 1}`))
  }
  const headingColors = await page.locator('.glass-theme-managed-section').evaluateAll(
    elements => elements.map(element => getComputedStyle(element).color),
  )
  expect(new Set(headingColors).size).toBe(1)

  await nav.getByRole('tab', { name: '首页总览卡片' }).click()
  await expect(nav.getByRole('tab', { name: '首页总览卡片' })).toHaveAttribute('aria-selected', 'true')
  await expect.poll(async () => page.locator('.admin-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(300)

  await page.locator('.admin-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(nav.getByRole('tab', { name: '高级与兼容' })).toHaveAttribute('aria-selected', 'true')
  await testInfo.attach('native-managed-theme.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
