import { launch, check, summary } from './lib.mjs'
;(async () => {
  const { browser, page, errors } = await launch()
  await page.goto((process.env.E2E_URL ?? 'http://localhost:5173/')); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.waitForSelector('input[aria-label="Typing input"]')
  const audit = () => page.evaluate(() => {
    const name = (e) => (e.getAttribute('aria-label') || (e.labels && e.labels[0]?.textContent) || e.textContent || e.title || '').trim()
    const bad = [...document.querySelectorAll('button, input, textarea, select, a[href], [role="radio"], [role="switch"]')].filter((e) => { const r = e.getBoundingClientRect(); return !name(e) }).map((e) => e.outerHTML.slice(0, 80))
    return { unnamed: bad, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, landmarks: ['header', 'nav', 'main', 'footer'].filter((t) => document.querySelector(t)), dupIds: [...document.querySelectorAll('[id]')].map((e) => e.id).filter((id, i, a) => a.indexOf(id) !== i), imgNoAlt: document.querySelectorAll('img:not([alt])').length }
  })
  let a = await audit()
  check('every control has an accessible name', a.unnamed.length === 0, a.unnamed.join(' | '))
  check('exactly one h1', a.h1 === 1, String(a.h1))
  check('html lang set', a.lang === 'en')
  check('landmarks: header, nav, main, footer', a.landmarks.length === 4, a.landmarks.join(','))
  check('no duplicate ids', a.dupIds.length === 0, a.dupIds.join(','))
  const input = await page.$eval('input[aria-label="Typing input"]', (e) => ({ desc: e.getAttribute('aria-describedby'), descText: document.getElementById('typing-target')?.textContent.length }))
  check('typing input is described by the full test text (screen readers)', input.desc === 'typing-hint typing-target' && input.descText > 100)
  check('decorative text layer is hidden from screen readers', await page.$eval('section[aria-label="Typing test"] .flex.flex-wrap', (e) => !!e.closest('[aria-hidden="true"]')))

  // keyboard-only: skip link + tab order reaches the controls with a visible focus ring
  const firstFocusable = await page.evaluate(() => document.querySelector('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])').textContent.trim())
  check('the skip link is the first focusable element in the page', firstFocusable === 'skip to typing test', firstFocusable)
  // the typing input intentionally keeps Tab for Tab+Enter restart; Esc is the documented way out
  await page.focus('input[aria-label="Typing input"]'); await page.keyboard.press('Tab')
  check('inside the typing input, Tab does not leave (documented, Esc releases focus)', await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Typing input'))
  await page.keyboard.press('Escape')
  check('Esc releases the typing input', await page.evaluate(() => document.activeElement.getAttribute('aria-label') !== 'Typing input'))
  check('the way out is announced in the visible hints and to screen readers', (await page.textContent('body')).includes('leave the typing area') && (await page.textContent('#typing-hint')).includes('Press Escape'))
  let seen = []
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || document.activeElement.tagName).trim().slice(0, 24))) }
  check('Tab reaches header, toolbar and footer controls', seen.includes('Settings') && seen.includes('words') && seen.some((s) => s.startsWith('shortcuts')), seen.join(' > '))
  const ring = await page.evaluate(() => { document.querySelector('button[aria-label="Settings"]').focus(); const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth })
  check('focused buttons show an outline', ring.startsWith('solid') && !ring.endsWith(' 0px'), ring)
  check('disabled leaderboard control is exposed as disabled', await page.$eval('button[aria-label^="Leaderboard"]', (e) => e.disabled))

  // dialogs
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const dlg = await page.$eval('[role="dialog"]', (d) => ({ modal: d.getAttribute('aria-modal'), label: d.getAttribute('aria-label') }))
  check('settings dialog: role, aria-modal, label', dlg.modal === 'true' && !!dlg.label)
  const radios = await page.$$eval('[role="radiogroup"]', (g) => g.map((x) => ({ label: x.getAttribute('aria-label'), checked: x.querySelectorAll('[aria-checked="true"]').length })))
  check('every radiogroup is labelled with exactly one checked option', radios.every((r) => r.label && r.checked === 1), JSON.stringify(radios))
  let tabbedOut = false
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => !document.activeElement.closest('[role="dialog"]'))) tabbedOut = true }
  check('Tab is trapped inside the dialog', !tabbedOut)
  await page.keyboard.press('Escape')

  // live regions + results announcement
  await page.getByRole('group', { name: 'Test mode' }).getByRole('button', { name: 'words', exact: true }).click()
  await page.getByRole('group', { name: 'Number of words' }).getByRole('button', { name: '10', exact: true }).click()
  await page.keyboard.type(await page.textContent('#typing-target'))
  await page.waitForSelector('section[aria-label="Test results"]')
  const ann = await page.textContent('section[aria-label="Typing test"] > div[role="status"]')
  check('completion is announced through a live region', /Test complete/.test(ann), ann)
  const empty = await page.textContent('section[aria-label="Test results"]')
  check('short test shows a text empty-state instead of a chart', !(await page.$('svg[role="img"]')) && empty.includes('not enough data'))
  a = await audit()
  check('results screen: every control named', a.unnamed.length === 0, a.unnamed.join('|'))
  check('reduced motion: CSS honours prefers-reduced-motion', await page.evaluate(() => [...document.styleSheets].some((s) => [...s.cssRules].some((r) => r.media && r.media.mediaText.includes('prefers-reduced-motion')))))
  check('no console errors', errors.length === 0, errors.join('|'))
  await browser.close()
  process.exit(summary() ? 1 : 0)
})()
