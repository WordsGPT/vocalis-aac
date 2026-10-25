const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('vocalis_onboarding_v1', JSON.stringify({ status: 'completed' }));
        localStorage.setItem('vocalis_settings', JSON.stringify({ ttsMode: 'browser' }));
        localStorage.setItem('vocalis_history', JSON.stringify(Array.from({ length: 18 }, (_, index) => ({
          sender: index % 3 === 2 ? 'user' : 'partner', speaker: 'speaker_' + (index % 2 + 1),
          speaker_label: 'Persona ' + (index % 2 + 1), time: '12:30',
          text: index % 3 === 0 ? 'Sí.' : index % 3 === 1 ? '¿Te gustaría salir a pasear esta tarde y tomar algo después?' : 'Prefiero ir después de comer.',
        }))));
        window.speechSynthesis.speak = utterance => utterance.onend?.();
        window.speechSynthesis.cancel = () => {};
      });
      await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/session') ? { auth_required: false } : [] }));
      await page.goto(process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:4173');
      const panel = page.locator('#conversation-messages');
      if (width < 1280) {
        assert.equal(await panel.isVisible(), false);
        await page.locator('#conversation-toggle-messages').click();
      }
      assert.equal(await panel.isVisible(), true);
      assert.equal(await panel.locator('.aac-chat-message').count(), 18);
      assert.ok(await panel.locator('.is-self').count() > 0);
      assert.ok(await panel.getByText('Persona 1', { exact: true }).count() > 0);
      assert.ok(await panel.getByText('Persona 2', { exact: true }).count() > 0);
      const sizes = await panel.locator('.aac-chat-bubble').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
      assert.ok(Math.max(...sizes) > Math.min(...sizes) + 40, 'Bubble sizes follow message lengths');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 1440) {
        assert.ok((await panel.boundingBox()).x > (await page.locator('main').boundingBox()).x);
        const scroller = panel.locator('.aac-chat-scroll');
        await scroller.evaluate(node => { node.scrollTop = 0; });
        await panel.getByRole('button', { name: 'Ir al último mensaje' }).waitFor();
        await page.locator('#conversation-write').click();
        await page.locator('#message-draft').fill('Este es el mensaje más reciente.');
        await page.locator('#message-draft').press('Enter');
        await panel.getByText('Este es el mensaje más reciente.').waitFor();
        assert.equal(await scroller.evaluate(node => node.scrollTop), 0, 'New messages preserve the reader’s position');
        await panel.getByRole('button', { name: 'Ir al último mensaje' }).click();
        assert.ok(await scroller.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight < 2));
        await page.getByRole('button', { name: 'Cerrar teclado' }).click();
        await page.screenshot({ path: '/tmp/vocalis-review/conversation-with-history.png' });
      } else {
        await panel.getByRole('button', { name: 'Cerrar panel de mensajes' }).click();
        assert.equal(await panel.isVisible(), false);
        assert.equal(await page.locator('#conversation-toggle-messages').evaluate(node => node === document.activeElement), true);
      }
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'x' + height + ': history panel, speaker bubbles, natural widths, scrolling and close focus');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
