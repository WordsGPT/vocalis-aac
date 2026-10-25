// Node 22+. Run with VOCALIS_TEST_URL, PLAYWRIGHT_MODULE and optional VOCALIS_SCREENSHOTS.
// APIs and speech are deterministic fixtures; no real device or calendar is changed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:5173';
const screenshots = process.env.VOCALIS_SCREENSHOTS;
const axePath = process.env.AXE_PATH;
const replies = ['Sí, me apetece ir al parque.', 'Prefiero quedarme en casa esta tarde.', 'Podemos salir después de comer.', '¿Te parece si invitamos a alguien?', 'Me gustaría pasear un rato contigo.', 'Necesito descansar antes de salir.'];

async function audit(page, screen) {
  if (!axePath) return;
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
  assert.deepEqual(violations, [], screen + ': automated accessibility audit');
}

async function geometry(page, screen) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const nav = document.querySelector('.aac-tabs').getBoundingClientRect();
    const tiny = [...document.querySelectorAll('.aac-app button')].filter(node => {
      const r = node.getBoundingClientRect();
      return r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.height < 43;
    }).map(node => node.getAttribute('aria-label') || node.textContent);
    const content = document.querySelector('.aac-tab-content');
    return { overflow: root.scrollWidth > innerWidth || content.scrollWidth > content.clientWidth + 1, navVisible: nav.top >= 0 && nav.bottom <= innerHeight + 1, tiny };
  });
  assert.equal(result.overflow, false, screen + ': no horizontal page overflow');
  assert.equal(result.navVisible, true, screen + ': all navigation stays in view');
  assert.deepEqual(result.tiny, [], screen + ': 44px touch targets');
}

