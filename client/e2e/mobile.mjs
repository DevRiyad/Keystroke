import { tmpdir } from 'node:os'
import { chromium, devices } from 'playwright'
import { check, summary } from './lib.mjs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const URL = process.env.E2E_URL ?? 'http://localhost:5173/'

async function session(name) {
  const dev = { ...devices[name] }; delete dev.defaultBrowserType
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...dev, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  const cdp = await ctx.newCDPSession(page)
  return { browser, ctx, page, errors, cdp, dev }
}
const input = (page) => page.$eval('input[aria-label="Typing input"]', (e) => e.value)

;(async () => {
  for (const name of ['iPhone SE', 'iPhone 13', 'Pixel 7']) {
    console.log(`\n# ${name}`)
    const { browser, page, errors, cdp, dev } = await session(name)
    await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload()
    await page.waitForSelector('input[aria-label="Typing input"]')
    console.log(`   viewport ${dev.viewport.width}x${dev.viewport.height}, touch=${dev.hasTouch}, mobile=${dev.isMobile}`)

    const info = await page.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      active: document.activeElement?.tagName,
      fs: getComputedStyle(document.querySelector('input[aria-label="Typing input"]')).fontSize,
      meta: document.querySelector('meta[name="viewport"]')?.content,
      sw: document.documentElement.scrollWidth, iw: innerWidth,
      hint: document.body.textContent.includes('click here or press any key to focus'),
    }))
    check('coarse pointer detected', info.coarse)
    check('does NOT autofocus (no surprise keyboard on load)', info.active === 'BODY', info.active)
    check('typing input font-size >= 16px (no iOS zoom on focus)', parseFloat(info.fs) >= 16, info.fs)
    check('viewport meta allows zoom (no user-scalable=no)', info.meta && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(info.meta), info.meta)
    check('no horizontal overflow', info.sw <= info.iw, `${info.sw} > ${info.iw}`)
    check('focus hint is visible', info.hint)

    // tap the typing area -> focuses the input (this is what opens the soft keyboard)
    const box = await page.$eval('section[aria-label="Typing test"] .typing-text', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
    await page.touchscreen.tap(box.x, box.y)
    check('tap on the text focuses the typing input', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Typing input')

    // toolbar via touch: words 10
    await page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: 'words', exact: true }).tap()
    await page.getByRole('group', { name: 'Number of words' }).getByRole('button', { name: '10', exact: true }).tap()
    await page.touchscreen.tap(box.x, box.y)
    const words = (await page.textContent('#typing-target')).split(' ')

    // soft keyboards commit text without keydown: simulate by inserting text through CDP
    await cdp.send('Input.insertText', { text: words[0].slice(0, 2) })
    check('soft-keyboard text insertion reaches the engine', (await input(page)) === ' ' + words[0].slice(0, 2), JSON.stringify(await input(page)))

    // IME / predictive composition, simulated the way browsers do it: the field value contains the
    // composing text, each update REPLACES it (isComposing=true), then compositionend.
    await page.evaluate((w) => {
      const el = document.querySelector('input[aria-label="Typing input"]')
      const base = el.value // ' ' + first two letters
      const fire = (v, type) => { el.value = v; el.dispatchEvent(new InputEvent('input', { inputType: type, isComposing: true, bubbles: true })) }
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      fire(base + w[2] + 'X', 'insertCompositionText') // wrong prediction
      fire(base + w.slice(2), 'insertCompositionText') // replaced by the right one
      el.dispatchEvent(new CompositionEvent('compositionend', { data: w.slice(2), bubbles: true }))
    }, words[0])
    await sleep(50)
    check('composition (predictive text) ends with the right word', (await input(page)) === ' ' + words[0], JSON.stringify(await input(page)))
    const wrongSeen = await page.$$eval('section[aria-label="Typing test"] .flex.flex-wrap > span:first-child > span', (l) => l.filter((c) => c.className.includes('text-error')).length)
    check('the replaced prediction left no stray mistakes on screen', wrongSeen === 0, String(wrongSeen))
    await cdp.send('Input.insertText', { text: ' ' })
    check('space from the soft keyboard commits the word', (await input(page)) === ' ')

    // Android-style Backspace at the start of a word: keydown 229/Unidentified, then the browser empties the mirror input
    await cdp.send('Input.insertText', { text: 'zz ' })
    check('wrong word committed', (await input(page)) === ' ')
    await page.evaluate(() => {
      const el = document.querySelector('input[aria-label="Typing input"]')
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 229, bubbles: true, cancelable: true }))
      el.value = ''
      el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }))
    })
    await sleep(50)
    check('Backspace at word start returns to the wrong word', (await input(page)) === ' zz', JSON.stringify(await input(page)))
    await page.evaluate(() => {
      const el = document.querySelector('input[aria-label="Typing input"]')
      el.value = ' z'; el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }))
      el.value = ' '; el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }))
    })
    await sleep(50)
    check('deleting the rest of the word works', (await input(page)) === ' ', JSON.stringify(await input(page)))

    // paste must be blocked
    await page.evaluate(() => {
      const el = document.querySelector('input[aria-label="Typing input"]')
      const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); ev.clipboardData.setData('text', 'cheat'); window.__pasteBlocked = !el.dispatchEvent(ev)
    })
    check('paste is blocked', await page.evaluate(() => window.__pasteBlocked))

    // finish the test using soft-keyboard style input only
    await cdp.send('Input.insertText', { text: words.join(' ') })
    await page.waitForSelector('section[aria-label="Test results"]', { timeout: 5000 })
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    check('whole test completed with soft-keyboard-style input; results fit the screen', sw)

    // touch targets
    const small = await page.$$eval('button, a[href], input, [role="radio"], [role="switch"]', (els) =>
      els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && !e.classList.contains('sr-only') })
        .map((e) => `${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 28)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`))
    check('all touch targets >= 24x24 CSS px (WCAG 2.2 AA minimum)', small.length === 0, small.join(' | '))
    const medium = await page.$$eval('button, a[href], [role="radio"], [role="switch"]', (els) =>
      els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44) && !e.classList.contains('sr-only') }).length)
    console.log(`   advisory: ${medium} controls are smaller than 44x44 px (recommended size, not a requirement)`)
    await page.screenshot({ path: `${tmpdir()}/mob-${name.replace(/ /g, '')}.png`, fullPage: true })
    check('no console errors', errors.length === 0, errors.join('|'))
    await browser.close()
  }

  console.log('\n# Soft keyboard opening (viewport shrinks) and landscape')
  {
    const { browser, page, errors } = await session('iPhone 13')
    await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload()
    await page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: 'time', exact: true }).tap()
    const box = await page.$eval('section[aria-label="Typing test"] .typing-text', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + 20, y: r.y + 10 } })
    await page.touchscreen.tap(box.x, box.y)
    await page.keyboard.insertText('abc')
    const before = page.viewportSize()
    await page.setViewportSize({ width: before.width, height: 330 }) // roughly what is left when a keyboard opens
    await sleep(300)
    const vis = await page.evaluate(() => {
      const c = document.querySelector('.caret').getBoundingClientRect()
      return { top: c.top, bottom: c.bottom, h: innerHeight }
    })
    check('caret stays visible after the viewport shrinks (keyboard open)', vis.top >= 0 && vis.bottom <= vis.h, JSON.stringify(vis))
    await page.setViewportSize({ width: 844, height: 390 })
    await sleep(200)
    const land = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
    check('landscape: no horizontal overflow', land.sw <= land.iw, JSON.stringify(land))
    check('no console errors', errors.length === 0, errors.join('|'))
    await browser.close()
  }
  process.exit(summary() ? 1 : 0)
})()
