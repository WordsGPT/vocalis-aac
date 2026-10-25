# Vocalis UI review

Branch: `ui/vocalis-refinement`

The redesign keeps the Spanish communication workflow and ARASAAC pictograms, with a consistent light palette, typography, spacing, and control sizing across conversation, board, tools, history, and dialogs.

## What changed

- Desktop uses a navigation rail with quick speech; phones use bottom navigation. Short landscape windows use a narrow rail to leave vertical space for content.
- Conversation has a separate topic strip, persistent microphone/writing controls, full-text reply cards, visible loading/error states, and one main content scroller. On small phones, secondary controls become labeled-for-accessibility icon buttons. Long replies and additional options scroll instead of being truncated.
- A compact conversation rail on the right shows chronological history in naturally sized bubbles, with speaker labels, stable speaker colors, and your messages aligned to the right. On smaller screens it opens from the messages button. It follows new messages while preserving your position when you scroll back, with a shortcut to the latest message.
- When up to six replies are ready, the main workspace compacts the latest transcript, controls, and reply heading and gives the remaining height to the reply grid. Desktop uses three columns; portrait phones use two. Small screens use icon editing controls; the smallest phones use a single edit-mode selector. Normal six-reply examples fit without scrolling at all seven tested sizes. Exceptionally long replies retain natural height and scrolling instead of being truncated.
- The message composer is shown on the board or when writing/editing a response. History editing opens and focuses that composer. Drafts, undo, saved phrases, category search, and custom quick speech remain available.
- Pictogram scaling works on phones as well as desktop; category colors remain meaningful.
- Tools use the same design system and plain Spanish copy. The light is explicitly a demonstration. Failed light requests no longer change its displayed state; failed calendar saves retain the form. Controls are keyboard accessible and request feedback is announced.
- Dialogs prevent interaction with the background, trap focus, restore focus on close, and expose labels and selected states. Settings accurately say that changes save automatically.
- Removed the old overlapping layout overrides. Source-substring tests that prescribed the obsolete mobile CSS were replaced by rendered browser checks.

## Verification

Use Node 22+ in `frontend`:

```sh
npm run build
npm run lint
node --test tests/*.test.js
npm run preview -- --host 127.0.0.1 --port 4173
```

With Playwright installed, run against the preview in a second terminal:

```sh
VOCALIS_TEST_URL=http://127.0.0.1:4173 node tests/redesign.browser.cjs
VOCALIS_TEST_URL=http://127.0.0.1:4173 node tests/ui.browser.cjs
VOCALIS_TEST_URL=http://127.0.0.1:4173 node tests/conversation.browser.cjs
```

`PLAYWRIGHT_MODULE` can point to an external Playwright installation. `VOCALIS_SCREENSHOTS` sets an optional screenshot output directory. `AXE_PATH` can point to `axe-core/axe.min.js` to include WCAG A/AA automated audits of all screens and dialogs.

Rendered checks cover 1440×900, 1024×768, 768×1024, 390×844, 320×568, and 844×390: page/content overflow, navigation visibility, touch targets, full and reachable responses, writing/speaking, correction input, topics, saved phrases/search/undo, history editing, tool failure/retry, dialog focus, pictogram scaling, and a simulated 400px keyboard viewport. The continuous conversation suite exercises transcription, waiting turns, preserving replies, playback suspension/resumption, and explicit microphone stop.

The browser suites use mocked inference, tools, and speech. They do not validate real GPU inference, voice quality, external services, or physical-device keyboards. Automated accessibility results supplement visual inspection; they are not a substitute for assistive-technology and AAC user testing. Repository lint still reports existing warnings, including generated Pocket runtime files.

Existing uncommitted backend and conversation changes were preserved. This branch has not been deployed to an external host.
