// Run against the dev server: npm run dev (in another terminal), then npm run e2e
import { launch, check, summary } from './lib.mjs'
const URL = process.env.E2E_URL ?? 'http://localhost:5173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const { browser, ctx, page, errors } = await launch()
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(URL)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('input[aria-label="Typing input"]')

  const mode = (m) => page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: m, exact: true }).click()
  const pill = (group, n) => page.getByRole('group', { name: group }).getByRole('button', { name: String(n), exact: true }).click()
  const target = () => page.textContent('#typing-target')
  const mirror = () => page.$eval('input[aria-label="Typing input"]', (e) => e.value)
  const letterClasses = (w) => page.$$eval('section[aria-label="Typing test"] .flex.flex-wrap > span', (ws, i) => Array.from(ws[i].children).map((s) => s.className), w)
  const run = async (name, fn) => { console.log('\n# ' + name); try { await fn() } catch (e) { check(name + ' (threw)', false, e.message.split('\n')[0]) } }

  await run('words mode: type, error, backspace, finish, results', async () => {
    await mode('words'); await pill('Number of words', 10)
    const text = await target()
    const words = text.split(' ')
    check('10 words generated', words.length === 10, String(words.length))
    const caret0 = await page.$eval('.caret', (c) => c.style.transform)
    const wrong = words[0][0] === 'x' ? 'q' : 'x'
    await page.keyboard.type(wrong)
    let cls = await letterClasses(0)
    check('wrong key shows error color', cls[0].includes('text-error'), cls[0])
    const caret1 = await page.$eval('.caret', (c) => c.style.transform)
    await sleep(50)
    const caret1b = await page.$eval('.caret', (c) => c.style.transform)
    check('caret moved after a key', caret1b !== caret0, `${caret0} -> ${caret1b}`)
    await page.keyboard.press('Backspace')
    cls = await letterClasses(0)
    check('backspace restores untyped color', cls[0].includes('text-muted'), cls[0])
    await page.keyboard.type(text)
    await page.waitForSelector('section[aria-label="Test results"]')
    const res = await page.textContent('section[aria-label="Test results"]')
    console.log('   results text:', res.replace(/\s+/g, ' ').slice(0, 160))
    const wpm = Number((await page.textContent('section[aria-label="Test results"] p.text-6xl')).trim())
    check('results show a positive WPM', wpm > 0, String(wpm))
    const acc = res.match(/accuracy\s*(\d+)%/)
    check('accuracy < 100 because of the corrected mistake', acc && Number(acc[1]) < 100, acc && acc[1])
    check('results label says words 10', res.includes('words 10'))
    check('typing viewport collapsed (finished)', await page.$eval('section[aria-label="Typing test"] > div.typing-text', (e) => e.classList.contains('h-0')))
    await sleep(900)
    const active = await page.evaluate(() => document.activeElement?.textContent?.trim())
    check('"next test" gets focus after the delay', active === 'next test', active)
    check('screen-reader status announces completion', (await page.textContent('section[aria-label="Typing test"] > div[role="status"]')).includes('Test complete'))
  })

  await run('try again keeps text, next test changes it', async () => {
    const before = await page.evaluate(() => null)
    await page.getByRole('button', { name: 'try again' }).click()
    await sleep(100)
    const t1 = await target()
    check('typing area is back and idle', (await mirror()) === ' ')
    await page.keyboard.type(t1)
    await page.waitForSelector('section[aria-label="Test results"]')
    await page.getByRole('button', { name: 'try again' }).click()
    const t2 = await target()
    check('try again keeps the same words', t1 === t2)
    await page.keyboard.type(t2)
    await page.waitForSelector('section[aria-label="Test results"]')
    await page.getByRole('button', { name: 'next test' }).click()
    await sleep(100)
    check('next test generates new words', (await target()) !== t2)
    void before
  })

  await run('share copies the result', async () => {
    await page.keyboard.type(await target())
    await page.waitForSelector('section[aria-label="Test results"]')
    await page.getByRole('button', { name: 'share' }).click()
    await sleep(200)
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    check('clipboard has the formatted result', clip.startsWith('keystroke: ') && clip.includes('wpm') && clip.includes('words 10'), clip)
    check('status message shown', (await page.textContent('section[aria-label="Test results"] [role="status"]')).includes('copied'))
  })

  await run('time mode: live timer, expiry, results', async () => {
    await mode('time'); await pill('Duration in seconds', 15)
    const t = (await target()).split(' ')
    check('time mode starts idle showing 15', (await page.$eval('section[aria-label="Typing test"] [aria-hidden="true"] span', (e) => e.textContent)) === '15')
    await page.keyboard.type(t.slice(0, 3).join(' ') + ' ')
    await sleep(2300)
    const left = Number(await page.$eval('section[aria-label="Typing test"] [aria-hidden="true"] span', (e) => e.textContent))
    check('timer counts down after first keystroke', left <= 13 && left >= 11, String(left))
    const t0 = Date.now()
    await page.waitForSelector('section[aria-label="Test results"]', { timeout: 20000 })
    const took = Date.now() - t0
    const res = await page.textContent('section[aria-label="Test results"]')
    check('test ended by the clock at ~15s total', took < 14000 && took > 9000, `${took}ms more after 2.3s`)
    check('elapsed time is exactly 15.0s', res.includes('15.0s'), res.replace(/\s+/g, ' ').slice(0, 200))
    check('label is time 15', res.includes('time 15'))
    // keys typed after expiry must not change anything
    const stats1 = res
    await page.keyboard.type('zzz')
    check('keys after finish do not change results', (await page.textContent('section[aria-label="Test results"]')) === stats1)
  })

  await run('timer does not start on click, only on first key', async () => {
    await page.getByRole('button', { name: 'next test' }).click()
    await page.click('section[aria-label="Typing test"] .typing-text')
    await sleep(1500)
    check('still showing 15 after click + wait', (await page.$eval('section[aria-label="Typing test"] [aria-hidden="true"] span', (e) => e.textContent)) === '15')
  })

  await run('backspace across a wrong word', async () => {
    await mode('words'); await pill('Number of words', 25)
    const w = (await target()).split(' ')
    await page.keyboard.type('zz ')
    check('wrong word committed (mirror empty)', (await mirror()) === ' ')
    await page.keyboard.press('Backspace')
    check('backspace returns to the wrong word', (await mirror()) === ' zz', JSON.stringify(await mirror()))
    await page.keyboard.press('Control+Backspace')
    check('ctrl+backspace clears it', (await mirror()) === ' ')
    await page.keyboard.type(w[0] + ' ')
    await page.keyboard.press('Backspace')
    check('correct word is locked (backspace does nothing)', (await mirror()) === ' ')
  })

  await run('mobile / IME input path (input events without keydown)', async () => {
    await mode('words'); await pill('Number of words', 10)
    const w = (await target()).split(' ')
    await page.keyboard.insertText(w[0].slice(0, 3))
    check('inserted text reaches the engine', (await mirror()) === ' ' + w[0].slice(0, 3), JSON.stringify(await mirror()))
    const cls = await letterClasses(0)
    check('first 3 letters are correct', cls.slice(0, 3).every((c) => c.includes('text-text')), cls.slice(0, 3).join(','))
    await page.keyboard.insertText(w[0].slice(3) + ' ')
    check('trailing space commits the word', (await mirror()) === ' ')
  })

  await run('zen mode', async () => {
    await mode('zen')
    check('punctuation toggle disabled in zen', await page.getByRole('button', { name: 'punctuation' }).isDisabled())
    await page.keyboard.type('hello zen world')
    await page.keyboard.press('Shift+Enter')
    await page.waitForSelector('section[aria-label="Test results"]')
    const res = await page.textContent('section[aria-label="Test results"]')
    check('zen result has 100% accuracy and zen label', res.includes('100%') && res.includes('zen'), res.replace(/\s+/g, ' ').slice(0, 120))
  })

  await run('custom mode: validation and run', async () => {
    await mode('custom')
    await page.waitForSelector('#custom-text')
    await page.getByRole('button', { name: 'start' }).click()
    check('empty text shows an error', (await page.textContent('[role="alert"]')).includes('Enter some text'))
    await page.fill('#custom-text', 'x'.repeat(41))
    await page.getByRole('button', { name: 'start' }).click()
    check('giant word is rejected', (await page.textContent('[role="alert"]')).includes('longer than'))
    await page.fill('#custom-text', 'the  quick\nbrown fox')
    await page.getByRole('button', { name: 'start' }).click()
    await sleep(150)
    check('custom words normalised', (await target()) === 'the quick brown fox', await target())
    await page.keyboard.type('the quick brown fox')
    await page.waitForSelector('section[aria-label="Test results"]')
    check('custom results label', (await page.textContent('section[aria-label="Test results"]')).includes('custom'))
  })

  await run('quote mode', async () => {
    await mode('quote')
    const t = await target()
    check('a public-domain quote is loaded', t.split(' ').length > 15 && /[.,]/.test(t), t.slice(0, 60))
  })

  await run('settings dialog, persistence, focus return', async () => {
    await mode('words'); await pill('Number of words', 10)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.waitForSelector('[role="dialog"]')
    check('sound is off by default', (await page.getByRole('switch', { name: 'sound' }).getAttribute('aria-checked')) === 'false')
    await page.getByRole('radio', { name: 'light' }).click()
    check('theme applied immediately', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
    await page.getByRole('radio', { name: 'large', exact: true }).click()
    check('font size applied', (await page.evaluate(() => document.documentElement.dataset.fontsize)) === 'large')
    await page.keyboard.press('Escape')
    await sleep(100)
    check('Escape closes the dialog', (await page.$('[role="dialog"]')) === null)
    check('focus returns to the button that opened the dialog', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Settings')
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('keystroke.settings.v1')))
    check('settings saved to localStorage', stored && stored.theme === 'light' && stored.fontSize === 'large', JSON.stringify(stored))
    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('keystroke.config.v1')))
    check('test config saved', cfg && cfg.mode === 'words' && cfg.wordCount === 10, JSON.stringify(cfg))
    await page.reload(); await page.waitForSelector('input[aria-label="Typing input"]')
    check('theme survives reload', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
    check('mode survives reload', (await page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: 'words', exact: true }).getAttribute('aria-pressed')) === 'true')
  })

  await run('strict and blind modes', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('radio', { name: 'strict' }).click()
    await page.keyboard.press('Escape'); await sleep(100)
    const w = (await target()).split(' ')
    const wrong = w[0][0] === 'q' ? 'z' : 'q'
    await page.keyboard.type(wrong)
    check('strict mode rejects the wrong key', (await mirror()) === ' ', JSON.stringify(await mirror()))
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('radio', { name: 'normal' }).click()
    await page.getByRole('switch', { name: 'blind mode' }).click()
    await page.keyboard.press('Escape'); await sleep(100)
    await page.keyboard.type(wrong)
    const cls = await letterClasses(0)
    check('blind mode hides error colour', !cls[0].includes('text-error') && cls[0].includes('text-text'), cls[0])
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('switch', { name: 'blind mode' }).click()
    await page.getByRole('button', { name: 'reset to defaults' }).click()
    check('reset restores yellow theme', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'yellow')
    await page.keyboard.press('Escape'); await sleep(100)
  })

  await run('command palette', async () => {
    await page.focus('input[aria-label="Typing input"]')
    await page.keyboard.press('Escape') // release typing focus
    await sleep(50)
    await page.keyboard.press('Escape') // open palette
    await page.waitForSelector('[role="dialog"][aria-label="Command palette"]')
    check('Esc, Esc opens the palette', true)
    await page.keyboard.type('mode: zen')
    await page.keyboard.press('Enter')
    await sleep(150)
    check('palette command switched to zen mode', (await page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: 'zen', exact: true }).getAttribute('aria-pressed')) === 'true')
    await page.keyboard.press('Control+Shift+P')
    check('Ctrl+Shift+P opens the palette', (await page.$('[role="dialog"][aria-label="Command palette"]')) !== null)
    await page.keyboard.press('Escape'); await sleep(100)
    check('palette closes with Escape', (await page.$('[role="dialog"]')) === null)
  })

  await run('tab+enter restart, confirm restart, focus handling', async () => {
    await mode('words'); await pill('Number of words', 25)
    await page.keyboard.type('abc')
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter')
    await sleep(100)
    check('Tab then Enter restarts (idle again)', (await mirror()) === ' ')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('switch', { name: 'confirm restart' }).click()
    await page.keyboard.press('Escape'); await sleep(100)
    await page.keyboard.type('abc')
    await page.getByRole('button', { name: 'Restart test' }).click()
    check('restart asks for confirmation while running', (await page.$('[role="alert"]')) !== null)
    check('confirm button takes focus', (await page.evaluate(() => document.activeElement?.textContent)).includes('restart (enter)'))
    await page.keyboard.press('Escape'); await sleep(50)
    check('Escape keeps typing (no palette opened)', (await page.$('[role="alert"]')) === null && (await page.$('[role="dialog"]')) === null)
    check('focus back in the typing input', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Typing input')
    await page.focus('input[aria-label="Typing input"]')
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter')
    check('Tab+Enter also asks', (await page.$('[role="alert"]')) !== null)
    await page.keyboard.press('Enter'); await sleep(100)
    check('Enter confirms and restarts', (await mirror()) === ' ' && (await page.$('[role="alert"]')) === null)
    await page.evaluate(() => document.activeElement.blur())
    check('blurred test shows the focus hint', (await page.textContent('section[aria-label="Typing test"]')).includes('click here or press any key'))
    await page.keyboard.type('a')
    check('a printable key anywhere focuses and types', (await mirror()) === ' a', JSON.stringify(await mirror()))
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'reset to defaults' }).click()
    await page.keyboard.press('Escape'); await sleep(100)
  })

  await run('keyboard shortcuts do not break browser shortcuts', async () => {
    await page.focus('input[aria-label="Typing input"]')
    await page.keyboard.type('ab')
    const before = await mirror()
    await page.keyboard.press('Control+a')
    check('Ctrl+A does not type a character', (await mirror()) === before, JSON.stringify(await mirror()))
  })

  await run('fast typing: no dropped/duplicated characters, line scrolling, word refill', async () => {
    await mode('time'); await pill('Duration in seconds', 120)
    const words = (await target()).split(' ')
    const spans = () => page.$$eval('section[aria-label="Typing test"] .flex.flex-wrap > span', (w) => w.length)
    const before = await spans()
    const N = 80
    await page.keyboard.type(words.slice(0, N).join(' ') + ' ', { delay: 0 })
    const correct = await page.$$eval('section[aria-label="Typing test"] .flex.flex-wrap > span', (ws, n) =>
      ws.slice(0, n).reduce((a, w) => a + Array.from(w.children).filter((c) => c.className.includes('text-text')).length, 0), N)
    const bad = await page.$$eval('section[aria-label="Typing test"] .flex.flex-wrap > span', (ws, n) =>
      ws.slice(0, n).reduce((a, w) => a + Array.from(w.children).filter((c) => c.className.includes('text-error')).length, 0), N)
    const expected = words.slice(0, N).reduce((a, w) => a + w.length, 0)
    check('every typed character registered exactly once', correct === expected && bad === 0, `correct=${correct} expected=${expected} bad=${bad}`)
    const after = await spans()
    check('word list was refilled while typing (time mode)', after > before, `${before} -> ${after}`)
    const tr = await page.$eval('.caret', (c) => c.parentElement.style.transform)
    check('text scrolled up after the first lines', /translateY\(-\d+/.test(tr), tr)
    const inside = await page.evaluate(() => {
      const c = document.querySelector('.caret').getBoundingClientRect()
      const v = document.querySelector('section[aria-label="Typing test"] > div.typing-text').getBoundingClientRect()
      return c.top >= v.top - 1 && c.bottom <= v.bottom + 1
    })
    check('caret stays inside the visible 3 lines', inside)
    check('mirror input holds only the current (empty) word', (await mirror()) === ' ')
  })

  await run('wider layout', async () => {
    await page.setViewportSize({ width: 1920, height: 900 })
    const w = await page.$eval('#root > div', (e) => e.getBoundingClientRect().width)
    check('content is up to 1400px wide on a large screen (was 1200)', w > 1350 && w <= 1400, String(w))
    await page.setViewportSize({ width: 1200, height: 800 })
  })

  await run('focus mode: only timer and text stay sharp while typing', async () => {
    await mode('words'); await pill('Number of words', 25)
    const op = (sel) => page.$eval(sel, (e) => { const s = getComputedStyle(e); return { o: Number(s.opacity), f: s.filter } })
    const faded = ['header', '#root > div > div.focus-fade:nth-of-type(1)', 'footer']
    await sleep(600)
    let h = await op('header')
    check('before typing nothing is blurred', h.o === 1 && h.f === 'none', JSON.stringify(h))
    await page.keyboard.type('a')
    await sleep(500)
    for (const [name, sel] of [['header', 'header'], ['toolbar', '.focus-fade.mt-6'], ['hints', '.focus-fade.mb-8'], ['footer', 'footer'], ['language label', 'section[aria-label="Typing test"] .focus-fade.mb-3'], ['restart row', 'section[aria-label="Typing test"] .focus-fade.mt-8']]) {
      const r = await op(sel)
      check(`${name} is blurred while typing`, r.o < 0.3 && r.f.includes('blur'), JSON.stringify(r))
    }
    const timer = await op('section[aria-label="Typing test"] > div[aria-hidden="true"]')
    const text = await op('section[aria-label="Typing test"] > div.typing-text')
    check('timer stays sharp', timer.o === 1 && timer.f === 'none', JSON.stringify(timer))
    check('typing text stays sharp', text.o >= 0.99 && text.f === 'none', JSON.stringify(text))
    check('even with the mouse resting on the toolbar it stays blurred (typing started)', (await op('.focus-fade.mt-6')).o < 0.3)
    await page.mouse.move(300, 300); await page.mouse.move(340, 330)
    await sleep(400)
    check('moving the mouse shows the UI again (peek)', (await op('.focus-fade.mt-6')).o === 1 && (await op('header')).o === 1)
    await page.keyboard.type('b')
    await sleep(400)
    check('the next keystroke hides it again', (await op('.focus-fade.mt-6')).o < 0.3)
    await page.evaluate(() => document.querySelector('footer button').focus())
    await sleep(400)
    check('keyboard focus inside a blurred area reveals it', (await op('footer')).o === 1)
    await page.focus('input[aria-label="Typing input"]')
    await sleep(400)
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+Backspace')
    await page.keyboard.press('Control+Backspace')
    await page.keyboard.type((await target()).slice(0, 5))
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await sleep(200)
    check('Tab+Enter restart un-blurs the page', (await page.evaluate(() => document.documentElement.dataset.typing)) === '0')
    await page.keyboard.type((await target()))
    await page.waitForSelector('section[aria-label="Test results"]')
    await sleep(400)
    h = await op('header')
    check('everything is restored when the test finishes', h.o === 1 && h.f === 'none', JSON.stringify(h))
    check('data-typing flag cleared', (await page.evaluate(() => document.documentElement.dataset.typing)) === '0')
    await page.getByRole('button', { name: 'next test' }).click()
  })

  await run('redesigned results screen', async () => {
    await mode('words'); await pill('Number of words', 10)
    await page.keyboard.type((await target()))
    await page.waitForSelector('section[aria-label="Test results"]')
    const r = await page.evaluate(() => {
      const s = document.querySelector('section[aria-label="Test results"]')
      return {
        tiles: s.querySelectorAll('.rise').length,
        ring: !!s.querySelector('circle.ring-fill'),
        charBar: s.querySelector('[role="img"][aria-label^="Characters:"]')?.getAttribute('aria-label'),
        legend: [...s.querySelectorAll('ul li')].map((l) => l.textContent.trim()),
        chip: s.querySelector('span.rounded-full')?.textContent,
        buttons: [...s.querySelectorAll('button')].map((b) => b.textContent.trim()),
        h2: s.querySelector('h2')?.textContent,
      }
    })
    check('has hero tiles + stat tiles + chart tile (8)', r.tiles === 8, String(r.tiles))
    check('accuracy ring rendered', r.ring)
    check('character breakdown bar has a text alternative', r.charBar && r.charBar.includes('correct'), r.charBar)
    check('legend lists correct/incorrect/extra/missed', r.legend.length === 4 && r.legend[0].startsWith('correct') && r.legend[3].startsWith('missed'), JSON.stringify(r.legend))
    check('test label chip and heading', r.chip === 'words 10' && r.h2 === 'results', JSON.stringify([r.chip, r.h2]))
    check('buttons: next test, try again, share', JSON.stringify(r.buttons) === JSON.stringify(['next test', 'try again', 'share']), JSON.stringify(r.buttons))
    await page.getByRole('button', { name: 'next test' }).click()
  })

  await run('keystroke handling speed (headless sandbox measurement)', async () => {
    await mode('time'); await pill('Duration in seconds', 120)
    const t = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Typing input"]'); input.focus()
      const words = document.querySelector('#typing-target').textContent
      const N = Math.min(400, words.length)
      const times = []
      for (let i = 0; i < N; i++) {
        const t0 = performance.now()
        input.dispatchEvent(new KeyboardEvent('keydown', { key: words[i], bubbles: true, cancelable: true }))
        times.push(performance.now() - t0)
      }
      times.sort((a, b) => a - b)
      return { n: N, median: times[Math.floor(N / 2)], p95: times[Math.floor(N * 0.95)], max: times[N - 1] }
    })
    console.log('   ', JSON.stringify(t, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)))
    check('median handler time under 5 ms', t.median < 5, String(t.median))
  })

  check('no console errors or warnings during the whole run', errors.length === 0, errors.slice(0, 5).join(' | '))
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
