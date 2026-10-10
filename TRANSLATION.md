# Translation guide

The app currently ships **English (`en_US`) and Korean (`ko_KR`)**.

Update both supported `index.js` files together, with the same keys. Use clear action labels and explain recovery steps in errors. Keep cryptographic terms in help and advanced flows where possible.

Documentation is loaded from each supported locale’s `docs.md`. Missing technical documentation falls back to English. The changelog remains in its original English.

When adding a language in the future, create its locale directory with `index.js` and `docs.md`, register it in `locales/locales.js`, update language detection in `locales/index.js`, and validate file processing, keyboard access, long text, and mobile layouts.

