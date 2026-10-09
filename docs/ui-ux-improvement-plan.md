# Veli encryption and decryption UI/UX plan

Date: 2026-10-09

Status: implementation and automated regression validation complete; physical-device and usability validation remain

Scope: the Veli web app, with English and Korean interfaces

## 1. Goal and boundaries

Help first-time users protect and reopen files without requiring cryptographic
knowledge. At each step, explain what to do, what is happening, and what the
next action produces.

Apply lessons from Toss's public design and UX-writing documentation with the
existing React, MUI, and Emotion stack. Do not install or use
`@toss/tds-mobile`. The sizes and colors in this plan are project choices, not
copied TDS specifications. Do not import Toss logos or illustrations.

Preserve file signatures, encryption algorithms, key-derivation parameters,
the 12-character password minimum, and whole-file integrity verification.
Do not add accounts, server uploads, or file-transfer features.

The initial assessment came from source code and the existing security/browser
review. It was not a user-observation study. The implementation and observed
validation results are recorded separately in
[the implementation record](ui-ux-implementation.md).

## 2. Initial experience and improvement opportunities

| Initial structure | Potential difficulty | Direction |
| --- | --- | --- |
| Three-step forms with generic Next and result labels | Users cannot predict the next action | Use action-specific headings and buttons |
| Password, passphrase, and public-key radio options together | Users must understand three methods immediately | Default to passwords; group generation options; disclose keys as advanced |
| Icon-led password generation and visibility | Functions and storage responsibilities are easy to miss | Label generation explicitly and explain safe storage before processing |
| Success alerts for file preparation | Preparation can be confused with completed protection | Use neutral summaries; reserve success for actual completion |
| Streaming downloads versus buffered results | Saving has different meanings across browsers | Share the flow, explain each saving action accurately |
| Immediate clipboard success and assumed download completion | Feedback can disagree with actual outcomes | Await clipboard success and direct users to browser downloads |
| Single-file fallback and 1 GiB input limit | The limit can be missed or mistaken for a processing guarantee | Place resource limits beside selection and explain memory constraints |
| Four duplicated processing-panel views | Improvements can diverge between browser paths | Share presentation while retaining processing adapters |
| Whole-page color inversion for dark mode | Semantic colors and images are difficult to control | Use explicit light and dark MUI themes |
| Multiple locales but no Korean | Korean examples cannot be used in the actual app | Ship English and Korean; retain other sources for future expansion |

Evidence: the original encryption/decryption panels, limited panels,
`src/config/Theme.js`, global styles, English copy, and
[the security/browser review](security-browser-review.md).

## 3. Experience principles

1. Show only decisions needed at the current step. Put algorithms, hashes,
   and key-exchange details in help and file information.
2. Name the next action: Set a password, Review encryption, Encrypt & download.
3. Build confidence through accurate guidance. Explain unrecoverable lost
   credentials in calm, short language before processing.
4. Pair errors with recovery actions. When the cause is uncertain, suggest
   checks rather than claiming a definitive diagnosis.
5. Use emphasis sparingly. Give each step one primary action and distinguish
   preparation, errors, and successful verification.
6. Keep advanced capabilities discoverable. Explain public/private keys,
   generation, public-key links, and QR sharing. Prepopulate the key flow when
   entering through an invitation link.

