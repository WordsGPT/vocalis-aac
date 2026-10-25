// Node 22+, a built frontend, and an installed Playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const url = process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:8772';
const key = 'vocalis_onboarding_v1';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
      if (process.env.VOCALIS_TEST_WIDTH && width !== Number(process.env.VOCALIS_TEST_WIDTH)) continue;
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.mediaRequests = 0;
        navigator.mediaDevices.getUserMedia = async () => { window.mediaRequests++; throw new Error('Test microphone'); };
        window.speechSynthesis.speak = utterance => { window.spoken = utterance.text; utterance.onend?.(); };
        window.speechSynthesis.cancel = () => {};
        sessionStorage.setItem('vocalis_draft', JSON.stringify([{ text: 'Mi borrador original' }]));
        localStorage.setItem('vocalis_show_transcript', 'false');
      });
      await page.route('**/api/**', route => {
        requests.push(new URL(route.request().url()).pathname);
        return route.fulfill({ json: route.request().url().includes('/session') ? { auth_required: false, authenticated: true } : [] });
      });
      await page.goto(url);
      const tour = page.locator('.onboarding-dialog');
      await tour.waitFor();
      for (let i = 0; i < 45; i++) {
        const id = await tour.getAttribute('data-step');
        await page.waitForFunction(() => Boolean(document.querySelector('[data-tour-active]')) && Boolean(document.querySelector('.onboarding-spotlight')));
        await page.waitForTimeout(80);
        const geometry = await page.evaluate(() => {
          const node = document.querySelector('[data-tour-active]');
          const r = node.getBoundingClientRect(), c = document.querySelector('.onboarding-dialog').getBoundingClientRect();
          const h = document.querySelector('.onboarding-spotlight').getBoundingClientRect();
          return { target: node.outerHTML.slice(0, 160), cardVisible: c.left >= 0 && c.right <= innerWidth + 1 && c.top >= 0 && c.bottom <= innerHeight + 1,
            targetVisible: r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0,
            targetUsable: node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)),
            overlaps: Math.min(c.right, r.right) > Math.max(c.left, r.left) && Math.min(c.bottom, r.bottom) > Math.max(c.top, r.top),
            anchored: Math.abs(h.left - Math.max(4, r.left - 6)) < 2,
            overflow: document.documentElement.scrollWidth > innerWidth, rect: { top: r.top, bottom: r.bottom }, card: { top: c.top, bottom: c.bottom } };
        });
        assert.equal(geometry.cardVisible, true, `${width} ${id}: callout fits viewport ${JSON.stringify(geometry)}`);
        assert.equal(geometry.targetVisible, true, `${width} ${id}: actual UI control visible`);
        assert.equal(geometry.targetUsable, true, `${width} ${id}: real control is exposed ${JSON.stringify(geometry)}`);
        assert.equal(geometry.anchored, true, `${width} ${id}: highlight follows actual control`);
        assert.equal(geometry.overflow, false, `${width} ${id}: no horizontal overflow`);
        if (geometry.overlaps) {
          await page.screenshot({ path: `/tmp/tour-overlap-${width}-${id}.png` });
          assert.fail(`${width} ${id}: instructions obscure target ${JSON.stringify(geometry)}`);
        }
        if (id === 'voice-type') await page.locator('#tts-mode-browser').click();
        if (id === 'voice-test') { await page.getByRole('button', { name: 'Probar voz', exact: true }).click(); await page.waitForFunction(() => window.spoken?.includes('prueba de mi voz')); }
        if (id === 'form') await page.locator('#grammatical-form').selectOption('feminine');
        if (id === 'size') await page.locator('#pictogram-size').fill('130');
        if (id === 'tile-speech') await page.locator('[data-tour="tile-speech"] input').uncheck();
        if (id === 'tone') await page.locator('#response-tone').selectOption('concise');
        if (id === 'count') await page.locator('#response-count').selectOption('3');
        if (id === 'context-setting') await page.locator('#user-context').fill('Me gusta pasear.');
        if (id === 'board-tiles') {
          await page.locator('[data-tour-active]').click();
          assert.ok((await page.locator('#message-draft').inputValue()).length > 0);
          await page.screenshot({ path: `/tmp/tour-board-${width}.png` });
        }
        if (id === 'composer') {
          await page.locator('#message-draft').fill('Mi mensaje de práctica');
          assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('vocalis_draft'))[0].text), 'Mi borrador original');
          if (width === 1440) {
            await page.reload(); await tour.waitFor();
            assert.equal(await tour.getAttribute('data-step'), 'composer');
          }
        }
        if (process.env.AXE_PATH) {
          if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: process.env.AXE_PATH });
          const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
          assert.deepEqual(violations, [], `${width} ${id}: accessibility`);
        }
        assert.equal(await page.evaluate(() => window.mediaRequests), 0);
        assert.equal(await page.evaluate(() => localStorage.getItem('vocalis_history')), null);
        if (id === 'ready') break;
        await tour.getByRole('button', { name: 'Siguiente', exact: true }).click();
      }
      assert.equal(await tour.getAttribute('data-step'), 'ready');
      assert.equal(requests.some(path => ['/api/suggest', '/api/transcribe', '/api/agent/light', '/api/agent/message'].includes(path)), false);
      await tour.getByRole('button', { name: 'Terminar', exact: true }).click();
      await tour.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).status, key), 'completed');
      const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('vocalis_settings')));
      assert.equal(settings.grammaticalForm, 'feminine'); assert.equal(settings.pictogramSize, 130);
      assert.equal(settings.speakTiles, false); assert.equal(settings.tone, 'concise');
      assert.equal(settings.suggestionCount, 3); assert.equal(settings.userContext, 'Me gusta pasear.');
      await page.getByRole('button', { name: 'Tablero', exact: true }).click();
      await page.getByRole('heading', { name: 'Categorías', exact: true }).waitFor();
      assert.equal(await page.locator('#message-draft').inputValue(), 'Mi borrador original');
      assert.equal(await page.evaluate(() => localStorage.getItem('vocalis_show_transcript')), 'false');
      await page.getByRole('button', { name: 'Ajustes y clonar mi voz' }).click();
      await page.getByRole('button', { name: 'Abrir tutorial' }).click();
      await tour.waitFor();
      assert.equal(await tour.getAttribute('data-step'), 'welcome');
      await page.getByRole('button', { name: 'Cerrar tutorial', exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Siguiente');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Cerrar tutorial');
      await page.keyboard.press('Escape');
      await tour.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).status, key), 'skipped');
      await page.reload(); await page.locator('.aac-app').waitFor();
      assert.equal(await tour.count(), 0); assert.deepEqual(errors, []);
      console.log(`Anchored onboarding passed: ${width}×${height}`);
      await page.close();
    }
    const page = await browser.newPage();
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
    });
    await page.route('**/api/**', route => route.fulfill({ json: { auth_required: true, authenticated: false } }));
    await page.goto(url); await page.locator('.onboarding-dialog').waitFor();
    await page.getByRole('button', { name: 'Cerrar tutorial', exact: true }).click();
    await page.locator('.onboarding-dialog').waitFor({ state: 'detached' });
    console.log('Unavailable storage fallback passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