(async () => {
  if (screenshots) fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
      if (process.env.VOCALIS_TEST_WIDTH && width !== Number(process.env.VOCALIS_TEST_WIDTH)) continue;
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('vocalis_onboarding_v1', JSON.stringify({ status: 'completed' }));
        localStorage.setItem('vocalis_settings', JSON.stringify({ ttsMode: 'browser', speakTiles: false }));
        localStorage.setItem('vocalis_history', JSON.stringify([{ sender: 'user', text: 'Me gusta pasear por la mañana.', time: '10:30' }]));
        window.speechSynthesis.speak = utterance => { window.spoken = utterance.text; utterance.onend?.(); };
        window.speechSynthesis.cancel = () => {};
      });
      let failAction = true;
      let events = [];
      await page.route('**/api/**', route => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        if (endpoint === '/api/session') return route.fulfill({ json: { auth_required: false, authenticated: true } });
        if (endpoint === '/api/suggest') return route.fulfill({ json: { suggestions: replies, topics: ['Parque', 'Paseo', 'Comida'], engine: 'groq', should_suggest: true } });
        if (endpoint === '/api/agent/light') return route.fulfill({ status: failAction ? 503 : 200, json: failAction ? {} : { status: 'success', light: request.postDataJSON() } });
        if (endpoint === '/api/agent/calendar' && request.method() === 'POST') {
          if (failAction) return route.fulfill({ status: 503, json: {} });
          const event = { ...request.postDataJSON(), id: 'test-event' };
          events.push(event);
          return route.fulfill({ json: { status: 'success', event } });
        }
        if (endpoint === '/api/agent/state') return route.fulfill({ json: { calendar_events: events, action_log: [], light: { state: 'off', color: 'green' } } });
        return route.fulfill({ json: [] });
      });
      const capture = async name => {
        await geometry(page, width + ' ' + name);
        await audit(page, width + ' ' + name);
        if (screenshots) await page.screenshot({ path: path.join(screenshots, width + '-' + name + '.png'), animations: 'disabled' });
      };
      await page.goto(url);
      await page.locator('.aac-app').waitFor();
      await capture('empty');
      await page.locator('.aac-partner-input summary').click();
      await page.getByRole('textbox', { name: 'Mensaje del interlocutor' }).fill('¿Quieres ir al parque esta tarde?');
      await page.getByRole('button', { name: 'Generar respuestas', exact: true }).click();
      await page.getByRole('button', { name: /Decir respuesta 6:/ }).waitFor();
      await page.locator('.aac-tab-content').evaluate(node => { node.scrollTop = 0; });
      await capture('conversation');
      if (width <= 360) {
        await page.getByRole('button', { name: 'Elegir una respuesta para editar', exact: true }).click();
        await page.getByRole('button', { name: /^Editar respuesta 2:/ }).click();
      } else await page.getByRole('button', { name: 'Editar respuesta 2', exact: true }).click();
      assert.equal(await page.locator('#message-draft').inputValue(), replies[1]);
      assert.equal(await page.locator('#message-draft').evaluate(node => node === document.activeElement), true);
      await page.locator('#message-draft').fill('Este es mi mensaje editado.');
      if (width <= 480) {
        await page.setViewportSize({ width, height: 400 });
        await page.waitForFunction(() => Math.abs(document.querySelector('.aac-app').getBoundingClientRect().height - innerHeight) < 1);
        await geometry(page, 'Open keyboard');
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => Math.abs(document.querySelector('.aac-app').getBoundingClientRect().height - innerHeight) < 1);
      }
      await page.locator('#message-draft').press('Enter');
      await page.waitForFunction(() => window.spoken === 'Este es mi mensaje editado.');
      await page.getByRole('button', { name: 'Cerrar teclado' }).click();
      await page.locator('#conversation-toggle-transcript').click();
      assert.equal(await page.locator('#conversation-hearing').isVisible(), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('vocalis_show_transcript')), 'false');
      await page.locator('#tab-board').click();
      await page.getByRole('heading', { name: 'Categorías', exact: true }).waitFor();
      assert.equal(await page.locator('.aac-tile-grid').isVisible(), false, 'The board starts at category selection');
      await page.getByRole('button', { name: 'Categorías', exact: true }).click();
      assert.equal(await page.locator('.aac-folders').isVisible(), true, 'Categories is an idempotent home action');
      await page.getByRole('textbox', { name: 'Buscar palabras y frases' }).fill('agua');
      assert.equal(await page.locator('.aac-folders').count(), 0, 'Search replaces category selection');
      await page.getByRole('button', { name: 'Añadir: Agua', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Borrar búsqueda' }).click();
      await page.getByRole('heading', { name: 'Categorías', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Abrir: Comer y beber', exact: true }).click();
      await page.getByRole('button', { name: 'Añadir: Agua', exact: true }).click();
      const composedDraft = await page.locator('#message-draft').inputValue();
      await page.locator('#tab-conversation').click();
      await page.locator('#tab-board').click();
      await page.getByRole('heading', { name: 'Comer y beber', exact: true }).waitFor();
      assert.equal(await page.locator('#message-draft').inputValue(), composedDraft, 'Switching modes preserves the category and draft');
      await page.locator('.aac-breadcrumb').getByRole('button', { name: 'Volver a categorías', exact: true }).click();
      assert.equal(await page.locator('.aac-core-strip').count(), 0, 'Category selection stays clear of the previous category controls');
      assert.equal(await page.locator('#message-draft').inputValue(), composedDraft, 'Returning home preserves the draft');
      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      await page.getByRole('heading', { name: 'Tablero de palabras', exact: true }).waitFor();
      await page.locator('#message-draft').fill('Una frase para guardar.');
      await page.getByRole('button', { name: 'Guardar frase', exact: true }).click();
      await page.getByRole('button', { name: 'Limpiar mensaje', exact: true }).click();
      await page.getByRole('button', { name: 'Deshacer último cambio' }).click();
      assert.equal(await page.locator('#message-draft').inputValue(), 'Una frase para guardar.');
      await capture('board');
      await page.getByRole('button', { name: 'Categorías', exact: true }).click();
      await capture('categories');
      await page.getByRole('button', { name: 'Abrir: Mis frases', exact: true }).click();
      await page.getByRole('button', { name: 'Añadir: Una frase para guardar.', exact: true }).waitFor();
      await page.getByRole('textbox', { name: 'Buscar palabras y frases' }).fill('palabrainexistente');
      await page.getByRole('heading', { name: 'No hay coincidencias' }).waitFor();
      await page.getByRole('button', { name: 'Borrar búsqueda' }).click();
      await page.locator('#tab-history').click();
      await capture('history');
      await page.getByRole('button', { name: 'Editar mensaje: Me gusta pasear por la mañana.', exact: true }).click();
      assert.equal(await page.locator('#tab-conversation').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#message-draft').inputValue(), 'Me gusta pasear por la mañana.');
      await page.getByRole('button', { name: 'Cerrar teclado' }).click();
      await page.locator('#tab-agent').click();
      await capture('agent');
      await page.locator('#agent-toggle-light-btn').click();
      await page.getByRole('alert').filter({ hasText: 'No se pudo completar' }).waitFor();
      assert.equal(await page.locator('#agent-smart-light-bulb').getAttribute('aria-pressed'), 'false', 'Failed request must not turn on the demo light');
      failAction = false;
      await page.locator('#agent-toggle-light-btn').click();
      await page.waitForFunction(() => document.querySelector('#agent-smart-light-bulb').getAttribute('aria-pressed') === 'true');
      await page.getByRole('button', { name: 'Nuevo evento' }).click();
      await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Consulta de prueba');
      failAction = true;
      await page.getByRole('button', { name: 'Guardar en calendario' }).click();
      await page.getByRole('alert').filter({ hasText: 'No se pudo completar' }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'Título', exact: true }).inputValue(), 'Consulta de prueba', 'Failed saves retain the form');
      failAction = false;
      await page.getByRole('button', { name: 'Guardar en calendario' }).click();
      await page.locator('.aac-events').getByText('Consulta de prueba').waitFor();
      await page.locator('#header-context-btn').click();
      await page.getByRole('dialog').waitFor();
      await audit(page, width + ' context');
      if (screenshots) await page.screenshot({ path: path.join(screenshots, width + '-context.png'), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Ajustes y clonar mi voz' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.equal(await page.locator('.aac-app').evaluate(node => node.inert), true);
      await page.getByRole('slider', { name: 'Tamaño de casillas' }).fill('160');
      await audit(page, width + ' settings');
      await dialog.locator('input,select,textarea').evaluateAll(nodes => {
        for (const node of nodes) {
          if (node.getClientRects().length && !node.labels?.length && !node.getAttribute('aria-label')) throw new Error('Unlabeled field: ' + node.outerHTML);
        }
      });
      if (screenshots) await page.screenshot({ path: path.join(screenshots, width + '-settings.png'), animations: 'disabled' });
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button', { name: 'Ajustes y clonar mi voz' }).evaluate(node => node === document.activeElement), true);
      await page.locator('#tab-board').click();
      await page.getByRole('button', { name: 'Ir al tablero principal', exact: true }).click();
      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      const largePicto = await page.locator('.aac-tile img').first().evaluate(node => node.getBoundingClientRect().width);
      assert.ok(largePicto >= (width <= 768 ? 100 : 140), 'Large pictogram setting changes actual images');
      await capture('large-pictograms');
      assert.deepEqual(errors, [], 'No uncaught runtime errors');
      console.log('PASS ' + width + 'x' + height + ': geometry, touch targets, compose/edit/speak, board/search/save, history, tool failures/retry, settings and pictogram scaling');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
