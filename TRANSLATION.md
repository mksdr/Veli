# Translation guide

The app currently ships **English (`en_US`) and Korean (`ko_KR`) only**.
Other translation directories are retained as reference for future expansion and are not imported or exposed in the app.

Update both supported `index.js` files together, with the same keys. Use clear action labels and explain recovery steps in errors. Keep cryptographic terms in help and advanced flows where possible.

Documentation is loaded from each supported locale’s `docs.md`. Missing technical documentation falls back to English. The changelog remains in its original English.

When adding a language in the future, register it in `locales/locales.js`, update language detection in `locales/index.js`, and validate file processing, keyboard access, long text, and mobile layouts.

Retained locale sources are historical translation snapshots from the upstream
projects. They may contain predecessor names and links; update them for Veli
before re-enabling a locale. Repository documentation is written in English,
while app help follows each supported UI language.
