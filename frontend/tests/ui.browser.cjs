// Run against a built app with VOCALIS_TEST_URL and PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('vocalis_settings', JSON.stringify({ ttsMode: 'browser', userContext: 'Contexto anterior.' }));
        localStorage.removeItem('vocalis_history');
        window.speechSynthesis.speak = utterance => { window.testUtterance = utterance; };
        window.speechSynthesis.cancel = () => {};
      });
      const requests = [];
      await page.route('**/api/**', route => {
        if (route.request().url().includes('/suggest')) {
          requests.push(route.request().postDataJSON());
          return route.fulfill({ json: { suggestions: Array.from({ length: 8 }, (_, index) => `Respuesta ${index + 1}: Me gustaría pasear contigo después de comer esta tarde.`), topics: ['Parque', 'Paseo', 'Comida'], should_suggest: true, engine: 'groq' } });
        }
        return route.fulfill({ json: route.request().url().includes('/session') ? { authenticated: false } : [] });
      });
      await page.goto(process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:8000');
      await page.locator('.aac-partner-input summary').click();
      await page.getByRole('textbox', { name: 'Mensaje del interlocutor' }).fill('¿Vamos al parque?');
      await page.getByRole('button', { name: 'Generar respuestas', exact: true }).click();
      await page.getByRole('button', { name: /Decir respuesta 8:/ }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('.aac-reply-text').evaluateAll(nodes => nodes.some(node => {
        const text = node.getBoundingClientRect();
        const button = node.closest('button').getBoundingClientRect();
        return text.bottom > button.bottom + 1 || text.top < button.top - 1 || node.scrollHeight > node.clientHeight + 1;
      })), false, 'Reply text must be fully readable');
      const lastReply = page.getByRole('button', { name: /Decir respuesta 8:/ });
      await lastReply.scrollIntoViewIfNeeded();
      assert.equal(await lastReply.evaluate(node => {
        const r = node.getBoundingClientRect();
        const list = node.closest('.aac-replies');
        const scroller = getComputedStyle(list).overflowY === 'visible' ? node.closest('.aac-tab-content') : list;
        const grid = scroller.getBoundingClientRect();
        return r.bottom <= grid.bottom + 1 && r.top >= grid.top - 1;
      }), true, 'Every reply must be reachable');

      await page.locator('#header-context-btn').click();
      const dialog = page.getByRole('dialog');
      await page.getByRole('textbox', { name: 'Información personal o contexto actual:' }).fill('');
      await page.getByRole('button', { name: '+ Mi nombre', exact: true }).click();
      await page.waitForFunction(() => {
        const node = document.getElementById('user-context-textarea');
        return node.value.slice(node.selectionStart, node.selectionEnd) === '[nombre]';
      });
      const buttons = dialog.getByRole('button');
      await buttons.last().focus();
      await page.keyboard.press('Tab');
      assert.equal(await buttons.first().evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await buttons.last().evaluate(node => node === document.activeElement), true);
      const context = page.locator('#user-context-textarea');
      await context.fill('Me llamo Clara. Prefiero pasear por la mañana.');
      await context.press('Control+Enter');
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => localStorage.getItem('vocalis_settings').includes('Prefiero pasear'));
      assert.equal(requests.at(-1).user_context, 'Me llamo Clara. Prefiero pasear por la mañana.', 'Regeneration must use the newly saved context');
      await page.locator('.aac-topic-chip').filter({ hasText: 'Parque' }).click();
      await page.locator('.aac-partner-input summary').click();
      await page.getByRole('textbox', { name: 'Mensaje del interlocutor' }).fill('¿Y mañana?');
      await page.getByRole('button', { name: 'Generar respuestas', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.aac-active-topic-badge'));
      assert.equal(requests.at(-1).focus_topic, 'Parque', 'New turns must respect the selected topic');
      await page.getByRole('button', { name: /Decir respuesta 1:/ }).click();
      await page.evaluate(() => window.testUtterance.onerror());
      await page.getByRole('alert').filter({ hasText: /voz|hablar|reproducir/i }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}x${height}: complete replies, eight reachable options, context focus/save, selected topic, voice error`);
      await page.close();
    }
    const denied = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await denied.addInitScript(() => {
      localStorage.setItem('vocalis_show_transcript', 'false');
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
    });
    await denied.route('**/api/**', route => route.fulfill({ json: [] }));
    await denied.goto(process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:8000');
    await denied.getByRole('alert').filter({ hasText: 'Permite el acceso al micrófono en tu navegador y pulsa Escuchar.' }).waitFor();
    assert.equal(await denied.locator('#conversation-hearing').isVisible(), false);
    console.log('PASS denied microphone shows actionable guidance even with transcript hidden');
    await denied.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
