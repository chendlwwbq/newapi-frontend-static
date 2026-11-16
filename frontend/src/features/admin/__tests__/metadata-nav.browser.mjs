import assert from 'node:assert/strict'

// Called by the local production browser harness with an authenticated fixture page.
export async function checkMetadataNavigation(page) {
  const expectedPaths = [
    '/models/metadata',
    '/models/vendors',
    '/models/deployments',
    '/models/prefill',
    '/models/sync',
    '/models/pricing',
    '/models/pricing-sync',
    '/system-settings/groups',
  ]
  await page.goto('http://127.0.0.1:3025/models/metadata')
  const nav = page.locator('.admin-subnav')
  await nav.getByRole('link', { name: 'Models', exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {}))
      )
    })
    await nav.evaluate((element) => {
      element.scrollLeft = 0
    })
    const layout = await nav.evaluate((element) => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      scrollWidth: element.scrollWidth,
      width: element.clientWidth,
      links: [...element.querySelectorAll('a')].map((link) => {
        const range = document.createRange()
        range.selectNodeContents(link)
        const text = range.getBoundingClientRect()
        const box = link.getBoundingClientRect()
        return {
          href: link.getAttribute('href'),
          current: link.getAttribute('aria-current'),
          left: box.left,
          right: box.right,
          textLeft: text.left,
          textRight: text.right,
        }
      }),
    }))
    assert.deepEqual(
      layout.links.map((link) => link.href),
      expectedPaths
    )
    assert.equal(layout.links.filter((link) => link.current === 'page').length, 1)
    assert.equal(layout.links[0].current, 'page')
    assert.ok(layout.pageWidth <= layout.viewportWidth + 1, `Page overflows at ${width}px`)
    for (const [index, link] of layout.links.entries()) {
      assert.ok(link.textLeft >= link.left - 1 && link.textRight <= link.right + 1, `Navigation label overflows its link at ${width}px: ${link.href}`)
      if (index > 0) assert.ok(link.textLeft >= layout.links[index - 1].textRight, `Navigation labels overlap at ${width}px`)
    }
    if (width <= 390) assert.ok(layout.scrollWidth > layout.width, 'Narrow navigation must scroll locally')
    const links = nav.getByRole('link')
    await links.first().focus()
    for (let index = 1; index < expectedPaths.length; index++) await page.keyboard.press('Tab')
    assert.equal(await links.last().evaluate((link) => document.activeElement === link), true)
    await page.waitForFunction(() => {
      const link = document.activeElement
      const nav = link?.closest('.admin-subnav')
      if (!link || !nav) return false
      const box = link.getBoundingClientRect()
      const container = nav.getBoundingClientRect()
      return box.left >= container.left - 1 && box.right <= container.right + 1
    })
    const focused = await links.last().boundingBox()
    const container = await nav.boundingBox()
    assert.ok(
      focused && container && focused.x >= container.x - 1 && focused.x + focused.width <= container.x + container.width + 1,
      `Last navigation link is not visible after keyboard focus at ${width}px`
    )
  }
}
