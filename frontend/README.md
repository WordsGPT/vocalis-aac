# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Onboarding

The Spanish first-visit tutorial points to controls in the actual interface, opens
each workspace, and scrolls targets into view. Users configure voice, board size,
grammatical form, listening, and reply preferences in the existing Settings panel.
Practice uses the real board and composer with an isolated draft; example replies
and history appear in their usual positions without changing stored messages.
Open it again from **Ajustes y voz → Abrir tutorial**. Progress and dismissal are
stored per browser under `vocalis_onboarding_v1`; settings use the existing
`vocalis_settings` key. Listening pauses for the tutorial, and practice messages
do not enter history or execute agent commands.

Run the browser regression against a built frontend with Node 22+:

```sh
VOCALIS_TEST_URL=http://127.0.0.1:8772 PLAYWRIGHT_MODULE=/path/to/playwright node tests/onboarding.browser.cjs
```

Set `AXE_PATH` to an installed `axe-core/axe.min.js` to include accessibility checks.
