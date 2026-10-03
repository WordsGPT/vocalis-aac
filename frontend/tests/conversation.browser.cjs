// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
// The app must be serving its latest build at VOCALIS_TEST_URL (default :8000).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('vocalis_settings', JSON.stringify({ ttsMode: 'browser', autoTriggerDelay: 300 }));
      localStorage.removeItem('vocalis_history');
      window.testStreams = [];
      window.testVolume = 0;
      const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async options => {
        const stream = await getMedia(options);
        window.testStreams.push(stream);
        return stream;
      };
      AnalyserNode.prototype.getByteTimeDomainData = function (data) {
        data.fill(128 + window.testVolume);
      };
      window.speechSynthesis.speak = utterance => { window.testUtterance = utterance; };
      window.speechSynthesis.cancel = () => {};
    });
    let turn = 0;
    const transcriptions = [
      { text: 'Ayer salimos y entonces…', speaker: 'speaker_1', speaker_label: 'Persona 1' },
      { text: '¿Qué te apetece hacer?', speaker: 'speaker_2', speaker_label: 'Persona 2' },
      { text: 'Espera, todavía no he terminado.', speaker: 'speaker_1', speaker_label: 'Persona 1' },
      { text: '¿Quieres venir con nosotros?', speaker: 'speaker_2', speaker_label: 'Persona 2' },
    ];
    const requests = [];
    let delaySuggestions = false;
    const sessionIds = [];
    await page.route('**/api/transcribe', async route => {
      const body = route.request().postData();
      sessionIds.push(body.match(/name="session_id"\r\n\r\n([^\r]+)/)?.[1]);
      const item = transcriptions[Math.min(turn++, transcriptions.length - 1)];
      await route.fulfill({ json: { text: item.text, turns: [item], diarization: 'estimated' } });
    });
    await page.route('**/api/suggest', async route => {
      const request = route.request().postDataJSON();
      requests.push(request);
      const number = requests.length;
      if (delaySuggestions) await new Promise(resolve => setTimeout(resolve, 900));
      const wait = request.text.includes('entonces') || request.text.includes('terminado');
      await route.fulfill({ json: { should_suggest: !wait, reason: wait ? 'incomplete' : 'direct_question',
        suggestions: wait ? [] : [`Respuesta del turno ${number}.`], engine: 'groq-conversation' } }).catch(() => {});
    });
    await page.goto(process.env.VOCALIS_TEST_URL || 'http://127.0.0.1:8000');
    const active = () => page.waitForFunction(() => window.testStreams.some(s => s.getTracks().some(t => t.readyState === 'live')));
    const inactive = () => page.waitForFunction(() => window.testStreams.every(s => s.getTracks().every(t => t.readyState === 'ended')));
    const speak = async () => {
      await page.evaluate(() => { window.testVolume = 12; });
      await page.waitForTimeout(500);
      await page.evaluate(() => { window.testVolume = 0; });
    };
    const waitRequests = async count => {
      for (let i = 0; i < 100 && requests.length < count; i++) await page.waitForTimeout(50);
      assert.ok(requests.length >= count, `Expected ${count} requests, received ${requests.length}`);
    };
    await active();
    await speak();
    await waitRequests(1);
    await page.getByText('Siguiendo la conversación · esperando un momento para participar.').waitFor();
    assert.equal(await page.getByRole('button', { name: /Decir respuesta/ }).count(), 0);
    assert.equal(requests[0].automatic, true);
    await active();
    console.log('PASS incomplete turn waits and microphone remains active');

    delaySuggestions = true;
    await speak();
    await waitRequests(2);
    await page.getByText('Persona 2', { exact: true }).waitFor();
    assert.equal(requests[1].history[0].speaker_label, 'Persona 1');
    assert.equal(requests[1].history[1].speaker_label, 'Persona 2');
    // Wait for replies to arrive before checking that a subsequent incomplete
    // turn preserves them. Earlier speech correctly cancels a pending request.
    await page.getByRole('button', { name: /Decir respuesta 1:/ }).waitFor();
    await speak();
    await waitRequests(3);
    await page.waitForTimeout(1100);
    assert.ok(await page.getByRole('button', { name: /Decir respuesta/ }).count() > 0);
    assert.equal(new Set(sessionIds).size, 1);
    assert.ok(sessionIds[0]);
    console.log('PASS speaker history persists and available responses remain while conversation continues');

    delaySuggestions = false;
    await speak();
    await waitRequests(4);
    await page.getByRole('button', { name: /Decir respuesta 1:/ }).click();
    await inactive();
    assert.equal(await page.getByRole('button', { name: 'Detener escucha', exact: true }).count(), 1);
    await page.evaluate(() => window.testUtterance.onend());
    await active();
    assert.equal(await page.getByRole('button', { name: /Decir respuesta/ }).count(), 0);
    console.log('PASS playback pauses listening, clears spent replies, then resumes');

    await page.getByRole('button', { name: 'Detener escucha', exact: true }).click();
    await inactive();
    await page.waitForTimeout(800);
    await inactive();
    assert.equal(await page.getByRole('button', { name: 'Escuchar', exact: true }).count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS manual stop remains stopped; no browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
