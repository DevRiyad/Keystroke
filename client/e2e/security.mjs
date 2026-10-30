import { launch, check, summary } from './lib.mjs'
const BASE = process.env.E2E_URL ?? 'http://localhost:5173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mode = (page, m) => page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: m, exact: true }).click()
;(async () => {
  console.log('# XSS: custom text with HTML/script payloads is rendered as plain text')
  {
    const { browser, page, errors } = await launch()
    await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload()
    await mode(page, 'custom')
    const payload = '<img src=x onerror=window.__xss=1> <script>window.__xss=2</script> "><svg/onload=window.__xss=3> javascript:alert(1)'
    await page.fill('#custom-text', payload)
    await page.getByRole('button', { name: 'start' }).click()
    await sleep(200)
    const r = await page.evaluate(() => ({
      xss: window.__xss,
      injected: document.querySelectorAll('section[aria-label="Typing test"] img, section[aria-label="Typing test"] svg[onload], main script').length,
      text: document.querySelector('#typing-target').textContent,
    }))
    check('no script executed', r.xss === undefined, String(r.xss))
    check('no injected elements', r.injected === 0, String(r.injected))
    check('payload shown as literal text', r.text.includes('<img src=x onerror=window.__xss=1>'), r.text.slice(0, 60))
    await page.keyboard.type(r.text.slice(0, 40))
    check('typing the payload does not execute it', (await page.evaluate(() => window.__xss)) === undefined)
    check('no console errors', errors.length === 0, errors.join('|'))
    await browser.close()
  }

  console.log('\n# Tampered / corrupt localStorage')
  for (const [name, settings, config] of [
    ['garbage values', { theme: '<script>', fontSize: { a: 1 }, font: 7, cursorStyle: null, sound: 'yes', typingMode: 'hax' }, { mode: 'hax', duration: 7, wordCount: -1, punctuation: 'x', customText: 'a'.repeat(5000) }],
    ['prototype pollution keys', JSON.parse('{"__proto__":{"polluted":1},"theme":"dark"}'), JSON.parse('{"__proto__":{"polluted":2},"mode":"words","wordCount":50}')],
  ]) {
    const { browser, page, errors } = await launch()
    await page.addInitScript(([s, c]) => { localStorage.setItem('keystroke.settings.v1', s); localStorage.setItem('keystroke.config.v1', c) }, [JSON.stringify(settings), JSON.stringify(config)])
    await page.goto(BASE)
    await page.waitForSelector('input[aria-label="Typing input"]')
    const r = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, polluted: ({}).polluted, pressed: [...document.querySelectorAll('[aria-label="Test mode"] button[aria-pressed="true"]')].map((b) => b.textContent.trim()) }))
    check(`${name}: app loads with safe values`, ['yellow', 'dark'].includes(r.theme) && r.polluted === undefined, JSON.stringify(r))
    check(`${name}: no console errors`, errors.length === 0, errors.join('|'))
    await browser.close()
  }
  {
    const { browser, page, errors } = await launch()
    await page.addInitScript(() => { localStorage.setItem('keystroke.settings.v1', '{not json'); localStorage.setItem('keystroke.config.v1', '[[[') })
    await page.goto(BASE); await page.waitForSelector('input[aria-label="Typing input"]')
    check('corrupt JSON: app loads with defaults', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'yellow' && errors.length === 0, errors.join('|'))
    await browser.close()
  }

  console.log('\n# localStorage blocked / throwing (privacy mode)')
  {
    const { browser, page, errors } = await launch()
    await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError') } }) })
    await page.goto(BASE); await page.waitForSelector('input[aria-label="Typing input"]')
    await mode(page, 'words')
    await page.getByRole('group', { name: 'Number of words' }).getByRole('button', { name: '10', exact: true }).click()
    await page.keyboard.type(await page.textContent('#typing-target'))
    await page.waitForSelector('section[aria-label="Test results"]')
    check('typing test fully works without storage', true)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('radio', { name: 'light' }).click()
    check('settings still apply for the session', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
    check('no console errors', errors.length === 0, errors.join('|'))
    await browser.close()
  }

  console.log('\n# Network behaviour: the client makes no API/network calls by itself')
  {
    const { browser, page } = await launch()
    const reqs = []
    page.on('request', (r) => reqs.push(new URL(r.url()).origin))
    await page.goto(BASE); await page.waitForSelector('input[aria-label="Typing input"]')
    await page.keyboard.type('hello world test')
    await sleep(300)
    const external = [...new Set(reqs)].filter((o) => o !== new URL(BASE).origin)
    check('only same-origin requests (Google Fonts excluded)', external.every((o) => o.includes('fonts.g')), external.join(','))
    await browser.close()
  }

  process.exit(summary() ? 1 : 0)
})()