References: [Toss writing principles](https://toss.tech/article/21022),
[Toss error-message guidance](https://toss.tech/article/how-to-write-error-message),
[TDS Button](https://tossmini-docs.toss.im/tds-mobile/components/button/), and
[TDS TextField](https://tossmini-docs.toss.im/tds-mobile/components/TextField/text-field/).
The application-specific flow below is this project's design decision.

## 4. Recommended flow

### Start

Lead with Protect your files, with confidence and a short explanation of local
browser processing. Keep Encrypt files and Decrypt files tabs. Place brand,
settings, and help above the task without competing with its heading.

### Encryption: choose files → credentials → process and save

**Choose files:** offer a visible file-selection button and optional drag/drop.
Summarize names, sizes, and count; provide remove/add actions. Keep hashes in
File information. Show single-file and memory restrictions next to selection.
The primary action is Set a password.

**Credentials:** keep the Password label present, including during validation.
Require at least 12 characters. Offer Random characters and Memorable words
as generation options plus an explicit Create a password action. Mask the
password by default and let users choose to show or copy it. Explain that a
lost password cannot be recovered and should be stored safely. Show strength
without estimated cracking times. Offer Use public keys · Advanced in the
same step, with persistent labels and explanations for each key.

**Review and process:** summarize files and the protection method without
showing the password. Streaming uses Encrypt & download. Buffered mode uses
Encrypt file, followed by Download encrypted file after completion. Explain
that the browser handles saving and that users should check its downloads.
Provide credential-storage guidance and Choose another file after completion.
Recommend separate channels for sharing the file and password; the app does
not send either. Avoid a mandatory tutorial or storage-confirmation checkbox.

### Decryption: choose files → required credentials → process and save

Inspect the file header to choose the credential method automatically. Explain
unsupported, incomplete, or mixed-method selections next to the file list.
Suggest obtaining a fresh encrypted original when appropriate.

Request the original encryption password, or the sender's public key and the
recipient's own private key. Preserve selected files after credential failure
so users can correct input. Do not store passwords/private keys in preferences.

Streaming checks credentials before Decrypt & download. Buffered mode decrypts
and verifies before presenting Download decrypted file. Report success only
after whole-file verification, not after a credential test. If a later stream
fails, keep guidance visible to delete partial downloads and retry. Do not
claim device saving is complete merely because processing finished.

### Navigation and state

Use the same information order on mobile and desktop. Going back preserves
selection and input. Changing files, methods, or credentials invalidates any
prior verification/result. Tab switching preserves drafts. Prevent tab and
language changes during processing. Confirm language changes when inputs or
results would be cleared. Show cancellation only for paths that can stop safely.

## 5. State and feedback

| State | Information | Action |
| --- | --- | --- |
| No files | Selection prompt and browser restrictions | Choose files |
| Selected | Name, size, and count | Continue |
| Checking | Actual credential/file check | Prevent repeated execution |
| Ready | Files and method, expected effect | Execute |
| Processing | Actual operation; current file when multiple | Prevent conflicting navigation; allow safe stream cancellation |
| Buffered result | Processing and verification finished | Download result |
| Download requested/stream finished | Confirmable app event and browser-saving guidance | Check downloads |
| Credential error | Persistent label, reason, and recovery | Correct input |
| Processing/integrity error | Failure, partial-file disposal, retry guidance | Retry or start over |
| Copy denied | Selectable text and manual copying instructions | Copy manually |

Never invent progress percentages. Announce state changes with suitable live
regions. Show clipboard success only after the write promise resolves. Keep
secrets masked unless the user explicitly reveals them or requests manual copy.

## 6. Language and writing

Ship English and Korean only. Use a valid stored preference; otherwise select
Korean for a Korean browser and English for other browsers. Update both locale
files with matching keys. Keep copy out of components and retain other locale
sources for possible future additions.

Use concise actions and recovery instructions instead of generic Next, Error,
or Download complete labels. Explain cryptographic terms in help and advanced
flows. Keep repository documentation in English and app help in each supported
language. Preserve the original changelog.

## 7. Visual design and accessibility

- Use a neutral background, readable text, and one primary accent.
- Start with 4/8/12/16/24/32px spacing, 16px body text, 16px card corners,
  and 52px primary actions. Adapt heading size to viewport.
- Keep touch targets at least 44px. Distinguish states through text/icons
  as well as color and check normal-text contrast against WCAG AA.
- Preserve labels and connect helper/error text to inputs. Name visibility
  controls accessibly and expose their state.
- Use single action elements rather than links nested inside buttons.
  Connect tab IDs, controls, and panels.
- Move focus after step changes and toward errors. Support keyboard-only use,
  320px layouts, 200% enlargement, long names, and Korean text.
- Prefer buttons in document flow when a fixed action would overlap the
  virtual keyboard or device safe area.
- Use explicit light/dark palettes and respect reduced-motion preferences.

## 8. Implementation structure

Use MUI theme rules for semantic colors, typography, buttons, inputs, and focus.
Share repeated copy/key-input actions in `src/components/ui/`. Use a common
workflow view for selection, credentials, review, status, and results while
keeping the four existing streaming/buffered adapters responsible for processing.

Separate processing state from step numbers. Preserve cleanup of results,
Blob URLs, and worker operations on reset/unmount. Keep the `/headless/` form
and public-key query invitations working. Change the worker protocol only when
required to connect reliable lifecycle events; preserve cryptographic format.

## 9. Priorities

| Order | Work | Completion condition |
| --- | --- | --- |
| Preparation | Map flows, copy, and events | Define next actions for normal/error/result states |
| P0 | Accurate actions, storage guidance, completion and copy failure | Remove misleading feedback; preserve processing regressions |
| P1 | Shared presentation, themes, generation, restrictions, Korean | Complete password protection and reopening on mobile/desktop |
| P2 | Keys, generation, links/QR, dark states | Preserve advanced features on both processing paths |
| Finish | Accessibility, browser, and novice-user validation | Meet the validation criteria below |

## 10. Validation and release criteria

Reuse security and real-download browser tests. Preserve byte comparisons
when updating selectors. Exercise passwords and keys, wrong credentials,
truncated/corrupt ciphertext, partial multi-file failures, retries, cancellation,
single-file fallback, storage/clipboard restrictions, and language transitions.
Check Chromium, Firefox, WebKit, and mobile profiles. Verify physical iPhone/iPad
Safari saving to Files, memory limits, backgrounding, private browsing, and
service-worker updates before release.

Do not add logs, analytics, URLs, or browser storage containing file content,
passwords, or private keys. Invitations contain public keys only.

Ask five first-time users to protect, save, and reopen a small sample file
without instructions. Proposed goals, not measured results:

- At least four of five complete the full flow without help.
- Users can explain the next action and its result at every step.
- Users understand that required credentials cannot be recovered if lost.
- Users can choose a recovery action from error guidance.
- Users distinguish app completion from confirming a browser-saved file.

Release readiness requires functional regressions, keyboard/mobile usability,
and physical Safari saving validation. Do not request real sensitive files for
these checks. Fix blocked saving/key flows and validate them again.

## 11. Implemented decisions and remaining work

The implementation uses a shared `FileWorkflow`, English/Korean locales, and
MUI themes with `#2563d4` in light mode and `#8ab9ff` in dark mode. Stream
cancellation requires confirmation. Busy navigation is blocked; no artificial
progress is shown. Buffered results require a separate download action. Language
changes confirm clearing current data; ordinary back/tab actions retain drafts.

See [the implementation record](ui-ux-implementation.md) for results and scope.
Physical iOS and novice-user checks remain. Add languages later through a
separate translation and validation effort.
