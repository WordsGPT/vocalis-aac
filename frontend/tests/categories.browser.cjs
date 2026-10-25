// Verify category selection fits the viewport without clipping or scrolling.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.addInitScript(() => {
        localStorage.setItem('vocalis_onboarding_v1', JSON.stringify({ status: 'completed' }));
        localStorage.setItem('vocalis_settings', JSON.stringify({ ttsMode: 'browser', speakTiles: false, pictogramSize: 160 }));
      });
      await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/session') ? { authenticated: true } : [] }));
      await page.goto(process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:8000');
      await page.locator('#tab-board').click();
      await page.getByRole('heading', { name: 'Categorías', exact: true }).waitFor();
      const layout = await page.evaluate(() => {
        const main = document.querySelector('.aac-scroll-area');
        const grid = document.querySelector('.aac-folders');
        const bounds = grid.getBoundingClientRect();
        const cards = [...grid.children].map(node => {
          const rect = node.getBoundingClientRect();
          const label = node.querySelector('span');
          const text = label.getBoundingClientRect();
          return { rect, fits: rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1,
            readable: text.top >= rect.top && text.bottom <= rect.bottom && label.scrollWidth <= label.clientWidth,
            touchable: rect.width >= 44 && rect.height >= 44 };
        });
        return { count: cards.length, fits: cards.every(card => card.fits && card.readable && card.touchable),
          noScroll: main.scrollHeight <= main.clientHeight + 1 && grid.scrollHeight <= grid.clientHeight + 1,
          noOverlap: cards.every((card, i) => cards.slice(i + 1).every(other => card.rect.right <= other.rect.left || other.rect.right <= card.rect.left || card.rect.bottom <= other.rect.top || other.rect.bottom <= card.rect.top)),
          pageFits: document.documentElement.scrollWidth <= innerWidth };
      });
      assert.equal(layout.count, 16);
      assert.equal(layout.fits, true, `${width}×${height}: visible labels and 44px targets`);
      assert.equal(layout.noScroll, true, `${width}×${height}: no category scrolling`);
      assert.equal(layout.noOverlap, true, `${width}×${height}: no overlapping categories`);
      assert.equal(layout.pageFits, true);
      await page.getByRole('button', { name: 'Abrir: Comer y beber', exact: true }).click();
      await page.getByRole('heading', { name: 'Comer y beber', exact: true }).waitFor();
      assert.equal(await page.locator('.aac-show-categories').count(), 0, 'Word boards retain their normal layout');
      await page.getByRole('button', { name: 'Categorías', exact: true }).click();
      await page.getByRole('heading', { name: 'Categorías', exact: true }).waitFor();
      console.log(`PASS ${width}×${height}: all 16 categories fit without scrolling`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
