const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const replies = ['Sí, me apetece ir al parque.', 'Prefiero quedarme en casa esta tarde.', 'Podemos salir después de comer.', '¿Te parece si invitamos a alguien?', 'Me gustaría pasear un rato contigo.', 'Necesito descansar antes de salir.'];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      await page.addInitScript(() => { localStorage.setItem('vocalis_onboarding_v1', JSON.stringify({ status: 'completed' })); localStorage.setItem('vocalis_settings', JSON.stringify({ ttsMode: 'browser' })); });
      await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/suggest') ? { suggestions: replies, should_suggest: true, engine: 'groq', topics: ['Parque', 'Paseo', 'Comida'] } : route.request().url().includes('/session') ? { auth_required: false } : [] }));
      await page.goto(process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:5173');
      await page.locator('.aac-partner-input summary').click();
      await page.getByRole('textbox', { name: 'Mensaje del interlocutor' }).fill('¿Quieres ir al parque esta tarde?');
      await page.getByRole('button', { name: 'Generar respuestas', exact: true }).click();
      await page.locator('.aac-compact-replies').waitFor();
      await page.locator('.aac-tab-content').evaluate(node => { node.scrollTop = 0; });
      const geometry = await page.locator('.aac-replies').evaluate(node => {
        const panel = node.closest('.aac-tab-content').getBoundingClientRect();
        return [...node.querySelectorAll('.aac-reply')].map(reply => {
          const r = reply.getBoundingClientRect();
          const text = reply.querySelector('.aac-reply-text');
          return { visible: r.top >= panel.top && r.bottom <= panel.bottom + 1, fullText: text.scrollHeight <= text.clientHeight + 1 };
        });
      });
      await page.screenshot({ path: '/tmp/vocalis-review/six-replies-' + width + '.png' });
      assert.equal(geometry.length, 6);
      assert.ok(geometry.every(reply => reply.visible && reply.fullText), 'All six replies fit completely at ' + width + 'x' + height);
      assert.ok(await page.locator('.aac-tab-content').evaluate(node => node.scrollHeight <= node.clientHeight + 1), 'No conversation scrolling needed');
      if (width <= 360) {
        await page.getByRole('button', { name: 'Elegir una respuesta para editar', exact: true }).click();
        await page.getByRole('button', { name: /^Editar respuesta 6:/ }).click();
      } else await page.getByRole('button', { name: 'Editar respuesta 6', exact: true }).click();
      assert.equal(await page.locator('#message-draft').inputValue(), replies[5]);
      console.log('PASS ' + width + 'x' + height + ': six full replies fit without scrolling; editing works');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
