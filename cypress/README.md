# Cypress fixtures

Run commands from the Veli repository root:

```sh
cd Veli
npm ci
npm run dev
```

In a second terminal, open Cypress with `npm run test`. The app must be running
in development mode, and these fixtures were written for Chrome. Run individual
specs rather than all specs at once.

These inherited fixtures include selectors from the earlier interface. The
maintained regression suite for the current UI is Playwright; see
[Verification in the README](../README.md#verification).
